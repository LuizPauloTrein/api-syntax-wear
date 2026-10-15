import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);

  fastify.get(
    "/",
    {
      schema: {
        tags: ["Products"],
        description: "Lista produtos com filtros de busca, preço e ordenação",
        querystring: {
          type: "object",
          properties: {
            page: { type: "number" },
            limit: { type: "number" },
            minPrice: { type: "number" },
            maxPrice: { type: "number" },
            search: { type: "string" },
            sortBy: { type: "string", enum: ["price", "name", "createdAt"] },
            sortOrder: { type: "string", enum: ["asc", "desc"] },
          },
        },
      },
    },
    listProducts,
  );
}
