import { AuthRequest, RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";
import { HttpError } from "../utils/http-error";

// Hash usado quando o e-mail não existe: o login gasta o mesmo tempo de bcrypt
// nos dois casos, então o tempo de resposta não revela quais e-mails existem.
const DUMMY_HASH = bcrypt.hashSync("senha-inexistente", 10);

const EMAIL_OR_CPF_TAKEN = "Não foi possível concluir o cadastro: e-mail ou CPF já cadastrado.";

export const registerUser = async (payload: RegisterRequest) => {

	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email },
	});

	if (existingUser) {
		throw new HttpError(409, EMAIL_OR_CPF_TAKEN);
	}

    const hashedPassword = await bcrypt.hash(payload.password, 10);

	const newUser = await prisma.user.create({
		data: {
			firstName: payload.firstName,
			lastName: payload.lastName,
			email: payload.email,
			password: hashedPassword,
			cpf: payload.cpf,
			birthDate: payload.dateOfBirth || undefined,
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

export const loginUser = async (data: AuthRequest) => {
    const user = await prisma.user.findUnique({
        where: { email: data.email },
    });

    const isValidPassword = await bcrypt.compare(data.password, user?.password ?? DUMMY_HASH);

    // Mesma mensagem e mesmo status para e-mail inexistente e senha errada.
    if(!user || !isValidPassword) {
        throw new HttpError(401, "Email ou senha inválidos.");
    }

    // Remover password antes de retornar
    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
};
