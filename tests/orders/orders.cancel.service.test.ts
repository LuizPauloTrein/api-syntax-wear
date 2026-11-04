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
	};
	return { tx, prismaMock };
});

vi.mock("../../src/utils/prisma", () => ({ prisma: prismaMock }));

import { HttpError } from "../../src/utils/http-error";
import { cancelOrder } from "../../src/services/orders.service";

const USER_ID = 7;

async function expectHttpError(promise: Promise<unknown>, statusCode: number, message?: string) {
	const error = await promise.then(
		() => null,
		(e) => e,
	);
	expect(error).toBeInstanceOf(HttpError);
	expect(error.statusCode).toBe(statusCode);
	if (message) expect(error.message).toBe(message);
}

describe("orders.service - cancelOrder (DELETE)", () => {
	beforeEach(() => {
		tx.order.updateMany.mockResolvedValue({ count: 1 });
		tx.order.findFirst.mockResolvedValue(null);
		tx.orderItem.findMany.mockResolvedValue([]);
		tx.product.update.mockResolvedValue({});
	});

	describe("cancelamento", () => {
		it("usuário comum cancela só o próprio pedido, apenas se PENDING ou PAID", async () => {
			await cancelOrder(1, USER_ID, false);

			expect(tx.order.updateMany).toHaveBeenCalledWith({
				where: { id: 1, userId: USER_ID, status: { in: ["PENDING", "PAID"] } },
				data: { status: "CANCELLED" },
			});
		});

		it("admin cancela qualquer pedido, sem filtrar por dono", async () => {
			await cancelOrder(1, 99, true);

			expect(tx.order.updateMany).toHaveBeenCalledWith({
				where: { id: 1, status: { in: ["PENDING", "PAID"] } },
				data: { status: "CANCELLED" },
			});
		});

		it("é exclusão lógica: marca CANCELLED, sem apagar nada", async () => {
			await cancelOrder(1, USER_ID, false);

			expect(tx.order.updateMany).toHaveBeenCalledTimes(1);
			expect(tx.order.updateMany.mock.calls[0][0].data).toEqual({ status: "CANCELLED" });
		});

		it("resolve sem retornar valor", async () => {
			await expect(cancelOrder(1, USER_ID, false)).resolves.toBeUndefined();
		});

		it("executa tudo dentro de uma transação", async () => {
			await cancelOrder(1, USER_ID, false);

			expect(prismaMock.$transaction).toHaveBeenCalledTimes(1);
		});
	});

	describe("devolução de estoque", () => {
		it("devolve a quantidade de cada item ao estoque", async () => {
			tx.orderItem.findMany.mockResolvedValue([
				{ productId: 3, quantity: 2 },
				{ productId: 4, quantity: 1 },
			]);

			await cancelOrder(1, USER_ID, false);

			expect(tx.orderItem.findMany).toHaveBeenCalledWith({ where: { orderId: 1 } });
			expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { stock: { increment: 2 } } });
			expect(tx.product.update).toHaveBeenCalledWith({ where: { id: 4 }, data: { stock: { increment: 1 } } });
		});

		it("soma itens do mesmo produto e atualiza em ordem crescente de produto", async () => {
			tx.orderItem.findMany.mockResolvedValue([
				{ productId: 9, quantity: 1 },
				{ productId: 1, quantity: 5 },
				{ productId: 9, quantity: 2 },
			]);

			await cancelOrder(1, USER_ID, false);

			expect(tx.product.update).toHaveBeenNthCalledWith(1, {
				where: { id: 1 },
				data: { stock: { increment: 5 } },
			});
			expect(tx.product.update).toHaveBeenNthCalledWith(2, {
				where: { id: 9 },
				data: { stock: { increment: 3 } },
			});
		});

		it("não mexe no estoque quando o pedido não tem itens", async () => {
			await cancelOrder(1, USER_ID, false);

			expect(tx.product.update).not.toHaveBeenCalled();
		});
	});

	describe("quando nada foi cancelado", () => {
		beforeEach(() => {
			tx.order.updateMany.mockResolvedValue({ count: 0 });
			tx.orderItem.findMany.mockResolvedValue([{ productId: 1, quantity: 2 }]);
		});

		it("lança 404 quando o pedido não existe", async () => {
			tx.order.findFirst.mockResolvedValue(null);

			await expectHttpError(cancelOrder(999, 1, true), 404, "Pedido não encontrado");
		});

		it("lança 404 para pedido de outro usuário, igual a um inexistente", async () => {
			tx.order.findFirst.mockResolvedValue(null);

			await expectHttpError(cancelOrder(1, 8, false), 404, "Pedido não encontrado");
			expect(tx.order.findFirst).toHaveBeenCalledWith({
				where: { id: 1, userId: 8 },
				select: { status: true },
			});
		});

		it("admin consulta o status só pelo id", async () => {
			tx.order.findFirst.mockResolvedValue(null);

			await expect(cancelOrder(1, 99, true)).rejects.toBeInstanceOf(HttpError);

			expect(tx.order.findFirst).toHaveBeenCalledWith({ where: { id: 1 }, select: { status: true } });
		});

		it("lança 409 quando o pedido já está cancelado", async () => {
			tx.order.findFirst.mockResolvedValue({ status: "CANCELLED" });

			await expectHttpError(cancelOrder(1, USER_ID, false), 409, "Pedido já está cancelado");
		});

		it.each(["SHIPPED", "DELIVERED"])("lança 409 quando o pedido está %s", async (status) => {
			tx.order.findFirst.mockResolvedValue({ status });

			await expectHttpError(cancelOrder(1, USER_ID, false), 409, `Pedido com status ${status} não pode ser cancelado`);
		});

		it("nunca devolve estoque quando nada foi cancelado", async () => {
			tx.order.findFirst.mockResolvedValue({ status: "CANCELLED" });

			await expect(cancelOrder(1, USER_ID, false)).rejects.toBeInstanceOf(HttpError);

			expect(tx.orderItem.findMany).not.toHaveBeenCalled();
			expect(tx.product.update).not.toHaveBeenCalled();
		});
	});

	it("propaga erros do banco", async () => {
		const dbError = new Error("falha de conexão");
		tx.order.updateMany.mockRejectedValue(dbError);

		await expect(cancelOrder(1, USER_ID, false)).rejects.toBe(dbError);
	});
});
