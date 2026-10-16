import { FastifyReply, FastifyRequest } from "fastify";
import { CreateProduct, ProductFilters } from "../types/index.js";
import {
  getProducts,
  getProductById,
  createProduct,
} from "../services/products.service.js";
import {
  createProductSchema,
  productFiltersSchema,
} from "../utils/validators.js";
import slugify from "slugify";

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

export const createNewProduct = async (
  request: FastifyRequest<{ Body: CreateProduct }>,
  reply: FastifyReply,
) => {
  const body = request.body;

  body.slug = slugify(body.name, {
    lower: true,
    strict: true,
    locale: "pt",
  });

  const validate = createProductSchema.parse(body);
  await createProduct(validate);

  reply.status(201).send({ message: "Produto criado com sucesso" });
};
