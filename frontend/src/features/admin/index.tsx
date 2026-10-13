import { FormEvent, useCallback, useEffect, useMemo, useState, lazy, Suspense } from "react"
import type {
  ContactChannel,
  ContactInfo,
  ContactPlatform,
  FooterCommunityGroup,
  FooterConfig,
  IconName,
  ManagedUser,
  MiddlemanInfo,
  Product,
  ProductStatus,
  Service,
  TopupField,
  TopupFieldType,
  TopupTemplate,
  Transaction,
  TransactionStatus,
} from "@/domain/models"
import { initialFooterConfig, platformLogos } from "@/data/mock-data"
import { Icon, Pagination, ProductCard, ServiceCard, formatPrice } from "@/components/ui"
import { api } from "@/services/api"

export function AdminHeader({
  email,
  onStore,
  onLogout,
}: {
  email: string
  onStore: () => void
  onLogout: () => void
}) {
  return (
    <header className="admin-header">
      <div className="admin-header-inner">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="shield" size={19} />
          </span>
          <span>
            DUKE<span>1305 ADMIN</span>
          </span>
        </div>
        <div className="admin-header-label">
          <span className="online-dot" /> Hệ thống quản trị
        </div>
        <div className="admin-header-user">
          <span>
            <strong>Quản trị viên</strong>
            <small>{email}</small>
          </span>
          <button className="secondary-button admin-store-btn" onClick={onStore}>
            <Icon name="home" size={16} /> <span>Về cửa hàng</span>
          </button>
          <button className="admin-logout" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </header>
  )
}

export function AdminImagePicker({
  value,
  onChange,
  label = "Ảnh",
  galleryImages = [],
}: {
  value: string
  onChange: (image: string) => void
  label?: string
  galleryImages?: string[]
}) {
  const [isGalleryOpen, setIsGalleryOpen] = useState(false)
  const [isManualUrl, setIsManualUrl] = useState(false)
  const [serverImages, setServerImages] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)

  useEffect(() => {
    let active = true
    import("@/services/api").then(({ api }) => {
      api.admin
        .mediaList()
        .then((res) => {
          if (active && Array.isArray(res)) {
            setServerImages(res)
          }
        })
        .catch(() => {})
    })
    return () => {
      active = false
    }
  }, [])

  const [localHistory, setLocalHistory] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("duke1305_uploaded_gallery")
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const allImages = useMemo(() => {
    const list = new Set<string>()
    for (const img of serverImages) if (img) list.add(img)
    for (const img of galleryImages) if (img) list.add(img)
    for (const img of localHistory) if (img) list.add(img)
    if (value) list.add(value)
    return Array.from(list)
  }, [serverImages, galleryImages, localHistory, value])

  const handleUploadFile = async (file?: File) => {
    if (!file) return
    setIsUploading(true)
    try {
      const reader = new FileReader()
      const dataUri = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { api } = await import("@/services/api")
      const res = await api.admin.uploadImage({ filename: file.name, data: dataUri })
      const finalUrl = res.url

      onChange(finalUrl)
      setLocalHistory((prev) => {
        const next = Array.from(new Set([finalUrl, ...prev]))
        try {
          localStorage.setItem(
            "duke1305_uploaded_gallery",
            JSON.stringify(next.slice(0, 30)),
          )
        } catch {}
        return next
      })
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Image upload failed")
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <div className="admin-image-picker-wrap">
      <div className="admin-image-picker-header">
        <span>{label}</span>
        <button
          type="button"
          className="admin-image-picker-url-toggle"
          onClick={() => setIsManualUrl(!isManualUrl)}
        >
          {isManualUrl ? "Đóng nhập link URL" : "Nhập link URL"}
        </button>
      </div>

      {isManualUrl && (
        <div style={{ marginBottom: "6px" }}>
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Dán link ảnh (https://... hoặc /uploads/...)"
          />
        </div>
      )}

      <div className="admin-image-picker-controls">
        <label className="admin-image-picker-btn upload-btn">
          <Icon name="plus" size={14} />
          <span>{isUploading ? "Đang tải ảnh lên..." : "Tải ảnh từ máy"}</span>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            style={{ display: "none" }}
            onChange={(e) => handleUploadFile(e.target.files?.[0])}
            disabled={isUploading}
          />
        </label>

        <button
          type="button"
          className={`admin-image-picker-btn gallery-btn ${isGalleryOpen ? "active" : ""}`}
          onClick={() => setIsGalleryOpen(!isGalleryOpen)}
        >
          <Icon name="grid" size={14} />
          <span>Kho ảnh ({allImages.length})</span>
        </button>

        {value && (
          <button
            type="button"
            className="admin-image-picker-btn clear-btn"
            onClick={() => onChange("")}
            title="Xóa ảnh"
          >
            <Icon name="close" size={13} /> Xóa ảnh
          </button>
        )}
      </div>

      {value && (
        <div className="admin-image-picker-preview">
          <img
            src={value}
            alt="Ảnh đã chọn"
            onError={(e) => {
              ;(e.target as HTMLImageElement).style.opacity = "0.4"
            }}
          />
          <div className="preview-meta">
            <strong>Ảnh đang chọn</strong>
            <small title={value}>
              {value.startsWith("data:") ? "Ảnh tải trực tiếp từ máy" : value}
            </small>
          </div>
        </div>
      )}

      {isGalleryOpen && (
        <div className="admin-image-gallery-drawer">
          <div className="gallery-drawer-head">
            <strong>Kho ảnh đã tải & sử dụng ({allImages.length})</strong>
            <small>Bấm vào ảnh bất kỳ để áp dụng ngay</small>
          </div>
          {allImages.length === 0 ? (
            <div className="gallery-empty">
              <Icon name="grid" size={18} />
              <span>
                Chưa có ảnh nào trong kho. Hãy bấm &quot;Tải ảnh từ máy&quot; để thêm ảnh đầu tiên!
              </span>
            </div>
          ) : (
            <div className="gallery-thumbnails-grid">
              {allImages.map((imgSrc, idx) => {
                const isSelected = value === imgSrc
                return (
                  <button
                    key={`${imgSrc}-${idx}`}
                    type="button"
                    className={`gallery-thumb-item ${isSelected ? "selected" : ""}`}
                    onClick={() => {
                      onChange(imgSrc)
                      setIsGalleryOpen(false)
                    }}
                    title={imgSrc.startsWith("data:") ? "Ảnh tải lên" : imgSrc}
                  >
                    <img
                      src={imgSrc}
                      alt={`Gallery item ${idx + 1}`}
                      onError={(e) => {
                        ;(e.target as HTMLImageElement).parentElement!.style.display =
                          "none"
                      }}
                    />
                    {isSelected && (
                      <span className="selected-badge">
                        <Icon name="check" size={12} />
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const AdminWikiManager = lazy(() => import("./AdminWikiManager").then((module) => ({ default: module.AdminWikiManager })))

export function AdminPage({
  products,
  services,
  categories,
  games,
  productStatuses,
  topupTemplates,
  onAddProduct,
  onDeleteProduct,
  onUpdateProduct,
  onAddProductStatus,
  onDeleteProductStatus,
  onAddTopupTemplate,
  onUpdateTopupTemplate,
  onDeleteTopupTemplate,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory,
  onAddGame,
  onDeleteGame,
  onUpdateGame,
  onUpdateService,
  onAddService,
  middlemanInfo,
  onUpdateMiddleman,
  contactInfo,
  onUpdateContact,
  footerConfig,
  onUpdateFooter,
  users,
  transactions,
  onUpdateUser,
  onUpdateTransaction,
  onUpdateProfile,
  onChangePassword,
  adminName,
  adminEmail,
  onStore,
}: {
  products: Product[]
  services: Service[]
  categories: string[]
  games: string[]
  productStatuses: ProductStatus[]
  topupTemplates: TopupTemplate[]
  onAddProduct: (product: Omit<Product, "id">) => void | Promise<void>
  onDeleteProduct: (id: string | number) => void | Promise<void>
  onUpdateProduct: (id: string | number, updates: Partial<Product>) => void | Promise<void>
  onAddProductStatus: (status: ProductStatus) => void
  onDeleteProductStatus: (id: string) => void
  onAddTopupTemplate: (template: TopupTemplate) => void
  onUpdateTopupTemplate: (id: string, template: TopupTemplate) => void
  onDeleteTopupTemplate: (id: string) => Promise<boolean>
  onAddCategory: (name: string) => void | Promise<void>
  onUpdateCategory?: (oldName: string, newName: string) => void | Promise<void>
  onDeleteCategory: (name: string) => void | Promise<void>
  onAddGame: (name: string) => void
  onDeleteGame: (name: string) => void
  onUpdateGame: (name: string, updates: Partial<Service>) => void | Promise<void>
  onUpdateService?: (serviceId: string | number, updates: Partial<Service>) => void | Promise<void>
  onAddService?: (serviceData: Omit<Service, "id">) => Promise<Service>
  middlemanInfo: MiddlemanInfo
  onUpdateMiddleman: (info: MiddlemanInfo) => void
  contactInfo: ContactInfo
  onUpdateContact: (info: ContactInfo) => void
  footerConfig?: FooterConfig
  onUpdateFooter?: (config: FooterConfig) => void | Promise<void>
  users: ManagedUser[]
  transactions: Transaction[]
  onUpdateUser: (id: string | number, updates: Partial<ManagedUser>) => void
  onUpdateTransaction: (
    id: string | number,
    status: TransactionStatus,
    reason?: string,
    paymentStatus?: string,
    refundDetails?: { refundAmount?: number; refundTxId?: string; refundReason?: string },
  ) => void
  onUpdateProfile: (name: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  adminName: string
  adminEmail: string
  onStore?: () => void
}) {
  const [tab, setTab] =
    useState<"products" | "templates" | "statuses" | "categories" | "games" | "middleman" | "contacts" | "footer" | "transactions" | "anomalies" | "users" | "adminAccount" | "analytics" | "wiki" | "audit">(
      "products",
    )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const selectTab = (
    nextTab: "products" | "templates" | "statuses" | "categories" | "games" | "middleman" | "contacts" | "footer" | "transactions" | "anomalies" | "users" | "adminAccount" | "analytics" | "wiki" | "audit",
  ) => {
    setTab(nextTab)
    setSidebarOpen(false)
  }
  const [name, setName] = useState("")
  const [game, setGame] = useState(games[0] || "")
  const [price, setPrice] = useState("")
  const [note, setNote] = useState("Mới")
  const [selectedTags, setSelectedTags] = useState<string[]>(
    categories[1] ? [categories[1]] : [],
  )
  const [newCategory, setNewCategory] = useState("")
  const [editingTag, setEditingTag] = useState<{ oldName: string; name: string } | null>(null)
  const [newGame, setNewGame] = useState("")
  const [newGameCreateTopup, setNewGameCreateTopup] = useState(true)
  const [newGameCreateBoosting, setNewGameCreateBoosting] = useState(true)
  const [gameFilter, setGameFilter] = useState<"all" | "topup" | "boosting" | "hiddenTopup" | "hiddenBoosting">("all")
  const [editingGame, setEditingGame] = useState<string | null>(null)
  const [gameName, setGameName] = useState("")
  const [gameKey, setGameKey] = useState("")
  const [gameDescription, setGameDescription] = useState("")
  const [gameTone, setGameTone] = useState("blue")
  const [gameSortOrder, setGameSortOrder] = useState("0")
  const [gameImage, setGameImage] = useState("")
  const [gameImageX, setGameImageX] = useState(50)
  const [gameImageY, setGameImageY] = useState(50)
  const [gameIsActive, setGameIsActive] = useState(true)
  const [topupIsActive, setTopupIsActive] = useState(true)
  const [boostingIsActive, setBoostingIsActive] = useState(true)
  const [image, setImage] = useState("")
  const [imageX, setImageX] = useState(50)
  const [imageY, setImageY] = useState(50)
  const [editingProductId, setEditingProductId] = useState<string | number | null>(null)
  const [productStatusId, setProductStatusId] = useState("available")
  const [productTemplateId, setProductTemplateId] = useState(
    topupTemplates[0]?.id || "",
  )
  const [productIsActive, setProductIsActive] = useState(true)
  const [productFormError, setProductFormError] = useState("")
  const [productSaved, setProductSaved] = useState(false)
  const [savingProduct, setSavingProduct] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [adminProductPage, setAdminProductPage] = useState(1)

  const submitProduct = async (event: FormEvent) => {
    event.preventDefault()
    if (savingProduct) return
    setProductSaved(false)
    if (!name.trim()) return setProductFormError("Vui lòng nhập tên sản phẩm.")
    if (!game) return setProductFormError("Vui lòng chọn game.")
    const parsedPrice = Number(price)
    if (!Number.isInteger(parsedPrice) || parsedPrice < 1 || parsedPrice > 9_999_999_999)
      return setProductFormError("Giá bán phải là số nguyên từ 1 đến 9.999.999.999đ.")
    if (!productTemplateId)
      return setProductFormError("Vui lòng chọn mẫu thông tin nạp.")
    const payload = {
      name: name.trim(),
      game,
      templateId: productTemplateId,
      tags: selectedTags,
      price: parsedPrice,
      oldPrice: parsedPrice,
      note: note.trim() || "Mới",
      art: game.slice(0, 3).toUpperCase(),
      tone: "cyan",
      statusId: productStatusId,
      image: image || null,
      imagePosition: `${imageX}% ${imageY}%`,
      isActive: productIsActive,
    }
    setSavingProduct(true)
    try {
    if (editingProductId !== null) await onUpdateProduct(editingProductId, payload)
    else await onAddProduct(payload)
    setName("")
    setPrice("")
    setImage("")
    setNote("Mới")
    setImageX(50)
    setImageY(50)
    setProductStatusId(productStatuses[0]?.id || "available")
    setProductTemplateId(topupTemplates[0]?.id || "")
    setProductIsActive(true)
    setEditingProductId(null)
    setProductFormError("")
    setProductSaved(true)
    setAddProductOpen(false)
    } catch (error) { setProductFormError(error instanceof Error ? error.message : "Unable to save product.") }
    finally { setSavingProduct(false) }
  }

  const toggleTag = (tag: string) =>
    setSelectedTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    )

  const chooseImage = (file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImage(String(reader.result))
    reader.readAsDataURL(file)
  }

  const resetProductForm = () => {
    setName("")
    setGame(games[0] || "")
    setPrice("")
    setNote("Mới")
    setSelectedTags(categories[1] ? [categories[1]] : [])
    setImage("")
    setImageX(50)
    setImageY(50)
    setProductStatusId(productStatuses[0]?.id || "available")
    setProductTemplateId(topupTemplates[0]?.id || "")
    setProductIsActive(true)
    setEditingProductId(null)
    setProductFormError("")
  }

  const openProductEditor = (product: Product) => {
    const position = (product.imagePosition || "50% 50%")
      .split(" ")
      .map((value) => Number.parseFloat(value))
    setName(product.name)
    setGame(product.game)
    setPrice(String(product.price))
    setNote(product.note)
    setSelectedTags([...product.tags])
    setImage(product.image || "")
    setImageX(position[0] || 50)
    setImageY(position[1] || 50)
    setProductStatusId(product.statusId)
    setProductTemplateId(product.templateId)
    setProductIsActive(product.isActive !== false)
    setEditingProductId(product.id)
    setProductFormError("")
    setAddProductOpen(true)
  }

  const previewProduct: Product = {
    id: 0,
    name: name.trim() || "Tên sản phẩm",
    game: game || "Chưa chọn game",
    tags: selectedTags,
    price: Number(price) || 0,
    oldPrice: Number(price) || 0,
    note: note.trim() || "Mới",
    art: (game || "GAME").slice(0, 3).toUpperCase(),
    tone: "cyan",
    statusId: productStatusId,
    templateId: productTemplateId,
    image: image || undefined,
    imagePosition: `${imageX}% ${imageY}%`,
  }

  const visibleProducts = products.filter((product) =>
    `${product.name} ${product.game} ${product.tags.join(" ")}`
      .toLowerCase()
      .includes(productSearch.trim().toLowerCase()),
  )
  const adminProductPages = Math.max(1, Math.ceil(visibleProducts.length / 8))
  const adminPageProducts = visibleProducts.slice(
    (adminProductPage - 1) * 8,
    adminProductPage * 8,
  )

  const totalCompletedRevenue = useMemo(() => {
    return transactions
      .filter((t) => t.status === "Hoàn thành")
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
  }, [transactions])

  const existingGalleryImages = useMemo(() => {
    const set = new Set<string>()
    set.add("/uploads/animo.jpg")
    for (const s of services) {
      if (s.image) set.add(s.image)
    }
    for (const p of products) {
      if (p.image) set.add(p.image)
    }
    return Array.from(set)
  }, [services, products])

  return (
    <section className="admin-page page-width">
      <div className="admin-heading">
        <div>
          <span className="section-kicker">DUKE1305 CONSOLE</span>
          <h1>Trung tâm quản trị</h1>
          <p>Quản lý sản phẩm, dịch vụ và danh mục hiển thị.</p>
        </div>
        <span className="admin-badge">
          <Icon name="shield" size={16} /> Quản trị viên
        </span>
      </div>
      <button
        className="admin-sidebar-toggle"
        type="button"
        aria-expanded={sidebarOpen}
        aria-controls="admin-navigation"
        onClick={() => setSidebarOpen((open) => !open)}
      >
        <Icon name={sidebarOpen ? "close" : "grid"} size={17} />
        {sidebarOpen ? "Đóng danh mục" : "Mở danh mục"}
      </button>
      <div className="admin-summary" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
        <div>
          <small>Sản phẩm</small>
          <strong>{products.length}</strong>
          <Icon name="bag" />
        </div>
        <div>
          <small>Doanh thu hoàn tất</small>
          <strong>{formatPrice(totalCompletedRevenue)}</strong>
          <Icon name="spark" />
        </div>
        <div>
          <small>Đơn hàng</small>
          <strong>{transactions.length}</strong>
          <Icon name="clock" />
        </div>
        <div>
          <small>Danh sách game</small>
          <strong>{games.length}</strong>
          <Icon name="game" />
        </div>
      </div>
      <div className="admin-workspace">
        <div
          className={`admin-sidebar-backdrop ${sidebarOpen ? "visible" : ""}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />
        <aside
          id="admin-navigation"
          className={sidebarOpen ? "open" : ""}
          aria-label="Danh mục quản trị"
        >
          <div className="admin-sidebar-mobile-head">
            <span>
              <Icon name="shield" size={16} /> Quản trị hệ thống
            </span>
            <button
              type="button"
              className="admin-sidebar-close"
              onClick={() => setSidebarOpen(false)}
              aria-label="Đóng menu"
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <button
            className={tab === "products" ? "active" : ""}
            onClick={() => selectTab("products")}
          >
            <Icon name="bag" size={18} /> Sản phẩm
          </button>
          <button
            className={tab === "analytics" ? "active" : ""}
            onClick={() => selectTab("analytics")}
          >
            <Icon name="spark" size={18} /> Thống kê & Doanh thu
          </button>
          <button
            className={tab === "transactions" ? "active" : ""}
            onClick={() => selectTab("transactions")}
          >
            <Icon name="clock" size={18} /> Giao dịch
          </button>
          <button
            className={tab === "anomalies" ? "active" : ""}
            onClick={() => selectTab("anomalies")}
          >
            <Icon name="shield" size={18} /> Đối soát thanh toán
          </button>
          <button
            className={tab === "templates" ? "active" : ""}
            onClick={() => selectTab("templates")}
          >
            <Icon name="grid" size={18} /> Mẫu thông tin nạp
          </button>
          <button
            className={tab === "statuses" ? "active" : ""}
            onClick={() => selectTab("statuses")}
          >
            <Icon name="check" size={18} /> Trạng thái sản phẩm
          </button>
          <button
            className={tab === "users" ? "active" : ""}
            onClick={() => selectTab("users")}
          >
            <Icon name="user" size={18} /> Người dùng
          </button>
          <button
            className={tab === "categories" ? "active" : ""}
            onClick={() => selectTab("categories")}
          >
            <Icon name="grid" size={18} /> Danh mục & tag
          </button>
          <button
            className={tab === "games" ? "active" : ""}
            onClick={() => selectTab("games")}
          >
            <Icon name="game" size={18} /> Danh sách game
          </button>
          <button
            className={tab === "middleman" ? "active" : ""}
            onClick={() => selectTab("middleman")}
          >
            <Icon name="bridge" size={18} /> Trang trung gian
          </button>
          <button
            className={tab === "contacts" ? "active" : ""}
            onClick={() => selectTab("contacts")}
          >
            <Icon name="headset" size={18} /> Trang liên hệ
          </button>
          <button
            className={tab === "footer" ? "active" : ""}
            onClick={() => selectTab("footer")}
          >
            <Icon name="chat" size={18} /> Chân trang & Cộng đồng
          </button>
          <button
            className={tab === "adminAccount" ? "active" : ""}
            onClick={() => selectTab("adminAccount")}
          >
            <Icon name="shield" size={18} /> Tài khoản admin
          </button>
          <button className={tab === "wiki" ? "active" : ""} onClick={() => selectTab("wiki")}>
            <Icon name="book" size={18} /> Wiki Aniimo
          </button>
          <button
            className={tab === "audit" ? "active" : ""}
            onClick={() => selectTab("audit")}
          >
            <Icon name="shield" size={18} /> Nhật ký hoạt động
          </button>
          {onStore && (
            <>
              <div className="admin-nav-divider" />
              <button
                type="button"
                className="admin-nav-store"
                onClick={() => {
                  setSidebarOpen(false)
                  onStore()
                }}
              >
                <Icon name="home" size={18} /> Về cửa hàng
              </button>
            </>
          )}
        </aside>
        <div className="admin-content">
          {tab === "products" ? (
            <>
              <div className="product-list-toolbar">
                <div>
                  <h2>Sản phẩm</h2>
                  <p>Tìm kiếm, chỉnh sửa và quản lý sản phẩm đã đăng.</p>
                </div>
                <label className="admin-search">
                  <Icon name="search" size={17} />
                  <input
                    value={productSearch}
                    onChange={(event) => {
                      setProductSearch(event.target.value)
                      setAdminProductPage(1)
                    }}
                    placeholder="Tìm tên, game hoặc tag..."
                  />
                </label>
                <button
                  className="primary-button"
                  onClick={() => {
                    resetProductForm()
                    setAddProductOpen(true)
                  }}
                >
                  <Icon name="plus" size={17} /> Thêm sản phẩm
                </button>
              </div>
              {productSaved && (
                <span className="admin-form-message success">
                  <Icon name="check" size={14} /> Đã lưu thông tin sản phẩm
                  thành công.
                </span>
              )}
              <div className="admin-list">
                <div className="admin-list-heading">
                  <h3>Sản phẩm đã đăng</h3>
                  <span>
                    {visibleProducts.length}/{products.length} sản phẩm
                  </span>
                </div>
                {adminPageProducts.map((product) => (
                  <div className="admin-product-entry" key={product.id}>
                    <div className="admin-product-row">
                      {product.image ? (
                        <img
                          className="tiny-image"
                          src={product.image}
                          alt=""
                        />
                      ) : (
                        <span className={`tiny-art tone-${product.tone}`}>
                          {product.art}
                        </span>
                      )}
                      <span>
                        <strong>{product.name}</strong>
                        <small>
                          {product.game} ·{" "}
                          {productStatuses.find(
                            (item) => item.id === product.statusId,
                          )?.name || "Chưa có trạng thái"}
                          {product.isActive === false && (
                            <span style={{ color: "#ef7587", marginLeft: "6px", fontWeight: 600 }}>
                              · (Đang ẩn)
                            </span>
                          )}
                        </small>
                      </span>
                      <strong>{formatPrice(product.price)}</strong>
                      <span className="product-actions">
                        <button
                          type="button"
                          onClick={() => {
                            const newActive = product.isActive === false ? true : false
                            onUpdateProduct(product.id, { isActive: newActive })
                          }}
                          aria-label={product.isActive === false ? "Hiện gói nạp" : "Ẩn gói nạp"}
                          title={product.isActive === false ? "Đang ẩn - Bấm để hiển thị lên website" : "Đang hiện - Bấm để ẩn khỏi website"}
                          style={{
                            color: product.isActive === false ? "#ef7587" : "#4ae0a8",
                          }}
                        >
                          <Icon name={product.isActive === false ? "eye-off" : "eye"} size={17} />
                        </button>
                        <button
                          onClick={() => openProductEditor(product)}
                          aria-label={`Chỉnh sửa ${product.name}`}
                          title={`Chỉnh sửa ${product.name}`}
                        >
                          <Icon name="edit" size={17} />
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Bạn có chắc chắn muốn xóa sản phẩm "${product.name}" không?`)) {
                              onDeleteProduct(product.id)
                            }
                          }}
                          aria-label={`Xóa ${product.name}`}
                          title={`Xóa ${product.name}`}
                        >
                          <Icon name="trash" size={17} />
                        </button>
                      </span>
                    </div>
                  </div>
                ))}
                {visibleProducts.length === 0 && (
                  <div className="admin-empty">
                    <Icon name="search" size={25} />
                    <span>Không tìm thấy sản phẩm phù hợp.</span>
                  </div>
                )}
              </div>
              {visibleProducts.length > 8 && (
                <Pagination
                  page={adminProductPage}
                  totalPages={adminProductPages}
                  onPage={setAdminProductPage}
                />
              )}
              {addProductOpen && (
                <div
                  className="product-modal-backdrop"
                  onMouseDown={(event) =>
                    event.target === event.currentTarget &&
                    setAddProductOpen(false)
                  }
                >
                  <div className="product-modal">
                    <div className="product-modal-head">
                      <div>
                        <span className="section-kicker">
                          {editingProductId === null
                            ? "SẢN PHẨM MỚI"
                            : "CHỈNH SỬA SẢN PHẨM"}
                        </span>
                        <h2>
                          {editingProductId === null
                            ? "Thêm sản phẩm"
                            : "Cập nhật sản phẩm"}
                        </h2>
                      </div>
                      <button onClick={() => setAddProductOpen(false)}>
                        <Icon name="close" size={20} />
                      </button>
                    </div>
                    <div className="product-modal-body">
                      <form
                        className="product-create-form"
                        onSubmit={submitProduct}
                      >
                        <label>
                          <span>Tên sản phẩm</span>
                          <input
                            value={name}
                            onChange={(event) => setName(event.target.value)}
                            placeholder="Ví dụ: Gói 1980 Crystal"
                          />
                        </label>
                        <div className="form-pair">
                          <label>
                            <span>Tên game</span>
                            <select
                              value={game}
                              onChange={(event) => setGame(event.target.value)}
                            >
                              {games.map((item) => (
                                <option key={item}>{item}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            <span>Giá bán</span>
                            <input
                              type="number"
                              min={1}
                              max={9_999_999_999}
                              step={1}
                              value={price}
                              onChange={(event) => setPrice(event.target.value)}
                              placeholder="299000"
                            />
                          </label>
                        </div>
                        <label>
                          <span>Ghi chú góc phải</span>
                          <input
                            value={note}
                            onChange={(event) => setNote(event.target.value)}
                            placeholder="Ví dụ: Bán chạy"
                          />
                        </label>
                        <fieldset className="tag-picker">
                          <legend>Gắn tag danh mục (Không bắt buộc)</legend>
                          {categories
                            .filter((item) => item !== "Tất cả")
                            .map((item) => (
                              <label key={item}>
                                <input
                                  type="checkbox"
                                  checked={selectedTags.includes(item)}
                                  onChange={() => toggleTag(item)}
                                />
                                <span>{item}</span>
                              </label>
                            ))}
                        </fieldset>
                        <AdminImagePicker
                          value={image}
                          onChange={(newImg) => setImage(newImg)}
                          label="Ảnh sản phẩm"
                          galleryImages={existingGalleryImages}
                        />
                        {image && (
                          <div className="image-crop-controls">
                            <div>
                              <span>
                                Kéo trực tiếp ảnh trên card để chọn vùng hiển
                                thị
                              </span>
                              <b>
                                {imageX}% · {imageY}%
                              </b>
                            </div>
                            <div className="crop-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setImageX(50)
                                  setImageY(50)
                                }}
                              >
                                Đặt lại vị trí
                              </button>
                              <button
                                type="button"
                                onClick={() => setImage("")}
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        )}
                        <label className="product-status-select">
                          <span>Trạng thái sản phẩm</span>
                          <select
                            value={productStatusId}
                            onChange={(event) =>
                              setProductStatusId(event.target.value)
                            }
                          >
                            {productStatuses.map((status) => (
                              <option key={status.id} value={status.id}>
                                {status.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="product-status-select">
                          <span>Mẫu thông tin người dùng cần cung cấp</span>
                          <select
                            value={productTemplateId}
                            onChange={(event) =>
                              setProductTemplateId(event.target.value)
                            }
                          >
                            <option value="">Chọn mẫu thông tin nạp</option>
                            {topupTemplates.map((template) => (
                              <option key={template.id} value={template.id}>
                                {template.name}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="modal-availability" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px", margin: "10px 0" }}>
                          <input
                            type="checkbox"
                            checked={productIsActive}
                            onChange={(e) => setProductIsActive(e.target.checked)}
                            style={{ width: "auto", accentColor: "#39dbf8" }}
                          />
                          <span>Bật hiển thị gói nạp này trên website (đang {productIsActive ? "Hiện" : "Ẩn"})</span>
                        </label>
                        {productFormError && (
                          <span className="admin-form-message error">
                            {productFormError}
                          </span>
                        )}
                        <div className="product-modal-actions">
                          <button
                            type="button"
                            onClick={() => setAddProductOpen(false)}
                          >
                            Hủy
                          </button>
                          <button className="primary-button" type="submit" disabled={savingProduct}>
                            <Icon
                              name={
                                editingProductId === null ? "plus" : "check"
                              }
                              size={17}
                            />{" "}
                            {editingProductId === null
                              ? "Thêm sản phẩm"
                              : "Lưu thay đổi"}
                          </button>
                        </div>
                      </form>
                      <div className="modal-preview">
                        <div>
                          <span className="section-kicker">XEM TRƯỚC</span>
                          <p>
                            {image
                              ? "Giữ và kéo ảnh để chọn đúng vùng muốn hiển thị."
                              : "Chọn ảnh để xem trước và điều chỉnh vùng hiển thị."}
                          </p>
                        </div>
                        <div className="preview-card-wrap">
                          <ProductCard
                            product={previewProduct}
                            productStatuses={productStatuses}
                            onBuy={() => undefined}
                            onImagePositionChange={(x, y) => {
                              setImageX(x)
                              setImageY(y)
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : tab === "templates" ? (
            <TopupTemplateManager
              templates={topupTemplates}
              products={products}
              services={services || []}
              games={games}
              onAdd={onAddTopupTemplate}
              onUpdate={onUpdateTopupTemplate}
              onDelete={onDeleteTopupTemplate}
            />
          ) : tab === "statuses" ? (
            <ProductStatusManager
              statuses={productStatuses}
              products={products}
              onAdd={onAddProductStatus}
              onDelete={onDeleteProductStatus}
            />
          ) : tab === "analytics" ? (
            <AdminAnalytics
              transactions={transactions}
              games={games}
              services={services}
              onNavigateToTransactions={() => selectTab("transactions")}
            />
          ) : tab === "transactions" ? (
            <AdminTransactions
              transactions={transactions}
              onUpdate={onUpdateTransaction}
              onViewAnalytics={() => selectTab("analytics")}
            />
          ) : tab === "users" ? (
            <AdminUsers users={users} onUpdate={onUpdateUser} />
          ) : tab === "categories" ? (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Danh mục & tag phân loại</h2>
                  <p>
                    Quản lý các tag gán cho sản phẩm/gói nạp và xuất hiện trên bộ lọc (ví dụ: hot, value, starter, monthly, nạp game...).
                  </p>
                </div>
              </div>
              <form
                className="category-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (newCategory.trim()) {
                    onAddCategory(newCategory.trim())
                    setNewCategory("")
                  }
                }}
              >
                <label>
                  <span>Tên tag mới</span>
                  <input
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="Ví dụ: hot, value, starter, thẻ tháng..."
                  />
                </label>
                <button className="primary-button" type="submit">
                  <Icon name="plus" size={18} /> Thêm tag
                </button>
              </form>
              <div className="tag-manager">
                {categories.map((item) => {
                  const usage = products.filter((p) => p.tags.includes(item)).length
                  const isAll = item === "Tất cả"
                  const isEditing = editingTag?.oldName === item

                  if (isEditing) {
                    return (
                      <div key={item} className="tag-manager-item editing">
                        <form
                          className="tag-manager-edit-form"
                          onSubmit={async (e) => {
                            e.preventDefault()
                            if (editingTag && editingTag.name.trim()) {
                              if (onUpdateCategory) {
                                await onUpdateCategory(editingTag.oldName, editingTag.name.trim())
                              }
                              setEditingTag(null)
                            }
                          }}
                        >
                          <input
                            autoFocus
                            value={editingTag.name}
                            onChange={(e) =>
                              setEditingTag({ ...editingTag, name: e.target.value })
                            }
                            placeholder="Nhập tên tag mới..."
                          />
                          <button
                            type="submit"
                            className="primary-button"
                            style={{ height: "34px", padding: "0 10px", fontSize: "10px" }}
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            style={{
                              height: "34px",
                              padding: "0 8px",
                              fontSize: "10px",
                              background: "transparent",
                              color: "#8490a3",
                              border: "1px solid #293449",
                              borderRadius: "7px",
                            }}
                            onClick={() => setEditingTag(null)}
                          >
                            Hủy
                          </button>
                        </form>
                      </div>
                    )
                  }

                  return (
                    <div key={item} className="tag-manager-item">
                      <div className="tag-manager-info">
                        <Icon name="grid" size={17} />
                        <div>
                          <strong>{item}</strong>
                          {isAll ? (
                            <small style={{ color: "#38dbf8", display: "block" }}>Bộ lọc mặc định</small>
                          ) : (
                            <small style={{ color: "#626e82", display: "block" }}>{usage} gói nạp đang dùng</small>
                          )}
                        </div>
                      </div>
                      {!isAll && (
                        <div className="tag-manager-actions">
                          <button
                            type="button"
                            onClick={() => setEditingTag({ oldName: item, name: item })}
                            title={`Sửa tag "${item}"`}
                            aria-label={`Sửa tag ${item}`}
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="tag-delete"
                            onClick={() => {
                              const confirmMsg =
                                usage > 0
                                  ? `Bạn có chắc chắn muốn xóa tag "${item}"?\n\nTag này đang được gắn trên ${usage} gói nạp và sẽ được gỡ bỏ khỏi các gói đó.`
                                  : `Bạn có chắc chắn muốn xóa tag "${item}" không?`
                              if (window.confirm(confirmMsg)) {
                                onDeleteCategory(item)
                              }
                            }}
                            title={`Xóa tag "${item}"`}
                            aria-label={`Xóa tag ${item}`}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          ) : tab === "games" ? (
            <>
              <div className="panel-heading">
                <div>
                  <h2>Danh sách game</h2>
                  <p>
                    Danh sách này được dùng trong ô chọn game khi thêm sản phẩm.
                  </p>
                </div>
              </div>
              <form
                className="category-form game-add-form"
                onSubmit={async (event) => {
                  event.preventDefault()
                  if (!newGame.trim()) return
                  const gameTitle = newGame.trim()
                  if (newGameCreateTopup && onAddService) {
                    await onAddService({
                      name: gameTitle,
                      game: gameTitle,
                      category: "topup",
                      description: `Dịch vụ nạp ${gameTitle}`,
                      iconText: gameTitle.slice(0, 3).toUpperCase(),
                      tone: "cyan",
                      sortOrder: services.length,
                      isActive: true,
                    })
                  }
                  if (newGameCreateBoosting && onAddService) {
                    await onAddService({
                      name: gameTitle,
                      game: gameTitle,
                      category: "boosting",
                      description: `Dịch vụ cày thuê ${gameTitle}`,
                      iconText: gameTitle.slice(0, 3).toUpperCase(),
                      tone: "cyan",
                      sortOrder: services.length + 1,
                      isActive: true,
                    })
                  }
                  if (!newGameCreateTopup && !newGameCreateBoosting) {
                    onAddGame(gameTitle)
                  }
                  setNewGame("")
                  if (!game) setGame(gameTitle)
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", flex: 1 }}>
                  <label>
                    <span>Tên game mới</span>
                    <input
                      value={newGame}
                      onChange={(event) => setNewGame(event.target.value)}
                      placeholder="Ví dụ: Arknights: Endfield"
                      required
                    />
                  </label>
                  <div style={{ display: "flex", gap: "16px", fontSize: "11px", color: "#a5afbf" }}>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newGameCreateTopup}
                        onChange={(e) => setNewGameCreateTopup(e.target.checked)}
                        style={{ accentColor: "#39dbf8" }}
                      />
                      <span>Tạo mục Nạp game</span>
                    </label>
                    <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={newGameCreateBoosting}
                        onChange={(e) => setNewGameCreateBoosting(e.target.checked)}
                        style={{ accentColor: "#39dbf8" }}
                      />
                      <span>Tạo mục Cày thuê</span>
                    </label>
                  </div>
                </div>
                <button className="primary-button" style={{ height: "42px" }}>
                  <Icon name="plus" size={18} /> Thêm game
                </button>
              </form>

              <div
                className="game-manager-filter-bar"
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "8px",
                  margin: "18px 0 12px",
                }}
              >
                <button
                  type="button"
                  className={`admin-filter-pill ${gameFilter === "all" ? "active" : ""}`}
                  onClick={() => setGameFilter("all")}
                >
                  Tất cả ({games.length})
                </button>
                <button
                  type="button"
                  className={`admin-filter-pill ${gameFilter === "topup" ? "active" : ""}`}
                  onClick={() => setGameFilter("topup")}
                >
                  🎮 Có Nạp game (
                  {services.filter((s) => s.category !== "boosting").length})
                </button>
                <button
                  type="button"
                  className={`admin-filter-pill ${gameFilter === "boosting" ? "active" : ""}`}
                  onClick={() => setGameFilter("boosting")}
                >
                  ⚔️ Có Cày thuê (
                  {services.filter((s) => s.category === "boosting").length})
                </button>
                <button
                  type="button"
                  className={`admin-filter-pill ${gameFilter === "hiddenTopup" ? "active" : ""}`}
                  onClick={() => setGameFilter("hiddenTopup")}
                >
                  🚫 Đang ẩn Nạp (
                  {
                    services.filter(
                      (s) => s.category !== "boosting" && s.isActive === false,
                    ).length
                  }
                  )
                </button>
                <button
                  type="button"
                  className={`admin-filter-pill ${gameFilter === "hiddenBoosting" ? "active" : ""}`}
                  onClick={() => setGameFilter("hiddenBoosting")}
                >
                  🚫 Đang ẩn Cày thuê (
                  {
                    services.filter(
                      (s) => s.category === "boosting" && s.isActive === false,
                    ).length
                  }
                  )
                </button>
              </div>

              <div className="tag-manager game-manager">
                {games
                  .filter((item) => {
                    const topupSvc = services.find(
                      (s) =>
                        (s.name === item || s.game === item) &&
                        s.category !== "boosting",
                    )
                    const boostSvc = services.find(
                      (s) =>
                        (s.name === item || s.game === item) &&
                        s.category === "boosting",
                    )
                    if (gameFilter === "topup") return !!topupSvc
                    if (gameFilter === "boosting") return !!boostSvc
                    if (gameFilter === "hiddenTopup")
                      return topupSvc && topupSvc.isActive === false
                    if (gameFilter === "hiddenBoosting")
                      return boostSvc && boostSvc.isActive === false
                    return true
                  })
                  .map((item) => {
                    const topupService = services.find(
                      (entry) =>
                        (entry.name === item || entry.game === item) &&
                        entry.category !== "boosting",
                    )
                    const boostingService = services.find(
                      (entry) =>
                        (entry.name === item || entry.game === item) &&
                        entry.category === "boosting",
                    )
                    const mainService = topupService || boostingService
                    const topupPkgCount =
                      topupService?.packageCount ??
                      products.filter((p) => p.game === item).length
                    const boostingPkgCount =
                      boostingService?.packageCount ?? 0

                    return (
                      <div key={item} className="tag-manager-item game-manager-card">
                        <div className="tag-manager-info">
                          <Icon name="game" size={18} />
                          <div>
                            <strong>{item}</strong>
                            <div
                              className="game-service-status-row"
                              style={{
                                display: "flex",
                                flexWrap: "wrap",
                                gap: "6px",
                                marginTop: "5px",
                              }}
                            >
                              {topupService ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background:
                                      topupService.isActive !== false
                                        ? "rgba(74, 224, 168, 0.12)"
                                        : "rgba(239, 117, 135, 0.12)",
                                    color:
                                      topupService.isActive !== false
                                        ? "#4ae0a8"
                                        : "#ef7587",
                                    border: `1px solid ${
                                      topupService.isActive !== false
                                        ? "rgba(74, 224, 168, 0.25)"
                                        : "rgba(239, 117, 135, 0.25)"
                                    }`,
                                  }}
                                >
                                  🎮 Nạp:{" "}
                                  {topupService.isActive !== false ? "Hiện" : "Ẩn"}{" "}
                                  ({topupPkgCount} gói)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background: "rgba(100, 116, 139, 0.1)",
                                    color: "#78859b",
                                    border:
                                      "1px dashed rgba(100, 116, 139, 0.25)",
                                  }}
                                >
                                  🎮 Nạp: Chưa tạo
                                </span>
                              )}
                              {boostingService ? (
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "9px",
                                    fontWeight: 600,
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background:
                                      boostingService.isActive !== false
                                        ? "rgba(56, 219, 248, 0.12)"
                                        : "rgba(239, 117, 135, 0.12)",
                                    color:
                                      boostingService.isActive !== false
                                        ? "#38dbf8"
                                        : "#ef7587",
                                    border: `1px solid ${
                                      boostingService.isActive !== false
                                        ? "rgba(56, 219, 248, 0.25)"
                                        : "rgba(239, 117, 135, 0.25)"
                                    }`,
                                  }}
                                >
                                  ⚔️ Cày:{" "}
                                  {boostingService.isActive !== false
                                    ? "Hiện"
                                    : "Ẩn"}{" "}
                                  ({boostingPkgCount} gói)
                                </span>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "9px",
                                    padding: "2px 7px",
                                    borderRadius: "5px",
                                    background: "rgba(100, 116, 139, 0.1)",
                                    color: "#78859b",
                                    border:
                                      "1px dashed rgba(100, 116, 139, 0.25)",
                                  }}
                                >
                                  ⚔️ Cày: Chưa tạo
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="tag-manager-actions">
                          {/* Nút Ẩn/Hiện riêng cho Nạp game */}
                          {topupService && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdateService) {
                                  void onUpdateService(topupService.id, {
                                    isActive: !topupService.isActive,
                                  })
                                } else {
                                  onUpdateGame(item, {
                                    isActive: !topupService.isActive,
                                  })
                                }
                              }}
                              title={
                                topupService.isActive !== false
                                  ? `Nạp game: Đang HIỆN - Bấm để ẨN khỏi trang Nạp game`
                                  : `Nạp game: Đang ẨN - Bấm để HIỂN THỊ trên trang Nạp game`
                              }
                              style={{
                                width: "auto",
                                padding: "0 8px",
                                height: "28px",
                                gap: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                fontSize: "10px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                color:
                                  topupService.isActive !== false
                                    ? "#4ae0a8"
                                    : "#ef7587",
                                background:
                                  topupService.isActive !== false
                                    ? "rgba(74, 224, 168, 0.08)"
                                    : "rgba(239, 117, 135, 0.08)",
                                border: `1px solid ${
                                  topupService.isActive !== false
                                    ? "rgba(74, 224, 168, 0.2)"
                                    : "rgba(239, 117, 135, 0.2)"
                                }`,
                              }}
                            >
                              <Icon
                                name={
                                  topupService.isActive !== false ? "eye" : "eye-off"
                                }
                                size={13}
                              />
                              <span>Nạp</span>
                            </button>
                          )}
                          {/* Nút Ẩn/Hiện riêng cho Cày thuê */}
                          {boostingService ? (
                            <button
                              type="button"
                              onClick={() => {
                                if (onUpdateService) {
                                  void onUpdateService(boostingService.id, {
                                    isActive: !boostingService.isActive,
                                  })
                                }
                              }}
                              title={
                                boostingService.isActive !== false
                                  ? `Cày thuê: Đang HIỆN - Bấm để ẨN khỏi trang Cày thuê`
                                  : `Cày thuê: Đang ẨN - Bấm để HIỂN THỊ trên trang Cày thuê`
                              }
                              style={{
                                width: "auto",
                                padding: "0 8px",
                                height: "28px",
                                gap: "4px",
                                display: "inline-flex",
                                alignItems: "center",
                                fontSize: "10px",
                                fontWeight: 600,
                                borderRadius: "6px",
                                color:
                                  boostingService.isActive !== false
                                    ? "#38dbf8"
                                    : "#ef7587",
                                background:
                                  boostingService.isActive !== false
                                    ? "rgba(56, 219, 248, 0.08)"
                                    : "rgba(239, 117, 135, 0.08)",
                                border: `1px solid ${
                                  boostingService.isActive !== false
                                    ? "rgba(56, 219, 248, 0.2)"
                                    : "rgba(239, 117, 135, 0.2)"
                                }`,
                              }}
                            >
                              <Icon
                                name={
                                  boostingService.isActive !== false
                                    ? "eye"
                                    : "eye-off"
                                }
                                size={13}
                              />
                              <span>Cày</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={async () => {
                                if (onAddService) {
                                  await onAddService({
                                    name: item,
                                    game: item,
                                    category: "boosting",
                                    description: `Dịch vụ cày thuê ${item}`,
                                    iconText: item.slice(0, 3).toUpperCase(),
                                    tone: "cyan",
                                    sortOrder: services.length + 1,
                                    isActive: true,
                                  })
                                }
                              }}
                              title={`Tạo dịch vụ Cày thuê cho ${item}`}
                              style={{
                                width: "auto",
                                padding: "0 7px",
                                height: "28px",
                                fontSize: "10px",
                                borderRadius: "6px",
                                color: "#38dbf8",
                                background: "rgba(56, 219, 248, 0.06)",
                                border: "1px dashed rgba(56, 219, 248, 0.25)",
                              }}
                            >
                              + Cày
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingGame(item)
                              setGameName(mainService?.name || item)
                              setGameKey(mainService?.game || item)
                              setGameDescription(mainService?.description || "")
                              setGameTone(mainService?.tone || "blue")
                              setGameSortOrder(String(mainService?.sortOrder ?? 0))
                              setGameImage(mainService?.image || "")
                              const pos = (
                                mainService?.imagePosition || "50% 50%"
                              )
                                .split(" ")
                                .map(Number)
                              setGameImageX(!isNaN(pos[0]) ? pos[0] : 50)
                              setGameImageY(!isNaN(pos[1]) ? pos[1] : 50)
                              setTopupIsActive(
                                topupService
                                  ? topupService.isActive !== false
                                  : false,
                              )
                              setBoostingIsActive(
                                boostingService
                                  ? boostingService.isActive !== false
                                  : false,
                              )
                            }}
                            title={`Chỉnh sửa game "${item}"`}
                            aria-label={`Sửa ${item}`}
                          >
                            <Icon name="edit" size={15} />
                          </button>
                          <button
                            type="button"
                            className="tag-delete"
                            onClick={() => {
                              const confirmMsg = `Bạn có chắc chắn muốn xóa toàn bộ dịch vụ của game "${item}" không?`
                              if (window.confirm(confirmMsg)) {
                                onDeleteGame(item)
                                if (game === item)
                                  setGame(
                                    games.find((entry) => entry !== item) || "",
                                  )
                              }
                            }}
                            title={`Xóa game "${item}"`}
                            aria-label={`Xóa ${item}`}
                          >
                            <Icon name="trash" size={15} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
              </div>

              {editingGame !== null && (
                <div
                  className="product-modal-backdrop"
                  onMouseDown={(event) =>
                    event.target === event.currentTarget && setEditingGame(null)
                  }
                >
                  <div className="product-modal">
                    <div className="product-modal-head">
                      <div>
                        <span className="section-kicker">CẤU HÌNH DỊCH VỤ GAME</span>
                        <h2>Chỉnh sửa game: {editingGame}</h2>
                      </div>
                      <button
                        type="button"
                        onClick={() => setEditingGame(null)}
                        aria-label="Đóng"
                      >
                        <Icon name="close" size={20} />
                      </button>
                    </div>
                    <form
                      className="product-modal-body"
                      onSubmit={async (e) => {
                        e.preventDefault()
                        if (!gameName.trim()) return

                        const topupSvc = services.find(
                          (entry) =>
                            (entry.name === editingGame ||
                              entry.game === editingGame) &&
                            entry.category !== "boosting",
                        )
                        const boostSvc = services.find(
                          (entry) =>
                            (entry.name === editingGame ||
                              entry.game === editingGame) &&
                            entry.category === "boosting",
                        )
                        const commonUpdates = {
                          name: gameName.trim(),
                          game: gameKey.trim() || gameName.trim(),
                          description: gameDescription.trim(),
                          tone: gameTone,
                          sortOrder: Number(gameSortOrder) || 0,
                          image: gameImage.trim() || undefined,
                          imagePosition: `${gameImageX}% ${gameImageY}%`,
                        }

                        try {
                          if (topupSvc && onUpdateService) {
                            await onUpdateService(topupSvc.id, {
                              ...commonUpdates,
                              isActive: topupIsActive,
                            })
                          } else if (!topupSvc && topupIsActive && onAddService) {
                            await onAddService({
                              ...commonUpdates,
                              category: "topup",
                              iconText: gameName.trim().slice(0, 3).toUpperCase(),
                              isActive: true,
                            })
                          }

                          if (boostSvc && onUpdateService) {
                            await onUpdateService(boostSvc.id, {
                              ...commonUpdates,
                              isActive: boostingIsActive,
                            })
                          } else if (!boostSvc && boostingIsActive && onAddService) {
                            await onAddService({
                              ...commonUpdates,
                              category: "boosting",
                              iconText: gameName.trim().slice(0, 3).toUpperCase(),
                              isActive: true,
                            })
                          }

                          setEditingGame(null)
                        } catch (err: any) {
                          alert("Lưu thông tin game thất bại: " + (err?.message || "Lỗi mạng hoặc hệ thống"))
                        }
                      }}
                    >
                      <div className="product-create-form">
                        <div className="form-pair">
                          <label>
                            <span>Tên hiển thị của game</span>
                            <input
                              value={gameName}
                              onChange={(e) => setGameName(e.target.value)}
                              placeholder="Ví dụ: Honkai: Star Rail"
                              required
                            />
                          </label>
                          <label>
                            <span>Mã định danh (Key/Slug)</span>
                            <input
                              value={gameKey}
                              onChange={(e) => setGameKey(e.target.value)}
                              placeholder="Ví dụ: honkai-star-rail"
                            />
                          </label>
                        </div>

                        <div className="form-pair">
                          <label>
                            <span>Tone màu chủ đạo</span>
                            <select
                              value={gameTone}
                              onChange={(e) => setGameTone(e.target.value)}
                            >
                              <option value="cyan">Cyan (Xanh lơ)</option>
                              <option value="blue">Blue (Xanh dương)</option>
                              <option value="violet">Violet (Tím)</option>
                              <option value="yellow">Yellow (Vàng kim)</option>
                              <option value="amber">Amber (Cam hổ phách)</option>
                              <option value="red">Red (Đỏ)</option>
                              <option value="pink">Pink (Hồng)</option>
                              <option value="emerald">Emerald (Xanh ngọc)</option>
                            </select>
                          </label>
                          <label>
                            <span>Thứ tự sắp xếp</span>
                            <input
                              type="number"
                              value={gameSortOrder}
                              onChange={(e) => setGameSortOrder(e.target.value)}
                              placeholder="0, 1, 2..."
                            />
                          </label>
                        </div>

                        <label>
                          <span>Mô tả game</span>
                          <input
                            value={gameDescription}
                            onChange={(e) => setGameDescription(e.target.value)}
                            placeholder="Mô tả tóm tắt dịch vụ cho game..."
                          />
                        </label>

                        <AdminImagePicker
                          value={gameImage}
                          onChange={(newImg) => setGameImage(newImg)}
                          label="Ảnh đại diện game"
                          galleryImages={existingGalleryImages}
                        />

                        {gameImage && (
                          <div className="image-crop-controls">
                            <div>
                              <span>
                                Kéo trực tiếp ảnh trên card để chọn vùng hiển thị
                              </span>
                              <b>
                                {gameImageX}% · {gameImageY}%
                              </b>
                            </div>
                            <div className="crop-actions">
                              <button
                                type="button"
                                onClick={() => {
                                  setGameImageX(50)
                                  setGameImageY(50)
                                }}
                              >
                                Đặt lại vị trí
                              </button>
                              <button
                                type="button"
                                onClick={() => setGameImage("")}
                              >
                                Xóa ảnh
                              </button>
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            padding: "14px",
                            border: "1px solid #232d40",
                            borderRadius: "10px",
                            background: "rgba(10, 16, 28, 0.6)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "10px",
                          }}
                        >
                          <span
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#38dbf8",
                              textTransform: "uppercase",
                              letterSpacing: "0.5px",
                            }}
                          >
                            Trạng thái hiển thị theo từng dịch vụ:
                          </span>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr",
                              gap: "10px",
                            }}
                          >
                            <label
                              style={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "9px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: topupIsActive
                                  ? "rgba(74, 224, 168, 0.08)"
                                  : "rgba(239, 117, 135, 0.06)",
                                border: `1px solid ${
                                  topupIsActive
                                    ? "rgba(74, 224, 168, 0.25)"
                                    : "rgba(239, 117, 135, 0.2)"
                                }`,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={topupIsActive}
                                onChange={(e) => setTopupIsActive(e.target.checked)}
                                style={{ width: "auto", accentColor: "#4ae0a8" }}
                              />
                              <div>
                                <strong
                                  style={{
                                    fontSize: "12px",
                                    display: "block",
                                    color: "#e3e9f4",
                                  }}
                                >
                                  🎮 Mục Nạp game
                                </strong>
                                <small
                                  style={{
                                    fontSize: "10px",
                                    color: topupIsActive ? "#4ae0a8" : "#ef7587",
                                  }}
                                >
                                  {topupIsActive
                                    ? "Đang hiện trên web"
                                    : "Đang ẩn khỏi web"}
                                </small>
                              </div>
                            </label>
                            <label
                              style={{
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                gap: "9px",
                                padding: "10px 12px",
                                borderRadius: "8px",
                                background: boostingIsActive
                                  ? "rgba(56, 219, 248, 0.08)"
                                  : "rgba(239, 117, 135, 0.06)",
                                border: `1px solid ${
                                  boostingIsActive
                                    ? "rgba(56, 219, 248, 0.25)"
                                    : "rgba(239, 117, 135, 0.2)"
                                }`,
                              }}
                            >
                              <input
                                type="checkbox"
                                checked={boostingIsActive}
                                onChange={(e) =>
                                  setBoostingIsActive(e.target.checked)
                                }
                                style={{ width: "auto", accentColor: "#38dbf8" }}
                              />
                              <div>
                                <strong
                                  style={{
                                    fontSize: "12px",
                                    display: "block",
                                    color: "#e3e9f4",
                                  }}
                                >
                                  ⚔️ Mục Cày thuê
                                </strong>
                                <small
                                  style={{
                                    fontSize: "10px",
                                    color: boostingIsActive
                                      ? "#38dbf8"
                                      : "#ef7587",
                                  }}
                                >
                                  {boostingIsActive
                                    ? "Đang hiện trên web"
                                    : "Đang ẩn khỏi web"}
                                </small>
                              </div>
                            </label>
                          </div>
                        </div>

                        <div
                          className="product-modal-actions"
                          style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end", gap: "8px" }}
                        >
                          <button type="button" onClick={() => setEditingGame(null)}>
                            Hủy
                          </button>
                          <button type="submit" className="primary-button">
                            <Icon name="check" size={17} /> Lưu thay đổi
                          </button>
                        </div>
                      </div>

                      <div className="modal-preview">
                        <div>
                          <span className="section-kicker">XEM TRƯỚC</span>
                          <p>
                            {gameImage
                              ? "Giữ và kéo ảnh trên card để chọn đúng vùng muốn hiển thị."
                              : "Chọn ảnh để xem trước và điều chỉnh vùng hiển thị."}
                          </p>
                        </div>
                        <div className="preview-card-wrap">
                          <ServiceCard
                            service={{
                              id: 0,
                              name: gameName || "Tên game",
                              description: gameDescription,
                              iconText: (gameName || "GAME").slice(0, 3).toUpperCase(),
                              tone: gameTone,
                              image: gameImage || undefined,
                              imagePosition: `${gameImageX}% ${gameImageY}%`,
                              isActive: gameIsActive,
                              sortOrder: Number(gameSortOrder) || 0,
                            }}
                            onImagePositionChange={(x, y) => {
                              setGameImageX(x)
                              setGameImageY(y)
                            }}
                          />
                        </div>
                      </div>
                    </form>
                  </div>
                </div>
              )}
            </>
          ) : tab === "wiki" ? (
            <Suspense fallback={<p>Loading Wiki...</p>}><AdminWikiManager /></Suspense>
          ) : tab === "middleman" ? (
            <MiddlemanAdminEditor
              info={middlemanInfo}
              onChange={onUpdateMiddleman}
            />
          ) : tab === "contacts" ? (
            <ContactAdminEditor info={contactInfo} onChange={onUpdateContact} />
          ) : tab === "footer" ? (
            <FooterAdminEditor config={footerConfig} onChange={onUpdateFooter} />
          ) : tab === "audit" ? (
            <AuditLogManager />
          ) : tab === "anomalies" ? (
            <PaymentAnomalyManager />
          ) : (
            <AdminAccount
              initialName={adminName}
              initialEmail={adminEmail}
              onUpdateProfile={onUpdateProfile}
              onChangePassword={onChangePassword}
            />
          )}
        </div>
      </div>
    </section>
  )
}

export function TopupTemplateManager({
  templates,
  products,
  games,
  onAdd,
  onUpdate,
  onDelete,
}: {
  templates: TopupTemplate[]
  products: Product[]
  services: Service[]
  games: string[]
  onAdd: (template: TopupTemplate) => void
  onUpdate: (id: string, template: TopupTemplate) => void
  onDelete: (id: string) => Promise<boolean>
}) {
  const [draft, setDraft] = useState<TopupTemplate | null>(null)
  const [error, setError] = useState("")
  const fieldTypes: { value: TopupFieldType; label: string }[] = [
    { value: "text", label: "Văn bản" },
    { value: "number", label: "Chỉ nhập số" },
    { value: "email", label: "Email" },
    { value: "select", label: "Danh sách lựa chọn" },
    { value: "textarea", label: "Nội dung dài" },
  ]

  const newTemplate = (): TopupTemplate => ({
    id: `template-${Date.now()}`,
    name: "",
    game: games[0] || "",
    description: "",
    warning: "",
    fields: [],
  })
  const updateField = (id: string, updates: Partial<TopupField>) =>
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: current.fields.map((field) =>
              field.id === id ? { ...field, ...updates } : field,
            ),
          }
        : current,
    )
  const addField = () =>
    setDraft((current) =>
      current
        ? {
            ...current,
            fields: [
              ...current.fields,
              {
                id: `field-${Date.now()}`,
                key: `field_${current.fields.length + 1}`,
                label: "Trường thông tin mới",
                type: "text",
                required: true,
                placeholder: "",
                helpText: "",
                options: [],
              },
            ],
          }
        : current,
    )
  const moveField = (index: number, direction: -1 | 1) =>
    setDraft((current) => {
      if (!current) return current
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= current.fields.length) return current
      const fields = [...current.fields]
      ;[fields[index], fields[nextIndex]] = [fields[nextIndex], fields[index]]
      return { ...current, fields }
    })
  const save = async () => {
    if (!draft) return
    if (!draft.name.trim() || !draft.game || draft.fields.length === 0)
      return setError("Mẫu cần có tên, game và ít nhất một trường thông tin.")
    if (draft.fields.some((field) => !field.label.trim() || !field.key.trim()))
      return setError("Mỗi trường cần có nhãn và mã dữ liệu.")
    const normalized = {
      ...draft,
      name: draft.name.trim(),
      fields: draft.fields.map((field) => ({
        ...field,
        key: field.key.trim().replace(/\s+/g, "_"),
      })),
    }
    try {
    if (templates.some((item) => item.id === draft.id))
      await onUpdate(draft.id, normalized)
    else await onAdd(normalized)
    setDraft(null)
    setError("")
    } catch (error) { setError(error instanceof Error ? error.message : "Không thể lưu mẫu thông tin.") }
  }

  return (
    <div className="template-manager">
      <div className="data-page-heading">
        <div>
          <h2>Mẫu thông tin nạp</h2>
          <p>
            Thiết kế các trường mà người dùng phải cung cấp cho từng game hoặc
            phương thức nạp.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => {
            setDraft(newTemplate())
            setError("")
          }}
        >
          <Icon name="plus" size={17} /> Tạo mẫu
        </button>
      </div>
      <div className="template-list">
        {templates.map((template) => {
          const usage = products.filter(
            (product) => product.templateId === template.id,
          ).length
          return (
            <div className="template-card" key={template.id}>
              <span className="template-card-icon">
                <Icon name="grid" size={19} />
              </span>
              <span>
                <small>{template.game}</small>
                <strong>{template.name}</strong>
                <em>
                  {template.fields.length} trường · {usage} sản phẩm đang dùng
                </em>
              </span>
              <button
                onClick={() => {
                  setDraft({
                    ...template,
                    fields: template.fields.map((field) => ({
                      ...field,
                      options: [...field.options],
                    })),
                  })
                  setError("")
                }}
              >
                <Icon name="edit" size={17} /> Sửa
              </button>
              <button
                type="button"
                disabled={usage > 0}
                onClick={() => {
                  const confirmMsg = `Bạn có chắc chắn muốn xóa mẫu thông tin "${template.name}" không?`
                  if (window.confirm(confirmMsg)) {
                    onDelete(template.id)
                  }
                }}
                title={
                  usage > 0
                    ? `Đang có ${usage} gói nạp sử dụng. Chuyển các gói sang mẫu khác trước khi xóa.`
                    : "Xóa mẫu thông tin"
                }
                aria-label={`Xóa mẫu ${template.name}`}
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
          )
        })}
      </div>
      {draft && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setDraft(null)
          }
        >
          <div className="product-modal template-modal">
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">FORM BUILDER</span>
                <h2>
                  {templates.some((item) => item.id === draft.id)
                    ? "Chỉnh sửa mẫu"
                    : "Tạo mẫu thông tin nạp"}
                </h2>
              </div>
              <button onClick={() => setDraft(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="template-editor">
              <div className="template-general-fields">
                <label>
                  <span>Tên mẫu</span>
                  <input
                    value={draft.name}
                    onChange={(event) =>
                      setDraft({ ...draft, name: event.target.value })
                    }
                    placeholder="Ví dụ: Genshin · Nạp qua UID"
                  />
                </label>
                <label>
                  <span>Game</span>
                  <select
                    value={draft.game}
                    onChange={(event) =>
                      setDraft({ ...draft, game: event.target.value })
                    }
                  >
                    {games.map((game) => (
                      <option key={game}>{game}</option>
                    ))}
                  </select>
                </label>
                <label className="wide">
                  <span>Mô tả hướng dẫn</span>
                  <textarea
                    value={draft.description}
                    onChange={(event) =>
                      setDraft({ ...draft, description: event.target.value })
                    }
                    placeholder="Giải thích mẫu này dùng trong trường hợp nào..."
                  />
                </label>
                <label className="wide">
                  <span>Cảnh báo người dùng</span>
                  <textarea
                    value={draft.warning}
                    onChange={(event) =>
                      setDraft({ ...draft, warning: event.target.value })
                    }
                    placeholder="Ví dụ: Không cung cấp mật khẩu hoặc OTP..."
                  />
                </label>
              </div>
              <div className="template-fields-heading">
                <div>
                  <h3>Các trường thông tin</h3>
                  <span>Kéo thứ tự bằng nút lên/xuống</span>
                </div>
                <button onClick={addField}>
                  <Icon name="plus" size={16} /> Thêm trường
                </button>
              </div>
              <div className="template-field-list">
                {draft.fields.map((field, index) => (
                  <div className="template-field-card" key={field.id}>
                    <div className="field-order">
                      <strong>{index + 1}</strong>
                      <button
                        disabled={index === 0}
                        onClick={() => moveField(index, -1)}
                      >
                        ↑
                      </button>
                      <button
                        disabled={index === draft.fields.length - 1}
                        onClick={() => moveField(index, 1)}
                      >
                        ↓
                      </button>
                    </div>
                    <div className="field-editor-grid">
                      <label>
                        <span>Nhãn hiển thị</span>
                        <input
                          value={field.label}
                          onChange={(event) =>
                            updateField(field.id, { label: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Mã dữ liệu</span>
                        <input
                          value={field.key}
                          onChange={(event) =>
                            updateField(field.id, { key: event.target.value })
                          }
                        />
                      </label>
                      <label>
                        <span>Loại trường</span>
                        <select
                          value={field.type}
                          onChange={(event) =>
                            updateField(field.id, {
                              type: event.target.value as TopupFieldType,
                            })
                          }
                        >
                          {fieldTypes.map((type) => (
                            <option value={type.value} key={type.value}>
                              {type.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        <span>Placeholder</span>
                        <input
                          value={field.placeholder}
                          onChange={(event) =>
                            updateField(field.id, {
                              placeholder: event.target.value,
                            })
                          }
                        />
                      </label>
                      <label className="wide">
                        <span>Hướng dẫn bên dưới</span>
                        <input
                          value={field.helpText}
                          onChange={(event) =>
                            updateField(field.id, {
                              helpText: event.target.value,
                            })
                          }
                        />
                      </label>
                      {field.type === "select" && (
                        <label className="wide">
                          <span>Các lựa chọn, ngăn cách bằng dấu phẩy</span>
                          <input
                            value={field.options.map((option) => typeof option === "string" ? option : option.label).join(", ")}
                            onChange={(event) =>
                              updateField(field.id, {
                                options: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean)
                                  .map((label) => field.options.find((option) => typeof option !== "string" && option.label === label) || label),
                              })
                            }
                          />
                        </label>
                      )}
                      <label className="field-required">
                        <input
                          type="checkbox"
                          checked={field.required}
                          onChange={(event) =>
                            updateField(field.id, {
                              required: event.target.checked,
                            })
                          }
                        />
                        <span>Bắt buộc nhập</span>
                      </label>
                    </div>
                    <button
                      className="delete-template-field"
                      onClick={() =>
                        setDraft({
                          ...draft,
                          fields: draft.fields.filter(
                            (item) => item.id !== field.id,
                          ),
                        })
                      }
                    >
                      <Icon name="trash" size={17} />
                    </button>
                  </div>
                ))}
                {draft.fields.length === 0 && (
                  <div className="admin-empty">
                    <Icon name="grid" size={25} />
                    <span>Chưa có trường nào. Hãy thêm trường đầu tiên.</span>
                  </div>
                )}
              </div>
              {error && (
                <span className="admin-form-message error">{error}</span>
              )}
              <div className="template-editor-actions">
                {templates.some((item) => item.id === draft.id) && (
                  <button
                    type="button"
                    style={{
                      marginRight: "auto",
                      color: "#ff6b81",
                      borderColor: "rgba(255, 107, 129, 0.4)",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                    disabled={products.some((product) => product.templateId === draft.id)}
                    title="Chỉ xóa được mẫu không còn gói sử dụng."
                    onClick={async () => {
                      const confirmMsg = `Bạn có chắc chắn muốn xóa mẫu thông tin "${draft.name}" không?`
                      if (window.confirm(confirmMsg)) {
                        if (await onDelete(draft.id)) setDraft(null)
                      }
                    }}
                  >
                    <Icon name="trash" size={16} /> Xóa mẫu
                  </button>
                )}
                <button onClick={() => setDraft(null)}>Hủy</button>
                <button className="primary-button" onClick={save}>
                  <Icon name="check" size={17} /> Lưu mẫu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function ProductStatusManager({
  statuses,
  products,
  onAdd,
  onDelete,
}: {
  statuses: ProductStatus[]
  products: Product[]
  onAdd: (status: ProductStatus) => void
  onDelete: (id: string) => void
}) {
  const [name, setName] = useState("")
  const [icon, setIcon] = useState<IconName>("check")
  const [color, setColor] = useState<ProductStatus["color"]>("green")
  const [purchasable, setPurchasable] = useState(true)
  const iconOptions: { value: IconName; label: string }[] = [
    { value: "check", label: "Dấu kiểm" },
    { value: "clock", label: "Đồng hồ" },
    { value: "close", label: "Dấu đóng" },
    { value: "shield", label: "Khiên" },
    { value: "spark", label: "Nổi bật" },
    { value: "bag", label: "Túi hàng" },
    { value: "game", label: "Tay cầm" },
  ]

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!name.trim()) return
    onAdd({
      id: `status-${Date.now()}`,
      name: name.trim(),
      icon,
      color,
      purchasable,
    })
    setName("")
    setIcon("check")
    setColor("green")
    setPurchasable(true)
  }

  return (
    <div className="status-manager">
      <div className="panel-heading">
        <div>
          <h2>Trạng thái sản phẩm</h2>
          <p>
            Tạo trạng thái, chọn icon, màu sắc và quyết định người dùng có thể
            mua hay không.
          </p>
        </div>
      </div>
      <form className="status-create-form" onSubmit={submit}>
        <label>
          <span>Tên trạng thái</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Ví dụ: Bảo trì ngắn hạn"
          />
        </label>
        <label>
          <span>Icon</span>
          <select
            value={icon}
            onChange={(event) => setIcon(event.target.value as IconName)}
          >
            {iconOptions.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Màu</span>
          <select
            value={color}
            onChange={(event) =>
              setColor(event.target.value as ProductStatus["color"])
            }
          >
            <option value="green">Xanh lá</option>
            <option value="amber">Vàng</option>
            <option value="red">Đỏ</option>
            <option value="blue">Xanh dương</option>
            <option value="violet">Tím</option>
          </select>
        </label>
        <label className="status-purchasable">
          <input
            type="checkbox"
            checked={purchasable}
            onChange={(event) => setPurchasable(event.target.checked)}
          />
          <span>Cho phép mua</span>
        </label>
        <button className="primary-button">
          <Icon name="plus" size={17} /> Thêm trạng thái
        </button>
      </form>
      <div className="status-list">
        {statuses.map((status) => {
          const usage = products.filter(
            (product) => product.statusId === status.id,
          ).length
          return (
            <div key={status.id}>
              <span className={`status-icon status-${status.color}`}>
                <Icon name={status.icon} size={17} />
              </span>
              <span>
                <strong>{status.name}</strong>
                <small>
                  {usage} sản phẩm ·{" "}
                  {status.purchasable ? "Cho phép mua" : "Không cho phép mua"}
                </small>
              </span>
              <span
                className={`status-permission ${
                  status.purchasable ? "enabled" : "disabled"
                }`}
              >
                {status.purchasable ? "Đang bán" : "Tạm dừng mua"}
              </span>
              {status.id !== "available" ? (
                <button
                  onClick={() => {
                    const confirmMsg =
                      usage > 0
                        ? `Trạng thái "${status.name}" đang được sử dụng bởi ${usage} sản phẩm.\n\nNếu xóa, các sản phẩm này sẽ được chuyển về trạng thái khả dụng mặc định.\n\nBạn có chắc chắn muốn xóa không?`
                        : `Bạn có chắc chắn muốn xóa trạng thái "${status.name}" không?`
                    if (window.confirm(confirmMsg)) {
                      onDelete(status.id)
                    }
                  }}
                  aria-label={`Xóa ${status.name}`}
                  title={`Xóa ${status.name}`}
                >
                  <Icon name="trash" size={17} />
                </button>
              ) : (
                <span className="status-default">Mặc định</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function AdminAnalytics({
  transactions,
  games,
  services,
  onNavigateToTransactions,
}: {
  transactions: Transaction[]
  games: string[]
  services: Service[]
  onNavigateToTransactions?: () => void
}) {
  const [timeFilter, setTimeFilter] = useState<"all" | "30days" | "7days">("all")
  const [metricView, setMetricView] = useState<"revenue" | "orders">("revenue")

  const toneGradients: Record<string, { bar: string; dot: string; glow: string }> = {
    violet: { bar: "linear-gradient(90deg, #7c3aed, #a855f7)", dot: "#a855f7", glow: "rgba(168, 85, 247, 0.4)" },
    blue: { bar: "linear-gradient(90deg, #2563eb, #38bdf8)", dot: "#38bdf8", glow: "rgba(56, 189, 248, 0.4)" },
    yellow: { bar: "linear-gradient(90deg, #d97706, #fbbf24)", dot: "#fbbf24", glow: "rgba(251, 191, 36, 0.4)" },
    amber: { bar: "linear-gradient(90deg, #d97706, #f59e0b)", dot: "#f59e0b", glow: "rgba(245, 158, 11, 0.4)" },
    cyan: { bar: "linear-gradient(90deg, #0891b2, #22d3ee)", dot: "#22d3ee", glow: "rgba(34, 211, 238, 0.4)" },
    red: { bar: "linear-gradient(90deg, #dc2626, #f87171)", dot: "#f87171", glow: "rgba(248, 113, 113, 0.4)" },
    pink: { bar: "linear-gradient(90deg, #db2777, #f472b6)", dot: "#f472b6", glow: "rgba(244, 114, 182, 0.4)" },
    emerald: { bar: "linear-gradient(90deg, #059669, #34d399)", dot: "#34d399", glow: "rgba(52, 211, 153, 0.4)" },
  }

  // Filter transactions by date
  const filteredTransactions = useMemo(() => {
    if (timeFilter === "all") return transactions
    const now = Date.now()
    const daysLimit = timeFilter === "7days" ? 7 : 30
    const cutoff = now - daysLimit * 24 * 60 * 60 * 1000

    return transactions.filter((t) => {
      const timestamp = new Date(t.date).getTime()
      return !isNaN(timestamp) && timestamp >= cutoff
    })
  }, [transactions, timeFilter])

  // Aggregate stats per game
  const { gameStats, totals, topRevenueGame, topOrdersGame } = useMemo(() => {
    const allGameNames = Array.from(
      new Set([
        ...games,
        ...filteredTransactions.map((t) => t.game).filter(Boolean),
      ]),
    )

    let totalRevenue = 0
    let totalCompleted = 0
    let totalOrders = 0

    const stats = allGameNames.map((gameName) => {
      const gameTransactions = filteredTransactions.filter((t) => t.game === gameName)
      const service = services.find((s) => s.name === gameName || s.game === gameName)
      const completedList = gameTransactions.filter((t) => t.status === "Hoàn thành")
      const processingList = gameTransactions.filter((t) => t.status === "Đang xử lý")
      const pendingList = gameTransactions.filter((t) => t.status === "Chờ thanh toán")
      const failedList = gameTransactions.filter(
        (t) => t.status === "Thất bại" || t.status === "Đã hoàn tiền",
      )

      const revenue = completedList.reduce((sum, t) => sum + (Number(t.amount) || 0), 0)
      const orderCount = gameTransactions.length
      const completedCount = completedList.length
      const aov = completedCount > 0 ? Math.round(revenue / completedCount) : 0
      const rate = orderCount > 0 ? Math.round((completedCount / orderCount) * 100) : 0

      totalRevenue += revenue
      totalCompleted += completedCount
      totalOrders += orderCount

      const tone = service?.tone || "cyan"
      const colors = toneGradients[tone] || {
        bar: "linear-gradient(90deg, #0891b2, #22d3ee)",
        dot: "#22d3ee",
        glow: "rgba(34, 211, 238, 0.4)",
      }

      return {
        game: gameName,
        service,
        tone,
        colors,
        revenue,
        orderCount,
        completedCount,
        processingCount: processingList.length,
        pendingCount: pendingList.length,
        failedCount: failedList.length,
        aov,
        completionRate: rate,
      }
    })

    const sorted = [...stats].sort((a, b) => {
      if (metricView === "revenue") {
        return b.revenue - a.revenue || b.orderCount - a.orderCount
      }
      return b.orderCount - a.orderCount || b.revenue - a.revenue
    })

    const topRev = [...stats].sort((a, b) => b.revenue - a.revenue)[0]
    const topOrd = [...stats].sort((a, b) => b.orderCount - a.orderCount)[0]

    return {
      gameStats: sorted,
      totals: {
        revenue: totalRevenue,
        completed: totalCompleted,
        orders: totalOrders,
        aov: totalCompleted > 0 ? Math.round(totalRevenue / totalCompleted) : 0,
        rate: totalOrders > 0 ? Math.round((totalCompleted / totalOrders) * 100) : 0,
      },
      topRevenueGame: topRev,
      topOrdersGame: topOrd,
    }
  }, [filteredTransactions, games, services, metricView])

  const maxRevenue = Math.max(...gameStats.map((g) => g.revenue), 1)
  const maxOrders = Math.max(...gameStats.map((g) => g.orderCount), 1)

  return (
    <div className="analytics-page">
      <div className="data-page-heading">
        <div>
          <h2>Thống kê doanh thu & đơn hàng theo game</h2>
          <p>Báo cáo chi tiết hiệu suất kinh doanh, tỷ trọng đóng góp và xu hướng theo từng tựa game.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div className="analytics-btn-group">
            <button
              type="button"
              className={timeFilter === "all" ? "active" : ""}
              onClick={() => setTimeFilter("all")}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={timeFilter === "30days" ? "active" : ""}
              onClick={() => setTimeFilter("30days")}
            >
              30 ngày qua
            </button>
            <button
              type="button"
              className={timeFilter === "7days" ? "active" : ""}
              onClick={() => setTimeFilter("7days")}
            >
              7 ngày qua
            </button>
          </div>
          {onNavigateToTransactions && (
            <button
              type="button"
              className="quick-analytics-btn"
              onClick={onNavigateToTransactions}
            >
              <Icon name="clock" size={15} /> Xem giao dịch ➔
            </button>
          )}
        </div>
      </div>

      {/* KPI Cards */}
      <div className="analytics-kpi-grid">
        <div className="analytics-kpi-card">
          <small>Tổng doanh thu thực tế</small>
          <strong>{formatPrice(totals.revenue)}</strong>
          <p>
            <span className="kpi-badge">{totals.completed} đơn hoàn thành</span>
            <span>Tỷ lệ: {totals.rate}%</span>
          </p>
        </div>

        <div className="analytics-kpi-card accent-purple">
          <small>Tổng số đơn hàng</small>
          <strong>{totals.orders} đơn</strong>
          <p>
            <span className="kpi-badge" style={{ background: "rgba(168, 85, 247, 0.15)", color: "#c084fc" }}>
              ĐTB: {formatPrice(totals.aov)}
            </span>
          </p>
        </div>

        <div className="analytics-kpi-card accent-amber">
          <small>Game doanh thu dẫn đầu</small>
          <strong>{topRevenueGame && topRevenueGame.revenue > 0 ? topRevenueGame.game : "Chưa có dữ liệu"}</strong>
          <p>
            {topRevenueGame && topRevenueGame.revenue > 0 ? (
              <>
                <span className="kpi-badge" style={{ background: "rgba(245, 158, 11, 0.15)", color: "#fbbf24" }}>
                  {formatPrice(topRevenueGame.revenue)}
                </span>
                <span>
                  {totals.revenue > 0 ? `(${((topRevenueGame.revenue / totals.revenue) * 100).toFixed(1)}%)` : ""}
                </span>
              </>
            ) : (
              <span>Chưa có doanh thu</span>
            )}
          </p>
        </div>

        <div className="analytics-kpi-card accent-emerald">
          <small>Game có nhiều đơn nhất</small>
          <strong>{topOrdersGame && topOrdersGame.orderCount > 0 ? topOrdersGame.game : "Chưa có dữ liệu"}</strong>
          <p>
            {topOrdersGame && topOrdersGame.orderCount > 0 ? (
              <>
                <span className="kpi-badge" style={{ background: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                  {topOrdersGame.orderCount} đơn hàng
                </span>
                <span>
                  {totals.orders > 0 ? `(${((topOrdersGame.orderCount / totals.orders) * 100).toFixed(1)}%)` : ""}
                </span>
              </>
            ) : (
              <span>Chưa có đơn hàng</span>
            )}
          </p>
        </div>
      </div>

      {/* Main Chart Panel */}
      <div className="analytics-chart-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>
              <Icon name="spark" size={18} />
              Biểu đồ so sánh giữa các game
            </h3>
            <p>
              Hiển thị độ tương quan {metricView === "revenue" ? "doanh thu (VNĐ)" : "số lượng đơn hàng"} giữa các tựa game
            </p>
          </div>
          <div className="analytics-btn-group">
            <button
              type="button"
              className={metricView === "revenue" ? "active" : ""}
              onClick={() => setMetricView("revenue")}
            >
              💰 Theo doanh thu (VNĐ)
            </button>
            <button
              type="button"
              className={metricView === "orders" ? "active" : ""}
              onClick={() => setMetricView("orders")}
            >
              📦 Theo số lượng đơn
            </button>
          </div>
        </div>

        {/* Share Bar */}
        <div className="share-bar-wrap">
          <div className="share-bar">
            {gameStats
              .filter((g) => (metricView === "revenue" ? g.revenue > 0 : g.orderCount > 0))
              .map((g) => {
                const pct =
                  metricView === "revenue"
                    ? totals.revenue > 0 ? (g.revenue / totals.revenue) * 100 : 0
                    : totals.orders > 0 ? (g.orderCount / totals.orders) * 100 : 0
                return (
                  <div
                    key={g.game}
                    className="share-bar-segment"
                    style={{ width: `${pct}%`, background: g.colors.bar }}
                    title={`${g.game}: ${pct.toFixed(1)}%`}
                  />
                )
              })}
          </div>
          <div className="share-bar-legend">
            {gameStats
              .filter((g) => (metricView === "revenue" ? g.revenue > 0 : g.orderCount > 0))
              .map((g) => {
                const pct =
                  metricView === "revenue"
                    ? totals.revenue > 0 ? (g.revenue / totals.revenue) * 100 : 0
                    : totals.orders > 0 ? (g.orderCount / totals.orders) * 100 : 0
                return (
                  <div key={g.game} className="share-legend-item">
                    <span className="share-legend-dot" style={{ background: g.colors.dot }} />
                    <span>{g.game}</span>
                    <strong style={{ color: "#e2e8f0" }}>{pct.toFixed(1)}%</strong>
                  </div>
                )
              })}
          </div>
        </div>

        {/* Bars List */}
        <div className="game-bars-list">
          {gameStats.map((item, index) => {
            const pctShare =
              metricView === "revenue"
                ? totals.revenue > 0 ? (item.revenue / totals.revenue) * 100 : 0
                : totals.orders > 0 ? (item.orderCount / totals.orders) * 100 : 0
            const barWidth =
              metricView === "revenue"
                ? maxRevenue > 0 ? Math.max(4, Math.round((item.revenue / maxRevenue) * 100)) : 4
                : maxOrders > 0 ? Math.max(4, Math.round((item.orderCount / maxOrders) * 100)) : 4

            const rankClass = index === 0 ? "rank-1" : index === 1 ? "rank-2" : index === 2 ? "rank-3" : ""

            return (
              <div key={item.game} className="game-bar-row">
                <div className={`game-rank-badge ${rankClass}`}>
                  #{index + 1}
                </div>
                <div className="game-info-col">
                  <div className="game-avatar-small">
                    {item.service?.image ? (
                      <img src={item.service.image} alt={item.game} />
                    ) : (
                      item.service?.iconText || item.game.slice(0, 3).toUpperCase()
                    )}
                  </div>
                  <span className="game-name-text" title={item.game}>
                    {item.game}
                  </span>
                </div>
                <div className="game-track-wrap">
                  <div
                    className="game-bar-fill"
                    style={{
                      width: `${barWidth}%`,
                      background: item.colors.bar,
                      boxShadow: `0 0 14px ${item.colors.glow}`,
                    }}
                    title={`${item.game}: ${metricView === "revenue" ? formatPrice(item.revenue) : `${item.orderCount} đơn`} (${pctShare.toFixed(1)}%)`}
                  />
                </div>
                <div className="game-value-col">
                  <strong>
                    {metricView === "revenue" ? formatPrice(item.revenue) : `${item.orderCount} đơn`}
                  </strong>
                  <small>
                    {pctShare.toFixed(1)}% tổng số {metricView === "revenue" ? "doanh thu" : "đơn"}
                  </small>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Detailed Breakdown Table */}
      <div className="analytics-chart-panel">
        <div className="analytics-panel-header">
          <div>
            <h3>
              <Icon name="grid" size={18} />
              Bảng xếp hạng chi tiết theo game
            </h3>
            <p>Tổng hợp các chỉ số đơn hàng, tỷ lệ hoàn tất và giá trị đơn trung bình (AOV)</p>
          </div>
        </div>

        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th style={{ width: "50px" }}>Hạng</th>
                <th>Tựa Game</th>
                <th>Doanh thu thực tế</th>
                <th>Tỷ trọng</th>
                <th>Tổng đơn</th>
                <th>Hoàn thành</th>
                <th>Đang xử lý</th>
                <th>Chờ / Hủy</th>
                <th>Đơn giá TB (AOV)</th>
                <th>Tỷ lệ nạp xong</th>
              </tr>
            </thead>
            <tbody>
              {gameStats.map((item, index) => {
                const revPct = totals.revenue > 0 ? ((item.revenue / totals.revenue) * 100).toFixed(1) : "0.0"
                const medal = index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : `#${index + 1}`

                return (
                  <tr key={item.game}>
                    <td>
                      <strong style={{ fontSize: "14px" }}>{medal}</strong>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="game-avatar-small" style={{ width: "28px", height: "28px" }}>
                          {item.service?.image ? (
                            <img src={item.service.image} alt={item.game} />
                          ) : (
                            item.service?.iconText || item.game.slice(0, 3).toUpperCase()
                          )}
                        </div>
                        <strong style={{ color: "#f8fafc" }}>{item.game}</strong>
                      </div>
                    </td>
                    <td>
                      <strong style={{ color: item.revenue > 0 ? "#34d399" : "#64748b" }}>
                        {formatPrice(item.revenue)}
                      </strong>
                    </td>
                    <td>
                      <span className="kpi-badge">{revPct}%</span>
                    </td>
                    <td>
                      <strong>{item.orderCount}</strong>
                    </td>
                    <td>
                      <span style={{ color: "#34d399", fontWeight: 600 }}>{item.completedCount}</span>
                    </td>
                    <td>
                      <span style={{ color: "#fbbf24", fontWeight: 600 }}>{item.processingCount}</span>
                    </td>
                    <td>
                      <span style={{ color: "#94a3b8" }}>{item.pendingCount + item.failedCount}</span>
                    </td>
                    <td>{formatPrice(item.aov)}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "60px", height: "6px", background: "#1a2436", borderRadius: "3px", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${item.completionRate}%`,
                              height: "100%",
                              background: item.completionRate >= 80 ? "#10b981" : item.completionRate >= 50 ? "#f59e0b" : "#64748b",
                            }}
                          />
                        </div>
                        <span>{item.completionRate}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

const paymentStatusBadges: Record<string, { label: string; color: string; bg: string }> = {
  PAID: { label: "Đã TT", color: "#34d399", bg: "rgba(52, 211, 153, 0.15)" },
  PENDING: { label: "Chờ TT", color: "#fbbf24", bg: "rgba(251, 191, 36, 0.15)" },
  UNPAID: { label: "Chưa TT", color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" },
  EXPIRED: { label: "Hết hạn", color: "#f87171", bg: "rgba(239, 68, 68, 0.15)" },
  FAILED: { label: "Thất bại", color: "#f87171", bg: "rgba(239, 68, 68, 0.15)" },
}

export function AdminTransactions({
  transactions,
  onUpdate,
  onViewAnalytics,
}: {
  transactions: Transaction[]
  onUpdate: (
    id: string | number,
    status: TransactionStatus,
    reason?: string,
    paymentStatus?: string,
    refundDetails?: { refundAmount?: number; refundTxId?: string; refundReason?: string },
  ) => void
  onViewAnalytics?: () => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("Tất cả")
  const [paymentFilter, setPaymentFilter] = useState("Tất cả")
  const [gameFilter, setGameFilter] = useState("Tất cả")
  const [hideExpired, setHideExpired] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const [refundingTx, setRefundingTx] = useState<Transaction | null>(null)
  const [refundAmount, setRefundAmount] = useState("")
  const [refundTxId, setRefundTxId] = useState("")
  const [refundReason, setRefundReason] = useState("")
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundError, setRefundError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!selected?.id) return
    let active = true
    api.admin.getTransaction(selected.id)
      .then((decrypted) => {
        if (active && decrypted) {
          setSelected(decrypted)
        }
      })
      .catch((err) => {
        console.warn("Could not fetch decrypted transaction details:", err)
      })
    return () => {
      active = false
    }
  }, [selected?.id])

  const statuses: Array<"Tất cả" | TransactionStatus> = [
    "Tất cả",
    "Chờ thanh toán",
    "Đang xử lý",
    "Hoàn thành",
    "Thất bại",
    "Đã hoàn tiền",
  ]

  const gameList = useMemo(() => {
    const set = new Set<string>()
    transactions.forEach((t) => {
      if (t.game && t.game.trim()) {
        set.add(t.game.trim())
      }
    })
    return Array.from(set).sort()
  }, [transactions])

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase()
    return transactions.filter((item) => {
      const ps = String(item.paymentStatus || (item.status === "Hoàn thành" ? "PAID" : "PENDING")).toUpperCase()

      if (hideExpired && ps === "EXPIRED") return false
      if (paymentFilter !== "Tất cả" && ps !== paymentFilter) return false
      if (status !== "Tất cả" && item.status !== status) return false
      if (gameFilter !== "Tất cả" && item.game !== gameFilter) return false

      if (s) {
        const text = `${item.code} ${item.email} ${item.product} ${item.game || ""}`.toLowerCase()
        if (!text.includes(s)) return false
      }

      return true
    })
  }, [transactions, search, status, paymentFilter, gameFilter, hideExpired])

  const hasActiveFilters = Boolean(
    search.trim() ||
    status !== "Tất cả" ||
    paymentFilter !== "Tất cả" ||
    gameFilter !== "Tất cả" ||
    hideExpired
  )

  const resetFilters = () => {
    setSearch("")
    setStatus("Tất cả")
    setPaymentFilter("Tất cả")
    setGameFilter("Tất cả")
    setHideExpired(false)
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / 8))
  const visible = filtered.slice((page - 1) * 8, page * 8)
  useEffect(() => setPage(1), [search, status, paymentFilter, gameFilter, hideExpired])

  return (
    <div className="admin-data-page">
      <div className="data-page-heading">
        <div>
          <h2>Giao dịch & đơn hàng</h2>
          <p>Theo dõi thanh toán và cập nhật trạng thái xử lý.</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {onViewAnalytics && (
            <button
              type="button"
              className="quick-analytics-btn"
              onClick={onViewAnalytics}
            >
              <Icon name="spark" size={15} /> Thống kê theo game ↗
            </button>
          )}
          <span>
            {filtered.length !== transactions.length
              ? `${filtered.length} / ${transactions.length} giao dịch`
              : `${transactions.length} giao dịch`}
          </span>
        </div>
      </div>
      <div className="data-filters transaction-filters">
        <label className="admin-search">
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mã đơn, email, game, sản phẩm..."
          />
        </label>
        <select
          value={gameFilter}
          onChange={(event) => setGameFilter(event.target.value)}
          aria-label="Lọc theo game"
        >
          <option value="Tất cả">Tất cả game ({gameList.length})</option>
          {gameList.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(event) => setPaymentFilter(event.target.value)}
          aria-label="Lọc trạng thái thanh toán"
        >
          <option value="Tất cả">Tất cả thanh toán</option>
          <option value="PAID">Đã thanh toán (PAID)</option>
          <option value="PENDING">Chờ thanh toán (PENDING)</option>
          <option value="EXPIRED">Đã hết hạn (EXPIRED)</option>
          <option value="FAILED">Thất bại (FAILED)</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Lọc tiến độ nạp"
        >
          {statuses.map((item) => (
            <option key={item} value={item}>
              {item === "Tất cả" ? "Tất cả tiến độ nạp" : item}
            </option>
          ))}
        </select>
        <label className="filter-checkbox-label" title="Ẩn các đơn quá hạn thanh toán">
          <input
            type="checkbox"
            checked={hideExpired}
            onChange={(e) => setHideExpired(e.target.checked)}
          />
          <span>Ẩn đơn hết hạn</span>
        </label>
        {hasActiveFilters && (
          <button
            type="button"
            className="filter-reset-btn"
            onClick={resetFilters}
            title="Xóa tất cả bộ lọc về mặc định"
          >
            <Icon name="close" size={12} /> Đặt lại
          </button>
        )}
      </div>
      <div className="admin-table transaction-table">
        <div className="admin-table-head">
          <span>Mã giao dịch</span>
          <span>Khách hàng</span>
          <span>Sản phẩm</span>
          <span>Số tiền</span>
          <span>Thanh toán</span>
          <span>Tiến độ nạp</span>
          <span>Thao tác</span>
        </div>
        {visible.map((item) => (
          <div className="admin-table-row" key={item.id}>
            <span>
              <strong>{item.code}</strong>
              <small>{new Date(item.date).toLocaleString("vi-VN")}</small>
            </span>
            <span>{item.email}</span>
            <span>
              <strong>{item.product}</strong>
              <small>
                {item.game} · Số lượng: {item.quantity || 1}
              </small>
            </span>
            <strong>{formatPrice(item.amount)}</strong>
            <span>
              {(() => {
                const ps = String(item.paymentStatus || (item.status === "Hoàn thành" ? "PAID" : "PENDING")).toUpperCase()
                const badge = paymentStatusBadges[ps] || { label: ps, color: "#94a3b8", bg: "rgba(148, 163, 184, 0.15)" }
                return (
                  <span
                    style={{
                      display: "inline-block",
                      fontSize: "11px",
                      fontWeight: 600,
                      padding: "2px 7px",
                      borderRadius: "6px",
                      color: badge.color,
                      backgroundColor: badge.bg,
                    }}
                    title={`Trạng thái thanh toán: ${badge.label}`}
                  >
                    {badge.label}
                  </span>
                )
              })()}
            </span>
            <select
              className={`transaction-status status-${String(item.status).replace(/\s+/g, "-").toLowerCase()}`}
              value={item.status}
              onChange={(event) => {
                const nextStatus = event.target.value as TransactionStatus
                if (nextStatus === item.status) return
                if (nextStatus === "Đã hoàn tiền") {
                  setRefundingTx(item)
                  setRefundAmount(String(item.amount))
                  setRefundTxId("")
                  setRefundReason("Khách hủy hoặc hoàn tiền theo yêu cầu")
                  return
                }
                const reason = window.prompt(
                  `Nhập lý do điều chỉnh trạng thái đơn ${item.code} sang "${nextStatus}":`,
                  "Điều chỉnh thủ công bởi quản trị viên",
                )
                if (reason === null) return
                if (!reason.trim()) {
                  alert("Vui lòng nhập lý do điều chỉnh trạng thái.")
                  return
                }
                onUpdate(item.id, nextStatus, reason.trim())
              }}
            >
              {statuses.slice(1).map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <button
              className="view-order-info"
              onClick={() => setSelected(item)}
            >
              <Icon name="search" size={14} /> Xem chi tiết
            </button>
          </div>
        ))}
      </div>
      {!visible.length && (
        <div className="admin-empty">
          <Icon name="search" size={24} />
          <span>Không tìm thấy giao dịch.</span>
        </div>
      )}
      {filtered.length > 8 && (
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      )}
      {selected && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelected(null)
          }
        >
          <div className="order-info-modal">
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">{selected.code}</span>
                <h2>Thông tin xử lý đơn</h2>
              </div>
              <button onClick={() => setSelected(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="order-info-body">
              <div className="order-info-summary">
                <span>
                  <small>Sản phẩm</small>
                  <strong>
                    {selected.product} × {selected.quantity || 1}
                  </strong>
                </span>
                <span>
                  <small>Khách hàng</small>
                  <strong>{selected.email}</strong>
                </span>
                <span>
                  <small>Thanh toán</small>
                  <strong>
                    {selected.paymentStatus === "PAID" ? "Đã thanh toán" : selected.paymentStatus || "Chờ thanh toán"}
                  </strong>
                </span>
                <span>
                  <small>Tiến độ nạp</small>
                  <strong>{selected.status}</strong>
                </span>
                <span>
                  <small>Mẫu thông tin</small>
                  <strong>{selected.templateName || "Chưa có mẫu"}</strong>
                </span>
              </div>
              {selected.topupInfo &&
              Object.keys(selected.topupInfo).length > 0 ? (
                <div className="submitted-info-list">
                  {Object.entries(selected.topupInfo).map(([key, value]) => {
                    const rawLabel = selected.topupLabels?.[key]
                    const fallbackDictionary: Record<string, string> = {
                      uid: "UID",
                      server: "Server",
                      charactername: "Tên nhân vật",
                      character: "Tên nhân vật",
                      riotid: "Riot ID",
                      tagline: "Tagline",
                      contactemail: "Email liên hệ",
                      region: "Khu vực",
                      zoneid: "Zone ID",
                      playerid: "Player ID",
                      roleid: "Role ID",
                      note: "Ghi chú",
                      account: "Tài khoản đăng nhập",
                      password: "Mật khẩu",
                      pass: "Mật khẩu",
                      matkhau: "Mật khẩu",
                      ign: "Tên trong game",
                      phone: "Số điện thoại",
                    }
                    const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, "")
                    const standardLabel = fallbackDictionary[normalizedKey]
                    const displayLabel =
                      standardLabel ||
                      (rawLabel && rawLabel !== value && rawLabel.toLowerCase() !== key.toLowerCase()
                        ? rawLabel
                        : key)

                    let displayValue = String(value ?? "")
                    if (normalizedKey === "server") {
                      const serverMap: Record<string, string> = {
                        asia: "Asia",
                        europe: "Europe",
                        america: "America",
                        sar: "TW / HK / MO",
                      }
                      displayValue = serverMap[displayValue.toLowerCase()] || displayValue
                    } else if (normalizedKey === "region") {
                      const regionMap: Record<string, string> = {
                        ap: "Asia Pacific",
                        eu: "Europe",
                        na: "North America",
                        latam: "Latin America",
                        br: "Brazil",
                        kr: "Korea",
                        vietnam: "Việt Nam",
                      }
                      displayValue = regionMap[displayValue.toLowerCase()] || displayValue
                    }

                    return (
                      <div key={key}>
                        <span>{displayLabel}</span>
                        <strong>{displayValue}</strong>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText(String(value))
                            setCopiedKey(key)
                            setTimeout(() => setCopiedKey(null), 1500)
                          }}
                        >
                          {copiedKey === key ? "Đã chép!" : "Sao chép"}
                        </button>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="order-no-info">
                  <Icon name="clock" size={23} />
                  <span>Đơn hàng này chưa có thông tin nạp từ người dùng.</span>
                </div>
              )}

              {(selected.refundAmount || selected.status === "Đã hoàn tiền" || selected.refundTxId) && (
                <div style={{ background: "rgba(239, 68, 68, 0.08)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "8px", padding: "14px", marginTop: "14px" }}>
                  <span style={{ color: "#ef4444", fontWeight: 700, fontSize: "13px", display: "flex", alignItems: "center", gap: "6px" }}>
                    <Icon name="check" size={16} /> THÔNG TIN HOÀN TIỀN
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "8px", marginTop: "8px", fontSize: "13px" }}>
                    <div>
                      <small style={{ color: "var(--color-text-muted)" }}>Số tiền hoàn:</small>
                      <p style={{ margin: "2px 0", fontWeight: 700, color: "#f87171" }}>
                        {formatPrice(selected.refundAmount || selected.amount)}
                      </p>
                    </div>
                    <div>
                      <small style={{ color: "var(--color-text-muted)" }}>Mã giao dịch hoàn:</small>
                      <p style={{ margin: "2px 0", fontFamily: "monospace" }}>{selected.refundTxId || "—"}</p>
                    </div>
                    <div>
                      <small style={{ color: "var(--color-text-muted)" }}>Người xác nhận:</small>
                      <p style={{ margin: "2px 0" }}>{selected.refundedById || "Quản trị viên"}</p>
                    </div>
                    <div>
                      <small style={{ color: "var(--color-text-muted)" }}>Thời điểm hoàn:</small>
                      <p style={{ margin: "2px 0" }}>{selected.refundedAt ? new Date(selected.refundedAt).toLocaleString("vi-VN") : "—"}</p>
                    </div>
                  </div>
                  {selected.refundReason && (
                    <div style={{ marginTop: "6px", fontSize: "13px" }}>
                      <small style={{ color: "var(--color-text-muted)" }}>Lý do hoàn tiền:</small>
                      <p style={{ margin: "2px 0", wordBreak: "break-word" }}>{selected.refundReason}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="order-info-warning">
                <Icon name="shield" size={18} />
                <span>
                  Chỉ sử dụng dữ liệu này để xử lý đơn hàng. Không chia sẻ ra
                  bên ngoài.
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {refundingTx && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(e) => e.target === e.currentTarget && setRefundingTx(null)}
        >
          <div className="product-modal" style={{ maxWidth: "480px", width: "95%", boxSizing: "border-box" }}>
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">XÁC NHẬN HOÀN TIỀN</span>
                <h2>Đơn hàng #{refundingTx.code}</h2>
              </div>
              <button onClick={() => setRefundingTx(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault()
                const amt = Number(refundAmount)
                if (isNaN(amt) || amt <= 0 || !Number.isInteger(amt)) {
                  setRefundError("Số tiền hoàn phải là số nguyên dương (VNĐ).")
                  return
                }
                if (amt > Number(refundingTx.amount)) {
                  setRefundError(`Số tiền hoàn không được vượt quá số tiền của đơn hàng (${formatPrice(refundingTx.amount)}).`)
                  return
                }
                if (!refundReason.trim()) {
                  setRefundError("Vui lòng nhập lý do hoàn tiền cụ thể.")
                  return
                }
                try {
                  setRefundSubmitting(true)
                  setRefundError(null)
                  await onUpdate(
                    refundingTx.id,
                    "Đã hoàn tiền",
                    refundReason.trim(),
                    "REFUNDED",
                    {
                      refundAmount: amt,
                      refundTxId: refundTxId.trim() || undefined,
                      refundReason: refundReason.trim(),
                    },
                  )
                  setRefundingTx(null)
                } catch (err) {
                  setRefundError(err instanceof Error ? err.message : "Không thể thực hiện hoàn tiền. Vui lòng thử lại.")
                } finally {
                  setRefundSubmitting(false)
                }
              }}
              style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}
            >
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                Ghi nhận thông tin hoàn tiền cho giao dịch <strong>{refundingTx.product}</strong> ({formatPrice(refundingTx.amount)}).
              </p>

              {refundError && (
                <div style={{ color: "#f87171", fontSize: "13px", padding: "8px 12px", background: "rgba(239, 68, 68, 0.12)", border: "1px solid rgba(239, 68, 68, 0.25)", borderRadius: "7px" }}>
                  {refundError}
                </div>
              )}

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Số tiền hoàn (VNĐ) (*):
                </label>
                <input
                  type="number"
                  required
                  value={refundAmount}
                  onChange={(e) => {
                    setRefundAmount(e.target.value)
                    setRefundError(null)
                  }}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    padding: "10px",
                    fontSize: "14px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Mã giao dịch ngân hàng / SePay (Tùy chọn):
                </label>
                <input
                  type="text"
                  value={refundTxId}
                  onChange={(e) => setRefundTxId(e.target.value)}
                  placeholder="Ví dụ: FT261013456789"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    padding: "10px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "4px" }}>
                  Lý do hoàn tiền (*):
                </label>
                <textarea
                  required
                  rows={3}
                  value={refundReason}
                  onChange={(e) => {
                    setRefundReason(e.target.value)
                    setRefundError(null)
                  }}
                  placeholder="Ví dụ: Khách hủy đơn, đã chuyển trả qua STK Techcombank 1903..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    padding: "10px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>

              <div className="product-modal-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={refundSubmitting}
                  onClick={() => {
                    setRefundingTx(null)
                    setRefundError(null)
                  }}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={refundSubmitting}
                  style={{ background: "#ef4444", borderColor: "#ef4444" }}
                >
                  {refundSubmitting ? "Đang xử lý..." : "Xác nhận hoàn tiền"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminUsers({
  users,
  onUpdate,
}: {
  users: ManagedUser[]
  onUpdate: (id: string | number, updates: Partial<ManagedUser>) => void
}) {
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const filtered = users.filter((item) =>
    `${item.name} ${item.email}`.toLowerCase().includes(search.toLowerCase()),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8))
  const visible = filtered.slice((page - 1) * 8, page * 8)
  useEffect(() => setPage(1), [search])

  return (
    <div className="admin-data-page">
      <div className="data-page-heading">
        <div>
          <h2>Quản lý người dùng</h2>
          <p>Phân quyền và quản lý trạng thái tài khoản.</p>
        </div>
        <span>{users.length} tài khoản</span>
      </div>
      <div className="data-filters">
        <label className="admin-search">
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Tìm tên hoặc email..."
          />
        </label>
      </div>
      <div className="admin-table user-table">
        <div className="admin-table-head">
          <span>Người dùng</span>
          <span>Ngày tham gia</span>
          <span>Tổng chi tiêu</span>
            <span>Trạng thái</span>
        </div>
        {visible.map((item) => (
          <div className="admin-table-row" key={item.id}>
            <span className="admin-user-cell">
              <i>{item.name.slice(0, 1).toUpperCase()}</i>
              <span>
                <strong>{item.name}</strong>
                <small>{item.email}</small>
              </span>
            </span>
            <span>{item.joined}</span>
            <strong>{formatPrice(item.totalSpent)}</strong>
            <button
              className={`user-status ${item.status}`}
              onClick={() =>
                onUpdate(item.id, {
                  status: item.status === "active" ? "blocked" : "active",
                })
              }
            >
              {item.status === "active" ? "Đang hoạt động" : "Đã khóa"}
            </button>
          </div>
        ))}
      </div>
      {filtered.length > 8 && (
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      )}
    </div>
  )
}

type AuditLogItem = {
  id: string
  userId: string | null
  action: string
  method: string
  path: string
  statusCode: number
  ipAddress: string | null
  requestId: string | null
  metadata: Record<string, unknown> | null
  createdAt: string
}

export function AuditLogManager() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null)

  const [cleaning, setCleaning] = useState(false)

  const handleCleanup = async () => {
    if (!window.confirm("Bạn có chắc chắn muốn dọn dẹp các log xem dữ liệu cũ và log quá 30 ngày?")) return
    setCleaning(true)
    try {
      const res = await api.admin.cleanupAuditLogs({ days: 30, clearReadLogs: true })
      alert(`Đã dọn dẹp thành công ${res.deletedCount} bản ghi log cũ/rác.`)
      await fetchLogs()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Dọn dẹp log thất bại.")
    } finally {
      setCleaning(false)
    }
  }

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.admin.auditLogs({
        page,
        limit: 15,
        search: search.trim() || undefined,
        action: actionFilter !== "all" ? actionFilter : undefined,
      })
      setLogs(data.items as AuditLogItem[])
      setTotal(data.total)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải nhật ký hoạt động.")
    } finally {
      setLoading(false)
    }
  }, [page, search, actionFilter])

  useEffect(() => {
    void fetchLogs()
  }, [fetchLogs])

  return (
    <div className="admin-data-page">
      <div className="data-page-heading">
        <div>
          <h2>Nhật ký hoạt động (Audit Logs)</h2>
          <p>Lịch sử các thao tác thay đổi dữ liệu, đăng nhập, nạp đơn và bảo mật hệ thống.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span>{total} bản ghi</span>
          <button
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={() => void fetchLogs()}
            title="Làm mới dữ liệu"
          >
            Làm mới
          </button>
          <button
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "13px", borderColor: "rgba(239, 68, 68, 0.4)", color: "#f87171" }}
            onClick={() => void handleCleanup()}
            disabled={cleaning}
            title="Dọn dẹp các log rác (GET) và log quá 30 ngày"
          >
            {cleaning ? "Đang dọn..." : "Dọn dẹp log cũ"}
          </button>
        </div>
      </div>

      <div className="data-filters" style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <label className="admin-search" style={{ flex: 1, minWidth: "220px" }}>
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo URL, Request ID, IP..."
          />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <label style={{ fontSize: "13px", color: "var(--color-text-muted)" }}>Hành động:</label>
          <select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value)
              setPage(1)
            }}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="all">Tất cả hành động</option>
            <option value="CREATE_ORDER">Tạo đơn (CREATE_ORDER)</option>
            <option value="CHECKOUT">Thanh toán giỏ hàng (CHECKOUT)</option>
            <option value="CANCEL_ORDER">Hủy đơn (CANCEL_ORDER)</option>
            <option value="UPDATE_ORDER_STATUS">Cập nhật đơn (UPDATE_STATUS)</option>
            <option value="UPDATE_SETTING">Đổi cấu hình (UPDATE_SETTING)</option>
            <option value="UPDATE_USER">Cập nhật tài khoản (UPDATE_USER)</option>
            <option value="LOGIN">Đăng nhập (LOGIN)</option>
            <option value="LOGOUT">Đăng xuất (LOGOUT)</option>
            <option value="REGISTER">Đăng ký (REGISTER)</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ color: "#ef4444", padding: "12px", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Đang tải nhật ký hoạt động...
        </div>
      ) : logs.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Không tìm thấy bản ghi nhật ký nào.
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px" }}>
          <div className="admin-table" style={{ minWidth: "820px" }}>
            <div
              className="admin-table-head"
              style={{
                gridTemplateColumns: "160px 170px 90px 1fr 90px 130px 90px",
                display: "grid",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <span>Thời gian</span>
              <span>Hành động</span>
              <span>Method</span>
              <span>Đường dẫn (Path)</span>
              <span>Status</span>
              <span>IP / Request</span>
              <span>Chi tiết</span>
            </div>
            {logs.map((log) => {
              const isSuccess = log.statusCode >= 200 && log.statusCode < 300
              const isError = log.statusCode >= 400
              const actionColor =
                log.action.includes("CREATE") || log.action.includes("CHECKOUT")
                  ? "#10b981"
                  : log.action.includes("CANCEL")
                    ? "#f59e0b"
                    : log.action.includes("UPDATE")
                      ? "#3b82f6"
                      : log.action.includes("DELETE")
                        ? "#ef4444"
                        : "#8b5cf6"

              return (
                <div
                  className="admin-table-row"
                  key={log.id}
                  style={{
                    gridTemplateColumns: "160px 170px 90px 1fr 90px 130px 90px",
                    display: "grid",
                    gap: "8px",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                    {new Date(log.createdAt).toLocaleString("vi-VN", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                    })}
                  </span>
                  <span>
                    <strong
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: "6px",
                        fontSize: "11px",
                        fontWeight: 600,
                        background: `${actionColor}20`,
                        color: actionColor,
                        border: `1px solid ${actionColor}40`,
                      }}
                    >
                      {log.action}
                    </strong>
                  </span>
                  <span style={{ fontFamily: "monospace", fontWeight: 600, color: "#93c5fd" }}>
                    {log.method}
                  </span>
                  <span
                    style={{
                      fontFamily: "monospace",
                      fontSize: "12px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={log.path}
                  >
                    {log.path}
                  </span>
                  <span>
                    <span
                      style={{
                        padding: "2px 6px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: 700,
                        background: isSuccess
                          ? "rgba(16, 185, 129, 0.15)"
                          : isError
                            ? "rgba(239, 68, 68, 0.15)"
                            : "rgba(156, 163, 175, 0.15)",
                        color: isSuccess ? "#34d399" : isError ? "#f87171" : "#9ca3af",
                      }}
                    >
                      {log.statusCode}
                    </span>
                  </span>
                  <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
                    {log.ipAddress || (log.requestId ? log.requestId.slice(0, 8) : "—")}
                  </span>
                  <span>
                    <button
                      className="secondary-button"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      onClick={() => setSelectedLog(log)}
                    >
                      Chi tiết
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={page} totalPages={totalPages} onPage={setPage} />
      )}

      {selectedLog && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelectedLog(null)
          }
        >
          <div className="product-modal" style={{ maxWidth: "600px", width: "95%", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">AUDIT LOG DETAIL</span>
                <h2>Chi tiết nhật ký hoạt động</h2>
              </div>
              <button onClick={() => setSelectedLog(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="product-modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Hành động:</small>
                  <p style={{ margin: "4px 0", wordBreak: "break-word" }}><strong>{selectedLog.action}</strong></p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Thời gian:</small>
                  <p style={{ margin: "4px 0" }}>{new Date(selectedLog.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>HTTP Request:</small>
                  <p style={{ margin: "4px 0", wordBreak: "break-all" }}><code>{selectedLog.method} {selectedLog.path}</code> ({selectedLog.statusCode})</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>User ID:</small>
                  <p style={{ margin: "4px 0", wordBreak: "break-all" }}>{selectedLog.userId || "Khách / Hệ thống (Ẩn danh)"}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>IP Address:</small>
                  <p style={{ margin: "4px 0" }}>{selectedLog.ipAddress || "Không xác định"}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Request ID:</small>
                  <p style={{ fontFamily: "monospace", fontSize: "11px", margin: "4px 0", wordBreak: "break-all" }}>{selectedLog.requestId || "—"}</p>
                </div>
              </div>

              <div>
                <small style={{ color: "var(--color-text-muted)", marginBottom: "4px", display: "block" }}>
                  Metadata / Dữ liệu đính kèm:
                </small>
                <pre
                  style={{
                    background: "rgba(0, 0, 0, 0.4)",
                    border: "1px solid rgba(255, 255, 255, 0.1)",
                    borderRadius: "8px",
                    padding: "12px",
                    fontSize: "12px",
                    maxHeight: "240px",
                    overflowY: "auto",
                    overflowX: "auto",
                    maxWidth: "100%",
                    boxSizing: "border-box",
                    color: "#a7f3d0",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-all",
                  }}
                >
                  {selectedLog.metadata
                    ? JSON.stringify(selectedLog.metadata, null, 2)
                    : "Không có metadata đính kèm."}
                </pre>
              </div>

              <div className="product-modal-actions" style={{ justifyContent: "flex-end" }}>
                <button className="primary-button" onClick={() => setSelectedLog(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function PaymentAnomalyManager() {
  const [anomalies, setAnomalies] = useState<
    Array<{
      id: string
      provider: string
      gatewayId: string | null
      referenceCode: string | null
      orderCode: string | null
      accountNumber: string | null
      amount: string | number
      expectedAmount: string | number | null
      content: string
      anomalyType: string
      rawPayload: Record<string, unknown> | null
      resolved: boolean
      resolvedBy: string | null
      resolvedAt: string | null
      resolutionNote: string | null
      createdAt: string
    }>
  >([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState("")
  const [anomalyType, setAnomalyType] = useState("all")
  const [resolvedFilter, setResolvedFilter] = useState("all")

  const [selectedAnomaly, setSelectedAnomaly] = useState<(typeof anomalies)[0] | null>(null)
  const [resolvingAnomaly, setResolvingAnomaly] = useState<(typeof anomalies)[0] | null>(null)
  const [resolutionNote, setResolutionNote] = useState("")
  const [resolving, setResolving] = useState(false)

  const fetchAnomalies = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await api.admin.paymentAnomalies({
        page,
        limit: 20,
        search: search.trim() || undefined,
        anomalyType: anomalyType === "all" ? undefined : anomalyType,
        resolved: resolvedFilter === "all" ? undefined : resolvedFilter === "true",
      })
      setAnomalies(data.items)
      setTotal(data.total)
      setTotalPages(data.totalPages || 1)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể tải danh sách đối soát thanh toán.")
    } finally {
      setLoading(false)
    }
  }, [page, search, anomalyType, resolvedFilter])

  useEffect(() => {
    void fetchAnomalies()
  }, [fetchAnomalies])

  const handleResolveSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!resolvingAnomaly) return
    if (!resolutionNote.trim()) {
      alert("Vui lòng nhập ghi chú xử lý.")
      return
    }
    setResolving(true)
    try {
      await api.admin.resolvePaymentAnomaly(resolvingAnomaly.id, resolutionNote.trim())
      setResolvingAnomaly(null)
      setResolutionNote("")
      await fetchAnomalies()
    } catch (err) {
      alert(err instanceof Error ? err.message : "Lỗi khi cập nhật trạng thái xử lý.")
    } finally {
      setResolving(false)
    }
  }

  const renderTypeBadge = (type: string) => {
    switch (type) {
      case "AMOUNT_MISMATCH":
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(239, 68, 68, 0.15)", color: "#ef4444", fontSize: "12px", fontWeight: 600 }}>Sai số tiền</span>
      case "NO_ORDER_CODE":
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(245, 158, 11, 0.15)", color: "#f59e0b", fontSize: "12px", fontWeight: 600 }}>Không mã đơn</span>
      case "ORDER_NOT_FOUND":
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(234, 88, 12, 0.15)", color: "#ea580c", fontSize: "12px", fontWeight: 600 }}>Mã không tồn tại</span>
      case "DUPLICATE_PAYMENT":
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(168, 85, 247, 0.15)", color: "#a855f7", fontSize: "12px", fontWeight: 600 }}>Chuyển trùng (2 lần)</span>
      case "PAYMENT_NOT_PAYABLE":
        return <span>Đơn không thể tự nhận thanh toán</span>
      case "MISMATCHED_ACCOUNT":
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(59, 130, 246, 0.15)", color: "#3b82f6", fontSize: "12px", fontWeight: 600 }}>Sai STK nhận</span>
      default:
        return <span style={{ padding: "4px 8px", borderRadius: "6px", background: "rgba(255, 255, 255, 0.1)", color: "#e2e8f0", fontSize: "12px" }}>{type}</span>
    }
  }

  return (
    <div className="admin-data-page">
      <div className="data-page-heading">
        <div>
          <h2>Đối soát thanh toán bất thường (SePay)</h2>
          <p>Tự động ghi nhận các giao dịch chuyển tiền sai số tiền, sai/thiếu mã đơn hoặc chuyển khoản trùng lặp.</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <span>{total} giao dịch</span>
          <button
            className="secondary-button"
            style={{ padding: "6px 12px", fontSize: "13px" }}
            onClick={() => void fetchAnomalies()}
            title="Làm mới dữ liệu"
          >
            Làm mới
          </button>
        </div>
      </div>

      <div className="data-filters" style={{ display: "flex", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
        <label className="admin-search" style={{ flex: 1, minWidth: "220px" }}>
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            placeholder="Tìm theo mã đơn, mã GD, nội dung..."
          />
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <select
            value={anomalyType}
            onChange={(e) => {
              setAnomalyType(e.target.value)
              setPage(1)
            }}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="all">Tất cả loại bất thường</option>
            <option value="AMOUNT_MISMATCH">Sai số tiền</option>
            <option value="NO_ORDER_CODE">Không có mã đơn</option>
            <option value="ORDER_NOT_FOUND">Mã đơn không tồn tại</option>
            <option value="DUPLICATE_PAYMENT">Chuyển trùng lặp (2 lần)</option>
            <option value="PAYMENT_NOT_PAYABLE">Đơn không thể tự nhận thanh toán</option>
            <option value="MISMATCHED_ACCOUNT">Sai STK thụ hưởng</option>
          </select>

          <select
            value={resolvedFilter}
            onChange={(e) => {
              setResolvedFilter(e.target.value)
              setPage(1)
            }}
            style={{
              background: "rgba(255, 255, 255, 0.05)",
              border: "1px solid rgba(255, 255, 255, 0.12)",
              color: "#fff",
              borderRadius: "8px",
              padding: "6px 12px",
              fontSize: "13px",
              outline: "none",
            }}
          >
            <option value="all">Tất cả trạng thái</option>
            <option value="false">Chờ xử lý (Chưa xong)</option>
            <option value="true">Đã giải quyết</option>
          </select>
        </div>
      </div>

      {error && (
        <div style={{ color: "#ef4444", padding: "12px", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Đang tải dữ liệu đối soát...
        </div>
      ) : anomalies.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", color: "var(--color-text-muted)" }}>
          Không có giao dịch bất thường nào cần đối soát.
        </div>
      ) : (
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", WebkitOverflowScrolling: "touch", borderRadius: "8px" }}>
          <div className="admin-table" style={{ minWidth: "900px" }}>
            <div
              className="admin-table-head"
              style={{
                gridTemplateColumns: "140px 150px 140px 150px 1fr 110px 110px",
                display: "grid",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <span>Thời gian</span>
              <span>Phân loại</span>
              <span>Mã đơn</span>
              <span>Tiền thực tế / Đơn</span>
              <span>Nội dung CK</span>
              <span>Trạng thái</span>
              <span style={{ textAlign: "right" }}>Thao tác</span>
            </div>

            {anomalies.map((item) => (
              <div
                key={item.id}
                className="admin-table-row"
                style={{
                  gridTemplateColumns: "140px 150px 140px 150px 1fr 110px 110px",
                  display: "grid",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <span style={{ fontSize: "12px", color: "var(--color-text-muted)" }}>
                  {new Date(item.createdAt).toLocaleString("vi-VN", {
                    month: "2-digit",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span>{renderTypeBadge(item.anomalyType)}</span>
                <span style={{ fontFamily: "monospace", fontSize: "12px", fontWeight: 600 }}>
                  {item.orderCode || "—"}
                </span>
                <span style={{ fontSize: "13px" }}>
                  <strong style={{ color: "#38bdf8" }}>{formatPrice(Number(item.amount))}</strong>
                  {item.expectedAmount ? (
                    <small style={{ display: "block", color: "var(--color-text-muted)", fontSize: "11px" }}>
                      Đơn: {formatPrice(Number(item.expectedAmount))}
                    </small>
                  ) : null}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={item.content}
                >
                  {item.content}
                </span>
                <span>
                  {item.resolved ? (
                    <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(34, 197, 94, 0.15)", color: "#22c55e", fontSize: "12px", fontWeight: 600 }}>
                      Đã xử lý
                    </span>
                  ) : (
                    <span style={{ padding: "3px 8px", borderRadius: "6px", background: "rgba(249, 115, 22, 0.15)", color: "#f97316", fontSize: "12px", fontWeight: 600 }}>
                      Chờ xử lý
                    </span>
                  )}
                </span>
                <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                  <button
                    className="secondary-button"
                    style={{ padding: "4px 8px", fontSize: "12px" }}
                    onClick={() => setSelectedAnomaly(item)}
                    title="Xem chi tiết"
                  >
                    Xem
                  </button>
                  {!item.resolved && (
                    <button
                      className="primary-button"
                      style={{ padding: "4px 8px", fontSize: "12px" }}
                      onClick={() => {
                        setResolvingAnomaly(item)
                        setResolutionNote("")
                      }}
                      title="Giải quyết bất thường"
                    >
                      Xử lý
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={totalPages}
          onPage={setPage}
        />
      )}

      {/* Modal chi tiết đối soát */}
      {selectedAnomaly && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setSelectedAnomaly(null)
          }
        >
          <div className="product-modal" style={{ maxWidth: "600px", width: "95%", maxHeight: "90vh", overflowY: "auto", boxSizing: "border-box" }}>
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">ĐỐI SOÁT SEPAY</span>
                <h2>Chi tiết giao dịch bất thường</h2>
              </div>
              <button onClick={() => setSelectedAnomaly(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <div className="product-modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px", fontSize: "13px" }}>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Phân loại:</small>
                  <p style={{ margin: "4px 0" }}>{renderTypeBadge(selectedAnomaly.anomalyType)}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Thời gian ghi nhận:</small>
                  <p style={{ margin: "4px 0" }}>{new Date(selectedAnomaly.createdAt).toLocaleString("vi-VN")}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Mã đơn liên quan:</small>
                  <p style={{ margin: "4px 0", fontWeight: 600 }}>{selectedAnomaly.orderCode || "Không có"}</p>
                </div>
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Số tiền chuyển khoản:</small>
                  <p style={{ margin: "4px 0", fontWeight: 700, color: "#38bdf8" }}>
                    {formatPrice(Number(selectedAnomaly.amount))}
                  </p>
                </div>
                {selectedAnomaly.expectedAmount && (
                  <div>
                    <small style={{ color: "var(--color-text-muted)" }}>Số tiền đơn dự kiến:</small>
                    <p style={{ margin: "4px 0", fontWeight: 600 }}>
                      {formatPrice(Number(selectedAnomaly.expectedAmount))}
                    </p>
                  </div>
                )}
                <div>
                  <small style={{ color: "var(--color-text-muted)" }}>Mã tham chiếu SePay:</small>
                  <p style={{ margin: "4px 0", fontFamily: "monospace", fontSize: "11px" }}>{selectedAnomaly.referenceCode || selectedAnomaly.gatewayId || "—"}</p>
                </div>
              </div>

              <div>
                <small style={{ color: "var(--color-text-muted)" }}>Nội dung chuyển tiền gốc:</small>
                <div style={{ background: "rgba(255,255,255,0.05)", padding: "8px 12px", borderRadius: "6px", marginTop: "4px", fontSize: "13px", wordBreak: "break-all" }}>
                  {selectedAnomaly.content}
                </div>
              </div>

              {selectedAnomaly.resolved && (
                <div style={{ background: "rgba(34, 197, 94, 0.08)", border: "1px solid rgba(34, 197, 94, 0.2)", borderRadius: "8px", padding: "12px" }}>
                  <span style={{ color: "#22c55e", fontWeight: 600, fontSize: "13px" }}>✓ Đã giải quyết bởi {selectedAnomaly.resolvedBy}</span>
                  <p style={{ fontSize: "12px", color: "var(--color-text-muted)", margin: "4px 0" }}>
                    Thời điểm: {selectedAnomaly.resolvedAt ? new Date(selectedAnomaly.resolvedAt).toLocaleString("vi-VN") : "—"}
                  </p>
                  <p style={{ fontSize: "13px", marginTop: "6px", wordBreak: "break-word" }}>
                    <strong>Ghi chú:</strong> {selectedAnomaly.resolutionNote}
                  </p>
                </div>
              )}

              {selectedAnomaly.rawPayload && (
                <div>
                  <small style={{ color: "var(--color-text-muted)", marginBottom: "4px", display: "block" }}>
                    Raw Payload Webhook:
                  </small>
                  <pre
                    style={{
                      background: "rgba(0, 0, 0, 0.4)",
                      border: "1px solid rgba(255, 255, 255, 0.1)",
                      borderRadius: "8px",
                      padding: "12px",
                      fontSize: "12px",
                      maxHeight: "200px",
                      overflowY: "auto",
                      color: "#a7f3d0",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-all",
                    }}
                  >
                    {JSON.stringify(selectedAnomaly.rawPayload, null, 2)}
                  </pre>
                </div>
              )}

              <div className="product-modal-actions" style={{ justifyContent: "flex-end" }}>
                {!selectedAnomaly.resolved && (
                  <button
                    className="primary-button"
                    onClick={() => {
                      setResolvingAnomaly(selectedAnomaly)
                      setSelectedAnomaly(null)
                      setResolutionNote("")
                    }}
                  >
                    Xử lý giao dịch này
                  </button>
                )}
                <button className="secondary-button" onClick={() => setSelectedAnomaly(null)}>
                  Đóng
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal xử lý đối soát */}
      {resolvingAnomaly && (
        <div
          className="product-modal-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && !resolving && setResolvingAnomaly(null)
          }
        >
          <div className="product-modal" style={{ maxWidth: "520px", width: "95%", boxSizing: "border-box" }}>
            <div className="product-modal-head">
              <div>
                <span className="section-kicker">XỬ LÝ ĐỐI SOÁT</span>
                <h2>Ghi nhận kết quả xử lý</h2>
              </div>
              <button onClick={() => !resolving && setResolvingAnomaly(null)}>
                <Icon name="close" size={20} />
              </button>
            </div>
            <form onSubmit={handleResolveSubmit} className="product-modal-body" style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: 0 }}>
                Giao dịch số tiền <strong>{formatPrice(Number(resolvingAnomaly.amount))}</strong> ({resolvingAnomaly.anomalyType}). Vui lòng nhập hướng xử lý đối soát (ví dụ: đã hoàn lại tiền vào STK khách, hoặc đã duyệt nạp bù tay...).
              </p>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>
                  Ghi chú giải quyết (*):
                </label>
                <textarea
                  required
                  rows={3}
                  value={resolutionNote}
                  onChange={(e) => setResolutionNote(e.target.value)}
                  placeholder="Ví dụ: Đã liên hệ Zalo và chuyển trả 50.000đ thừa qua STK Techcombank 1903..."
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    borderRadius: "8px",
                    background: "rgba(255, 255, 255, 0.05)",
                    border: "1px solid rgba(255, 255, 255, 0.15)",
                    color: "#fff",
                    padding: "10px",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
              </div>
              <div className="product-modal-actions" style={{ justifyContent: "flex-end", gap: "8px" }}>
                <button
                  type="button"
                  className="secondary-button"
                  disabled={resolving}
                  onClick={() => setResolvingAnomaly(null)}
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="primary-button"
                  disabled={resolving || !resolutionNote.trim()}
                >
                  {resolving ? "Đang lưu..." : "Xác nhận đã giải quyết"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export function AdminAccount({
  initialName,
  initialEmail,
  onUpdateProfile,
  onChangePassword,
}: {
  initialName: string
  initialEmail: string
  onUpdateProfile: (name: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
}) {
  const [name, setName] = useState(initialName)
  const [email, setEmail] = useState(initialEmail)
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [message, setMessage] = useState("")

  const [maintenanceMode, setMaintenanceMode] = useState(false)
  const [maintenanceMessage, setMaintenanceMessage] = useState("")
  const [maintenanceLoading, setMaintenanceLoading] = useState(false)
  const [maintenanceFeedback, setMaintenanceFeedback] = useState("")

  useEffect(() => {
    setName(initialName)
    setEmail(initialEmail)
  }, [initialName, initialEmail])

  useEffect(() => {
    api.settings
      .get<{ maintenanceMode?: boolean; maintenanceMessage?: string }>("siteConfig", false)
      .then((cfg) => {
        if (cfg) {
          setMaintenanceMode(Boolean(cfg.maintenanceMode))
          setMaintenanceMessage(cfg.maintenanceMessage || "")
        }
      })
      .catch(() => {})
  }, [])

  return (
    <div className="admin-account-page">
      <div className="panel-heading">
        <div>
          <h2>Tài khoản &amp; Cài đặt hệ thống</h2>
          <p>Cập nhật hồ sơ, bảo mật và công tắc bảo trì vận hành toàn trang.</p>
        </div>
      </div>
      <div className="admin-profile-card">
        <div className="admin-profile-avatar">NA</div>
        <div>
          <strong>{name}</strong>
          <span>{email}</span>
          <small>Quản trị viên cấp cao</small>
        </div>
      </div>
      <form
        className="admin-account-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setMessage("")
          try {
            await onUpdateProfile(name)
            setMessage("Đã cập nhật thông tin.")
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Không thể cập nhật thông tin.")
          }
        }}
      >
        <h3>Thông tin cá nhân</h3>
        <label>
          <span>Tên hiển thị</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          <span>Email</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <button className="primary-button">Lưu thông tin</button>
      </form>
      <form
        className="admin-account-form security"
        onSubmit={async (event) => {
          event.preventDefault()
          setMessage("")
          try {
            if (newPassword !== confirmPassword) throw new Error("Mật khẩu xác nhận không khớp.")
            await onChangePassword(currentPassword, newPassword)
            setCurrentPassword("")
            setNewPassword("")
            setConfirmPassword("")
            setMessage("Đã đổi mật khẩu.")
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "Không thể đổi mật khẩu.")
          }
        }}
      >
        <h3>Đổi mật khẩu</h3>
        <label>
          <span>Mật khẩu hiện tại</span>
          <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
        </label>
        <label>
          <span>Mật khẩu mới</span>
          <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} />
        </label>
        <label>
          <span>Xác nhận mật khẩu mới</span>
          <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} />
        </label>
        <button className="secondary-button">Cập nhật mật khẩu</button>
      </form>

      <form
        className="admin-account-form"
        style={{
          marginTop: "24px",
          border: maintenanceMode ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid rgba(255, 255, 255, 0.1)",
          background: maintenanceMode ? "rgba(239, 68, 68, 0.05)" : "rgba(255, 255, 255, 0.02)",
        }}
        onSubmit={async (event) => {
          event.preventDefault()
          setMaintenanceLoading(true)
          setMaintenanceFeedback("")
          try {
            await api.admin.updateSetting("siteConfig", {
              maintenanceMode,
              maintenanceMessage,
            })
            setMaintenanceFeedback(
              maintenanceMode
                ? "Đã BẬT chế độ bảo trì: Khách hàng sẽ thấy thông báo và bị chặn tạo đơn mới."
                : "Đã TẮT chế độ bảo trì: Website hoạt động bình thường.",
            )
          } catch (error) {
            setMaintenanceFeedback(
              error instanceof Error ? error.message : "Không thể cập nhật trạng thái bảo trì.",
            )
          } finally {
            setMaintenanceLoading(false)
          }
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "22px" }}>🛠️</span>
          <div>
            <h3 style={{ margin: 0 }}>Công tắc Bảo trì toàn trang (Maintenance Mode)</h3>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--color-text-muted)" }}>
              Khi kích hoạt, hệ thống sẽ chặn khách hàng tạo đơn mới và hiển thị banner cảnh báo trên toàn trang web.
            </p>
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: "10px", cursor: "pointer", margin: "14px 0" }}>
          <input
            type="checkbox"
            checked={maintenanceMode}
            onChange={(event) => setMaintenanceMode(event.target.checked)}
            style={{ width: "18px", height: "18px", accentColor: "#ef4444", cursor: "pointer" }}
          />
          <span style={{ fontWeight: 600, color: maintenanceMode ? "#f87171" : "#10b981" }}>
            {maintenanceMode ? "ĐANG BẬT BẢO TRÌ (CHẶN ĐẶT ĐƠN)" : "ĐANG TẮT BẢO TRÌ (HOẠT ĐỘNG BÌNH THƯỜNG)"}
          </span>
        </label>

        <label>
          <span>Thông điệp hiển thị cho khách hàng</span>
          <textarea
            rows={3}
            value={maintenanceMessage}
            onChange={(event) => setMaintenanceMessage(event.target.value)}
            placeholder="Ví dụ: Hệ thống nạp game đang tạm ngưng nhận đơn để bảo trì nâng cấp. Vui lòng quay lại sau ít phút!"
            style={{
              width: "100%",
              borderRadius: "8px",
              padding: "10px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#fff",
              fontSize: "14px",
              resize: "vertical",
            }}
          />
        </label>

        <button
          className="primary-button"
          type="submit"
          disabled={maintenanceLoading}
          style={{ background: maintenanceMode ? "#dc2626" : undefined }}
        >
          {maintenanceLoading ? "Đang lưu..." : "Lưu cài đặt bảo trì"}
        </button>

        {maintenanceFeedback && (
          <span
            className={maintenanceFeedback.startsWith("Đã") ? "form-success" : "form-error"}
            style={{ marginTop: "10px", display: "block" }}
          >
            {maintenanceFeedback}
          </span>
        )}
      </form>

      {message && <span className="form-success">{message}</span>}
    </div>
  )
}

export function ContactAdminEditor({
  info: initialInfo,
  onChange: onSave,
}: {
  info: ContactInfo
  onChange: (info: ContactInfo) => void | Promise<void>
}) {
  const [info, onChange] = useState(initialInfo)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await onSave(info); setMessage("Đã lưu thay đổi.") }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi.") }
    finally { setSaving(false) }
  }
  const updateInfo = <K extends keyof ContactInfo,>(
    key: K,
    value: ContactInfo[K],
  ) => onChange({ ...info, [key]: value })
  const updateChannel = (
    id: string | number,
    updates: Partial<ContactChannel>,
  ) =>
    updateInfo(
      "channels",
      info.channels.map((channel) =>
        channel.id === id ? { ...channel, ...updates } : channel,
      ),
    )
  const uploadChannelImage = async (id: string | number, file?: File) => {
    if (!file) return
    try {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      const { api } = await import("@/services/api")
      const result = await api.admin.uploadImage({ filename: file.name, data })
      updateChannel(id, { image: result.url, platform: "custom" })
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Image upload failed")
    }
  }
  const changePlatform = (
    channel: ContactChannel,
    platform: ContactPlatform,
  ) => {
    if (platform === "custom") {
      updateChannel(channel.id, { platform })
      return
    }
    updateChannel(channel.id, { platform, image: platformLogos[platform] })
  }

  return (
    <fieldset className="contact-admin" disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className="panel-heading">
        <div>
          <h2>Nội dung trang liên hệ</h2>
          <p>
            Chỉnh nội dung chung và quản lý các kênh mạng xã hội hiển thị với
            người dùng.
          </p>
        </div>
      </div>
      <div className="middleman-admin-section">
        <h3>Nội dung chung</h3>
        <label className="wide">
          <span>Giới thiệu</span>
          <textarea
            value={info.intro}
            onChange={(event) => updateInfo("intro", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Khung giờ hỗ trợ</span>
          <input
            value={info.supportHours}
            onChange={(event) => updateInfo("supportHours", event.target.value)}
          />
        </label>
        <label>
          <span>Tiêu đề cam kết</span>
          <input
            value={info.commitmentTitle}
            onChange={(event) =>
              updateInfo("commitmentTitle", event.target.value)
            }
          />
        </label>
        <label>
          <span>Nội dung cam kết</span>
          <input
            value={info.commitment}
            onChange={(event) => updateInfo("commitment", event.target.value)}
          />
        </label>
      </div>
      <div className="channel-admin-heading">
        <div>
          <h3>Các kênh liên hệ</h3>
          <span>{info.channels.length} kênh đang hiển thị</span>
        </div>
        <button
          className="primary-button"
          onClick={() =>
            updateInfo("channels", [
              ...info.channels,
              {
                id: Date.now(),
                platform: "zalo",
                label: "Kênh mới",
                name: "Tên kênh",
                description: "Mô tả ngắn về kênh liên hệ.",
                url: "#",
                image: platformLogos.zalo,
                color: "cyan",
              },
            ])
          }
        >
          <Icon name="plus" size={16} /> Thêm kênh
        </button>
      </div>
      <div className="channel-editor-list">
        {info.channels.map((channel) => (
          <div className="channel-editor-card" key={channel.id}>
            <div className="channel-editor-preview">
              <span>
                <img src={channel.image} alt="" />
              </span>
              <div>
                <small>{channel.label}</small>
                <strong>{channel.name}</strong>
              </div>
              <button
                onClick={() =>
                  updateInfo(
                    "channels",
                    info.channels.filter((item) => item.id !== channel.id),
                  )
                }
                aria-label={`Xóa ${channel.name}`}
              >
                <Icon name="trash" size={17} />
              </button>
            </div>
            <div className="channel-editor-fields">
              <label>
                <span>Nền tảng</span>
                <select
                  value={channel.platform}
                  onChange={(event) =>
                    changePlatform(
                      channel,
                      event.target.value as ContactPlatform,
                    )
                  }
                >
                  <option value="zalo">Zalo</option>
                  <option value="youtube">YouTube</option>
                  <option value="discord">Discord</option>
                  <option value="facebook">Facebook</option>
                  <option value="telegram">Telegram</option>
                  <option value="email">Email</option>
                  <option value="custom">Ảnh tùy chỉnh</option>
                </select>
              </label>
              <label>
                <span>Nhãn</span>
                <input
                  value={channel.label}
                  onChange={(event) =>
                    updateChannel(channel.id, { label: event.target.value })
                  }
                />
              </label>
              <label>
                <span>Tên kênh</span>
                <input
                  value={channel.name}
                  onChange={(event) =>
                    updateChannel(channel.id, { name: event.target.value })
                  }
                />
              </label>
              <label className="wide">
                <span>Mô tả</span>
                <input
                  value={channel.description}
                  onChange={(event) =>
                    updateChannel(channel.id, {
                      description: event.target.value,
                    })
                  }
                />
              </label>
              <label>
                <span>Đường dẫn mở kênh</span>
                <input
                  value={channel.url}
                  onChange={(event) =>
                    updateChannel(channel.id, { url: event.target.value })
                  }
                />
              </label>
              <label>
                <span>URL ảnh/logo</span>
                <input
                  value={channel.image}
                  onChange={(event) =>
                    updateChannel(channel.id, {
                      image: event.target.value,
                      platform: "custom",
                    })
                  }
                />
              </label>
              <label className="channel-upload">
                <span>Hoặc tải logo lên</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(event) =>
                    uploadChannelImage(channel.id, event.target.files?.[0])
                  }
                />
                <b>Chọn ảnh</b>
              </label>
              <label>
                <span>Màu điểm nhấn</span>
                <select
                  value={channel.color}
                  onChange={(event) =>
                    updateChannel(channel.id, { color: event.target.value })
                  }
                >
                  <option value="cyan">Cyan</option>
                  <option value="green">Xanh lá</option>
                  <option value="red">Đỏ</option>
                  <option value="violet">Tím</option>
                  <option value="blue">Xanh dương</option>
                </select>
              </label>
            </div>
          </div>
        ))}
      </div>
      <button type="button" className="primary-button" onClick={save}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  )
}

export function FooterAdminEditor({
  config: initialConfig,
  onChange: onSave,
}: {
  config?: FooterConfig
  onChange?: (config: FooterConfig) => void | Promise<void>
}) {
  const [config, setConfig] = useState<FooterConfig>(initialConfig || initialFooterConfig)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<{
    type: "success" | "error" | "info"
    text: string
  } | null>(null)

  const save = async () => {
    if (saving || !onSave) return
    setSaving(true)
    setStatus(null)
    try {
      await onSave(config)
      setStatus({ type: "success", text: "Đã lưu cấu hình chân trang thành công." })
    } catch (error) {
      setStatus({
        type: "error",
        text: error instanceof Error ? error.message : "Không thể lưu thay đổi.",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = () => {
    if (window.confirm("Khôi phục toàn bộ cấu hình chân trang về mặc định ban đầu?")) {
      setConfig({ ...initialFooterConfig })
      setStatus({
        type: "info",
        text: "Đã khôi phục mặc định (nhấn Lưu để cập nhật lên máy chủ).",
      })
    }
  }

  const addGroup = () => {
    const newId = String(Date.now())
    setConfig((prev) => ({
      ...prev,
      communityGroups: [
        ...(prev.communityGroups || []),
        { id: newId, name: "Zalo Nhóm Mới", url: "https://zalo.me/g/" },
      ],
    }))
  }

  const updateGroup = (id: string, updates: Partial<FooterCommunityGroup>) => {
    setConfig((prev) => ({
      ...prev,
      communityGroups: (prev.communityGroups || []).map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    }))
  }

  const removeGroup = (id: string) => {
    setConfig((prev) => ({
      ...prev,
      communityGroups: (prev.communityGroups || []).filter((g) => g.id !== id),
    }))
  }

  return (
    <fieldset className="contact-admin" disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className="panel-heading">
        <div>
          <h2>Cấu hình Chân trang &amp; Cộng đồng</h2>
          <p>
            Tùy chỉnh hộp kêu gọi ủng hộ (YouTube / Donate), danh sách nhóm Zalo cộng đồng và dòng chữ bản quyền.
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button
            type="button"
            className="secondary-btn"
            onClick={handleResetDefault}
            title="Khôi phục giá trị mặc định ban đầu"
          >
            Khôi phục mặc định
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={save}
            disabled={saving}
          >
            {saving ? "Đang lưu…" : "Lưu thay đổi"}
          </button>
        </div>
      </div>

      {status && (
        <div
          style={{
            padding: "10px 16px",
            marginBottom: "16px",
            borderRadius: "8px",
            background:
              status.type === "error"
                ? "rgba(239, 68, 68, 0.15)"
                : status.type === "info"
                ? "rgba(56, 189, 248, 0.15)"
                : "rgba(34, 197, 94, 0.15)",
            border: `1px solid ${
              status.type === "error"
                ? "rgba(239, 68, 68, 0.4)"
                : status.type === "info"
                ? "rgba(56, 189, 248, 0.4)"
                : "rgba(34, 197, 94, 0.4)"
            }`,
            color:
              status.type === "error"
                ? "#f87171"
                : status.type === "info"
                ? "#38bdf8"
                : "#4ade80",
            fontSize: "14px",
          }}
        >
          {status.text}
        </div>
      )}

      {/* ─── 1. Hộp Ủng Hộ (Donation Box) ─── */}
      <div className="middleman-admin-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0 }}>✦ Hộp kêu gọi ủng hộ (Donate Card)</h3>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: "pointer", fontSize: "14px" }}>
            <input
              type="checkbox"
              checked={config.showDonationBox}
              onChange={(e) => setConfig((prev) => ({ ...prev, showDonationBox: e.target.checked }))}
            />
            <span>Hiển thị trên website</span>
          </label>
        </div>

        <label className="wide">
          <span>Tiêu đề kêu gọi ủng hộ</span>
          <textarea
            rows={2}
            value={config.donationTitle}
            onChange={(e) => setConfig((prev) => ({ ...prev, donationTitle: e.target.value }))}
            placeholder="Ví dụ: Nếu cảm thấy nội dung hay và hữu ích thì bạn có thể ủng hộ DUKE1305 bằng cách:"
          />
        </label>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px", marginTop: "10px" }}>
          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <h4 style={{ fontSize: "14px", color: "#f87171", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>📺</span> Nút Kênh YouTube
            </h4>
            <label className="wide" style={{ marginBottom: "8px" }}>
              <span>Tên nút</span>
              <input
                value={config.youtubeBtnText}
                onChange={(e) => setConfig((prev) => ({ ...prev, youtubeBtnText: e.target.value }))}
                placeholder="Đăng Ký Kênh"
              />
            </label>
            <label className="wide">
              <span>Đường link kênh YouTube</span>
              <input
                value={config.youtubeUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, youtubeUrl: e.target.value }))}
                placeholder="https://youtube.com/@duke1305"
              />
            </label>
          </div>

          <div style={{ background: "rgba(255, 255, 255, 0.02)", padding: "14px", borderRadius: "10px", border: "1px solid rgba(255, 255, 255, 0.06)" }}>
            <h4 style={{ fontSize: "14px", color: "#fbbf24", margin: "0 0 10px 0", display: "flex", alignItems: "center", gap: "6px" }}>
              <span>💎</span> Nút Donate
            </h4>
            <label className="wide" style={{ marginBottom: "8px" }}>
              <span>Tên nút</span>
              <input
                value={config.donateBtnText}
                onChange={(e) => setConfig((prev) => ({ ...prev, donateBtnText: e.target.value }))}
                placeholder="Donate Cho DUKE1305"
              />
            </label>
            <label className="wide">
              <span>Đường link Donate / MoMo / STK</span>
              <input
                value={config.donateUrl}
                onChange={(e) => setConfig((prev) => ({ ...prev, donateUrl: e.target.value }))}
                placeholder="https://me.momo.vn/duke1305"
              />
            </label>
          </div>
        </div>
      </div>

      {/* ─── 2. Nhóm Zalo Cộng Đồng ─── */}
      <div className="middleman-admin-section">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px", flexWrap: "wrap", gap: "10px" }}>
          <h3 style={{ margin: 0 }}>💬 Nhóm Zalo Cộng Đồng</h3>
          <button
            type="button"
            className="secondary-btn"
            onClick={addGroup}
            style={{ fontSize: "13px", padding: "6px 14px" }}
          >
            + Thêm nhóm Zalo
          </button>
        </div>

        <label className="wide" style={{ marginBottom: "16px" }}>
          <span>Tiêu đề phần cộng đồng</span>
          <input
            value={config.communityTitle}
            onChange={(e) => setConfig((prev) => ({ ...prev, communityTitle: e.target.value }))}
            placeholder="Tổng Hợp Tất Cả Nhóm Zalo Cộng Đồng"
          />
        </label>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {(!config.communityGroups || config.communityGroups.length === 0) ? (
            <p style={{ color: "#94a3b8", fontSize: "13px", fontStyle: "italic", margin: "8px 0" }}>
              Chưa có nhóm nào. Bấm &quot;+ Thêm nhóm Zalo&quot; để tạo nút viên thuốc (capsule) trên chân trang.
            </p>
          ) : (
            config.communityGroups.map((group, idx) => (
              <div
                key={group.id}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1.2fr auto",
                  gap: "10px",
                  alignItems: "center",
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "10px 12px",
                  borderRadius: "8px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div>
                  <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginBottom: "2px" }}>
                    Tên nhóm #{idx + 1}
                  </small>
                  <input
                    value={group.name}
                    onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                    placeholder={`Ví dụ: Zalo Nhóm Aniimo ${idx + 1}`}
                    style={{ margin: 0, width: "100%" }}
                  />
                </div>
                <div>
                  <small style={{ color: "#94a3b8", fontSize: "11px", display: "block", marginBottom: "2px" }}>
                    Đường link Zalo (zalo.me/g/...)
                  </small>
                  <input
                    value={group.url}
                    onChange={(e) => updateGroup(group.id, { url: e.target.value })}
                    placeholder="https://zalo.me/g/..."
                    style={{ margin: 0, width: "100%" }}
                  />
                </div>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => removeGroup(group.id)}
                  style={{
                    padding: "8px 12px",
                    fontSize: "12px",
                    background: "rgba(239, 68, 68, 0.15)",
                    border: "1px solid rgba(239, 68, 68, 0.3)",
                    color: "#f87171",
                    borderRadius: "6px",
                    cursor: "pointer",
                    marginTop: "16px",
                  }}
                  title="Xóa nhóm này"
                >
                  Xóa
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ─── 3. Dòng Bản Quyền (Copyright) ─── */}
      <div className="middleman-admin-section">
        <h3>© Bản quyền chân trang</h3>
        <label className="wide">
          <span>Dòng chữ bản quyền (Copyright)</span>
          <input
            value={config.copyrightText}
            onChange={(e) => setConfig((prev) => ({ ...prev, copyrightText: e.target.value }))}
            placeholder="©2026 Bản Quyền Thiết Kế Thuộc Về DUKE1305."
          />
        </label>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
        <button
          type="button"
          className="primary-button"
          onClick={save}
          disabled={saving}
          style={{ padding: "12px 32px", fontSize: "15px" }}
        >
          {saving ? "Đang lưu…" : "Lưu thay đổi cấu hình chân trang"}
        </button>
      </div>
    </fieldset>
  )
}


export function MiddlemanAdminEditor({
  info: initialInfo,
  onChange: onSave,
}: {
  info: MiddlemanInfo
  onChange: (info: MiddlemanInfo) => void | Promise<void>
}) {
  const [info, onChange] = useState(initialInfo)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const save = async () => {
    if (saving) return
    setSaving(true)
    try { await onSave(info); setMessage("Đã lưu thay đổi.") }
    catch (error) { setMessage(error instanceof Error ? error.message : "Không thể lưu thay đổi.") }
    finally { setSaving(false) }
  }
  const update = <K extends keyof MiddlemanInfo,>(
    key: K,
    value: MiddlemanInfo[K],
  ) => onChange({ ...info, [key]: value })
  const updateFee = (index: number, key: "range" | "fee", value: string) =>
    update(
      "fees",
      info.fees.map((row, rowIndex) =>
        rowIndex === index ? { ...row, [key]: value } : row,
      ),
    )

  return (
    <fieldset className="middleman-admin" disabled={saving} style={{ border: 0, margin: 0, padding: 0, minWidth: 0 }}>
      <div className="panel-heading">
        <div>
          <h2>Nội dung trang trung gian</h2>
          <p>
            Bấm Lưu thay đổi để cập nhật nội dung trên trang Trung gian.
          </p>
        </div>
      </div>
      <div className="middleman-admin-section">
        <h3>Giới thiệu & hỗ trợ</h3>
        <label className="wide">
          <span>Nội dung giới thiệu</span>
          <textarea
            value={info.intro}
            onChange={(event) => update("intro", event.target.value)}
          />
        </label>
        <label>
          <span>Khung giờ hỗ trợ</span>
          <input
            value={info.supportHours}
            onChange={(event) => update("supportHours", event.target.value)}
          />
        </label>
        <label>
          <span>Tiêu đề liên hệ</span>
          <input
            value={info.contactTitle}
            onChange={(event) => update("contactTitle", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Mô tả liên hệ</span>
          <input
            value={info.contactDescription}
            onChange={(event) =>
              update("contactDescription", event.target.value)
            }
          />
        </label>
      </div>
      <div className="middleman-admin-section">
        <h3>Thông tin Zalo</h3>
        <label>
          <span>Tên hiển thị</span>
          <input
            value={info.zaloName}
            onChange={(event) => update("zaloName", event.target.value)}
          />
        </label>
        <label>
          <span>Số điện thoại</span>
          <input
            value={info.zaloPhone}
            onChange={(event) => update("zaloPhone", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Đường dẫn Zalo</span>
          <input
            value={info.zaloUrl}
            onChange={(event) => update("zaloUrl", event.target.value)}
          />
        </label>
      </div>
      <div className="middleman-admin-section fee-editor">
        <h3>Biểu phí dịch vụ</h3>
        {info.fees.map((row, index) => (
          <div className="fee-editor-row" key={index}>
            <input
              value={row.range}
              onChange={(event) =>
                updateFee(index, "range", event.target.value)
              }
              placeholder="Giá trị trao đổi"
            />
            <input
              value={row.fee}
              onChange={(event) => updateFee(index, "fee", event.target.value)}
              placeholder="Mức phí"
            />
            <button
              onClick={() =>
                update(
                  "fees",
                  info.fees.filter((_, rowIndex) => rowIndex !== index),
                )
              }
            >
              <Icon name="trash" size={16} />
            </button>
          </div>
        ))}
        <button
          className="add-fee-row"
          onClick={() => update("fees", [...info.fees, { range: "", fee: "" }])}
        >
          <Icon name="plus" size={15} /> Thêm mức phí
        </button>
        <label className="wide">
          <span>Ghi chú biểu phí</span>
          <input
            value={info.feeNote}
            onChange={(event) => update("feeNote", event.target.value)}
          />
        </label>
      </div>
      <div className="middleman-admin-section">
        <h3>Quy định & cảnh báo</h3>
        <label className="wide">
          <span>Phạm vi nhận</span>
          <textarea
            value={info.accepted}
            onChange={(event) => update("accepted", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Nội dung không nhận</span>
          <textarea
            value={info.rejected}
            onChange={(event) => update("rejected", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Cảnh báo mạo danh</span>
          <textarea
            value={info.warning}
            onChange={(event) => update("warning", event.target.value)}
          />
        </label>
      </div>
      <div className="middleman-admin-section">
        <h3>Ngân hàng & cam kết</h3>
        <label>
          <span>Ngân hàng</span>
          <input
            value={info.bank}
            onChange={(event) => update("bank", event.target.value)}
          />
        </label>
        <label>
          <span>Số tài khoản</span>
          <input
            value={info.accountNumber}
            onChange={(event) => update("accountNumber", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Chủ tài khoản</span>
          <input
            value={info.accountHolder}
            onChange={(event) => update("accountHolder", event.target.value)}
          />
        </label>
        <label className="wide">
          <span>Nội dung cam kết</span>
          <textarea
            value={info.commitment}
            onChange={(event) => update("commitment", event.target.value)}
          />
        </label>
      </div>
      <button type="button" className="primary-button" onClick={save}>{saving ? "Đang lưu…" : "Lưu thay đổi"}</button>
      {message && <p role="status">{message}</p>}
    </fieldset>
  )
}

export function AdminLogin({
  onLogin,
  onStore,
}: {
  onLogin: (email: string, password: string) => void
  onStore: () => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Vui lòng nhập đúng email quản trị.")
    if (password.length < 6) return setError("Mật khẩu cần có ít nhất 6 ký tự.")
    void Promise.resolve().then(() => onLogin(email, password)).catch((error) =>
      setError(error instanceof Error ? error.message : "Không thể đăng nhập."))
  }

  return (
    <main className="admin-login-page">
      <div className="admin-login-brand">
        <span className="brand-mark">
          <Icon name="shield" size={20} />
        </span>
        <span>
          DUKE<span>1305 ADMIN</span>
        </span>
      </div>
      <div className="admin-login-card">
        <span className="admin-login-icon">
          <Icon name="shield" size={26} />
        </span>
        <span className="section-kicker">CỔNG NỘI BỘ</span>
        <h1>Đăng nhập quản trị</h1>
        <p>
          Khu vực này chỉ dành cho nhân sự được cấp quyền. Mọi lượt truy cập đều
          được ghi nhận.
        </p>
        <form onSubmit={submit}>
          <label>
            <span>Email quản trị</span>
            <div>
              <Icon name="mail" size={18} />
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin@duke1305.vn"
              />
            </div>
          </label>
          <label>
            <span>Mật khẩu</span>
            <div>
              <Icon name="shield" size={18} />
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Tối thiểu 6 ký tự"
              />
            </div>
          </label>
          {error && <span className="form-error">{error}</span>}
          <button className="primary-button" type="submit">
            Truy cập hệ thống <Icon name="chevron" size={18} />
          </button>
        </form>
        <button className="back-to-store" onClick={onStore}>
          <Icon name="home" size={16} /> Quay lại cửa hàng
        </button>
      </div>
      <span className="admin-security-note">
        <Icon name="shield" size={14} /> Kết nối được mã hóa và bảo vệ
      </span>
    </main>
  )
}
