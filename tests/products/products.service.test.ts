import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../src/utils/prisma", () => ({
	prisma: {
		product: {
			findMany: vi.fn(),
			count: vi.fn(),
			findUnique: vi.fn(),
			create: vi.fn(),
			update: vi.fn(),
		},
	},
}));

import { prisma } from "../../src/utils/prisma";
import { HttpError } from "../../src/utils/http-error";
import {
	createProduct,
	deleteProduct,
	getProductById,
	getProducts,
	updateProduct,
} from "../../src/services/products.service";

const db = prisma.product as unknown as {
	findMany: ReturnType<typeof vi.fn>;
	count: ReturnType<typeof vi.fn>;
	findUnique: ReturnType<typeof vi.fn>;
	create: ReturnType<typeof vi.fn>;
	update: ReturnType<typeof vi.fn>;
};

const product = {
	id: 1,
	name: "Camiseta Dev",
	description: "Camiseta preta",
	price: 99.9,
	slug: "camiseta-dev",
	stock: 10,
	active: true,
	categoryId: 1,
};

const newProductData = {
	name: "Camiseta Dev",
	description: "Camiseta preta",
	price: 99.9,
	slug: "camiseta-dev",
	stock: 10,
	active: true,
	categoryId: 1,
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

describe("products.service", () => {
	beforeEach(() => {
		db.findMany.mockResolvedValue([product]);
		db.count.mockResolvedValue(1);
	});

	describe("getProducts", () => {
		it("usa página 1 e limite 10 por padrão", async () => {
			const result = await getProducts({});

			expect(db.findMany).toHaveBeenCalledWith({
				where: {},
				orderBy: undefined,
				skip: 0,
				take: 10,
			});
			expect(result).toEqual({
				data: [product],
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
			});
		});

		it("calcula skip, take e totalPages na paginação", async () => {
			db.count.mockResolvedValue(25);

			const result = await getProducts({ page: 3, limit: 5 });

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
			expect(result.totalPages).toBe(5);
			expect(result.page).toBe(3);
			expect(result.limit).toBe(5);
		});

		it("retorna totalPages 0 quando não há produtos", async () => {
			db.findMany.mockResolvedValue([]);
			db.count.mockResolvedValue(0);

			const result = await getProducts({});

			expect(result.data).toEqual([]);
			expect(result.totalPages).toBe(0);
		});

		it("filtra por categoria", async () => {
			await getProducts({ categoryId: 4 });

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { categoryId: 4 } }));
			expect(db.count).toHaveBeenCalledWith({ where: { categoryId: 4 } });
		});

		it("filtra por faixa de preço (mínimo e máximo)", async () => {
			await getProducts({ minPrice: 10, maxPrice: 50 });

			expect(db.findMany).toHaveBeenCalledWith(
				expect.objectContaining({ where: { price: { gte: 10, lte: 50 } } }),
			);
		});

		it("aceita só preço mínimo", async () => {
			await getProducts({ minPrice: 10 });

			expect(db.count).toHaveBeenCalledWith({ where: { price: { gte: 10 } } });
		});

		it("aceita só preço máximo", async () => {
			await getProducts({ maxPrice: 50 });

			expect(db.count).toHaveBeenCalledWith({ where: { price: { lte: 50 } } });
		});

		it("trata preço mínimo 0 como filtro válido", async () => {
			await getProducts({ minPrice: 0 });

			expect(db.count).toHaveBeenCalledWith({ where: { price: { gte: 0 } } });
		});

		it("busca por nome e descrição sem diferenciar maiúsculas", async () => {
			await getProducts({ search: "camiseta" });

			expect(db.count).toHaveBeenCalledWith({
				where: {
					OR: [
						{ name: { contains: "camiseta", mode: "insensitive" } },
						{ description: { contains: "camiseta", mode: "insensitive" } },
					],
				},
			});
		});

		it("ignora busca vazia ou só com espaços", async () => {
			await getProducts({ search: "   " });

			expect(db.count).toHaveBeenCalledWith({ where: {} });
		});

		it("ordena pelo campo informado, usando asc como padrão", async () => {
			await getProducts({ sortBy: "price" });

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { price: "asc" } }));
		});

		it("respeita a direção da ordenação", async () => {
			await getProducts({ sortBy: "name", sortOrder: "desc" });

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: { name: "desc" } }));
		});

		it("combina vários filtros", async () => {
			await getProducts({ categoryId: 2, minPrice: 5, search: "tênis" });

			expect(db.count).toHaveBeenCalledWith({
				where: {
					categoryId: 2,
					price: { gte: 5 },
					OR: [
						{ name: { contains: "tênis", mode: "insensitive" } },
						{ description: { contains: "tênis", mode: "insensitive" } },
					],
				},
			});
		});

		it("propaga o erro do banco", async () => {
			const spy = vi.spyOn(console, "error").mockImplementation(() => {});
			const dbError = new Error("falha de conexão");
			db.findMany.mockRejectedValue(dbError);

			await expect(getProducts({})).rejects.toBe(dbError);
			expect(spy).toHaveBeenCalled();
			spy.mockRestore();
		});
	});

	describe("getProductById", () => {
		it("retorna o produto com a categoria", async () => {
			db.findUnique.mockResolvedValue({ ...product, category: { id: 1, name: "Camisetas" } });

			const result = await getProductById(1);

			expect(db.findUnique).toHaveBeenCalledWith({
				where: { id: 1 },
				include: { category: true },
			});
			expect(result.category).toEqual({ id: 1, name: "Camisetas" });
		});

		it("lança 404 quando o produto não existe", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(getProductById(999), 404, "Produto não encontrado");
		});
	});

	describe("createProduct", () => {
		it("cria o produto quando o slug está livre", async () => {
			db.findUnique.mockResolvedValue(null);
			db.create.mockResolvedValue(product);

			const result = await createProduct(newProductData);

			expect(db.findUnique).toHaveBeenCalledWith({ where: { slug: "camiseta-dev" } });
			expect(db.create).toHaveBeenCalledWith({ data: newProductData });
			expect(result).toEqual(product);
		});

		it("lança 409 quando o slug já existe e não cria nada", async () => {
			db.findUnique.mockResolvedValue(product);

			await expectHttpError(
				createProduct(newProductData),
				409,
				"Slug já existe. Escolha outro nome para o produto.",
			);
			expect(db.create).not.toHaveBeenCalled();
		});
	});

	describe("updateProduct", () => {
		it("atualiza o produto existente", async () => {
			db.findUnique.mockResolvedValueOnce(product);
			db.update.mockResolvedValue({ ...product, price: 120 });

			const result = await updateProduct(1, { price: 120 });

			expect(db.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { price: 120 } });
			expect(result.price).toBe(120);
		});

		it("lança 404 quando o produto não existe", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(updateProduct(999, { price: 10 }), 404, "Produto não encontrado");
			expect(db.update).not.toHaveBeenCalled();
		});

		it("não consulta slug quando ele não é alterado", async () => {
			db.findUnique.mockResolvedValueOnce(product);
			db.update.mockResolvedValue(product);

			await updateProduct(1, { stock: 5 });

			expect(db.findUnique).toHaveBeenCalledTimes(1);
		});

		it("permite manter o mesmo slug no próprio produto", async () => {
			db.findUnique.mockResolvedValueOnce(product).mockResolvedValueOnce(product);
			db.update.mockResolvedValue(product);

			await expect(updateProduct(1, { slug: "camiseta-dev" })).resolves.toEqual(product);
			expect(db.update).toHaveBeenCalled();
		});

		it("lança 409 quando o slug pertence a outro produto", async () => {
			db.findUnique
				.mockResolvedValueOnce(product)
				.mockResolvedValueOnce({ ...product, id: 2, slug: "outro" });

			await expectHttpError(
				updateProduct(1, { slug: "outro" }),
				409,
				"Slug já existe. Escolha outro nome para o produto.",
			);
			expect(db.update).not.toHaveBeenCalled();
		});

		it("aceita slug novo e livre", async () => {
			db.findUnique.mockResolvedValueOnce(product).mockResolvedValueOnce(null);
			db.update.mockResolvedValue({ ...product, slug: "novo-slug" });

			const result = await updateProduct(1, { slug: "novo-slug" });

			expect(result.slug).toBe("novo-slug");
		});
	});

	describe("deleteProduct", () => {
		it("faz exclusão lógica (active = false) em vez de apagar", async () => {
			db.findUnique.mockResolvedValue(product);
			db.update.mockResolvedValue({ ...product, active: false });

			await deleteProduct(1);

			expect(db.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { active: false } });
		});

		it("lança 404 quando o produto não existe", async () => {
			db.findUnique.mockResolvedValue(null);

			await expectHttpError(deleteProduct(999), 404, "Produto não encontrado");
			expect(db.update).not.toHaveBeenCalled();
		});
	});
});
