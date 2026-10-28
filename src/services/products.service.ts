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
import { buildPage } from "../utils/pagination.js";

// Só as colunas que a API devolve (nada de SELECT * nas listagens).
const productSelect = {
  id: true,
  name: true,
  slug: true,
  description: true,
  price: true,
  images: true,
  sizes: true,
  stock: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  categoryId: true,
} as const;

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

  const [total, products] = await prisma.$transaction([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      select: productSelect,
      orderBy: { [sortBy]: sortOrder },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return buildPage(products, total, page, limit);
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
    select: productSelect,
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
  const existingCategory = await prisma.category.findUnique({
    where: { id: data.categoryId, active: true },
    select: { id: true },
  });

  if (!existingCategory) {
    throw new ProductCategoryNotFoundError();
  }

  // A constraint única do slug decide (sem consulta extra e sem corrida).
  try {
    return await prisma.product.create({ data, select: productSelect });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProductSlugAlreadyExistsError();
    }

    throw error;
  }
};

const isUniqueViolation = (error: unknown) =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

export const updateProduct = async (id: number, data: UpdateProduct) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
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

  try {
    return await prisma.product.update({
      where: { id },
      data,
      include: { category: true },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw new ProductSlugAlreadyExistsError();
    }

    throw error;
  }
};

export const deleteProduct = async (id: number) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingProduct) {
    throw new ProductNotFoundError();
  }

  await prisma.product.update({
    where: { id },
    data: { active: false },
  });
};
