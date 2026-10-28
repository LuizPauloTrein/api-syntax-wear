// Limites por IP. Estouro responde 429 com o cabeçalho Retry-After.
export const rateLimits = {
  // Todas as rotas, como teto geral contra varredura e abuso.
  global: { max: 100, timeWindow: "1 minute" },
  // Anti força bruta de senha.
  login: { max: 10, timeWindow: "15 minutes" },
  // Anti criação em massa de contas.
  register: { max: 5, timeWindow: "1 hour" },
  // Criação de pedidos baixa estoque: evita esgotar o catálogo em loop.
  createOrder: { max: 20, timeWindow: "1 minute" },
} as const;
