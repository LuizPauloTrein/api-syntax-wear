import { FastifyReply, FastifyRequest } from "fastify";
import {
  CategoryNotFoundError,
  getCategories,
  getCategoryById,
} from "../services/categories.service.js";
import { categoryIdSchema } from "../utils/validators.js";

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
