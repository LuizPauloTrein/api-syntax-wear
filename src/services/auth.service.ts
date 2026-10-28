import bcrypt from "bcrypt";
import { Prisma } from "../generated/prisma/client.js";
import { ConflictError, UnauthorizedError } from "../errors/app-error.js";
import { AuthRequest, RegisterData } from "../types/index.js";
import { prisma } from "../utils/prisma.js";

const BCRYPT_ROUNDS = 10;

// Hash usado quando o e-mail não existe: o login gasta o mesmo tempo de bcrypt
// nos dois casos, então o tempo de resposta não revela quais e-mails existem.
const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", BCRYPT_ROUNDS);

export class EmailAlreadyRegisteredError extends ConflictError {
  constructor() {
    super("Não foi possível concluir o cadastro: e-mail ou CPF já cadastrado");
    this.name = "EmailAlreadyRegisteredError";
  }
}

export class InvalidCredentialsError extends UnauthorizedError {
  constructor() {
    super("Email ou senha inválidos");
    this.name = "InvalidCredentialsError";
  }
}

export const registerUser = async (payload: RegisterData) => {
  const existingUser = await prisma.user.findUnique({
    where: { email: payload.email },
  });

  if (existingUser) {
    throw new EmailAlreadyRegisteredError();
  }

  const hashedPassword = await bcrypt.hash(payload.password, BCRYPT_ROUNDS);

  try {
    return await prisma.user.create({
      data: {
        firstName: payload.firstName,
        lastName: payload.lastName,
        email: payload.email,
        password: hashedPassword,
        cpf: payload.cpf,
        birthDate: payload.dateBirth,
        phone: payload.phone,
        role: "USER",
      },
    });
  } catch (error) {
    // E-mail ou CPF duplicado (inclusive em corrida entre duas requisições).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new EmailAlreadyRegisteredError();
    }

    throw error;
  }
};

export const loginUser = async (data: AuthRequest) => {
  const user = await prisma.user.findUnique({
    where: { email: data.email },
  });

  const isValidPassword = await bcrypt.compare(
    data.password,
    user?.password ?? DUMMY_HASH,
  );

  // Mesma mensagem e mesmo status para e-mail inexistente e senha errada.
  if (!user || !isValidPassword) {
    throw new InvalidCredentialsError();
  }

  return user;
};
