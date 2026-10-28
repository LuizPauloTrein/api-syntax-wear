import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  CreateProduct,
  ProductFilters,
  UpdateProduct,
} from "../types/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors/app-error.js";

export const getProducts = async (filter: ProductFilters) => {
  const {
    page = 1,
    limit = 10,
    minPrice,
    maxPrice,
    search,
    sortBy = "createdAt",
    sortOrder = "desc",
  } = filter;

  // Rotas públicas só enxergam produtos ativos (os inativos foram "excluídos").
  const where: Prisma.ProductWhereInput = {
    active: true,
    ...(minPrice !== undefined || maxPrice !== undefined
      ? {
          price: {
            ...(minPrice !== undefined ? { gte: minPrice } : {}),
            ...(maxPrice !== undefined ? { lte: maxPrice } : {}),
          },
        }
      : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  return prisma.product.findMany({
    where,
    orderBy: { [sortBy]: sortOrder },
    skip: (page - 1) * limit,
    take: limit,
  });
};

export class ProductNotFoundError extends NotFoundError {
  constructor() {
    super("Produto não encontrado");
    this.name = "ProductNotFoundError";
  }
}

export const getProductById = async (id: number) => {
  const product = await prisma.product.findUnique({
    where: { id, active: true },
  });

  if (!product) {
    throw new ProductNotFoundError();
  }

  return product;
};

export class ProductSlugAlreadyExistsError extends ConflictError {
  constructor() {
    super("Slug já existe, escolha outro nome para o produto");
    this.name = "ProductSlugAlreadyExistsError";
  }
}

export class ProductCategoryNotFoundError extends BadRequestError {
  constructor() {
    super("Categoria não encontrada");
    this.name = "ProductCategoryNotFoundError";
  }
}

export const createProduct = async (data: CreateProduct) => {
  const existingProduct = await prisma.product.findUnique({
    where: { slug: data.slug },
  });

  if (existingProduct) {
    throw new ProductSlugAlreadyExistsError();
  }

  const existingCategory = await prisma.category.findUnique({
    where: { id: data.categoryId, active: true },
  });

  if (!existingCategory) {
    throw new ProductCategoryNotFoundError();
  }

  const newProduct = await prisma.product.create({ data });
  return newProduct;
};

export const updateProduct = async (id: number, data: UpdateProduct) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new ProductNotFoundError();
  }

  if (data.categoryId !== undefined) {
    const existingCategory = await prisma.category.findUnique({
      where: { id: data.categoryId, active: true },
    });

    if (!existingCategory) {
      throw new ProductCategoryNotFoundError();
    }
  }

  if (data.slug) {
    const slugExists = await prisma.product.findUnique({
      where: { slug: data.slug },
    });

    if (slugExists && slugExists.id !== id) {
      throw new ProductSlugAlreadyExistsError();
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data,
    include: { category: true },
  });

  return updatedProduct;
};

export const deleteProduct = async (id: number) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new ProductNotFoundError();
  }

  await prisma.product.update({
    where: { id },
    data: { active: false },
  });
};
