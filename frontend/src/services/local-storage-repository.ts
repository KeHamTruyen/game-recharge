import type {
  ContactInfo,
  ManagedUser,
  MiddlemanInfo,
  Product,
  ProductStatus,
  TopupTemplate,
  Transaction,
} from "@/domain/models"

export type AppSnapshot = {
  products: Product[]
  productStatuses: ProductStatus[]
  topupTemplates: TopupTemplate[]
  categories: string[]
  games: string[]
  middlemanInfo: MiddlemanInfo
  contactInfo: ContactInfo
  users?: ManagedUser[]
  transactions?: Transaction[]
}

const STORAGE_KEY = "nexa-app-snapshot-v1"

export const localStorageRepository = {
  load(fallback: AppSnapshot): AppSnapshot {
    try {
      const value = localStorage.getItem(STORAGE_KEY)
      return value ? { ...fallback, ...JSON.parse(value) } : fallback
    } catch {
      return fallback
    }
  },
  save(snapshot: AppSnapshot) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot))
    } catch {
      // Uploaded Base64 images may exceed the browser quota. A backend adapter
      // should upload files to object storage and persist only their URLs.
    }
  },
}
