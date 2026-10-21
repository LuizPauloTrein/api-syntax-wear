import z, { optional } from "zod";

export const loginSchema = z.object({
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
});

export const registerSchema = z.object({
  firstName: z.string().min(1, "Nome é obrigatório"),
  lastName: z.string().min(1, "Sobrenome é obrigatório"),
  email: z.email("Email inválido"),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  cpf: z.string().optional(),
  dateBirth: z.iso.date("Data de nascimento inválida").optional(),
  phone: z.string().optional(),
});

export const productFiltersSchema = z
  .object({
    page: z.coerce
      .number()
      .int()
      .positive("Página deve ser um inteiro positivo")
      .optional(),
    limit: z.coerce
      .number()
      .int()
      .positive("Limite deve ser um inteiro positivo")
      .optional(),
    minPrice: z.coerce
      .number()
      .nonnegative("Preço mínimo não pode ser negativo")
      .optional(),
    maxPrice: z.coerce
      .number()
      .nonnegative("Preço máximo não pode ser negativo")
      .optional(),
    search: z.string().optional(),
    sortBy: z.enum(["price", "name", "createdAt"]).optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  })
  .refine(
    ({ minPrice, maxPrice }) =>
      minPrice === undefined || maxPrice === undefined || minPrice <= maxPrice,
    {
      message: "Preço mínimo não pode ser maior que o preço máximo",
      path: ["maxPrice"],
    },
  );

export const categoryIdSchema = z.object({
  id: z.coerce.number().int().positive("ID de categoria inválido"),
});

export const createProductSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  description: z.string().min(1, "Descricão é obrigatória"),
  price: z.number().nonnegative("Preco deve ser positivo"),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  slug: z.string().min(1, "Slug é obrigatório"),
  stock: z.number().int().nonnegative("Estoque deve ser positivo"),
  active: z.boolean(),
  imgaes: z.array(z.string()).optional(),
  categoryId: z.number().int().min(1, "ID de categoria inválido"),
});

export const updateProductSchema = z.object({
  name: z.string().min(1, "Nome é obrigatorio").optional(),
  description: z.string().min(1, "Descricao é obrigatoria").optional(),
  price: z.number().nonnegative("Preco deve ser positivo").optional(),
  categoryId: z.number().int().min(1, "ID de categoria inválido").optional(),
  colors: z.array(z.string()).optional(),
  sizes: z.array(z.string()).optional(),
  slug: z.string().min(1, "Slug é obrigatorio").optional(),
  stock: z.number().int().nonnegative("Estoque deve ser positivo").optional(),
  active: z.boolean().optional(),
  images: z.array(z.string()).optional(),
});

export const deleteProductSchema = z.object({
  id: z.number().int().min(1, "ID invalido"),
});
