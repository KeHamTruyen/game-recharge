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
  CartItem,
  ManagedUser,
  MiddlemanInfo,
  Product,
  ProductStatus,
  Service,
  ServicePackage,
  TopupTemplate,
  Transaction,
  User,
} from "@/domain/models"
import {
  initialContactInfo,
  initialMiddlemanInfo,
  initialProducts,
  initialProductStatuses,
  initialServicePackages,
  initialServices,
  initialTopupTemplates,
  initialTransactions,
  initialUsers,
} from "@/data/mock-data"
import { localStorageRepository, type AppSnapshot } from "@/services/local-storage-repository"
import { api } from "@/services/api"

const fallbackSnapshot: AppSnapshot = {
  products: initialProducts,
  productStatuses: initialProductStatuses,
  topupTemplates: initialTopupTemplates,
  categories: ["Tất cả", "Nạp game", "Thẻ tháng", "Thẻ hành trình", "Ưu đãi"],
  games: ["Genshin Impact", "Honkai: Star Rail", "Zenless Zone Zero", "Wuthering Waves", "Valorant", "Honkai Impact 3"],
  middlemanInfo: initialMiddlemanInfo,
  contactInfo: initialContactInfo,
  users: initialUsers,
  transactions: initialTransactions,
}

type Setter<T> = Dispatch<SetStateAction<T>>

type AppStoreValue = AppSnapshot & {
  services: Service[]
  servicePackages: ServicePackage[]
  user: User | null
  selectedProduct: Product | null
  selectedPackage: ServicePackage | null
  selectedService: Service | null
  selectedQuantity: number
  cart: CartItem[]
  checkoutInfo: Record<string, string>
  notice: string
  apiReady: boolean
  setProducts: Setter<Product[]>
  setProductStatuses: Setter<ProductStatus[]>
  setTopupTemplates: Setter<TopupTemplate[]>
  setCategories: Setter<string[]>
  setGames: Setter<string[]>
  setMiddlemanInfo: Setter<MiddlemanInfo>
  setContactInfo: Setter<ContactInfo>
  setUsers: Setter<ManagedUser[]>
  setTransactions: Setter<Transaction[]>
  setServices: Setter<Service[]>
  setServicePackages: Setter<ServicePackage[]>
  setSelectedProduct: Setter<Product | null>
  setSelectedPackage: Setter<ServicePackage | null>
  setSelectedService: Setter<Service | null>
  setSelectedQuantity: Setter<number>
  setCart: Setter<CartItem[]>
  setCheckoutInfo: Setter<Record<string, string>>
  setNotice: Setter<string>
  login(email: string, password?: string, name?: string): Promise<User>
  logout(): Promise<void>
}

const AppStoreContext = createContext<AppStoreValue | null>(null)

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [initial] = useState(() => {
    const stored = localStorageRepository.load(fallbackSnapshot)
    return {
      ...stored,
      middlemanInfo: {
        ...initialMiddlemanInfo,
        ...stored.middlemanInfo,
        fees: stored.middlemanInfo?.fees?.length
          ? stored.middlemanInfo.fees
          : initialMiddlemanInfo.fees,
      },
      contactInfo: {
        ...initialContactInfo,
        ...stored.contactInfo,
        intro: stored.contactInfo?.intro || initialContactInfo.intro,
        supportHours: stored.contactInfo?.supportHours || initialContactInfo.supportHours,
        commitmentTitle: stored.contactInfo?.commitmentTitle || initialContactInfo.commitmentTitle,
        commitment: stored.contactInfo?.commitment || initialContactInfo.commitment,
        channels: stored.contactInfo?.channels?.length
          ? stored.contactInfo.channels
          : initialContactInfo.channels,
      },
    }
  })
  const [products, setProducts] = useState(initial.products)
  const [productStatuses, setProductStatuses] = useState(initial.productStatuses)
  const [topupTemplates, setTopupTemplates] = useState(initial.topupTemplates)
  const [categories, setCategories] = useState(initial.categories)
  const [games, setGames] = useState(initial.games)
  const [middlemanInfo, setMiddlemanInfo] = useState(initial.middlemanInfo)
  const [contactInfo, setContactInfo] = useState(initial.contactInfo)
  const [users, setUsers] = useState(initial.users || initialUsers)
  const [transactions, setTransactions] = useState(initial.transactions || initialTransactions)
  const [services, setServices] = useState<Service[]>(initialServices)
  const [servicePackages, setServicePackages] = useState<ServicePackage[]>(initialServicePackages)
  const [user, setUser] = useState<User | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [selectedPackage, setSelectedPackage] = useState<ServicePackage | null>(null)
  const [selectedService, setSelectedService] = useState<Service | null>(null)
  const [selectedQuantity, setSelectedQuantity] = useState(1)
  const [cart, setCart] = useState<CartItem[]>([])
  const [checkoutInfo, setCheckoutInfo] = useState<Record<string, string>>({})
  const [notice, setNotice] = useState("")
  const [apiReady, setApiReady] = useState(false)

  const mergeRemoteContent = (remoteMiddleman: Record<string, unknown>, remoteContact: Record<string, unknown>) => {
    setMiddlemanInfo((current) => ({
      ...current,
      intro: String(remoteMiddleman.description || current.intro),
      contactDescription: String(remoteMiddleman.supportEmail || current.contactDescription),
      supportHours: current.supportHours,
      fees: Array.isArray(remoteMiddleman.fees) ? remoteMiddleman.fees as typeof current.fees : current.fees,
    }))
    setContactInfo((current) => ({
      ...current,
      supportHours: String(remoteContact.workingHours || current.supportHours),
      intro: String(remoteContact.responseTime || current.intro),
      channels: (current.channels || []).map((channel) => {
        const url = remoteContact[channel.platform]
        return typeof url === "string" ? { ...channel, url } : channel
      }),
    }))
  }

  useEffect(() => {
    localStorageRepository.save({
      products, productStatuses, topupTemplates, categories, games,
      middlemanInfo, contactInfo,
    })
  }, [products, productStatuses, topupTemplates, categories, games, middlemanInfo, contactInfo, users, transactions])

  useEffect(() => {
    let cancelled = false
    void Promise.all([api.auth.session(), api.catalog.load()])
      .then(async ([session, catalog]) => {
        if (cancelled) return
        setServices(catalog.services)
        setGames(catalog.services.map((service) => service.name))
        setServicePackages(catalog.packages)
        setProducts(catalog.packages.map((pkg) => {
          const service = catalog.services.find((item) => item.id === pkg.serviceId)
          return {
            id: pkg.id,
            name: pkg.name,
            game: service?.name || service?.game || "Game",
            tags: pkg.tags,
            price: pkg.price,
            oldPrice: pkg.oldPrice,
            note: pkg.note,
            art: (service?.iconText || service?.name || "GAME").slice(0, 3).toUpperCase(),
            tone: service?.tone || "cyan",
            statusId: pkg.statusId,
            templateId: pkg.templateId,
          }
        }))
        setTopupTemplates(catalog.templates)
        setProductStatuses(catalog.statuses)
        const [remoteMiddleman, remoteContact] = await Promise.all([
          api.settings.get<Record<string, unknown>>("middlemanInfo"),
          api.settings.get<Record<string, unknown>>("contactInfo"),
        ])
        mergeRemoteContent(remoteMiddleman, remoteContact)
        if (session) {
          setUser(session)
          setTransactions(
            session.role === "admin" || session.role === "staff"
              ? await api.admin.transactions()
              : await api.orders.mine(),
          )
          if (session.role === "admin" || session.role === "staff") {
            setUsers(await api.admin.users())
          }
        }
        setApiReady(true)
      })
      .catch(() => {
        if (!cancelled) setNotice("Không thể kết nối máy chủ. Đang dùng dữ liệu tạm thời.")
      })
    return () => { cancelled = true }
  }, [])

  const value = useMemo<AppStoreValue>(() => ({
    products, productStatuses, topupTemplates, categories, games,
    middlemanInfo, contactInfo, users, transactions, services, servicePackages,
    user, selectedProduct, selectedPackage, selectedService, selectedQuantity, cart,
    checkoutInfo, notice, apiReady, setProducts, setProductStatuses,
    setTopupTemplates, setCategories, setGames, setMiddlemanInfo, setContactInfo,
    setUsers, setTransactions, setServices, setServicePackages, setSelectedProduct,
    setSelectedPackage, setSelectedService, setSelectedQuantity, setCart, setCheckoutInfo,
    setNotice,
    async login(email, password, name) {
      const nextUser = password
        ? name ? await api.auth.register(name, email, password) : await api.auth.login(email, password)
        : { email, role: "customer" as const }
      setUser(nextUser)
      if (password) {
        setTransactions(nextUser.role === "admin" || nextUser.role === "staff"
          ? await api.admin.transactions()
          : await api.orders.mine())
      }
      return nextUser
    },
    async logout() {
      if (apiReady) await api.auth.logout()
      setUser(null)
      setTransactions([])
    },
  }), [
    products, productStatuses, topupTemplates, categories, games, middlemanInfo,
    contactInfo, users, transactions, services, servicePackages, user,
    selectedProduct, selectedPackage, selectedService, selectedQuantity, cart,
    checkoutInfo, notice, apiReady,
  ])

  return <AppStoreContext.Provider value={value}>{children}</AppStoreContext.Provider>
}

export function useAppStore() {
  const value = useContext(AppStoreContext)
  if (!value) throw new Error("useAppStore must be used inside AppStoreProvider")
  return value
}
