export interface ProductFilters {
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  categoryId?: number;
  sortBy?: "price" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
}

export type OrderStatusValue =
  | "PENDING"
  | "PAID"
  | "SHIPPED"
  | "DELIVERED"
  | "CANCELED";

// `type` (e não `interface`) para ser atribuível ao tipo Json do Prisma,
// que exige assinatura de índice.
export type ShippingAddress = {
  cep: string;
  street: string;
  number: string;
  complement?: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
};

export type PaymentMethod = "PIX" | "CREDIT_CARD" | "BOLETO";

export interface CreateOrderItem {
  productId: number;
  quantity: number;
  size?: string;
}

export interface CreateOrder {
  items: CreateOrderItem[];
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
}

export interface OrderFilters {
  page?: number;
  limit?: number;
  status?: OrderStatusValue;
}

export interface CategoryFilters {
  page?: number;
  limit?: number;
  search?: string;
}

export interface CreateCategory {
  name: string;
  slug: string;
  description?: string;
}

export interface UpdateCategory {
  name?: string;
  slug?: string;
  description?: string | null;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends AuthRequest {
  firstName: string;
  lastName: string;
  cpf?: string;
  dateBirth?: string;
  phone?: string;
}

// Dados já validados e normalizados pelo registerSchema (data como Date, CPF e
// telefone só com dígitos).
export type RegisterData = Omit<RegisterRequest, "dateBirth"> & {
  dateBirth?: Date;
};

export interface CreateProduct {
  name: string;
  description: string;
  price: number;
  categoryId: number;
  colors?: string[];
  sizes?: string[];
  slug: string;
  stock: number;
  active: boolean;
  imgaes?: string[];
}

export interface UpdateProduct extends Partial<CreateProduct> {
  name?: string;
  description?: string;
  price?: number;
  slug?: string;
  stock?: number;
  active?: boolean;
}
