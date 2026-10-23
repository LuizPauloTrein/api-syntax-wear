import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { OrderFilters } from "../types/index.js";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Pedido não encontrado");
    this.name = "OrderNotFoundError";
  }
}

export const getOrders = async (userId: number, filters: OrderFilters) => {
  const { page = 1, limit = 10, status } = filters;

  const where: Prisma.OrderWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };

  return prisma.order.findMany({
    where,
    include: { items: true },
    orderBy: { createdAt: "desc" },
    skip: (page - 1) * limit,
    take: limit,
  });
};

export const getOrderById = async (id: number, userId: number) => {
  // Filtrar por userId na própria consulta faz o pedido de outro usuário
  // responder igual a um pedido inexistente, sem revelar que o ID existe.
  const order = await prisma.order.findFirst({
    where: { id, userId },
    include: { items: true },
  });

  if (!order) {
    throw new OrderNotFoundError();
  }

  return order;
};