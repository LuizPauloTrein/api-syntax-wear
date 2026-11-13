// Require the framework and instantiate it

// ESM s
import Fastify, { FastifyBaseLogger, FastifyInstance, FastifyTypeProvider, RawServerDefault } from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes";
import categoryRoutes from "./routes/categories.routes";
import orderRoutes from "./routes/orders.routes";
import swagger from "@fastify/swagger";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes";
import { errorHandler } from "./middlewares/error.middleware";
import cookie from "@fastify/cookie";
import { IncomingMessage, ServerResponse } from "http";

const PORT = parseInt(process.env.PORT ?? "3000");

export async function buildApp(): Promise<FastifyInstance> {
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

  // permite manipular cookies nas requisições
  fastify.register(cookie);

  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    cookie: {
      cookieName: "syntaxwear.token",
      signed: false, // não estamos usando cookies assinados
    },
  });

  fastify.register(cors, {
    origin: true,
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

  fastify.register(scalar, {
    routePrefix: "/api-docs",
    configuration: {
      theme: "default",
    },
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

  await fastify.ready();

  return fastify;
}
function scalar(instance: FastifyInstance<RawServerDefault, IncomingMessage, ServerResponse<IncomingMessage>, FastifyBaseLogger, FastifyTypeProvider>, opts: { routePrefix: string; configuration: { theme: string; }; }, done: (err?: Error | undefined) => void): void {
  throw new Error("Function not implemented.");
}

