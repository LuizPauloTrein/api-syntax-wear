import { FastifyReply, FastifyRequest } from "fastify";
import { ProductFilters } from "../types/index.js";
import { getProducts, getProductById } from "../services/products.service.js";
import { productFiltersSchema } from "../utils/validators.js";

export const listProducts = async (
  request: FastifyRequest<{ Querystring: ProductFilters }>,
  reply: FastifyReply,
) => {
  const filters = productFiltersSchema.parse(request.query);
  const result = await getProducts(filters as ProductFilters);
  reply.status(200).send(result);
};

export const getProduct = async (
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply,
) => {
  const product = await getProductById(request.params.id);
  reply.status(200).send(product);
};
