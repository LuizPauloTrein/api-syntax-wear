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
import scalar from "@scalar/fastify-api-reference";
import jwt from "@fastify/jwt";
import authRoutes from "./routes/auth.routes";
import z, { ZodError } from "zod";
import { errorHandler } from "./middlewares/error.middleware";

const PORT = parseInt(process.env.PORT ?? "3000");

const fastify = Fastify({
	logger: {
    level: process.env.LOG_LEVEL || 'info',
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
      }
    }
  }
});

fastify.register(jwt, {
  secret: process.env.JWT_SECRET!
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

// Run the server!
fastify.listen({ port: PORT }, function (err, address) {
	if (err) {
		fastify.log.error(err);
		process.exit(1);
	}
	// Server is now listening on ${address}
});

export default fastify;
