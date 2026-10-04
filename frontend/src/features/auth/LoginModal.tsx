import { FormEvent, useState } from "react"
import { Icon } from "@/components/ui"

export function LoginModal({
  onClose,
  onLogin,
}: {
  onClose: () => void
  onLogin: (email: string, password: string, name?: string) => Promise<void>
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === "forgot") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return setError("Vui lòng nhập đúng định dạng email.")
      setError("")
      setResetSent(true)
      return
    }
    if (mode === "register" && !displayName.trim())
      return setError("Vui lòng nhập tên hiển thị.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Vui lòng nhập đúng định dạng email.")
    if (password.length < 8) return setError("Mật khẩu cần có ít nhất 8 ký tự.")
    if (mode === "register" && password !== confirmPassword)
      return setError("Mật khẩu xác nhận chưa khớp.")
    try {
      await onLogin(email, password, mode === "register" ? displayName : undefined)
    } catch (error) {
      setError(error instanceof Error ? error.message : "Đăng nhập không thành công.")
    }
  }
  const changeMode = (nextMode: "login" | "register" | "forgot") => {
    setMode(nextMode)
    setError("")
    setResetSent(false)
  }
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="login-modal">
        <button className="modal-close" onClick={onClose}>
          <Icon name="close" />
        </button>
        {mode !== "forgot" && (
          <div className="auth-tabs">
            <button
              className={mode === "login" ? "active" : ""}
              onClick={() => changeMode("login")}
            >
              Đăng nhập
            </button>
            <button
              className={mode === "register" ? "active" : ""}
              onClick={() => changeMode("register")}
            >
              Đăng ký
            </button>
          </div>
        )}
        {mode === "forgot" && (
          <>
            <span className="section-kicker">KHÔI PHỤC TÀI KHOẢN</span>
            <h2>Quên mật khẩu?</h2>
            <p>
              Nhập email đã đăng ký, chúng tôi sẽ gửi hướng dẫn đặt lại mật
              khẩu.
            </p>
          </>
        )}
        {resetSent ? (
          <div className="reset-success">
            <span>
              <Icon name="check" size={22} />
            </span>
            <strong>Đã gửi hướng dẫn</strong>
            <p>
              Vui lòng kiểm tra hộp thư của <b>{email}</b>. Liên kết khôi phục
              sẽ hết hạn sau 15 phút.
            </p>
            <button
              className="primary-button"
              onClick={() => changeMode("login")}
            >
              Quay lại đăng nhập
            </button>
          </div>
        ) : (
          <form onSubmit={submit}>
            {mode === "register" && (
              <label>
                <span>Tên hiển thị</span>
                <div>
                  <Icon name="user" size={18} />
                  <input
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Tên của bạn"
                  />
                </div>
              </label>
            )}
            <label>
              <span>Email</span>
              <div>
                <Icon name="mail" size={18} />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ban@email.com"
                />
              </div>
            </label>
            {mode !== "forgot" && (
              <label>
                <span className="password-label">
                  Mật khẩu{" "}
                  {mode === "login" && (
                    <button type="button" onClick={() => changeMode("forgot")}>
                      Quên mật khẩu?
                    </button>
                  )}
                </span>
                <div>
                  <Icon name="shield" size={18} />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Tối thiểu 8 ký tự"
                  />
                </div>
              </label>
            )}
            {mode === "register" && (
              <label>
                <span>Xác nhận mật khẩu</span>
                <div>
                  <Icon name="shield" size={18} />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Nhập lại mật khẩu"
                  />
                </div>
              </label>
            )}
            {error && <span className="form-error">{error}</span>}
            <button className="primary-button" type="submit">
              {mode === "login"
                ? "Đăng nhập"
                : mode === "register"
                  ? "Tạo tài khoản"
                  : "Gửi hướng dẫn"}{" "}
              <Icon name="chevron" size={18} />
            </button>
            {mode === "forgot" && (
              <button
                className="forgot-back"
                type="button"
                onClick={() => changeMode("login")}
              >
                Quay lại đăng nhập
              </button>
            )}
          </form>
        )}
        {mode !== "forgot" && (
          <small>
            {mode === "register"
              ? "Bằng cách đăng ký, bạn đồng ý với điều khoản sử dụng và chính sách bảo mật."
              : "Email có chứa “admin” sẽ được chuyển đến cổng quản trị trong bản prototype."}
          </small>
        )}
      </div>
    </div>
  )
}
