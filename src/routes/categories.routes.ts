import { FastifyInstance } from "fastify";
import {
  getCategory,
  listCategories,
} from "../controllers/category.controller.js";
import { pageResponseSchema } from "../utils/pagination.js";
import { registerPublicCache } from "../utils/cache.js";

export const categoryResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    slug: { type: "string" },
    description: { type: "string", nullable: true },
  },
  required: ["id", "name", "slug"],
};

export const errorResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

export default async function categoryRoutes(fastify: FastifyInstance) {
  await registerPublicCache(fastify);

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Categories"],
        description: "Lista as categorias ativas, paginadas",
        querystring: {
          type: "object",
          properties: {
            page: { type: "integer", minimum: 1 },
            limit: { type: "integer", minimum: 1, maximum: 100 },
            search: { type: "string", maxLength: 100 },
          },
        },
        response: {
          200: {
            description: "Categorias ativas, paginadas",
            ...pageResponseSchema(categoryResponseSchema),
          },
          400: {
            description: "Filtros inválidos",
            ...errorResponseSchema,
          },
        },
      },
    },
    listCategories,
  );

  fastify.get(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description: "Busca uma categoria pelo ID",
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1 },
          },
          required: ["id"],
        },
        response: {
          200: {
            description: "Categoria encontrada",
            ...categoryResponseSchema,
          },
          400: {
            description: "ID de categoria inválido",
            ...errorResponseSchema,
          },
          404: {
            description: "Categoria não encontrada",
            ...errorResponseSchema,
          },
        },
      },
    },
    getCategory,
  );
}
