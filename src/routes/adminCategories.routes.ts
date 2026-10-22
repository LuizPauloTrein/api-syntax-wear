import { FastifyInstance } from "fastify";
import { createNewCategory } from "../controllers/category.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";
import { requireAdmin } from "../middlewares/admin.middleware.js";
import {
  categoryResponseSchema,
  errorResponseSchema,
} from "./categories.routes.js";

export default async function adminCategoryRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);
  fastify.addHook("onRequest", requireAdmin);

  fastify.post(
    "/",
    {
      schema: {
        tags: ["Categories"],
        description: "Cria uma nova categoria (somente ADMIN)",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            description: { type: "string" },
          },
          required: ["name"],
        },
        response: {
          201: {
            description: "Categoria criada com sucesso",
            ...categoryResponseSchema,
          },
          400: {
            description: "Dados inválidos",
            ...errorResponseSchema,
          },
          401: {
            description: "Não autenticado",
            ...errorResponseSchema,
          },
          403: {
            description: "Usuário sem permissão de administrador",
            ...errorResponseSchema,
          },
          409: {
            description: "Já existe uma categoria com esse slug",
            ...errorResponseSchema,
          },
        },
      },
    },
    createNewCategory,
  );
}