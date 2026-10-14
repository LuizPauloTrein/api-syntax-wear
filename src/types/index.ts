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
  role: "USER" | "ADMIN";
}
