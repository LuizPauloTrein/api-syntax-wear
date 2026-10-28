import { FastifyInstance } from "fastify";
import {
  createNewOrder,
  deleteExistingOrder,
  getOrder,
  listOrders,
} from "../controllers/order.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { rateLimits } from "../config/rate-limits.js";
import { pageResponseSchema } from "../utils/pagination.js";

const orderStatusEnum = ["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"];

const orderItemResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    orderId: { type: "integer" },
    productId: { type: "integer" },
    productName: { type: "string" },
    price: { type: "number" },
    quantity: { type: "integer" },
    size: { type: "string", nullable: true },
  },
};

const orderResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    userId: { type: "integer" },
    status: { type: "string", enum: orderStatusEnum },
    subtotal: { type: "number" },
    shippingCost: { type: "number" },
    total: { type: "number" },
    shippingAddress: {
      type: "object",
      additionalProperties: true,
      properties: {
        cep: { type: "string" },
        street: { type: "string" },
        number: { type: "string" },
        complement: { type: "string", nullable: true },
        neighborhood: { type: "string" },
        city: { type: "string" },
        state: { type: "string" },
        country: { type: "string" },
      },
    },
    paymentMethod: { type: "string" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    canceledAt: { type: "string", format: "date-time", nullable: true },
    items: { type: "array", items: orderItemResponseSchema },
  },
};

const errorResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

export default async function orderRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);

  fastify.post(
    "/",
    {
      config: { rateLimit: rateLimits.createOrder },
      schema: {
        tags: ["Orders"],
        description:
          "Cria um pedido para o usuário autenticado. O preço vem sempre do banco, o estoque é descontado na criação e o pedido nasce como PENDING",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["items", "shippingAddress", "paymentMethod"],
          properties: {
            items: {
              type: "array",
              minItems: 1,
              items: {
                type: "object",
                required: ["productId", "quantity"],
                properties: {
                  productId: { type: "integer", minimum: 1 },
                  quantity: { type: "integer", minimum: 1, maximum: 99 },
                  size: { type: "string", description: "Obrigatório se o produto tiver tamanhos" },
                },
              },
            },
            shippingAddress: {
              type: "object",
              required: [
                "cep",
                "street",
                "number",
                "neighborhood",
                "city",
                "state",
                "country",
              ],
              properties: {
                cep: { type: "string", pattern: "^\\d{8}$" },
                street: { type: "string" },
                number: { type: "string" },
                complement: { type: "string" },
                neighborhood: { type: "string" },
                city: { type: "string" },
                state: { type: "string" },
                country: { type: "string" },
              },
            },
            paymentMethod: {
              type: "string",
              enum: ["PIX", "CREDIT_CARD", "BOLETO"],
            },
          },
        },
        response: {
          201: {
            description: "Pedido criado",
            ...orderResponseSchema,
          },
          400: {
            description:
              "Dados inválidos, produto indisponível ou tamanho inválido",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
          409: {
            description: "Estoque insuficiente",
            ...errorResponseSchema,
          },
        },
      },
    },
    createNewOrder,
  );

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Orders"],
        description:
          "Lista os pedidos do usuário autenticado, do mais recente para o mais antigo",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            status: { type: "string", enum: orderStatusEnum },
          },
        },
        response: {
          200: {
            description: "Pedidos do usuário, paginados",
            ...pageResponseSchema(orderResponseSchema),
          },
          400: {
            description: "Filtros inválidos",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
        },
      },
    },
    listOrders,
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Orders"],
        description: "Busca um pedido do usuário autenticado pelo ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID do pedido" },
          },
          required: ["id"],
        },
        response: {
          200: {
            description: "Pedido encontrado",
            ...orderResponseSchema,
          },
          400: {
            description: "ID de pedido inválido",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
          404: {
            description: "Pedido não encontrado",
            ...errorResponseSchema,
          },
        },
      },
    },
    getOrder,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Orders"],
        description:
          "Exclui (cancela) um pedido do usuário autenticado. É um soft delete: o pedido fica com status CANCELED e o estoque dos itens é devolvido. Só é possível enquanto o pedido estiver PENDING ou PAID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID do pedido" },
          },
          required: ["id"],
        },
        response: {
          204: {
            description: "Pedido cancelado",
            type: "null",
          },
          400: {
            description: "ID de pedido inválido",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
          404: {
            description: "Pedido não encontrado",
            ...errorResponseSchema,
          },
          409: {
            description:
              "Pedido já cancelado ou em status que não permite cancelamento",
            ...errorResponseSchema,
          },
        },
      },
    },
    deleteExistingOrder,
  );
}
