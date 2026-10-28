export interface ProductFilters{
    page?: number;
    limit?: number;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
    categoryId?: number;
    sortBy: 'price' | 'name' | 'createdAt';
    sortOrder: 'asc' | 'desc';
}

export interface CategoryFilters {
    page?: number;
    limit?: number;
    search?: string;
}

export interface CreateCategory {
    name: string;
    description?: string;
    slug: string;
    active: boolean;
}

export interface UpdateCategory {
    name?: string;
    description?: string;
    slug?: string;
    active?: boolean;
}

export interface AuthRequest {
    email: string;
    password: string;
}

export interface RegisterRequest extends AuthRequest {
    firstName: string;
    lastName: string;
    cpf?: string;
    dateOfBirth?: string;
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
    images?: string[];
    categoryId: number;
}

export interface UpdateProduct extends Partial<CreateProduct> {
    name?: string;
    description?: string;
    price?: number;
    slug?: string;
    stock?: number;
    active?: boolean;
}

// Order types
export interface OrderFilters {
    page?: number;
    limit?: number;
    status?: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    userId?: number;
    startDate?: string;
    endDate?: string;
}

export interface ShippingAddress {
    cep: string;
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    state: string;
    country: string;
}

export interface CreateOrderItem {
    productId: number;
    quantity: number;
    size?: string;
}

export interface CreateOrder {
    userId?: number;
    items: CreateOrderItem[];
    shippingAddress: ShippingAddress;
    paymentMethod: string;
}

export interface UpdateOrder {
    status?: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
    shippingAddress?: ShippingAddress;
}