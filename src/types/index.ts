export interface ProductFilters {
  page?: number;
  limit?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: "price" | "name" | "createdAt";
  sortOrder?: "asc" | "desc";
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

export interface CreateProduct {
  name: string;
  description: string;
  price: number;
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