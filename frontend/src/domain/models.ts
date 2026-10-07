export type IconName = "bag" | "bridge" | "chat" | "check" | "chevron" | "clock" | "close" | "edit" | "eye" | "eye-off" | "game" | "grid" | "headset" | "home" | "mail" | "plus" | "search" | "shield" | "spark" | "trash" | "user"

export type User = { id?: string; email: string; name?: string; role: "customer" | "admin" }

export type TransactionStatus = "Chờ thanh toán" | "Đang xử lý" | "Hoàn thành" | "Thất bại" | "Đã hoàn tiền"

export type Transaction = {
  id: string | number
  code: string
  email: string
  product: string
  game: string
  amount: number
  quantity?: number
  status: TransactionStatus
  date: string
  topupInfo?: Record<string, string>
  topupLabels?: Record<string, string>
  templateName?: string
}

export type ManagedUser = {
  id: string | number
  name: string
  email: string
  role: "customer" | "admin"
  status: "active" | "blocked"
  joined: string
  totalSpent: number
}

/** Dịch vụ (game): mỗi dịch vụ nhóm nhiều gói nạp */
export type Service = {
  id: string | number
  name: string
  description: string
  iconText: string
  tone: string
  image?: string
  imagePosition?: string
  packageCount?: number
  isActive: boolean
  sortOrder: number
}

/** Gói nạp cụ thể trong một dịch vụ */
export type ServicePackage = {
  id: string | number
  serviceId: string | number
  name: string
  description: string
  price: number
  oldPrice: number
  note: string
  tags: string[]
  statusId: string
  templateId: string
  image?: string
  imagePosition?: string
  sortOrder: number
}

export type CartItem = {
  pkg: ServicePackage
  quantity: number
}

/** Legacy - vẫn dùng trong admin để tương thích */
export type Product = {
  id: string | number
  name: string
  game: string
  tags: string[]
  price: number
  oldPrice: number
  note: string
  art: string
  tone: string
  statusId: string
  templateId: string
  image?: string
  imagePosition?: string
  isActive?: boolean
}

export type TopupFieldType = "text" | "number" | "email" | "select" | "textarea"

export type TopupField = {
  id: string
  key: string
  label: string
  type: TopupFieldType
  required: boolean
  placeholder: string
  helpText: string
  options: string[]
}

export type TopupTemplate = {
  id: string
  name: string
  game: string
  description: string
  warning: string
  fields: TopupField[]
}

export type ProductStatus = {
  id: string
  name: string
  icon: IconName
  color: "green" | "amber" | "red" | "blue" | "violet"
  purchasable: boolean
}

export type MiddlemanInfo = {
  intro: string
  supportHours: string
  contactTitle: string
  contactDescription: string
  zaloName: string
  zaloPhone: string
  zaloUrl: string
  fees: { range: string fee: string }[]
  feeNote: string
  accepted: string
  rejected: string
  warning: string
  bank: string
  accountNumber: string
  accountHolder: string
  commitment: string
}

export type ContactPlatform = "zalo" | "youtube" | "discord" | "facebook" | "telegram" | "email" | "custom"

export type ContactChannel = {
  id: string | number
  platform: ContactPlatform
  label: string
  name: string
  description: string
  url: string
  image: string
  color: string
}

export type ContactInfo = {
  intro: string
  supportHours: string
  commitmentTitle: string
  commitment: string
  channels: ContactChannel[]
}
