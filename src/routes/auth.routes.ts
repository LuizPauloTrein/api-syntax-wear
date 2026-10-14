import { FastifyInstance } from "fastify";
import { register } from "../controllers/auth.controller.js";

export default async function authRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/",
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
              format: "email",
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
              format: "date",
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
