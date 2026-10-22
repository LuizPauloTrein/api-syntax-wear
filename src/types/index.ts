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