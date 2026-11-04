import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

// Nenhum teste acessa o banco: o Prisma e a transação são mocks.
const { tx, prismaMock } = vi.hoisted(() => {
	const tx = {
		product: { findMany: vi.fn(), updateMany: vi.fn() },
		order: { create: vi.fn() },
	};
	const prismaMock = {
		$transaction: vi.fn(async (callback: (t: typeof tx) => unknown) => callback(tx)),
	};
	return { tx, prismaMock };
});

vi.mock("../../src/utils/prisma", () => ({ prisma: prismaMock }));

import { HttpError } from "../../src/utils/http-error";
import { createOrder } from "../../src/services/orders.service";

const USER_ID = 7;

const address = {
	cep: "01001000",
	street: "Rua A",
	number: "10",
	neighborhood: "Centro",
	city: "São Paulo",
	state: "SP",
	country: "BR",
};

const makeProduct = (overrides: Record<string, unknown> = {}) => ({
	id: 1,
	name: "Camiseta Dev",
	price: new Prisma.Decimal("99.90"),
	stock: 10,
	active: true,
	sizes: [],
	...overrides,
});

const orderData = (items: { productId: number; quantity: number; size?: string }[], paymentMethod = "pix" as const) => ({
	items,
	shippingAddress: address,
	paymentMethod,
});

async function expectHttpError(promise: Promise<unknown>, statusCode: number, message?: string) {
	const error = await promise.then(
		() => null,
		(e) => e,
	);
	expect(error).toBeInstanceOf(HttpError);
	expect(error.statusCode).toBe(statusCode);
	if (message) expect(error.message).toBe(message);
}

describe("orders.service - createOrder (POST)", () => {
	beforeEach(() => {
		tx.product.findMany.mockResolvedValue([makeProduct()]);
		tx.product.updateMany.mockResolvedValue({ count: 1 });
		tx.order.create.mockImplementation(async ({ data }: any) => ({ id: 100, ...data }));
	});

	describe("criação do pedido", () => {
		it("cria o pedido PENDING com dono, total, endereço, pagamento e itens", async () => {
			const result = await createOrder(USER_ID, orderData([{ productId: 1, quantity: 2, size: undefined }]));

			expect(tx.order.create).toHaveBeenCalledTimes(1);
			const { data } = tx.order.create.mock.calls[0][0];
			expect(data.userId).toBe(USER_ID);
			expect(data.status).toBe("PENDING");
			expect(data.shippingAddress).toEqual(address);
			expect(data.paymentMethod).toBe("pix");
			expect(data.items.create).toEqual([
				{ productId: 1, price: new Prisma.Decimal("99.90"), quantity: 2, size: null },
			]);
			expect(result.id).toBe(100);
		});

		it("o dono do pedido é sempre o userId recebido", async () => {
			await createOrder(42, orderData([{ productId: 1, quantity: 1 }]));

			expect(tx.order.create.mock.calls[0][0].data.userId).toBe(42);
		});

		it.each(["credit_card", "pix", "boleto"] as const)("grava o método de pagamento %s", async (paymentMethod) => {
			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }], paymentMethod));

			expect(tx.order.create.mock.calls[0][0].data.paymentMethod).toBe(paymentMethod);
		});

		it("executa tudo dentro de uma transação", async () => {
			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }]));

			expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
		});

		it("guarda o tamanho escolhido no item", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ sizes: ["P", "M", "G"] })]);

			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 1, size: "M" }]));

			expect(tx.order.create.mock.calls[0][0].data.items.create[0].size).toBe("M");
		});
	});

	describe("preço e total", () => {
		it("calcula o total com o preço do produto no banco, multiplicado pela quantidade", async () => {
			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 3 }]));

			const { total } = tx.order.create.mock.calls[0][0].data;
			expect(total.toFixed(2)).toBe("299.70");
		});

		it("soma o total de produtos diferentes", async () => {
			tx.product.findMany.mockResolvedValue([
				makeProduct({ id: 1, price: new Prisma.Decimal("50.00") }),
				makeProduct({ id: 2, name: "Boné", price: new Prisma.Decimal("30.50") }),
			]);

			await createOrder(
				USER_ID,
				orderData([
					{ productId: 1, quantity: 2 },
					{ productId: 2, quantity: 1 },
				]),
			);

			expect(tx.order.create.mock.calls[0][0].data.total.toFixed(2)).toBe("130.50");
		});

		it("usa aritmética decimal exata (0.10 × 3 = 0.30, sem erro de ponto flutuante)", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ price: new Prisma.Decimal("0.10") })]);

			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 3 }]));

			expect(tx.order.create.mock.calls[0][0].data.total.toString()).toBe("0.3");
		});

		it("grava o preço do produto como snapshot em cada item", async () => {
			tx.product.findMany.mockResolvedValue([
				makeProduct({ id: 1, price: new Prisma.Decimal("50.00") }),
				makeProduct({ id: 2, name: "Boné", price: new Prisma.Decimal("30.50") }),
			]);

			await createOrder(
				USER_ID,
				orderData([
					{ productId: 1, quantity: 1 },
					{ productId: 2, quantity: 1 },
				]),
			);

			const items = tx.order.create.mock.calls[0][0].data.items.create;
			expect(items.map((i: any) => i.price.toFixed(2))).toEqual(["50.00", "30.50"]);
		});
	});

	describe("agrupamento de itens", () => {
		it("soma a quantidade de itens repetidos (mesmo produto e tamanho)", async () => {
			await createOrder(
				USER_ID,
				orderData([
					{ productId: 1, quantity: 2 },
					{ productId: 1, quantity: 3 },
				]),
			);

			expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
			expect(tx.product.updateMany).toHaveBeenCalledWith({
				where: { id: 1, active: true, stock: { gte: 5 } },
				data: { stock: { decrement: 5 } },
			});
			const items = tx.order.create.mock.calls[0][0].data.items.create;
			expect(items).toHaveLength(1);
			expect(items[0].quantity).toBe(5);
		});

		it("mantém separados os tamanhos diferentes do mesmo produto", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ sizes: ["P", "M"] })]);

			await createOrder(
				USER_ID,
				orderData([
					{ productId: 1, quantity: 1, size: "P" },
					{ productId: 1, quantity: 2, size: "M" },
				]),
			);

			const items = tx.order.create.mock.calls[0][0].data.items.create;
			expect(items.map((i: any) => [i.size, i.quantity])).toEqual([
				["M", 2],
				["P", 1],
			]);
		});

		it.each([
			["tamanho primeiro", [{ productId: 1, quantity: 1, size: "M" }, { productId: 1, quantity: 2 }]],
			["sem tamanho primeiro", [{ productId: 1, quantity: 2 }, { productId: 1, quantity: 1, size: "M" }]],
		])("mantém separado o item sem tamanho do item com tamanho (%s)", async (_nome, itens) => {
			await createOrder(USER_ID, orderData(itens));

			const items = tx.order.create.mock.calls[0][0].data.items.create;
			expect(items.map((i: any) => [i.size, i.quantity])).toEqual([
				[null, 2],
				["M", 1],
			]);
		});

		it("consulta cada produto uma única vez, mesmo com itens repetidos", async () => {
			await createOrder(
				USER_ID,
				orderData([
					{ productId: 1, quantity: 1 },
					{ productId: 1, quantity: 1 },
				]),
			);

			expect(tx.product.findMany).toHaveBeenCalledWith({ where: { id: { in: [1] } } });
		});

		it("processa os produtos em ordem crescente de id (evita deadlock)", async () => {
			tx.product.findMany.mockResolvedValue([
				makeProduct({ id: 3, name: "C" }),
				makeProduct({ id: 1, name: "A" }),
				makeProduct({ id: 2, name: "B" }),
			]);

			await createOrder(
				USER_ID,
				orderData([
					{ productId: 3, quantity: 1 },
					{ productId: 1, quantity: 1 },
					{ productId: 2, quantity: 1 },
				]),
			);

			const reservedIds = tx.product.updateMany.mock.calls.map((call) => call[0].where.id);
			expect(reservedIds).toEqual([1, 2, 3]);
		});
	});

	describe("produto", () => {
		it("lança 404 quando o produto não existe e não cria pedido", async () => {
			tx.product.findMany.mockResolvedValue([]);

			await expectHttpError(
				createOrder(USER_ID, orderData([{ productId: 5, quantity: 1 }])),
				404,
				"Produto 5 não encontrado",
			);
			expect(tx.order.create).not.toHaveBeenCalled();
		});

		it("lança 404 para o primeiro produto inexistente quando só parte deles existe", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ id: 1 })]);

			await expectHttpError(
				createOrder(
					USER_ID,
					orderData([
						{ productId: 1, quantity: 1 },
						{ productId: 8, quantity: 1 },
					]),
				),
				404,
				"Produto 8 não encontrado",
			);
			expect(tx.order.create).not.toHaveBeenCalled();
		});

		it("lança 400 quando o produto está inativo", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ active: false })]);

			await expectHttpError(
				createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }])),
				400,
				"Produto Camiseta Dev está inativo",
			);
			expect(tx.product.updateMany).not.toHaveBeenCalled();
			expect(tx.order.create).not.toHaveBeenCalled();
		});
	});

	describe("tamanho", () => {
		beforeEach(() => {
			tx.product.findMany.mockResolvedValue([makeProduct({ sizes: ["P", "M", "G"] })]);
		});

		it("lança 400 quando o produto tem tamanhos e nenhum foi escolhido", async () => {
			await expectHttpError(
				createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }])),
				400,
				"Produto Camiseta Dev requer seleção de tamanho",
			);
			expect(tx.order.create).not.toHaveBeenCalled();
		});

		it("lança 400 quando o tamanho não existe no produto", async () => {
			await expectHttpError(
				createOrder(USER_ID, orderData([{ productId: 1, quantity: 1, size: "XG" }])),
				400,
				"Tamanho XG não disponível para Camiseta Dev",
			);
			expect(tx.order.create).not.toHaveBeenCalled();
		});

		it("aceita um tamanho disponível", async () => {
			await expect(createOrder(USER_ID, orderData([{ productId: 1, quantity: 1, size: "G" }]))).resolves.toBeDefined();
		});

		it.each([
			["sem tamanhos (lista vazia)", []],
			["sizes nulo", null],
		])("produto %s não exige tamanho", async (_nome, sizes) => {
			tx.product.findMany.mockResolvedValue([makeProduct({ sizes })]);

			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }]));

			expect(tx.order.create.mock.calls[0][0].data.items.create[0].size).toBeNull();
		});
	});

	describe("estoque", () => {
		it("reserva o estoque de forma atômica, só se ainda houver quantidade suficiente", async () => {
			await createOrder(USER_ID, orderData([{ productId: 1, quantity: 4 }]));

			expect(tx.product.updateMany).toHaveBeenCalledWith({
				where: { id: 1, active: true, stock: { gte: 4 } },
				data: { stock: { decrement: 4 } },
			});
		});

		it("lança 409 quando o estoque é insuficiente e não cria pedido", async () => {
			tx.product.updateMany.mockResolvedValue({ count: 0 });

			await expectHttpError(
				createOrder(USER_ID, orderData([{ productId: 1, quantity: 50 }])),
				409,
				"Estoque insuficiente para Camiseta Dev",
			);
			expect(tx.order.create).not.toHaveBeenCalled();
		});

		it("interrompe no primeiro produto sem estoque, sem processar os seguintes", async () => {
			tx.product.findMany.mockResolvedValue([makeProduct({ id: 1, name: "A" }), makeProduct({ id: 2, name: "B" })]);
			tx.product.updateMany.mockResolvedValueOnce({ count: 0 });

			await expectHttpError(
				createOrder(
					USER_ID,
					orderData([
						{ productId: 1, quantity: 1 },
						{ productId: 2, quantity: 1 },
					]),
				),
				409,
				"Estoque insuficiente para A",
			);
			expect(tx.product.updateMany).toHaveBeenCalledTimes(1);
		});
	});

	it("propaga erros do banco", async () => {
		const dbError = new Error("falha de conexão");
		tx.order.create.mockRejectedValue(dbError);

		await expect(createOrder(USER_ID, orderData([{ productId: 1, quantity: 1 }]))).rejects.toBe(dbError);
	});
});
