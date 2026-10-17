import { useEffect, useState } from "react"
import type { ContactInfo, MiddlemanInfo, Transaction } from "@/domain/models"
import { Icon, Pagination, formatPrice } from "@/components/ui"
import { platformLogos } from "@/data/mock-data"
import { api } from "@/services/api"

export function MiddlemanPage({ info }: { info: MiddlemanInfo }) {
  return (
    <section className="inner-page page-width middleman-page">
      <div className="middleman-hero">
        <span className="eyebrow">
          <Icon name="bridge" size={15} /> Trung gian Mail / Google
        </span>
        <h1>
          Giao dịch an tâm.
          <br />
          <span>Giữ tiền minh bạch.</span>
        </h1>
        <p className="lead">{info.intro}</p>
      </div>
      <div className="middleman-hours">
        <Icon name="clock" size={20} />
        <span>
          <small>HỖ TRỢ TẠO NHÓM & TRAO ĐỔI TRỰC TIẾP</small>
          <strong>{info.supportHours}</strong>
        </span>
      </div>
      <div className="middleman-main-grid">
        <div className="middleman-contact-card">
          <span className="contact-icon">
            <Icon name="chat" size={24} />
          </span>
          <span className="section-kicker">HỖ TRỢ NHANH CHÓNG</span>
          <h2>{info.contactTitle}</h2>
          <p>{info.contactDescription}</p>
          <a href={info.zaloUrl} target="_blank" rel="noopener noreferrer">
            {info.zaloName}
            <span>Tạo Nhóm Zalo Ngay ↗</span>
          </a>
          <small>Zalo: {info.zaloPhone}</small>
        </div>
        <div className="fee-card">
          <div className="info-card-title">
            <span>
              <Icon name="bag" size={19} />
            </span>
            <div>
              <small>BIỂU PHÍ DỊCH VỤ</small>
              <h2>Mức phí tham khảo</h2>
            </div>
          </div>
          <div className="fee-table">
            <div className="fee-table-head">
              <span>Giá trị trao đổi</span>
              <span>Phí trung gian</span>
            </div>
            {(info.fees || []).map((row, index) => (
              <div className="fee-row" key={`${row.range}-${index}`}>
                <span>{row.range}</span>
                <strong>{row.fee}</strong>
              </div>
            ))}
          </div>
          <p className="fee-note">* {info.feeNote}</p>
        </div>
      </div>
      <div className="rules-card">
        <div className="info-card-title">
          <span className="warning-icon">
            <Icon name="shield" size={19} />
          </span>
          <div>
            <small>AN TOÀN GIAO DỊCH</small>
            <h2>Quy định & cảnh báo bắt buộc</h2>
          </div>
        </div>
        <div className="rule-list">
          <div className="rule accepted">
            <span>
              <Icon name="check" size={18} />
            </span>
            <p>
              <strong>Phạm vi nhận:</strong> {info.accepted}
            </p>
          </div>
          <div className="rule rejected">
            <span>
              <Icon name="close" size={18} />
            </span>
            <p>
              <strong>Tuyệt đối không nhận:</strong> {info.rejected}
            </p>
          </div>
          <div className="rule warning">
            <span>!</span>
            <p>
              <strong>Cảnh giác mạo danh:</strong> {info.warning}
            </p>
          </div>
        </div>
        <div className="bank-info">
          <span>
            <Icon name="shield" size={21} />
          </span>
          <div>
            <small>TÀI KHOẢN NHẬN TIỀN DUY NHẤT</small>
            <strong>
              {info.bank} · STK: {info.accountNumber} · Chủ TK:{" "}
              {info.accountHolder}
            </strong>
          </div>
        </div>
      </div>
      <div className="commitment-card">
        <span>
          <Icon name="shield" size={24} />
        </span>
        <div>
          <small>CAM KẾT TRUNG GIAN UY TÍN TẠI DUKE1305</small>
          <p>{info.commitment}</p>
        </div>
      </div>
    </section>
  )
}

export function ContactPage({ info }: { info: ContactInfo }) {
  return (
    <section className="inner-page page-width contact-page">
      <div className="contact-intro">
        <span className="eyebrow">
          <Icon name="headset" size={15} /> Kênh thông tin chính thức
        </span>
        <h1>Liên hệ & cộng đồng</h1>
        <p className="lead">{info.intro}</p>
      </div>
      <div className="contact-hours">
        <Icon name="clock" size={19} />
        <span>
          Khung giờ hỗ trợ trực tiếp: <strong>{info.supportHours}</strong>
        </span>
      </div>
      <div className="social-contact-grid">
        {(info.channels || []).map((channel) => (
          <a
            className={`social-contact-card channel-${channel.color}`}
            key={channel.id}
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            <span className="channel-image">
              <img
                src={
                  (channel.platform && platformLogos[channel.platform as keyof typeof platformLogos]) ||
                  channel.image ||
                  "/icons/zalo.svg"
                }
                alt=""
                onError={(e) => {
                  const fallback =
                    (channel.platform && platformLogos[channel.platform as keyof typeof platformLogos]) ||
                    "/icons/zalo.svg"
                  if (e.currentTarget.src !== fallback) {
                    e.currentTarget.src = fallback
                  }
                }}
              />
            </span>
            <span className="channel-content">
              <small>{channel.label}</small>
              <strong>{channel.name}</strong>
              <em>{channel.description}</em>
            </span>
            <Icon name="chevron" size={19} />
          </a>
        ))}
      </div>
      <div className="contact-commitment">
        <span>
          <Icon name="shield" size={25} />
        </span>
        <div>
          <strong>{info.commitmentTitle}</strong>
          <p>{info.commitment}</p>
        </div>
      </div>
    </section>
  )
}

export function AccountPage({
  email,
  displayName,
  transactions,
  onLogout,
  onUpdateProfile,
  onChangePassword,
  onRefresh,
  onCancelOrder,
}: {
  email: string
  displayName?: string
  transactions: Transaction[]
  onLogout: () => void
  onUpdateProfile: (name: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onRefresh?: () => Promise<Transaction[]>
  onCancelOrder?: (code: string) => Promise<void>
}) {
  const [tab, setTab] = useState<"overview" | "history" | "profile">("overview")
  const [historyPage, setHistoryPage] = useState(1)
  const [name, setName] = useState(displayName || "")
  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [profileMessage, setProfileMessage] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)

  // Tự động làm mới dữ liệu giao dịch khi vào trang tài khoản
  useEffect(() => {
    if (!onRefresh) return
    void onRefresh().catch(() => {})
    const timer = setInterval(() => {
      void onRefresh().catch(() => {})
    }, 15000)
    return () => clearInterval(timer)
  }, [onRefresh])

  const handleManualRefresh = async () => {
    if (!onRefresh || isRefreshing) return
    setIsRefreshing(true)
    try {
      await onRefresh()
    } catch (error) {
      setProfileMessage(error instanceof Error ? error.message : "Không thể tải lịch sử giao dịch.")
    } finally {
      setIsRefreshing(false)
    }
  }

  const completed = transactions.filter((item) => item.status === "Hoàn thành")
  const totalSpent = completed.reduce((sum, item) => sum + item.amount, 0)
  const historyPages = Math.max(1, Math.ceil(transactions.length / 5))
  const visibleHistory = transactions.slice(
    (historyPage - 1) * 5,
    historyPage * 5,
  )

  return (
    <section className="inner-page page-width account-page">
      <div className="account-head">
        <div className="avatar">{email.slice(0, 1).toUpperCase()}</div>
        <div>
          <span className="section-kicker">TÀI KHOẢN CỦA TÔI</span>
          <h1>Xin chào, game thủ</h1>
          <p>{email}</p>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {onRefresh && (
            <button
              className="ghost-button"
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              title="Làm mới trạng thái đơn hàng"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
            >
              <Icon name="clock" size={16} />
              {isRefreshing ? "Đang đồng bộ..." : "Làm mới đơn"}
            </button>
          )}
          <button className="secondary-button" onClick={onLogout}>
            Đăng xuất
          </button>
        </div>
      </div>
      <div className="account-tabs">
        <button
          className={tab === "overview" ? "active" : ""}
          onClick={() => setTab("overview")}
        >
          Tổng quan
        </button>
        <button
          className={tab === "history" ? "active" : ""}
          onClick={() => setTab("history")}
        >
          Lịch sử giao dịch
        </button>
        <button
          className={tab === "profile" ? "active" : ""}
          onClick={() => setTab("profile")}
        >
          Thông tin tài khoản
        </button>
      </div>
      {tab === "overview" && (
        <>
          <div className="account-stats">
            <div>
              <small>Tổng chi tiêu</small>
              <strong>{formatPrice(totalSpent)}</strong>
              <span>Từ các đơn hoàn thành</span>
            </div>
            <div>
              <small>Tổng giao dịch</small>
              <strong>{transactions.length}</strong>
              <span>{completed.length} giao dịch hoàn thành</span>
            </div>
            <div>
              <small>Hạng thành viên</small>
              <strong className="accent-text">
                {totalSpent >= 2000000 ? "Gold" : "Silver"}
              </strong>
              <span>Tích lũy theo tổng chi tiêu</span>
            </div>
          </div>
          <TransactionHistory
            transactions={transactions.slice(0, 3)}
            title="Giao dịch gần đây"
            onCancelOrder={onCancelOrder}
            onRefresh={onRefresh}
          />
        </>
      )}
      {tab === "history" && (
        <div className="account-history-full">
          <TransactionHistory
            transactions={visibleHistory}
            title="Toàn bộ giao dịch"
            onCancelOrder={onCancelOrder}
            onRefresh={onRefresh}
          />
          {transactions.length > 5 && (
            <Pagination
              page={historyPage}
              totalPages={historyPages}
              onPage={setHistoryPage}
            />
          )}
        </div>
      )}
      {tab === "profile" && (
        <div className="profile-panel">
          <div>
            <span className="section-kicker">THÔNG TIN CÁ NHÂN</span>
            <h2>Cập nhật tài khoản</h2>
            <p>Thông tin này được dùng để liên hệ và hỗ trợ giao dịch.</p>
          </div>
          <form onSubmit={async (event) => {
            event.preventDefault()
            setProfileMessage("")
            try {
              await onUpdateProfile(name)
              setProfileMessage("Đã cập nhật thông tin.")
            } catch (error) {
              setProfileMessage(error instanceof Error ? error.message : "Không thể cập nhật thông tin.")
            }
          }}>
            <label>
              <span>Tên hiển thị</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
            <label>
              <span>Email</span>
              <input value={email} disabled />
            </label>
            <button className="primary-button">Lưu thông tin</button>
          </form>
          <div className="password-section">
            <h3>Đổi mật khẩu</h3>
            <form onSubmit={async (event) => {
              event.preventDefault()
              setProfileMessage("")
              try {
                await onChangePassword(currentPassword, newPassword)
                setCurrentPassword("")
                setNewPassword("")
                setProfileMessage("Đã đổi mật khẩu.")
              } catch (error) {
                setProfileMessage(error instanceof Error ? error.message : "Không thể đổi mật khẩu.")
              }
            }}>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Mật khẩu hiện tại" />
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="Mật khẩu mới" />
              <button className="secondary-button">Cập nhật mật khẩu</button>
            </form>
            {profileMessage && <span className="form-success">{profileMessage}</span>}
          </div>
        </div>
      )}
    </section>
  )
}

export function TransactionHistory({
  transactions,
  title,
  onCancelOrder,
  onRefresh,
}: {
  transactions: Transaction[]
  title: string
  onCancelOrder?: (code: string) => Promise<void>
  onRefresh?: () => Promise<unknown>
}) {
  const [payingOrderCode, setPayingOrderCode] = useState<string | null>(null)

  return (
    <div className="history-panel">
      <div>
        <h2>{title}</h2>
        <span>{transactions.length} giao dịch</span>
      </div>
      {transactions.length ? (
        transactions.map((transaction) => {
          const isPending =
            transaction.status === "Chờ thanh toán" ||
            (transaction.status as string) === "PENDING"
          return (
            <div className="history-row" key={transaction.id}>
              <span className="history-icon">
                <Icon name="bag" />
              </span>
              <span>
                <strong>
                  {transaction.product} × {transaction.quantity || 1}
                </strong>
                <small>
                  {transaction.code} · {transaction.game} · {new Date(transaction.date).toLocaleString("vi-VN")}
                </small>
                <div className="history-mobile-meta">
                  <em
                    className={`status-${String(transaction.status).replace(/\s+/g, "-").toLowerCase()}`}
                  >
                    {transaction.status}
                  </em>
                  <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                    {isPending && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setPayingOrderCode(transaction.code)
                        }}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                          color: "#ffffff",
                          fontWeight: 600,
                          border: "none",
                          borderRadius: "6px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        title="Tiếp tục thanh toán đơn hàng này"
                      >
                        Thanh toán ngay
                      </button>
                    )}
                    {isPending && onCancelOrder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng ${transaction.code}? Các đơn có cùng mã thanh toán cũng sẽ được hủy.`)) {
                            void onCancelOrder(transaction.code)
                          }
                        }}
                        style={{
                          fontSize: "11px",
                          padding: "3px 8px",
                          background: "rgba(239, 68, 68, 0.15)",
                          color: "#f87171",
                          border: "1px solid rgba(239, 68, 68, 0.3)",
                          borderRadius: "6px",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                        title="Hủy đơn hàng chưa thanh toán"
                      >
                        Hủy đơn
                      </button>
                    )}
                  </div>
                </div>
              </span>
              <strong>{formatPrice(transaction.amount)}</strong>
              <div className="history-desktop-status">
                <em
                  className={`status-${String(transaction.status).replace(/\s+/g, "-").toLowerCase()}`}
                >
                  {transaction.status}
                </em>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {isPending && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        setPayingOrderCode(transaction.code)
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "4px 10px",
                        background: "linear-gradient(135deg, #0284c7 0%, #2563eb 100%)",
                        color: "#ffffff",
                        fontWeight: 600,
                        border: "none",
                        borderRadius: "6px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        boxShadow: "0 2px 6px rgba(37, 99, 235, 0.3)",
                      }}
                      title="Tiếp tục thanh toán đơn hàng này"
                    >
                      Thanh toán ngay
                    </button>
                  )}
                  {isPending && onCancelOrder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Bạn có chắc chắn muốn hủy đơn hàng ${transaction.code}? Các đơn có cùng mã thanh toán cũng sẽ được hủy.`)) {
                          void onCancelOrder(transaction.code)
                        }
                      }}
                      style={{
                        fontSize: "11px",
                        padding: "4px 8px",
                        background: "rgba(239, 68, 68, 0.15)",
                        color: "#f87171",
                        border: "1px solid rgba(239, 68, 68, 0.3)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                      title="Hủy đơn hàng chưa thanh toán"
                    >
                      Hủy đơn
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })
      ) : (
        <div className="account-empty">
          <Icon name="clock" size={24} />
          <span>Chưa có giao dịch nào.</span>
        </div>
      )}

      {payingOrderCode && (
        <ResumePaymentModal
          code={payingOrderCode}
          onClose={() => setPayingOrderCode(null)}
          onRefresh={onRefresh}
        />
      )}
    </div>
  )
}

export function ResumePaymentModal({
  code,
  onClose,
  onRefresh,
}: {
  code: string
  onClose: () => void
  onRefresh?: () => Promise<unknown>
}) {
  const [data, setData] = useState<{
    orderCode: string
    paymentOrderCode: string
    amount: number
    bankCode: string
    accountNumber: string
    accountName: string
    transferContent: string
    qrCode: string
    status: string
    paymentStatus: string
    packageName?: string
    gameName?: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [paid, setPaid] = useState(false)
  const [orderStatus, setOrderStatus] = useState<string>("PENDING")
  const [copiedField, setCopiedField] = useState<string | null>(null)

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopiedField(label)
      setTimeout(() => setCopiedField(null), 2000)
    } catch {
      alert(`Đã chọn: ${text}`)
    }
  }

  useEffect(() => {
    let mounted = true
    async function fetchPayment() {
      try {
        setLoading(true)
        const res = await api.orders.getPayment(code)
        if (mounted) {
          setData(res)
          setOrderStatus(res.status)
          if (res.paymentStatus === "PAID") {
            setPaid(true)
          }
        }
      } catch (err) {
        if (mounted) setError(err instanceof Error ? err.message : "Không thể tải thông tin thanh toán.")
      } finally {
        if (mounted) setLoading(false)
      }
    }
    void fetchPayment()
    return () => {
      mounted = false
    }
  }, [code])

  useEffect(() => {
    if (paid || !data || error) return
    let cancelled = false
    const orderRef = data.paymentOrderCode || data.orderCode
    const interval = setInterval(async () => {
      try {
        const statusRes = await api.payments.status(orderRef)
        if (cancelled) return
        if (statusRes.paymentStatus === "PAID") {
          setPaid(true)
          setOrderStatus(statusRes.status)
          if (onRefresh) await onRefresh()
        } else if (["EXPIRED", "FAILED", "REFUNDED"].includes(statusRes.paymentStatus) ||
          ["FAILED", "REFUNDED"].includes(statusRes.status)) {
          setError("Đơn đã hủy, hết hạn hoặc hoàn tiền. Vui lòng không chuyển khoản vào mã này; liên hệ CSKH nếu đã chuyển tiền.")
          if (onRefresh) await onRefresh()
        }
      } catch {
        // Ignore polling transient errors
      }
    }, 3500)
    return () => { cancelled = true; clearInterval(interval) }
  }, [paid, data, error, onRefresh])

  return (
    <div
      className="product-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="product-modal" style={{ maxWidth: "500px", width: "95%", boxSizing: "border-box" }}>
        <div className="product-modal-head">
          <div>
            <span className="section-kicker">TIẾP TỤC THANH TOÁN</span>
            <h2>Đơn hàng #{code}</h2>
          </div>
          <button onClick={onClose} title="Đóng">
            <Icon name="close" size={20} />
          </button>
        </div>

        <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: "16px" }}>
          {loading ? (
            <div style={{ padding: "30px", textAlign: "center", color: "var(--color-text-muted)" }}>
              Đang tải mã QR và thông tin chuyển khoản...
            </div>
          ) : error ? (
            <div style={{ color: "#ef4444", padding: "12px", background: "rgba(239,68,68,0.1)", borderRadius: "8px" }}>
              {error}
            </div>
          ) : paid ? (
            <div style={{ textAlign: "center", padding: "24px 10px" }}>
              <div
                style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  background: orderStatus === "FAILED" ? "rgba(239, 68, 68, 0.2)" : "rgba(34, 197, 94, 0.2)",
                  color: orderStatus === "FAILED" ? "#ef4444" : "#22c55e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Icon name={orderStatus === "FAILED" ? "close" : "check"} size={32} />
              </div>
              <h3 style={{ fontSize: "18px", margin: "0 0 8px", color: orderStatus === "FAILED" ? "#ef4444" : "#22c55e" }}>
                {orderStatus === "FAILED" ? "Đã nhận tiền, đơn đã hủy" : "Thanh toán thành công!"}
              </h3>
              <p style={{ fontSize: "13px", color: "var(--color-text-muted)", margin: "0 0 20px" }}>
                {orderStatus === "FAILED"
                  ? "Đã nhận tiền, đơn đã hủy — liên hệ CSKH"
                  : "Hệ thống đã nhận thanh toán. Đơn hàng đang được tiến hành xử lý nạp game."}
              </p>
              <button className="primary-button" style={{ width: "100%" }} onClick={onClose}>
                {orderStatus === "FAILED" ? "Đóng" : "Xong"}
              </button>
            </div>
          ) : data ? (
            <>
              {data.qrCode ? (
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      background: "#ffffff",
                      padding: "10px",
                      borderRadius: "12px",
                      boxShadow: "0 4px 14px rgba(0,0,0,0.3)",
                      maxWidth: "200px",
                      width: "100%",
                      textAlign: "center",
                    }}
                  >
                    <img
                      src={data.qrCode}
                      alt="QR SePay"
                      style={{ width: "100%", height: "auto", display: "block", borderRadius: "6px" }}
                    />
                    <small
                      style={{
                        color: "#334155",
                        fontSize: "11px",
                        display: "block",
                        marginTop: "4px",
                        fontWeight: 600,
                      }}
                    >
                      Quét mã QR qua App Ngân hàng
                    </small>
                  </div>
                </div>
              ) : null}

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  background: "rgba(255, 255, 255, 0.03)",
                  padding: "14px",
                  borderRadius: "10px",
                  border: "1px solid rgba(255, 255, 255, 0.08)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Ngân hàng:</span>
                  <strong>{data.bankCode || "SePay"}</strong>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Số tài khoản:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ fontFamily: "monospace", letterSpacing: "0.5px" }}>
                      {data.accountNumber}
                    </strong>
                    <button
                      type="button"
                      onClick={() => copy(data.accountNumber, "stk")}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#38bdf8",
                        cursor: "pointer",
                      }}
                    >
                      {copiedField === "stk" ? "Đã chép" : "Chép"}
                    </button>
                  </div>
                </div>

                {data.accountName ? (
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "13px",
                    }}
                  >
                    <span style={{ color: "var(--color-text-muted)" }}>Chủ tài khoản:</span>
                    <strong>{data.accountName}</strong>
                  </div>
                ) : null}

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                  }}
                >
                  <span style={{ color: "var(--color-text-muted)" }}>Số tiền:</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <strong style={{ color: "#38bdf8", fontSize: "14px" }}>
                      {formatPrice(data.amount)}
                    </strong>
                    <button
                      type="button"
                      onClick={() => copy(String(data.amount), "tien")}
                      style={{
                        padding: "2px 8px",
                        fontSize: "11px",
                        borderRadius: "4px",
                        background: "rgba(255,255,255,0.1)",
                        border: "none",
                        color: "#38bdf8",
                        cursor: "pointer",
                      }}
                    >
                      {copiedField === "tien" ? "Đã chép" : "Chép"}
                    </button>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "13px",
                    background: "rgba(245, 158, 11, 0.1)",
                    padding: "8px 10px",
                    borderRadius: "6px",
                    border: "1px solid rgba(245, 158, 11, 0.25)",
                  }}
                >
                  <div>
                    <span style={{ color: "#f59e0b", fontSize: "11px", display: "block" }}>
                      Nội dung chuyển khoản (Bắt buộc):
                    </span>
                    <strong
                      style={{
                        color: "#fbbf24",
                        fontFamily: "monospace",
                        fontSize: "14px",
                        wordBreak: "break-all",
                      }}
                    >
                      {data.transferContent}
                    </strong>
                  </div>
                  <button
                    type="button"
                    onClick={() => copy(data.transferContent, "nd")}
                    style={{
                      padding: "4px 10px",
                      fontSize: "12px",
                      borderRadius: "6px",
                      background: "#f59e0b",
                      border: "none",
                      color: "#000",
                      fontWeight: 700,
                      cursor: "pointer",
                      flexShrink: 0,
                    }}
                  >
                    {copiedField === "nd" ? "Đã chép" : "Sao chép"}
                  </button>
                </div>
              </div>

              <div
                style={{
                  fontSize: "12px",
                  color: "var(--color-text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <span className="online-dot" style={{ background: "#38bdf8" }} />
                <span>Hệ thống đang tự động theo dõi chuyển khoản...</span>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  className="secondary-button"
                  onClick={onClose}
                  style={{ padding: "6px 16px" }}
                >
                  Đóng
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  )
}

