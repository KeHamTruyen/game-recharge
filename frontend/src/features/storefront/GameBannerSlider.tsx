import { useCallback, useEffect, useRef, useState } from "react"
import type { Service, ServicePackage } from "@/domain/models"
import { Icon, formatPrice } from "@/components/ui"

interface GameBannerSliderProps {
  services: Service[]
  packages?: ServicePackage[]
  onSelectService: (service: Service) => void
  mode?: "topup" | "boosting"
}

// Fallback high-resolution game artworks if not uploaded
const defaultGamePosters: Record<string, string> = {
  "Genshin Impact": "/uploads/genshin-banner.jpg",
  "Honkai: Star Rail": "/uploads/hsr-banner.jpg",
  "Zenless Zone Zero": "/uploads/zzz-banner.jpg",
  "Wuthering Waves": "/uploads/wuthering-banner.jpg",
  "Valorant": "/uploads/valorant-banner.jpg",
  "Honkai Impact 3": "/uploads/hi3-banner.jpg",
  "Aniimo": "/uploads/animo.jpg",
}

export default function GameBannerSlider({
  services,
  packages,
  onSelectService,
  mode = "topup",
}: GameBannerSliderProps) {
  // Lọc các game có gói nạp và đang hoạt động
  const activeGames = services.filter((s) => {
    if (!s.isActive) return false
    if (!packages || packages.length === 0) return true
    return packages.some(
      (pkg) => String(pkg.serviceId) === String(s.id) && pkg.isActive !== false,
    )
  })

  const displayServices =
    activeGames.length > 0
      ? activeGames
      : services.filter((s) => s.isActive)

  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const timerRef = useRef<number | null>(null)
  const touchStartXRef = useRef<number | null>(null)
  const touchEndXRef = useRef<number | null>(null)

  const count = displayServices.length

  const nextSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }, [count])

  const prevSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  // Autoplay timer
  useEffect(() => {
    if (count <= 1 || isPaused) return
    timerRef.current = window.setInterval(() => {
      nextSlide()
    }, 4500)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [count, isPaused, nextSlide])

  if (count === 0) return null

  // Touch swipe support cho mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0].clientX
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    touchEndXRef.current = e.targetTouches[0].clientX
  }

  const handleTouchEnd = () => {
    if (touchStartXRef.current === null || touchEndXRef.current === null) return
    const diff = touchStartXRef.current - touchEndXRef.current
    if (diff > 45) {
      nextSlide()
    } else if (diff < -45) {
      prevSlide()
    }
    touchStartXRef.current = null
    touchEndXRef.current = null
  }

  const isBoosting = mode === "boosting"

  return (
    <section
      className="game-coverflow-section page-width"
      aria-label="Khung lướt dịch vụ game nổi bật"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="coverflow-stage">
        {/* Nút lướt sang trái < */}
        {count > 1 && (
          <button
            type="button"
            className="coverflow-nav-arrow arrow-left"
            onClick={prevSlide}
            aria-label="Game trước"
          >
            <Icon name="chevron" size={22} />
          </button>
        )}

        {/* Danh sách các khung banner coverflow với hiệu ứng 3D chuyển động qua lại */}
        <div className="coverflow-track">
          {displayServices.map((service, idx) => {
            // Tính toán khoảng cách vị trí tương đối giữa slide hiện tại và các slide khác
            let offset = idx - currentIndex
            if (offset < -Math.floor(count / 2)) offset += count
            if (offset > Math.floor((count - 1) / 2)) offset -= count

            const isCenter = offset === 0
            const isPrev = offset === -1
            const isNext = offset === 1
            const isVisible = Math.abs(offset) <= 1

            // Poster ảnh của game
            const posterImg = service.image || defaultGamePosters[service.name] || "/uploads/animo.jpg"

            // Lấy giá thấp nhất nếu có
            const gamePackages = packages?.filter(
              (p) => String(p.serviceId) === String(service.id) && p.isActive !== false,
            )
            const minPrice =
              gamePackages && gamePackages.length > 0
                ? Math.min(...gamePackages.map((p) => p.price))
                : null

            let slotClass = "coverflow-slot"
            if (isCenter) slotClass += " slot-active"
            else if (isPrev) slotClass += " slot-prev"
            else if (isNext) slotClass += " slot-next"
            else slotClass += offset < 0 ? " slot-hidden-left" : " slot-hidden-right"

            return (
              <article
                key={service.id}
                className={slotClass}
                style={{
                  zIndex: isCenter ? 12 : isVisible ? 6 : 1,
                }}
                onClick={() => {
                  if (isCenter) {
                    onSelectService(service)
                  } else {
                    setCurrentIndex(idx)
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    if (isCenter) onSelectService(service)
                    else setCurrentIndex(idx)
                  }
                }}
                aria-label={`Game ${service.name}`}
              >
                {/* Ảnh game làm full nền khung như người dùng yêu cầu */}
                <div className="coverflow-card-inner">
                  <img
                    src={posterImg}
                    alt={service.name}
                    className="coverflow-bg-image"
                    loading="lazy"
                  />

                  {/* Lớp gradient tối sang trọng bảo đảm chữ tên game nổi bật */}
                  <div className="coverflow-card-gradient" />

                  {/* Nội dung tinh gọn: Chỉ để lại tên game & nút nạp gọn gàng */}
                  <div className="coverflow-card-content">
                    <div className="coverflow-meta-row">
                      <span className="coverflow-badge">
                        ✦ {isBoosting ? "DỊCH VỤ CÀY THUÊ" : "DỊCH VỤ NẠP"}
                      </span>
                      {minPrice !== null && (
                        <span className="coverflow-price-badge">
                          Chỉ từ <strong>{formatPrice(minPrice)}</strong>
                        </span>
                      )}
                    </div>

                    <div className="coverflow-title-row">
                      <h2 className="coverflow-game-name">{service.name}</h2>

                      <button
                        type="button"
                        className="coverflow-cta-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectService(service)
                        }}
                      >
                        <span>{isBoosting ? "CÀY THUÊ NGAY" : "NẠP NGAY"}</span>
                        <Icon name="chevron" size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            )
          })}
        </div>

        {/* Nút lướt sang phải > */}
        {count > 1 && (
          <button
            type="button"
            className="coverflow-nav-arrow arrow-right"
            onClick={nextSlide}
            aria-label="Game tiếp theo"
          >
            <Icon name="chevron" size={22} />
          </button>
        )}
      </div>

      {/* Hàng chấm chỉ số tròn dưới đáy */}
      {count > 1 && (
        <div className="coverflow-dots-row">
          {displayServices.map((svc, idx) => (
            <button
              key={svc.id}
              type="button"
              className={`coverflow-dot-btn ${idx === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Chuyển tới ${svc.name}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
