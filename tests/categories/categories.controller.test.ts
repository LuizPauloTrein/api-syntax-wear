import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("../../src/services/categories.service", () => ({
	getCategories: vi.fn(),
	getCategoryById: vi.fn(),
	createCategory: vi.fn(),
	updateCategory: vi.fn(),
	deleteCategory: vi.fn(),
}));

import * as service from "../../src/services/categories.service";
import { HttpError } from "../../src/utils/http-error";
import {
	createNewCategory,
	deleteExistingCategory,
	getCategory,
	listCategories,
	updateExistingCategory,
} from "../../src/controllers/categories.controller";

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeReply() {
	const reply: any = {};
	reply.status = vi.fn().mockReturnValue(reply);
	reply.send = vi.fn().mockReturnValue(reply);
	return reply;
}

// Em produção o "active" vem preenchido pelo default da rota (Ajv); aqui o controller é chamado direto.
const validBody = () => ({
	name: "Camisetas Estampadas",
	description: "Camisetas em geral",
	slug: "",
	active: true,
});

describe("categories.controller", () => {
	let reply: ReturnType<typeof makeReply>;

	beforeEach(() => {
		reply = makeReply();
	});

	describe("listCategories", () => {
		it("converte a query e responde 200 com o resultado do service", async () => {
			const result = { data: [], total: 0, page: 2, limit: 5, totalPages: 0 };
			svc.getCategories.mockResolvedValue(result);

			await listCategories({ query: { page: "2", limit: "5", search: "cam" } } as any, reply);

			expect(svc.getCategories).toHaveBeenCalledWith({ page: 2, limit: 5, search: "cam" });
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(result);
		});

		it("lança ZodError e não chama o service com filtros inválidos", async () => {
			await expect(listCategories({ query: { page: "0" } } as any, reply)).rejects.toBeInstanceOf(ZodError);
			expect(svc.getCategories).not.toHaveBeenCalled();
		});
	});

	describe("getCategory", () => {
		it("converte o id e responde 200 com a categoria", async () => {
			const category = { id: 1, name: "Camisetas" };
			svc.getCategoryById.mockResolvedValue(category);

			await getCategory({ params: { id: "1" } } as any, reply);

			expect(svc.getCategoryById).toHaveBeenCalledWith(1);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(category);
		});

		it("propaga o 404 do service", async () => {
			svc.getCategoryById.mockRejectedValue(new HttpError(404, "Categoria não encontrada"));

			await expect(getCategory({ params: { id: "9" } } as any, reply)).rejects.toMatchObject({
				statusCode: 404,
			});
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	describe("createNewCategory", () => {
		it("gera o slug a partir do nome, cria e responde 201", async () => {
			svc.createCategory.mockResolvedValue({ id: 1 });

			await createNewCategory({ body: validBody() } as any, reply);

			expect(svc.createCategory).toHaveBeenCalledWith({
				name: "Camisetas Estampadas",
				description: "Camisetas em geral",
				slug: "camisetas-estampadas",
				active: true,
			});
			expect(reply.status).toHaveBeenCalledWith(201);
			expect(reply.send).toHaveBeenCalledWith({ message: "Categoria criada com sucesso" });
		});

		it("sobrescreve um slug enviado pelo cliente", async () => {
			svc.createCategory.mockResolvedValue({ id: 1 });

			await createNewCategory({ body: { ...validBody(), slug: "slug-manual" } } as any, reply);

			expect(svc.createCategory).toHaveBeenCalledWith(
				expect.objectContaining({ slug: "camisetas-estampadas" }),
			);
		});

		it("cria sem descrição (campo opcional)", async () => {
			svc.createCategory.mockResolvedValue({ id: 1 });
			const { description: _description, ...body } = validBody();

			await createNewCategory({ body } as any, reply);

			expect(reply.status).toHaveBeenCalledWith(201);
		});

		it("lança ZodError quando falta o campo obrigatório active", async () => {
			const { active: _active, ...body } = validBody();

			await expect(createNewCategory({ body } as any, reply)).rejects.toBeInstanceOf(ZodError);
			expect(svc.createCategory).not.toHaveBeenCalled();
		});

		it("lança ZodError quando o nome é vazio", async () => {
			await expect(
				createNewCategory({ body: { ...validBody(), name: "" } } as any, reply),
			).rejects.toBeInstanceOf(ZodError);
			expect(svc.createCategory).not.toHaveBeenCalled();
		});

		it("lança ZodError quando o nome só tem símbolos (slug gerado fica vazio)", async () => {
			await expect(
				createNewCategory({ body: { ...validBody(), name: "!!!" } } as any, reply),
			).rejects.toBeInstanceOf(ZodError);
			expect(svc.createCategory).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});

		it("propaga o 409 de slug duplicado", async () => {
			svc.createCategory.mockRejectedValue(new HttpError(409, "Slug já existe."));

			await expect(createNewCategory({ body: validBody() } as any, reply)).rejects.toMatchObject({
				statusCode: 409,
			});
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	describe("updateExistingCategory", () => {
		it("atualiza e responde 200 com a categoria", async () => {
			const updated = { id: 1, active: false };
			svc.updateCategory.mockResolvedValue(updated);

			await updateExistingCategory({ params: { id: "1" }, body: { active: false } } as any, reply);

			expect(svc.updateCategory).toHaveBeenCalledWith(1, { active: false });
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(updated);
		});

		it("regenera o slug quando o nome muda", async () => {
			svc.updateCategory.mockResolvedValue({ id: 1 });

			await updateExistingCategory({ params: { id: "1" }, body: { name: "Bonés Pretos" } } as any, reply);

			expect(svc.updateCategory).toHaveBeenCalledWith(1, { name: "Bonés Pretos", slug: "bones-pretos" });
		});

		it("não mexe no slug quando o nome não muda", async () => {
			svc.updateCategory.mockResolvedValue({ id: 1 });

			await updateExistingCategory({ params: { id: "1" }, body: { description: "Nova" } } as any, reply);

			expect(svc.updateCategory).toHaveBeenCalledWith(1, { description: "Nova" });
		});

		it("lança ZodError e não atualiza quando o corpo é inválido", async () => {
			await expect(
				updateExistingCategory({ params: { id: "1" }, body: { name: "" } } as any, reply),
			).rejects.toBeInstanceOf(ZodError);
			expect(svc.updateCategory).not.toHaveBeenCalled();
		});

		it("propaga o 404 do service", async () => {
			svc.updateCategory.mockRejectedValue(new HttpError(404, "Categoria não encontrada"));

			await expect(
				updateExistingCategory({ params: { id: "9" }, body: { active: true } } as any, reply),
			).rejects.toMatchObject({ statusCode: 404 });
		});
	});

	describe("deleteExistingCategory", () => {
		it("remove e responde 204 sem corpo", async () => {
			svc.deleteCategory.mockResolvedValue(undefined);

			await deleteExistingCategory({ params: { id: "3" } } as any, reply);

			expect(svc.deleteCategory).toHaveBeenCalledWith(3);
			expect(reply.status).toHaveBeenCalledWith(204);
			expect(reply.send).toHaveBeenCalledWith();
		});

		it("propaga o 404 do service", async () => {
			svc.deleteCategory.mockRejectedValue(new HttpError(404, "Categoria não encontrada"));

			await expect(deleteExistingCategory({ params: { id: "9" } } as any, reply)).rejects.toMatchObject({
				statusCode: 404,
			});
			expect(reply.status).not.toHaveBeenCalled();
		});
	});
});
