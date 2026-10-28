import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  CategoryFilters,
  CreateCategory,
  UpdateCategory,
} from "../types/index.js";
import { buildPage } from "../utils/pagination.js";
import { ConflictError, NotFoundError } from "../errors/app-error.js";

export class CategoryNotFoundError extends NotFoundError {
  constructor() {
    super("Categoria não encontrada");
    this.name = "CategoryNotFoundError";
  }
}

export class CategorySlugAlreadyExistsError extends ConflictError {
  constructor() {
    super("Já existe uma categoria com esse nome, escolha outro nome");
    this.name = "CategorySlugAlreadyExistsError";
  }
}

export class CategoryHasProductsError extends ConflictError {
  constructor() {
    super(
      "Não é possível excluir a categoria: existem produtos ativos associados a ela",
    );
    this.name = "CategoryHasProductsError";
  }
}

export const createCategory = async (data: CreateCategory) => {
  const existingCategory = await prisma.category.findUnique({
    where: { slug: data.slug },
  });

  if (existingCategory) {
    throw new CategorySlugAlreadyExistsError();
  }

  try {
    return await prisma.category.create({ data });
  } catch (error) {
    // Corrida entre a checagem acima e o insert: a constraint única do slug decide.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CategorySlugAlreadyExistsError();
    }

    throw error;
  }
};

export const updateCategory = async (id: number, data: UpdateCategory) => {
  const existingCategory = await prisma.category.findUnique({
    where: { id, active: true },
  });

  if (!existingCategory) {
    throw new CategoryNotFoundError();
  }

  if (data.slug) {
    const slugOwner = await prisma.category.findUnique({
      where: { slug: data.slug },
    });

    if (slugOwner && slugOwner.id !== id) {
      throw new CategorySlugAlreadyExistsError();
    }
  }

  try {
    return await prisma.category.update({
      where: { id },
      data,
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new CategorySlugAlreadyExistsError();
    }

    throw error;
  }
};

export const deleteCategory = async (id: number) => {
  const existingCategory = await prisma.category.findUnique({
    where: { id, active: true },
  });

  if (!existingCategory) {
    throw new CategoryNotFoundError();
  }

  // Produtos já desativados (soft delete) não impedem a exclusão.
  const activeProducts = await prisma.product.count({
    where: { categoryId: id, active: true },
  });

  if (activeProducts > 0) {
    throw new CategoryHasProductsError();
  }

  await prisma.category.update({
    where: { id },
    data: { active: false },
  });
};

export const getCategories = async (filters: CategoryFilters = {}) => {
  const { page = 1, limit = 50, search } = filters;

  const where: Prisma.CategoryWhereInput = {
    active: true,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
  };

  const [total, categories] = await prisma.$transaction([
    prisma.category.count({ where }),
    prisma.category.findMany({
      where,
      orderBy: { id: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return buildPage(categories, total, page, limit);
};

export const getCategoryById = async (id: number) => {
  // A resposta não inclui produtos (eles têm rota própria), então não os lemos.
  const category = await prisma.category.findUnique({
    where: { id, active: true },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  return category;
};
