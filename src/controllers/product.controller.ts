import { FastifyReply, FastifyRequest } from "fastify";
import { CreateProduct, ProductFilters } from "../types/index.js";
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  ProductCategoryNotFoundError,
  ProductNotFoundError,
} from "../services/products.service.js";
import {
  createProductSchema,
  deleteProductSchema,
  productFiltersSchema,
  updateProductSchema,
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
  try {
    const product = await getProductById(request.params.id);
    reply.status(200).send(product);
  } catch (error) {
    if (error instanceof ProductNotFoundError) {
      reply.status(404).send({ message: error.message });
      return;
    }

    throw error;
  }
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

  try {
    await createProduct(validate);
  } catch (error) {
    if (error instanceof ProductCategoryNotFoundError) {
      reply.status(400).send({ message: error.message });
      return;
    }

    throw error;
  }

  reply.status(201).send({ message: "Produto criado com sucesso" });
};

export const updateExistingProduct = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: Partial<CreateProduct>;
  }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;
  const body = request.body;

  const validate = updateProductSchema.parse(body);

  if (validate.name) {
    validate.slug = slugify(validate.name, {
      lower: true,
      strict: true,
      locale: "pt",
    });
  }

  try {
    const product = await updateProduct(Number(id), validate);
    reply.status(200).send(product);
  } catch (error) {
    if (error instanceof ProductCategoryNotFoundError) {
      reply.status(400).send({ message: error.message });
      return;
    }

    throw error;
  }
};

export const deleteExistingProduct = async (
  request: FastifyRequest<{ Params: { id: number } }>,
  reply: FastifyReply,
) => {
  const { id } = request.params;

  const validate = deleteProductSchema.parse({ id });

  await deleteProduct(validate.id);

  reply.status(204).send();
};