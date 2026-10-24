import { FastifyInstance } from "fastify";
import {
  createNewProduct,
  deleteExistingProduct,
  updateExistingProduct,
} from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import {
  errorResponseSchema,
  productResponseSchema,
} from "./products.routes.js";

// Escrita no catálogo: somente ADMIN. A leitura continua em /products.
export default async function adminProductRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);
  fastify.addHook("onRequest", requireAdmin);

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        description: "Criar um novo produto (somente ADMIN)",
        body: {
          required: [
            "name",
            "description",
            "price",
            "active",
            "stock",
            "categoryId",
          ],
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            categoryId: {
              type: "integer",
              minimum: 1,
              description: "ID da categoria do produto",
            },
            active: { type: "boolean" },
            stock: { type: "number" },
            colors: {
              type: "array",
              items: { type: "string" },
            },
            images: {
              type: "array",
              items: { type: "string" },
            },
            sizes: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          403: {
            description: "Usuário sem permissão de administrador",
            ...errorResponseSchema,
          },
          201: {
            description: "Produto criado com sucesso",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          400: {
            description: "Dados inválidos ou categoria inexistente",
            ...errorResponseSchema,
          },
        },
      },
    },
    createNewProduct,
  );

  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        description: "Atualizar produto pelo ID (somente ADMIN)",
        params: {
          type: "object",
          properties: {
            id: { type: "number", description: "ID do produto" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string" },
            description: { type: "string" },
            price: { type: "number" },
            categoryId: {
              type: "integer",
              minimum: 1,
              description: "ID da categoria do produto",
            },
            active: { type: "boolean" },
            stock: { type: "number" },
            colors: {
              type: "array",
              items: { type: "string" },
            },
            images: {
              type: "array",
              items: { type: "string" },
            },
            sizes: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        response: {
          403: {
            description: "Usuário sem permissão de administrador",
            ...errorResponseSchema,
          },
          200: {
            description: "Produto atualizado",
            ...productResponseSchema,
          },
          400: {
            description: "Dados inválidos ou categoria inexistente",
            ...errorResponseSchema,
          },
          404: {
            description: "Produto não encontrado",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
        },
      },
    },
    updateExistingProduct,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        security: [{ bearerAuth: [] }],
        description: "Excluir produto pelo ID (somente ADMIN)",
        params: {
          type: "object",
          properties: {
            id: { type: "number", description: "ID do produto" },
          },
          required: ["id"],
        },
        response: {
          403: {
            description: "Usuário sem permissão de administrador",
            ...errorResponseSchema,
          },
          200: {
            description: "Produto excluído",
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
          404: {
            description: "Produto não encontrado",
            ...errorResponseSchema,
          },
        },
      },
    },
    deleteExistingProduct,
  );
}
