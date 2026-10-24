// O que a API expõe de um usuário. Nunca devolver a entidade do Prisma:
// ela traz o hash da senha, CPF, telefone e data de nascimento.
type UserEntity = {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
};

export const toUserResponse = (user: UserEntity) => ({
  id: user.id,
  firstName: user.firstName,
  lastName: user.lastName,
  email: user.email,
  role: user.role,
});
