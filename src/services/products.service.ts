import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import {
  CreateProduct,
  ProductFilters,
  UpdateProduct,
} from "../types/index.js";

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

export const createProduct = async (data: CreateProduct) => {
  const existingProduct = await prisma.product.findUnique({
    where: { slug: data.slug },
  });

  if (existingProduct) {
    throw new Error("Slug ja existe, escolha outro nome para o produto");
  }

  const newProduct = await prisma.product.create({ data });
  return newProduct;
};

export const updateProduct = async (id: number, data: UpdateProduct) => {
  const existingProduct = await prisma.product.findUnique({
    where: { id },
  });

  if (!existingProduct) {
    throw new Error("Produto nao encontrado");
  }

  if (data.slug) {
    const slugExists = await prisma.product.findUnique({
      where: { slug: data.slug },
    });

    if (slugExists && slugExists.id !== id) {
      throw new Error("Slug ja existe, escolha outro nome para o produto");
    }
  }

  const updatedProduct = await prisma.product.update({
    where: { id },
    data,
  });

  return updatedProduct;
};
