import { FastifyInstance } from "fastify";
import {
  getProduct,
  listProducts,
} from "../controllers/product.controller.js";

export const productResponseSchema = {
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

export const errorResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

export default async function productRoutes(fastify: FastifyInstance) {
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
            limit: { type: "number", minimum: 1, maximum: 100 },
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
          404: {
            description: "Produto não encontrado ou inativo",
            ...errorResponseSchema,
          },
        },
      },
    },
    getProduct,
  );
}
