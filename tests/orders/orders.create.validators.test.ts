import { describe, expect, it } from "vitest";
import { createOrderItemSchema, createOrderSchema } from "../../src/utils/validators";

const validAddress = {
	cep: "01001000",
	street: "Rua A",
	number: "10",
	complement: "Apto 3",
	neighborhood: "Centro",
	city: "São Paulo",
	state: "SP",
	country: "BR",
};

const validOrder = {
	items: [{ productId: 1, quantity: 2, size: "M" }],
	shippingAddress: validAddress,
	paymentMethod: "pix",
};

type Result = { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } };
const issues = (result: Result) => result.error?.issues ?? [];
const paths = (result: Result) => issues(result).map((i) => i.path.join("."));
const messages = (result: Result) => issues(result).map((i) => i.message);

describe("createOrderItemSchema", () => {
	it("aceita item válido, com ou sem tamanho", () => {
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: 1, size: "M" }).success).toBe(true);
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: 1 }).success).toBe(true);
	});

	it.each(["productId", "quantity"])("rejeita quando falta %s", (field) => {
		const { [field]: _removed, ...rest } = { productId: 1, quantity: 1 } as Record<string, unknown>;
		const result = createOrderItemSchema.safeParse(rest);

		expect(result.success).toBe(false);
		expect(paths(result)).toContain(field);
	});

	it("rejeita productId menor que 1 ou decimal", () => {
		expect(messages(createOrderItemSchema.safeParse({ productId: 0, quantity: 1 }))).toContain(
			"ID do produto inválido",
		);
		expect(createOrderItemSchema.safeParse({ productId: 1.5, quantity: 1 }).success).toBe(false);
	});

	it("aceita quantidade de 1 a 99 e rejeita fora disso", () => {
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: 1 }).success).toBe(true);
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: 99 }).success).toBe(true);
		expect(messages(createOrderItemSchema.safeParse({ productId: 1, quantity: 0 }))).toContain(
			"Quantidade deve ser no mínimo 1",
		);
		expect(messages(createOrderItemSchema.safeParse({ productId: 1, quantity: 100 }))).toContain(
			"Quantidade máxima por item é 99",
		);
	});

	it("rejeita quantidade decimal ou como string", () => {
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: 1.5 }).success).toBe(false);
		expect(createOrderItemSchema.safeParse({ productId: 1, quantity: "2" }).success).toBe(false);
	});
});

describe("createOrderSchema", () => {
	it("aceita um pedido válido", () => {
		expect(createOrderSchema.safeParse(validOrder).success).toBe(true);
	});

	describe("campos obrigatórios", () => {
		it.each(["items", "shippingAddress", "paymentMethod"])("rejeita quando falta %s", (field) => {
			const { [field]: _removed, ...rest } = validOrder as Record<string, unknown>;
			const result = createOrderSchema.safeParse(rest);

			expect(result.success).toBe(false);
			expect(paths(result)).toContain(field);
		});

		it("rejeita corpo vazio apontando os três campos obrigatórios", () => {
			const result = createOrderSchema.safeParse({});

			expect(result.success).toBe(false);
			expect(paths(result)).toEqual(expect.arrayContaining(["items", "shippingAddress", "paymentMethod"]));
		});

		it.each(["cep", "street", "number", "neighborhood", "city", "state"])(
			"rejeita endereço sem %s",
			(field) => {
				const { [field]: _removed, ...rest } = validAddress as Record<string, unknown>;
				const result = createOrderSchema.safeParse({ ...validOrder, shippingAddress: rest });

				expect(result.success).toBe(false);
				expect(paths(result)).toContain(`shippingAddress.${field}`);
			},
		);

		it("complement e country do endereço são opcionais", () => {
			const { complement: _c, country: _p, ...rest } = validAddress;

			expect(createOrderSchema.safeParse({ ...validOrder, shippingAddress: rest }).success).toBe(true);
		});

		it("country assume BR quando não informado", () => {
			const { country: _country, ...rest } = validAddress;
			const parsed = createOrderSchema.parse({ ...validOrder, shippingAddress: rest });

			expect(parsed.shippingAddress.country).toBe("BR");
		});

		it("size do item é opcional", () => {
			expect(
				createOrderSchema.safeParse({ ...validOrder, items: [{ productId: 1, quantity: 1 }] }).success,
			).toBe(true);
		});
	});

	describe("items", () => {
		it("rejeita lista vazia com mensagem em português", () => {
			const result = createOrderSchema.safeParse({ ...validOrder, items: [] });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Pedido deve ter pelo menos um item");
		});

		it("aceita 50 itens e rejeita 51", () => {
			const makeItems = (n: number) => Array.from({ length: n }, (_, i) => ({ productId: i + 1, quantity: 1 }));

			expect(createOrderSchema.safeParse({ ...validOrder, items: makeItems(50) }).success).toBe(true);

			const result = createOrderSchema.safeParse({ ...validOrder, items: makeItems(51) });
			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Máximo de 50 itens por pedido");
		});

		it("valida cada item da lista", () => {
			const result = createOrderSchema.safeParse({
				...validOrder,
				items: [
					{ productId: 1, quantity: 1 },
					{ productId: 2, quantity: 0 },
				],
			});

			expect(result.success).toBe(false);
			expect(paths(result)).toContain("items.1.quantity");
		});

		it("rejeita items que não é lista", () => {
			expect(createOrderSchema.safeParse({ ...validOrder, items: "1" }).success).toBe(false);
		});
	});

	describe("paymentMethod", () => {
		it.each(["credit_card", "pix", "boleto"])("aceita %s", (paymentMethod) => {
			expect(createOrderSchema.safeParse({ ...validOrder, paymentMethod }).success).toBe(true);
		});

		it.each(["cheque", "PIX", "credit-card", "", 1])("rejeita %j", (paymentMethod) => {
			const result = createOrderSchema.safeParse({ ...validOrder, paymentMethod });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Método de pagamento inválido");
		});
	});

	describe("shippingAddress - mensagens em português", () => {
		const messageFor = (override: Record<string, unknown>) =>
			messages(createOrderSchema.safeParse({ ...validOrder, shippingAddress: { ...validAddress, ...override } }));

		it("cep fora do formato de 8 dígitos", () => {
			expect(messageFor({ cep: "0100100" })).toContain("CEP deve ter 8 dígitos");
			expect(messageFor({ cep: "01001-000" })).toContain("CEP deve ter 8 dígitos");
			expect(messageFor({ cep: "abcdefgh" })).toContain("CEP deve ter 8 dígitos");
		});

		it("campos de texto vazios", () => {
			expect(messageFor({ street: "" })).toContain("Rua é obrigatória");
			expect(messageFor({ number: "" })).toContain("Número é obrigatório");
			expect(messageFor({ neighborhood: "" })).toContain("Bairro é obrigatório");
			expect(messageFor({ city: "" })).toContain("Cidade é obrigatória");
		});

		it("estado com tamanho diferente de 2", () => {
			expect(messageFor({ state: "S" })).toContain("Estado deve ter 2 caracteres");
			expect(messageFor({ state: "SPA" })).toContain("Estado deve ter 2 caracteres");
		});
	});

	it("não aceita total, status ou userId como parte do contrato (são descartados)", () => {
		const parsed = createOrderSchema.parse({ ...validOrder, total: 1, status: "PAID", userId: 9 });

		expect(parsed).not.toHaveProperty("total");
		expect(parsed).not.toHaveProperty("status");
		expect(parsed).not.toHaveProperty("userId");
	});
});
