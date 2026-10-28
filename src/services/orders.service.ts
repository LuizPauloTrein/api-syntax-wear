import { prisma } from "../utils/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import { CreateOrder, OrderFilters } from "../types/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "../errors/app-error.js";
import { buildPage } from "../utils/pagination.js";

export class OrderNotFoundError extends NotFoundError {
  constructor() {
    super("Pedido não encontrado");
    this.name = "OrderNotFoundError";
  }
}

export class OrderProductUnavailableError extends BadRequestError {
  constructor(productId: number) {
    super(`Produto ${productId} não existe ou não está disponível`);
    this.name = "OrderProductUnavailableError";
  }
}

export class OrderInvalidSizeError extends BadRequestError {
  constructor(productName: string) {
    super(`Tamanho inválido para o produto "${productName}"`);
    this.name = "OrderInvalidSizeError";
  }
}

export class OrderInsufficientStockError extends ConflictError {
  constructor(productName: string) {
    super(`Estoque insuficiente para o produto "${productName}"`);
    this.name = "OrderInsufficientStockError";
  }
}

export class OrderNotCancelableError extends ConflictError {
  constructor(status: string) {
    super(
      status === "CANCELED"
        ? "Pedido já foi cancelado"
        : `Pedido com status ${status} não pode ser cancelado`,
    );
    this.name = "OrderNotCancelableError";
  }
}

// Só as colunas que a API devolve; os itens vêm ordenados e sem excesso.
const orderSelect = {
  id: true,
  userId: true,
  status: true,
  subtotal: true,
  shippingCost: true,
  total: true,
  shippingAddress: true,
  paymentMethod: true,
  createdAt: true,
  updatedAt: true,
  canceledAt: true,
  items: {
    select: {
      id: true,
      orderId: true,
      productId: true,
      productName: true,
      price: true,
      quantity: true,
      size: true,
    },
    orderBy: { id: "asc" },
  },
} as const;

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
      select: orderSelect,
    });
  });
};

export const getOrders = async (userId: number, filters: OrderFilters) => {
  const { page = 1, limit = 10, status } = filters;

  const where: Prisma.OrderWhereInput = {
    userId,
    ...(status ? { status } : {}),
  };

  const [total, orders] = await prisma.$transaction([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      select: orderSelect,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return buildPage(orders, total, page, limit);
};

export const getOrderById = async (id: number, userId: number) => {
  // Filtrar por userId na própria consulta faz o pedido de outro usuário
  // responder igual a um pedido inexistente, sem revelar que o ID existe.
  const order = await prisma.order.findFirst({
    where: { id, userId },
    select: orderSelect,
  });

  if (!order) {
    throw new OrderNotFoundError();
  }

  return order;
};

// "Excluir" um pedido é cancelá-lo (soft delete): o registro é mantido para o
// histórico e o estoque dos itens volta para os produtos.
export const deleteOrder = async (id: number, userId: number) => {
  await prisma.$transaction(async (tx) => {
    // A mudança de status é a própria trava: só uma chamada consegue passar de
    // PENDING/PAID para CANCELED, então o estoque nunca é devolvido duas vezes,
    // mesmo com duas exclusões simultâneas.
    const canceled = await tx.order.updateMany({
      where: { id, userId, status: { in: ["PENDING", "PAID"] } },
      data: { status: "CANCELED", canceledAt: new Date() },
    });

    if (canceled.count === 0) {
      const existing = await tx.order.findFirst({
        where: { id, userId },
        select: { status: true },
      });

      if (!existing) {
        throw new OrderNotFoundError();
      }

      throw new OrderNotCancelableError(existing.status);
    }

    const items = await tx.orderItem.findMany({ where: { orderId: id } });

    // Soma por produto (o mesmo produto pode aparecer em mais de um tamanho)
    // e devolve em ordem fixa, como na criação, para evitar deadlock.
    const toRestore = new Map<number, number>();

    for (const item of items) {
      toRestore.set(
        item.productId,
        (toRestore.get(item.productId) ?? 0) + item.quantity,
      );
    }

    for (const [productId, quantity] of [...toRestore].sort(
      (a, b) => a[0] - b[0],
    )) {
      await tx.product.update({
        where: { id: productId },
        data: { stock: { increment: quantity } },
      });
    }
  });
};
