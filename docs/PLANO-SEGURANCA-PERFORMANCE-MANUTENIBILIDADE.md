# Plano de segurança, performance e manutenibilidade da API

Este documento reúne (1) as falhas de segurança mais comuns em uma stack React + TypeScript + Fastify + PostgreSQL/Supabase, (2) o que foi encontrado na API `api-syntax-wear`, (3) melhorias de performance e de manutenção e (4) um plano passo a passo para corrigir tudo, em ordem de prioridade.

> **Este documento é só planejamento.** Nenhum código, schema, migration ou configuração foi alterado.

## 1. Escopo e limites da análise

| Foi analisado | Não foi analisado |
| --- | --- |
| Todo o código do backend (`src/`, `prisma/`, `package.json`, `.gitignore`, `.env.example`) | O front-end React (`syntax-wear-app`): o repositório não foi fornecido |
| Rotas de auth, produtos, categorias e pedidos, middlewares, validators e seed | Configuração real do Supabase (RLS, buckets, chaves, pooler) e do deploy |
| Execução dos pontos críticos contra as rotas reais, com banco simulado em memória | Teste de invasão (pentest), carga real e o banco de produção |
| `npm audit` das dependências de produção: **0 vulnerabilidades** hoje | Dependências futuras: sem lockfile versionado, esse resultado pode mudar |

Os achados marcados como **Confirmado** foram reproduzidos executando as rotas reais; os marcados **Verificar** dependem de algo que não está no repositório; **Provável** vêm da leitura do código e precisam de um teste com o Prisma real.

## 2. Resumo executivo

Os cinco problemas que merecem correção antes de qualquer outra coisa:

1. **Qualquer usuário logado cria, altera e apaga produtos.** As rotas de produto só checam o JWT, nunca a role. Confirmado: um usuário `USER` recém-cadastrado criou um produto com `201`.
2. **O hash da senha vai na resposta de `/auth/register` e `/auth/login`.** Nenhuma das duas rotas tem schema de resposta, então o usuário inteiro é devolvido. Confirmado.
3. **Os tokens JWT nunca expiram.** O token emitido não tem `exp`. Roubado uma vez, vale para sempre. Confirmado.
4. **O CORS aceita qualquer origem com credenciais.** `origin: true` reflete a origem de quem chamar. Confirmado com `https://site-malicioso.example`.
5. **Supabase: se o RLS não estiver ativo, as tabelas podem estar expostas pela API pública do Supabase.** Tabelas criadas pelo Prisma nascem sem RLS. Isso precisa ser conferido no painel **hoje** (ver S-03).

Em seguida vêm: ausência de limite de requisições (força bruta em login), erros 500 com a mensagem interna na resposta, paginação sem teto (`limit=1000000` chega ao banco) e o catálogo exigindo login.

## 3. Falhas comuns nessa stack e situação na sua API

Mapeadas pelo OWASP API Security Top 10 (2023):

| Categoria | Falha típica | Na sua API |
| --- | --- | --- |
| API1 – Autorização por objeto (BOLA/IDOR) | Ler ou alterar objeto de outro usuário trocando o ID | **OK em pedidos**: a consulta filtra por `userId` e devolve `404` igual para "não existe" e "é de outro". |
| API2 – Autenticação quebrada | Token sem expiração, força bruta, enumeração de usuário, senha fraca | **Encontrado**: S-04, S-06, S-11 |
| API3 – Exposição de propriedades | Devolver a entidade inteira (hash de senha), mass assignment | **Encontrado**: S-02, L-02 |
| API4 – Consumo irrestrito de recursos | Sem paginação máxima, sem rate limit, payload gigante | **Encontrado**: S-06, S-08, S-09 |
| API5 – Autorização por função (BFLA) | Rota administrativa acessível a usuário comum | **Encontrado**: S-01 |
| API6 – Fluxos de negócio sensíveis | Abuso de checkout, reserva de estoque | **Encontrado**: S-09 |
| API7 – SSRF | Servidor busca URL fornecida pelo usuário | Não se aplica hoje; atenção ao futuro `/shipping/calc` (ViaCEP) |
| API8 – Configuração insegura | CORS aberto, erros detalhados, docs públicas, RLS desligado | **Encontrado**: S-03, S-05, S-07, S-12 |
| API9 – Inventário impróprio | Docs e rotas antigas expostas em produção | **Encontrado**: `/api-docs` público (S-12) |
| API10 – Consumo inseguro de APIs | Confiar em webhook ou API externa sem validar | Futuro: webhook de pagamento (validar assinatura) |
| Injeção (SQL/NoSQL) | Concatenar entrada em consulta | **OK**: não há `$queryRaw` nem `eval`; o Prisma parametriza e `sortBy`/`sortOrder` são lista fixa no Zod. |
| Segredos no repositório | `.env` versionado | **OK**: `.env` está no `.gitignore` e não é rastreado. |

## 4. Achados de segurança

Severidade: **Crítico** (explorável agora, impacto alto), **Alto**, **Médio**, **Baixo**.

### S-01 · Crítico · Produtos sem checagem de role (Confirmado)
- **Onde:** `src/routes/products.routes.ts` (só `authenticate`), `src/controllers/product.controller.ts`.
- **Problema:** `POST`, `PUT` e `DELETE /products` aceitam qualquer JWT válido. O cadastro é aberto, então qualquer pessoa vira "dona" do catálogo: muda preço para R$ 0,01, zera estoque, desativa produtos.
- **Correção:** separar as rotas: leitura pública (ou autenticada) em `/products` e escrita em `/admin/products` com `authenticate` + `requireAdmin` (o `requireAdmin` já existe e é usado em `/admin/categories`).

### S-02 · Crítico · Hash da senha na resposta (Confirmado)
- **Onde:** `src/controllers/auth.controller.ts` (`reply.send({ user, token })`), `src/services/auth.service.ts`, `src/routes/auth.routes.ts` (sem `response`).
- **Problema:** `register` e `login` devolvem o registro completo, incluindo `password` (bcrypt), `cpf`, `phone` e `birthDate`. O hash facilita ataque offline.
- **Correção:** devolver só um DTO (`id`, `firstName`, `lastName`, `email`, `role`) e declarar `response` nas rotas (o serializador do Fastify descarta o que não está no schema). Usar `select`/`omit` do Prisma como defesa extra.

### S-03 · Crítico (a verificar) · Supabase: RLS e Data API
- **Onde:** painel do Supabase; `prisma/migrations`.
- **Problema:** tabelas criadas via Prisma **não** têm RLS ligado. Se o schema `public` estiver exposto pela API REST do Supabase, quem tiver a `anon key` (que fica pública no front) pode ler/escrever tabelas como `User` (com hashes de senha) e `Order`, ignorando totalmente a sua API.
- **Verificar:** no Supabase, **Database → Security Advisor** (alerta "RLS disabled") e **Settings → API** (schemas expostos).
- **Correção:** ativar RLS em todas as tabelas sem policies (nega `anon` e `authenticated`); a API conecta por um papel próprio que ignora RLS (ver P-05); remover `public` dos schemas expostos se o front não usar a Data API; nunca expor a `service_role key`.

### S-04 · Alto · JWT sem expiração e segredo sem validação (Confirmado)
- **Onde:** `src/controllers/auth.controller.ts` (`jwt.sign({ userId })`), `src/app.ts` (`process.env.JWT_SECRET!`).
- **Problema:** sem `exp`, o token vale para sempre e não há como encerrar uma sessão. O segredo não é validado: `.env.example` usa `"jwt token"` e nada impede um segredo curto em produção.
- **Correção:** `expiresIn` curto (ex.: 15 min a 1 h) com estratégia de renovação (passo 32 do plano) e validar no boot que `JWT_SECRET` tem no mínimo 32 caracteres aleatórios.

### S-05 · Alto · CORS aberto com credenciais (Confirmado)
- **Onde:** `src/app.ts` (`origin: true, credentials: true`).
- **Problema:** reflete qualquer `Origin`. Hoje o token vai em header, o que limita o estrago, mas a configuração vira falha grave no dia em que houver cookie de sessão.
- **Correção:** lista de origens permitidas vinda de `CORS_ORIGINS` (front de produção e de desenvolvimento); `credentials: true` só se houver cookies.

### S-06 · Alto · Sem rate limit, enumeração de usuário e login com 500 (Confirmado)
- **Onde:** `src/services/auth.service.ts`, `src/controllers/auth.controller.ts`, `src/app.ts`.
- **Problema:** não há limite de tentativas em `/auth/login` e `/auth/register`. Além disso:
  - "Usuário não encontrado" e "Senha inválida" são mensagens diferentes, o que revela quais e-mails existem;
  - os erros são `Error` genéricos, então caem no handler e respondem **500** em vez de 401/409;
  - a comparação só roda o bcrypt quando o usuário existe, então o tempo de resposta também denuncia o e-mail.
- **Correção:** `@fastify/rate-limit` (global generoso, login/registro estritos, por IP e por e-mail); mesma resposta `401 Credenciais inválidas` nos dois casos; comparar contra um hash fictício quando o usuário não existe; `409` para e-mail repetido (aceitando o risco de enumeração no cadastro, ou resposta neutra com confirmação por e-mail).

### S-07 · Alto · Erros vazam detalhes internos e viram 500 indevidamente (Confirmado)
- **Onde:** `src/middlewares/error.middleware.ts` (`debug: error.message`).
- **Problema:** toda exceção não tratada devolve `{ message, debug: <mensagem interna> }`. Mensagens de Prisma e de bibliotecas podem expor tabelas, colunas e trechos de consulta. O handler também transforma erros 4xx do próprio Fastify (JSON malformado, `Content-Type` não suportado, corpo grande demais) em 500.
- **Correção:** em produção, resposta genérica sem `debug`; respeitar `error.statusCode` quando for 4xx; registrar o detalhe só no log, com ID de requisição.

### S-08 · Alto · Paginação sem teto e listagens com produtos inativos (Confirmado)
- **Onde:** `src/utils/validators.ts` (`productFiltersSchema.limit`), `src/services/categories.service.ts` (`getCategoryById` com `include: { products: true }`), `src/services/products.service.ts` (`getProducts` sem filtro `active`).
- **Problema:** `GET /products?limit=1000000` chega ao banco com `take: 1000000` (testado). No service, a consulta de categoria por ID lê do banco **todos** os produtos da categoria, inclusive os inativos e sem limite; o schema de resposta atual descarta essa lista, então ela não chega ao cliente, mas a consulta é pesada e vira vazamento se alguém declarar `products` no schema. A listagem de produtos mostra inativos de fato.
- **Correção:** `limit` máximo (ex.: 100) em todas as listagens; filtrar `active: true` nas rotas públicas; paginar ou limitar os produtos dentro da categoria.

### S-09 · Médio · Pedidos: abuso de estoque e entrada sem limite
- **Onde:** `src/services/orders.service.ts`, `src/utils/validators.ts` (`createOrderSchema`).
- **Problema:** como o estoque é descontado na criação, uma conta pode criar vários pedidos `PENDING` e "segurar" todo o estoque. Não há limite de itens por pedido, nem chave de idempotência (duplo clique cria dois pedidos), nem expiração de pedido não pago.
- **Correção:** máximo de itens por pedido (ex.: 50); limite de pedidos `PENDING` por usuário; `Idempotency-Key`; job que cancela pedidos `PENDING` antigos devolvendo o estoque; rate limit em `POST /orders`.

### S-10 · Médio · Seed com credencial conhecida
- **Onde:** `prisma/seed.ts` (`cliente.demo@syntaxwear.dev` / `123456`).
- **Problema:** se o seed rodar contra o banco de produção, nasce um usuário com senha pública.
- **Correção:** o seed recusa rodar com `NODE_ENV=production` e a senha demo vem de variável de ambiente.

### S-11 · Médio · Política de senha e dados pessoais
- **Onde:** `src/utils/validators.ts` (`registerSchema`).
- **Problema:** senha com mínimo de 6 caracteres (o PRD pede 8), sem checagem de senhas comuns, CPF sem validação de dígitos, telefone e data sem formato. CPF, telefone e nascimento são dados pessoais (LGPD) e hoje saem em respostas.
- **Correção:** mínimo 8–10 caracteres, bloquear senhas muito comuns, validar CPF e formato de telefone, devolver só os campos necessários e documentar retenção e exclusão de conta.

### S-12 · Médio · Configuração de produção
- **Onde:** `src/app.ts`.
- **Problemas:**
  - `/api-docs` (Scalar) público em qualquer ambiente, o que serve de mapa da API;
  - `contentSecurityPolicy: false` no Helmet;
  - sem `trustProxy`, então rate limit e logs veriam o IP do proxy da hospedagem;
  - logs sem `redact` do header `Authorization`;
  - `fastify.listen({ port })` sem `host` (ouve só em localhost por padrão; `HOST` existe no `.env.example`, mas não é usado).
- **Correção:** docs só fora de produção (ou atrás de autenticação), CSP restritiva para a API, `trustProxy` conforme a hospedagem, `redact` no logger, `host` configurável.

### S-13 · Médio · Catálogo exige login
- **Onde:** `src/routes/products.routes.ts` (`addHook("onRequest", authenticate)` no plugin inteiro).
- **Problema:** o PRD prevê listagem pública de produtos, mas hoje `GET /products` sem token dá `401` (testado). Além de quebrar a vitrine, empurra o front a guardar token cedo demais.
- **Correção:** GET públicos de produtos (já com filtro `active`); autenticação só em escrita e em pedidos.

### S-14 · Médio · Dependências e repositório
- **Onde:** `.gitignore`, `package.json`.
- **Problemas:** `package-lock.json` está no `.gitignore` (builds não reproduzíveis, difícil auditar a cadeia de suprimentos) e `prisma/migrations/` também está ignorado (as migrations atuais só estão no Git por terem sido adicionadas antes da regra; as novas **não** entram, e o banco de produção não consegue reproduzir o schema).
- **Correção:** versionar `package-lock.json` e `prisma/migrations/`; Dependabot ou Renovate; `npm audit` no CI.

### Achados menores (Baixo)

| ID | Onde | Problema |
| --- | --- | --- |
| L-01 | `auth.service.ts` | `birthDate: payload.dateBirth` envia texto `YYYY-MM-DD` a um campo `DateTime`; o Prisma tende a rejeitar sem hora (provável, validar). |
| L-02 | `validators.ts` / `types/index.ts` | `createProductSchema` usa `imgaes` (typo) e `colors` sem coluna: `images` enviado na criação é descartado em silêncio, e `colors` pode fazer o Prisma recusar. |
| L-03 | `validators.ts` | `updateProductSchema` aceita `slug` do cliente (e o controller só o recalcula quando o nome muda). |
| L-04 | `product.controller.ts` | `slugify(body.name)` roda antes da validação; corpo sem `name` string quebra com 500. |
| L-05 | `products.service.ts` | Produto inexistente lança `Error` genérico (500), deveria ser 404. |
| L-06 | `src/app.ts` | Campo `verison` com typo na rota raiz. |
| L-07 | `admin.middleware.ts` | `request.user as { userId }` é um cast sem tipo; ver M-04. |

### Falhas comuns do lado React (a conferir quando o front for enviado)

- **Token no `localStorage`:** qualquer XSS rouba a sessão. Preferir cookie `httpOnly` + `SameSite`, ou token curto em memória.
- **XSS:** `dangerouslySetInnerHTML` com descrição de produto ou texto vindo da API; sanitizar ou renderizar como texto.
- **Segredos em variáveis do bundle:** tudo que começa com `VITE_`/`NEXT_PUBLIC_` é público. Nunca colocar `service_role` do Supabase ali.
- **Controle de acesso só na interface:** esconder o botão "Admin" não protege nada; a API é quem decide (S-01).
- **Confiar em preço/total vindo do cliente:** a API já ignora o preço do payload ao criar pedidos, o que está correto.
- **CSP, source maps públicos, redirecionamento após login (open redirect) e dependências desatualizadas.**

## 5. Performance

| ID | Melhoria | Detalhe |
| --- | --- | --- |
| P-01 | Índices | `Product(active)`; `Order(userId, createdAt DESC)` para a listagem do usuário; `Order(status, createdAt)` para o admin; `Category(active)`. A busca `contains` com `mode: "insensitive"` faz varredura completa: usar índice GIN `pg_trgm` em `name`/`description`. |
| P-02 | Paginação com metadados | Hoje as listagens devolvem um array puro, sem `total`. Passar a devolver `{ data, page, limit, total }`; para listas grandes, paginação por cursor. É uma mudança de contrato (ver M-12). |
| P-03 | Respostas enxutas | Usar `select` e DTOs: listagem de produtos sem campos desnecessários; listagem de pedidos sem `items` quando não for preciso; categoria por ID sem todos os produtos. |
| P-04 | Menos consultas por requisição | `createProduct` faz 3 consultas em série (slug, categoria, criação): confiar na constraint única (`P2002`) e validar a categoria em uma única consulta. `requireAdmin` consulta o banco em toda requisição admin: cachear a role por poucos segundos ou incluí-la no JWT de vida curta. |
| P-05 | Conexão com o Supabase | Usar o pooler (modo transação, porta 6543) no runtime e a conexão direta (5432) só nas migrations; SSL obrigatório; configurar `max`, `idleTimeoutMillis` e `connectionTimeoutMillis` no `PrismaPg`. Um papel de banco dedicado com o mínimo de permissões em vez do `postgres`. |
| P-06 | Cache e compressão HTTP | `Cache-Control` e `ETag` nas listagens públicas de produtos e categorias; `@fastify/compress`; CDN na frente do catálogo. |
| P-07 | Observabilidade | Logger com ID de requisição e `redact`; log de consultas lentas do Prisma; `/health` que também testa o banco; métricas básicas (latência e erros). |
| P-08 | Encerramento e carga | Graceful shutdown (`fastify.close()` e `prisma.$disconnect()` em `SIGTERM`/`SIGINT`) e `@fastify/under-pressure`. Hoje não há nenhum. |
| P-09 | Serialização | Declarar `response` schema em todas as rotas: o Fastify serializa mais rápido e deixa de devolver campos indevidos (resolve também S-02). |
| P-10 | Medir antes de otimizar | `EXPLAIN ANALYZE` nas consultas das listagens e `autocannon` nas rotas de leitura e na criação de pedido, antes e depois de cada índice. |

## 6. Manutenibilidade

| ID | Melhoria | Detalhe |
| --- | --- | --- |
| M-01 | Separar app e servidor | `src/app.ts` cria o Fastify **e** chama `listen`. Criar `buildApp()` (só monta) e `server.ts` (só sobe). Isso viabiliza testes com `app.inject` e corrige o script `start`, que aponta para `dist/server.js`, arquivo que hoje não existe. |
| M-02 | Configuração validada | Um `src/config/env.ts` com Zod: `NODE_ENV`, `PORT`, `HOST`, `DATABASE_URL`, `JWT_SECRET` (mín. 32), `CORS_ORIGINS`. A aplicação não sobe com configuração inválida, em vez de falhar no meio de uma requisição. |
| M-03 | Erros centralizados | Hoje cada controller repete `try/catch` e mapeia classes de erro para status. Criar uma base `AppError(statusCode, code, message)` (`NotFound`, `Conflict`, `BadRequest`, `Unauthorized`, `Forbidden`) e deixar o `errorHandler` traduzir. Controllers ficam finos e os `throw new Error("...")` genéricos dos services somem. |
| M-04 | Tipar o JWT | Fazer o *module augmentation* de `@fastify/jwt` (`payload: { userId; role? }`) para eliminar os casts `request.user as {...}`. |
| M-05 | Uma única fonte de validação | Hoje há JSON Schema nas rotas **e** Zod nos controllers, mais interfaces em `types/index.ts`, e eles já divergiram (`imgaes`). Adotar Zod com `fastify-type-provider-zod` (ou equivalente): o mesmo schema valida, tipa e gera o OpenAPI, e os tipos passam a ser `z.infer`. |
| M-06 | Nomes de arquivo consistentes | Há `categories.routes.ts` e `admin-categories.routes.ts` (kebab-case), mas no seu explorer o arquivo aparece como `adminCategories.routes.ts`. Escolher um padrão e conferir que o `import` em `app.ts` bate com o nome real. |
| M-07 | Higiene de código | ESLint (com `eslint-plugin-security`) e Prettier, hooks de pre-commit, remover imports sem uso (`optional` em `validators.ts`), corrigir typos (`imgaes`, `verison`), padronizar o idioma das mensagens e dos nomes. |
| M-08 | Testes e CI | Vitest com `app.inject` para as regras críticas: autorização por role, propriedade do pedido, estoque (inclusive concorrência), cancelamento, validações. Banco de teste real (Postgres em container) para os testes de transação. GitHub Actions: `tsc`, lint, testes, `npm audit`, `prisma validate`. |
| M-09 | Migrations e deploy reproduzíveis | Versionar migrations e lockfile (S-14), um `Dockerfile`, scripts de `build`/`start` corretos e um README com o passo a passo de subir o ambiente. |
| M-10 | DTOs e mapeadores | Não devolver entidades cruas do Prisma. Um mapeador por recurso (`toUserDTO`, `toOrderDTO`) concentra o que sai da API e evita regressões como S-02. |
| M-11 | Filtro de soft delete central | `active` é filtrado à mão em cada consulta, e já escapou em `getProducts` e na categoria por ID. Centralizar com uma extensão do Prisma Client ou funções de consulta únicas. |
| M-12 | Versionar a API | Antes de mudar contratos (paginação com `total`, rotas `/admin/products`), publicar sob `/v1` e avisar o front. |
| M-13 | Documentação viva | Atualizar `ARQUITETURA-E-FLUXOS.md` (hoje descreve autorização como inexistente), exemplos nos schemas OpenAPI e registros curtos de decisão (ADR) para escolhas como expiração do token e estratégia de estoque. |

## 7. Plano passo a passo

Cada passo traz os arquivos envolvidos, o critério de aceite e o esforço (**P** ≈ até 2 h, **M** ≈ meio dia, **G** ≈ 1 a 2 dias). Passos marcados com ⚠️ mudam contrato ou comportamento e exigem alinhamento com o front.

### Fase 0 · Correções urgentes (começar já)

1. **Conferir o RLS no Supabase (S-03).** Painel: Security Advisor e schemas expostos na API.
   *Aceite:* nenhuma tabela do `public` com RLS desligado exposta à Data API. **P**
2. **Proteger a escrita de produtos (S-01).** Mover `POST/PUT/DELETE` para `/admin/products` com `authenticate` + `requireAdmin`; manter `GET` em `/products`. ⚠️
   *Arquivos:* `products.routes.ts` (dividir em dois módulos), `app.ts`.
   *Aceite:* usuário `USER` recebe `403` nas três rotas; `ADMIN` continua funcionando. **M**
3. **Parar de vazar o hash (S-02).** DTO de usuário e `response` schema em `/auth/login` e `/auth/register`.
   *Arquivos:* `auth.controller.ts`, `auth.service.ts`, `auth.routes.ts`.
   *Aceite:* nenhuma resposta de auth contém `password`, `cpf`, `phone` ou `birthDate`. **P**
4. **Expiração do JWT e validação do segredo (S-04).** `expiresIn` na assinatura e uma checagem simples de `JWT_SECRET` (mínimo 32 caracteres) no boot; no passo 11 essa checagem passa para o `env.ts`. ⚠️ (o front precisa tratar `401` por expiração)
   *Aceite:* token emitido contém `exp`; a aplicação não sobe com segredo curto. **P**
5. **Fechar o CORS (S-05).** Lista de origens em `CORS_ORIGINS`.
   *Aceite:* origem fora da lista não recebe `access-control-allow-origin`. **P**
6. **Esconder detalhes de erro (S-07).** Remover `debug` em produção, respeitar `statusCode` 4xx do Fastify.
   *Arquivo:* `error.middleware.ts`.
   *Aceite:* JSON inválido responde `400`; nenhum erro 5xx expõe mensagem interna. **P**
7. **Teto de paginação (S-08).** `limit` máximo 100 em produtos e `active: true` nas listagens públicas; limitar os produtos lidos em `getCategoryById`.
   *Aceite:* `?limit=1000000` responde `400`; produto inativo não aparece em rota pública. **P**
8. **Proteger o seed (S-10).** Recusar `NODE_ENV=production`.
   *Arquivo:* `prisma/seed.ts`. **P**
9. **Versionar lockfile e migrations (S-14).** Remover as duas linhas do `.gitignore`, commitar `package-lock.json` e as migrations pendentes.
   *Aceite:* um clone limpo recria o schema com `prisma migrate deploy`. **P**

### Fase 1 · Autenticação e configuração

10. **Rate limit (S-06).** `@fastify/rate-limit`: limite global moderado e limites estritos em `/auth/login`, `/auth/register` e `POST /orders`. Ajustar `trustProxy`.
    *Aceite:* após N tentativas o login responde `429`. **M**
11. **Configuração validada (M-02).** Criar `src/config/env.ts` e usar em `app.ts`, `prisma.ts` e `seed.ts`; usar `HOST`.
    *Aceite:* variável ausente ou inválida impede o boot com mensagem clara. **M**
12. **Erros centralizados (M-03).** `AppError` e subclasses; refatorar services e controllers de auth, categorias, produtos e pedidos; `errorHandler` traduz.
    *Aceite:* login errado `401`, e-mail repetido `409`, produto inexistente `404`, tudo sem `try/catch` nos controllers. **G**
13. **Login sem enumeração (S-06).** Mensagem única, comparação contra hash fictício, mesmo tempo de resposta aproximado.
    *Aceite:* resposta idêntica para e-mail inexistente e senha errada. **P**
14. **Política de senha e dados pessoais (S-11).** Mínimo 8+, lista de senhas comuns, validação de CPF/telefone/data; corrigir `birthDate` (L-01).
    *Aceite:* cadastro com senha fraca ou CPF inválido responde `400`. **M**
15. **Endurecer a configuração HTTP (S-12).** Docs só fora de produção, CSP, `redact` de `Authorization` nos logs, `Cache-Control: no-store` nas rotas de auth.
    *Aceite:* `/api-docs` responde `404` em produção. **M**
16. **Catálogo público (S-13).** `GET /products` e `GET /products/:id` sem login (só `active: true`); autenticação só para escrita e pedidos. ⚠️
    *Aceite:* listagem funciona sem token e nunca devolve produto inativo. **P**

### Fase 2 · Performance

17. **Migration de índices (P-01).** `Product(active)`, `Order(userId, createdAt)`, `Order(status, createdAt)`, `Category(active)` e `pg_trgm` na busca. Medir com `EXPLAIN ANALYZE` antes e depois (P-10).
    *Aceite:* listagens e busca sem varredura completa no plano de execução. **M**
18. **Conexão com o Supabase (P-05).** Pooler no runtime, conexão direta nas migrations, SSL, parâmetros do pool, papel de banco dedicado.
    *Aceite:* a API roda pelo pooler e `migrate deploy` roda pela conexão direta. **M**
19. **Respostas enxutas e DTOs (P-03, P-09, M-10).** `select` nas listagens, mapeadores por recurso, `response` schema em todas as rotas.
    *Aceite:* nenhuma rota devolve campo fora do schema. **G**
20. **Paginação com metadados (P-02).** `{ data, page, limit, total }` em produtos, pedidos e categorias, sob `/v1` (passo 29). ⚠️
    *Aceite:* o front consegue montar paginação sem pedir tudo. **M**
21. **Cache, compressão e consultas (P-04, P-06).** `Cache-Control`/`ETag` no catálogo, `@fastify/compress`, `createProduct` apoiado na constraint única, cache curto da role no `requireAdmin`.
    *Aceite:* ganho medido no `autocannon` e menos consultas por requisição. **M**
22. **Encerramento e saúde (P-07, P-08).** Graceful shutdown, `/health` com teste do banco, `under-pressure`, log de consultas lentas.
    *Aceite:* um `SIGTERM` conclui as requisições em andamento e fecha a conexão. **M**

### Fase 3 · Manutenibilidade e qualidade

23. **Separar `buildApp()` e `server.ts` (M-01)** e corrigir os scripts `start` e `dev`.
    *Aceite:* `npm run build && npm start` sobe a API; testes usam `app.inject`. **M**
24. **Tipar o JWT (M-04)** e remover os casts.
    *Aceite:* `request.user.userId` é tipado sem `as`. **P**
25. **Zod como fonte única (M-05).** Adotar o type provider, derivar tipos com `z.infer`, apagar as interfaces duplicadas e corrigir `imgaes`/`colors` (L-02, L-03, L-04). ⚠️
    *Aceite:* um schema por rota; OpenAPI gerado dele. **G**
26. **Lint, formatação e hooks (M-07).** ESLint, `eslint-plugin-security`, Prettier, pre-commit; corrigir nomes (M-06) e typos (L-06).
    *Aceite:* `npm run lint` limpo. **M**
27. **Testes e CI (M-08).** Vitest e Postgres de teste. Cobrir: role em rotas admin, dono do pedido, estoque e concorrência, cancelamento, auth (expiração, `429`, resposta sem hash), validações. GitHub Actions com `tsc`, lint, testes, `npm audit` e `prisma validate`.
    *Aceite:* o pipeline fica verde e bloqueia merge com falha. **G**
28. **Soft delete central (M-11)** e atualização da documentação (M-13).
    *Aceite:* nenhuma consulta pública esquece `active`; `ARQUITETURA-E-FLUXOS.md` reflete a realidade. **M**
29. **Versionar a API (M-12)** sob `/v1`, antes de publicar as mudanças de contrato dos passos 2, 16 e 20. ⚠️ **P**

### Fase 4 · Pedidos e endurecimento do negócio

30. **Proteções do checkout (S-09).** Máximo de itens, limite de pedidos `PENDING` por usuário, `Idempotency-Key`, expiração automática de pedidos não pagos (devolvendo o estoque).
    *Aceite:* duplo clique não duplica pedido; pedido pendente antigo é cancelado sozinho. **G**
31. **Rotas administrativas de pedidos.** `GET /admin/orders`, consulta por ID e atualização de status com a tabela de transições do plano de pedidos, todas com `requireAdmin` e registro de quem alterou. **G**
32. **Refresh token e sessão (S-04).** Token de acesso curto + refresh token rotativo, preferencialmente em cookie `httpOnly`, com revogação no logout. ⚠️ **G**

### Fase 5 · Antes das próximas integrações

33. **Pagamento:** validar a assinatura do webhook, idempotência por evento e nunca marcar `PAID` sem confirmação do gateway.
34. **Frete (`/shipping/calc`):** chamar a ViaCEP só com CEP validado (8 dígitos), com *timeout*, sem seguir redirecionamentos e com cache, para evitar SSRF e lentidão.
35. **Upload de imagens:** validar tipo real e tamanho, nomes gerados no servidor, políticas do bucket no Supabase e nenhum arquivo executável servido.
36. **LGPD:** política de retenção, exclusão/anonimização de conta e minimização dos dados pessoais armazenados.

## 8. Decisões a confirmar antes de começar

1. **Duração do token e renovação:** token de acesso de 15 min com refresh, ou 1 h sem refresh por enquanto? (passos 4 e 32)
2. **Onde guardar o token no React:** cookie `httpOnly` (mais seguro, exige CORS e CSRF bem configurados) ou memória/`localStorage` (mais simples, mais exposto a XSS).
3. **Catálogo público:** confirmar que produtos e categorias não exigem login, como no PRD. (passo 16)
4. **Rotas de admin de produtos:** mover para `/admin/products` (recomendado, quebra o front atual) ou manter `/products` e só exigir a role?
5. **Formato de paginação:** aceitar `{ data, page, limit, total }`, o que muda o contrato atual. (passo 20)
6. **Uso do Supabase:** o front usa a Data API ou o Auth do Supabase? Isso define se o RLS bloqueia tudo ou se precisa de policies, e se existe um segundo sistema de login além do JWT da API.
7. **Limites de rate limit e de pedidos pendentes:** valores iniciais (sugestão: 10 tentativas de login por 15 min por IP+e-mail; 5 pedidos `PENDING` por usuário).
8. **Política de senha:** mínimo de 8 ou 10 caracteres?
9. **Front-end:** enviar o repositório `syntax-wear-app` para uma auditoria da parte React.

## 9. Como verificar cada correção

- **Autorização:** teste automatizado por rota (`USER` → `403`, `ADMIN` → sucesso, sem token → `401`).
- **Vazamento de dados:** teste que percorre as respostas de auth e falha se encontrar `password`, `$2b$` ou `cpf`.
- **Limites:** `limit` acima do teto → `400`; `429` após estourar o rate limit.
- **Erros:** JSON malformado → `400`; falha interna → corpo genérico sem `debug`.
- **Supabase:** Security Advisor sem alertas e uma chamada à Data API com a `anon key` sem acesso às tabelas.
- **Performance:** `EXPLAIN ANALYZE` e `autocannon` antes e depois de cada índice ou cache.
- **Varredura geral:** OWASP ZAP (*baseline scan*) contra o ambiente de desenvolvimento e `npm audit` a cada pull request.

## 10. Escopo deste planejamento

Este documento registra somente o plano de trabalho. Não foram feitas alterações no código, no schema Prisma, nas migrations, no banco de dados nem na configuração do Supabase.