import { FastifyInstance } from "fastify";
import { authenticate } from "../middlewares/auth.middleware.js";
import { getOrder, listOrders } from "../controllers/order.controller.js";

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
            description: "Lista de pedidos do usuário",
            type: "array",
            items: orderResponseSchema,
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
}