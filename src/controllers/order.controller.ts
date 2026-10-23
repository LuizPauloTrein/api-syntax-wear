import { FastifyReply, FastifyRequest } from "fastify";

import { OrderFilters } from "../types/index.js";
import { orderFiltersSchema, orderIdSchema } from "../utils/validators.js";
import { getOrders } from "../services/orders.service.js";
import { getOrderById } from "../services/orders.service.js";
import { OrderNotFoundError } from "../services/orders.service.js";

const getUserId = (request: FastifyRequest) =>
  (request.user as { userId: number }).userId;

export const listOrders = async (
  request: FastifyRequest<{ Querystring: OrderFilters }>,
  reply: FastifyReply,
) => {
  const filters = orderFiltersSchema.parse(request.query);
  const orders = await getOrders(getUserId(request), filters);
  reply.status(200).send(orders);
};

export const getOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);

  try {
    const order = await getOrderById(id, getUserId(request));
    reply.status(200).send(order);
  } catch (error) {
    if (error instanceof OrderNotFoundError) {
      reply.status(404).send({ message: error.message });
      return;
    }

    throw error;
  }
};