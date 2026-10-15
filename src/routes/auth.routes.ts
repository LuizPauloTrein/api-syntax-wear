import { FastifyInstance } from "fastify";
import { login, register } from "../controllers/auth.controller.js";
import { AuthRequest, RegisterRequest } from "../types/index.js";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: AuthRequest }>(
    "/login",
    {
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
      },
    },
    login,
  );

  fastify.post<{ Body: RegisterRequest }>(
    "/register",
    {
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
      },
    },
    register,
  );
}
