import { FastifyReply, FastifyRequest } from "fastify";
import {
  createOrder,
  deleteOrder,
  getOrderById,
  getOrders,
} from "../services/orders.service.js";
import { CreateOrder, OrderFilters } from "../types/index.js";
import {
  createOrderSchema,
  orderFiltersSchema,
  orderIdSchema,
} from "../utils/validators.js";

const getUserId = (request: FastifyRequest) =>
  (request.user as { userId: number }).userId;

export const createNewOrder = async (
  request: FastifyRequest<{ Body: CreateOrder }>,
  reply: FastifyReply,
) => {
  const data = createOrderSchema.parse(request.body);

  const order = await createOrder(getUserId(request), data);
  reply.status(201).send(order);
};

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

  const order = await getOrderById(id, getUserId(request));
  reply.status(200).send(order);
};

export const deleteExistingOrder = async (
  request: FastifyRequest<{ Params: { id: string } }>,
  reply: FastifyReply,
) => {
  const { id } = orderIdSchema.parse(request.params);

  await deleteOrder(id, getUserId(request));
  reply.status(204).send();
};
