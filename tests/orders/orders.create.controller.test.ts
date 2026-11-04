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
import { createNewOrder } from "../../src/controllers/orders.controller";

const svc = service as unknown as Record<string, ReturnType<typeof vi.fn>>;

function makeReply() {
	const reply: any = {};
	reply.status = vi.fn().mockReturnValue(reply);
	reply.send = vi.fn().mockReturnValue(reply);
	return reply;
}

const user = { userId: 7, role: "USER" };

const validBody = () => ({
	items: [{ productId: 1, quantity: 2, size: "M" }],
	shippingAddress: {
		cep: "01001000",
		street: "Rua A",
		number: "10",
		neighborhood: "Centro",
		city: "São Paulo",
		state: "SP",
		country: "BR",
	},
	paymentMethod: "pix",
});

describe("orders.controller (POST)", () => {
	let reply: ReturnType<typeof makeReply>;

	beforeEach(() => {
		reply = makeReply();
	});

	it("valida o corpo, cria o pedido e responde 201 com a mensagem e o id", async () => {
		svc.createOrder.mockResolvedValue({ id: 55 });

		await createNewOrder({ body: validBody(), user } as any, reply);

		expect(svc.createOrder).toHaveBeenCalledWith(7, validBody());
		expect(reply.status).toHaveBeenCalledWith(201);
		expect(reply.send).toHaveBeenCalledWith({ message: "Pedido criado com sucesso", orderId: 55 });
	});

	it("o dono do pedido vem do token, nunca do corpo", async () => {
		svc.createOrder.mockResolvedValue({ id: 55 });

		await createNewOrder({ body: { ...validBody(), userId: 999 }, user } as any, reply);

		const [ownerId, data] = svc.createOrder.mock.calls[0];
		expect(ownerId).toBe(7);
		expect(data).not.toHaveProperty("userId");
	});

	it("ignora campos desconhecidos do corpo, como total e status", async () => {
		svc.createOrder.mockResolvedValue({ id: 55 });

		await createNewOrder({ body: { ...validBody(), total: 0.01, status: "PAID" }, user } as any, reply);

		const data = svc.createOrder.mock.calls[0][1];
		expect(data).not.toHaveProperty("total");
		expect(data).not.toHaveProperty("status");
	});

	it("preenche country com BR quando o endereço não informa o país", async () => {
		svc.createOrder.mockResolvedValue({ id: 55 });
		const body = validBody();
		delete (body.shippingAddress as any).country;

		await createNewOrder({ body, user } as any, reply);

		expect(svc.createOrder.mock.calls[0][1].shippingAddress.country).toBe("BR");
	});

	it("aceita item sem tamanho (campo opcional)", async () => {
		svc.createOrder.mockResolvedValue({ id: 55 });
		const body = validBody();
		body.items = [{ productId: 1, quantity: 1 } as any];

		await createNewOrder({ body, user } as any, reply);

		expect(reply.status).toHaveBeenCalledWith(201);
	});

	describe("campos obrigatórios", () => {
		const without = (field: string) => {
			const { [field]: _removed, ...rest } = validBody() as Record<string, unknown>;
			return rest;
		};
		const withoutAddressField = (field: string) => {
			const body = validBody();
			delete (body.shippingAddress as any)[field];
			return body;
		};
		const withoutItemField = (field: string) => {
			const body = validBody();
			delete (body.items[0] as any)[field];
			return body;
		};

		it.each([
			["items", without("items")],
			["shippingAddress", without("shippingAddress")],
			["paymentMethod", without("paymentMethod")],
			["items vazio", { ...validBody(), items: [] }],
			["item sem productId", withoutItemField("productId")],
			["item sem quantity", withoutItemField("quantity")],
			["endereço sem cep", withoutAddressField("cep")],
			["endereço sem street", withoutAddressField("street")],
			["endereço sem number", withoutAddressField("number")],
			["endereço sem neighborhood", withoutAddressField("neighborhood")],
			["endereço sem city", withoutAddressField("city")],
			["endereço sem state", withoutAddressField("state")],
			["corpo vazio", {}],
		])("lança ZodError e não cria pedido quando falta: %s", async (_nome, body) => {
			await expect(createNewOrder({ body, user } as any, reply)).rejects.toBeInstanceOf(ZodError);

			expect(svc.createOrder).not.toHaveBeenCalled();
			expect(reply.send).not.toHaveBeenCalled();
		});
	});

	it.each([
		["quantidade 0", { items: [{ productId: 1, quantity: 0 }] }],
		["quantidade acima de 99", { items: [{ productId: 1, quantity: 100 }] }],
		["productId 0", { items: [{ productId: 0, quantity: 1 }] }],
		["pagamento inválido", { paymentMethod: "cheque" }],
		["cep com 7 dígitos", { shippingAddress: { ...validBody().shippingAddress, cep: "0100100" } }],
	])("lança ZodError com %s", async (_nome, override) => {
		await expect(
			createNewOrder({ body: { ...validBody(), ...override }, user } as any, reply),
		).rejects.toBeInstanceOf(ZodError);

		expect(svc.createOrder).not.toHaveBeenCalled();
	});

	it.each([
		[404, "Produto 5 não encontrado"],
		[400, "Produto Camiseta Dev está inativo"],
		[409, "Estoque insuficiente para Camiseta Dev"],
	])("propaga o erro %i do service sem responder", async (statusCode, message) => {
		svc.createOrder.mockRejectedValue(new HttpError(statusCode, message));

		await expect(createNewOrder({ body: validBody(), user } as any, reply)).rejects.toMatchObject({
			statusCode,
			message,
		});
		expect(reply.status).not.toHaveBeenCalled();
		expect(reply.send).not.toHaveBeenCalled();
	});
});
