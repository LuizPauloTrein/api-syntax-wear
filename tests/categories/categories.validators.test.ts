import { describe, expect, it } from "vitest";
import {
	categoryFiltersSchema,
	createCategorySchema,
	updateCategorySchema,
} from "../../src/utils/validators";

const validCategory = {
	name: "Camisetas",
	description: "Camisetas em geral",
	slug: "camisetas",
	active: true,
};

function messages(result: { success: boolean; error?: { issues: { message: string }[] } }) {
	return result.error?.issues.map((i) => i.message) ?? [];
}

describe("createCategorySchema", () => {
	it("aceita uma categoria válida", () => {
		expect(createCategorySchema.safeParse(validCategory).success).toBe(true);
	});

	it("aceita sem descrição (opcional)", () => {
		const { description: _description, ...rest } = validCategory;
		expect(createCategorySchema.safeParse(rest).success).toBe(true);
	});

	it("aceita active false", () => {
		expect(createCategorySchema.safeParse({ ...validCategory, active: false }).success).toBe(true);
	});

	describe("campos obrigatórios", () => {
		it.each(["name", "slug", "active"])("rejeita quando falta %s", (field) => {
			const { [field]: _removed, ...rest } = validCategory as Record<string, unknown>;
			const result = createCategorySchema.safeParse(rest);

			expect(result.success).toBe(false);
			if (!result.success) {
				expect(result.error.issues.some((i) => i.path[0] === field)).toBe(true);
			}
		});

		it("rejeita objeto vazio apontando todos os obrigatórios", () => {
			const result = createCategorySchema.safeParse({});

			expect(result.success).toBe(false);
			if (!result.success) {
				const fields = result.error.issues.map((i) => i.path[0]);
				expect(fields).toEqual(expect.arrayContaining(["name", "slug", "active"]));
				expect(fields).not.toContain("description");
			}
		});
	});

	it("rejeita nome vazio com mensagem em português", () => {
		const result = createCategorySchema.safeParse({ ...validCategory, name: "" });

		expect(result.success).toBe(false);
		expect(messages(result)).toContain("Nome é obrigatório");
	});

	it("rejeita slug vazio com mensagem em português", () => {
		const result = createCategorySchema.safeParse({ ...validCategory, slug: "" });

		expect(result.success).toBe(false);
		expect(messages(result)).toContain("Slug é obrigatório");
	});

	it("rejeita tipos errados", () => {
		expect(createCategorySchema.safeParse({ ...validCategory, name: 123 }).success).toBe(false);
		expect(createCategorySchema.safeParse({ ...validCategory, active: "true" }).success).toBe(false);
		expect(createCategorySchema.safeParse({ ...validCategory, description: 5 }).success).toBe(false);
	});
});

describe("updateCategorySchema", () => {
	it("aceita objeto vazio (todos os campos são opcionais)", () => {
		expect(updateCategorySchema.safeParse({}).success).toBe(true);
	});

	it("aceita atualização parcial", () => {
		expect(updateCategorySchema.safeParse({ active: false }).success).toBe(true);
		expect(updateCategorySchema.safeParse({ description: "Nova" }).success).toBe(true);
	});

	it("continua validando os campos enviados", () => {
		expect(updateCategorySchema.safeParse({ name: "" }).success).toBe(false);
		expect(updateCategorySchema.safeParse({ slug: "" }).success).toBe(false);
		expect(updateCategorySchema.safeParse({ active: "sim" }).success).toBe(false);
	});
});

describe("categoryFiltersSchema", () => {
	it("aceita query vazia", () => {
		expect(categoryFiltersSchema.parse({})).toEqual({});
	});

	it("converte strings da query para número", () => {
		expect(categoryFiltersSchema.parse({ page: "2", limit: "20", search: "cam" })).toEqual({
			page: 2,
			limit: 20,
			search: "cam",
		});
	});

	it("rejeita página e limite menores que 1", () => {
		expect(categoryFiltersSchema.safeParse({ page: "0" }).success).toBe(false);
		expect(categoryFiltersSchema.safeParse({ limit: "0" }).success).toBe(false);
	});

	it("rejeita valores não numéricos", () => {
		expect(categoryFiltersSchema.safeParse({ page: "abc" }).success).toBe(false);
	});
});
