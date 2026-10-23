import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { CreateOrder, OrderFilters } from "../types/index.js";

export class OrderNotFoundError extends Error {
  constructor() {
    super("Pedido não encontrado");
    this.name = "OrderNotFoundError";
  }
}

export class OrderProductUnavailableError extends Error {
  constructor(productId: number) {
    super(`Produto ${productId} não existe ou não está disponível`);
    this.name = "OrderProductUnavailableError";
  }
}

export class OrderInvalidSizeError extends Error {
  constructor(productName: string) {
    super(`Tamanho inválido para o produto "${productName}"`);
    this.name = "OrderInvalidSizeError";
  }
}

export class OrderInsufficientStockError extends Error {
  constructor(productName: string) {
    super(`Estoque insuficiente para o produto "${productName}"`);
    this.name = "OrderInsufficientStockError";
  }
}

// Frete fixo até existir o cálculo por CEP (/shipping/calc).
const SHIPPING_COST = 0;

export const createOrder = async (userId: number, data: CreateOrder) => {
  // Agrupa itens repetidos (mesmo produto e tamanho), somando as quantidades.
  const grouped = new Map<
    string,
    { productId: number; size: string | null; quantity: number }
  >();

  for (const item of data.items) {
    const size = item.size ?? null;
    const key = `${item.productId}:${size ?? ""}`;
    const current = grouped.get(key);

    if (current) {
      current.quantity += item.quantity;
    } else {
      grouped.set(key, { productId: item.productId, size, quantity: item.quantity });
    }
  }

  // Ordem fixa por produto: pedidos concorrentes travam as linhas na mesma
  // ordem e não entram em deadlock.
  const items = [...grouped.values()].sort(
    (a, b) => a.productId - b.productId || (a.size ?? "").localeCompare(b.size ?? ""),
  );
  const productIds = [...new Set(items.map((item) => item.productId))];

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, active: true },
    });
    const byId = new Map(products.map((product) => [product.id, product]));

    let subtotal = new Prisma.Decimal(0);
    const orderItems: {
      productId: number;
      productName: string;
      price: Prisma.Decimal;
      quantity: number;
      size: string | null;
    }[] = [];

    for (const item of items) {
      const product = byId.get(item.productId);

      if (!product) {
        throw new OrderProductUnavailableError(item.productId);
      }

      const sizes = Array.isArray(product.sizes)
        ? (product.sizes as unknown[]).filter(
            (size): size is string => typeof size === "string",
          )
        : [];

      // Produto com tamanhos exige um deles; produto sem tamanhos não aceita.
      const sizeIsValid =
        sizes.length > 0
          ? item.size !== null && sizes.includes(item.size)
          : item.size === null;

      if (!sizeIsValid) {
        throw new OrderInvalidSizeError(product.name);
      }

      // Decremento atômico: só passa se ainda houver estoque suficiente.
      const reserved = await tx.product.updateMany({
        where: { id: product.id, active: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      });

      if (reserved.count === 0) {
        throw new OrderInsufficientStockError(product.name);
      }

      subtotal = subtotal.add(product.price.mul(item.quantity));

      orderItems.push({
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
      });
    }

    const shippingCost = new Prisma.Decimal(SHIPPING_COST);

    return tx.order.create({
      data: {
        userId,
        status: "PENDING",
        subtotal,
        shippingCost,
        total: subtotal.add(shippingCost),
        shippingAddress: data.shippingAddress as Prisma.InputJsonObject,
        paymentMethod: data.paymentMethod,
        items: { create: orderItems },
      },
      include: { items: true },
    });
  });
};

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