import { FastifyReply, FastifyRequest } from "fastify";
import slugify from "slugify";
import {
  CategoryNotFoundError,
  CategorySlugAlreadyExistsError,
  createCategory,
  getCategories,
  getCategoryById,
} from "../services/categories.service.js";
import { CreateCategory } from "../types/index.js";
import {
  categoryIdSchema,
  createCategorySchema,
} from "../utils/validators.js";

export const createNewCategory = async (
  request: FastifyRequest<{ Body: Omit<CreateCategory, "slug"> }>,
  reply: FastifyReply,
) => {
  const { name, description } = createCategorySchema.parse(request.body);

  const slug = slugify(name, {
    lower: true,
    strict: true,
    locale: "pt",
  });

  if (!slug) {
    reply
      .status(400)
      .send({ message: "Nome inválido: use letras ou números no nome" });
    return;
  }

  try {
    const category = await createCategory({ name, slug, description });
    reply.status(201).send(category);
  } catch (error) {
    if (error instanceof CategorySlugAlreadyExistsError) {
      reply.status(409).send({ message: error.message });
      return;
    }

    throw error;
  }
};

export const listCategories = async (
  _request: FastifyRequest,
  reply: FastifyReply,
) => {
  const categories = await getCategories();
  reply.status(200).send(categories);
};

export const getCategory = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = categoryIdSchema.parse(request.params);

  try {
    const category = await getCategoryById(id);
    reply.status(200).send(category);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      reply.status(404).send({ message: error.message });
      return;
    }

    throw error;
  }
};