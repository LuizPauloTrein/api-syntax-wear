import { describe, expect, it } from "vitest";
import { orderFiltersSchema } from "../../src/utils/validators";

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((i) => i.message) ?? [];
}

describe("orderFiltersSchema", () => {
	describe("campos opcionais", () => {
		it("aceita query vazia (nenhum filtro é obrigatório)", () => {
			expect(orderFiltersSchema.parse({})).toEqual({});
		});

		it("aceita cada filtro isoladamente", () => {
			expect(orderFiltersSchema.safeParse({ page: "1" }).success).toBe(true);
			expect(orderFiltersSchema.safeParse({ limit: "10" }).success).toBe(true);
			expect(orderFiltersSchema.safeParse({ status: "PAID" }).success).toBe(true);
			expect(orderFiltersSchema.safeParse({ userId: "3" }).success).toBe(true);
			expect(orderFiltersSchema.safeParse({ startDate: "2026-01-01" }).success).toBe(true);
			expect(orderFiltersSchema.safeParse({ endDate: "2026-01-31" }).success).toBe(true);
		});
	});

	describe("conversão de tipos da query", () => {
		it("converte números vindos como string", () => {
			expect(orderFiltersSchema.parse({ page: "2", limit: "20", userId: "5" })).toEqual({
				page: 2,
				limit: 20,
				userId: 5,
			});
		});

		it("converte datas vindas como string para Date", () => {
			const result = orderFiltersSchema.parse({ startDate: "2026-01-01", endDate: "2026-01-31T23:59:59Z" });

			expect(result.startDate).toBeInstanceOf(Date);
			expect(result.endDate).toBeInstanceOf(Date);
			expect(result.startDate?.toISOString()).toBe("2026-01-01T00:00:00.000Z");
			expect(result.endDate?.toISOString()).toBe("2026-01-31T23:59:59.000Z");
		});
	});

	describe("page e limit", () => {
		it("rejeita página menor que 1", () => {
			const result = orderFiltersSchema.safeParse({ page: "0" });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Página deve ser no mínimo 1");
		});

		it("rejeita limite menor que 1", () => {
			const result = orderFiltersSchema.safeParse({ limit: "0" });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Limite deve ser no mínimo 1");
		});

		it("aceita limite 100 e rejeita 101", () => {
			expect(orderFiltersSchema.safeParse({ limit: "100" }).success).toBe(true);

			const result = orderFiltersSchema.safeParse({ limit: "101" });
			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Limite máximo é 100");
		});

		it("rejeita valores decimais ou não numéricos", () => {
			expect(orderFiltersSchema.safeParse({ page: "1.5" }).success).toBe(false);
			expect(orderFiltersSchema.safeParse({ limit: "abc" }).success).toBe(false);
		});
	});

	describe("status", () => {
		it.each(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELLED"])("aceita %s", (status) => {
			expect(orderFiltersSchema.safeParse({ status }).success).toBe(true);
		});

		it.each(["CANCELED", "pending", "SENT", ""])("rejeita %j", (status) => {
			expect(orderFiltersSchema.safeParse({ status }).success).toBe(false);
		});
	});

	describe("userId", () => {
		it("rejeita valores decimais ou não numéricos", () => {
			expect(orderFiltersSchema.safeParse({ userId: "1.5" }).success).toBe(false);
			expect(orderFiltersSchema.safeParse({ userId: "abc" }).success).toBe(false);
		});
	});

	describe("datas", () => {
		it("rejeita data inicial inválida com mensagem em português", () => {
			const result = orderFiltersSchema.safeParse({ startDate: "não-é-data" });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Data inicial inválida");
		});

		it("rejeita data final inválida com mensagem em português", () => {
			const result = orderFiltersSchema.safeParse({ endDate: "31/31/2026" });

			expect(result.success).toBe(false);
			expect(messages(result)).toContain("Data final inválida");
		});
	});
});
