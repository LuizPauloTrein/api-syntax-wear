import { describe, expect, it } from "vitest";
import {
	createProductSchema,
	deleteProductSchema,
	productFiltersSchema,
	updateProductSchema,
} from "../../src/utils/validators";
import { generateSlug } from "../../src/utils/slug";

const validProduct = {
	name: "Camiseta Dev",
	description: "Camiseta preta",
	price: 99.9,
	slug: "camiseta-dev",
	stock: 10,
	active: true,
	categoryId: 1,
};

describe("createProductSchema", () => {
	it("aceita um produto válido", () => {
		expect(createProductSchema.safeParse(validProduct).success).toBe(true);
	});

	it("aceita campos opcionais (colors, sizes, images)", () => {
		const result = createProductSchema.safeParse({
			...validProduct,
			colors: ["preto"],
			sizes: ["P", "M"],
			images: ["a.png"],
		});
		expect(result.success).toBe(true);
	});

	it.each(["name", "description", "price", "slug", "stock", "active", "categoryId"])(
		"rejeita quando falta %s",
		(field) => {
			const { [field]: _removed, ...rest } = validProduct as Record<string, unknown>;
			expect(createProductSchema.safeParse(rest).success).toBe(false);
		},
	);

	it("rejeita nome e descrição vazios", () => {
		expect(createProductSchema.safeParse({ ...validProduct, name: "" }).success).toBe(false);
		expect(createProductSchema.safeParse({ ...validProduct, description: "" }).success).toBe(false);
	});

	it("rejeita preço negativo e aceita zero", () => {
		expect(createProductSchema.safeParse({ ...validProduct, price: -1 }).success).toBe(false);
		expect(createProductSchema.safeParse({ ...validProduct, price: 0 }).success).toBe(true);
	});

	it("rejeita estoque negativo ou decimal", () => {
		expect(createProductSchema.safeParse({ ...validProduct, stock: -1 }).success).toBe(false);
		expect(createProductSchema.safeParse({ ...validProduct, stock: 1.5 }).success).toBe(false);
	});

	it("rejeita categoryId menor que 1 ou decimal", () => {
		expect(createProductSchema.safeParse({ ...validProduct, categoryId: 0 }).success).toBe(false);
		expect(createProductSchema.safeParse({ ...validProduct, categoryId: 1.5 }).success).toBe(false);
	});

	it("rejeita tipos errados (preço como string)", () => {
		expect(createProductSchema.safeParse({ ...validProduct, price: "99.9" }).success).toBe(false);
	});

	it("devolve a mensagem de erro em português", () => {
		const result = createProductSchema.safeParse({ ...validProduct, name: "" });
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Nome é obrigatório");
		}
	});
});

describe("updateProductSchema", () => {
	it("aceita objeto vazio (todos os campos são opcionais)", () => {
		expect(updateProductSchema.safeParse({}).success).toBe(true);
	});

	it("aceita atualização parcial", () => {
		expect(updateProductSchema.safeParse({ price: 10 }).success).toBe(true);
	});

	it("continua validando os campos enviados", () => {
		expect(updateProductSchema.safeParse({ price: -5 }).success).toBe(false);
		expect(updateProductSchema.safeParse({ name: "" }).success).toBe(false);
		expect(updateProductSchema.safeParse({ stock: 1.2 }).success).toBe(false);
		expect(updateProductSchema.safeParse({ categoryId: 0 }).success).toBe(false);
	});
});

describe("deleteProductSchema", () => {
	it("aceita id inteiro positivo", () => {
		expect(deleteProductSchema.safeParse({ id: 1 }).success).toBe(true);
	});

	it.each([0, -1, 1.5, NaN])("rejeita id %s", (id) => {
		expect(deleteProductSchema.safeParse({ id }).success).toBe(false);
	});
});

describe("productFiltersSchema", () => {
	it("aceita query vazia", () => {
		expect(productFiltersSchema.parse({})).toEqual({});
	});

	it("converte strings da query para número", () => {
		const result = productFiltersSchema.parse({
			page: "2",
			limit: "20",
			minPrice: "10.5",
			maxPrice: "99",
			categoryId: "3",
		});
		expect(result).toEqual({ page: 2, limit: 20, minPrice: 10.5, maxPrice: 99, categoryId: 3 });
	});

	it("rejeita página e limite menores que 1", () => {
		expect(productFiltersSchema.safeParse({ page: "0" }).success).toBe(false);
		expect(productFiltersSchema.safeParse({ limit: "0" }).success).toBe(false);
	});

	it("rejeita preços negativos", () => {
		expect(productFiltersSchema.safeParse({ minPrice: "-1" }).success).toBe(false);
		expect(productFiltersSchema.safeParse({ maxPrice: "-1" }).success).toBe(false);
	});

	it("rejeita valores não numéricos", () => {
		expect(productFiltersSchema.safeParse({ page: "abc" }).success).toBe(false);
	});

	it("aceita apenas campos de ordenação conhecidos", () => {
		for (const sortBy of ["price", "name", "createdAt"]) {
			expect(productFiltersSchema.safeParse({ sortBy }).success).toBe(true);
		}
		expect(productFiltersSchema.safeParse({ sortBy: "stock" }).success).toBe(false);
		expect(productFiltersSchema.safeParse({ sortOrder: "up" }).success).toBe(false);
	});
});

describe("generateSlug", () => {
	it("gera slug minúsculo, sem acentos nem caracteres especiais", () => {
		expect(generateSlug("Camiseta Dev Ação!")).toBe("camiseta-dev-acao");
	});

	it("troca espaços por hífen", () => {
		expect(generateSlug("Boné Preto Básico")).toBe("bone-preto-basico");
	});
});
