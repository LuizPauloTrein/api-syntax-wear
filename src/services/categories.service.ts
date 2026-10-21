import { prisma } from "../utils/prisma.js";

export class CategoryNotFoundError extends Error {
  constructor() {
    super("Categoria não encontrada");
    this.name = "CategoryNotFoundError";
  }
}

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
