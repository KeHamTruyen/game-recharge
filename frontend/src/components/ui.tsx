import { useEffect, PointerEvent as ReactPointerEvent, useRef } from "react"
import type { IconName, Product, ProductStatus, Service, ServicePackage } from "@/domain/models"
import { initialProductStatuses } from "@/data/mock-data"

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, React.ReactNode> = {
    bag: (
      <>
        <path d="M6 8h12l-1 12H7L6 8Z" />
        <path d="M9 9V6a3 3 0 0 1 6 0v3" />
      </>
    ),
    book: (
      <>
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z" />
        <path d="M6 6h10" />
        <path d="M6 10h10" />
      </>
    ),
    bridge: (
      <>
        <path d="M4 19h16M6 19v-5a6 6 0 0 1 12 0v5M6 11h12M9 8V5m6 3V5" />
      </>
    ),
    chat: (
      <>
        <path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4v8Z" />
        <path d="M8 11h.01M12 11h.01M16 11h.01" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    close: <path d="m6 6 12 12M18 6 6 18" />,
    edit: (
      <>
        <path d="M12 20h9" />
        <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4L16.5 3.5Z" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
    "eye-off": (
      <>
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
        <line x1="2" y1="2" x2="22" y2="22" />
      </>
    ),
    game: (
      <>
        <path d="M7 6h10a5 5 0 0 1 4.7 6.7l-1.3 3.6a2.4 2.4 0 0 1-4.1.7l-1.1-1.5H8.8L7.7 17a2.4 2.4 0 0 1-4.1-.7l-1.3-3.6A5 5 0 0 1 7 6Z" />
        <path d="M7 10v4m-2-2h4m7-1h.01m2 2h.01" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
    headset: (
      <>
        <path d="M4 14v-2a8 8 0 0 1 16 0v2" />
        <path d="M4 14a2 2 0 0 1 2-2h1v6H6a2 2 0 0 1-2-2v-2Zm16 0a2 2 0 0 0-2-2h-1v6h1a2 2 0 0 0 2-2v-2Zm0 3v1a3 3 0 0 1-3 3h-3" />
      </>
    ),
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10v10h14V10M9 20v-6h6v6" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    plus: <path d="M12 5v14M5 12h14" />,
    search: (
      <>
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-4-4" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6l-7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    spark: (
      <>
        <path d="m12 3 1.4 4.6L18 9l-4.6 1.4L12 15l-1.4-4.6L6 9l4.6-1.4L12 3Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),
    sword: (
      <>
        <polyline points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
        <line x1="13" y1="19" x2="19" y2="13" />
        <line x1="16" y1="16" x2="20" y2="20" />
        <line x1="19" y1="21" x2="21" y2="19" />
      </>
    ),
    trash: (
      <>
        <path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7" />
        <path d="M10 11v6m4-6v6" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21a8 8 0 0 1 16 0" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

export function formatPrice(value: number) {
  return new Intl.NumberFormat("vi-VN").format(value) + "đ"
}

export function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number
  totalPages: number
  onPage: (page: number) => void
}) {
  const pages = Array.from(
    { length: totalPages },
    (_, index) => index + 1,
  ).filter(
    (item) => item === 1 || item === totalPages || Math.abs(item - page) <= 1,
  )
  return (
    <div className="pagination">
      <button disabled={page === 1} onClick={() => onPage(page - 1)}>
        <Icon name="chevron" size={16} /> Trước
      </button>
      <div>
        {pages.map((item, index) => (
          <span key={item}>
            {index > 0 && item - pages[index - 1] > 1 && <i>…</i>}
            <button
              className={page === item ? "active" : ""}
              onClick={() => onPage(item)}
            >
              {item}
            </button>
          </span>
        ))}
      </div>
      <button disabled={page === totalPages} onClick={() => onPage(page + 1)}>
        Sau <Icon name="chevron" size={16} />
      </button>
    </div>
  )
}

export function ProductCard({
  product,
  onBuy,
  productStatuses = initialProductStatuses,
  onImagePositionChange,
}: {
  product: Product
  onBuy: () => void
  productStatuses?: ProductStatus[]
  onImagePositionChange?: (x: number, y: number) => void
}) {
  const dragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    width: number
    height: number
  } | null>(null)
  const currentPosition = (product.imagePosition || "50% 50%")
    .split(" ")
    .map((value) => Number.parseFloat(value))
  const status =
    productStatuses.find((item) => item.id === product.statusId) ||
    initialProductStatuses[0]

  const startImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!product.image || !onImagePositionChange) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: currentPosition[0] || 50,
      originY: currentPosition[1] || 50,
      width: rect.width,
      height: rect.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveImage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId || !onImagePositionChange)
      return
    const x = Math.max(
      0,
      Math.min(
        100,
        drag.originX - ((event.clientX - drag.startX) / drag.width) * 100,
      ),
    )
    const y = Math.max(
      0,
      Math.min(
        100,
        drag.originY - ((event.clientY - drag.startY) / drag.height) * 100,
      ),
    )
    onImagePositionChange(Math.round(x), Math.round(y))
  }

  const stopImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <article className="product-card">
      <div
        className={`product-art tone-${product.tone}${
          product.image && onImagePositionChange ? " image-draggable" : ""
        }`}
        onPointerDown={startImageDrag}
        onPointerMove={moveImage}
        onPointerUp={stopImageDrag}
        onPointerCancel={stopImageDrag}
      >
        <span className="product-note">{product.note}</span>
        {product.image ? (
          <img
            className="product-image"
            src={product.image}
            alt={product.name}
            style={{ objectPosition: product.imagePosition || "50% 50%" }}
          />
        ) : (
          <div className="art-symbol">
            <span>{product.art}</span>
            <i />
          </div>
        )}
      </div>
      <div className="product-info">
        <span className="game-name">{product.game}</span>
        <h3>{product.name}</h3>
        <div className={`stock status-${status.color}`}>
          <span>
            <Icon name={status.icon} size={11} />
          </span>
          <span>{status.name}</span>
        </div>
        <div className="price-row">
          <div>
            <strong>{formatPrice(product.price)}</strong>
          </div>
          <button
            onClick={onBuy}
            disabled={!status.purchasable}
            aria-label={`Mua ${product.name}`}
          >
            <Icon name="chevron" size={19} />
          </button>
        </div>
      </div>
    </article>
  )
}

export function ServiceCard({
  service,
  onClick,
  onImagePositionChange,
}: {
  service: Service
  onClick?: () => void
  onImagePositionChange?: (x: number, y: number) => void
}) {
  const dragState = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
    width: number
    height: number
  } | null>(null)

  const currentPosition = (service.imagePosition || "50% 50%")
    .split(" ")
    .map((value) => Number.parseFloat(value))

  const startImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!service.image || !onImagePositionChange) return
    const rect = event.currentTarget.getBoundingClientRect()
    dragState.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: currentPosition[0] || 50,
      originY: currentPosition[1] || 50,
      width: rect.width,
      height: rect.height,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const moveImage = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragState.current
    if (!drag || drag.pointerId !== event.pointerId || !onImagePositionChange)
      return
    const x = Math.max(
      0,
      Math.min(
        100,
        drag.originX - ((event.clientX - drag.startX) / drag.width) * 100,
      ),
    )
    const y = Math.max(
      0,
      Math.min(
        100,
        drag.originY - ((event.clientY - drag.startY) / drag.height) * 100,
      ),
    )
    onImagePositionChange(Math.round(x), Math.round(y))
  }

  const stopImageDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (dragState.current?.pointerId === event.pointerId) {
      dragState.current = null
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return (
    <article
      className="service-card"
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => onClick && e.key === "Enter" && onClick()}
    >
      <div
        className={`service-art tone-${service.tone}${
          service.image && onImagePositionChange ? " image-draggable" : ""
        }`}
        onPointerDown={startImageDrag}
        onPointerMove={moveImage}
        onPointerUp={stopImageDrag}
        onPointerCancel={stopImageDrag}
      >
        {service.image ? (
          <img
            className="product-image"
            src={service.image}
            alt={service.name}
            style={{ objectPosition: service.imagePosition || "50% 50%" }}
          />
        ) : (
          <div className="art-symbol">
            <span>{service.iconText}</span>
            <i />
          </div>
        )}
      </div>
      <h3 className="service-name">{service.name}</h3>
    </article>
  )
}

export function TrustStrip() {
  return (
    <section className="trust-strip page-width">
      <div>
        <Icon name="shield" />
        <span>
          <strong>Bảo mật cao</strong>
          <small>Mã hóa mọi giao dịch</small>
        </span>
      </div>
      <div>
        <Icon name="clock" />
        <span>
          <strong>Xử lý tức thì</strong>
          <small>Tự động trong vài phút</small>
        </span>
      </div>
      <div>
        <Icon name="headset" />
        <span>
          <strong>Hỗ trợ tận tâm</strong>
          <small>Online mỗi ngày 09–22h</small>
        </span>
      </div>
      <div>
        <Icon name="check" />
        <span>
          <strong>Cam kết hoàn tiền</strong>
          <small>Nếu giao dịch thất bại</small>
        </span>
      </div>
    </section>
  )
}

export function Toast({
  message,
  onClose,
  duration = 3500,
}: {
  message: string
  onClose: () => void
  duration?: number
}) {
  useEffect(() => {
    if (!message || !duration) return
    const timer = setTimeout(() => {
      onClose()
    }, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onClose])

  return (
    <div className="toast" role="status" aria-live="polite">
      <Icon name="clock" size={20} />
      <span>{message}</span>
      <button onClick={onClose} aria-label="Đóng thông báo">
        <Icon name="close" size={17} />
      </button>
    </div>
  )
}
