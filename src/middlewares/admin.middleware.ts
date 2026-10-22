import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../utils/prisma.js";

// Deve rodar depois de `authenticate`: o JWT só carrega { userId }, então a
// role é consultada no banco a cada requisição administrativa.
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (reply.sent) {
    return;
  }

  const { userId } = request.user as { userId?: number };

  const user =
    typeof userId === "number"
      ? await prisma.user.findUnique({
          where: { id: userId },
          select: { role: true },
        })
      : null;

  if (!user || user.role !== "ADMIN") {
    reply.status(403).send({ message: "Acesso restrito a administradores" });
  }
};