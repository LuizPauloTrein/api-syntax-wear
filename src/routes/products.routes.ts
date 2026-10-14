import { FastifyInstance } from "fastify";
import { listProducts } from "../controllers/product.controller.js";

export default async function productRoutes(fastify: FastifyInstance) {
  fastify.get("/", listProducts);
}
