import { beforeEach, describe, expect, it, vi } from "vitest";

// Nenhum teste acessa o banco: o Prisma e a transação são mocks.
const { tx, prismaMock } = vi.hoisted(() => {
	const tx = {
		order: { findFirst: vi.fn(), updateMany: vi.fn() },
		orderItem: { findMany: vi.fn() },
		product: { update: vi.fn() },
	};
	const prismaMock = {
		$transaction: vi.fn(async (callback: (t: typeof tx) => unknown) => callback(tx)),
		order: { findUniqueOrThrow: vi.fn() },
	};
	return { tx, prismaMock };
});

vi.mock("../../src/utils/prisma", () => ({ prisma: prismaMock }));

import { HttpError } from "../../src/utils/http-error";
import { updateOrder } from "../../src/services/orders.service";

const USER_ID = 7;

const address = {
	cep: "01001000",
	street: "Rua Nova",
	number: "20",
	neighborhood: "Centro",
	city: "São Paulo",
	state: "SP",
	country: "BR",
};

const orderWith = (status: string) => ({ id: 1, userId: USER_ID, status });

async function expectHttpError(promise: Promise<unknown>, statusCode: number, message?: string) {
	const error = await promise.then(
		() => null,
		(e) => e,
	);
	expect(error).toBeInstanceOf(HttpError);
	expect(error.statusCode).toBe(statusCode);
	if (message) expect(error.message).toBe(message);
}

describe("orders.service - updateOrder (PUT)", () => {
	beforeEach(() => {
		tx.order.findFirst.mockResolvedValue(orderWith("PENDING"));
		tx.order.updateMany.mockResolvedValue({ count: 1 });
		tx.orderItem.findMany.mockResolvedValue([]);
		tx.product.update.mockResolvedValue({});
		prismaMock.order.findUniqueOrThrow.mockResolvedValue({ id: 1, status: "PENDING" });
	});

	describe("permissão para alterar o status", () => {
		it("usuário comum recebe 403 ao enviar status e nada é consultado", async () => {
			await expectHttpError(
				updateOrder(1, { status: "PAID" }, USER_ID, false),
				403,
				"Apenas administradores podem alterar o status do pedido",
			);

			expect(prismaMock.$transaction).not.toHaveBeenCalled();
			expect(tx.order.updateMany).not.toHaveBeenCalled();
		});

		it("usuário comum recebe 403 mesmo ao reenviar o status atual", async () => {
			await expectHttpError(updateOrder(1, { status: "PENDING" }, USER_ID, false), 403);
		});

		it("usuário comum pode alterar o endereço sem enviar status", async () => {
			await expect(updateOrder(1, { shippingAddress: address }, USER_ID, false)).resolves.toBeDefined();

			expect(tx.order.updateMany).toHaveBeenCalled();
		});

		it("admin pode alterar o status", async () => {
			await expect(updateOrder(1, { status: "PAID" }, 1, true)).resolves.toBeDefined();
		});
	});

	describe("busca do pedido", () => {
		it("usuário comum busca filtrando pelo próprio userId", async () => {
			await updateOrder(1, { shippingAddress: address }, USER_ID, false);

			expect(tx.order.findFirst).toHaveBeenCalledWith({ where: { id: 1, userId: USER_ID } });
		});

		it("admin busca só pelo id", async () => {
			await updateOrder(1, { status: "PAID" }, 99, true);

			expect(tx.order.findFirst).toHaveBeenCalledWith({ where: { id: 1 } });
		});

		it("lança 404 quando o pedido não existe (ou é de outro usuário) e não atualiza nada", async () => {
			tx.order.findFirst.mockResolvedValue(null);

			await expectHttpError(
				updateOrder(1, { shippingAddress: address }, USER_ID, false),
				404,
				"Pedido não encontrado",
			);
			expect(tx.order.updateMany).not.toHaveBeenCalled();
			expect(prismaMock.order.findUniqueOrThrow).not.toHaveBeenCalled();
		});
	});

	describe("alteração de endereço", () => {
		it.each(["PENDING", "PAID"])("é permitida com o pedido %s", async (status) => {
			tx.order.findFirst.mockResolvedValue(orderWith(status));

			await updateOrder(1, { shippingAddress: address }, 1, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({
				where: { id: 1, status },
				data: { shippingAddress: address },
			});
		});

		it.each(["SHIPPED", "DELIVERED", "CANCELLED"])("é bloqueada (409) com o pedido %s", async (status) => {
			tx.order.findFirst.mockResolvedValue(orderWith(status));

			await expectHttpError(
				updateOrder(1, { shippingAddress: address }, 1, true),
				409,
				"O endereço só pode ser alterado enquanto o pedido não foi enviado",
			);
			expect(tx.order.updateMany).not.toHaveBeenCalled();
		});
	});

	describe("transições de status", () => {
		it.each([
			["PENDING", "PAID"],
			["PENDING", "CANCELLED"],
			["PAID", "SHIPPED"],
			["PAID", "CANCELLED"],
			["SHIPPED", "DELIVERED"],
		])("permite %s → %s", async (from, to) => {
			tx.order.findFirst.mockResolvedValue(orderWith(from));

			await updateOrder(1, { status: to as any }, 1, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({
				where: { id: 1, status: from },
				data: { status: to },
			});
		});

		it.each([
			["PENDING", "SHIPPED"],
			["PENDING", "DELIVERED"],
			["PAID", "PENDING"],
			["PAID", "DELIVERED"],
			["SHIPPED", "PAID"],
			["SHIPPED", "CANCELLED"],
			["DELIVERED", "PENDING"],
			["DELIVERED", "CANCELLED"],
			["CANCELLED", "PENDING"],
			["CANCELLED", "PAID"],
		])("bloqueia %s → %s com 409", async (from, to) => {
			tx.order.findFirst.mockResolvedValue(orderWith(from));

			await expectHttpError(
				updateOrder(1, { status: to as any }, 1, true),
				409,
				`Transição de status inválida: ${from} → ${to}`,
			);
			expect(tx.order.updateMany).not.toHaveBeenCalled();
			expect(tx.product.update).not.toHaveBeenCalled();
		});

		it("reenviar o status atual não muda nada e não devolve estoque", async () => {
			tx.order.findFirst.mockResolvedValue(orderWith("CANCELLED"));

			await updateOrder(1, { status: "CANCELLED" }, 1, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({ where: { id: 1, status: "CANCELLED" }, data: {} });
			expect(tx.orderItem.findMany).not.toHaveBeenCalled();
		});

		it("atualiza status e endereço na mesma requisição", async () => {
			await updateOrder(1, { status: "PAID", shippingAddress: address }, 1, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({
				where: { id: 1, status: "PENDING" },
				data: { status: "PAID", shippingAddress: address },
			});
		});

		it("corpo vazio não altera nenhum campo", async () => {
			await updateOrder(1, {}, 1, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({ where: { id: 1, status: "PENDING" }, data: {} });
		});

		it("verifica o endereço antes da transição (pedido enviado + endereço → erro de endereço)", async () => {
			tx.order.findFirst.mockResolvedValue(orderWith("SHIPPED"));

			await expectHttpError(
				updateOrder(1, { status: "DELIVERED", shippingAddress: address }, 1, true),
				409,
				"O endereço só pode ser alterado enquanto o pedido não foi enviado",
			);
		});
	});

	describe("concorrência", () => {
		it("lança 409 quando outra requisição alterou o pedido (nenhuma linha atualizada)", async () => {
			tx.order.updateMany.mockResolvedValue({ count: 0 });

			await expectHttpError(
				updateOrder(1, { status: "CANCELLED" }, 1, true),
				409,
				"O pedido foi alterado por outra requisição. Tente novamente",
			);
		});

		it("não devolve estoque quando a atualização não aconteceu", async () => {
			tx.order.updateMany.mockResolvedValue({ count: 0 });
			tx.orderItem.findMany.mockResolvedValue([{ productId: 1, quantity: 2 }]);

			await expect(updateOrder(1, { status: "CANCELLED" }, 1, true)).rejects.toBeInstanceOf(HttpError);

			expect(tx.product.update).not.toHaveBeenCalled();
		});
	});

	describe("devolução de estoque ao cancelar", () => {
		it("devolve a quantidade de cada item ao estoque do produto", async () => {
			tx.orderItem.findMany.mockResolvedValue([
				{ productId: 3, quantity: 2 },
				{ productId: 4, quantity: 1 },
			]);

			await updateOrder(1, { status: "CANCELLED" }, 1, true);

			expect(tx.orderItem.findMany).toHaveBeenCalledWith({ where: { orderId: 1 } });
			expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { stock: { increment: 2 } } });
			expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { stock: { increment: 1 } } });
		});

		it("soma itens do mesmo produto e atualiza em ordem crescente de produto", async () => {
			tx.orderItem.findMany.mockResolvedValue([
				{ productId: 5, quantity: 1 },
				{ productId: 2, quantity: 2 },
				{ productId: 5, quantity: 3 },
			]);

			await updateOrder(1, { status: "CANCELLED" }, 1, true);

			expect(tx.product.update).toHaveBeenCalledTimes(2);
			expect(tx.product.update).toHaveBeenNthCalledWith(1, {
				where: { id: 2 },
				data: { stock: { increment: 2 } },
			});
			expect(tx.product.update).toHaveBeenNthCalledWith(2, {
				where: { id: 5 },
				data: { stock: { increment: 4 } },
			});
		});

		it("não mexe no estoque quando o pedido não tem itens", async () => {
			tx.orderItem.findMany.mockResolvedValue([]);

			await updateOrder(1, { status: "CANCELLED" }, 1, true);

			expect(tx.product.update).not.toHaveBeenCalled();
		});

		it("não devolve estoque em transições que não cancelam", async () => {
			await updateOrder(1, { status: "PAID" }, 1, true);

			expect(tx.orderItem.findMany).not.toHaveBeenCalled();
			expect(tx.product.update).not.toHaveBeenCalled();
		});
	});

	describe("retorno", () => {
		it("devolve o pedido atualizado com dono e itens, lido depois da transação", async () => {
			const updated = { id: 1, status: "PAID" };
			prismaMock.order.findUniqueOrThrow.mockResolvedValue(updated);

			const result = await updateOrder(1, { status: "PAID" }, 1, true);

			expect(result).toBe(updated);
			expect(prismaMock.order.findUniqueOrThrow).toHaveBeenCalledWith(
				expect.objectContaining({
					where: { id: 1 },
					include: expect.objectContaining({ user: expect.anything(), items: expect.anything() }),
				}),
			);
		});

		it("propaga erros do banco sem devolver pedido", async () => {
			const dbError = new Error("falha de conexão");
			tx.order.updateMany.mockRejectedValue(dbError);

			await expect(updateOrder(1, { status: "PAID" }, 1, true)).rejects.toBe(dbError);
			expect(prismaMock.order.findUniqueOrThrow).not.toHaveBeenCalled();
		});
	});
});
