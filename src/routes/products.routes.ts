import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/product.controller.js";
import { authenticate } from "../middlewares/auth.middleware.js";

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.addHook("onRequest", authenticate);

  fastify.get("/", listProducts);
}
