import { FastifyInstance } from "fastify";
import { register, login } from "../controllers/auth.controller";

export default async function authRoutes(fastify: FastifyInstance) {
	fastify.post(
		"/register",
		{
			schema: {
				tags: ["Auth"],
				description: "Registra um novo usuário e retorna um token JWT",
				body: {
					type: "object",
					required: ["email", "password", "firstName", "lastName"],
					properties: {
						firstName: { type: "string", description: "João" },
						email: { type: "string", description: "Email do usuário" },
						lastName: { type: "string", description: "Sobrenome do usuário" },
						password: { type: "string", description: "Senha do usuário" },
						cpf: { type: "string", description: "CPF do usuário (somente números)" },
						birthDate: { type: "string", description: "Data de nascimento do usuário (YYYY-MM-DD)" },
						phone: { type: "string", description: "Telefone do usuário (com DDD, somente números)" },
					},
				},
			},
		},
		register
	);

	fastify.post(
		"/login",
		{
			schema: {
				tags: ["Auth"],
				description: "Autentica um usuário e retorna um token JWT",
				body: {
					type: "object",
					required: ["email", "password"],
					properties: {
						email: { type: "string", description: "Email do usuário" },
						password: { type: "string", description: "Senha do usuário" },
					},
				},
			},
		},
		login
	);
}
