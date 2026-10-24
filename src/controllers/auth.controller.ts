import { FastifyReply, FastifyRequest } from "fastify";
import { loginUser, registerUser } from "../services/auth.service.js";
import { AuthRequest, RegisterRequest } from "../types/index.js";
import { toUserResponse } from "../utils/mappers.js";
import { loginSchema, registerSchema } from "../utils/validators.js";

export const register = async (
  request: FastifyRequest<{ Body: RegisterRequest }>,
  reply: FastifyReply,
) => {
  const validation = registerSchema.parse(request.body as RegisterRequest);

  const user = await registerUser(validation);

  const token = request.server.jwt.sign({ userId: user.id });

  reply.status(201).send({
    user: toUserResponse(user),
    token,
  });
};

export const login = async (
  request: FastifyRequest<{ Body: AuthRequest }>,
  reply: FastifyReply,
) => {
  const validation = loginSchema.parse(request.body as AuthRequest);

  const user = await loginUser(validation);

  const token = request.server.jwt.sign({ userId: user.id });

  reply.status(200).send({
    user: toUserResponse(user),
    token,
  });
};
