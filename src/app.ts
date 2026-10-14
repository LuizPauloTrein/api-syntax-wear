// Require the framework and instantiate it

// ESM
import Fastify from "fastify";
import "dotenv/config";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import productRoutes from "./routes/products.routes.js";
import swagger from "@fastify/swagger";
import scalar from "@scalar/fastify-api-reference";

const PORT = parseInt(process.env.PORT ?? "3000");

const fastify = Fastify({
  logger: true,
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
        url: `https://localhost:${PORT}`,
        description: "Servidor de desenvolvimento",
      },
    ],
    components: {
      securitySchemes: {
        betterAuth: {
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
    theme: "default"
  }
})

fastify.register(productRoutes, { prefix: "/products" });

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

// Run the server!
fastify.listen({ port: PORT }, function (err, address) {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  // Server is now listening on ${address}
});

export default fastify;
