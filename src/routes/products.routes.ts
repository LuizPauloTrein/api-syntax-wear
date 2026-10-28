import { FastifyInstance } from "fastify";
import { createNewProduct, getProduct, listProducts, updateExistingProduct, deleteExistingProduct } from "../controllers/products.controller";
import { authenticate } from "../middlewares/auth.middleware";
import { requireAdmin } from "../middlewares/admin.middleware";
import { CreateProduct, UpdateProduct } from "../types";

export default async function productRoutes(fastify: FastifyInstance) {
	fastify.get(
		"/",
		{
			schema: {
				tags: ["Products"],
				description: "Lista produtos com filtros opcionais",
				response: {
					200: {
						description: "Lista de produtos",
						type: "object",
						properties: {
							data: {
								type: "array",
								items: {
									type: "object",
									properties: {
										id: { type: "number" },
										name: { type: "string" },
										description: { type: "string" },
										price: { type: "number" },
										colors: {
											type: "array",
											items: { type: "string" },
										},
										sizes: {
											type: "array",
											items: { type: "string" },
										},
										images: {
											type: "array",
											items: { type: "string" },
										},
										slug: { type: "string" },
										stock: { type: "number" },
										active: { type: "boolean" },
										categoryId: { type: "number" },
										createdAt: { type: "string" },
										updatedAt: { type: "string" },
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
				},
				querystring: {
					type: "object",
					properties: {
						page: { type: "number" },
						limit: { type: "number" },
						minPrice: { type: "number" },
						maxPrice: { type: "number" },
						search: { type: "string" },
						categoryId: { type: "number" },
						sortBy: { type: "string", enum: ["price", "name", "createdAt"] },
						sortOrder: { type: "string", enum: ["asc", "desc"] },
					},
				},
			},
		},
		listProducts
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
						type: "object",
						properties: {
							id: { type: "number" },
							name: { type: "string" },
							price: { type: "number" },
							createdAt: { type: "string", format: "date-time" },
							color: { type: "string" },
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
							updatedAt: { type: "string", format: "date-time" },
							categoryId: { type: "number"},
							category: {
								type: "object",
								properties: {
									id: { type: "number" },
									name: { type: "string" },
								},
							},
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
				},
			},
		},
		getProduct
	);

	fastify.post<{ Body: CreateProduct }>(
		"/",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Products"],
				description: "Criar um novo produto",
				body: {
					type: "object",
					required: ["name", "description", "price", "categoryId"],
					properties: {
						name: { type: "string", description: "Nome do produto" },
						description: { type: "string", description: "Descrição do produto" },
						price: { type: "number", description: "Preço do produto" },
						categoryId: { type: "number", description: "ID da categoria do produto" },
						stock: { type: "number", description: "Quantidade em estoque" },
						active: { type: "boolean", description: "Produto ativo" },
						colors: {
							type: "array",
							items: { type: "string" },
							description: "Cores disponíveis",
						},
						images: {
							type: "array",
							items: { type: "string" },
							description: "URLs das imagens",
						},
						sizes: {
							type: "array",
							items: { type: "string" },
							description: "Tamanhos disponíveis",
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
						description: "Erro de validação",
						type: "object",
						properties: {
							message: { type: "string" },
							errors: { type: "object" },
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
		createNewProduct
	);

	fastify.put<{ Body: UpdateProduct; Params: { id: string } }>(
		"/:id",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Products"],
				description: "Atualizar produto",
				security: [{ bearerAuth: [] }],
				params: {
					type: "object",
					properties: {
						id: { type: "string", description: "ID do produto" },
					},
					required: ["id"],
				},
				body: {
					type: "object",
					properties: {
						name: { type: "string" },
						description: { type: "string" },
						price: { type: "number" },
						categoryId: { type: "number" },
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
						type: "object",
						properties: {
							id: { type: "string" },
							name: { type: "string" },
							description: { type: "string", nullable: true },
							price: { type: "number" },
							color: { type: "string", nullable: true },
							stock: { type: "integer" },
							tags: { type: "array", items: { type: "string" } },
						},
					},
					400: {
						description: "Erro de validação",
						type: "object",
						properties: {
							error: { type: "string" },
							details: { type: "array", nullable: true },
						},
					},
					404: {
						description: "Produto não encontrado",
						type: "object",
						properties: {
							error: { type: "string" },
						},
					},
					401: {
						description: "Não autenticado",
						type: "object",
						properties: {
							error: { type: "string" },
						},
					},
				},
			},
		},
		updateExistingProduct
	);

	fastify.delete<{ Params: { id: string } }>(
		"/:id",
		{
			onRequest: [requireAdmin], // Requer autenticação + role ADMIN
			schema: {
				tags: ["Products"],
				description: "Deletar um produto",
				params: {
					type: "object",
					properties: {
						id: { type: "number", description: "ID do produto" },
					},
					required: ["id"],
				},
				response: {
					204: {
						description: "Produto deletado com sucesso",
						type: "null",
					},
					404: {
						description: "Produto não encontrado",
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
		deleteExistingProduct
	);
}