import { useCallback, useEffect, useRef, useState } from "react"
import type { Service, ServicePackage } from "@/domain/models"
import { Icon, formatPrice } from "@/components/ui"

interface GameBannerSliderProps {
  services: Service[]
  packages?: ServicePackage[]
  onSelectService: (service: Service) => void
  mode?: "topup" | "boosting"
}

// Game-specific highlights and slogans for topup banners
const gameHighlights: Record<
  string,
  {
    slogan: string
    subtext: string
    benefit1: string
    benefit2: string
    benefit3: string
    badgeText: string
    accentColor: string
  }
> = {
  "Genshin Impact": {
    slogan: "NẠP GENSHIN IMPACT",
    subtext: "Genesis Crystal & Nguyệt Chúc Welkin qua UID",
    benefit1: "Nạp qua UID an toàn 100% không cần mật khẩu",
    benefit2: "Nhận x2 Crystal cho lần nạp đầu tiên trong game",
    benefit3: "Xử lý tự động siêu tốc 1 — 3 phút nhận ngay",
    badgeText: "HOT NHẤT",
    accentColor: "#38dbf8",
  },
  "Honkai: Star Rail": {
    slogan: "NẠP HONKAI: STAR RAIL",
    subtext: "Oneiric Shard & Thẻ Tháng Tiếp Tế qua UID",
    benefit1: "Nạp trực tiếp qua UID & Server chính hãng",
    benefit2: "Đầy đủ mốc khuyến mãi x2 nạp đầu",
    benefit3: "Hỗ trợ 24/7 mọi server: Asia, America, Europe",
    badgeText: "SIÊU ƯU ĐÃI",
    accentColor: "#60a5fa",
  },
  "Zenless Zone Zero": {
    slogan: "NẠP ZENLESS ZONE ZERO",
    subtext: "Polychrome & Thẻ Inter-Knot Thành Phố New Eridu",
    benefit1: "Nạp nhanh qua UID, bảo mật tài khoản tuyệt đối",
    benefit2: "Tỷ giá chiết khấu rẻ nhất thị trường",
    benefit3: "Tích điểm thành viên nhận thêm quà tặng",
    badgeText: "THẦN TỐC",
    accentColor: "#f59e0b",
  },
  "Wuthering Waves": {
    slogan: "NẠP WUTHERING WAVES",
    subtext: "Astrite & Thẻ Lunite Pass Khám Phá Thế Giới",
    benefit1: "Giao dịch bảo mật, không giữ pass/OTP",
    benefit2: "Chiết khấu cao, hỗ trợ nhanh chóng",
    benefit3: "Bảo hành trọn đời giao dịch nạp",
    badgeText: "CHÍNH HÃNG",
    accentColor: "#06b6d4",
  },
  "Valorant": {
    slogan: "NẠP VALORANT POINTS",
    subtext: "VP Chính Hãng Riot Games Rẻ Nhất Thị Trường",
    benefit1: "Nạp qua Riot ID chỉ trong vài chục giây",
    benefit2: "Đầy đủ mọi mốc VP mua Skin, Battlepass",
    benefit3: "Chiết khấu sâu, xuất hóa đơn minh bạch",
    badgeText: "GIÁ TỐT NHẤT",
    accentColor: "#f43f5e",
  },
  "Honkai Impact 3": {
    slogan: "NẠP HONKAI IMPACT 3",
    subtext: "Crystal & Thẻ Tháng Valkyrie Siêu Ưu Đãi",
    benefit1: "Nạp nhanh qua UID cho mọi thuyền trưởng",
    benefit2: "An toàn tuyệt đối, chiết khấu hấp dẫn",
    benefit3: "Hỗ trợ nạp 24/7 không gián đoạn",
    badgeText: "TIẾT KIỆM",
    accentColor: "#a855f7",
  },
  "Aniimo": {
    slogan: "NẠP GAME ANIIMO",
    subtext: "Tài Nguyên & Gói Ưu Đãi Độc Quyền Server",
    benefit1: "Chiết khấu độc quyền chỉ có tại DUKE1305",
    benefit2: "Hỗ trợ gói nạp đặc biệt & Giftcode đi kèm",
    benefit3: "Tư vấn build đội hình & chỉ số miễn phí",
    badgeText: "ĐỘC QUYỀN",
    accentColor: "#10b981",
  },
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

  // Fallback nếu không có game nào lọc được thì lấy tất cả services active
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

  // Autoplay timer: chuyển slide mỗi 4.5s khi không bị hover
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

  const activeService = displayServices[currentIndex]
  const prevIndex = (currentIndex - 1 + count) % count
  const nextIndex = (currentIndex + 1) % count
  const prevService = displayServices[prevIndex]
  const nextService = displayServices[nextIndex]

  const isBoosting = mode === "boosting"
  const info = gameHighlights[activeService.name] || {
    slogan: isBoosting
      ? `CÀY THUÊ ${activeService.name.toUpperCase()}`
      : `NẠP ${activeService.name.toUpperCase()}`,
    subtext: isBoosting
      ? "Cày tay 100% · Tiến độ thần tốc · Bảo mật tài khoản"
      : "Gói nạp chính hãng · Xử lý tự động · An toàn tuyệt đối",
    benefit1: isBoosting ? "Game thủ Top Server trực tiếp cày" : "Nạp nhanh — Giá tốt nhất thị trường",
    benefit2: isBoosting ? "Bảo mật tài khoản 100%, không tool" : "Uy tín — An toàn tuyệt đối qua UID",
    benefit3: isBoosting ? "Bàn giao đúng hẹn, hoàn tiền nếu trễ" : "Hỗ trợ 24/7 nhiệt tình, nhanh chóng",
    badgeText: isBoosting ? "PRO SERVICE" : "DỊCH VỤ",
    accentColor: "#facc15",
  }

  // Lấy giá thấp nhất nếu có packages
  const gamePackages = packages?.filter(
    (p) => String(p.serviceId) === String(activeService.id) && p.isActive !== false,
  )
  const minPrice = gamePackages && gamePackages.length > 0
    ? Math.min(...gamePackages.map((p) => p.price))
    : null

  return (
    <section
      className="game-slider-section page-width"
      aria-label="Khung lướt dịch vụ nạp game nổi bật"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      <div className="slider-stage-container">
        {/* Nút lướt sang trái < */}
        {count > 1 && (
          <button
            type="button"
            className="slider-arrow-btn slider-arrow-left"
            onClick={prevSlide}
            aria-label="Game trước"
          >
            <Icon name="chevron" size={20} />
          </button>
        )}

        {/* Khung game bên trái (Prev Peek Card) */}
        {count > 1 && (
          <div
            className="slider-card-peek peek-left"
            onClick={prevSlide}
            role="button"
            tabIndex={0}
            aria-label={`Xem ${prevService.name}`}
          >
            <div className="peek-content">
              {prevService.image ? (
                <img
                  src={prevService.image}
                  alt={prevService.name}
                  className="peek-poster"
                />
              ) : (
                <div className={`peek-poster-fallback tone-${prevService.tone}`}>
                  <span>{prevService.iconText}</span>
                </div>
              )}
              <div className="peek-overlay">
                <strong>{prevService.name}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Khung CHÍNH Ở GIỮA (Active Card - Thiết kế như ảnh 2) */}
        <div
          className="slider-card-active"
          onClick={() => onSelectService(activeService)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => e.key === "Enter" && onSelectService(activeService)}
        >
          {/* Hào quang nền theo tông màu game */}
          <div
            className="active-card-glow"
            style={{
              background: `radial-gradient(circle at 75% 40%, ${info.accentColor}25 0%, transparent 70%)`,
            }}
          />

          <div className="active-card-grid">
            {/* Cột thông tin dịch vụ bên trái */}
            <div className="active-card-info">
              {/* Header thương hiệu & tag dịch vụ giống ảnh 2 */}
              <div className="active-card-brand-row">
                <span className="active-brand-badge">
                  <span className="brand-dot">✦</span>
                  <strong>DUKE1305</strong>
                </span>
                <span className="active-service-tag">{info.badgeText}</span>
              </div>

              {/* Tiêu đề vàng kim nổi bật */}
              <h2 className="active-card-title">{info.slogan}</h2>

              {/* Phụ đề nền tảng hỗ trợ */}
              <p className="active-card-subtext">
                <span className="os-badge">Android &amp; iOS &amp; PC</span>
                <span className="divider-dot">·</span>
                <span className="subtext-note">{info.subtext}</span>
              </p>

              {/* 3 tiêu chí uy tín có icon */}
              <ul className="active-card-benefits">
                <li>
                  <span className="benefit-icon lightning">⚡</span>
                  <span>{info.benefit1}</span>
                </li>
                <li>
                  <span className="benefit-icon shield">🛡️</span>
                  <span>{info.benefit2}</span>
                </li>
                <li>
                  <span className="benefit-icon headset">🎧</span>
                  <span>{info.benefit3}</span>
                </li>
              </ul>

              {/* Nút hành động vàng gold / gradient */}
              <div className="active-card-action-row">
                <button
                  type="button"
                  className="active-cta-btn"
                  onClick={(e) => {
                    e.stopPropagation()
                    onSelectService(activeService)
                  }}
                >
                  <span>{isBoosting ? "ĐẶT CÀY THUÊ NGAY" : "NẠP NGAY"}</span>
                  <Icon name="chevron" size={15} />
                </button>

                {minPrice !== null && (
                  <span className="active-price-hint">
                    Chỉ từ <strong>{formatPrice(minPrice)}</strong>
                  </span>
                )}
              </div>
            </div>

            {/* Cột minh họa 3D bên phải giống ảnh 2 (Phone, coins, gems, artwork) */}
            <div className="active-card-visual" aria-hidden="true">
              <div className="visual-art-stage">
                {activeService.image ? (
                  <div className="visual-game-artwork">
                    <img
                      src={activeService.image}
                      alt=""
                      className="visual-poster"
                      style={{
                        objectPosition: activeService.imagePosition || "50% 50%",
                      }}
                    />
                    <div className="artwork-glow-ring" />
                  </div>
                ) : (
                  <div className="visual-3d-composition">
                    {/* Minh họa điện thoại nạp tiền với tia sét */}
                    <div className="phone-device-mockup">
                      <div className="phone-notch" />
                      <div className="phone-screen">
                        <div className="phone-card-preview">
                          <span className="phone-pill">NEXA TOPUP</span>
                          <div className="phone-lightning-icon">⚡</div>
                          <strong className="phone-price-tag">
                            {minPrice ? formatPrice(minPrice) : "100% Tự Động"}
                          </strong>
                        </div>
                      </div>
                    </div>

                    {/* Đồng xu vàng (Gold Coins) bay lơ lửng */}
                    <div className="floating-coin coin-1">
                      <span>🪙</span>
                    </div>
                    <div className="floating-coin coin-2">
                      <span>💎</span>
                    </div>
                    <div className="floating-coin coin-3">
                      <span>⭐</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Các icon nền tảng ở góc dưới bên phải như ảnh 2 */}
              <div className="active-card-platforms">
                <span title="Hỗ trợ Android">🤖 Android</span>
                <span title="Hỗ trợ iOS">🍏 iOS</span>
                <span title="Hỗ trợ PC">💻 PC</span>
              </div>
            </div>
          </div>
        </div>

        {/* Khung game bên phải (Next Peek Card) */}
        {count > 1 && (
          <div
            className="slider-card-peek peek-right"
            onClick={nextSlide}
            role="button"
            tabIndex={0}
            aria-label={`Xem ${nextService.name}`}
          >
            <div className="peek-content">
              {nextService.image ? (
                <img
                  src={nextService.image}
                  alt={nextService.name}
                  className="peek-poster"
                />
              ) : (
                <div className={`peek-poster-fallback tone-${nextService.tone}`}>
                  <span>{nextService.iconText}</span>
                </div>
              )}
              <div className="peek-overlay">
                <strong>{nextService.name}</strong>
              </div>
            </div>
          </div>
        )}

        {/* Nút lướt sang phải > */}
        {count > 1 && (
          <button
            type="button"
            className="slider-arrow-btn slider-arrow-right"
            onClick={nextSlide}
            aria-label="Game tiếp theo"
          >
            <Icon name="chevron" size={20} />
          </button>
        )}
      </div>

      {/* Hàng chấm chỉ số tròn dưới đáy như ảnh 2 */}
      {count > 1 && (
        <div className="slider-dots-row">
          {displayServices.map((svc, idx) => (
            <button
              key={svc.id}
              type="button"
              className={`slider-dot-btn ${idx === currentIndex ? "active" : ""}`}
              onClick={() => setCurrentIndex(idx)}
              aria-label={`Chuyển tới ${svc.name}`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
