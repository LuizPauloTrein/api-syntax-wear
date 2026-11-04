import { describe, expect, it } from "vitest";
import { updateOrderSchema } from "../../src/utils/validators";

const validAddress = {
	cep: "01001000",
	street: "Rua Nova",
	number: "20",
	complement: "Apto 3",
	neighborhood: "Centro",
	city: "São Paulo",
	state: "SP",
	country: "BR",
};

function issues(result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } }) {
	return result.error?.issues ?? [];
}

describe("updateOrderSchema", () => {
	describe("campos opcionais do corpo", () => {
		it("aceita corpo vazio", () => {
			expect(updateOrderSchema.parse({})).toEqual({});
		});

		it("aceita só status", () => {
			expect(updateOrderSchema.safeParse({ status: "PAID" }).success).toBe(true);
		});

		it("aceita só endereço", () => {
			expect(updateOrderSchema.safeParse({ shippingAddress: validAddress }).success).toBe(true);
		});

		it("aceita status e endereço juntos", () => {
			expect(updateOrderSchema.safeParse({ status: "PAID", shippingAddress: validAddress }).success).toBe(true);
		});
	});

	describe("status", () => {
		it.each(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"])("aceita %s", (status) => {
			expect(updateOrderSchema.safeParse({ status }).success).toBe(true);
		});

		it.each(["CANCELED", "paid", "SENT", "", 1, null])("rejeita %j", (status) => {
			expect(updateOrderSchema.safeParse({ status }).success).toBe(false);
		});
	});

	describe("shippingAddress - campos obrigatórios quando o endereço é enviado", () => {
		it.each(["cep", "street", "number", "neighborhood", "city", "state"])("rejeita quando falta %s", (field) => {
			const { [field]: _removed, ...rest } = validAddress as Record<string, unknown>;
			const result = updateOrderSchema.safeParse({ shippingAddress: rest });

			expect(result.success).toBe(false);
			expect(issues(result).some((i) => i.path.join(".") === `shippingAddress.${field}`)).toBe(true);
		});

		it("rejeita endereço vazio apontando todos os obrigatórios", () => {
			const result = updateOrderSchema.safeParse({ shippingAddress: {} });
			const paths = issues(result).map((i) => i.path.join("."));

			expect(result.success).toBe(false);
			expect(paths).toEqual(
				expect.arrayContaining([
					"shippingAddress.cep",
					"shippingAddress.street",
					"shippingAddress.number",
					"shippingAddress.neighborhood",
					"shippingAddress.city",
					"shippingAddress.state",
				]),
			);
			expect(paths).not.toContain("shippingAddress.complement");
			expect(paths).not.toContain("shippingAddress.country");
		});

		it("complement é opcional", () => {
			const { complement: _complement, ...rest } = validAddress;

			expect(updateOrderSchema.safeParse({ shippingAddress: rest }).success).toBe(true);
		});

		it("country é opcional e assume BR", () => {
			const { country: _country, ...rest } = validAddress;
			const parsed = updateOrderSchema.parse({ shippingAddress: rest });

			expect(parsed.shippingAddress?.country).toBe("BR");
		});

		it("mantém o country informado", () => {
			const parsed = updateOrderSchema.parse({ shippingAddress: { ...validAddress, country: "AR" } });

			expect(parsed.shippingAddress?.country).toBe("AR");
		});
	});

	describe("shippingAddress - mensagens de validação em português", () => {
		const messageFor = (override: Record<string, unknown>) =>
			issues(updateOrderSchema.safeParse({ shippingAddress: { ...validAddress, ...override } })).map((i) => i.message);

		it("cep com menos ou mais de 8 dígitos, ou com letras/hífen", () => {
			expect(messageFor({ cep: "0100100" })).toContain("CEP deve ter 8 dígitos");
			expect(messageFor({ cep: "010010000" })).toContain("CEP deve ter 8 dígitos");
			expect(messageFor({ cep: "01001-000" })).toContain("CEP deve ter 8 dígitos");
			expect(messageFor({ cep: "abcdefgh" })).toContain("CEP deve ter 8 dígitos");
		});

		it("rua vazia", () => {
			expect(messageFor({ street: "" })).toContain("Rua é obrigatória");
		});

		it("número vazio", () => {
			expect(messageFor({ number: "" })).toContain("Número é obrigatório");
		});

		it("bairro vazio", () => {
			expect(messageFor({ neighborhood: "" })).toContain("Bairro é obrigatório");
		});

		it("cidade vazia", () => {
			expect(messageFor({ city: "" })).toContain("Cidade é obrigatória");
		});

		it("estado com tamanho diferente de 2", () => {
			expect(messageFor({ state: "S" })).toContain("Estado deve ter 2 caracteres");
			expect(messageFor({ state: "SPA" })).toContain("Estado deve ter 2 caracteres");
		});

		it("aceita CEP com exatamente 8 dígitos e estado com 2 letras", () => {
			expect(messageFor({ cep: "12345678", state: "RJ" })).toEqual([]);
		});
	});

	it("rejeita endereço que não é objeto", () => {
		expect(updateOrderSchema.safeParse({ shippingAddress: "Rua A, 10" }).success).toBe(false);
		expect(updateOrderSchema.safeParse({ shippingAddress: null }).success).toBe(false);
	});
});
