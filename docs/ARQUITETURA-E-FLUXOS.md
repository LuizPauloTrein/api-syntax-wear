# Arquitetura e fluxos da API Syntax Wear

Este documento descreve a organização atual do backend, os principais arquivos, os fluxos de produtos e autenticação, o acesso ao banco de dados e os pontos de atenção identificados no código.

## Visão geral

A API é construída com Node.js, TypeScript e Fastify. O Prisma acessa um banco PostgreSQL, e o Zod valida os dados recebidos pela aplicação. As rotas são organizadas em módulos e encaminham o trabalho para controllers; os controllers validam e coordenam a requisição, enquanto os services concentram as operações de negócio e persistência.

```text
Cliente HTTP
    |
    v
Fastify (src/app.ts)
    |
    +--> hooks e middlewares (JWT, erros)
    |
    v
Rotas (src/routes/)
    |
    v
Controllers (src/controllers/)
    |
    +--> validação (src/utils/validators.ts)
    |
    v
Services (src/services/)
    |
    v
Prisma Client (src/utils/prisma.ts)
    |
    v
PostgreSQL
```

## Estrutura relevante

| Caminho | Responsabilidade |
| --- | --- |
| `src/app.ts` | Configura o Fastify, registra plugins, rotas, documentação, health check e o handler global de erros. Também inicia o servidor. |
| `src/routes/products.routes.ts` | Registra os endpoints de produtos, seus schemas OpenAPI e o hook de autenticação JWT. |
| `src/routes/categories.routes.ts` | Registra os endpoints públicos de leitura de categorias e seus schemas OpenAPI. |
| `src/routes/auth.routes.ts` | Registra os endpoints públicos de cadastro e login e descreve os corpos esperados na documentação da API. |
| `src/controllers/product.controller.ts` | Trata os parâmetros e corpos das requisições de produto, valida dados e chama os services. Gera o slug a partir do nome ao criar ou renomear. |
| `src/controllers/category.controller.ts` | Valida o ID e coordena a listagem e a consulta de categorias. |
| `src/controllers/auth.controller.ts` | Valida cadastro/login, chama os services de autenticação e emite tokens JWT. |
| `src/services/products.service.ts` | Implementa consulta, criação, atualização e desativação de produtos usando Prisma. |
| `src/services/categories.service.ts` | Implementa listagem e consulta de categorias por ID usando Prisma. |
| `src/services/auth.service.ts` | Verifica unicidade de e-mail, cria usuários com senha hash e confere credenciais no login. |
| `src/middlewares/auth.middleware.ts` | Verifica o JWT recebido nas rotas de produtos. |
| `src/middlewares/error.middleware.ts` | Converte erros de validação conhecidos em respostas 400 e demais erros em resposta 500. |
| `src/utils/validators.ts` | Define schemas Zod para autenticação, filtros e operações de produto. |
| `src/utils/prisma.ts` | Cria e exporta o Prisma Client usando o adaptador PostgreSQL e `DATABASE_URL`. |
| `src/types/index.ts` | Define interfaces TypeScript para filtros de produto e payloads de autenticação/produto. |
| `prisma/schema.prisma` | Define os modelos e enums do banco e o local de geração do Prisma Client. |
| `prisma/migrations/` | Guarda o histórico de migrações SQL versionadas. |
| `prisma/seed.ts` | Insere ou atualiza um conjunto de dez produtos de demonstração por slug. |
| `prisma.config.ts` | Informa ao Prisma o schema, o diretório de migrações e a URL do banco. |
| `docs/PRD-backend.md` | Requisitos e contexto de produto do backend. |

## Inicialização e plugins

`src/app.ts` carrega as variáveis de ambiente e configura:

- **Fastify com logger:** registra logs das requisições e erros.
- **JWT:** configura a assinatura e verificação dos tokens usando `JWT_SECRET`.
- **CORS:** aceita origens (`origin: true`) e credenciais.
- **Helmet:** adiciona cabeçalhos de segurança; a Content Security Policy está desabilitada explicitamente.
- **Swagger/OpenAPI e Scalar:** expõe a referência interativa em `/api-docs`.
- **Rotas:** registra produtos com prefixo `/products`, categorias públicas com prefixo `/categories` e autenticação com prefixo `/auth`.
- **Rotas gerais:** `/` retorna uma mensagem de status da aplicação e `/health` retorna estado e timestamp.
- **Tratamento global de erros:** encaminha exceções para `errorHandler`.

A porta é lida de `PORT`, com padrão `3000`. A aplicação requer `DATABASE_URL` para conectar ao PostgreSQL e `JWT_SECRET` para assinar/verificar JWTs.

### Scripts definidos

| Comando | Finalidade |
| --- | --- |
| `npm run dev` | Executa `src/app.ts` com `tsx watch`. |
| `npm run build` | Compila o TypeScript conforme `tsconfig.json`. |
| `npm run start` | Tenta iniciar `dist/server.js`. |
| `npm run prisma:generate` | Gera o Prisma Client. |
| `npm run prisma:migrate` | Executa `prisma migrate dev`. |
| `npm run prisma:studio` | Abre o Prisma Studio. |
| `npm run prisma:seed` | Executa `prisma/seed.ts` com `tsx`. |

**Atenção:** o arquivo de entrada existente é `src/app.ts`, que, pela configuração atual do TypeScript, é compilado como `dist/app.js`. O script `start` aponta para `dist/server.js`, arquivo que não corresponde a essa entrada. Verifique esse script antes de usar o modo de produção.

## Leitura de categorias

As rotas públicas de categorias não exigem token:

| Método e caminho | Ação | Comportamento atual |
| --- | --- | --- |
| `GET /categories` | Listar | Retorna as categorias cadastradas. |
| `GET /categories/:id` | Consultar | Valida o ID e retorna a categoria correspondente. |

O controller valida o parâmetro `id` com `categoryIdSchema` e chama `getCategoryById`; a persistência e as consultas são feitas pelo Prisma em `categories.service.ts`.

## CRUD de produtos

Todas as rotas de produtos passam pelo hook `onRequest` que chama `authenticate`. Portanto, **listagem e leitura também exigem token**, assim como criação, atualização e exclusão. O middleware usa `request.jwtVerify()`; se a verificação falhar, responde com status 401 e a mensagem `Token Invalido ou expirado`.

| Método e caminho | Ação | Comportamento atual |
| --- | --- | --- |
| `GET /products/` | Listar | Aceita paginação, faixa de preço, busca por nome/descrição e ordenação. |
| `GET /products/:id` | Consultar | Busca pelo ID e retorna erro se não encontrar o registro. |
| `POST /products/` | Criar | Gera o slug com base no nome, valida o payload e cria o produto. |
| `PUT /products/:id` | Atualizar | Valida campos opcionais; se o nome mudar, recalcula o slug. |
| `DELETE /products/:id` | Excluir | Não remove o registro; atualiza `active` para `false`. |

### Fluxo de listagem

1. O hook JWT valida a requisição.
2. `listProducts` valida `request.query` com `productFiltersSchema`.
3. `getProducts` monta os filtros Prisma:
   - `minPrice` e `maxPrice` viram limites inclusivos (`gte` e `lte`);
   - `search` procura por trecho em `name` ou `description`, sem diferenciar maiúsculas/minúsculas;
   - `page` e `limit` definem `skip` e `take`;
   - `sortBy`/`sortOrder` definem a ordenação.
4. A resposta é a lista retornada por `findMany`.

Os valores padrão aplicados pelo service são `page = 1`, `limit = 10`, `sortBy = "createdAt"` e `sortOrder = "desc"`. A consulta não aplica filtro `active`; assim, produtos desativados pela exclusão lógica podem continuar aparecendo na listagem.

### Fluxo de criação

1. O controller gera `slug` a partir de `name` usando `slugify` com letras minúsculas, modo estrito e locale `pt`.
2. `createProductSchema` valida os dados.
3. O service verifica se já existe produto com o slug.
4. O Prisma cria o registro.
5. O endpoint responde com status 201 e mensagem de sucesso.

### Fluxo de atualização

O controller valida o corpo com `updateProductSchema`. Os campos são opcionais; se houver `name`, o slug é recalculado. O service verifica a existência do produto e, se houver novo slug, confere se ele não pertence a outro registro. Em seguida, aplica a atualização via Prisma e retorna o produto atualizado.

### Fluxo de exclusão

O service verifica se o produto existe e define `active: false`. É uma **exclusão lógica**, não uma remoção física. O controller não envia explicitamente uma resposta de sucesso após a operação, e a listagem atualmente também não exclui produtos inativos.

## Validação, tipos e erros

Os tipos em `src/types/index.ts` fornecem contratos estáticos ao TypeScript. A validação de dados em tempo de execução é feita pelo Zod em `src/utils/validators.ts`; os schemas OpenAPI nas rotas descrevem os contratos para a documentação, mas são uma definição separada dos schemas Zod.

O handler global de `src/middlewares/error.middleware.ts`:

- responde 400 com detalhes estruturados para `ZodError`;
- responde 400 para erros de validação do Fastify;
- responde 500 para as demais exceções.

Os services atualmente lançam `Error` comum para situações como produto inexistente, slug duplicado, e-mail já cadastrado ou credenciais inválidas. Como não há mapeamento específico desses erros para 404/409/401 no handler, eles caem na resposta genérica 500. A resposta 500 também inclui `debug` com a mensagem da exceção.

## Autenticação

As rotas públicas são:

- `POST /auth/register`: valida os dados, cria o usuário e retorna usuário e token.
- `POST /auth/login`: valida e-mail/senha, verifica a senha com `bcrypt.compare` e retorna usuário e token.

No cadastro, a senha é processada com `bcrypt.hash(..., 10)`. O token é assinado com o payload `{ userId: user.id }`. A role padrão do usuário no schema Prisma é `USER`; apesar da existência de `Role.ADMIN`, as rotas de produto verificam apenas se o JWT é válido e não fazem autorização por role.

## Modelo de dados e Prisma

O banco configurado é PostgreSQL. O Prisma Client é instanciado em `src/utils/prisma.ts` com `PrismaPg`, usando `DATABASE_URL`.

### `User`

- `id`: identificador inteiro autoincremental.
- `firstName`, `lastName`, `email`, `password`: campos obrigatórios; e-mail único.
- `cpf`: opcional e único.
- `phone`, `birthDate`: opcionais.
- `createdAt`: preenchido automaticamente.
- `role`: enum `USER`/`ADMIN`, com padrão `USER`.

### `Product`

- `id`: identificador inteiro autoincremental.
- `name`, `slug`: texto; slug único.
- `description`: texto opcional.
- `price`: decimal.
- `images`, `sizes`: JSON opcionais.
- `stock`: inteiro com padrão zero.
- `active`: booleano com padrão `true`.
- `createdAt`: preenchido na criação; `updatedAt`: atualizado pelo Prisma.

As migrações SQL são o histórico aplicado ao banco. Compare-as com `schema.prisma` quando adicionar ou alterar campos para manter os dois alinhados.

## Seed de desenvolvimento

`prisma/seed.ts` define dez produtos e usa `upsert` com o `slug` como chave: cada execução cria produtos ausentes e atualiza os já existentes. As operações são agrupadas em uma transação; no encerramento, o cliente Prisma é desconectado. O seed precisa de `DATABASE_URL`.

## Documentação da API

O Swagger configura os metadados OpenAPI e a interface Scalar fica disponível em `/api-docs`. Os schemas de resposta e parâmetros nas rotas ajudam a descrever os endpoints, mas devem ser mantidos em sincronia com Zod, tipos e schema Prisma.

## Pontos de atenção identificados no código atual

Os itens abaixo registram discrepâncias existentes; não representam funcionalidades já corrigidas:

1. **Campos de produto fora de sincronia:** o modelo Prisma possui `images` e `sizes`, mas não possui `colors`. A interface `CreateProduct` e o schema de criação usam `imgaes` (erro de grafia), enquanto update e rotas usam `images`. O schema Zod de criação aceita `colors`, mas o Prisma não tem esse campo; a persistência pode falhar quando `colors` for enviado.
2. **Descrição do produto:** `description` é obrigatória na validação de criação e na documentação da rota, mas opcional (`String?`) no modelo Prisma.
3. **Migração e schema de usuário:** `schema.prisma` define `role`, mas a migração SQL inicial mostrada no repositório não cria essa coluna. Confirme o estado das migrações e do banco antes de depender do campo.
4. **Rota DELETE:** a operação executa a desativação lógica, porém o controller não envia corpo/status de sucesso explicitamente e o schema OpenAPI documenta uma resposta 200.
5. **Tratamento de erros de negócio:** erros comuns lançados pelos services são reportados como 500, sem distinguir recurso não encontrado ou conflito.
6. **Projeção de usuário:** `registerUser` e `loginUser` retornam o objeto completo do Prisma; os controllers o enviam na resposta juntamente com o token. Como esse objeto contém o campo `password` persistido (hash), a resposta deve ser revisada para expor apenas os campos necessários.
7. **Seed e geração do client:** os arquivos da aplicação importam o client gerado em `src/generated/prisma`, enquanto `prisma/seed.ts` importa tipos/client de `@prisma/client`. Confirme a configuração de geração e os comandos do seed para garantir que usam uma versão compatível do client.
8. **Script de produção:** `npm start` aponta para `dist/server.js`, embora o ponto de entrada do código seja `src/app.ts` e a saída TypeScript correspondente seja `dist/app.js`.
9. **Contrato de autenticação:** a configuração Swagger declara o scheme `betterAuth`, enquanto a rota DELETE referencia `bearerAuth`; além disso, a segurança aparece explicitamente apenas nessa documentação de rota, embora o hook autentique todas as rotas de produtos.

## Exemplo de uso

Os exemplos pressupõem um token válido obtido por `POST /auth/login` ou `POST /auth/register`.

```http
GET /products/?page=1&limit=10&minPrice=50&maxPrice=200&search=camiseta&sortBy=price&sortOrder=asc
Authorization: Bearer <token>
```

```http
POST /products/
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Camiseta Syntax",
  "description": "Camiseta de algodão",
  "price": 89.9,
  "stock": 20,
  "active": true,
  "sizes": ["P", "M", "G"],
  "images": []
}
```

O exemplo representa os campos aceitos no uso pretendido da API. Observe os pontos de atenção acima, em especial a divergência de `images` e a falta de `colors` no modelo Prisma, ao integrar esses campos com a persistência atual.
