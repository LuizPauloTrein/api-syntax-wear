import { FastifyInstance } from "fastify";
import { register, login, profile, googleLogin, signOut } from "../controllers/auth.controller";
import { authenticate } from "../middlewares/auth.middleware";

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

	fastify.get("/profile", {
		preHandler: [authenticate], // Protege a rota com o middleware de autenticação
		schema: {
			tags: ["Auth"],
			description: "Retorna o perfil do usuário autenticado",
			security: [{ bearerAuth: [] }], // Indica que a rota requer autenticação
		}, 
	}, profile);

	fastify.post(
		"/google",
		{
			schema: {
				tags: ["Auth"],
				description: "Autentica um usuário via Google OAuth2 e retorna um token JWT",
				body: {
					type: "object",
					required: ["credential"],
					properties: {
						credential: { type: "string", description: "Credencial do Google" },
					},
				},
			},
		},
		googleLogin
	);

	fastify.post("/signout", {
		preHandler: [authenticate], // Protege a rota com o middleware de autenticação
		schema: {
			tags: ["Auth"],
			description: "Faz logout do usuário removendo o cookie JWT",
			security: [{ bearerAuth: [] }], // Indica que a rota requer autenticação
		}, 
	}, signOut);
}