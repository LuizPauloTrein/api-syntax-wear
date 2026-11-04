import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/prisma", () => ({
	prisma: {
		category: {
			findMany: vi.fn(),
			count: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
		product: {
			updateMany: vi.fn(),
		},
	},
}));

import { prisma } from "../../src/utils/prisma";
import { HttpError } from "../../src/utils/http-error";
import {
	createCategory,
	deleteCategory,
	getCategories,
	getCategoryById,
	updateCategory,
} from "../../src/services/categories.service";

const db = prisma.category as unknown as {
	findMany: ReturnType<typeof vi.fn>;
	count: ReturnType<typeof vi.fn>;
	findUnique: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};
const productDb = prisma.product as unknown as { updateMany: ReturnType<typeof vi.fn> };

const category = {
	id: 1,
	name: "Camisetas",
	description: "Camisetas em geral",
	slug: "camisetas",
	active: true,
};

const newCategoryData = {
	name: "Camisetas",
	description: "Camisetas em geral",
	slug: "camisetas",
	active: true,
};

async function expectHttpError(promise: Promise<unknown>, statusCode: number, message?: string) {
	const error = await promise.then(
		() => null,
		(e) => e,
	);
	expect(error).toBeInstanceOf(HttpError);
	expect(error.statusCode).toBe(statusCode);
	if (message) expect(error.message).toBe(message);
}

describe("categories.service", () => {
	beforeEach(() => {
		db.findMany.mockResolvedValue([category]);
		db.count.mockResolvedValue(1);
	});

	describe("getCategories", () => {
		it("lista só categorias ativas, ordenadas por nome, com página 1 e limite 10 por padrão", async () => {
			const result = await getCategories({});

			expect(db.findMany).toHaveBeenCalledWith({
				where: { active: true },
				skip: 0,
				take: 10,
				orderBy: { name: "asc" },
			});
			expect(db.count).toHaveBeenCalledWith({ where: { active: true } });
			expect(result).toEqual({
				data: [category],
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
			});
		});

		it("calcula skip, take e totalPages na paginação", async () => {
			db.count.mockResolvedValue(25);

			const result = await getCategories({ page: 3, limit: 5 });

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
			expect(result.totalPages).toBe(5);
			expect(result.page).toBe(3);
			expect(result.limit).toBe(5);
		});

		it("retorna totalPages 0 quando não há categorias", async () => {
			db.findMany.mockResolvedValue([]);
			db.count.mockResolvedValue(0);

			const result = await getCategories({});

			expect(result.data).toEqual([]);
			expect(result.totalPages).toBe(0);
		});

		it("busca pelo nome sem diferenciar maiúsculas, mantendo o filtro de ativas", async () => {
			await getCategories({ search: "camis" });

			expect(db.count).toHaveBeenCalledWith({
				where: { active: true, name: { contains: "camis", mode: "insensitive" } },
			});
		});

		it("ignora busca vazia ou só com espaços", async () => {
			await getCategories({ search: "   " });

			expect(db.count).toHaveBeenCalledWith({ where: { active: true } });
		});

		it("propaga o erro do banco", async () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			const dbError = new Error("falha de conexão");
			db.findMany.mockRejectedValue(dbError);

			await expect(getCategories({})).rejects.toBe(dbError);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});
	});

	describe("getCategoryById", () => {
		it("retorna a categoria", async () => {
			db.findUnique.mockResolvedValue(category);

			const result = await getCategoryById(1);

			expect(db.findUnique).toHaveBeenCalledWith({ where: { id: 1 } });
			expect(result).toEqual(category);
		});

		it("lança 404 quando a categoria não existe", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(getCategoryById(999), 404, "Categoria não encontrada");
		});
	});

	describe("createCategory", () => {
		it("cria a categoria quando o slug está livre", async () => {
			db.findUnique.mockResolvedValue(null);
			db.create.mockResolvedValue(category);

			const result = await createCategory(newCategoryData);

			expect(db.findUnique).toHaveBeenCalledWith({ where: { slug: "camisetas" } });
			expect(db.create).toHaveBeenCalledWith({ data: newCategoryData });
			expect(result).toEqual(category);
		});

		it("cria sem descrição (campo opcional)", async () => {
			db.findUnique.mockResolvedValue(null);
			db.create.mockResolvedValue({ ...category, description: null });
			const { description: _description, ...semDescricao } = newCategoryData;

			await createCategory(semDescricao);

			expect(db.create).toHaveBeenCalledWith({ data: semDescricao });
		});

		it("lança 409 quando o slug já existe e não cria nada", async () => {
			db.findUnique.mockResolvedValue(category);

			await expectHttpError(
				createCategory(newCategoryData),
				409,
				"Slug já existe. Escolha outro nome para a categoria.",
			);
			expect(db.create).not.toHaveBeenCalled();
		});
	});

	describe("updateCategory", () => {
		it("atualiza a categoria existente", async () => {
			db.findUnique.mockResolvedValueOnce(category);
			db.update.mockResolvedValue({ ...category, description: "Nova descrição" });

			const result = await updateCategory(1, { description: "Nova descrição" });

			expect(db.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { description: "Nova descrição" } });
			expect(result.description).toBe("Nova descrição");
		});

		it("lança 404 quando a categoria não existe", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(updateCategory(999, { name: "X" }), 404, "Categoria não encontrada");
			expect(db.update).not.toHaveBeenCalled();
		});

		it("não consulta slug quando ele não é alterado", async () => {
			db.findUnique.mockResolvedValueOnce(category);
			db.update.mockResolvedValue(category);

			await updateCategory(1, { active: false });

			expect(db.findUnique).toHaveBeenCalledTimes(1);
		});

		it("permite manter o mesmo slug na própria categoria", async () => {
			db.findUnique.mockResolvedValueOnce(category).mockResolvedValueOnce(category);
			db.update.mockResolvedValue(category);

			await expect(updateCategory(1, { slug: "camisetas" })).resolves.toEqual(category);
			expect(db.update).toHaveBeenCalled();
		});

		it("lança 409 quando o slug pertence a outra categoria", async () => {
			db.findUnique
				.mockResolvedValueOnce(category)
				.mockResolvedValueOnce({ ...category, id: 2, slug: "bones" });

			await expectHttpError(
				updateCategory(1, { slug: "bones" }),
				409,
				"Slug já existe. Escolha outro nome para a categoria.",
			);
			expect(db.update).not.toHaveBeenCalled();
		});

		it("aceita slug novo e livre", async () => {
			db.findUnique.mockResolvedValueOnce(category).mockResolvedValueOnce(null);
			db.update.mockResolvedValue({ ...category, slug: "novo-slug" });

			const result = await updateCategory(1, { slug: "novo-slug" });

			expect(result.slug).toBe("novo-slug");
		});
	});

	describe("deleteCategory", () => {
		it("desativa os produtos da categoria e depois a própria categoria (exclusão lógica)", async () => {
			db.findUnique.mockResolvedValue(category);
			productDb.updateMany.mockResolvedValue({ count: 3 });
			db.update.mockResolvedValue({ ...category, active: false });

			await deleteCategory(1);

			expect(productDb.updateMany).toHaveBeenCalledWith({
				where: { categoryId: 1 },
				data: { active: false },
			});
			expect(db.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { active: false } });
			expect(productDb.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
				db.update.mock.invocationCallOrder[0],
			);
		});

		it("lança 404 quando a categoria não existe e não altera nada", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(deleteCategory(999), 404, "Categoria não encontrada");
			expect(productDb.updateMany).not.toHaveBeenCalled();
			expect(db.update).not.toHaveBeenCalled();
		});
	});
});
