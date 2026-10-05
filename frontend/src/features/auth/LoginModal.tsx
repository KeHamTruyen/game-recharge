import { FormEvent, useState } from "react"
import { Icon } from "@/components/ui"

export function LoginModal({
  onClose,
  onLogin,
  onRegister,
  onForgotPassword,
  onResetPassword,
}: {
  onClose: () => void
  onLogin: (email: string, password: string, name?: string) => Promise<void>
  onRegister: (name: string, email: string, password: string) => Promise<void>
  onForgotPassword: (email: string) => Promise<void>
  onResetPassword: (email: string, code: string, password: string) => Promise<void>
}) {
  const [mode, setMode] = useState<"login" | "register" | "forgot">("login")
  const [displayName, setDisplayName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [resetSent, setResetSent] = useState(false)
  const [verification, setVerification] = useState<"register" | "reset" | null>(null)
  const [code, setCode] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (mode === "forgot") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        return setError("Vui lòng nhập đúng định dạng email.")
      setError("")
      try {
        await onForgotPassword(email)
        setVerification("reset")
      } catch (error) {
        setError(error instanceof Error ? error.message : "Không thể gửi mã xác minh.")
      }
      return
    }
    if (mode === "register" && !displayName.trim())
      return setError("Vui lòng nhập tên hiển thị.")
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return setError("Vui lòng nhập đúng định dạng email.")
    if (password.length < 6) return setError("Mật khẩu cần có ít nhất 6 ký tự.")
    if (mode === "register" && password !== confirmPassword)
      return setError("Mật khẩu xác nhận chưa khớp.")
    try {
      if (mode === "register") {
        await onRegister(displayName, email, password)
        setVerification("register")
      } else {
        await onLogin(email, password)
      }
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
        {verification ? (
          <div className="reset-success">
            <span>
              <Icon name="check" size={22} />
            </span>
            <strong>Nhập mã 6 số</strong>
            <p>
              Mã đã được gửi tới <b>{email}</b>, có hiệu lực trong 10 phút.
            </p>
            <input value={code} onChange={(event) => setCode(event.target.value)} inputMode="numeric" maxLength={6} placeholder="000000" />
            {verification === "reset" && (
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mật khẩu mới" />
            )}
            <button
              className="primary-button"
              onClick={async () => {
                try {
                  if (verification === "register") {
                    await onLogin(email, code, displayName)
                  } else {
                    if (newPassword.length < 6) throw new Error("Mật khẩu mới cần có ít nhất 6 ký tự.")
                    await onResetPassword(email, code, newPassword)
                    setVerification(null)
                    setMode("login")
                    setResetSent(true)
                  }
                } catch (error) {
                  setError(error instanceof Error ? error.message : "Mã xác minh không đúng.")
                }
              }}
            >
              Xác minh
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
                    placeholder="Tối thiểu 6 ký tự"
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
