import { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import z, { ZodError } from "zod";

export const errorHandler = (
  error: FastifyError,
  request: FastifyRequest,
  reply: FastifyReply,
) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({
      message: "Erro de validacao",
      errors: z.treeifyError(error),
    });
  }

  if (error.code === "FST_ERR_VALIDATION") {
    return reply.status(400).send({
      message: "Erro de validacao (fastify)",
      errors: error.validation,
    });
  }

  // Erros 4xx gerados pelo próprio Fastify (JSON malformado, tipo de conteúdo
  // não suportado, corpo grande demais...) mantêm o status original em vez de
  // virarem 500.
  const statusCode = error.statusCode;

  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return reply.status(statusCode).send({ message: error.message });
  }

  // O detalhe fica só no log (com o ID da requisição); quem chama recebe uma
  // mensagem genérica e o requestId para o suporte localizar o erro no log.
  request.log.error({ err: error }, "Erro não tratado");

  const body: { message: string; requestId: string; debug?: string } = {
    message: "Erro interno do servidor",
    requestId: request.id,
  };

  // A mensagem interna só aparece fora de produção, para facilitar o debug.
  if (process.env.NODE_ENV !== "production") {
    body.debug = error.message;
  }

  return reply.status(500).send(body);
};