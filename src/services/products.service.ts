import { prisma } from "../utils/prisma";
import { CreateProduct, ProductFilters, UpdateProduct } from "../types";

export const getProducts = async (filter: ProductFilters) => {
	const { minPrice, maxPrice, search, categoryId, sortBy, sortOrder, page = 1, limit = 10 } = filter;

	const where: any = {};

	// Filtro por categoria
	if (categoryId) {
		where.categoryId = categoryId;
	}

	// Filtro por preço
	if (minPrice !== undefined || maxPrice !== undefined) {
		where.price = {};
		if (minPrice !== undefined) {
			where.price.gte = Number(minPrice);
		}
		if (maxPrice !== undefined) {
			where.price.lte = Number(maxPrice);
		}
	}

	// Filtro por busca (name e description)
	if (search && search.trim()) {
		where.OR = [
			{
				name: {
					contains: search,
					mode: "insensitive",
				},
			},
			{
				description: {
					contains: search,
					mode: "insensitive",
				},
			},
		];
	}

	// Paginação
	const skip = (Number(page) - 1) * Number(limit);
	const take = Number(limit);

	// Ordenação
	const orderBy: any = {};
	if (sortBy) {
		orderBy[sortBy] = sortOrder || "asc";
	}

	try {
		// Buscar produtos com filtros
		const [products, total] = await Promise.all([
			prisma.product.findMany({
				where,
				orderBy: Object.keys(orderBy).length > 0 ? orderBy : undefined,
				skip,
				take,
			}),
			prisma.product.count({ where }),
		]);

		return {
			data: products,
			total,
			page,
			limit,
			totalPages: Math.ceil(total / limit),
		};
	} catch (error) {
		console.error("Erro ao buscar produtos:", error);
		throw error;
	}
};

export const getProductById = async (id: number) => {
	const product = await prisma.product.findUnique({
		where: { id },
		include:{
			category: true,
		}
	});

	if (!product) {
		throw new Error("Produto não encontrado");
	}

	return product;
};

export const createProduct = async (data: CreateProduct) => {
	const existingProduct = await prisma.product.findUnique({
		where: { slug: data.slug },
	});

	if (existingProduct) {
		throw new Error("Slug já existe. Escolha outro nome para o produto.");
	}

	const newProduct = await prisma.product.create({ data });
	return newProduct;
};
export const updateProduct = async (id: number, data: UpdateProduct) => {
	const existingProduct = await prisma.product.findUnique({
		where: { id },
	});

	if (!existingProduct) {
		throw new Error("Produto não encontrado");
	}

	if (data.slug) {
		const slugExists = await prisma.product.findUnique({
			where: { slug: data.slug },
		});

		if (slugExists && slugExists.id !== id) {
			throw new Error("Slug já existe. Escolha outro nome para o produto.");
		}
	}

	const updatedProduct = await prisma.product.update({
		where: { id },
		data,
	});

	return updatedProduct;
};

export const deleteProduct = async (id: number) => {
	const existingProduct = await prisma.product.findUnique({
		where: { id },
	});

	if(!existingProduct) {
		throw new Error("Produto não encontrado");
	}

	await prisma.product.update({
		where: { id },
		data: { active: false },
	});
};
