import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import compress from "@fastify/compress";
import underPressure from "@fastify/under-pressure";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import { env } from "./config/env.js";
import { rateLimits } from "./config/rate-limits.js";
import productRoutes from "./routes/products.routes.js";
import adminProductRoutes from "./routes/admin-products.routes.js";
import categoryRoutes from "./routes/categories.routes.js";
import adminCategoryRoutes from "./routes/admin-categories.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import { prisma } from "./utils/prisma.js";

const fastify = Fastify({
  logger: {
    level: env.logLevel,
    // Nunca registra credenciais nos logs.
    redact: ["req.headers.authorization", "req.headers.cookie"],
  },
  // Atrás de proxy, o IP real (usado no rate limit) vem do X-Forwarded-For.
  // O tipo do Fastify não lista número, mas a função abaixo equivale a "N proxies".
  trustProxy:
    typeof env.trustProxy === "number"
      ? (_address: string, hop: number) => hop < (env.trustProxy as number)
      : env.trustProxy,
  // Corpos JSON desta API são pequenos: 100 KB basta e reduz abuso.
  bodyLimit: 100 * 1024,
});

if (env.isProduction && env.corsOrigins.length === 0) {
  fastify.log.warn(
    "CORS_ORIGINS não definido em produção: nenhuma origem de navegador está autorizada",
  );
}

// Respostas JSON grandes (listagens) viajam comprimidas (gzip/brotli).
fastify.register(compress, { global: true, threshold: 1024 });

// Sob sobrecarga real (event loop travado) responde 503 em vez de enfileirar
// tudo e derrubar o processo.
fastify.register(underPressure, {
  maxEventLoopDelay: 1000,
  retryAfter: 10,
  message: "Servidor sobrecarregado, tente novamente em instantes",
});

fastify.register(rateLimit, {
  global: true,
  ...rateLimits.global,
  errorResponseBuilder: (_request, context) => ({
    statusCode: 429,
    error: "Too Many Requests",
    message: `Muitas requisições. Tente novamente em ${context.after}.`,
  }),
});

fastify.register(jwt, {
  secret: env.jwtSecret,
  sign: { expiresIn: env.jwtExpiresIn },
});

fastify.register(cors, {
  origin: env.corsOrigins,
  credentials: true,
});

fastify.register(helmet, {
  // A página de documentação precisa de scripts inline; sem ela (produção),
  // a API só devolve JSON e pode usar a política mais restrita.
  contentSecurityPolicy: env.docsEnabled
    ? false
    : { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
});

if (env.docsEnabled) {
  fastify.register(swagger, {
    openapi: {
      openapi: "3.0.0",
      info: {
        title: "Syntax Wear API",
        description: "API para o e-commerce Syntax Wear",
        version: "1.0.0",
      },
      servers: [
        {
          url: `http://localhost:${env.port}`,
          description: "Servidor de desenvolvimento",
        },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT",
            description: "Autenticacao via token JWT",
          },
        },
      },
    },
  });

  fastify.register(scalar, {
    routePrefix: "/api-docs",
    configuration: {
      theme: "default",
    },
  });
}

fastify.register(productRoutes, { prefix: "/products" });

fastify.register(adminProductRoutes, { prefix: "/admin/products" });

fastify.register(categoryRoutes, { prefix: "/categories" });

fastify.register(adminCategoryRoutes, { prefix: "/admin/categories" });

fastify.register(orderRoutes, { prefix: "/orders" });

fastify.register(authRoutes, { prefix: "/auth" });

// Declare a route
fastify.get("/", async (request, reply) => {
  return {
    message: "E-commerce Syntax Wear",
    verison: "1.0.0",
    status: "running",
  };
});

const HEALTH_DB_TIMEOUT_MS = 2_000;

// Health check para o load balancer/orquestrador: confirma que o banco responde.
// Fica fora do rate limit (o balanceador consulta sempre do mesmo IP) e não
// expõe detalhes do erro.
fastify.get(
  "/health",
  { config: { rateLimit: false } },
  async (request, reply) => {
    let timer: NodeJS.Timeout | undefined;

    try {
      await Promise.race([
        prisma.$queryRaw`SELECT 1`,
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error("timeout no banco")),
            HEALTH_DB_TIMEOUT_MS,
          );
        }),
      ]);

      return {
        status: "ok",
        database: "up",
        timeStamp: new Date().toISOString(),
      };
    } catch (error) {
      request.log.error({ err: error }, "Health check falhou");

      return reply.status(503).send({
        status: "degraded",
        database: "down",
        timeStamp: new Date().toISOString(),
      });
    } finally {
      clearTimeout(timer);
    }
  },
);

// Ao fechar o servidor (SIGTERM/SIGINT), libera as conexões com o banco.
fastify.addHook("onClose", async () => {
  await prisma.$disconnect();
});

fastify.setErrorHandler(errorHandler);

// Run the server!
fastify.listen({ port: env.port }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});

// Encerramento limpo: para de aceitar conexões, deixa as requisições em
// andamento terminarem e fecha o banco. Se passar do prazo, força a saída.
const SHUTDOWN_TIMEOUT_MS = 10_000;
let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;

  fastify.log.info({ signal }, "Encerrando o servidor");

  const forceExit = setTimeout(() => {
    fastify.log.error("Encerramento forçado: prazo esgotado");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    await fastify.close();
    process.exit(0);
  } catch (error) {
    fastify.log.error({ err: error }, "Falha ao encerrar o servidor");
    process.exit(1);
  }
};

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.once(signal, () => void shutdown(signal));
}

export default fastify;
