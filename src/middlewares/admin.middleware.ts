import { FastifyReply, FastifyRequest } from "fastify";
import { prisma } from "../utils/prisma.js";

// Cache curto da role: rotas administrativas deixam de consultar o banco a cada
// requisição. Rebaixar um admin vale em até ROLE_CACHE_TTL_MS.
const ROLE_CACHE_TTL_MS = 30_000;
const ROLE_CACHE_MAX_ENTRIES = 1_000;
const roleCache = new Map<number, { role: string | null; expiresAt: number }>();

export const clearRoleCache = () => roleCache.clear();

const getRole = async (userId: number) => {
  const now = Date.now();
  const cached = roleCache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.role;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });

  if (roleCache.size >= ROLE_CACHE_MAX_ENTRIES) {
    roleCache.clear();
  }

  roleCache.set(userId, {
    role: user?.role ?? null,
    expiresAt: now + ROLE_CACHE_TTL_MS,
  });

  return user?.role ?? null;
};

// Deve rodar depois de `authenticate`: o JWT só carrega { userId }, então a
// role vem do banco (com o cache curto acima).
export const requireAdmin = async (
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> => {
  if (reply.sent) {
    return;
  }

  const { userId } = request.user as { userId?: number };

  const role = typeof userId === "number" ? await getRole(userId) : null;

  if (role !== "ADMIN") {
    reply.status(403).send({ message: "Acesso restrito a administradores" });
  }
};
