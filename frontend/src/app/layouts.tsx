import { useState } from "react"
import { NavLink, Outlet, useLocation, useNavigate } from "react-router"
import { Icon, Toast } from "@/components/ui"
import { platformLogos } from "@/data/mock-data"
import { LoginModal } from "@/features/auth/LoginModal"
import { useAppStore } from "@/app/AppStore"
import { api } from "@/services/api"

const navigation = [
  { to: "/nap-game", label: "Nạp game", icon: "game" as const },
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
            {navigation.map((item) =>
              item.to === "/nap-game" ? (
                <div className="nav-dropdown" key={item.to}>
                  <NavLink to={item.to}>
                    <Icon name={item.icon} size={18} /> {item.label}
                    <Icon name="chevron" size={14} />
                  </NavLink>
                  <div className="game-dropdown">
                    <div className="game-dropdown-head">
                      <span>Chọn game</span>
                      <small>Xem các dịch vụ tương ứng</small>
                    </div>
                    <div className="game-dropdown-list">
                      <NavLink to="/nap-game">
                        <span className="game-dropdown-icon">
                          <Icon name="grid" size={17} />
                        </span>
                        <span>
                          <strong>Tất cả game</strong>
                          <small>Hiển thị toàn bộ sản phẩm</small>
                        </span>
                      </NavLink>
                      {store.games
                        .filter((gameName) => {
                          const svc = store.services.find(
                            (s) => s.name === gameName || s.game === gameName,
                          )
                          return svc ? svc.isActive !== false : true
                        })
                        .map((game) => {
                          const svc = store.services.find(
                            (s) => s.name === game || s.game === game,
                          )
                          const pkgCount = store.servicePackages.filter(
                            (pkg) =>
                              (svc && pkg.serviceId === svc.id) ||
                              store.products.some(
                                (p) => p.id === pkg.id && p.game === game,
                              ),
                          ).filter((pkg) => pkg.isActive !== false).length

                          return (
                            <NavLink
                              key={game}
                              to={`/nap-game?game=${encodeURIComponent(game)}`}
                            >
                              <span className="game-dropdown-icon">
                                {svc?.image ? (
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
                                <strong>{game}</strong>
                                <small>
                                  {pkgCount} dịch vụ
                                </small>
                              </span>
                            </NavLink>
                          )
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <NavLink key={item.to} to={item.to}>
                  <Icon name={item.icon} size={18} /> {item.label}
                </NavLink>
              ),
            )}
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
        <nav className="mobile-nav" aria-label="Điều hướng di động">
          {navigation.map((item) => (
            <NavLink key={item.to} to={item.to}>
              <Icon name={item.icon} size={19} />
              <span>{item.label}</span>
            </NavLink>
          ))}
          <button
            type="button"
            className={store.user ? "account-nav-button signed-in" : "account-nav-button"}
            onClick={() =>
              store.user
                ? navigate(store.user.role === "admin" ? "/admin" : "/tai-khoan")
                : setLoginOpen(true)
            }
          >
            <Icon name="user" size={19} />
            <span>
              {store.user
                ? store.user.role === "admin"
                  ? "Quản trị"
                  : "Tài khoản"
                : "Đăng nhập"}
            </span>
          </button>
        </nav>
      </header>
      <main>
        <Outlet context={{ openLogin: () => setLoginOpen(true) }} />
      </main>
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
