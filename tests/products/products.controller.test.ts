import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

vi.mock("../../src/services/products.service", () => ({
	getProducts: vi.fn(),
	getProductById: vi.fn(),
	createProduct: vi.fn(),
	updateProduct: vi.fn(),
	deleteProduct: vi.fn(),
}));

import * as service from "../../src/services/products.service";
import { HttpError } from "../../src/utils/http-error";
import {
	createNewProduct,
	deleteExistingProduct,
	getProduct,
	listProducts,
	updateExistingProduct,
} from "../../src/controllers/products.controller";

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeReply() {
	const reply: any = {};
	reply.status = vi.fn().mockReturnValue(reply);
	reply.send = vi.fn().mockReturnValue(reply);
	return reply;
}

const validBody = () => ({
	name: "Camiseta Dev",
	description: "Camiseta preta",
	price: 99.9,
	slug: "",
	stock: 10,
	active: true,
	categoryId: 1,
});

describe("products.controller", () => {
	let reply: ReturnType<typeof makeReply>;

	beforeEach(() => {
		reply = makeReply();
	});

	describe("listProducts", () => {
		it("converte a query e responde 200 com o resultado do service", async () => {
			const result = { data: [], total: 0, page: 2, limit: 5, totalPages: 0 };
			svc.getProducts.mockResolvedValue(result);

			await listProducts({ query: { page: "2", limit: "5", minPrice: "10" } } as any, reply);

			expect(svc.getProducts).toHaveBeenCalledWith({ page: 2, limit: 5, minPrice: 10 });
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(result);
		});

		it("lança ZodError e não chama o service com filtros inválidos", async () => {
			await expect(listProducts({ query: { page: "0" } } as any, reply)).rejects.toBeInstanceOf(ZodError);
			expect(svc.getProducts).not.toHaveBeenCalled();
		});
	});

	describe("getProduct", () => {
		it("responde 200 com o produto", async () => {
			const product = { id: 1, name: "Camiseta Dev" };
			svc.getProductById.mockResolvedValue(product);

			await getProduct({ params: { id: 1 } } as any, reply);

			expect(svc.getProductById).toHaveBeenCalledWith(1);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(product);
		});

		it("propaga o 404 do service", async () => {
			svc.getProductById.mockRejectedValue(new HttpError(404, "Produto não encontrado"));

			await expect(getProduct({ params: { id: 9 } } as any, reply)).rejects.toMatchObject({ statusCode: 404 });
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	describe("createNewProduct", () => {
		it("gera o slug a partir do nome, cria e responde 201", async () => {
			svc.createProduct.mockResolvedValue({ id: 1 });

			await createNewProduct({ body: validBody() } as any, reply);

			expect(svc.createProduct).toHaveBeenCalledWith(expect.objectContaining({ slug: "camiseta-dev" }));
			expect(reply.status).toHaveBeenCalledWith(201);
			expect(reply.send).toHaveBeenCalledWith({ message: "Produto criado com sucesso" });
		});

		it("sobrescreve um slug enviado pelo cliente", async () => {
			svc.createProduct.mockResolvedValue({ id: 1 });

			await createNewProduct({ body: { ...validBody(), slug: "slug-manual" } } as any, reply);

			expect(svc.createProduct).toHaveBeenCalledWith(expect.objectContaining({ slug: "camiseta-dev" }));
		});

		it("lança ZodError e não cria quando o corpo é inválido", async () => {
			const body = { ...validBody(), price: -10 };

			await expect(createNewProduct({ body } as any, reply)).rejects.toBeInstanceOf(ZodError);
			expect(svc.createProduct).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});

		it("propaga o 409 de slug duplicado", async () => {
			svc.createProduct.mockRejectedValue(new HttpError(409, "Slug já existe."));

			await expect(createNewProduct({ body: validBody() } as any, reply)).rejects.toMatchObject({
				statusCode: 409,
			});
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	describe("updateExistingProduct", () => {
		it("atualiza e responde 200 com o produto", async () => {
			const updated = { id: 1, price: 120 };
			svc.updateProduct.mockResolvedValue(updated);

			await updateExistingProduct({ params: { id: "1" }, body: { price: 120 } } as any, reply);

			expect(svc.updateProduct).toHaveBeenCalledWith(1, { price: 120 });
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(updated);
		});

		it("regenera o slug quando o nome muda", async () => {
			svc.updateProduct.mockResolvedValue({ id: 1 });

			await updateExistingProduct({ params: { id: "1" }, body: { name: "Boné Preto" } } as any, reply);

			expect(svc.updateProduct).toHaveBeenCalledWith(1, { name: "Boné Preto", slug: "bone-preto" });
		});

		it("não mexe no slug quando o nome não muda", async () => {
			svc.updateProduct.mockResolvedValue({ id: 1 });

			await updateExistingProduct({ params: { id: "1" }, body: { stock: 3 } } as any, reply);

			expect(svc.updateProduct).toHaveBeenCalledWith(1, { stock: 3 });
		});

		it("lança ZodError e não atualiza quando o corpo é inválido", async () => {
			await expect(
				updateExistingProduct({ params: { id: "1" }, body: { stock: -1 } } as any, reply),
			).rejects.toBeInstanceOf(ZodError);
			expect(svc.updateProduct).not.toHaveBeenCalled();
		});

		it("propaga o 404 do service", async () => {
			svc.updateProduct.mockRejectedValue(new HttpError(404, "Produto não encontrado"));

			await expect(
				updateExistingProduct({ params: { id: "9" }, body: { price: 1 } } as any, reply),
			).rejects.toMatchObject({ statusCode: 404 });
		});
	});

	describe("deleteExistingProduct", () => {
		it("remove e responde 204 sem corpo", async () => {
			svc.deleteProduct.mockResolvedValue(undefined);

			await deleteExistingProduct({ params: { id: "3" } } as any, reply);

			expect(svc.deleteProduct).toHaveBeenCalledWith(3);
			expect(reply.status).toHaveBeenCalledWith(204);
			expect(reply.send).toHaveBeenCalledWith();
		});

		it.each(["0", "-2", "abc", "1.5"])("lança ZodError para id inválido %s", async (id) => {
			await expect(deleteExistingProduct({ params: { id } } as any, reply)).rejects.toBeInstanceOf(ZodError);
			expect(svc.deleteProduct).not.toHaveBeenCalled();
		});

		it("propaga o 404 do service", async () => {
			svc.deleteProduct.mockRejectedValue(new HttpError(404, "Produto não encontrado"));

			await expect(deleteExistingProduct({ params: { id: "9" } } as any, reply)).rejects.toMatchObject({
				statusCode: 404,
			});
		});
	});
});
