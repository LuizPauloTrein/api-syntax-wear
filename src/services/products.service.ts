import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { ProductFilters } from "../types/index.js";

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

  const where: Prisma.ProductWhereInput = {
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

export const getProductById = async (id: number) => {
  const product = await prisma.product.findUnique({
    where: { id },
  });

  if (!product) {
    throw new Error("Produto não encontrado");
  }

  return product;
};
