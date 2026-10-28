import { FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../utils/prisma";

export const authenticate = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
	try {
		await request.jwtVerify();
		
		// Extrair userId do token e buscar role do usuário
		const userId = (request.user as any).userId;
		
		if (!userId) {
			return reply.status(401).send({ message: "Token inválido. ID do usuário não encontrado." });
		}
		
		// Buscar role do usuário no banco
		const user = await prisma.user.findUnique({
			where: { id: userId },
			select: { role: true },
		});
		
		if (!user) {
			return reply.status(401).send({ message: "Usuário não encontrado." });
		}
		
		// Adicionar role ao request.user para uso nos controllers
		(request.user as any).role = user.role;
	} catch (err) {
		reply.status(401).send({ message: "Token inválido ou expirado" });
	}
};
