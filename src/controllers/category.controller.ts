import { FastifyReply, FastifyRequest } from "fastify";
import slugify from "slugify";
import {
  CategoryHasProductsError,
  CategoryNotFoundError,
  CategorySlugAlreadyExistsError,
  createCategory,
  deleteCategory,
  getCategories,
  getCategoryById,
  updateCategory,
} from "../services/categories.service.js";
import { CreateCategory, UpdateCategory } from "../types/index.js";
import {
  categoryIdSchema,
  createCategorySchema,
  updateCategorySchema,
} from "../utils/validators.js";

export const deleteExistingCategory = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = categoryIdSchema.parse(request.params);

  try {
    await deleteCategory(id);
    reply.status(204).send();
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      reply.status(404).send({ message: error.message });
      return;
    }

    if (error instanceof CategoryHasProductsError) {
      reply.status(409).send({ message: error.message });
      return;
    }

    throw error;
  }
};

export const updateExistingCategory = async (
  request: FastifyRequest<{
    Params: { id: string };
    Body: Omit<UpdateCategory, "slug">;
  }>,
  reply: FastifyReply,
) => {
  const { id } = categoryIdSchema.parse(request.params);
  const { name, description } = updateCategorySchema.parse(request.body);

  let slug: string | undefined;

  if (name !== undefined) {
    slug = slugify(name, {
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
  }

  try {
    const category = await updateCategory(id, { name, slug, description });
    reply.status(200).send(category);
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      reply.status(404).send({ message: error.message });
      return;
    }

    if (error instanceof CategorySlugAlreadyExistsError) {
      reply.status(409).send({ message: error.message });
      return;
    }

    throw error;
  }
};

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