import { FastifyInstance } from "fastify";
import { listCategories, getCategory, createNewCategory, updateExistingCategory, deleteExistingCategory } from "../controllers/categories.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import type { CreateCategory, UpdateCategory, CategoryFilters } from "../types";

export default async function categoryRoutes(fastify: FastifyInstance) {

	fastify.get<{ Querystring: CategoryFilters }>(
		"/",
		{
			schema: {
				tags: ["Categories"],
				description: "Lista categorias com filtros opcionais",
				security: [{ bearerAuth: [] }],
				querystring: {
					type: "object",
					properties: {
						page: { type: "number", description: "Número da página" },
						limit: { type: "number", description: "Itens por página" },
						search: { type: "string", description: "Busca por nome" },
					},
				},
				response: {
					200: {
						description: "Lista de categorias",
						type: "object",
						properties: {
							data: {
								type: "array",
								items: {
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
							total: { type: "number" },
							page: { type: "number" },
							limit: { type: "number" },
							totalPages: { type: "number" },
						},
					},
					400: {
						description: "Requisição inválida",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		listCategories
	);

	fastify.get<{ Params: { id: string } }>(
		"/:id",
		{
			schema: {
				tags: ["Categories"],
				description: "Obter uma categoria pelo ID",
				security: [{ bearerAuth: [] }],
				params: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID da categoria" },
					},
					required: ["id"],
				},
				response: {
					200: {
						description: "Categoria encontrada",
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
					400: {
						description: "Requisição inválida",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					404: {
						description: "Categoria não encontrada",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		getCategory
	);

	fastify.post<{ Body: CreateCategory }>(
		"/",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Categories"],
				description: "Criar uma nova categoria",
				security: [{ bearerAuth: [] }],
				body: {
					type: "object",
					required: ["name"],
					properties: {
						name: { type: "string", description: "Nome da categoria" },
						description: { type: "string", description: "Descrição da categoria" },
						active: { type: "boolean", description: "Categoria ativa", default: true },
					},
				},
				response: {
					201: {
						description: "Categoria criada com sucesso",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					400: {
						description: "Erro de validação",
						type: "object",
						properties: {
							message: { type: "string" },
							errors: { type: "object" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		createNewCategory
	);

	fastify.put<{ Params: { id: string }; Body: UpdateCategory }>(
		"/:id",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Categories"],
				description: "Atualizar categoria",
				security: [{ bearerAuth: [] }],
				params: {
					type: "object",
					properties: {
						id: { type: "string", description: "ID da categoria" },
					},
					required: ["id"],
				},
				body: {
					type: "object",
					properties: {
						name: { type: "string", description: "Nome da categoria" },
						description: { type: "string", description: "Descrição da categoria" },
						active: { type: "boolean", description: "Categoria ativa" },
					},
				},
				response: {
					200: {
						description: "Categoria atualizada",
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
					400: {
						description: "Erro de validação",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					404: {
						description: "Categoria não encontrada",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		updateExistingCategory
	);

	fastify.delete<{ Params: { id: string } }>(
		"/:id",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Categories"],
				description: "Deletar uma categoria (soft delete em cascata)",
				security: [{ bearerAuth: [] }],
				params: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID da categoria" },
					},
					required: ["id"],
				},
				response: {
					204: {
						description: "Categoria deletada com sucesso",
						type: "null",
					},
					404: {
						description: "Categoria não encontrada",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					401: {
						description: "Não autorizado",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
					500: {
						description: "Erro interno do servidor",
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			},
		},
		deleteExistingCategory
	);
}
