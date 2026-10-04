import type {
  ContactInfo,
  ManagedUser,
  MiddlemanInfo,
  Product,
  ProductStatus,
  TopupTemplate,
  Transaction,
  TransactionStatus,
  User,
} from "@/domain/models"

export interface AuthService {
  signIn(email: string, password: string): Promise<User>
  register(input: {
    name: string
    email: string
    password: string
  }): Promise<User>
  requestPasswordReset(email: string): Promise<void>
  signOut(): Promise<void>
  getSession(): Promise<User | null>
}

export interface CatalogService {
  listProducts(query?: {
    search?: string
    tag?: string
    page?: number
    limit?: number
  }): Promise<{ items: Product[] total: number }>
  createProduct(product: Omit<Product, "id">): Promise<Product>
  updateProduct(id: string | number, updates: Partial<Product>): Promise<Product>
  deleteProduct(id: string | number): Promise<void>
  listStatuses(): Promise<ProductStatus[]>
  listTopupTemplates(): Promise<TopupTemplate[]>
}

export interface OrderService {
  createOrder(input: {
    productId: string | number
    quantity: number
    topupInfo: Record<string, string>
  }): Promise<Transaction>
  listMyOrders(query?: { page?: number limit?: number }): Promise<{
    items: Transaction[]
    total: number
  }>
  listOrders(query?: {
    search?: string
    status?: TransactionStatus
    page?: number
    limit?: number
  }): Promise<{ items: Transaction[] total: number }>
  updateOrderStatus(id: string | number, status: TransactionStatus): Promise<Transaction>
}

export interface AdminService {
  listUsers(query?: { search?: string page?: number limit?: number }): Promise<{
    items: ManagedUser[]
    total: number
  }>
  updateUser(id: string | number, updates: Partial<ManagedUser>): Promise<ManagedUser>
  getMiddlemanContent(): Promise<MiddlemanInfo>
  updateMiddlemanContent(info: MiddlemanInfo): Promise<MiddlemanInfo>
  getContactContent(): Promise<ContactInfo>
  updateContactContent(info: ContactInfo): Promise<ContactInfo>
}

export type ApiServices = {
  auth: AuthService
  catalog: CatalogService
  orders: OrderService
  admin: AdminService
}
