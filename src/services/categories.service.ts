import { prisma } from "../utils/prisma";
import { CategoryFilters, CreateCategory, UpdateCategory } from "../types";
import slugify from "slugify";

export const getCategories = async (filters: CategoryFilters) => {
	const { search, page = 1, limit = 10 } = filters;

	const where: any = {
		active: true,
	};

	// Filtro por busca no nome
	if (search && search.trim()) {
		where.name = {
			contains: search,
			mode: "insensitive",
		};
	}

	// Paginação
	const skip = (Number(page) - 1) * Number(limit);
	const take = Number(limit);

	try {
		// Buscar categorias com filtros
		const [categories, total] = await Promise.all([
			prisma.category.findMany({
				where,
				skip,
				take,
				orderBy: {
					name: "asc",
				},
			}),
			prisma.category.count({ where }),
		]);

		return {
			data: categories,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	} catch (error) {
		console.error("Erro ao buscar categorias:", error);
		throw error;
	}
};

export const getCategoryById = async (id: number) => {
	const category = await prisma.category.findUnique({
		where: { id },
	});

	if (!category) {
		throw new Error("Categoria não encontrada");
	}

	return category;
};

export const createCategory = async (data: CreateCategory) => {
	const existingCategory = await prisma.category.findUnique({
		where: { slug: data.slug },
	});

	if (existingCategory) {
		throw new Error("Slug já existe. Escolha outro nome para a categoria.");
	}

	const newCategory = await prisma.category.create({ data });
	return newCategory;
};

export const updateCategory = async (id: number, data: UpdateCategory) => {
	const existingCategory = await prisma.category.findUnique({
		where: { id },
	});

	if (!existingCategory) {
		throw new Error("Categoria não encontrada");
	}

	if (data.slug) {
		const slugExists = await prisma.category.findUnique({
			where: { slug: data.slug },
		});

		if (slugExists && slugExists.id !== id) {
			throw new Error("Slug já existe. Escolha outro nome para a categoria.");
		}
	}

	const updatedCategory = await prisma.category.update({
		where: { id },
		data,
	});

	return updatedCategory;
};

export const deleteCategory = async (id: number) => {
	const existingCategory = await prisma.category.findUnique({
		where: { id },
	});

	if (!existingCategory) {
		throw new Error("Categoria não encontrada");
	}

	// Cascata de soft delete: desativar todos os produtos da categoria
	await prisma.product.updateMany({
		where: { categoryId: id },
		data: { active: false },
	});

	// Desativar a categoria
	await prisma.category.update({
		where: { id },
		data: { active: false },
	});
};
