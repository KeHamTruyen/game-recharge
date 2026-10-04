import type {
  ContactInfo,
  ManagedUser,
  MiddlemanInfo,
  ProductStatus,
  Service,
  ServicePackage,
  TopupTemplate,
  Transaction,
  User,
} from "@/domain/models"
import { HttpClient } from "@/services/http-client"

type ApiEnvelope<T> = { success: true; data: T }
type ApiUser = {
  id: string
  email: string
  name: string
  role: "CUSTOMER" | "STAFF" | "ADMIN"
  status: "ACTIVE" | "BLOCKED"
}
type ApiService = Omit<Service, "id"> & { id: string; game: string }
type ApiPackage = Omit<ServicePackage, "id" | "serviceId" | "price" | "oldPrice"> & {
  id: string
  serviceId: string
  price: string | number
  oldPrice: string | number | null
}
type ApiTransaction = {
  id: string
  code: string
  userEmail: string
  packageName: string
  gameName: string
  amount: string | number
  quantity: number
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED" | "REFUNDED"
  topupInfo?: Record<string, unknown>
  topupLabels?: Record<string, unknown>
  templateName?: string
  createdAt: string
}

const client = new HttpClient(
  import.meta.env.VITE_API_URL || "http://localhost:3000/api",
)

const roleMap = { CUSTOMER: "customer", STAFF: "staff", ADMIN: "admin" } as const
const statusMap = {
  PENDING: "Chờ thanh toán",
  PROCESSING: "Đang xử lý",
  COMPLETED: "Hoàn thành",
  FAILED: "Thất bại",
  REFUNDED: "Đã hoàn tiền",
} as const

function mapUser(user: ApiUser): User {
  return { id: user.id, email: user.email, name: user.name, role: roleMap[user.role] }
}

function mapStatus(status: string): Transaction["status"] {
  return statusMap[status as keyof typeof statusMap] || "Chờ thanh toán"
}

function mapTransaction(item: ApiTransaction): Transaction {
  return {
    id: item.id,
    code: item.code,
    email: item.userEmail,
    product: item.packageName,
    game: item.gameName,
    amount: Number(item.amount),
    quantity: item.quantity,
    status: mapStatus(item.status),
    date: new Date(item.createdAt).toLocaleString("vi-VN"),
    topupInfo: Object.fromEntries(
      Object.entries(item.topupInfo || {}).map(([key, value]) => [key, String(value)]),
    ),
    topupLabels: Object.fromEntries(
      Object.entries(item.topupLabels || {}).map(([key, value]) => [key, String(value)]),
    ),
    templateName: item.templateName,
  }
}

function mapPackage(item: ApiPackage): ServicePackage {
  return {
    ...item,
    price: Number(item.price),
    oldPrice: item.oldPrice === null ? 0 : Number(item.oldPrice),
  }
}

function mapTemplate(item: Record<string, unknown>): TopupTemplate {
  const rawFields = Array.isArray(item.fields) ? item.fields : []
  return {
    id: String(item.id),
    name: String(item.name),
    game: String(item.game),
    description: String(item.description || ""),
    warning: String(item.warning || ""),
    fields: rawFields.map((field) => {
      const value = field as Record<string, unknown>
      return {
        id: String(value.id || value.key),
        key: String(value.key),
        label: String(value.label || value.key),
        type: (value.type as TopupTemplate["fields"][number]["type"]) || "text",
        required: Boolean(value.required),
        placeholder: String(value.placeholder || ""),
        helpText: String(value.helpText || value.hint || ""),
        options: Array.isArray(value.options)
          ? value.options.map((option) =>
              typeof option === "object" && option !== null
                ? String((option as { label?: unknown }).label || "")
                : String(option),
            )
          : [],
      }
    }),
  }
}

export const api = {
  auth: {
    async login(email: string, password: string) {
      const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      })
      return mapUser(result.data.user)
    },
    async register(name: string, email: string, password: string) {
      const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      })
      return mapUser(result.data.user)
    },
    async session() {
      try {
        const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/session")
        return mapUser(result.data.user)
      } catch {
        return null
      }
    },
    async logout() {
      await client.request("/auth/logout", { method: "POST" })
    },
  },
  catalog: {
    async load() {
      const [servicesResult, templatesResult, statusesResult] = await Promise.all([
        client.request<ApiEnvelope<ApiService[]>>("/catalog/services"),
        client.request<ApiEnvelope<Record<string, unknown>[]>>("/catalog/topup-templates"),
        client.request<ApiEnvelope<ProductStatus[]>>("/catalog/product-statuses"),
      ])
      const services = servicesResult.data.map((service) => ({
        ...service,
        id: service.id,
      }))
      const packageResults = await Promise.all(
        services.map((service) =>
          client.request<ApiEnvelope<{ items: ApiPackage[] }>>(
            `/catalog/services/${service.id}/packages?limit=100`,
          ),
        ),
      )
      return {
        services,
        packages: packageResults.flatMap((result) => result.data.items.map(mapPackage)),
        templates: templatesResult.data.map(mapTemplate),
        statuses: statusesResult.data.map((status) => ({
          ...status,
          icon: "check",
          color: (status.color || "green") as ProductStatus["color"],
        })),
      }
    },
  },
  orders: {
    async create(packageId: string | number, quantity: number, topupInfo: Record<string, string>, userEmail?: string) {
      const result = await client.request<ApiEnvelope<ApiTransaction>>("/orders", {
        method: "POST",
        body: JSON.stringify({ packageId: String(packageId), quantity, topupInfo, userEmail }),
      })
      return mapTransaction(result.data)
    },
    async mine() {
      const result = await client.request<ApiEnvelope<{ items: ApiTransaction[] }>>("/orders/mine?limit=100")
      return result.data.items.map(mapTransaction)
    },
  },
  admin: {
    async users() {
      const result = await client.request<ApiEnvelope<{ items: Array<{
        id: string
        email: string
        name: string
        role: "CUSTOMER" | "STAFF" | "ADMIN"
        status: "ACTIVE" | "BLOCKED"
        totalSpent: string | number
        createdAt: string
      }> }>>("/admin/users?limit=100")
      return result.data.items.map((item) => ({
        id: item.id,
        email: item.email,
        name: item.name,
        role: roleMap[item.role],
        status: item.status === "ACTIVE" ? "active" as const : "blocked" as const,
        joined: new Date(item.createdAt).toLocaleDateString("vi-VN"),
        totalSpent: Number(item.totalSpent),
      }))
    },
    async transactions() {
      const result = await client.request<ApiEnvelope<{ items: ApiTransaction[] }>>("/admin/transactions?limit=100")
      return result.data.items.map(mapTransaction)
    },
    async updateUser(id: string | number, updates: Partial<ManagedUser>) {
    const result = await client.request<ApiEnvelope<{
      id: string
      email: string
      name: string
      role: "CUSTOMER" | "STAFF" | "ADMIN"
      status: "ACTIVE" | "BLOCKED"
      totalSpent: string | number
      createdAt: string
    }>>(`/admin/users/${String(id)}`, {
      method: "PATCH",
      body: JSON.stringify({
        name: updates.name,
        role: updates.role?.toUpperCase(),
        status: updates.status?.toUpperCase(),
      }),
    })
    const item = result.data
    return {
      id: item.id,
      email: item.email,
      name: item.name,
      role: roleMap[item.role],
      status: item.status === "ACTIVE" ? "active" as const : "blocked" as const,
      joined: new Date(item.createdAt).toLocaleDateString("vi-VN"),
      totalSpent: Number(item.totalSpent),
    }
  },
    async updateTransaction(id: string | number, status: Transaction["status"]) {
    const backendStatus = Object.entries(statusMap).find(([, label]) => label === status)?.[0] || "PENDING"
    const result = await client.request<ApiEnvelope<ApiTransaction>>(`/admin/transactions/${String(id)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: backendStatus }),
    })
    return mapTransaction(result.data)
  },
    },
  settings: {
    async get<T>(key: string, publicOnly = true) {
      const path = publicOnly ? `/catalog/settings/${key}` : `/admin/settings/${key}`
      const result = await client.request<ApiEnvelope<{ value: T }>>(path)
      return result.data.value
    },
  },
}

export { client }
