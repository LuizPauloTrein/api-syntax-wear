// Require the framework and instantiate it

// ESM
import Fastify, { FastifyError } from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes";
import categoryRoutes from "./routes/categories.routes";
import orderRoutes from "./routes/orders.routes";
import swagger from "@fastify/swagger";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes";
import z, { ZodError } from "zod";
import { errorHandler } from "./middlewares/error.middleware";

const PORT = parseInt(process.env.PORT ?? "3000");
const isProduction = process.env.NODE_ENV === "production";

// JWT: a API não sobe com segredo ausente ou curto (um segredo fraco permite
// forjar tokens, inclusive de ADMIN). Gere um com:
//   node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET || JWT_SECRET.length < 32) {
  throw new Error(
    "JWT_SECRET ausente ou curto demais: defina um segredo aleatório com pelo menos 32 caracteres no .env",
  );
}

// CORS: só as origens listadas em CORS_ORIGINS (separadas por vírgula).
// Fora de produção, sem a variável, libera apenas o front local.
const corsOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const allowedOrigins =
  corsOrigins.length > 0
    ? corsOrigins
    : isProduction
      ? false
      : ["http://localhost:5173", "http://localhost:3000"];

const fastify = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || "info",
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          // ❌ NÃO logar body, headers com Authorization
        };
      },
      res(reply) {
        return {
          statusCode: reply.statusCode,
        };
      },
    },
  },
});

fastify.register(jwt, {
  secret: JWT_SECRET,
  // Tokens expiram (padrão: 1 hora). Aceita "15m", "1h", "7d" etc.
  sign: { expiresIn: process.env.JWT_EXPIRES_IN || "1h" },
});

fastify.register(cors, {
  origin: allowedOrigins,
  credentials: true,
});

fastify.register(helmet, {
  contentSecurityPolicy: false,
});

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
        url: `http://localhost:${PORT}`,
        description: "Servidor de desenvolvimento",
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Autenticação via token JWT",
        },
      },
    },
  },
});

fastify.register(async (instance) => {
  const { default: scalar } = await import("@scalar/fastify-api-reference");
  await instance.register(scalar, {
    routePrefix: "/api-docs",
    configuration: {
      theme: "default",
    },
  });
});

fastify.register(productRoutes, { prefix: "/products" });
fastify.register(categoryRoutes, { prefix: "/categories" });
fastify.register(orderRoutes, { prefix: "/orders" });
fastify.register(authRoutes, { prefix: "/auth" });

// Declare a route
fastify.get("/", async (request, reply) => {
  return {
    message: "E-commerce Syntax Wear API",
    version: "1.0.0",
    status: "running",
  };
});

fastify.get("/health", async (request, reply) => {
  return {
    status: "ok",
    timestamp: new Date().toISOString(),
  };
});

fastify.setErrorHandler(errorHandler);

// Run the server!
fastify.listen({ port: PORT }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});

export default fastify;
