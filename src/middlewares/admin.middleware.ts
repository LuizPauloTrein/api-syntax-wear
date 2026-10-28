import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../utils/prisma";

export const requireAdmin = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
	try {
		// Primeiro verifica se o token JWT é válido
		await request.jwtVerify();

		// Extrai o userId do token
		const userId = (request.user as any).userId;

		if (!userId) {
			return reply.status(401).send({ message: "Token inválido. ID do usuário não encontrado." });
		}

		// Busca o usuário no banco de dados
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { id: true, role: true },
		});

		// Verifica se o usuário existe
		if (!user) {
			return reply.status(401).send({ message: "Usuário não encontrado." });
		}

		// Verifica se o usuário tem role ADMIN
		if (user.role !== "ADMIN") {
			return reply.status(403).send({ message: "Acesso negado. Requer permissão de administrador." });
		}

		// Se passou por todas as verificações, permite continuar
	} catch (err) {
		return reply.status(401).send({ message: "Token inválido ou expirado." });
	}
};
