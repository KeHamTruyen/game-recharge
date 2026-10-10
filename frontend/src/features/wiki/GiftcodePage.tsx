import React, { useState, useEffect } from "react"
import {
  getEffectiveGiftcodes,
  addGiftcodeContribution,
  voteGiftcode,
} from "./wikiData"
import type { GiftcodeItem } from "./types"
import { useAppStore } from "@/app/AppStore"
import { Link } from "react-router"
import { Icon } from "@/components/ui"

export default function GiftcodePage() {
  const { user, setNotice } = useAppStore()
  const [submitting, setSubmitting] = useState(false)
  const [codes, setCodes] = useState<GiftcodeItem[]>(getEffectiveGiftcodes())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState("")

  // Contribute Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [newCode, setNewCode] = useState("")
  const [newReward, setNewReward] = useState("")
  const [newNote, setNewNote] = useState("")
  const [contributeSuccess, setContributeSuccess] = useState(false)

  useEffect(() => {
    const handleUpdate = () => setCodes(getEffectiveGiftcodes())
    window.addEventListener("wiki-data-changed", handleUpdate)
    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  const handleCopy = async (code: string) => {
    try {
    await navigator.clipboard.writeText(code)
    setCopiedCode(code)
    setTimeout(() => {
      setCopiedCode(null)
    }, 2000)
    } catch { setNotice("Không thể sao chép. Vui lòng sao chép mã thủ công.") }
  }

  const handleVote = async (codeId: string, type: "up" | "report") => {
    if (!user) {
      alert("Vui lòng đăng nhập để bình chọn tình trạng mã quà tặng!")
      return
    }
    try { await voteGiftcode(codeId, type) }
    catch (error) { setNotice(error instanceof Error ? error.message : "Không thể bình chọn.") }
  }

  const handleSubmitContribution = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!user) {
      alert("Vui lòng đăng nhập để đóng góp mã giftcode!")
      return
    }
    if (!newCode.trim() || !newReward.trim()) {
      alert("Vui lòng nhập đầy đủ mã và phần thưởng!")
      return
    }

    const item: GiftcodeItem = {
      id: "gift_" + Date.now(),
      code: newCode.trim().toUpperCase(),
      reward: newReward.trim() + (newNote.trim() ? ` (${newNote.trim()})` : ""),
      created_at: "Vừa xong",
      author: user.name || user.email.split("@")[0],
      isCommunity: true,
      upvotes: 1,
      reports: 0,
    }

    setSubmitting(true)
    try {
    await addGiftcodeContribution(item)
    setNewCode("")
    setNewReward("")
    setNewNote("")
    setIsModalOpen(false)
    setContributeSuccess(true)
    setTimeout(() => setContributeSuccess(false), 4000)
    } catch (error) { setNotice(error instanceof Error ? error.message : "Không thể lưu giftcode.") }
    finally { setSubmitting(false) }
  }

  const filteredCodes = codes.filter((item) => {
    const q = filterQuery.toLowerCase().trim()
    return (
      item.code.toLowerCase().includes(q) ||
      item.reward.toLowerCase().includes(q) ||
      (item.author || "").toLowerCase().includes(q)
    )
  })

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> CẬP NHẬT MỚI NHẤT
        </div>
        <h1 className="wiki-hero-title">🎁 Giftcode Aniimo Mới Nhất</h1>
        <p className="wiki-hero-desc">
          Tổng hợp tất cả giftcode tân thủ & sự kiện trong Aniimo còn hạn sử
          dụng. Nhấn vào mã để sao chép ngay. Bạn cũng có thể đóng góp mã mới
          cho cộng đồng!
        </p>
      </div>

      {contributeSuccess && (
        <div className="builder-publish-alert" style={{ marginBottom: "20px" }}>
          <div className="alert-left">
            <span className="alert-icon">✨</span>
            <div>
              <strong>Cảm ơn bạn đã đóng góp!</strong>
              <p>
                Mã giftcode của bạn đã được thêm và chia sẻ tới toàn thể cộng
                đồng.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Guide Steps */}
      <div className="wiki-guide-steps">
        <h3>📖 Hướng Dẫn Cách Nhập Giftcode Trong Game:</h3>
        <div className="wiki-steps-grid">
          <div className="wiki-step-card">
            <span className="step-num">1</span>
            <p>Vào game Aniimo và hoàn thành hướng dẫn mở đầu.</p>
          </div>
          <div className="wiki-step-card">
            <span className="step-num">2</span>
            <p>
              Mở <strong>Cài Đặt (Settings)</strong> hoặc Menu chính góc trên
              màn hình.
            </p>
          </div>
          <div className="wiki-step-card">
            <span className="step-num">3</span>
            <p>
              Chọn mục <strong>Tài Khoản (Account)</strong> ➔{" "}
              <strong>Đổi Mã (Redeem Code)</strong>.
            </p>
          </div>
          <div className="wiki-step-card">
            <span className="step-num">4</span>
            <p>
              Nhập mã code và bấm <strong>Nhận Thưởng</strong> để nhận quà qua
              Hòm Thư.
            </p>
          </div>
        </div>
      </div>

      {/* Action Toolbar */}
      <div className="giftcode-action-bar">
        <div className="search-box wiki-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Tìm mã code hoặc phần thưởng..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>

        <button
          type="button"
          className="create-team-cta-btn"
          onClick={() => {
            if (!user) {
              alert("Vui lòng đăng nhập tài khoản để đóng góp mã giftcode!")
              return
            }
            setIsModalOpen(true)
          }}
        >
          <span>🎁</span> Đóng Góp Giftcode Mới
        </button>
      </div>

      <div className="giftcode-grid">
        {filteredCodes.map((item) => {
          const isCopied = copiedCode === item.code

          return (
            <div
              key={item.id}
              className={`giftcode-card ${
                item.isCommunity ? "community-code-card" : ""
              }`}
            >
              <div className="giftcode-card-header">
                <div className="giftcode-badge-group">
                  <span className="giftcode-status-pill">
                    {item.reports && item.reports > 3
                      ? "⚠️ Cần Xác Minh"
                      : "🟢 Đang hoạt động"}
                  </span>
                  {item.isCommunity && (
                    <span className="community-contribute-pill">
                      💎 Đóng góp bởi: {item.author || "Cộng đồng"}
                    </span>
                  )}
                </div>
                <span className="giftcode-date">{item.created_at}</span>
              </div>

              <div className="giftcode-code-box">
                <span className="giftcode-code-text">{item.code}</span>
                <button
                  type="button"
                  className={`giftcode-copy-btn ${isCopied ? "copied" : ""}`}
                  onClick={() => handleCopy(item.code)}
                >
                  {isCopied ? "✓ Đã Chép" : "Sao Chép"}
                </button>
              </div>

              <div className="giftcode-reward-info">
                <span>🎁 Phần thưởng:</span> {item.reward}
              </div>

              {/* Status voting bar */}
              <div className="giftcode-vote-row">
                <button
                  type="button"
                  className="vote-btn upvote"
                  onClick={() => handleVote(item.id, "up")}
                  title="Xác nhận mã hoạt động tốt"
                >
                  👍 Dùng tốt {item.upvotes ? `(${item.upvotes})` : ""}
                </button>
                <button
                  type="button"
                  className="vote-btn report"
                  onClick={() => handleVote(item.id, "report")}
                  title="Báo cáo mã hết hạn"
                >
                  ⚠️ Báo hết hạn {item.reports ? `(${item.reports})` : ""}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Contribute Giftcode Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="item-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <h3>🎁 Đóng Góp Mã Giftcode Mới</h3>
              <button
                className="aniimo-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={handleSubmitContribution}
              className="item-modal-body"
            >
              <div className="item-modal-prop">
                <small>Người đóng góp:</small>
                <strong>{user?.name || user?.email}</strong>
              </div>

              <div className="publish-field">
                <label>Mã Giftcode:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: ANIIMO2026, WELCOMEVIP..."
                  value={newCode}
                  onChange={(e) => setNewCode(e.target.value)}
                  required
                  style={{ textTransform: "uppercase" }}
                />
              </div>

              <div className="publish-field">
                <label>Phần Thưởng:</label>
                <input
                  type="text"
                  placeholder="Ví dụ: 100 Kim Cương, 5 Vé Quay, 1000 Vàng..."
                  value={newReward}
                  onChange={(e) => setNewReward(e.target.value)}
                  required
                />
              </div>

              <div className="publish-field">
                <label>Ghi Chú / Hạn Dùng (Tùy chọn):</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Dành cho tân thủ, Hết hạn 31/12..."
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="publish-btn"
                style={{ marginTop: "12px" }}
              >
                🚀 Gửi Đóng Góp Mã Quà
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
