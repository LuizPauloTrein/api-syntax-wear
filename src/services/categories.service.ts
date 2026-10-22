import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { CreateCategory, UpdateCategory } from "../types/index.js";

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Categoria não encontrada");
    this.name = "CategoryNotFoundError";
  }
}

export class CategorySlugAlreadyExistsError extends Error {
  constructor() {
    super("Já existe uma categoria com esse nome, escolha outro nome");
    this.name = "CategorySlugAlreadyExistsError";
  }
}

export class CategoryHasProductsError extends Error {
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

export const getCategories = async () => {
  return prisma.category.findMany({
    where: { active: true },
  });
};

export const getCategoryById = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id, active: true },
    include: {
      products: true,
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  return category;
};