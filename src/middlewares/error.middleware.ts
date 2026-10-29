import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import z, { ZodError } from "zod";
import { HttpError } from "../utils/http-error";

export const errorHandler = (error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
	if (error instanceof ZodError) {
		return reply.status(400).send({
			message: "Erro de validação (zod)",
			errors: z.treeifyError(error),
		});
	}

	if (error.code === "FST_ERR_VALIDATION") {
		return reply.status(400).send({
			message: "Erro de validação (fastify)",
			errors: error.validation,
		});
	}

	// Erros de negócio lançados pelos services (404, 409, 403...).
	if (error instanceof HttpError) {
		return reply.status(error.statusCode).send({ message: error.message });
	}

	// Erros conhecidos do Prisma, sem expor detalhes do banco.
	if (error.name === "PrismaClientKnownRequestError") {
		if (error.code === "P2002") {
			return reply.status(409).send({ message: "Já existe um registro com esse valor" });
		}
		if (error.code === "P2003") {
			return reply.status(400).send({ message: "Referência inválida: o registro relacionado não existe" });
		}
		if (error.code === "P2025") {
			return reply.status(404).send({ message: "Registro não encontrado" });
		}
	}

	// Erros 4xx gerados pelo próprio Fastify (JSON malformado, corpo grande
	// demais, tipo de conteúdo não suportado...) mantêm o status original.
	if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
		return reply.status(error.statusCode).send({ message: error.message });
	}

	// O detalhe fica só no log; quem chama recebe o requestId para o suporte
	// localizar o erro. A mensagem interna só aparece fora de produção.
	request.log.error({ err: error }, "Erro não tratado");

	const body: { message: string; requestId: string; debug?: string } = {
		message: "Erro interno do servidor",
		requestId: request.id,
	};

	if (process.env.NODE_ENV !== "production") {
		body.debug = error.message;
	}

	return reply.status(500).send(body);
};
