# Planejamento: CRUD de categorias e vínculo com produtos

Este documento planeja a implementação de um CRUD de categorias e sua associação com produtos. O escopo segue o padrão existente no CRUD de produtos e os requisitos descritos em `PRD-backend.md`.

## Etapa 1 — Modelo Prisma, migration e atualização do banco

- Criar o modelo `Category` com os campos:
  - `id`: identificador autoincremental;
  - `name`: nome da categoria;
  - `slug`: identificador único;
  - `description`: descrição opcional;
  - `products`: relação com os produtos associados.
- Adicionar a relação entre `Category` e `Product`.
- Incluir `categoryId` em `Product`, com relação obrigatória conforme o modelo proposto no PRD.
- Gerar e revisar a migration antes de aplicá-la ao banco.
- Atualizar o Prisma Client e verificar o alinhamento entre o schema e as migrations.
- Conferir o estado das migrations e o ambiente indicado por `DATABASE_URL` antes de alterar o banco.

### Produtos existentes

Como já existem produtos sem categoria, tornar `categoryId` obrigatório requer atribuir uma categoria aos registros existentes ou realizar uma migração gradual. A recomendação inicial é criar uma categoria como “Sem categoria” e associar a ela os produtos atuais, evitando registros sem vínculo.

## Etapa 2 — Service de categorias e integração com produtos

- Criar `categories.service.ts`, seguindo o padrão de `products.service.ts`.
- Implementar operações para listar, buscar por ID, criar, atualizar e excluir categorias.
- Gerar o slug na criação e na alteração do nome, verificando sua unicidade.
- Validar a existência da categoria informada ao criar ou atualizar um produto.
- Atualizar o service de produtos para persistir e retornar o relacionamento com a categoria.
- Adicionar o filtro `categoryId` à listagem de produtos, conforme previsto no PRD.

### Regra recomendada para exclusão

Impedir a exclusão de uma categoria que ainda tenha produtos associados e retornar um erro de conflito claro. Isso evita que produtos percam sua classificação sem uma ação explícita.

## Etapa 3 — Controller e validação

- Criar `category.controller.ts` para coordenar os dados das requisições e as chamadas ao service.
- Adicionar em `validators.ts` schemas Zod para criação, atualização, parâmetros e filtros de categoria.
- Atualizar `types/index.ts` com os tipos de categoria e o filtro `categoryId` dos produtos.
- Atualizar os controllers de produto para receber e validar `categoryId`.
- Manter os formatos de resposta e erros coerentes com o restante da API.

## Etapa 4 — Rotas, autorização, documentação e verificação

- Criar as rotas de categorias e seus schemas OpenAPI para parâmetros, corpos e respostas.
- Seguir a divisão prevista no PRD: `GET /categories` público e operações administrativas em `/admin/categories`.
- Atualizar as rotas de produtos para documentar o vínculo com categoria e o filtro por `categoryId`.
- Aplicar autenticação e autorização adequadas às rotas administrativas.
- Verificar o CRUD de categorias, a unicidade de slug, a associação de produtos, a filtragem e a regra de exclusão.

### Autorização administrativa

O middleware atual de produtos verifica se o JWT é válido, mas não verifica a role do usuário. Como o PRD exige acesso administrativo ao CRUD de categorias, a implementação deverá incluir autorização para usuários com role `ADMIN`; autenticação JWT, por si só, não atende a esse requisito.

## Decisões a confirmar antes da implementação

1. **Produtos existentes:** confirmar se deve ser criada uma categoria “Sem categoria” para associar os produtos atuais, ou se prefere outra estratégia de migração.
2. **Exclusão de categoria:** confirmar se categorias que ainda tenham produtos associados devem ter sua exclusão impedida. A recomendação é bloquear a exclusão até que os produtos sejam reassociados.

## Escopo deste planejamento

Este documento registra somente o plano de trabalho. Não foram feitas alterações no código, no schema Prisma, nas migrations ou no banco de dados.
