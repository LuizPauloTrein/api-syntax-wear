import { FastifyInstance } from 'fastify'
import { listOrders, getOrder, createNewOrder, updateExistingOrder, deleteExistingOrder } from '../controllers/orders.controller'
import { authenticate } from '../middlewares/auth.middleware'

export default async function orderRoutes(fastify: FastifyInstance) {
  // Aplicar autenticação em todas as rotas de pedidos
  fastify.addHook('onRequest', authenticate)

  // GET /orders - Listar pedidos com filtros
  fastify.get(
    '/',
    {
      schema: {
        tags: ['Orders'],
        description: 'Listar pedidos com paginação e filtros',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'number', description: 'Número da página (padrão: 1)' },
            limit: { type: 'number', description: 'Limite de itens por página (padrão: 10)' },
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
              description: 'Filtrar por status do pedido',
            },
            userId: { type: 'number', description: 'Filtrar por ID do usuário' },
            startDate: { type: 'string', format: 'date-time', description: 'Data inicial (ISO 8601)' },
            endDate: { type: 'string', format: 'date-time', description: 'Data final (ISO 8601)' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    userId: { type: 'number', nullable: true },
                    total: { type: 'number' },
                    status: { type: 'string' },
                    shippingAddress: { type: 'object' },
                    paymentMethod: { type: 'string' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    user: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'number' },
                        firstName: { type: 'string' },
                        lastName: { type: 'string' },
                        email: { type: 'string' },
                      },
                    },
                    items: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          id: { type: 'number' },
                          productId: { type: 'number' },
                          price: { type: 'number' },
                          quantity: { type: 'number' },
                          size: { type: 'string', nullable: true },
                          product: {
                            type: 'object',
                            properties: {
                              id: { type: 'number' },
                              name: { type: 'string' },
                              slug: { type: 'string' },
                              images: { type: 'array', items: { type: 'string' } },
                              category: {
                                type: 'object',
                                properties: {
                                  id: { type: 'number' },
                                  name: { type: 'string' },
                                  slug: { type: 'string' },
                                },
                              },
                            },
                          },
                        },
                      },
                    },
                  },
                },
              },
              total: { type: 'number' },
              page: { type: 'number' },
              limit: { type: 'number' },
              totalPages: { type: 'number' },
            },
          },
        },
      },
    },
    listOrders
  )

  // GET /orders/:id - Obter pedido por ID
  fastify.get(
    '/:id',
    {
      schema: {
        tags: ['Orders'],
        description: 'Obter detalhes de um pedido específico',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'number', description: 'ID do pedido' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number', nullable: true },
              total: { type: 'number' },
              status: { type: 'string' },
              shippingAddress: { type: 'object' },
              paymentMethod: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
              user: {
                type: 'object',
                nullable: true,
                properties: {
                  id: { type: 'number' },
                  firstName: { type: 'string' },
                  lastName: { type: 'string' },
                  email: { type: 'string' },
                  cpf: { type: 'string', nullable: true },
                  phone: { type: 'string', nullable: true },
                },
              },
              items: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'number' },
                    productId: { type: 'number' },
                    price: { type: 'number' },
                    quantity: { type: 'number' },
                    size: { type: 'string', nullable: true },
                    createdAt: { type: 'string', format: 'date-time' },
                    product: {
                      type: 'object',
                      properties: {
                        id: { type: 'number' },
                        name: { type: 'string' },
                        description: { type: 'string' },
                        price: { type: 'number' },
                        slug: { type: 'string' },
                        stock: { type: 'number' },
                        colors: { type: 'array', items: { type: 'string' } },
                        sizes: { type: 'array', items: { type: 'string' } },
                        images: { type: 'array', items: { type: 'string' } },
                        category: {
                          type: 'object',
                          properties: {
                            id: { type: 'number' },
                            name: { type: 'string' },
                            slug: { type: 'string' },
                            description: { type: 'string', nullable: true },
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    getOrder
  )

  // POST /orders - Criar novo pedido
  fastify.post(
    '/',
    {
      schema: {
        tags: ['Orders'],
        description: 'Criar novo pedido com validação de estoque e cálculo automático de total',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          required: ['items', 'shippingAddress', 'paymentMethod'],
          properties: {
            userId: { type: 'number', description: 'ID do usuário (opcional para guest checkout)' },
            items: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                required: ['productId', 'quantity'],
                properties: {
                  productId: { type: 'number', description: 'ID do produto' },
                  quantity: { type: 'number', description: 'Quantidade' },
                  size: { type: 'string', description: 'Tamanho (obrigatório se produto tiver sizes)' },
                },
              },
            },
            shippingAddress: {
              type: 'object',
              required: ['cep', 'street', 'number', 'neighborhood', 'city', 'state'],
              properties: {
                cep: { type: 'string', description: 'CEP com 8 dígitos' },
                street: { type: 'string', description: 'Rua/Avenida' },
                number: { type: 'string', description: 'Número' },
                complement: { type: 'string', description: 'Complemento (opcional)' },
                neighborhood: { type: 'string', description: 'Bairro' },
                city: { type: 'string', description: 'Cidade' },
                state: { type: 'string', description: 'Estado (UF)' },
                country: { type: 'string', default: 'BR', description: 'País (padrão: BR)' },
              },
            },
            paymentMethod: { type: 'string', description: 'Método de pagamento (ex: credit_card, pix, boleto)' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              orderId: { type: 'number' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    createNewOrder
  )

  // PUT /orders/:id - Atualizar pedido
  fastify.put(
    '/:id',
    {
      schema: {
        tags: ['Orders'],
        description: 'Atualizar status ou endereço de entrega do pedido (não permite alterar items)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'number', description: 'ID do pedido' },
          },
        },
        body: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELLED'],
              description: 'Novo status do pedido',
            },
            shippingAddress: {
              type: 'object',
              properties: {
                cep: { type: 'string' },
                street: { type: 'string' },
                number: { type: 'string' },
                complement: { type: 'string' },
                neighborhood: { type: 'string' },
                city: { type: 'string' },
                state: { type: 'string' },
                country: { type: 'string', default: 'BR' },
              },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              userId: { type: 'number', nullable: true },
              total: { type: 'number' },
              status: { type: 'string' },
              shippingAddress: { type: 'object' },
              paymentMethod: { type: 'string' },
              createdAt: { type: 'string', format: 'date-time' },
              updatedAt: { type: 'string', format: 'date-time' },
            },
          },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    updateExistingOrder
  )

  // DELETE /orders/:id - Cancelar pedido
  fastify.delete(
    '/:id',
    {
      schema: {
        tags: ['Orders'],
        description: 'Cancelar pedido (altera status para CANCELLED sem reversão de estoque)',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'number', description: 'ID do pedido' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
        },
      },
    },
    deleteExistingOrder
  )
}
