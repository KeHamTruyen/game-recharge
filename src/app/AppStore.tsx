import {
  createContext,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import type {
  ContactInfo,
  ManagedUser,
  MiddlemanInfo,
  Product,
  ProductStatus,
  TopupTemplate,
  Transaction,
  User,
} from "@/domain/models"
import {
  initialContactInfo,
  initialMiddlemanInfo,
  initialProducts,
  initialProductStatuses,
  initialTopupTemplates,
  initialTransactions,
  initialUsers,
} from "@/data/mock-data"
import {
  localStorageRepository,
  type AppSnapshot,
} from "@/services/local-storage-repository"

const fallbackSnapshot: AppSnapshot = {
  products: initialProducts,
  productStatuses: initialProductStatuses,
  topupTemplates: initialTopupTemplates,
  categories: ["Tất cả", "Nạp game", "Thẻ tháng", "Thẻ hành trình", "Ưu đãi"],
  games: [
    "Genshin Impact",
    "Honkai: Star Rail",
    "Zenless Zone Zero",
    "Wuthering Waves",
    "Valorant",
    "Honkai Impact 3",
  ],
  middlemanInfo: initialMiddlemanInfo,
  contactInfo: initialContactInfo,
  users: initialUsers,
  transactions: initialTransactions,
}

type Setter<T> = Dispatch<SetStateAction<T>>

type AppStoreValue = AppSnapshot & {
  user: User | null
  selectedProduct: Product | null
  selectedQuantity: number
  checkoutInfo: Record<string, string>
  notice: string
  setProducts: Setter<Product[]>
  setProductStatuses: Setter<ProductStatus[]>
  setTopupTemplates: Setter<TopupTemplate[]>
  setCategories: Setter<string[]>
  setGames: Setter<string[]>
  setMiddlemanInfo: Setter<MiddlemanInfo>
  setContactInfo: Setter<ContactInfo>
  setUsers: Setter<ManagedUser[]>
  setTransactions: Setter<Transaction[]>
  setSelectedProduct: Setter<Product | null>
  setSelectedQuantity: Setter<number>
  setCheckoutInfo: Setter<Record<string, string>>
  setNotice: Setter<string>
  login(email: string): User
  logout(): void
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() =>
    localStorageRepository.load(fallbackSnapshot),
  )
  const [products, setProducts] = useState(initial.products)
  const [productStatuses, setProductStatuses] = useState(
    initial.productStatuses,
  )
  const [topupTemplates, setTopupTemplates] = useState(initial.topupTemplates)
  const [categories, setCategories] = useState(initial.categories)
  const [games, setGames] = useState(initial.games)
  const [middlemanInfo, setMiddlemanInfo] = useState(initial.middlemanInfo)
  const [contactInfo, setContactInfo] = useState(initial.contactInfo)
  const [users, setUsers] = useState(initial.users)
  const [transactions, setTransactions] = useState(initial.transactions)
  const [user, setUser] = useState<User | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [checkoutInfo, setCheckoutInfo] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")

  useEffect(() => {
    localStorageRepository.save({
      products,
      productStatuses,
      topupTemplates,
      categories,
      games,
      middlemanInfo,
      contactInfo,
      users,
      transactions,
    })
  }, [
    products,
    productStatuses,
    topupTemplates,
    categories,
    games,
    middlemanInfo,
    contactInfo,
    users,
    transactions,
  ])

  const value = useMemo<AppStoreValue>(
    () => ({
      products,
      productStatuses,
      topupTemplates,
      categories,
      games,
      middlemanInfo,
      contactInfo,
      users,
      transactions,
      user,
      selectedProduct,
      selectedQuantity,
      checkoutInfo,
      notice,
      setProducts,
      setProductStatuses,
      setTopupTemplates,
      setCategories,
      setGames,
      setMiddlemanInfo,
      setContactInfo,
      setUsers,
      setTransactions,
      setSelectedProduct,
      setSelectedQuantity,
      setCheckoutInfo,
      setNotice,
      login(email) {
        const nextUser: User = {
          email,
          role: email.toLowerCase().includes("admin") ? "admin" : "customer",
        }
        setUser(nextUser)
        if (nextUser.role === "customer") {
          setUsers((current) =>
            current.some((item) => item.email === email)
              ? current
              : [
                  ...current,
                  {
                    id: Date.now(),
                    name: email.split("@")[0],
                    email,
                    role: "customer",
                    status: "active",
                    joined: new Date().toLocaleDateString("vi-VN"),
                    totalSpent: 0,
                  },
                ],
          )
        }
        return nextUser
      },
      logout() {
        setUser(null)
      },
    }),
    [
      products,
      productStatuses,
      topupTemplates,
      categories,
      games,
      middlemanInfo,
      contactInfo,
      users,
      transactions,
      user,
      selectedProduct,
      selectedQuantity,
      checkoutInfo,
      notice,
    ],
  )

  return (
    <AppStoreContext.Provider value={value}>
      {children}
    </AppStoreContext.Provider>
  )
}

export function useAppStore() {
  const value = useContext(AppStoreContext)
  if (!value)
    throw new Error("useAppStore must be used inside AppStoreProvider")
  return value
}
