import Fastify from "fastify";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import jwt from "@fastify/jwt";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import { env } from "./config/env.js";
import { rateLimits } from "./config/rate-limits.js";
import productRoutes from "./routes/products.routes.js";
import adminProductRoutes from "./routes/admin-products.routes.js";
import categoryRoutes from "./routes/categories.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import adminCategoryRoutes from "./routes/adminCategories.routes.js";

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

fastify.get("/health", async (request, reply) => {
  return {
    status: "ok",
    timeStamp: new Date().toISOString(),
  };
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

export default fastify;
