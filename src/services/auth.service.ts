import { FastifyReply } from "fastify";
import { AuthRequest, RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";
import { OAuth2Client } from "google-auth-library";

export const registerUser = async (
  payload: RegisterRequest,
  reply: FastifyReply
) => {
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [{ email: payload.email }, { cpf: payload.cpf }],
    },
  });

  if (existingUser) {
    if (existingUser.email === payload.email) {
      return reply.status(409).send({ message: "E-mail já cadastrado" });
    }

    if (existingUser.cpf === payload.cpf) {
      return reply.status(409).send({ message: "CPF já cadastrado" });
    }
  }

  const hashedPassword = await bcrypt.hash(payload.password, 10);

  const newUser = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: hashedPassword,
      cpf: payload.cpf,
      birthDate: payload.birthDate ? new Date(payload.birthDate) : undefined,
      phone: payload.phone,
      role: "USER",
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      cpf: true,
      birthDate: true,
      phone: true,
      role: true,
      createdAt: true,
    },
  });

  return newUser;
};

export const loginUser = async (data: AuthRequest, reply: FastifyReply) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (!user) {
    reply.status(409).send({ message: "As credencias estão incorretas." });
    return;
  }

  const isValidPassword = await bcrypt.compare(data.password, user.password);

  if (!isValidPassword) {
    reply.status(409).send({ message: "As credencias estão incorretas." });
    return;
  }

  // Remover password antes de retornar
  const { password, ...userWithoutPassword } = user;

  return userWithoutPassword;
};

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

export const loginWithGoogle = async (
  credential: string,
  reply: FastifyReply
) => {
  const ticket = await googleClient.verifyIdToken({
    idToken: credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });

  const payload = ticket.getPayload();

  if (!payload || !payload.email) {
    // 401 Unauthorized
    reply.status(401).send({ message: "Token do Google inválido" });
    return;
  }

  const { email, given_name, family_name } = payload;

  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        firstName: given_name || "",
        lastName: family_name || "",
        email,
        password: "", // Senha vazia, pois o login é via Google
        role: "USER",
      },
    });
  }

  // Remover password antes de retornar
  const { password, ...userWithoutPassword } = user;
  return userWithoutPassword;
};
