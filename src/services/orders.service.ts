import { OrderStatus, Prisma } from '@prisma/client'
import { OrderFilters, CreateOrder, UpdateOrder } from '../types'
import { prisma } from '../utils/prisma'
import { HttpError } from '../utils/http-error'

// Transições de status permitidas (só administradores mudam o status).
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING: ['PAID', 'CANCELLED'],
  PAID: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
}

// Só pedidos ainda não enviados podem ser cancelados (e o estoque volta).
const CANCELABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAID']

// Endereço só pode mudar enquanto o pedido não foi enviado.
const ADDRESS_EDITABLE_STATUSES: OrderStatus[] = ['PENDING', 'PAID']

// Só o necessário do dono do pedido (sem CPF nem telefone).
const orderUserSelect = {
  id: true,
  firstName: true,
  lastName: true,
  email: true,
} as const

const orderItemsInclude = {
  select: {
    id: true,
    productId: true,
    price: true,
    quantity: true,
    size: true,
    product: {
      select: {
        id: true,
        name: true,
        slug: true,
        images: true,
        category: { select: { id: true, name: true, slug: true } },
      },
    },
  },
} as const

const orderInclude = {
  user: { select: orderUserSelect },
  items: orderItemsInclude,
} as const

export async function getOrders(filters: OrderFilters = {}, requestingUserId: number, isAdmin: boolean) {
  const page = filters.page || 1
  const limit = filters.limit || 10
  const skip = (page - 1) * limit

  const where: Prisma.OrderWhereInput = {}

  // Se não é admin, forçar filtro por userId do usuário autenticado
  if (!isAdmin) {
    where.userId = requestingUserId
  } else if (filters.userId) {
    // Se é admin e passou userId no filtro, usar o filtro
    where.userId = filters.userId
  }

  if (filters.status) {
    where.status = filters.status
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {}
    if (filters.startDate) {
      where.createdAt.gte = new Date(filters.startDate)
    }
    if (filters.endDate) {
      where.createdAt.lte = new Date(filters.endDate)
    }
  }

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.order.count({ where }),
  ])

  return {
    data: orders,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  }
}

export async function getOrderById(id: number, requestingUserId: number, isAdmin: boolean) {
  // Filtrar por dono na própria consulta: o pedido de outro usuário responde
  // igual a um pedido inexistente, sem revelar que o ID existe.
  const order = await prisma.order.findFirst({
    where: isAdmin ? { id } : { id, userId: requestingUserId },
    include: orderInclude,
  })

  if (!order) {
    throw new HttpError(404, 'Pedido não encontrado')
  }

  return order
}

// O dono do pedido é sempre o usuário autenticado (userId vem do token, nunca
// do corpo da requisição).
export async function createOrder(userId: number, data: CreateOrder) {
  // Agrupa itens repetidos (mesmo produto e tamanho), somando as quantidades.
  const grouped = new Map<string, { productId: number; size: string | null; quantity: number }>()

  for (const item of data.items) {
    const size = item.size ?? null
    const key = `${item.productId}:${size ?? ''}`
    const current = grouped.get(key)

    if (current) {
      current.quantity += item.quantity
    } else {
      grouped.set(key, { productId: item.productId, size, quantity: item.quantity })
    }
  }

  // Ordem fixa por produto: pedidos concorrentes travam as linhas na mesma
  // ordem e não entram em deadlock.
  const items = [...grouped.values()].sort((a, b) => a.productId - b.productId || (a.size ?? '').localeCompare(b.size ?? ''))
  const productIds = [...new Set(items.map((item) => item.productId))]

  return prisma.$transaction(async (tx) => {
    const products = await tx.product.findMany({ where: { id: { in: productIds } } })
    const productMap = new Map(products.map((product) => [product.id, product]))

    let total = new Prisma.Decimal(0)
    const orderItems: { productId: number; price: Prisma.Decimal; quantity: number; size: string | null }[] = []

    for (const item of items) {
      const product = productMap.get(item.productId)

      if (!product) {
        throw new HttpError(404, `Produto ${item.productId} não encontrado`)
      }

      if (!product.active) {
        throw new HttpError(400, `Produto ${product.name} está inativo`)
      }

      // Produto com tamanhos exige um deles.
      const productSizes = Array.isArray(product.sizes) ? (product.sizes as unknown[]) : []

      if (productSizes.length > 0) {
        if (!item.size) {
          throw new HttpError(400, `Produto ${product.name} requer seleção de tamanho`)
        }
        if (!productSizes.includes(item.size)) {
          throw new HttpError(400, `Tamanho ${item.size} não disponível para ${product.name}`)
        }
      }

      // Decremento atômico: só passa se ainda houver estoque suficiente, mesmo
      // com várias compras simultâneas do mesmo produto.
      const reserved = await tx.product.updateMany({
        where: { id: product.id, active: true, stock: { gte: item.quantity } },
        data: { stock: { decrement: item.quantity } },
      })

      if (reserved.count === 0) {
        throw new HttpError(409, `Estoque insuficiente para ${product.name}`)
      }

      // Preço atual do produto como snapshot (nunca o preço enviado pelo cliente).
      total = total.add(product.price.mul(item.quantity))

      orderItems.push({
        productId: product.id,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
      })
    }

    return tx.order.create({
      data: {
        userId,
        total,
        status: 'PENDING',
        shippingAddress: data.shippingAddress as Prisma.InputJsonObject,
        paymentMethod: data.paymentMethod,
        items: { create: orderItems },
      },
    })
  })
}

// Devolve ao estoque os itens de um pedido cancelado, somando por produto e
// em ordem fixa (evita deadlock).
async function restoreStock(tx: Prisma.TransactionClient, orderId: number) {
  const items = await tx.orderItem.findMany({ where: { orderId } })
  const toRestore = new Map<number, number>()

  for (const item of items) {
    toRestore.set(item.productId, (toRestore.get(item.productId) ?? 0) + item.quantity)
  }

  for (const [productId, quantity] of [...toRestore].sort((a, b) => a[0] - b[0])) {
    await tx.product.update({
      where: { id: productId },
      data: { stock: { increment: quantity } },
    })
  }
}

export async function updateOrder(id: number, data: UpdateOrder, requestingUserId: number, isAdmin: boolean) {
  // Cliente comum não muda status (senão marcaria o próprio pedido como PAID).
  if (data.status !== undefined && !isAdmin) {
    throw new HttpError(403, 'Apenas administradores podem alterar o status do pedido')
  }

  await prisma.$transaction(async (tx) => {
    const existingOrder = await tx.order.findFirst({
      where: isAdmin ? { id } : { id, userId: requestingUserId },
    })

    if (!existingOrder) {
      throw new HttpError(404, 'Pedido não encontrado')
    }

    if (data.shippingAddress && !ADDRESS_EDITABLE_STATUSES.includes(existingOrder.status)) {
      throw new HttpError(409, 'O endereço só pode ser alterado enquanto o pedido não foi enviado')
    }

    const changesStatus = data.status !== undefined && data.status !== existingOrder.status

    if (changesStatus && !STATUS_TRANSITIONS[existingOrder.status].includes(data.status as OrderStatus)) {
      throw new HttpError(409, `Transição de status inválida: ${existingOrder.status} → ${data.status}`)
    }

    // O status atual entra no filtro: se outra requisição mudou o pedido
    // enquanto esta rodava, nada é atualizado (evita corrida e estoque
    // devolvido em dobro).
    const updated = await tx.order.updateMany({
      where: { id, status: existingOrder.status },
      data: {
        ...(changesStatus ? { status: data.status } : {}),
        ...(data.shippingAddress ? { shippingAddress: data.shippingAddress as Prisma.InputJsonObject } : {}),
      },
    })

    if (updated.count === 0) {
      throw new HttpError(409, 'O pedido foi alterado por outra requisição. Tente novamente')
    }

    if (changesStatus && data.status === 'CANCELLED') {
      await restoreStock(tx, id)
    }
  })

  return prisma.order.findUniqueOrThrow({ where: { id }, include: orderInclude })
}

export async function cancelOrder(id: number, requestingUserId: number, isAdmin: boolean) {
  await prisma.$transaction(async (tx) => {
    // A mudança de status é a própria trava: só uma chamada consegue passar de
    // PENDING/PAID para CANCELLED, então o estoque nunca é devolvido duas vezes.
    const canceled = await tx.order.updateMany({
      where: {
        id,
        ...(isAdmin ? {} : { userId: requestingUserId }),
        status: { in: CANCELABLE_STATUSES },
      },
      data: { status: 'CANCELLED' },
    })

    if (canceled.count === 0) {
      const existing = await tx.order.findFirst({
        where: isAdmin ? { id } : { id, userId: requestingUserId },
        select: { status: true },
      })

      if (!existing) {
        throw new HttpError(404, 'Pedido não encontrado')
      }

      throw new HttpError(
        409,
        existing.status === 'CANCELLED' ? 'Pedido já está cancelado' : `Pedido com status ${existing.status} não pode ser cancelado`
      )
    }

    await restoreStock(tx, id)
  })
}
