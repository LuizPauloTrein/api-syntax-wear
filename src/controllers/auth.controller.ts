import { FastifyReply, FastifyRequest } from "fastify";
import { loginUser, registerUser } from "../services/auth.service.js";
import { AuthRequest, RegisterRequest } from "../types/index.js";

export const register = async (
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  const user = await registerUser(request.body as RegisterRequest);

  const token = request.server.jwt.sign({ userId: user.id });

  reply.status(201).send({
    user,
    token,
  });
};

export const login = async (
  request: FastifyRequest<{ Body: AuthRequest }>,
  reply: FastifyReply,
) => {
  const user = await loginUser(request.body);

  const token = request.server.jwt.sign({ userId: user.id });

  reply.send({
    user,
    token,
  });
};
