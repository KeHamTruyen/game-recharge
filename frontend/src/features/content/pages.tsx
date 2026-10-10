import { FormEvent, useEffect, useState } from "react"
import type { ContactInfo, MiddlemanInfo, Transaction } from "@/domain/models"
import { Icon, Pagination, formatPrice } from "@/components/ui"
import { platformLogos } from "@/data/mock-data"

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
          <a href={info.zaloUrl} target="_blank" rel="noreferrer">
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
            rel="noreferrer"
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
}: {
  email: string
  displayName?: string
  transactions: Transaction[]
  onLogout: () => void
  onUpdateProfile: (name: string) => Promise<void>
  onChangePassword: (currentPassword: string, newPassword: string) => Promise<void>
  onRefresh?: () => Promise<Transaction[]>
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
          />
        </>
      )}
      {tab === "history" && (
        <div className="account-history-full">
          <TransactionHistory
            transactions={visibleHistory}
            title="Toàn bộ giao dịch"
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
}: {
  transactions: Transaction[]
  title: string
}) {
  return (
    <div className="history-panel">
      <div>
        <h2>{title}</h2>
        <span>{transactions.length} giao dịch</span>
      </div>
      {transactions.length ? (
        transactions.map((transaction) => (
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
            </span>
            <strong>{formatPrice(transaction.amount)}</strong>
            <em
              className={`status-${String(transaction.status).replace(/\s+/g, "-").toLowerCase()}`}
            >
              {transaction.status}
            </em>
          </div>
        ))
      ) : (
        <div className="account-empty">
          <Icon name="clock" size={24} />
          <span>Chưa có giao dịch nào.</span>
        </div>
      )}
    </div>
  )
}
