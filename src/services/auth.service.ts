import { RegisterRequest } from "../types/index.js";
import { prisma } from "../utils/prisma.js";

export const registerUser = async (payload: RegisterRequest) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new Error("Email ja cadastrado");
  }

  const newUser = await prisma.user.create({
    data: {
      firstName: payload.firstName,
      lastName: payload.lastName,
      email: payload.email,
      password: payload.password,
      cpf: payload.cpf,
      birthDate: payload.dateBirth || undefined,
      phone: payload.phone,
      role: "USER",
    },
  });

  return newUser;
};
