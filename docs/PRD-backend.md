# PRD — API Backend para Syntax Wear

Última atualização: 25 de novembro de 2025

## Objetivo

Construir uma API REST em Node.js + Fastify + TypeScript que suporte o front-end existente do projeto `syntax-wear-app`. A API deverá gerenciar catálogo (produtos e categorias), autenticação, pedidos (checkout), cálculo de frete por CEP, gerenciamento de assinaturas/newsletter e armazenamento de imagens em Supabase Storage. Persistência via Supabase Postgres acessada por Prisma. Autenticação via JWT.

## Escopo do MVP

- Autenticação: signup / signin (JWT)
- CRUD de Produtos e Categorias (rotas admin)
- Listagem pública de produtos com filtros (categoria, busca, paginação)
- Checkout: criação de pedido, validação de estoque, shipping calc por CEP
- Subscrição de newsletter
- Upload e consulta de imagens de produto via Supabase Storage
- Suíte de testes mínima com Vitest (unit + integração)

## Principais entidades (observadas no front-end)

- Product
  - Campos recomendados: `id`, `name`, `slug`, `description?`, `price` (Decimal), `sku?`, `images[]` (URLs), `sizes?` (Json), `stock` (Int), `active` (Boolean), `categoryId`
  - Evidências no front: `src/interfaces/product.ts`, `src/components/ProductCard/index.tsx`, `src/mocks/products.ts`

- Category
  - Campos: `id`, `name`, `slug`, `description?`
  - Evidências: `src/mocks/categories.ts`, `src/components/Categories/index.tsx`

- User
  - Campos: `id`, `firstName`, `lastName`, `email`, `passwordHash`, `cpf?`, `phone?`, `birthDate?`, `createdAt`
  - Evidências: `src/components/RegisterForm/index.tsx`, `src/components/LoginForm/index.tsx`, `src/utils/cpf-validator.ts`

- Address
  - Campos: `cep`, `street`, `number`, `complement?`, `neighborhood`, `city`, `state`, `country`
  - Evidências: `src/CEPForm/cep-form.schema.ts`, `src/components/CEPForm/index.tsx`

- Order (implícito pelo fluxo de checkout)
  - Campos: `id`, `userId?`, `items[]` (OrderItem), `shippingAddress` (Json), `total` (Decimal), `paymentMethod`, `status`, `createdAt`

- Subscription
  - Campos: `id`, `email`, `subscribedAt`
  - Evidência: `src/components/SubscriptionForm/index.tsx`

## Endpoints (recomendados)

Observação: use validação com Zod/Joi em todas as entradas.

Públicos

- GET /products
  - Query: `categoryId?`, `q?`, `page?`, `limit?`
  - Response: paginated list [{ id, name, price, slug, images[], categoryId }]

- GET /products/:id

- GET /categories

- POST /shipping/calc
  - Payload: `{ "cep": "01001000" }` (string com 8 dígitos)
  - Response: `{ address: {...}, shippingCost: number }`
  - Implementação: lookup via viaCEP + regras de custo

- POST /subscriptions
  - Payload: `{ "email": "..." }` — validação de formato

Auth (público)

- POST /auth/signup
  - Payload: `{ firstName, lastName, email, password, cpf?, phone?, birthDate? }`
  - Regras: senha min 8, email único, validação CPF (utilizar `src/utils/cpf-validator.ts`)
  - Response: `{ user, token }`

- POST /auth/signin
  - Payload: `{ email, password }` → `{ user, token }`

Protegidos (JWT)

- GET /me

- Cart (opcional)
  - GET/POST/PATCH /cart — persistência de carrinho por usuário (se desejado)

- Orders
  - POST /orders
    - Payload: `{ items: [{ productId, quantity, price, size? }], shippingAddress: {...}, paymentMethod, coupon? }`
    - Ações: validações, checar e reservar/decrementar stock (transação), criar order com status `pending`
  - GET /orders
  - GET /orders/:id

Admin (role: admin)

- CRUD em `/admin/products`, `/admin/categories`, `/admin/orders`, `/admin/users`

Exemplos de validação obrigatória

- `email`: formato RFC; `password`: min 8 chars
- `cpf`: algoritmo válido (usar util do front)
- `cep`: 8 dígitos (numéricos)
- `items`: array não vazio; `quantity` >= 1

## Esboço de schema Prisma (alto nível)

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model User {
  id         Int      @id @default(autoincrement())
  firstName  String
  lastName   String
  email      String   @unique
  password   String
  cpf        String?  @unique
  phone      String?
  birthDate  DateTime?
  createdAt  DateTime @default(now())
  orders     Order[]
}

model Category {
  id       Int      @id @default(autoincrement())
  name     String
  slug     String   @unique
  products Product[]
}

model Product {
  id         Int      @id @default(autoincrement())
  name       String
  slug       String   @unique
  description String?
  price      Decimal
  sku        String?
  images     Json?
  sizes      Json?
  stock      Int      @default(0)
  active     Boolean  @default(true)
  category   Category @relation(fields: [categoryId], references: [id])
  categoryId Int
}

model Order {
  id              Int         @id @default(autoincrement())
  userId          Int?
  user            User?       @relation(fields: [userId], references: [id])
  total           Decimal
  status          String
  shippingAddress Json
  paymentMethod   String
  createdAt       DateTime    @default(now())
  items           OrderItem[]
}

model OrderItem {
  id        Int     @id @default(autoincrement())
  order     Order   @relation(fields: [orderId], references: [id])
  orderId   Int
  product   Product @relation(fields: [productId], references: [id])
  productId Int
  price     Decimal
  quantity  Int
}

model Subscription {
  id          Int      @id @default(autoincrement())
  email       String   @unique
  subscribedAt DateTime @default(now())
}
```

> Nota: usar `Decimal` via pacote `@prisma/client/runtime`/`decimal.js` para valores monetários.

## Infraestrutura & integrações

- Supabase
  - Auth: pode ser usado para gerenciar signup/signin e emitir JWT; alternativa: Fastify JWT com controle próprio.
  - Postgres: base para Prisma
  - Storage: armazenar imagens de produto (usar URLs CDN públicas quando aplicável)

- Pagamentos
  - Integrar um gateway (Stripe, Pagar.me, etc.). Fluxo sugerido: criar order com status `pending`, redirecionar/abrir checkout do gateway, confirmar via webhook e atualizar `status` para `paid`.

- Uploads
  - Admin faz upload para Supabase Storage → servidor grava `Product.images` com URL(s).

## Segurança

- Autenticação: JWT para rotas protegidas; rotas admin exigem role `admin`.
- Proteções: rate-limiting, validação sanitizada de inputs, hashing de senhas (bcrypt/argon2), logging e monitoramento.

## Testes (Vitest)

- Unitários
  - `cpf-validator` (usar `src/utils/cpf-validator.ts` como referência)
  - Cálculo de totals
  - Serviços de filtragem/pagination

- Integração
  - Endpoints auth (signup/signin)
  - GET /products e GET /products/:id
  - POST /orders (fluxo com mock de gateway e checagem de stock)
  - POST /shipping/calc (mock viaCEP)

## Roadmap e prioridades (sprint inicial)

1. Bootstrapping: projeto Fastify + TypeScript + Prisma + configuração do DB (Supabase) e .env
2. Auth (signup/signin) + testes básicos
3. Endpoints de listagem de produtos e categorias (público)
4. Admin CRUD para produtos (incluindo upload para Storage)
5. Orders: criação de pedido com checagem de stock e teste de integração (mock payment)
6. Shipping calc endpoint
7. Cobertura de testes com Vitest

## Critérios de aceitação (MVP)

- Auth: usuário consegue signup/signin e obter JWT
- Produtos: endpoints públicos retornam dados exibidos pelo front
- Pedido: usuário autenticado consegue criar pedido com validação de stock e endereço
- Imagens: admin consegue associar imagem a produto e front consegue carregar via URL
- Tests: cobertura mínima para validações críticas e endpoints core

## Lacunas e perguntas para alinhar com o time

- Guest checkout: permitir ou exigir conta?
- Métodos de pagamento iniciais (cartão, PIX, boleto)?
- Regras de estoque: reservar ao criar pedido ou decrementar somente após confirmação de pagamento?
- Campos extras de produto: variantes, weight/dimensions, material?
- Política de devolução e obrigações fiscais (nota fiscal, CPF obrigatório)?

## Referências no repositório

- Interfaces e mocks: `src/interfaces/`, `src/mocks/products.ts`, `src/mocks/categories.ts`
- Componentes que mostram dados: `src/components/ProductCard/index.tsx`, `src/components/ProductList/index.tsx`, `src/components/Categories/index.tsx`
- Formulários: `src/components/RegisterForm/index.tsx`, `src/components/LoginForm/index.tsx`, `src/CEPForm/cep-form.schema.ts`

---

Se quiser, eu posso:

- Gerar o `schema.prisma` completo pronto para rodar `prisma migrate` baseado no esboço acima.
- Criar o esqueleto do projeto Fastify + TypeScript com rotas e testes (Vitest) iniciais.

Diga qual próximo passo prefere que eu execute.
