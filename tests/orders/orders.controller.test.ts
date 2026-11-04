import { beforeEach, describe, expect, it, vi } from "vitest";
import { ZodError } from "zod";

// Controller isolado: o service é mockado, então nada chega ao banco.
vi.mock("../../src/services/orders.service", () => ({
	getOrders: vi.fn(),
	getOrderById: vi.fn(),
	createOrder: vi.fn(),
	updateOrder: vi.fn(),
	cancelOrder: vi.fn(),
}));

import * as service from "../../src/services/orders.service";
import { HttpError } from "../../src/utils/http-error";
import { getOrder, listOrders } from "../../src/controllers/orders.controller";

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeReply() {
	const reply: any = {};
	reply.status = vi.fn().mockReturnValue(reply);
	reply.send = vi.fn().mockReturnValue(reply);
	return reply;
}

const userToken = { userId: 7, role: "USER" };
const adminToken = { userId: 1, role: "ADMIN" };

describe("orders.controller (GET)", () => {
	let reply: ReturnType<typeof makeReply>;

	beforeEach(() => {
		reply = makeReply();
	});

	describe("listOrders", () => {
		it("converte a query, passa userId e papel do token e responde 200", async () => {
			const result = { data: [], total: 0, page: 2, limit: 5, totalPages: 0 };
			svc.getOrders.mockResolvedValue(result);

			await listOrders({ query: { page: "2", limit: "5", status: "PAID" }, user: userToken } as any, reply);

			expect(svc.getOrders).toHaveBeenCalledWith({ page: 2, limit: 5, status: "PAID" }, 7, false);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(result);
		});

		it("trata papel ADMIN como administrador", async () => {
			svc.getOrders.mockResolvedValue({ data: [] });

			await listOrders({ query: {}, user: adminToken } as any, reply);

			expect(svc.getOrders).toHaveBeenCalledWith({}, 1, true);
		});

		it("não trata como admin quando o papel é outro ou não existe", async () => {
			svc.getOrders.mockResolvedValue({ data: [] });

			await listOrders({ query: {}, user: { userId: 7, role: "CUSTOMER" } } as any, reply);
			await listOrders({ query: {}, user: { userId: 7 } } as any, reply);

			expect(svc.getOrders).toHaveBeenNthCalledWith(1, {}, 7, false);
			expect(svc.getOrders).toHaveBeenNthCalledWith(2, {}, 7, false);
		});

		it("converte as datas da query para Date antes de chamar o service", async () => {
			svc.getOrders.mockResolvedValue({ data: [] });

			await listOrders({ query: { startDate: "2026-01-01", endDate: "2026-01-31" }, user: adminToken } as any, reply);

			const filters = svc.getOrders.mock.calls[0][0];
			expect(filters.startDate).toBeInstanceOf(Date);
			expect(filters.endDate).toBeInstanceOf(Date);
		});

		it("repassa o filtro userId (a decisão de escopo fica no service)", async () => {
			svc.getOrders.mockResolvedValue({ data: [] });

			await listOrders({ query: { userId: "42" }, user: adminToken } as any, reply);

			expect(svc.getOrders).toHaveBeenCalledWith({ userId: 42 }, 1, true);
		});

		it.each([
			["página 0", { page: "0" }],
			["limite acima de 100", { limit: "101" }],
			["status inválido", { status: "CANCELED" }],
			["data inválida", { startDate: "abc" }],
			["userId decimal", { userId: "1.5" }],
		])("lança ZodError e não chama o service com %s", async (_nome, query) => {
			await expect(listOrders({ query, user: userToken } as any, reply)).rejects.toBeInstanceOf(ZodError);

			expect(svc.getOrders).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});

		it("propaga erros do service", async () => {
			svc.getOrders.mockRejectedValue(new Error("falha"));

			await expect(listOrders({ query: {}, user: userToken } as any, reply)).rejects.toThrow("falha");
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	describe("getOrder", () => {
		it("converte o id, passa userId e papel do token e responde 200", async () => {
			const order = { id: 5, status: "PENDING" };
			svc.getOrderById.mockResolvedValue(order);

			await getOrder({ params: { id: "5" }, user: userToken } as any, reply);

			expect(svc.getOrderById).toHaveBeenCalledWith(5, 7, false);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(order);
		});

		it("trata papel ADMIN como administrador", async () => {
			svc.getOrderById.mockResolvedValue({ id: 5 });

			await getOrder({ params: { id: "5" }, user: adminToken } as any, reply);

			expect(svc.getOrderById).toHaveBeenCalledWith(5, 1, true);
		});

		it("não trata como admin quando o papel não existe no token", async () => {
			svc.getOrderById.mockResolvedValue({ id: 5 });

			await getOrder({ params: { id: "5" }, user: { userId: 7 } } as any, reply);

			expect(svc.getOrderById).toHaveBeenCalledWith(5, 7, false);
		});

		it("propaga o 404 do service sem responder", async () => {
			svc.getOrderById.mockRejectedValue(new HttpError(404, "Pedido não encontrado"));

			await expect(getOrder({ params: { id: "9" }, user: userToken } as any, reply)).rejects.toMatchObject({
				statusCode: 404,
			});
			expect(reply.status).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});
	});
});
