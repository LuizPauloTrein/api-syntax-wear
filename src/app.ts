// Require the framework and instantiate it

// ESM
import Fastify, { FastifyError } from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes.js";
import categoryRoutes from "./routes/categories.routes.js";
import orderRoutes from "./routes/orders.routes.js";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import adminCategoryRoutes from "./routes/adminCategories.routes.js";
import adminProductRoutes from "./routes/admin-products.routes (1).js";

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

// Tokens expiram (padrão: 1 hora). Aceita "15m", "1h", "7d" etc.
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN ?? "1h";

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
      ? []
      : ["http://localhost:5173", "http://localhost:3000"];

const fastify = Fastify({
  logger: true,
});

if (isProduction && allowedOrigins.length === 0) {
  fastify.log.warn(
    "CORS_ORIGINS não definido em produção: nenhuma origem de navegador está autorizada",
  );
}

fastify.register(jwt, {
  secret: JWT_SECRET,
  sign: { expiresIn: JWT_EXPIRES_IN },
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
fastify.listen({ port: PORT }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});

export default fastify;
