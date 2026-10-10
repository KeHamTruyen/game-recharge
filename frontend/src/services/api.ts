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
  role: "CUSTOMER" | "ADMIN"
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

export type PaymentDetails = {
  orderCode: string
  amount: number
  checkoutUrl: string
  qrCode: string
  bankCode: string
  accountNumber: string
  accountName: string
  transferContent: string
}

const client = new HttpClient(import.meta.env.VITE_API_URL || "/api")

// Existing screens paginate locally, so fetch every API page before showing totals.
async function allPages<T>(path: string): Promise<T[]> {
  const items: T[] = []
  for (let page = 1; ; page += 1) {
    const result = await client.request<ApiEnvelope<{ items: T[]; hasNext: boolean }>>(
      `${path}${path.includes("?") ? "&" : "?"}limit=100&page=${page}`,
    )
    items.push(...result.data.items)
    if (!result.data.hasNext) return items
  }
}

const roleMap = { CUSTOMER: "customer", ADMIN: "admin" } as const
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
    date: item.createdAt,
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
        pattern: value.pattern ? String(value.pattern) : undefined,
        options: Array.isArray(value.options)
          ? value.options.map((option) =>
              typeof option === "object" && option !== null
                ? { value: String(option.value ?? option.label ?? ""), label: String(option.label ?? option.value ?? "") }
                : String(option),
            )
          : [],
      }
    }),
  }
}

export const api = {
  auth: {
    async login(email: string, password: string, scope?: "storefront" | "admin") {
      const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password, ...(scope ? { scope } : {}) }),
      })
      return mapUser(result.data.user)
    },
    async register(name: string, email: string, password: string) {
      return client.request<ApiEnvelope<{ requiresVerification: boolean }>>("/auth/register", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      })
    },
    async verifyRegistration(email: string, code: string) {
      const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/register/verify", {
        method: "POST",
        body: JSON.stringify({ email, code }),
      })
      return mapUser(result.data.user)
    },
    async requestPasswordReset(email: string) {
      await client.request("/auth/forgot-password", {
        method: "POST",
        body: JSON.stringify({ email }),
      })
    },
    async resetPassword(email: string, code: string, password: string) {
      await client.request("/auth/reset-password", {
        method: "POST",
        body: JSON.stringify({ email, code, password }),
      })
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
    async updateProfile(name: string) {
      const result = await client.request<ApiEnvelope<{ user: ApiUser }>>("/auth/profile", {
        method: "PUT",
        body: JSON.stringify({ name }),
      })
      return mapUser(result.data.user)
    },
    async changePassword(currentPassword: string, newPassword: string) {
      await client.request("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      })
    },
  },
  catalog: {
    async load() {
      const [servicesResult, templatesResult, statusesResult] = await Promise.all([
        client.request<ApiEnvelope<ApiService[]>>("/catalog/services"),
        client.request<ApiEnvelope<Record<string, unknown>[]>>("/catalog/topup-templates"),
        client.request<ApiEnvelope<ProductStatus[]>>("/catalog/product-statuses"),
      ])
      const tagsResult = await client.request<ApiEnvelope<Array<{ id: string; name: string }>>>("/catalog/tags")
      const services = servicesResult.data.map((service) => ({
        ...service,
        id: service.id,
      }))
      const packageResults = await Promise.all(
        services.map((service) =>
          allPages<ApiPackage>(
            `/catalog/services/${service.id}/packages`,
          ),
        ),
      )
      return {
        services,
        packages: packageResults.flatMap((result) => result.map(mapPackage)),
        templates: templatesResult.data.map(mapTemplate),
        statuses: statusesResult.data.map((status) => ({
          ...status,
          icon: "check" as const,
          color: (status.color || "green") as ProductStatus["color"],
        })),
        tags: tagsResult.data.map((tag) => tag.name),
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
    async checkout(
      items: Array<{ packageId: string | number; quantity: number }>,
      topupInfo: Record<string, string>,
      userEmail?: string,
      idempotencyKey = crypto.randomUUID(),
    ) {
      const result = await client.request<ApiEnvelope<{
        transactions: ApiTransaction[]
        payment: PaymentDetails
      }>>("/orders/checkout", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey },
        body: JSON.stringify({
          items: items.map((item) => ({
            packageId: String(item.packageId),
            quantity: item.quantity,
          })),
          topupInfo,
          userEmail,
        }),
      })
      return {
        transactions: result.data.transactions.map(mapTransaction),
        payment: result.data.payment,
      }
    },
    async mine() {
      return (await allPages<ApiTransaction>("/orders/mine")).map(mapTransaction)
    },
  },
  payments: {
    async status(orderCode: string) {
      const result = await client.request<ApiEnvelope<{
        paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REFUNDED" | "EXPIRED"
        status: ApiTransaction["status"]
        paidAt: string | null
      }>>(`/payments/status/${encodeURIComponent(orderCode)}`)
      return result.data
    },
  },
  admin: {
    async services() {
      const result = await client.request<ApiEnvelope<ApiService[]>>("/admin/services?limit=100")
      return result.data
    },
    async createService(payload: Omit<Service, "id"> & { game: string }) {
      const result = await client.request<ApiEnvelope<ApiService>>("/admin/services", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      return result.data
    },
    async updateService(id: string | number, payload: Partial<Omit<Service, "id">>) {
      const result = await client.request<ApiEnvelope<ApiService>>(`/admin/services/${String(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      return result.data
    },
    async deleteService(id: string | number) {
      await client.request(`/admin/services/${String(id)}`, { method: "DELETE" })
    },
    async packages(serviceId?: string | number) {
      const query = serviceId ? `?serviceId=${encodeURIComponent(String(serviceId))}` : ""
      return (await allPages<ApiPackage>(`/admin/packages${query}`)).map(mapPackage)
    },
    async createPackage(payload: Omit<ServicePackage, "id">) {
      const result = await client.request<ApiEnvelope<ApiPackage>>("/admin/packages", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      return mapPackage(result.data)
    },
    async updatePackage(id: string | number, payload: Partial<Omit<ServicePackage, "id" | "serviceId">>) {
      const result = await client.request<ApiEnvelope<ApiPackage>>(`/admin/packages/${String(id)}`, {
        method: "PUT",
        body: JSON.stringify(payload),
      })
      return mapPackage(result.data)
    },
    async deletePackage(id: string | number) {
      await client.request(`/admin/packages/${String(id)}`, { method: "DELETE" })
    },
    async tags() {
      const result = await client.request<ApiEnvelope<Array<{ id: string; name: string }>>>("/admin/tags")
      return result.data
    },
    async createTag(name: string) {
      const result = await client.request<ApiEnvelope<{ id: string; name: string }>>("/admin/tags", {
        method: "POST",
        body: JSON.stringify({ name }),
      })
      return result.data
    },
    async updateTag(id: string, name: string) {
      const result = await client.request<ApiEnvelope<{ id: string; name: string }>>(`/admin/tags/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify({ name }),
      })
      return result.data
    },
    async deleteTag(id: string) {
      await client.request(`/admin/tags/${encodeURIComponent(id)}`, { method: "DELETE" })
    },
    async uploadImage(payload: { filename?: string; data: string }) {
      const result = await client.request<ApiEnvelope<{ url: string }>>("/admin/upload", {
        method: "POST",
        body: JSON.stringify(payload),
      })
      return result.data
    },
    async mediaList() {
      const result = await client.request<ApiEnvelope<string[]>>("/admin/media")
      return result.data
    },
    async createStatus(status: ProductStatus) {
      const result = await client.request<ApiEnvelope<ProductStatus>>("/admin/product-statuses", {
        method: "POST",
        body: JSON.stringify({ ...status, iconName: status.icon }),
      })
      return { ...result.data, icon: "check" as const }
    },
    async deleteStatus(id: string) {
      await client.request(`/admin/product-statuses/${encodeURIComponent(id)}`, { method: "DELETE" })
    },
    async createTemplate(template: TopupTemplate) {
      const result = await client.request<ApiEnvelope<Record<string, unknown>>>("/admin/topup-templates", {
        method: "POST",
        body: JSON.stringify(template),
      })
      return mapTemplate(result.data)
    },
    async updateTemplate(id: string, template: TopupTemplate) {
      const result = await client.request<ApiEnvelope<Record<string, unknown>>>(`/admin/topup-templates/${encodeURIComponent(id)}`, {
        method: "PUT",
        body: JSON.stringify(template),
      })
      return mapTemplate(result.data)
    },
    async deleteTemplate(id: string) {
      await client.request(`/admin/topup-templates/${encodeURIComponent(id)}`, { method: "DELETE" })
    },
    async updateSetting<T extends Record<string, unknown>>(key: string, value: T) {
      const result = await client.request<ApiEnvelope<{ value: T }>>(`/admin/settings/${encodeURIComponent(key)}`, {
        method: "PUT",
        body: JSON.stringify(value),
      })
      return result.data.value
    },
    async users() {
      const result = await allPages<{
        id: string
        email: string
        name: string
        role: "CUSTOMER" | "ADMIN"
        status: "ACTIVE" | "BLOCKED"
        totalSpent: string | number
        createdAt: string
      }>("/admin/users")
      return result.map((item) => ({
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
      return (await allPages<ApiTransaction>("/admin/transactions")).map(mapTransaction)
    },
    async updateUser(id: string | number, updates: Partial<ManagedUser>) {
    const result = await client.request<ApiEnvelope<{
      id: string
      email: string
      name: string
      role: "CUSTOMER" | "ADMIN"
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
