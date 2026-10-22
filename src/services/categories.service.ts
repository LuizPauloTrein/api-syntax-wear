import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { CreateCategory } from "../types/index.js";

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

export const getCategories = async () => {
  return prisma.category.findMany();
};

export const getCategoryById = async (id: number) => {
  const category = await prisma.category.findUnique({
    where: { id },
    include: {
      products: true,
    },
  });

  if (!category) {
    throw new CategoryNotFoundError();
  }

  return category;
};