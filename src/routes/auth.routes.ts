import { FastifyInstance } from "fastify";
import { login, register } from "../controllers/auth.controller.js";
import { AuthRequest, RegisterRequest } from "../types/index.js";
import { rateLimits } from "../config/rate-limits.js";

// Schema de resposta: o Fastify descarta qualquer campo que não esteja aqui,
// então mesmo um erro no controller não vaza senha, CPF ou telefone.
const authResponseSchema = {
  type: "object",
  properties: {
    user: {
      type: "object",
      properties: {
        id: { type: "integer" },
        firstName: { type: "string" },
        lastName: { type: "string" },
        email: { type: "string" },
        role: { type: "string", enum: ["USER", "ADMIN"] },
      },
    },
    token: { type: "string" },
  },
};

const errorBody = {
  type: "object",
  properties: { message: { type: "string" } },
};

export default async function authRoutes(fastify: FastifyInstance) {
  // Respostas de login/cadastro carregam token: nunca devem ser cacheadas.
  fastify.addHook("onSend", async (_request, reply) => {
    reply.header("Cache-Control", "no-store");
  });

  fastify.post<{ Body: AuthRequest }>(
    "/login",
    {
      config: { rateLimit: rateLimits.login },
      schema: {
        tags: ["Auth"],
        description: "Autentica um usuario e retorna um token JWT",
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              description: "Email do usuario",
            },
            password: {
              type: "string",
              description: "Senha do usuario",
            },
          },
        },
        response: {
          200: { description: "Login realizado", ...authResponseSchema },
          401: { description: "Credenciais inválidas", ...errorBody },
          429: { description: "Muitas tentativas", ...errorBody },
        },
      },
    },
    login,
  );

  fastify.post<{ Body: RegisterRequest }>(
    "/register",
    {
      config: { rateLimit: rateLimits.register },
      schema: {
        tags: ["Auth"],
        description: "Registra um novo usuario e retorna um token JWT",
        body: {
          type: "object",
          required: ["firstName", "lastName", "email", "password"],
          properties: {
            firstName: {
              type: "string",
              description: "Nome do usuario",
            },
            lastName: {
              type: "string",
              description: "Sobrenome do usuario",
            },
            email: {
              type: "string",
              description: "Email do usuario",
            },
            password: {
              type: "string",
              description: "Senha do usuario",
            },
            cpf: {
              type: "string",
              description: "CPF do usuario",
            },
            dateBirth: {
              type: "string",
              description: "Data de nascimento no formato YYYY-MM-DD",
            },
            phone: {
              type: "string",
              description: "Telefone do usuario",
            },
          },
        },
        response: {
          201: { description: "Usuário criado", ...authResponseSchema },
          409: { description: "E-mail ou CPF já cadastrado", ...errorBody },
          429: { description: "Muitas tentativas", ...errorBody },
        },
      },
    },
    register,
  );
}
