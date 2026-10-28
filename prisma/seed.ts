import 'dotenv/config'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    name: 'Camisetas',
    slug: 'camisetas',
    description: 'Camisetas casuais e confortáveis para o dia a dia',
    active: true,
  },
  {
    name: 'Moletons',
    slug: 'moletons',
    description: 'Moletons quentes e estilosos',
    active: true,
  },
  {
    name: 'Calças',
    slug: 'calcas',
    description: 'Calças e jeans para todas as ocasiões',
    active: true,
  },
  {
    name: 'Shorts',
    slug: 'shorts',
    description: 'Shorts esportivos e casuais',
    active: true,
  },
  {
    name: 'Acessórios',
    slug: 'acessorios',
    description: 'Cintos, bonés, mochilas e mais',
    active: true,
  },
  {
    name: 'Vestidos',
    slug: 'vestidos',
    description: 'Vestidos para diversas ocasiões',
    active: true,
  },
  {
    name: 'Calçados',
    slug: 'calcados',
    description: 'Tênis, sapatos e sandálias',
    active: true,
  },
  {
    name: 'Meias',
    slug: 'meias',
    description: 'Meias confortáveis em diversos estilos',
    active: true,
  },
]

const products = [
  {
    name: 'Classic Tee',
    slug: 'classic-tee',
    description: 'Camiseta clássica, confortável e versátil.',
    price: '29.99',
    colors: ['Black', 'White'],
    images: ['https://placehold.co/600x400?text=classic-tee+1', 'https://placehold.co/600x400?text=classic-tee+2'],
    sizes: ['S', 'M', 'L'],
    stock: 120,
    active: true,
  },
  {
    name: 'Vintage Hoodie',
    slug: 'vintage-hoodie',
    description: 'Moletom estilo vintage com caimento oversized.',
    price: '59.90',
    colors: ['Gray', 'Navy'],
    images: ['https://placehold.co/600x400?text=vintage-hoodie+1'],
    sizes: ['M', 'L', 'XL'],
    stock: 60,
    active: true,
  },
  {
    name: 'Slim Jeans',
    slug: 'slim-jeans',
    description: 'Jeans slim fit, tecido stretch para maior conforto.',
    price: '79.50',
    colors: ['Blue'],
    images: ['https://placehold.co/600x400?text=slim-jeans+1'],
    sizes: ['30', '32', '34', '36'],
    stock: 40,
    active: true,
  },
  {
    name: 'Sport Shorts',
    slug: 'sport-shorts',
    description: 'Shorts esportivo, ideal para treinos.',
    price: '24.00',
    colors: ['Black', 'Green'],
    images: ['https://placehold.co/600x400?text=sport-shorts+1'],
    sizes: ['S', 'M', 'L'],
    stock: 200,
    active: true,
  },
  {
    name: 'Leather Belt',
    slug: 'leather-belt',
    description: 'Cinto de couro legítimo com fivela metálica.',
    price: '19.99',
    colors: ['Brown', 'Black'],
    images: ['https://placehold.co/600x400?text=leather-belt+1'],
    sizes: ['M', 'L'],
    stock: 80,
    active: true,
  },
  {
    name: 'Summer Dress',
    slug: 'summer-dress',
    description: 'Vestido leve para dias quentes.',
    price: '49.00',
    colors: ['Yellow', 'White'],
    images: ['https://placehold.co/600x400?text=summer-dress+1'],
    sizes: ['S', 'M', 'L'],
    stock: 30,
    active: true,
  },
  {
    name: 'Running Shoes',
    slug: 'running-shoes',
    description: 'Tênis de corrida com amortecimento avançado.',
    price: '119.99',
    colors: ['Black', 'Red'],
    images: ['https://placehold.co/600x400?text=running-shoes+1'],
    sizes: ['40', '41', '42', '43'],
    stock: 75,
    active: true,
  },
  {
    name: 'Beanie Cap',
    slug: 'beanie-cap',
    description: 'Gorro em malha, estilo urbano.',
    price: '12.50',
    colors: ['Black', 'Gray'],
    images: ['https://placehold.co/600x400?text=beanie-cap+1'],
    sizes: [],
    stock: 150,
    active: true,
  },
  {
    name: 'Canvas Backpack',
    slug: 'canvas-backpack',
    description: 'Mochila de lona com múltiplos compartimentos.',
    price: '69.00',
    colors: ['Olive', 'Black'],
    images: ['https://placehold.co/600x400?text=canvas-backpack+1'],
    sizes: [],
    stock: 45,
    active: true,
  },
  {
    name: 'Striped Socks',
    slug: 'striped-socks',
    description: 'Meias listradas em algodão macio.',
    price: '6.99',
    colors: ['White', 'Blue'],
    images: ['https://placehold.co/600x400?text=striped-socks+1'],
    sizes: ['One Size'],
    stock: 300,
    active: true,
  },
]

async function main() {
  try {
    // Limpar dados existentes (em ordem devido às FKs)
    await prisma.orderItem.deleteMany({})
    await prisma.order.deleteMany({})
    await prisma.product.deleteMany({})
    await prisma.category.deleteMany({})
    await prisma.user.deleteMany({})
    console.log('🗑️  Dados antigos removidos')

    // Criar usuários
    const user1 = await prisma.user.create({
      data: {
        firstName: 'João',
        lastName: 'Silva',
        email: 'joao@example.com',
        password: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FPM0xLqc8y8eMONLr9xOhQ1lUPXIEki', // senha: password123
        cpf: '12345678901',
        phone: '11999999999',
        role: 'USER',
      },
    })

    const user2 = await prisma.user.create({
      data: {
        firstName: 'Maria',
        lastName: 'Santos',
        email: 'maria@example.com',
        password: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FPM0xLqc8y8eMONLr9xOhQ1lUPXIEki', // senha: password123
        phone: '11988888888',
        role: 'USER',
      },
    })

    const admin = await prisma.user.create({
      data: {
        firstName: 'Admin',
        lastName: 'System',
        email: 'admin@example.com',
        password: '$2b$10$K7L1OJ45/4Y2nIvhRVpCe.FPM0xLqc8y8eMONLr9xOhQ1lUPXIEki', // senha: password123
        role: 'ADMIN',
      },
    })

    console.log(`✅ 3 usuários criados (${user1.email}, ${user2.email}, ${admin.email})`)

    // Criar categorias
    const createdCategories = await prisma.category.createMany({ data: categories })
    console.log(`✅ ${createdCategories.count} categorias criadas`)

    // Buscar categorias criadas para obter IDs
    const camisetas = await prisma.category.findUnique({ where: { slug: 'camisetas' } })
    const moletons = await prisma.category.findUnique({ where: { slug: 'moletons' } })
    const calcas = await prisma.category.findUnique({ where: { slug: 'calcas' } })
    const shorts = await prisma.category.findUnique({ where: { slug: 'shorts' } })
    const acessorios = await prisma.category.findUnique({ where: { slug: 'acessorios' } })
    const vestidos = await prisma.category.findUnique({ where: { slug: 'vestidos' } })
    const calcados = await prisma.category.findUnique({ where: { slug: 'calcados' } })
    const meias = await prisma.category.findUnique({ where: { slug: 'meias' } })

    // Adicionar categoryId aos produtos
    const productsWithCategory = [
      { ...products[0], categoryId: camisetas!.id },      // Classic Tee
      { ...products[1], categoryId: moletons!.id },       // Vintage Hoodie
      { ...products[2], categoryId: calcas!.id },         // Slim Jeans
      { ...products[3], categoryId: shorts!.id },         // Sport Shorts
      { ...products[4], categoryId: acessorios!.id },     // Leather Belt
      { ...products[5], categoryId: vestidos!.id },       // Summer Dress
      { ...products[6], categoryId: calcados!.id },       // Running Shoes
      { ...products[7], categoryId: acessorios!.id },     // Beanie Cap
      { ...products[8], categoryId: acessorios!.id },     // Canvas Backpack
      { ...products[9], categoryId: meias!.id },          // Striped Socks
    ]

    // Criar produtos
    const createdProducts = await prisma.product.createMany({ data: productsWithCategory })
    console.log(`✅ ${createdProducts.count} produtos criados com categorias vinculadas`)

    // Buscar produtos criados para obter IDs
    const classicTee = await prisma.product.findUnique({ where: { slug: 'classic-tee' } })
    const vintageHoodie = await prisma.product.findUnique({ where: { slug: 'vintage-hoodie' } })
    const slimJeans = await prisma.product.findUnique({ where: { slug: 'slim-jeans' } })
    const sportShorts = await prisma.product.findUnique({ where: { slug: 'sport-shorts' } })
    const runningShoes = await prisma.product.findUnique({ where: { slug: 'running-shoes' } })
    const summerDress = await prisma.product.findUnique({ where: { slug: 'summer-dress' } })

    // Criar pedidos com OrderItems
    const order1 = await prisma.order.create({
      data: {
        userId: user1.id,
        total: 109.98, // 2x Classic Tee (29.99 cada) + 1x Sport Shorts (24.00) + frete estimado 26.00
        status: 'PAID',
        shippingAddress: {
          cep: '01310100',
          street: 'Av. Paulista',
          number: '1578',
          complement: 'Apto 101',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        },
        paymentMethod: 'credit_card',
        items: {
          create: [
            {
              productId: classicTee!.id,
              price: 29.99,
              quantity: 2,
              size: 'M',
            },
            {
              productId: sportShorts!.id,
              price: 24.00,
              quantity: 1,
              size: 'L',
            },
          ],
        },
      },
    })

    const order2 = await prisma.order.create({
      data: {
        userId: user2.id,
        total: 229.89, // 1x Vintage Hoodie (59.90) + 1x Running Shoes (119.99) + 1x Summer Dress (49.00) + frete estimado 1.00
        status: 'SHIPPED',
        shippingAddress: {
          cep: '20040020',
          street: 'Av. Rio Branco',
          number: '156',
          neighborhood: 'Centro',
          city: 'Rio de Janeiro',
          state: 'RJ',
          country: 'BR',
        },
        paymentMethod: 'pix',
        items: {
          create: [
            {
              productId: vintageHoodie!.id,
              price: 59.90,
              quantity: 1,
              size: 'L',
            },
            {
              productId: runningShoes!.id,
              price: 119.99,
              quantity: 1,
              size: '42',
            },
            {
              productId: summerDress!.id,
              price: 49.00,
              quantity: 1,
              size: 'M',
            },
          ],
        },
      },
    })

    const order3 = await prisma.order.create({
      data: {
        userId: user1.id,
        total: 79.50, // 1x Slim Jeans (79.50)
        status: 'PENDING',
        shippingAddress: {
          cep: '01310100',
          street: 'Av. Paulista',
          number: '1578',
          complement: 'Apto 101',
          neighborhood: 'Bela Vista',
          city: 'São Paulo',
          state: 'SP',
          country: 'BR',
        },
        paymentMethod: 'boleto',
        items: {
          create: [
            {
              productId: slimJeans!.id,
              price: 79.50,
              quantity: 1,
              size: '32',
            },
          ],
        },
      },
    })

    // Guest order (sem userId)
    const order4 = await prisma.order.create({
      data: {
        total: 179.97, // 3x Classic Tee (29.99 cada) + frete estimado 90.00
        status: 'DELIVERED',
        shippingAddress: {
          cep: '30130100',
          street: 'Av. Afonso Pena',
          number: '867',
          neighborhood: 'Centro',
          city: 'Belo Horizonte',
          state: 'MG',
          country: 'BR',
        },
        paymentMethod: 'credit_card',
        items: {
          create: [
            {
              productId: classicTee!.id,
              price: 29.99,
              quantity: 3,
              size: 'L',
            },
          ],
        },
      },
    })

    console.log(`✅ 4 pedidos criados (Order IDs: ${order1.id}, ${order2.id}, ${order3.id}, ${order4.id})`)
    
    console.log('🎉 Seed finalizado com sucesso!')
  } catch (error) {
    console.error('❌ Erro no seed:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
