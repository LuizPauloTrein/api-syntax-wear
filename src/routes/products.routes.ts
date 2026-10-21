import { FastifyInstance } from "fastify";
import {
  createNewProduct,
  deleteExistingProduct,
  getProduct,
  listProducts,
  updateExistingProduct,
} from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

const productResponseSchema = {
  type: "object",
  properties: {
    id: { type: "number" },
    name: { type: "string" },
    price: { type: "number" },
    createdAt: { type: "string", format: "date-time" },
    updatedAt: { type: "string", format: "date-time" },
    description: { type: "string" },
    stock: { type: "number" },
    sizes: {
      type: "array",
      items: { type: "string" },
    },
    images: {
      type: "array",
      items: { type: "string", format: "uri" },
    },
    colors: {
      type: "array",
      items: { type: "string" },
    },
    slug: { type: "string" },
    active: { type: "boolean" },
    categoryId: { type: "number" },
    category: {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        slug: { type: "string" },
        description: { type: "string", nullable: true },
        active: { type: "boolean" },
        createdAt: { type: "string", format: "date-time" },
        updatedAt: { type: "string", format: "date-time" },
      },
    },
  },
};

const errorResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Lista produtos com filtros de busca, preço e ordenação",
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            minPrice: { type: "number" },
            maxPrice: { type: "number" },
            search: { type: "string" },
            sortBy: { type: "string", enum: ["price", "name", "createdAt"] },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
          },
        },
        response: {
          200: {
            description: "Lista de produtos",
            type: "array",
            items: productResponseSchema,
          },
          400: {
            description: "Requisicao invalida",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autorizado",
            ...errorResponseSchema,
          },
        },
      },
    },
    listProducts,
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Products"],
        description: "Obter um produto pelo ID",
        params: {
          type: "object",
          properties: {
            id: { type: "number" },
          },
          required: ["id"],
        },
        response: {
          200: {
            description: "Produto encontrado",
            ...productResponseSchema,
          },
          400: {
            description: "Requisicao invalida",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autorizado",
            ...errorResponseSchema,
          },
        },
      },
    },
    getProduct,
  );

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Criar um novo produto",
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
        description: "Atualizar produto pelo ID",
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
        description: "Excluir produto pelo ID",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "number", description: "ID do produto" },
          },
          required: ["id"],
        },
        response: {
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
