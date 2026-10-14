import { FastifyReply, FastifyRequest } from "fastify";
import { registerUser } from "../services/auth.service.js";
import { RegisterRequest } from "../types/index.js";

export const register = async ( request: FastifyRequest, reply: FastifyReply) => {
  const user = await registerUser(request.body as RegisterRequest);

  const token = request.server.jwt.sign({ userId: user.id });

  reply.status(201).send({
    user,
    token,
  });
};
