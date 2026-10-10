import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { Icon, Toast } from "@/components/ui"
import { platformLogos } from "@/data/mock-data"
import { LoginModal } from "@/features/auth/LoginModal"
import { useAppStore } from "@/app/AppStore"
import { api } from "@/services/api"

const navigation = [
  { to: "/nap-game", label: "Nạp game", icon: "game" as const },
  { to: "/cay-thue", label: "Cày thuê", icon: "sword" as const },
  { to: "/wiki", label: "Wiki Aniimo", icon: "book" as const },
  { to: "/trung-gian", label: "Trung gian", icon: "bridge" as const },
  { to: "/lien-he", label: "Liên hệ", icon: "headset" as const },
]

export type PublicLayoutContext = {
  openLogin: () => void
}

export function PublicLayout() {
  const store = useAppStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [loginOpen, setLoginOpen] = useState(false)
  const hour = new Date().getHours()
  const isSupportOnline = hour >= 9 && hour < 22

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
      <main>
        <Outlet context={{ openLogin: () => setLoginOpen(true) }} />
      </main>
      <nav className="mobile-nav" aria-label="Điều hướng di động">
        {navigation.map((item) => {
          const isWiki = item.to === "/wiki"
          const targetUrl = isWiki ? "/wiki/build" : item.to
          const isCurrentActive = isWiki
            ? location.pathname.startsWith("/wiki")
            : item.to === "/cay-thue"
              ? location.pathname.startsWith("/cay-thue")
              : item.to === "/nap-game"
                ? location.pathname.startsWith("/nap-game")
                : location.pathname === item.to

          return (
            <NavLink
              key={item.to}
              to={targetUrl}
              className={isCurrentActive ? "active" : ""}
            >
              <Icon name={item.icon} size={18} />
              <span>{isWiki ? "Wiki" : item.label}</span>
            </NavLink>
          )
        })}
        <button
          type="button"
          className={store.user ? "account-nav-button signed-in" : "account-nav-button"}
          onClick={() =>
            store.user
              ? navigate(store.user.role === "admin" ? "/admin" : "/tai-khoan")
              : setLoginOpen(true)
          }
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
