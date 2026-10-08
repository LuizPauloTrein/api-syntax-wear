import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

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
}

main()
  .catch((error: unknown) => {
    console.error("Falha ao popular a tabela de produtos:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
