# Planejamento: CRUD de pedidos e integração com produtos

Este documento planeja a implementação de um CRUD de pedidos e sua integração com o catálogo de produtos. O escopo segue os padrões já usados em produtos e categorias (rota → controller → service → Prisma, validação com Zod, erros de domínio tratados no controller) e os requisitos de `PRD-backend.md` (modelos `Order` e `OrderItem`, `POST /orders` com checagem de estoque em transação e `/admin/orders`).

## Escopo e fora de escopo

**Dentro do escopo:** schema Prisma e migration, criação, listagem, consulta, cancelamento e atualização de status de pedidos, regras de estoque e as mudanças necessárias em produtos.

**Fora do escopo (itens futuros do PRD):** gateway de pagamento e webhook, cálculo de frete por CEP (`/shipping/calc`), cupons e carrinho persistido. O plano deixa pontos de encaixe para eles, mas não os implementa.

## Pontos de partida no código atual

- `Product` já tem `price`, `sizes` (Json), `stock` e `active`. A exclusão de produto é soft delete (`active = false`), o que combina com pedidos: um produto desativado não some dos pedidos antigos.
- O JWT carrega apenas `{ userId }`. A identidade do dono do pedido vem de `request.user.userId`.
- Já existe o middleware `requireAdmin` (consulta a role no banco), reaproveitável em `/admin/orders`.
- Atenção: `createProductSchema` e o tipo `CreateProduct` usam `imgaes` (typo) e `colors` não existe no schema Prisma. Isso não bloqueia pedidos, mas vale corrigir se o item do pedido for guardar imagem ou cor.

## Etapa 1 — Schema Prisma e migration

Novos modelos e enums (proposta):

```prisma
enum OrderStatus {
  PENDING
  PAID
  SHIPPED
  DELIVERED
  CANCELED
}

model Order {
  id              Int         @id @default(autoincrement())
  userId          Int
  user            User        @relation(fields: [userId], references: [id], onDelete: Restrict)
  status          OrderStatus @default(PENDING)
  subtotal        Decimal
  shippingCost    Decimal     @default(0)
  total           Decimal
  shippingAddress Json
  paymentMethod   String
  items           OrderItem[]
  createdAt       DateTime    @default(now())
  updatedAt       DateTime    @updatedAt
  canceledAt      DateTime?

  @@index([userId])
  @@index([status])
}

model OrderItem {
  id          Int     @id @default(autoincrement())
  orderId     Int
  order       Order   @relation(fields: [orderId], references: [id], onDelete: Cascade)
  productId   Int
  product     Product @relation(fields: [productId], references: [id], onDelete: Restrict)
  productName String
  price       Decimal
  quantity    Int
  size        String?

  @@index([orderId])
  @@index([productId])
}
```

- Adicionar `orders Order[]` em `User` e `orderItems OrderItem[]` em `Product`.
- `productName` e `price` em `OrderItem` são um **retrato do momento da compra**: mudar o preço ou o nome do produto depois não pode alterar pedidos já feitos.
- `onDelete: Restrict` em produto e usuário impede apagar registros que tenham pedidos.
- `Decimal` para valores monetários, como no restante do schema.
- Gerar e revisar a migration antes de aplicá-la. Sugestão de nome, no padrão do projeto: `criacao_pedidos`.
- Não há dados anteriores de pedidos, então a migration é aditiva e não afeta produtos nem usuários existentes.

## Etapa 2 — Service de pedidos

Criar `orders.service.ts`, seguindo o padrão de `products.service.ts` e `categories.service.ts` (classes de erro de domínio exportadas).

**`createOrder(userId, data)`**, tudo dentro de uma única `prisma.$transaction`:

1. Agrupar itens repetidos (mesmo `productId` e `size`) somando as quantidades.
2. Buscar os produtos e rejeitar os que não existem ou estão inativos.
3. Validar o `size` informado contra `product.sizes`, quando o produto tiver tamanhos.
4. **Usar o preço do banco**, nunca o do payload. O PRD prevê `price` no item, mas confiar nele permite fraude; o valor enviado pode ser comparado só para avisar divergência.
5. Decrementar o estoque de forma atômica: `product.updateMany({ where: { id, active: true, stock: { gte: quantity } }, data: { stock: { decrement: quantity } } })`. Se `count` for 0, não há estoque e a transação inteira é desfeita. Isso evita vender a mesma unidade para dois pedidos simultâneos.
6. Calcular `subtotal`, `shippingCost` e `total` no servidor e criar `Order` + `OrderItem` com o retrato de nome e preço, status `PENDING`.

**`listOrders(userId, filters)`**: pedidos do usuário autenticado, com paginação e filtro por `status`.

**`getOrderById(id, userId?)`**: inclui os itens. Para usuário comum, só retorna se o pedido for dele; caso contrário o mesmo erro de "não encontrado", para não revelar que o ID existe.

**`cancelOrder(id, userId?)`**: só para `PENDING` e `PAID`. Muda o status para `CANCELED`, grava `canceledAt` e **devolve o estoque** dos itens, na mesma transação. Cancelar duas vezes não devolve estoque duas vezes.

**`updateOrderStatus(id, status)`** (admin): valida a transição pela tabela abaixo.

| De | Para |
| --- | --- |
| `PENDING` | `PAID`, `CANCELED` |
| `PAID` | `SHIPPED`, `CANCELED` |
| `SHIPPED` | `DELIVERED` |
| `DELIVERED`, `CANCELED` | nenhuma (estados finais) |

**`listAllOrders(filters)`** (admin): todos os pedidos, com filtros por `status`, `userId` e período, mais paginação.

### Regra recomendada para exclusão

Pedido **não é apagado**. O "delete" do CRUD é o cancelamento (`CANCELED`), igual ao soft delete já usado em produtos e categorias. Isso preserva o histórico financeiro e fiscal.

## Etapa 3 — Controller e validação

- Criar `order.controller.ts` para coordenar requisição e service, com o mesmo estilo de `category.controller.ts`: validar com Zod, chamar o service e traduzir os erros de domínio em respostas HTTP.
- Em `validators.ts`, adicionar schemas Zod:
  - `createOrderSchema`: `items` não vazio, `productId` inteiro positivo, `quantity` inteiro ≥ 1, `size` opcional; `shippingAddress` com `cep` (8 dígitos), `street`, `number`, `complement?`, `neighborhood`, `city`, `state`, `country`; `paymentMethod`.
  - `orderIdSchema`, `orderFiltersSchema` (`page`, `limit`, `status`, e para admin `userId`, `from`, `to`) e `updateOrderStatusSchema`.
- Em `types/index.ts`, adicionar `CreateOrder`, `OrderFilters` e `UpdateOrderStatus`.
- Mapeamento de erros:

| Situação | Resposta |
| --- | --- |
| Dados inválidos, produto inexistente ou inativo, tamanho inválido | `400` |
| Pedido não encontrado (ou de outro usuário) | `404` |
| Estoque insuficiente, transição de status inválida, pedido já cancelado | `409` |
| Sem token / token inválido | `401` |
| Sem permissão de admin | `403` |

## Etapa 4 — Rotas, autorização, documentação e verificação

Rotas de cliente, em `orders.routes.ts`, prefixo `/orders`, com `authenticate`:

| Rota | Função |
| --- | --- |
| `POST /orders` | Cria o pedido (status `PENDING`) |
| `GET /orders` | Lista os pedidos do usuário |
| `GET /orders/:id` | Consulta um pedido do usuário |
| `POST /orders/:id/cancel` | Cancela um pedido do usuário |

Rotas administrativas, em `admin-orders.routes.ts`, prefixo `/admin/orders`, com `authenticate` + `requireAdmin`:

| Rota | Função |
| --- | --- |
| `GET /admin/orders` | Lista todos os pedidos, com filtros |
| `GET /admin/orders/:id` | Consulta qualquer pedido |
| `PATCH /admin/orders/:id/status` | Atualiza o status, respeitando as transições |

- Schemas OpenAPI para parâmetros, corpos e respostas, com `security: [{ bearerAuth: [] }]`.
- Registrar os dois módulos em `app.ts`.

## Etapa 5 — Atualizações em produtos

- **Estoque:** passa a ser alterado também por pedidos (decremento na criação, devolução no cancelamento). `updateProduct` continua permitindo ajuste manual por admin.
- **Produto inativo:** não pode ser comprado (`400`). Produtos desativados continuam aparecendo nos pedidos antigos graças ao `Restrict` e ao retrato em `OrderItem`.
- **Relação:** adicionar `orderItems` ao modelo `Product`. Nenhuma coluna nova na tabela de produtos.
- **Preço e nome:** alterações em produto não afetam pedidos existentes.
- **Listagem de produtos:** hoje `getProducts` não filtra por `active`. Vale decidir, em outra etapa, se a vitrine deve esconder produtos inativos; o checkout já os recusa de qualquer forma.
- **Correções relacionadas:** o typo `imgaes` e o campo `colors` sem coluna (ver "Pontos de partida").

## Etapa 6 — Verificação

- Criação: sucesso, item repetido agrupado, preço do payload ignorado, produto inativo, tamanho inválido e estoque insuficiente (nada é gravado e o estoque não muda).
- Concorrência: dois pedidos disputando a última unidade, apenas um deve passar.
- Atomicidade: falha em um item faz o pedido inteiro ser desfeito.
- Acesso: usuário não vê pedido de outro (`404`); rotas admin respondem `403` para usuário comum.
- Status: transições válidas e inválidas; cancelamento devolve estoque uma única vez.
- Como o `prisma generate` e o banco podem não estar disponíveis em todos os ambientes, rodar o typecheck e os testes de integração no ambiente com o banco de desenvolvimento.

## Ordem de implementação sugerida

Em passos pequenos, como foi feito em categorias, cada um entregável e testável:

1. Schema, migration e relações com `User` e `Product`.
2. `createOrder` (service, controller, rota), a parte de maior risco.
3. `listOrders` e `getOrderById`, mais as rotas de leitura.
4. `cancelOrder`.
5. Rotas administrativas: listagem, consulta e `updateOrderStatus`.
6. Ajustes em produtos e testes de ponta a ponta.

## Decisões a confirmar antes da implementação

1. **Guest checkout:** o PRD deixa `userId` opcional e pergunta se visitante pode comprar. A recomendação é **exigir conta** (`userId` obrigatório), o que simplifica o acesso aos pedidos e é o que o schema acima assume.
2. **Regra de estoque:** reservar ao criar o pedido ou só decrementar após o pagamento? A recomendação é **decrementar na criação** e devolver no cancelamento, evitando vender além do estoque. O custo é que pedidos `PENDING` nunca pagos seguram estoque; resolver isso exige uma expiração automática de pedidos pendentes, prevista para uma etapa futura.
3. **Preço do item:** confirmar que o servidor usa sempre o preço do banco, ignorando o `price` do payload.
4. **Frete:** como `/shipping/calc` ainda não existe, o `shippingCost` fica **fixo em 0** até essa etapa, ou o cliente envia o valor? A recomendação é calcular só no servidor e manter 0 por enquanto.
5. **Pagamento:** quais `paymentMethod` aceitar (cartão, PIX, boleto)? Sem gateway, o `PAID` é marcado manualmente por um admin via `PATCH /admin/orders/:id/status`, até a integração com webhook.
6. **Exclusão de pedido:** confirmar que não haverá exclusão física, apenas cancelamento.
7. **Cupom:** o PRD cita `coupon?` no payload. A recomendação é deixar fora desta fase.

## Escopo deste planejamento

Este documento registra somente o plano de trabalho. Não foram feitas alterações no código, no schema Prisma, nas migrations ou no banco de dados.