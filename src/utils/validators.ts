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
      .max(100, "Limite máximo é 100")
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

export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Nome é obrigatório"),
  description: z.string().trim().min(1, "Descrição inválida").optional(),
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, "Nome é obrigatório").optional(),
    description: z
      .string()
      .trim()
      .min(1, "Descrição inválida")
      .nullable()
      .optional(),
  })
  .refine(
    ({ name, description }) => name !== undefined || description !== undefined,
    { message: "Informe ao menos um campo para atualizar" },
  );

// O preço não faz parte do payload: o servidor sempre usa o preço do banco.
export const createOrderSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive("ID de produto inválido"),
        quantity: z
          .number()
          .int("Quantidade deve ser um inteiro")
          .min(1, "Quantidade deve ser no mínimo 1")
          .max(99, "Quantidade máxima por item é 99"),
        size: z.string().trim().min(1, "Tamanho inválido").optional(),
      }),
    )
    .min(1, "O pedido deve ter ao menos um item"),
  shippingAddress: z.object({
    cep: z.string().regex(/^\d{8}$/, "CEP deve ter 8 dígitos numéricos"),
    street: z.string().trim().min(1, "Rua é obrigatória"),
    number: z.string().trim().min(1, "Número é obrigatório"),
    complement: z.string().trim().min(1).optional(),
    neighborhood: z.string().trim().min(1, "Bairro é obrigatório"),
    city: z.string().trim().min(1, "Cidade é obrigatória"),
    state: z.string().trim().min(1, "Estado é obrigatório"),
    country: z.string().trim().min(1, "País é obrigatório"),
  }),
  paymentMethod: z.enum(["PIX", "CREDIT_CARD", "BOLETO"]),
});

export const orderIdSchema = z.object({
  id: z.coerce.number().int().positive("ID de pedido inválido"),
});

export const orderFiltersSchema = z.object({
  page: z.coerce
    .number()
    .int()
    .positive("Página deve ser um inteiro positivo")
    .optional(),
  limit: z.coerce
    .number()
    .int()
    .positive("Limite deve ser um inteiro positivo")
    .max(100, "Limite máximo é 100")
    .optional(),
  status: z
    .enum(["PENDING", "PAID", "SHIPPED", "DELIVERED", "CANCELED"])
    .optional(),
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