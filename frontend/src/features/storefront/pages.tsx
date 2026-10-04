import { FormEvent, useEffect, useState } from "react"
import type { Product, ProductStatus, Service, ServicePackage, TopupTemplate } from "@/domain/models"
import {
  Icon,
  Pagination,
  ServiceCard,
  TrustStrip,
  formatPrice,
} from "@/components/ui"

// ─── Trang chủ: Danh sách dịch vụ ───────────────────────────────────────────

export function TopupPage({
  services,
  search,
  onSearch,
  onSelectService,
  servicePackages,
  productStatuses,
}: {
  services: Service[]
  search: string
  onSearch: (value: string) => void
  onSelectService: (service: Service) => void
  servicePackages: ServicePackage[]
  productStatuses: ProductStatus[]
}) {
  const filtered = services
    .filter((s) => s.isActive)
    .filter((s) =>
      !search.trim() ||
      s.name.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <>
      <section className="hero page-width">
        <div className="hero-copy">
          <span className="eyebrow">
            <Icon name="shield" size={15} /> Thanh toán an toàn &amp; tự động
          </span>
          <h1>
            Nạp game nhanh.
            <br />
            <span>Chơi không gián đoạn.</span>
          </h1>
          <p>
            Nạp game chính hãng với mức giá tốt nhất. Giao dịch tự động, minh
            bạch và bảo mật 24/7.
          </p>
          <div className="hero-stats">
            <div>
              <strong>50K+</strong>
              <span>Khách hàng</span>
            </div>
            <div>
              <strong>99.8%</strong>
              <span>Giao dịch thành công</span>
            </div>
            <div>
              <strong>&lt; 2 phút</strong>
              <span>Thời gian xử lý</span>
            </div>
          </div>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="console-card card-back">
            <span>VAL</span>
          </div>
          <div className="console-card card-main">
            <span className="mini-label">GIAO DỊCH HOÀN TẤT</span>
            <div className="success-ring">
              <Icon name="check" size={28} />
            </div>
            <strong>+6,480</strong>
            <span>Genesis Crystal</span>
          </div>
          <div className="floating-pill">
            <Icon name="shield" size={16} /> Bảo mật tuyệt đối
          </div>
        </div>
      </section>

      <section className="catalog page-width">
        <div className="catalog-heading">
          <div>
            <span className="section-kicker">CỬA HÀNG</span>
            <h2>Chọn dịch vụ nạp game</h2>
          </div>
          <div className="support-hours">
            <span className="pulse" />
            <div>
              <small>HỖ TRỢ MỖI NGÀY</small>
              <strong>09:00 — 22:00</strong>
            </div>
          </div>
        </div>
        <div className="filter-row">
          <label className="search-box">
            <Icon name="search" size={18} />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Tìm dịch vụ..."
            />
          </label>
        </div>
        {filtered.length > 0 ? (
          <div className="service-grid">
            {filtered.map((service) => {
              const pkgCount = servicePackages.filter(
                (p) => p.serviceId === service.id && p.statusId !== "sold-out",
              ).length
              const minPrice = servicePackages
                .filter((p) => p.serviceId === service.id)
                .reduce(
                  (min, p) => (p.price < min ? p.price : min),
                  Number.MAX_SAFE_INTEGER,
                )
              return (
                <ServiceCard
                  key={service.id}
                  service={service}
                  packageCount={pkgCount}
                  minPrice={minPrice === Number.MAX_SAFE_INTEGER ? 0 : minPrice}
                  productStatuses={productStatuses}
                  servicePackages={servicePackages}
                  onClick={() => onSelectService(service)}
                />
              )
            })}
          </div>
        ) : (
          <div className="empty-state">
            <Icon name="search" size={30} />
            <h3>Không tìm thấy dịch vụ</h3>
            <p>Thử từ khóa khác.</p>
          </div>
        )}
      </section>
      <TrustStrip />
    </>
  )
}

// ─── Trang chi tiết dịch vụ: Danh sách gói ─────────────────────────────────

export function ServiceDetailPage({
  service,
  packages,
  productStatuses,
  onBack,
  onSelectPackage,
}: {
  service: Service
  packages: ServicePackage[]
  productStatuses: ProductStatus[]
  onBack: () => void
  onSelectPackage: (pkg: ServicePackage) => void
}) {
  const [filter, setFilter] = useState("Tất cả")
  const tags = ["Tất cả", ...Array.from(new Set(packages.flatMap((p) => p.tags)))]
  const filtered = packages
    .filter((p) => filter === "Tất cả" || p.tags.includes(filter))
    .sort((a, b) => a.sortOrder - b.sortOrder)

  return (
    <section className="service-detail-page page-width">
      <button className="checkout-back" onClick={onBack}>
        <Icon name="chevron" size={17} /> Quay lại danh sách dịch vụ
      </button>
      <div className="service-detail-header">
        <div className={`service-detail-icon tone-${service.tone}`}>
          {service.image ? (
            <img src={service.image} alt="" style={{ objectPosition: service.imagePosition || "50% 50%" }} />
          ) : (
            <span>{service.iconText}</span>
          )}
        </div>
        <div>
          <span className="section-kicker">DỊCH VỤ NẠP GAME</span>
          <h1>{service.name}</h1>
          <p>{service.description}</p>
        </div>
      </div>

      <div className="service-detail-toolbar">
        <div className="category-list">
          {tags.map((tag) => (
            <button
              key={tag}
              className={filter === tag ? "active" : ""}
              onClick={() => setFilter(tag)}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {filtered.length > 0 ? (
        <div className="package-grid">
          {filtered.map((pkg) => {
            const status =
              productStatuses.find((s) => s.id === pkg.statusId) ||
              productStatuses[0]
            const canBuy = status?.purchasable ?? false
            const hasDiscount = pkg.oldPrice > pkg.price
            return (
              <article key={pkg.id} className={`package-card${!canBuy ? " package-card--unavailable" : ""}`}>
                <div className="package-card-header">
                  <span className="package-note">{pkg.note}</span>
                  {hasDiscount && (
                    <span className="package-discount">
                      -{Math.round(((pkg.oldPrice - pkg.price) / pkg.oldPrice) * 100)}%
                    </span>
                  )}
                </div>
                <div className="package-card-body">
                  <h3>{pkg.name}</h3>
                  <p>{pkg.description}</p>
                  <div className="package-tags">
                    {pkg.tags.map((tag) => (
                      <span key={tag}>{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="package-card-footer">
                  <div className={`package-status status-${status?.color || "green"}`}>
                    <span>
                      <Icon name={status?.icon || "check"} size={10} />
                    </span>
                    <span>{status?.name || "Có sẵn"}</span>
                  </div>
                  <div className="package-pricing">
                    {hasDiscount && (
                      <s className="package-old-price">{formatPrice(pkg.oldPrice)}</s>
                    )}
                    <strong className="package-price">{formatPrice(pkg.price)}</strong>
                  </div>
                  <button
                    className="primary-button package-buy-btn"
                    onClick={() => onSelectPackage(pkg)}
                    disabled={!canBuy}
                  >
                    {canBuy ? (
                      <>Chọn gói <Icon name="chevron" size={16} /></>
                    ) : (
                      <>{status?.name || "Không khả dụng"}</>
                    )}
                  </button>
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <div className="empty-state">
          <Icon name="search" size={30} />
          <h3>Không có gói nào</h3>
          <p>Dịch vụ này hiện chưa có gói nạp khả dụng.</p>
        </div>
      )}
    </section>
  )
}

// ─── Trang nhập thông tin nạp ───────────────────────────────────────────────

export function TopupInformationPage({
  pkg,
  service,
  packages,
  productStatuses,
  template,
  quantity,
  onQuantityChange,
  onPackageChange,
  onBack,
  onContinue,
}: {
  pkg: ServicePackage
  service: Service
  packages: ServicePackage[]
  productStatuses: ProductStatus[]
  template?: TopupTemplate
  quantity: number
  onQuantityChange: (quantity: number) => void
  onPackageChange: (pkg: ServicePackage) => void
  onBack: () => void
  onContinue: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)

  useEffect(() => {
    setValues({})
    setErrors({})
    setConfirmed(false)
  }, [template?.id])

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!template) return onContinue({})
    const nextErrors: Record<string, string> = {}
    template.fields.forEach((field) => {
      const value = values[field.key]?.trim() || ""
      if (field.required && !value)
        nextErrors[field.key] = `Vui lòng nhập ${field.label.toLowerCase()}.`
      if (
        field.type === "email" &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        nextErrors[field.key] = "Email chưa đúng định dạng."
    })
    if (!confirmed)
      nextErrors.confirmed = "Bạn cần xác nhận đã kiểm tra thông tin."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onContinue(values)
  }

  return (
    <section className="topup-info-page page-width">
      <button className="checkout-back" onClick={onBack}>
        <Icon name="chevron" size={17} /> Quay lại chọn gói
      </button>
      <div className="topup-info-layout">
        <div className="topup-form-panel">
          <div className="topup-info-heading">
            <span className="eyebrow">
              <Icon name="user" size={15} /> Thông tin nhận sản phẩm
            </span>
            <h1>{template?.name || "Thông tin nạp game"}</h1>
            <p>
              {template?.description ||
                "Sản phẩm này không yêu cầu thông tin bổ sung."}
            </p>
          </div>
          <div className="topup-package-picker">
            <div className="topup-section-heading">
              <span className="section-kicker">BƯỚC 1</span>
              <strong>Chọn gói nạp</strong>
              <small>Chọn đúng gói bạn muốn nhận vào tài khoản.</small>
            </div>
            <div className="topup-package-options">
              {packages
                .slice()
                .sort((a, b) => a.sortOrder - b.sortOrder)
                .map((option) => {
                  const status =
                    productStatuses.find((item) => item.id === option.statusId) ||
                    productStatuses[0]
                  const canBuy = status?.purchasable ?? false
                  const selected = String(option.id) === String(pkg.id)
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`topup-package-option${selected ? " is-selected" : ""}`}
                      disabled={!canBuy}
                      onClick={() => onPackageChange(option)}
                    >
                      <span className="topup-package-radio" aria-hidden="true">
                        {selected && <span />}
                      </span>
                      <span className="topup-package-copy">
                        <strong>{option.name}</strong>
                        <small>{option.description}</small>
                      </span>
                      <b>{formatPrice(option.price)}</b>
                    </button>
                  )
                })}
            </div>
          </div>
          {template?.warning && (
            <div className="topup-warning">
              <span>!</span>
              <p>{template.warning}</p>
            </div>
          )}
          <form className="dynamic-topup-form" onSubmit={submit}>
            <div className="topup-form-step">
              <span className="section-kicker">BƯỚC 2</span>
              <strong>Nhập thông tin nhận sản phẩm</strong>
            </div>
            {template?.fields.map((field) => (
              <label
                key={field.id}
                className={field.type === "textarea" ? "wide" : ""}
              >
                <span>
                  {field.label}
                  {field.required && <b>*</b>}
                </span>
                {field.type === "select" ? (
                  <select
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                  >
                    <option value="">
                      {field.placeholder || "Chọn một giá trị"}
                    </option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                )}
                {field.helpText && <small>{field.helpText}</small>}
                {errors[field.key] && <em>{errors[field.key]}</em>}
              </label>
            ))}
            <label className="confirm-topup-info">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                Tôi đã kiểm tra và xác nhận thông tin phía trên là chính xác.
              </span>
            </label>
            {errors.confirmed && (
              <span className="form-error">{errors.confirmed}</span>
            )}
            <button className="primary-button" type="submit">
              Tiếp tục thanh toán <Icon name="chevron" size={17} />
            </button>
          </form>
        </div>
        <aside className="topup-product-summary">
          <span className="section-kicker">GÓI ĐÃ CHỌN</span>
          <div className={`topup-summary-art tone-${service.tone}`}>
            {service.image ? (
              <img
                src={service.image}
                alt=""
                style={{ objectPosition: service.imagePosition || "50% 50%" }}
              />
            ) : (
              <span>{service.iconText}</span>
            )}
          </div>
          <small>{service.name}</small>
          <h2>{pkg.name}</h2>
          <strong>{formatPrice(pkg.price * quantity)}</strong>
          <div className="topup-quantity">
            <span>
              <small>Số lượng gói</small>
              <em>Cùng nạp vào thông tin đã nhập</em>
            </span>
            <div>
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <strong>{quantity}</strong>
              <button
                type="button"
                disabled={quantity >= 10}
                onClick={() => onQuantityChange(Math.min(10, quantity + 1))}
              >
                +
              </button>
            </div>
          </div>
          <div>
            <Icon name="shield" size={16} />
            <span>Thông tin chỉ được dùng để xử lý đơn hàng.</span>
          </div>
        </aside>
      </div>
    </section>
  )
}

// ─── Trang thanh toán ────────────────────────────────────────────────────────

export function CheckoutPage({
  pkg,
  service,
  template,
  quantity,
  topupInfo,
  onBack,
  onNotice,
  onConfirm,
}: {
  pkg: ServicePackage
  service: Service
  template?: TopupTemplate
  quantity: number
  topupInfo: Record<string, string>
  onBack: () => void
  onNotice: (message: string) => void
  onConfirm: () => void | Promise<void>
}) {
  const orderCode = `NEXA${String(pkg.id).padStart(4, "0")}-${Date.now().toString(36).toUpperCase().slice(-4)}`
  const totalAmount = pkg.price * quantity
  const [orderConfirmed, setOrderConfirmed] = useState(false)
  const copy = (value: string, label: string) => {
    navigator.clipboard?.writeText(value)
    onNotice(`Đã sao chép ${label}.`)
  }

  return (
    <section className="checkout-page page-width">
      <button className="checkout-back" onClick={onBack}>
        <Icon name="chevron" size={17} /> Quay lại cửa hàng
      </button>
      <div className="checkout-heading">
        <span className="eyebrow">
          <Icon name="shield" size={15} /> Thanh toán an toàn
        </span>
        <h1>Thanh toán chuyển khoản</h1>
        <p>
          Chuyển khoản đúng số tiền và nội dung để hệ thống có thể xác nhận giao
          dịch.
        </p>
      </div>
      <div className="checkout-layout">
        <div className="payment-panel">
          <div className="payment-panel-head">
            <div>
              <span className="section-kicker">THÔNG TIN THANH TOÁN</span>
              <h2>Chuyển khoản ngân hàng</h2>
            </div>
            <span className="payment-status">
              <span /> Chờ thanh toán
            </span>
          </div>
          <div className="bank-payment">
            <div className="qr-placeholder">
              <div className="qr-pattern" />
              <span>QR ngân hàng</span>
              <small>Sẽ cập nhật sau</small>
            </div>
            <div className="bank-details">
              <div>
                <small>Ngân hàng</small>
                <strong>Chưa cập nhật</strong>
              </div>
              <div>
                <small>Số tài khoản</small>
                <strong>Chưa cập nhật</strong>
              </div>
              <div>
                <small>Chủ tài khoản</small>
                <strong>NEXA TOPUP</strong>
              </div>
              <div className="copy-field">
                <span>
                  <small>Số tiền</small>
                  <strong>{formatPrice(totalAmount)}</strong>
                </span>
                <button onClick={() => copy(String(totalAmount), "số tiền")}>
                  Sao chép
                </button>
              </div>
              <div className="copy-field highlight">
                <span>
                  <small>Nội dung chuyển khoản</small>
                  <strong>{orderCode}</strong>
                </span>
                <button
                  onClick={() => copy(orderCode, "nội dung chuyển khoản")}
                >
                  Sao chép
                </button>
              </div>
            </div>
          </div>
          <div className="payment-warning">
            <Icon name="clock" size={19} />
            <p>
              Đơn hàng được giữ trong 15 phút. Không đóng trang này sau khi
              chuyển khoản để hệ thống kiểm tra thanh toán.
            </p>
          </div>
          {Object.keys(topupInfo).length > 0 && (
            <div className="checkout-topup-info">
              <div>
                <span className="section-kicker">THÔNG TIN NẠP</span>
                <button onClick={onBack}>Chỉnh sửa</button>
              </div>
              {Object.entries(topupInfo).map(([key, value]) => (
                <p key={key}>
                  <span>
                    {template?.fields.find((field) => field.key === key)
                      ?.label || key}
                  </span>
                  <strong>{value}</strong>
                </p>
              ))}
            </div>
          )}
        </div>
        <aside className="order-summary">
          <span className="section-kicker">ĐƠN HÀNG CỦA BẠN</span>
          <h2>Chi tiết đơn hàng</h2>
          <div className="checkout-product">
            <div className={`checkout-product-art tone-${service.tone}`}>
              {service.image ? (
                <img
                  src={service.image}
                  alt=""
                  style={{ objectPosition: service.imagePosition || "50% 50%" }}
                />
              ) : (
                <span>{service.iconText}</span>
              )}
            </div>
            <span>
              <small>{service.name}</small>
              <strong>{pkg.name}</strong>
              <em>{pkg.tags.join(" · ")}</em>
            </span>
          </div>
          <div className="summary-lines">
            <div>
              <span>Đơn giá</span>
              <strong>{formatPrice(pkg.price)}</strong>
            </div>
            <div>
              <span>Số lượng</span>
              <strong>× {quantity}</strong>
            </div>
            <div>
              <span>Phí thanh toán</span>
              <strong>0đ</strong>
            </div>
          </div>
          <div className="summary-total">
            <span>Tổng thanh toán</span>
            <strong>{formatPrice(totalAmount)}</strong>
          </div>
          <div className="secure-note">
            <Icon name="shield" size={17} />
            <span>Thông tin giao dịch được bảo mật và mã hóa.</span>
          </div>
          <button
            className="primary-button confirm-payment"
            disabled={orderConfirmed}
            onClick={() => {
              onConfirm()
              setOrderConfirmed(true)
            }}
          >
            {orderConfirmed ? "Đã ghi nhận thanh toán" : "Tôi đã chuyển khoản"}{" "}
            <Icon name="check" size={17} />
          </button>
        </aside>
      </div>
    </section>
  )
}

// ─── Legacy: giữ lại để admin vẫn dùng được ─────────────────────────────────

export function LegacyTopupInformationPage({
  product,
  template,
  quantity,
  onQuantityChange,
  onBack,
  onContinue,
}: {
  product: Product
  template?: TopupTemplate
  quantity: number
  onQuantityChange: (quantity: number) => void
  onBack: () => void
  onContinue: (values: Record<string, string>) => void
}) {
  const [values, setValues] = useState<Record<string, string>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [confirmed, setConfirmed] = useState(false)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!template) return onContinue({})
    const nextErrors: Record<string, string> = {}
    template.fields.forEach((field) => {
      const value = values[field.key]?.trim() || ""
      if (field.required && !value)
        nextErrors[field.key] = `Vui lòng nhập ${field.label.toLowerCase()}.`
      if (
        field.type === "email" &&
        value &&
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
      )
        nextErrors[field.key] = "Email chưa đúng định dạng."
    })
    if (!confirmed)
      nextErrors.confirmed = "Bạn cần xác nhận đã kiểm tra thông tin."
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length === 0) onContinue(values)
  }

  return (
    <section className="topup-info-page page-width">
      <button className="checkout-back" onClick={onBack}>
        <Icon name="chevron" size={17} /> Quay lại chọn sản phẩm
      </button>
      <div className="topup-info-layout">
        <div className="topup-form-panel">
          <div className="topup-info-heading">
            <span className="eyebrow">
              <Icon name="user" size={15} /> Thông tin nhận sản phẩm
            </span>
            <h1>{template?.name || "Thông tin nạp game"}</h1>
            <p>
              {template?.description ||
                "Sản phẩm này không yêu cầu thông tin bổ sung."}
            </p>
          </div>
          {template?.warning && (
            <div className="topup-warning">
              <span>!</span>
              <p>{template.warning}</p>
            </div>
          )}
          <form className="dynamic-topup-form" onSubmit={submit}>
            {template?.fields.map((field) => (
              <label
                key={field.id}
                className={field.type === "textarea" ? "wide" : ""}
              >
                <span>
                  {field.label}
                  {field.required && <b>*</b>}
                </span>
                {field.type === "select" ? (
                  <select
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                  >
                    <option value="">
                      {field.placeholder || "Chọn một giá trị"}
                    </option>
                    {field.options.map((option) => (
                      <option key={option}>{option}</option>
                    ))}
                  </select>
                ) : field.type === "textarea" ? (
                  <textarea
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                ) : (
                  <input
                    type={field.type}
                    value={values[field.key] || ""}
                    onChange={(event) =>
                      setValues({ ...values, [field.key]: event.target.value })
                    }
                    placeholder={field.placeholder}
                  />
                )}
                {field.helpText && <small>{field.helpText}</small>}
                {errors[field.key] && <em>{errors[field.key]}</em>}
              </label>
            ))}
            <label className="confirm-topup-info">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              <span>
                Tôi đã kiểm tra và xác nhận thông tin phía trên là chính xác.
              </span>
            </label>
            {errors.confirmed && (
              <span className="form-error">{errors.confirmed}</span>
            )}
            <button className="primary-button" type="submit">
              Tiếp tục thanh toán <Icon name="chevron" size={17} />
            </button>
          </form>
        </div>
        <aside className="topup-product-summary">
          <span className="section-kicker">SẢN PHẨM ĐÃ CHỌN</span>
          <div className={`topup-summary-art tone-${product.tone}`}>
            {product.image ? (
              <img
                src={product.image}
                alt=""
                style={{ objectPosition: product.imagePosition || "50% 50%" }}
              />
            ) : (
              <span>{product.art}</span>
            )}
          </div>
          <small>{product.game}</small>
          <h2>{product.name}</h2>
          <strong>{formatPrice(product.price * quantity)}</strong>
          <div className="topup-quantity">
            <span>
              <small>Số lượng gói</small>
              <em>Cùng nạp vào thông tin đã nhập</em>
            </span>
            <div>
              <button
                type="button"
                disabled={quantity <= 1}
                onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
              >
                −
              </button>
              <strong>{quantity}</strong>
              <button
                type="button"
                disabled={quantity >= 10}
                onClick={() => onQuantityChange(Math.min(10, quantity + 1))}
              >
                +
              </button>
            </div>
          </div>
          <div>
            <Icon name="shield" size={16} />
            <span>Thông tin chỉ được dùng để xử lý đơn hàng.</span>
          </div>
        </aside>
      </div>
    </section>
  )
}
