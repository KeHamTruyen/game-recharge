import React, { useState, useEffect } from "react"
import {
  getEffectiveGiftcodes,
  addGiftcodeContribution,
  saveGiftcode,
  deleteGiftcode,
  voteGiftcode,
} from "./wikiData"
import type { GiftcodeItem } from "./types"
import { useAppStore } from "@/app/AppStore"
import { Icon } from "@/components/ui"

export default function GiftcodePage() {
  const { user, setNotice } = useAppStore()
  const isAdmin = user?.role === "admin"

  const [submitting, setSubmitting] = useState(false)
  const [codes, setCodes] = useState<GiftcodeItem[]>(getEffectiveGiftcodes())
  const [copiedCode, setCopiedCode] = useState<string | null>(null)
  const [filterQuery, setFilterQuery] = useState("")

  // Contribute / Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCodeItem, setEditingCodeItem] = useState<GiftcodeItem | null>(null)
  const [modalCode, setModalCode] = useState("")
  const [modalReward, setModalReward] = useState("")
  const [modalNote, setModalNote] = useState("")
  const [contributeSuccess, setContributeSuccess] = useState(false)

  const loadData = () => {
    setCodes(getEffectiveGiftcodes())
  }

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
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
    } catch {
      setNotice("Không thể sao chép. Vui lòng sao chép mã thủ công.")
    }
  }

  const handleVote = async (codeId: string, type: "up" | "report") => {
    if (!user) {
      alert("Vui lòng đăng nhập để bình chọn tình trạng mã quà tặng!")
      return
    }
    try {
      await voteGiftcode(codeId, type)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể bình chọn.")
    }
  }

  const handleOpenAddModal = () => {
    setEditingCodeItem(null)
    setModalCode("")
    setModalReward("")
    setModalNote("")
    setIsModalOpen(true)
  }

  const handleOpenEditModal = (item: GiftcodeItem) => {
    setEditingCodeItem(item)
    setModalCode(item.code)
    setModalReward(item.reward)
    setModalNote("")
    setIsModalOpen(true)
  }

  const handleDeleteCode = async (item: GiftcodeItem) => {
    if (!window.confirm(`Bạn có chắc chắn muốn xóa mã "${item.code}" không?`)) {
      return
    }

    try {
      await deleteGiftcode(item.id)
      loadData()
      setNotice(`Đã xóa giftcode "${item.code}" thành công!`)
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi xóa giftcode")
    }
  }

  const handleSubmitModal = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!user) {
      alert("Vui lòng đăng nhập tài khoản!")
      return
    }
    if (!modalCode.trim() || !modalReward.trim()) {
      alert("Vui lòng nhập đầy đủ mã và phần thưởng!")
      return
    }

    setSubmitting(true)
    try {
      if (editingCodeItem && isAdmin) {
        // Admin direct edit
        const updated: GiftcodeItem = {
          ...editingCodeItem,
          code: modalCode.trim().toUpperCase(),
          reward: modalReward.trim() + (modalNote.trim() ? ` (${modalNote.trim()})` : ""),
        }
        await saveGiftcode(updated, false)
        setNotice(`Đã cập nhật giftcode "${updated.code}" thành công!`)
      } else if (isAdmin) {
        // Admin direct add
        const item: GiftcodeItem = {
          id: "gift_admin_" + Date.now(),
          code: modalCode.trim().toUpperCase(),
          reward: modalReward.trim() + (modalNote.trim() ? ` (${modalNote.trim()})` : ""),
          created_at: new Date().toLocaleDateString("vi-VN"),
          author: "DUKE1305 (Admin)",
          isCommunity: false,
          upvotes: 1,
          reports: 0,
        }
        await saveGiftcode(item, true)
        setNotice(`Đã thêm giftcode "${item.code}" thành công!`)
      } else {
        // Regular user contribution
        const item: GiftcodeItem = {
          id: "gift_" + Date.now(),
          code: modalCode.trim().toUpperCase(),
          reward: modalReward.trim() + (modalNote.trim() ? ` (${modalNote.trim()})` : ""),
          created_at: "Vừa xong",
          author: user.name || user.email.split("@")[0],
          isCommunity: true,
          upvotes: 1,
          reports: 0,
        }
        await addGiftcodeContribution(item)
        setContributeSuccess(true)
        setTimeout(() => setContributeSuccess(false), 4000)
      }

      loadData()
      setIsModalOpen(false)
      setModalCode("")
      setModalReward("")
      setModalNote("")
      setEditingCodeItem(null)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể lưu giftcode.")
    } finally {
      setSubmitting(false)
    }
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
        <h1 className="wiki-hero-title">🎁 Tổng Hợp Giftcode Aniimo Mới Nhất</h1>
        <p className="wiki-hero-desc">
          Danh sách mã quà tặng (Giftcode) game Aniimo còn hạn sử dụng. Hãy sao
          chép và nhập mã ngay trong game để nhận miễn phí Tinh Thể Ánh Sáng,
          trứng ấp và các vật phẩm giá trị!
        </p>
      </div>

      {contributeSuccess && (
        <div className="wiki-alert-success">
          🎉 Cảm ơn bạn! Mã giftcode của bạn đã được gửi thành công và đang được
          hiển thị cho cộng đồng.
        </div>
      )}

      {/* Filter & Action Toolbar */}
      <div className="giftcode-toolbar">
        <div className="giftcode-search-box">
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
            handleOpenAddModal()
          }}
        >
          <span>{isAdmin ? "➕" : "🎁"}</span>{" "}
          {isAdmin ? "Thêm Mã Giftcode Trực Tiếp" : "Đóng Góp Giftcode Mới"}
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

                <div className="giftcode-header-right">
                  <span className="giftcode-date">{item.created_at}</span>
                  {isAdmin && (
                    <div className="giftcode-admin-btns">
                      <button
                        type="button"
                        className="wiki-inline-edit-btn"
                        onClick={() => handleOpenEditModal(item)}
                        title="Chỉnh sửa giftcode này"
                      >
                        ✏️ Sửa
                      </button>
                      <button
                        type="button"
                        className="wiki-inline-delete-btn"
                        onClick={() => handleDeleteCode(item)}
                        title="Xóa giftcode này"
                      >
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
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

      {/* Modal: Contribute (User) or Edit/Add (Admin) */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="item-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <h3>
                {isAdmin
                  ? editingCodeItem
                    ? "✏️ Chỉnh Sửa Mã Giftcode (Admin)"
                    : "➕ Thêm Mã Giftcode Mới (Admin)"
                  : "🎁 Đóng Góp Mã Giftcode Mới"}
              </h3>
              <button
                className="aniimo-modal-close"
                onClick={() => setIsModalOpen(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitModal} className="contribute-form">
              <div className="form-group">
                <label>Mã Giftcode (Viết hoa, không dấu) *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: ANIIMO2026, WELCOMEVIP..."
                  value={modalCode}
                  onChange={(e) => setModalCode(e.target.value.toUpperCase())}
                  className="wiki-input"
                />
              </div>

              <div className="form-group">
                <label>Phần Thưởng Nhận Được *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: 500 Tinh Thể, 2 Trứng Cổ Đại..."
                  value={modalReward}
                  onChange={(e) => setModalReward(e.target.value)}
                  className="wiki-input"
                />
              </div>

              <div className="form-group">
                <label>Ghi chú / Hạn sử dụng (Không bắt buộc)</label>
                <input
                  type="text"
                  placeholder="Ví dụ: Hạn đến hết tháng 12..."
                  value={modalNote}
                  onChange={(e) => setModalNote(e.target.value)}
                  className="wiki-input"
                />
              </div>

              <div className="modal-actions-row">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting
                    ? "Đang xử lý..."
                    : isAdmin
                      ? editingCodeItem
                        ? "💾 Lưu Thay Đổi"
                        : "➕ Đăng Mã Ngay"
                      : "Gửi Đóng Góp"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
