import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "../src/generated/prisma/client.js";
import bcrypt from "bcrypt";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL não está configurada.");
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const products: Prisma.ProductCreateInput[] = [
  {
    name: "Camiseta Syntax Essential",
    slug: "camiseta-syntax-essential",
    description: "Camiseta de algodão com caimento confortável para o dia a dia.",
    price: 89.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 40,
  },
  {
    name: "Camiseta Oversized Code",
    slug: "camiseta-oversized-code",
    description: "Camiseta oversized com visual urbano e tecido macio.",
    price: 119.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 25,
  },
  {
    name: "Moletom Syntax Hoodie",
    slug: "moletom-syntax-hoodie",
    description: "Moletom com capuz, interior felpado e bolso canguru.",
    price: 249.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 18,
  },
  {
    name: "Calça Jogger Dev",
    slug: "calca-jogger-dev",
    description: "Calça jogger confortável com cós ajustável e bolsos laterais.",
    price: 189.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 22,
  },
  {
    name: "Jaqueta Windbreaker Syntax",
    slug: "jaqueta-windbreaker-syntax",
    description: "Jaqueta leve resistente ao vento, ideal para sobreposições.",
    price: 279.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 12,
  },
  {
    name: "Boné Dev Mode",
    slug: "bone-dev-mode",
    description: "Boné de aba curva com ajuste traseiro regulável.",
    price: 79.9,
    images: [],
    sizes: ["Único"],
    stock: 30,
  },
  {
    name: "Regata Minimal",
    slug: "regata-minimal",
    description: "Regata básica de algodão para compor looks leves.",
    price: 69.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 28,
  },
  {
    name: "Shorts Cargo Terminal",
    slug: "shorts-cargo-terminal",
    description: "Shorts cargo com bolsos funcionais e ajuste confortável.",
    price: 149.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 16,
  },
  {
    name: "Meia Syntax Pack",
    slug: "meia-syntax-pack",
    description: "Kit com duas meias de algodão para uso diário.",
    price: 39.9,
    images: [],
    sizes: ["Único"],
    stock: 50,
  },
  {
    name: "Moletom Crewneck Build",
    slug: "moletom-crewneck-build",
    description: "Moletom sem capuz com gola careca e acabamento canelado.",
    price: 219.9,
    images: [],
    sizes: ["P", "M", "G", "GG"],
    stock: 14,
  },
];

const demoCustomer = {
  firstName: "Cliente",
  lastName: "Demo",
  email: "cliente.demo@syntaxwear.dev",
  password: "123456",
};

const shippingAddress = {
  cep: "01001000",
  street: "Praça da Sé",
  number: "100",
  complement: "Apto 12",
  neighborhood: "Sé",
  city: "São Paulo",
  state: "SP",
  country: "BR",
};

type SeedOrder = {
  status: Prisma.OrderCreateWithoutUserInput["status"];
  paymentMethod: string;
  daysAgo: number;
  items: { slug: string; quantity: number; size?: string }[];
};

// Um pedido para cada status, para exercitar listagens, filtros e transições.
const orders: SeedOrder[] = [
  {
    status: "PENDING",
    paymentMethod: "PIX",
    daysAgo: 0,
    items: [{ slug: "camiseta-syntax-essential", quantity: 2, size: "M" }],
  },
  {
    status: "PAID",
    paymentMethod: "CREDIT_CARD",
    daysAgo: 2,
    items: [
      { slug: "moletom-syntax-hoodie", quantity: 1, size: "G" },
      { slug: "bone-dev-mode", quantity: 1, size: "Único" },
    ],
  },
  {
    status: "SHIPPED",
    paymentMethod: "CREDIT_CARD",
    daysAgo: 5,
    items: [
      { slug: "calca-jogger-dev", quantity: 1, size: "M" },
      { slug: "meia-syntax-pack", quantity: 3, size: "Único" },
    ],
  },
  {
    status: "DELIVERED",
    paymentMethod: "BOLETO",
    daysAgo: 14,
    items: [{ slug: "jaqueta-windbreaker-syntax", quantity: 1, size: "GG" }],
  },
  {
    status: "CANCELED",
    paymentMethod: "PIX",
    daysAgo: 8,
    items: [
      { slug: "shorts-cargo-terminal", quantity: 2, size: "P" },
      { slug: "regata-minimal", quantity: 1, size: "M" },
    ],
  },
];

const round2 = (value: number) => Math.round(value * 100) / 100;
const daysAgo = (days: number) => new Date(Date.now() - days * 86_400_000);

async function seedOrders() {
  const user = await prisma.user.upsert({
    where: { email: demoCustomer.email },
    create: {
      ...demoCustomer,
      password: await bcrypt.hash(demoCustomer.password, 10),
    },
    // Não sobrescreve a senha nem a role caso o usuário já exista.
    update: {},
  });

  const catalog = await prisma.product.findMany({
    where: { slug: { in: orders.flatMap((o) => o.items.map((i) => i.slug)) } },
  });
  const bySlug = new Map(catalog.map((product) => [product.slug, product]));

  // Idempotência: pedidos do cliente demo são recriados a cada execução
  // (os itens saem junto, por cascade). Pedidos de outros usuários não são tocados.
  const removed = await prisma.order.deleteMany({ where: { userId: user.id } });

  for (const order of orders) {
    const items = order.items.map((item) => {
      const product = bySlug.get(item.slug);

      if (!product) {
        throw new Error(`Produto do seed não encontrado: ${item.slug}`);
      }

      return {
        productId: product.id,
        productName: product.name,
        price: product.price,
        quantity: item.quantity,
        size: item.size,
      };
    });

    const subtotal = round2(
      items.reduce((sum, item) => sum + Number(item.price) * item.quantity, 0),
    );
    const shippingCost = 0;
    const createdAt = daysAgo(order.daysAgo);

    await prisma.order.create({
      data: {
        userId: user.id,
        status: order.status,
        subtotal,
        shippingCost,
        total: round2(subtotal + shippingCost),
        shippingAddress,
        paymentMethod: order.paymentMethod,
        createdAt,
        canceledAt: order.status === "CANCELED" ? createdAt : null,
        items: { create: items },
      },
    });
  }

  console.log(
    `${orders.length} pedidos criados para ${user.email} (${removed.count} anteriores removidos).`,
  );
}

async function main() {
  await prisma.$transaction(
    products.map((data) =>
      prisma.product.upsert({
        where: { slug: data.slug },
        create: data,
        update: data,
      }),
    ),
  );

  console.log(`${products.length} produtos inseridos ou atualizados.`);

  await seedOrders();
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao popular o banco:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });