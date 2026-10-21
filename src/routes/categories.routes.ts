import { FastifyInstance } from "fastify";
import {
  getCategory,
  listCategories,
} from "../controllers/category.controller.js";

const categoryResponseSchema = {
  type: "object",
  properties: {
    id: { type: "integer" },
    name: { type: "string" },
    slug: { type: "string" },
    description: { type: "string", nullable: true },
  },
  required: ["id", "name", "slug"],
};

const errorResponseSchema = {
  type: "object",
  properties: {
    message: { type: "string" },
  },
};

export default async function categoryRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/",
    {
      schema: {
        tags: ["Categories"],
        description: "Lista as categorias",
        response: {
          200: {
            description: "Lista de categorias",
            type: "array",
            items: categoryResponseSchema,
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
