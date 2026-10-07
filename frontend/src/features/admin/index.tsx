import { FormEvent, useEffect, useMemo, useState } from "react"
import type {
  ContactChannel,
  ContactInfo,
  ContactPlatform,
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
import { platformLogos } from "@/data/mock-data"
import { Icon, Pagination, ProductCard, ServiceCard, formatPrice } from "@/components/ui"

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
          <button className="secondary-button" onClick={onStore}>
            <Icon name="home" size={16} /> Về cửa hàng
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

      let finalUrl = dataUri
      try {
        const { api } = await import("@/services/api")
        const res = await api.admin.uploadImage({
          filename: file.name,
          data: dataUri,
        })
        if (res?.url) {
          finalUrl = res.url
        }
      } catch {
        // Fallback to dataUri if server upload route fails
      }

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
      console.error("Upload error:", err)
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
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
  middlemanInfo,
  onUpdateMiddleman,
  contactInfo,
  onUpdateContact,
  users,
  transactions,
  onUpdateUser,
  onUpdateTransaction,
  onUpdateProfile,
  onChangePassword,
  adminName,
  adminEmail,
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
  onDeleteTopupTemplate: (id: string) => void
  onAddCategory: (name: string) => void | Promise<void>
  onUpdateCategory?: (oldName: string, newName: string) => void | Promise<void>
  onDeleteCategory: (name: string) => void | Promise<void>
  onAddGame: (name: string) => void
  onDeleteGame: (name: string) => void
  onUpdateGame: (name: string, updates: Partial<Service>) => void | Promise<void>
  middlemanInfo: MiddlemanInfo
  onUpdateMiddleman: (info: MiddlemanInfo) => void
  contactInfo: ContactInfo
  onUpdateContact: (info: ContactInfo) => void
  users: ManagedUser[]
  transactions: Transaction[]
  onUpdateUser: (id: number, updates: Partial<ManagedUser>) => void
  onUpdateTransaction: (id: number, status: TransactionStatus) => void
  onUpdateProfile: (name: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  adminName: string
  adminEmail: string
}) {
  const [tab, setTab] =
    useState<"products" | "templates" | "statuses" | "categories" | "games" | "middleman" | "contacts" | "transactions" | "users" | "adminAccount" | "analytics">(
      "products",
    )
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const selectTab = (
    nextTab: "products" | "templates" | "statuses" | "categories" | "games" | "middleman" | "contacts" | "transactions" | "users" | "adminAccount" | "analytics",
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
  const [image, setImage] = useState("")
  const [imageX, setImageX] = useState(50)
  const [imageY, setImageY] = useState(50)
  const [editingProductId, setEditingProductId] = useState<number | null>(null)
  const [productStatusId, setProductStatusId] = useState("available")
  const [productTemplateId, setProductTemplateId] = useState(
    topupTemplates[0]?.id || "",
  )
  const [productIsActive, setProductIsActive] = useState(true)
  const [productFormError, setProductFormError] = useState("")
  const [productSaved, setProductSaved] = useState(false)
  const [addProductOpen, setAddProductOpen] = useState(false)
  const [productSearch, setProductSearch] = useState("")
  const [adminProductPage, setAdminProductPage] = useState(1)

  const submitProduct = (event: FormEvent) => {
    event.preventDefault()
    setProductSaved(false)
    if (!name.trim()) return setProductFormError("Vui lòng nhập tên sản phẩm.")
    if (!game) return setProductFormError("Vui lòng chọn game.")
    if (!price || Number(price) <= 0)
      return setProductFormError("Giá bán phải lớn hơn 0.")
    const parsedPrice = Number(price)
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
      image: image || undefined,
      imagePosition: `${imageX}% ${imageY}%`,
      isActive: productIsActive,
    }
    if (editingProductId !== null) onUpdateProduct(editingProductId, payload)
    else onAddProduct(payload)
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
            className={tab === "adminAccount" ? "active" : ""}
            onClick={() => selectTab("adminAccount")}
          >
            <Icon name="shield" size={18} /> Tài khoản admin
          </button>
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
                          <button className="primary-button" type="submit">
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
                className="category-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  if (newGame.trim()) {
                    onAddGame(newGame.trim())
                    setNewGame("")
                    if (!game) setGame(newGame.trim())
                  }
                }}
              >
                <label>
                  <span>Tên game mới</span>
                  <input
                    value={newGame}
                    onChange={(event) => setNewGame(event.target.value)}
                    placeholder="Ví dụ: Arknights: Endfield"
                  />
                </label>
                <button className="primary-button">
                  <Icon name="plus" size={18} /> Thêm game
                </button>
              </form>
              <div className="tag-manager game-manager">
                {games.map((item) => {
                  const service = services.find(
                    (entry) => entry.name === item || entry.game === item,
                  )
                  const count = products.filter((p) => p.game === item).length

                  return (
                    <div key={item} className="tag-manager-item">
                      <div className="tag-manager-info">
                        <Icon name="game" size={17} />
                        <div>
                          <strong>{item}</strong>
                          <small style={{ color: "#626e82", display: "block" }}>
                            {count} gói nạp · Tone: {service?.tone || "blue"}
                            {service && !service.isActive ? " · (Đang ẩn)" : ""}
                          </small>
                        </div>
                      </div>
                      <div className="tag-manager-actions">
                        <button
                          type="button"
                          onClick={() => {
                            if (!service) return
                            const nextActive = service.isActive === false ? true : false
                            onUpdateGame(item, { isActive: nextActive })
                          }}
                          aria-label={service?.isActive === false ? "Hiện game này" : "Ẩn game này"}
                          title={service?.isActive === false ? "Game đang ẩn - Bấm để hiển thị trên website" : "Game đang hiện - Bấm để ẩn khỏi website"}
                          style={{
                            color: service?.isActive === false ? "#ef7587" : "#4ae0a8",
                          }}
                        >
                          <Icon name={service?.isActive === false ? "eye-off" : "eye"} size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingGame(item)
                            setGameName(service?.name || item)
                            setGameKey(service?.game || item)
                            setGameDescription(service?.description || "")
                            setGameTone(service?.tone || "blue")
                            setGameSortOrder(String(service?.sortOrder ?? 0))
                            setGameImage(service?.image || "")
                            const pos = (service?.imagePosition || "50% 50%")
                              .split(" ")
                              .map(Number)
                            setGameImageX(!isNaN(pos[0]) ? pos[0] : 50)
                            setGameImageY(!isNaN(pos[1]) ? pos[1] : 50)
                            setGameIsActive(service?.isActive ?? true)
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
                            const confirmMsg =
                              count > 0
                                ? `Game "${item}" đang có ${count} sản phẩm/gói nạp.\n\nNếu xóa, các gói nạp này cũng sẽ bị xóa khỏi hệ thống.\n\nBạn có chắc chắn muốn xóa game này không?`
                                : `Bạn có chắc chắn muốn xóa game "${item}" không?`
                            if (window.confirm(confirmMsg)) {
                              onDeleteGame(item)
                              if (game === item)
                                setGame(games.find((entry) => entry !== item) || "")
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
                        await onUpdateGame(editingGame, {
                          name: gameName.trim(),
                          game: gameKey.trim() || gameName.trim(),
                          description: gameDescription.trim(),
                          tone: gameTone,
                          sortOrder: Number(gameSortOrder) || 0,
                          image: gameImage.trim() || undefined,
                          imagePosition: `${gameImageX}% ${gameImageY}%`,
                          isActive: gameIsActive,
                        })
                        setEditingGame(null)
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
                            placeholder="Mô tả tóm tắt dịch vụ nạp cho game..."
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

                        <label className="modal-availability" style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                          <input
                            type="checkbox"
                            checked={gameIsActive}
                            onChange={(e) => setGameIsActive(e.target.checked)}
                            style={{ width: "auto", accentColor: "#39dbf8" }}
                          />
                          <span>Bật hiển thị game này trên website</span>
                        </label>

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
          ) : tab === "middleman" ? (
            <MiddlemanAdminEditor
              info={middlemanInfo}
              onChange={onUpdateMiddleman}
            />
          ) : tab === "contacts" ? (
            <ContactAdminEditor info={contactInfo} onChange={onUpdateContact} />
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
  onDelete: (id: string) => void
}) {
  const [draft, setDraft] = useState<TopupTemplate | null>(null)
  const [error, setError] = useState("")
  const fieldTypes: { value: TopupFieldType label: string }[] = [
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
  const save = () => {
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
    if (templates.some((item) => item.id === draft.id))
      onUpdate(draft.id, normalized)
    else onAdd(normalized)
    setDraft(null)
    setError("")
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
                onClick={() => {
                  const confirmMsg =
                    usage > 0
                      ? `Mẫu "${template.name}" đang được sử dụng bởi ${usage} gói nạp.\n\nNếu xóa, các gói nạp này sẽ được gỡ mẫu thông tin (chuyển sang không dùng mẫu).\n\nBạn có chắc chắn muốn xóa không?`
                      : `Bạn có chắc chắn muốn xóa mẫu thông tin "${template.name}" không?`
                  if (window.confirm(confirmMsg)) {
                    onDelete(template.id)
                  }
                }}
                title={
                  usage > 0
                    ? `Đang có ${usage} gói nạp sử dụng. Nhấn để xóa.`
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
                            value={field.options.join(", ")}
                            onChange={(event) =>
                              updateField(field.id, {
                                options: event.target.value
                                  .split(",")
                                  .map((item) => item.trim())
                                  .filter(Boolean),
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
                    onClick={() => {
                      const usage = products.filter(
                        (product) => product.templateId === draft.id,
                      ).length
                      const confirmMsg =
                        usage > 0
                          ? `Mẫu "${draft.name}" đang được sử dụng bởi ${usage} gói nạp.\n\nNếu xóa, các gói nạp này sẽ được gỡ mẫu thông tin.\n\nBạn có chắc chắn muốn xóa không?`
                          : `Bạn có chắc chắn muốn xóa mẫu thông tin "${draft.name}" không?`
                      if (window.confirm(confirmMsg)) {
                        onDelete(draft.id)
                        setDraft(null)
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
  const iconOptions: { value: IconName label: string }[] = [
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
      let timestamp = 0
      if (t.date && t.date.includes("/")) {
        const [dPart, tPart] = t.date.split(" ")
        const [d, m, y] = (dPart || "").split("/").map(Number)
        const [hh, mm] = (tPart || "0:0").split(":").map(Number)
        timestamp = new Date(y || 2025, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime()
      } else if (t.date) {
        timestamp = new Date(t.date).getTime()
      }
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

export function AdminTransactions({
  transactions,
  onUpdate,
  onViewAnalytics,
}: {
  transactions: Transaction[]
  onUpdate: (id: number, status: TransactionStatus) => void
  onViewAnalytics?: () => void
}) {
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("Tất cả")
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<Transaction | null>(null)
  const statuses: Array<"Tất cả" | TransactionStatus> = [
    "Tất cả",
    "Chờ thanh toán",
    "Đang xử lý",
    "Hoàn thành",
    "Thất bại",
    "Đã hoàn tiền",
  ]
  const filtered = transactions.filter(
    (item) =>
      (status === "Tất cả" || item.status === status) &&
      `${item.code} ${item.email} ${item.product}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const totalPages = Math.max(1, Math.ceil(filtered.length / 8))
  const visible = filtered.slice((page - 1) * 8, page * 8)
  useEffect(() => setPage(1), [search, status])

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
          <span>{transactions.length} giao dịch</span>
        </div>
      </div>
      <div className="data-filters transaction-filters">
        <label className="admin-search">
          <Icon name="search" size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Mã đơn, email, sản phẩm..."
          />
        </label>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          {statuses.map((item) => (
            <option key={item}>{item}</option>
          ))}
        </select>
      </div>
      <div className="admin-table transaction-table">
        <div className="admin-table-head">
          <span>Mã giao dịch</span>
          <span>Khách hàng</span>
          <span>Sản phẩm</span>
          <span>Số tiền</span>
          <span>Trạng thái</span>
          <span>Thao tác</span>
        </div>
        {visible.map((item) => (
          <div className="admin-table-row" key={item.id}>
            <span>
              <strong>{item.code}</strong>
              <small>{item.date}</small>
            </span>
            <span>{item.email}</span>
            <span>
              <strong>{item.product}</strong>
              <small>
                {item.game} · Số lượng: {item.quantity || 1}
              </small>
            </span>
            <strong>{formatPrice(item.amount)}</strong>
            <select
              className={`transaction-status status-${item.status.replaceAll(" ", "-").toLowerCase()}`}
              value={item.status}
              onChange={(event) =>
                onUpdate(item.id, event.target.value as TransactionStatus)
              }
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
                          onClick={() => navigator.clipboard?.writeText(String(value))}
                        >
                          Sao chép
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
    </div>
  )
}

export function AdminUsers({
  users,
  onUpdate,
}: {
  users: ManagedUser[]
  onUpdate: (id: number, updates: Partial<ManagedUser>) => void
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
  useEffect(() => {
    setName(initialName)
    setEmail(initialEmail)
  }, [initialName, initialEmail])
  return (
    <div className="admin-account-page">
      <div className="panel-heading">
        <div>
          <h2>Tài khoản quản trị</h2>
          <p>Cập nhật hồ sơ và thông tin bảo mật của bạn.</p>
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
      {message && <span className="form-success">{message}</span>}
    </div>
  )
}

export function ContactAdminEditor({
  info,
  onChange,
}: {
  info: ContactInfo
  onChange: (info: ContactInfo) => void
}) {
  const updateInfo = <K extends keyof ContactInfo,>(
    key: K,
    value: ContactInfo[K],
  ) => onChange({ ...info, [key]: value })
  const updateChannel = (id: number, updates: Partial<ContactChannel>) =>
    updateInfo(
      "channels",
      info.channels.map((channel) =>
        channel.id === id ? { ...channel, ...updates } : channel,
      ),
    )
  const uploadChannelImage = (id: number, file?: File) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () =>
      updateChannel(id, { image: String(reader.result), platform: "custom" })
    reader.readAsDataURL(file)
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
    <div className="contact-admin">
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
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
    </div>
  )
}

export function MiddlemanAdminEditor({
  info,
  onChange,
}: {
  info: MiddlemanInfo
  onChange: (info: MiddlemanInfo) => void
}) {
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
    <div className="middleman-admin">
      <div className="panel-heading">
        <div>
          <h2>Nội dung trang trung gian</h2>
          <p>
            Mọi thay đổi được cập nhật ngay trên trang Trung gian của người
            dùng.
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
    </div>
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
    onLogin(email, password)
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
