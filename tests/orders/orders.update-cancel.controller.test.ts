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
import { deleteExistingOrder, updateExistingOrder } from "../../src/controllers/orders.controller";

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeReply() {
	const reply: any = {};
	reply.status = vi.fn().mockReturnValue(reply);
	reply.send = vi.fn().mockReturnValue(reply);
	return reply;
}

const userToken = { userId: 7, role: "USER" };
const adminToken = { userId: 1, role: "ADMIN" };

const address = {
	cep: "01001000",
	street: "Rua Nova",
	number: "20",
	neighborhood: "Centro",
	city: "São Paulo",
	state: "SP",
	country: "BR",
};

describe("orders.controller (PUT e DELETE)", () => {
	let reply: ReturnType<typeof makeReply>;

	beforeEach(() => {
		reply = makeReply();
	});

	describe("updateExistingOrder", () => {
		it("converte o id, valida o corpo, passa userId e papel do token e responde 200", async () => {
			const updated = { id: 5, status: "PAID" };
			svc.updateOrder.mockResolvedValue(updated);

			await updateExistingOrder({ params: { id: "5" }, body: { status: "PAID" }, user: adminToken } as any, reply);

			expect(svc.updateOrder).toHaveBeenCalledWith(5, { status: "PAID" }, 1, true);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith(updated);
		});

		it("usuário comum não é tratado como admin", async () => {
			svc.updateOrder.mockResolvedValue({ id: 5 });

			await updateExistingOrder(
				{ params: { id: "5" }, body: { shippingAddress: address }, user: userToken } as any,
				reply,
			);

			expect(svc.updateOrder).toHaveBeenCalledWith(5, { shippingAddress: address }, 7, false);
		});

		it("não trata como admin quando o papel não existe no token", async () => {
			svc.updateOrder.mockResolvedValue({ id: 5 });

			await updateExistingOrder({ params: { id: "5" }, body: {}, user: { userId: 7 } } as any, reply);

			expect(svc.updateOrder).toHaveBeenCalledWith(5, {}, 7, false);
		});

		it("aceita corpo vazio (todos os campos são opcionais)", async () => {
			svc.updateOrder.mockResolvedValue({ id: 5 });

			await updateExistingOrder({ params: { id: "5" }, body: {}, user: adminToken } as any, reply);

			expect(svc.updateOrder).toHaveBeenCalledWith(5, {}, 1, true);
			expect(reply.status).toHaveBeenCalledWith(200);
		});

		it("preenche country com BR quando o endereço não informa o país", async () => {
			svc.updateOrder.mockResolvedValue({ id: 5 });
			const { country: _country, ...semPais } = address;

			await updateExistingOrder(
				{ params: { id: "5" }, body: { shippingAddress: semPais }, user: userToken } as any,
				reply,
			);

			expect(svc.updateOrder.mock.calls[0][1].shippingAddress.country).toBe("BR");
		});

		it.each([
			["status inválido", { status: "CANCELED" }],
			["status em minúsculas", { status: "paid" }],
			["endereço sem cep", { shippingAddress: { ...address, cep: undefined } }],
			["cep com 7 dígitos", { shippingAddress: { ...address, cep: "0100100" } }],
			["endereço sem rua", { shippingAddress: { ...address, street: "" } }],
			["estado com 3 letras", { shippingAddress: { ...address, state: "SPA" } }],
		])("lança ZodError e não chama o service com %s", async (_nome, body) => {
			await expect(
				updateExistingOrder({ params: { id: "5" }, body, user: adminToken } as any, reply),
			).rejects.toBeInstanceOf(ZodError);

			expect(svc.updateOrder).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});

		it.each([
			[403, "Apenas administradores podem alterar o status do pedido"],
			[404, "Pedido não encontrado"],
			[409, "Transição de status inválida: PENDING → SHIPPED"],
		])("propaga o erro %i do service sem responder", async (statusCode, message) => {
			svc.updateOrder.mockRejectedValue(new HttpError(statusCode, message));

			await expect(
				updateExistingOrder({ params: { id: "5" }, body: { status: "PAID" }, user: userToken } as any, reply),
			).rejects.toMatchObject({ statusCode, message });
			expect(reply.status).not.toHaveBeenCalled();
		});
	});

	describe("deleteExistingOrder", () => {
		it("converte o id, passa userId e papel do token e responde 200 com mensagem", async () => {
			svc.cancelOrder.mockResolvedValue(undefined);

			await deleteExistingOrder({ params: { id: "5" }, user: userToken } as any, reply);

			expect(svc.cancelOrder).toHaveBeenCalledWith(5, 7, false);
			expect(reply.status).toHaveBeenCalledWith(200);
			expect(reply.send).toHaveBeenCalledWith({ message: "Pedido cancelado com sucesso" });
		});

		it("trata papel ADMIN como administrador", async () => {
			svc.cancelOrder.mockResolvedValue(undefined);

			await deleteExistingOrder({ params: { id: "5" }, user: adminToken } as any, reply);

			expect(svc.cancelOrder).toHaveBeenCalledWith(5, 1, true);
		});

		it("não trata como admin quando o papel não existe no token", async () => {
			svc.cancelOrder.mockResolvedValue(undefined);

			await deleteExistingOrder({ params: { id: "5" }, user: { userId: 7 } } as any, reply);

			expect(svc.cancelOrder).toHaveBeenCalledWith(5, 7, false);
		});

		it.each([
			[404, "Pedido não encontrado"],
			[409, "Pedido já está cancelado"],
			[409, "Pedido com status SHIPPED não pode ser cancelado"],
		])("propaga o erro %i (%s) sem responder", async (statusCode, message) => {
			svc.cancelOrder.mockRejectedValue(new HttpError(statusCode, message));

			await expect(deleteExistingOrder({ params: { id: "5" }, user: userToken } as any, reply)).rejects.toMatchObject({
				statusCode,
				message,
			});
			expect(reply.status).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});
	});
});
