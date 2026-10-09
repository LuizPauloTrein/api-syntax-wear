import { FastifyReply, FastifyRequest } from "fastify";
import { ProductFilters } from "../types";
import { getProducts } from "../services/products.service";

export const listProducts = async (
  request: FastifyRequest<{ Querystring: ProductFilters }>,
  reply: FastifyReply,
) => {
  const result = await getProducts(request.query);
  reply.send(result);
};
