import { beforeEach, describe, expect, it, vi } from "vitest";

// Nenhum teste acessa o banco: o Prisma inteiro é substituído por mocks.
vi.mock("../../src/utils/prisma", () => ({
	prisma: {
		order: {
			findMany: vi.fn(),
			count: vi.fn(),
			findFirst: vi.fn(),
		},
	},
}));

import { prisma } from "../../src/utils/prisma";
import { HttpError } from "../../src/utils/http-error";
import { getOrderById, getOrders } from "../../src/services/orders.service";

const db = prisma.order as unknown as {
	findMany: ReturnType<typeof vi.fn>;
	count: ReturnType<typeof vi.fn>;
	findFirst: ReturnType<typeof vi.fn>;
};

const order = {
	id: 1,
	userId: 7,
	total: "199.80",
	status: "PENDING",
	paymentMethod: "pix",
	shippingAddress: { cep: "01001000", street: "Rua A", number: "10" },
	createdAt: new Date("2026-01-10T10:00:00Z"),
	updatedAt: new Date("2026-01-10T10:00:00Z"),
};

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

describe("orders.service (GET)", () => {
	beforeEach(() => {
		db.findMany.mockResolvedValue([order]);
		db.count.mockResolvedValue(1);
	});

	describe("getOrders", () => {
		it("usa página 1, limite 10 e ordena do mais recente para o mais antigo", async () => {
			const result = await getOrders({}, USER_ID, false);

			expect(db.findMany).toHaveBeenCalledWith({
				where: { userId: USER_ID },
				skip: 0,
				take: 10,
				orderBy: { createdAt: "desc" },
			});
			expect(result).toEqual({
				data: [order],
				total: 1,
				page: 1,
				limit: 10,
				totalPages: 1,
			});
		});

		it("usa filtros vazios quando nenhum argumento de filtro é informado", async () => {
			await getOrders(undefined, USER_ID, true);

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {}, skip: 0, take: 10 }));
		});

		it("calcula skip, take e totalPages na paginação", async () => {
			db.count.mockResolvedValue(25);

			const result = await getOrders({ page: 3, limit: 5 }, USER_ID, true);

			expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 10, take: 5 }));
			expect(result.totalPages).toBe(5);
			expect(result.page).toBe(3);
			expect(result.limit).toBe(5);
		});

		it("retorna lista vazia e totalPages 0 quando não há pedidos", async () => {
			db.findMany.mockResolvedValue([]);
			db.count.mockResolvedValue(0);

			const result = await getOrders({}, USER_ID, false);

			expect(result.data).toEqual([]);
			expect(result.total).toBe(0);
			expect(result.totalPages).toBe(0);
		});

		it("usa o mesmo filtro na listagem e na contagem", async () => {
			await getOrders({ status: "PAID" }, USER_ID, false);

			expect(db.count).toHaveBeenCalledWith({ where: { userId: USER_ID, status: "PAID" } });
		});

		describe("escopo por usuário", () => {
			it("usuário comum vê só os próprios pedidos", async () => {
				await getOrders({}, USER_ID, false);

				expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID } }));
				expect(db.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
			});

			it("usuário comum não consegue ver pedidos de outro usuário pelo filtro userId", async () => {
				await getOrders({ userId: 999 }, USER_ID, false);

				expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: USER_ID } }));
				expect(db.count).toHaveBeenCalledWith({ where: { userId: USER_ID } });
			});

			it("admin sem filtro de userId vê os pedidos de todos", async () => {
				await getOrders({}, USER_ID, true);

				expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
			});

			it("admin pode filtrar pelo userId de outro usuário", async () => {
				await getOrders({ userId: 42 }, USER_ID, true);

				expect(db.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: 42 } }));
				expect(db.count).toHaveBeenCalledWith({ where: { userId: 42 } });
			});
		});

		describe("filtro por status", () => {
			it.each(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"] as const)("filtra por %s", async (status) => {
				await getOrders({ status }, USER_ID, true);

				expect(db.count).toHaveBeenCalledWith({ where: { status } });
			});
		});

		describe("filtro por período", () => {
			const start = new Date("2026-01-01T00:00:00Z");
			const end = new Date("2026-01-31T23:59:59Z");

			it("filtra só pela data inicial (gte)", async () => {
				await getOrders({ startDate: start }, USER_ID, true);

				expect(db.count).toHaveBeenCalledWith({ where: { createdAt: { gte: start } } });
			});

			it("filtra só pela data final (lte)", async () => {
				await getOrders({ endDate: end }, USER_ID, true);

				expect(db.count).toHaveBeenCalledWith({ where: { createdAt: { lte: end } } });
			});

			it("filtra pelo intervalo completo", async () => {
				await getOrders({ startDate: start, endDate: end }, USER_ID, true);

				expect(db.count).toHaveBeenCalledWith({ where: { createdAt: { gte: start, lte: end } } });
			});
		});

		it("combina escopo do usuário, status, período e paginação", async () => {
			const start = new Date("2026-01-01T00:00:00Z");

			await getOrders({ status: "SHIPPED", startDate: start, page: 2, limit: 20 }, USER_ID, false);

			expect(db.findMany).toHaveBeenCalledWith({
				where: { userId: USER_ID, status: "SHIPPED", createdAt: { gte: start } },
				skip: 20,
				take: 20,
				orderBy: { createdAt: "desc" },
			});
		});

		it("propaga o erro do banco", async () => {
			const dbError = new Error("falha de conexão");
			db.findMany.mockRejectedValue(dbError);

			await expect(getOrders({}, USER_ID, false)).rejects.toBe(dbError);
		});
	});

	describe("getOrderById", () => {
		it("usuário comum busca o pedido filtrando também pelo próprio userId", async () => {
			db.findFirst.mockResolvedValue(order);

			const result = await getOrderById(1, USER_ID, false);

			expect(db.findFirst).toHaveBeenCalledWith(
				expect.objectContaining({ where: { id: 1, userId: USER_ID } }),
			);
			expect(result).toEqual(order);
		});

		it("admin busca o pedido só pelo id, sem filtrar por dono", async () => {
			db.findFirst.mockResolvedValue(order);

			await getOrderById(1, 999, true);

			expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1 } }));
		});

		it("inclui o dono (só campos públicos) e os itens com produto e categoria", async () => {
			db.findFirst.mockResolvedValue(order);

			await getOrderById(1, USER_ID, false);

			const { include } = db.findFirst.mock.calls[0][0];
			expect(include.user.select).toEqual({ id: true, firstName: true, lastName: true, email: true });
			expect(include.items.select).toEqual(
				expect.objectContaining({ id: true, productId: true, price: true, quantity: true, size: true }),
			);
			expect(include.items.select.product.select).toEqual(
				expect.objectContaining({
					id: true,
					name: true,
					slug: true,
					images: true,
					category: { select: { id: true, name: true, slug: true } },
				}),
			);
		});

		it("não expõe dados sensíveis do dono do pedido (cpf, telefone, senha)", async () => {
			db.findFirst.mockResolvedValue(order);

			await getOrderById(1, USER_ID, false);

			const userSelect = db.findFirst.mock.calls[0][0].include.user.select;
			expect(userSelect).not.toHaveProperty("cpf");
			expect(userSelect).not.toHaveProperty("phone");
			expect(userSelect).not.toHaveProperty("password");
		});

		it("lança 404 quando o pedido não existe", async () => {
			db.findFirst.mockResolvedValue(null);

			await expectHttpError(getOrderById(999, USER_ID, false), 404, "Pedido não encontrado");
		});

		it("pedido de outro usuário responde 404, igual a um pedido inexistente", async () => {
			// O filtro por dono está na consulta: para o usuário comum o banco devolve null.
			db.findFirst.mockResolvedValue(null);

			await expectHttpError(getOrderById(1, 8, false), 404, "Pedido não encontrado");
			expect(db.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, userId: 8 } }));
		});

		it("admin também recebe 404 quando o pedido não existe", async () => {
			db.findFirst.mockResolvedValue(null);

			await expectHttpError(getOrderById(999, 1, true), 404, "Pedido não encontrado");
		});
	});
});
