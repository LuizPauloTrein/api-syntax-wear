import type { Prisma } from "../generated/prisma/client.js";

// O que a API expõe de um usuário. Nunca devolver a entidade do Prisma:
// ela traz o hash da senha, CPF, telefone e data de nascimento.
type UserEntity = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export const toUserResponse = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
});

type CategoryEntity = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
};

export const toCategoryResponse = (category: CategoryEntity) => ({
  id: category.id,
  name: category.name,
  slug: category.slug,
  description: category.description,
});

type ProductEntity = {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  price: Prisma.Decimal;
  images: unknown;
  sizes: unknown;
  stock: number;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  categoryId: number | null;
  category?: unknown;
};

export const toProductResponse = (product: ProductEntity) => ({
  id: product.id,
  name: product.name,
  slug: product.slug,
  description: product.description,
  price: product.price.toNumber(),
  images: product.images,
  sizes: product.sizes,
  stock: product.stock,
  active: product.active,
  createdAt: product.createdAt,
  updatedAt: product.updatedAt,
  categoryId: product.categoryId,
  ...(product.category !== undefined ? { category: product.category } : {}),
});

type OrderEntity = {
  id: number;
  userId: number;
  status: string;
  subtotal: Prisma.Decimal;
  shippingCost: Prisma.Decimal;
  total: Prisma.Decimal;
  shippingAddress: unknown;
  paymentMethod: string;
  createdAt: Date;
  updatedAt: Date;
  canceledAt: Date | null;
  items: {
    id: number;
    orderId: number;
    productId: number;
    productName: string;
    price: Prisma.Decimal;
    quantity: number;
    size: string | null;
  }[];
};

export const toOrderResponse = (order: OrderEntity) => ({
  id: order.id,
  userId: order.userId,
  status: order.status,
  subtotal: order.subtotal.toNumber(),
  shippingCost: order.shippingCost.toNumber(),
  total: order.total.toNumber(),
  shippingAddress: order.shippingAddress,
  paymentMethod: order.paymentMethod,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  canceledAt: order.canceledAt,
  items: order.items.map((item) => ({
    id: item.id,
    orderId: item.orderId,
    productId: item.productId,
    productName: item.productName,
    price: item.price.toNumber(),
    quantity: item.quantity,
    size: item.size,
  })),
});
