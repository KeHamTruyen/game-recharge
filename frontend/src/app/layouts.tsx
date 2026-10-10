import { useEffect, useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { Icon, Toast } from "@/components/ui"
import { platformLogos } from "@/data/mock-data"
import { LoginModal } from "@/features/auth/LoginModal"
import { useAppStore } from "@/app/AppStore"
import { api } from "@/services/api"
import BrandSubheader from "@/components/BrandSubheader"

const navigation = [
  { to: "/nap-game", label: "Nạp game", icon: "game" as const },
  { to: "/cay-thue", label: "Cày thuê", icon: "sword" as const },
  { to: "/wiki", label: "Wiki Aniimo", icon: "book" as const },
  { to: "/trung-gian", label: "Trung gian", icon: "bridge" as const },
  { to: "/lien-he", label: "Liên hệ", icon: "headset" as const },
]

const wikiLinks = [
  { to: "/wiki/build", icon: "🛠️", label: "Build Đội hình", desc: "Xếp team & khắc chế 9 hệ" },
  { to: "/wiki/teams", icon: "👥", label: "Đội hình đề xuất", desc: "Meta team từ cộng đồng" },
  { to: "/wiki/list", icon: "📖", label: "Danh sách Aniimo", desc: "Tra cứu chỉ số, kỹ năng" },
  { to: "/wiki/tier-list", icon: "🏆", label: "Bảng Tier List", desc: "Xếp hạng sức mạnh meta" },
  { to: "/wiki/map", icon: "🗺️", label: "Bản đồ tương tác", desc: "Vị trí quái, rương, phụ bản" },
  { to: "/wiki/giftcode", icon: "🎁", label: "Giftcode mới nhất", desc: "Mã quà tặng & phần thưởng" },
  { to: "/wiki/so-sanh", icon: "⚖️", label: "So sánh chỉ số", desc: "Đối chiếu sức mạnh 2 Aniimo" },
  { to: "/wiki/thu-vien", icon: "📚", label: "Thư viện tra cứu", desc: "Vật phẩm, trang bị, nguyên liệu" },
  { to: "/wiki/huong-dan", icon: "🧭", label: "Cẩm nang tân thủ", desc: "Kinh nghiệm & mẹo chơi toàn diện" },
]

export type PublicLayoutContext = {
  openLogin: () => void
}

export function PublicLayout() {
  const store = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [loginOpen, setLoginOpen] = useState(false)
  const [mobileMenu, setMobileMenu] = useState<"wiki" | "topup" | "boosting" | null>(null)
  const hour = new Date().getHours()
  const isSupportOnline = hour >= 9 && hour < 22

  useEffect(() => {
    setMobileMenu(null)
  }, [location.pathname])

  const handleLogin = async (email: string, password: string, name?: string) => {
    const user = await store.login(email, password, name, "storefront")
    if (user.role === "admin") {
      await store.logout()
      throw new Error(
        "Tài khoản quản trị viên không thể đăng nhập tại đây. Vui lòng truy cập trang quản trị riêng (/admin).",
      )
    }
    setLoginOpen(false)
    if (location.pathname === "/tai-khoan") navigate("/tai-khoan")
  }
  const handleSupport = () => {
    if (!isSupportOnline) {
      store.setNotice(
        "Hiện đang ngoài giờ hỗ trợ. Đội ngũ DUKE1305 sẽ trực tuyến lại lúc 09:00.",
      )
      return
    }
    const zaloUrl = store.contactInfo.channels.find(
      (channel) => channel.platform === "zalo",
    )?.url
    if (!zaloUrl || zaloUrl === "#") {
      store.setNotice(
        "Kênh Zalo hỗ trợ chưa được cập nhật. Vui lòng xem các kênh khác tại trang Liên hệ.",
      )
      return
    }
    window.open(zaloUrl, "_blank", "noopener,noreferrer")
  }

  const topupServices = store.services.filter(
    (s) => s.category !== "boosting" && s.isActive !== false,
  )
  const boostingServices = store.services.filter(
    (s) => s.category === "boosting" && s.isActive !== false,
  )

  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="header-inner">
          <NavLink className="brand" to="/nap-game">
            <span className="brand-mark">
              <Icon name="spark" size={19} />
            </span>
            <span>
              DUKE<span>1305</span>
            </span>
          </NavLink>
          <nav className="desktop-nav" aria-label="Điều hướng chính">
            {navigation.map((item) => {
              if (item.to === "/nap-game") {
                const isActive = location.pathname.startsWith("/nap-game")
                return (
                  <div className="nav-dropdown" key={item.to}>
                    <NavLink to={item.to} className={isActive ? "active" : ""}>
                      <Icon name={item.icon} size={18} /> {item.label}
                      <Icon name="chevron" size={14} />
                    </NavLink>
                    <div className="game-dropdown">
                      <div className="game-dropdown-head">
                        <span>Chọn game nạp</span>
                        <small>Xem các gói nạp tương ứng</small>
                      </div>
                      <div className="game-dropdown-list">
                        <NavLink to="/nap-game">
                          <span className="game-dropdown-icon">
                            <Icon name="grid" size={17} />
                          </span>
                          <span>
                            <strong>Tất cả game</strong>
                            <small>Hiển thị toàn bộ gói nạp</small>
                          </span>
                        </NavLink>
                        {topupServices.map((svc) => {
                          const pkgCount = store.servicePackages.filter(
                            (pkg) =>
                              pkg.serviceId === svc.id && pkg.isActive !== false,
                          ).length

                          return (
                            <NavLink
                              key={svc.id}
                              to={`/nap-game/${svc.id}`}
                            >
                              <span className="game-dropdown-icon">
                                {svc.image ? (
                                  <img
                                    src={svc.image}
                                    alt=""
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      borderRadius: "7px",
                                      objectFit: "cover",
                                      objectPosition: svc.imagePosition || "50% 50%",
                                    }}
                                  />
                                ) : (
                                  <Icon name="game" size={18} />
                                )}
                              </span>
                              <span>
                                <strong>{svc.name}</strong>
                                <small>{pkgCount} gói nạp</small>
                              </span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.to === "/cay-thue") {
                const isActive = location.pathname.startsWith("/cay-thue")
                return (
                  <div className="nav-dropdown" key={item.to}>
                    <NavLink to={item.to} className={isActive ? "active" : ""}>
                      <Icon name={item.icon} size={18} /> {item.label}
                      <Icon name="chevron" size={14} />
                    </NavLink>
                    <div className="game-dropdown">
                      <div className="game-dropdown-head">
                        <span>Dịch vụ cày thuê</span>
                        <small>Cày tay 100% · Cam kết bảo mật</small>
                      </div>
                      <div className="game-dropdown-list">
                        <NavLink to="/cay-thue">
                          <span className="game-dropdown-icon">
                            <Icon name="sword" size={17} />
                          </span>
                          <span>
                            <strong>Tất cả dịch vụ</strong>
                            <small>Danh sách game cày thuê</small>
                          </span>
                        </NavLink>
                        {boostingServices.map((svc) => {
                          const pkgCount = store.servicePackages.filter(
                            (pkg) =>
                              pkg.serviceId === svc.id && pkg.isActive !== false,
                          ).length

                          return (
                            <NavLink
                              key={svc.id}
                              to={`/cay-thue/${svc.id}`}
                            >
                              <span className="game-dropdown-icon">
                                {svc.image ? (
                                  <img
                                    src={svc.image}
                                    alt=""
                                    style={{
                                      width: "100%",
                                      height: "100%",
                                      borderRadius: "7px",
                                      objectFit: "cover",
                                      objectPosition: svc.imagePosition || "50% 50%",
                                    }}
                                  />
                                ) : (
                                  <Icon name="sword" size={18} />
                                )}
                              </span>
                              <span>
                                <strong>{svc.name}</strong>
                                <small>{pkgCount} gói dịch vụ</small>
                              </span>
                            </NavLink>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              }

              if (item.to === "/wiki") {
                const isActive = location.pathname.startsWith("/wiki")
                return (
                  <div className="nav-dropdown" key={item.to}>
                    <NavLink to="/wiki/build" className={isActive ? "active" : ""}>
                      <Icon name={item.icon} size={18} /> {item.label}
                      <Icon name="chevron" size={14} />
                    </NavLink>
                    <div className="game-dropdown wiki-nav-dropdown">
                      <div className="game-dropdown-head">
                        <span>Cẩm nang Wiki Aniimo</span>
                        <small>Dữ liệu, công cụ &amp; hướng dẫn</small>
                      </div>
                      <div className="game-dropdown-list">
                        <NavLink to="/wiki/build">
                          <span className="game-dropdown-icon">🛠️</span>
                          <span>
                            <strong>Build Đội hình</strong>
                            <small>Xếp team &amp; khắc chế 9 hệ</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/teams">
                          <span className="game-dropdown-icon">👥</span>
                          <span>
                            <strong>Đội hình đề xuất</strong>
                            <small>Meta team từ cộng đồng</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/list">
                          <span className="game-dropdown-icon">📖</span>
                          <span>
                            <strong>Danh sách Aniimo</strong>
                            <small>Tra cứu chỉ số, kỹ năng</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/tier-list">
                          <span className="game-dropdown-icon">🏆</span>
                          <span>
                            <strong>Bảng Tier List</strong>
                            <small>Xếp hạng sức mạnh meta</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/map">
                          <span className="game-dropdown-icon">🗺️</span>
                          <span>
                            <strong>Bản đồ tương tác</strong>
                            <small>Vị trí quái, rương, phụ bản</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/giftcode">
                          <span className="game-dropdown-icon">🎁</span>
                          <span>
                            <strong>Giftcode mới nhất</strong>
                            <small>Mã quà tặng &amp; phần thưởng</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/so-sanh">
                          <span className="game-dropdown-icon">⚖️</span>
                          <span>
                            <strong>So sánh chỉ số</strong>
                            <small>Đối chiếu sức mạnh 2 Aniimo</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/thu-vien">
                          <span className="game-dropdown-icon">📚</span>
                          <span>
                            <strong>Thư viện tra cứu</strong>
                            <small>Vật phẩm, trang bị, nguyên liệu</small>
                          </span>
                        </NavLink>
                        <NavLink to="/wiki/huong-dan">
                          <span className="game-dropdown-icon">🧭</span>
                          <span>
                            <strong>Cẩm nang tân thủ</strong>
                            <small>Kinh nghiệm &amp; mẹo chơi toàn diện</small>
                          </span>
                        </NavLink>
                      </div>
                    </div>
                  </div>
                )
              }

              return (
                <NavLink key={item.to} to={item.to}>
                  <Icon name={item.icon} size={18} /> {item.label}
                </NavLink>
              )
            })}
          </nav>
          <div className="header-actions">
            <button
              className="login-button"
              onClick={() =>
                store.user
                  ? navigate(store.user.role === "admin" ? "/admin" : "/tai-khoan")
                  : setLoginOpen(true)
              }
            >
              <Icon name="user" size={17} />{" "}
              {store.user
                ? store.user.role === "admin"
                  ? "Quản trị"
                  : "Tài khoản"
                : "Đăng nhập"}
            </button>
          </div>
        </div>
      </header>
      {!location.pathname.startsWith("/thanh-toan") && !location.pathname.startsWith("/admin") && (
        <div className="brand-subheader-wrap page-width">
          <BrandSubheader />
        </div>
      )}
      <main>
        <Outlet context={{ openLogin: () => setLoginOpen(true) }} />
      </main>
      {mobileMenu && (
        <>
          <div
            className="mobile-flyout-backdrop"
            onClick={() => setMobileMenu(null)}
            aria-hidden="true"
          />
          <div
            className="mobile-flyout-sheet"
            role="dialog"
            aria-modal="true"
            aria-label={
              mobileMenu === "wiki"
                ? "Menu Wiki Aniimo"
                : mobileMenu === "topup"
                  ? "Menu Nạp game"
                  : "Menu Cày thuê"
            }
          >
            <div className="mobile-flyout-handle" />
            <div className="mobile-flyout-head">
              <div className="mobile-flyout-title">
                <span className="mobile-flyout-icon">
                  {mobileMenu === "wiki" ? "📖" : mobileMenu === "topup" ? "🎮" : "⚔️"}
                </span>
                <div>
                  <strong>
                    {mobileMenu === "wiki"
                      ? "Cẩm nang Wiki Aniimo"
                      : mobileMenu === "topup"
                        ? "Chọn game nạp"
                        : "Dịch vụ cày thuê"}
                  </strong>
                  <small>
                    {mobileMenu === "wiki"
                      ? "Dữ liệu, công cụ & hướng dẫn"
                      : mobileMenu === "topup"
                        ? "Xem các gói nạp tương ứng"
                        : "Cày tay 100% · Cam kết bảo mật"}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="mobile-flyout-close"
                onClick={() => setMobileMenu(null)}
                aria-label="Đóng menu"
              >
                <Icon name="close" size={16} />
              </button>
            </div>

            <div className="mobile-flyout-content">
              {mobileMenu === "wiki" && (
                <div className="mobile-flyout-grid wiki-grid">
                  {wikiLinks.map((link) => {
                    const isActive = location.pathname === link.to
                    return (
                      <NavLink
                        key={link.to}
                        to={link.to}
                        className={`mobile-flyout-item ${isActive ? "active" : ""}`}
                        onClick={() => setMobileMenu(null)}
                      >
                        <span className="flyout-item-icon">{link.icon}</span>
                        <div className="flyout-item-text">
                          <strong>{link.label}</strong>
                          <small>{link.desc}</small>
                        </div>
                        {isActive && <span className="flyout-item-active-dot" />}
                      </NavLink>
                    )
                  })}
                </div>
              )}

              {mobileMenu === "topup" && (
                <div className="mobile-flyout-grid services-grid">
                  <NavLink
                    to="/nap-game"
                    className={`mobile-flyout-item ${location.pathname === "/nap-game" ? "active" : ""}`}
                    onClick={() => setMobileMenu(null)}
                  >
                    <span className="flyout-item-icon">
                      <Icon name="grid" size={17} />
                    </span>
                    <div className="flyout-item-text">
                      <strong>Tất cả game</strong>
                      <small>Hiển thị toàn bộ gói nạp</small>
                    </div>
                    {location.pathname === "/nap-game" && (
                      <span className="flyout-item-active-dot" />
                    )}
                  </NavLink>
                  {topupServices.map((svc) => {
                    const pkgCount = store.servicePackages.filter(
                      (pkg) => pkg.serviceId === svc.id && pkg.isActive !== false,
                    ).length
                    const isActive = location.pathname === `/nap-game/${svc.id}`
                    return (
                      <NavLink
                        key={svc.id}
                        to={`/nap-game/${svc.id}`}
                        className={`mobile-flyout-item ${isActive ? "active" : ""}`}
                        onClick={() => setMobileMenu(null)}
                      >
                        <span className="flyout-item-icon service-icon">
                          {svc.image ? (
                            <img
                              src={svc.image}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "7px",
                                objectFit: "cover",
                                objectPosition: svc.imagePosition || "50% 50%",
                              }}
                            />
                          ) : (
                            <Icon name="game" size={17} />
                          )}
                        </span>
                        <div className="flyout-item-text">
                          <strong>{svc.name}</strong>
                          <small>{pkgCount} gói nạp</small>
                        </div>
                        {isActive && <span className="flyout-item-active-dot" />}
                      </NavLink>
                    )
                  })}
                </div>
              )}

              {mobileMenu === "boosting" && (
                <div className="mobile-flyout-grid services-grid">
                  <NavLink
                    to="/cay-thue"
                    className={`mobile-flyout-item ${location.pathname === "/cay-thue" ? "active" : ""}`}
                    onClick={() => setMobileMenu(null)}
                  >
                    <span className="flyout-item-icon">
                      <Icon name="sword" size={17} />
                    </span>
                    <div className="flyout-item-text">
                      <strong>Tất cả dịch vụ</strong>
                      <small>Danh sách game cày thuê</small>
                    </div>
                    {location.pathname === "/cay-thue" && (
                      <span className="flyout-item-active-dot" />
                    )}
                  </NavLink>
                  {boostingServices.map((svc) => {
                    const pkgCount = store.servicePackages.filter(
                      (pkg) => pkg.serviceId === svc.id && pkg.isActive !== false,
                    ).length
                    const isActive = location.pathname === `/cay-thue/${svc.id}`
                    return (
                      <NavLink
                        key={svc.id}
                        to={`/cay-thue/${svc.id}`}
                        className={`mobile-flyout-item ${isActive ? "active" : ""}`}
                        onClick={() => setMobileMenu(null)}
                      >
                        <span className="flyout-item-icon service-icon">
                          {svc.image ? (
                            <img
                              src={svc.image}
                              alt=""
                              style={{
                                width: "100%",
                                height: "100%",
                                borderRadius: "7px",
                                objectFit: "cover",
                                objectPosition: svc.imagePosition || "50% 50%",
                              }}
                            />
                          ) : (
                            <Icon name="sword" size={17} />
                          )}
                        </span>
                        <div className="flyout-item-text">
                          <strong>{svc.name}</strong>
                          <small>{pkgCount} gói dịch vụ</small>
                        </div>
                        {isActive && <span className="flyout-item-active-dot" />}
                      </NavLink>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
      <nav className="mobile-nav" aria-label="Điều hướng di động">
        {navigation.map((item) => {
          const isWiki = item.to === "/wiki"
          const isNapGame = item.to === "/nap-game"
          const isCayThue = item.to === "/cay-thue"

          const isCurrentActive = isWiki
            ? location.pathname.startsWith("/wiki")
            : isCayThue
              ? location.pathname.startsWith("/cay-thue")
              : isNapGame
                ? location.pathname.startsWith("/nap-game")
                : location.pathname === item.to

          const isMenuOpen =
            (isWiki && mobileMenu === "wiki") ||
            (isNapGame && mobileMenu === "topup") ||
            (isCayThue && mobileMenu === "boosting")

          if (isWiki) {
            return (
              <button
                key={item.to}
                type="button"
                className={`mobile-nav-btn ${isCurrentActive ? "active" : ""} ${isMenuOpen ? "open" : ""}`}
                onClick={() =>
                  setMobileMenu((prev) => (prev === "wiki" ? null : "wiki"))
                }
              >
                <Icon name={item.icon} size={18} />
                <span>
                  Wiki <small className="flyout-caret">{isMenuOpen ? "▾" : "▴"}</small>
                </span>
              </button>
            )
          }

          if (isNapGame) {
            return (
              <button
                key={item.to}
                type="button"
                className={`mobile-nav-btn ${isCurrentActive ? "active" : ""} ${isMenuOpen ? "open" : ""}`}
                onClick={() => {
                  if (location.pathname.startsWith("/nap-game")) {
                    setMobileMenu((prev) => (prev === "topup" ? null : "topup"))
                  } else {
                    setMobileMenu(null)
                    navigate("/nap-game")
                  }
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>
                  Nạp game
                  {isCurrentActive && (
                    <small className="flyout-caret">{isMenuOpen ? "▾" : "▴"}</small>
                  )}
                </span>
              </button>
            )
          }

          if (isCayThue) {
            return (
              <button
                key={item.to}
                type="button"
                className={`mobile-nav-btn ${isCurrentActive ? "active" : ""} ${isMenuOpen ? "open" : ""}`}
                onClick={() => {
                  if (location.pathname.startsWith("/cay-thue")) {
                    setMobileMenu((prev) => (prev === "boosting" ? null : "boosting"))
                  } else {
                    setMobileMenu(null)
                    navigate("/cay-thue")
                  }
                }}
              >
                <Icon name={item.icon} size={18} />
                <span>
                  Cày thuê
                  {isCurrentActive && (
                    <small className="flyout-caret">{isMenuOpen ? "▾" : "▴"}</small>
                  )}
                </span>
              </button>
            )
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={isCurrentActive ? "active" : ""}
              onClick={() => setMobileMenu(null)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={store.user ? "account-nav-button signed-in" : "account-nav-button"}
          onClick={() => {
            setMobileMenu(null)
            if (store.user) {
              navigate(store.user.role === "admin" ? "/admin" : "/tai-khoan")
            } else {
              setLoginOpen(true)
            }
          }}
        >
          <Icon name="user" size={18} />
          <span>
            {store.user
              ? store.user.role === "admin"
                ? "Quản trị"
                : "Tài khoản"
              : "Đăng nhập"}
          </span>
        </button>
      </nav>
      <button
        className={`chat-fab ${isSupportOnline ? "online" : "offline"}`}
        onClick={handleSupport}
        aria-label="Mở Zalo hỗ trợ"
      >
        <img src={platformLogos.zalo} alt="Zalo" />
        <span className="chat-dot" />
      </button>
      {loginOpen && (
        <LoginModal
          onClose={() => setLoginOpen(false)}
          onLogin={handleLogin}
          onRegister={async (name, email, password) => {
            await api.auth.register(name, email, password)
          }}
          onForgotPassword={(email) => api.auth.requestPasswordReset(email)}
          onResetPassword={(email, code, password) => api.auth.resetPassword(email, code, password)}
        />
      )}
      {store.notice && (
        <Toast message={store.notice} onClose={() => store.setNotice("")} />
      )}
    </div>
  )
}
