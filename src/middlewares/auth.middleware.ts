import { FastifyReply, FastifyRequest } from "fastify";

export const authenticate = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  try {
    await request.jwtVerify();
  } catch (err) {
    reply.status(401).send({ message: "Token Invalido ou expirado" });
  }
};
