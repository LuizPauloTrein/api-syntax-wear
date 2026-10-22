import { FastifyInstance } from "fastify";
import {
  createNewCategory,
  deleteExistingCategory,
  updateExistingCategory,
} from "../controllers/category.controller.js";
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

  fastify.put(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description:
          "Atualiza uma categoria pelo ID (somente ADMIN). Ao alterar o nome, o slug é regenerado",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID da categoria" },
          },
          required: ["id"],
        },
        body: {
          type: "object",
          properties: {
            name: { type: "string", minLength: 1 },
            description: {
              type: "string",
              nullable: true,
              description: "Envie null para remover a descrição",
            },
          },
          minProperties: 1,
        },
        response: {
          200: {
            description: "Categoria atualizada",
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
          404: {
            description: "Categoria não encontrada",
            ...errorResponseSchema,
          },
          409: {
            description: "Já existe uma categoria com esse slug",
            ...errorResponseSchema,
          },
        },
      },
    },
    updateExistingCategory,
  );

  fastify.delete(
    "/:id",
    {
      schema: {
        tags: ["Categories"],
        description:
          "Exclui uma categoria pelo ID (soft delete, somente ADMIN). Bloqueado se houver produtos ativos associados",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          properties: {
            id: { type: "integer", minimum: 1, description: "ID da categoria" },
          },
          required: ["id"],
        },
        response: {
          204: {
            description: "Categoria excluída",
            type: "null",
          },
          400: {
            description: "ID de categoria inválido",
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
          404: {
            description: "Categoria não encontrada",
            ...errorResponseSchema,
          },
          409: {
            description: "Categoria possui produtos ativos associados",
            ...errorResponseSchema,
          },
        },
      },
    },
    deleteExistingCategory,
  );
}