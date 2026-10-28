import { AuthRequest, RegisterRequest } from "../types";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";

export const registerUser = async (payload: RegisterRequest) => {

	const existingUser = await prisma.user.findUnique({
		where: { email: payload.email },
	});

	if (existingUser) {
		throw new Error("Email já cadastrado.");
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

    if(!user) {
        throw new Error("Usuário não encontrado.");
    }

    const isValidPassword = await bcrypt.compare(data.password, user.password);

    if(!isValidPassword) {
        throw new Error("Senha inválida.");
    }

    // Remover password antes de retornar
    const { password, ...userWithoutPassword } = user;

    return userWithoutPassword;
};
