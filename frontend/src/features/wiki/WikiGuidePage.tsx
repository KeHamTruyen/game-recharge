import React, { useState, useEffect } from "react"
import { Icon } from "@/components/ui"
import { useAppStore } from "@/app/AppStore"
import {
  type GuideArticle,
  getEffectiveGuides,
  saveGuide,
  deleteGuide,
} from "./wikiData"

export default function WikiGuidePage() {
  const { user, setNotice } = useAppStore()
  const isAdmin = user?.role === "admin"

  const [guides, setGuides] = useState<GuideArticle[]>(getEffectiveGuides())
  const [selectedGuide, setSelectedGuide] = useState<GuideArticle | null>(null)
  const [activeTab, setActiveTab] = useState("Tất cả")
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Admin edit / create modal state
  const [isEditingGuide, setIsEditingGuide] = useState(false)
  const [editingGuideId, setEditingGuideId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState("")
  const [editCategory, setEditCategory] = useState("Tân Thủ")
  const [editReadTime, setEditReadTime] = useState("5 phút")
  const [editSummary, setEditSummary] = useState("")
  const [editContentText, setEditContentText] = useState("")

  const loadData = () => {
    setGuides(getEffectiveGuides())
  }

  useEffect(() => {
    loadData()
    const handleUpdate = () => loadData()
    window.addEventListener("wiki-data-changed", handleUpdate)
    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  const categories = [
    "Tất cả",
    "Tân Thủ",
    "Tài Nguyên",
    "Ấp Trứng & Bắt Thú",
    "Chiến Thuật",
  ]

  const filteredGuides = guides.filter(
    (g) => activeTab === "Tất cả" || g.category === activeTab,
  )

  const handleOpenCreateModal = () => {
    setEditingGuideId(null)
    setEditTitle("")
    setEditCategory("Tân Thủ")
    setEditReadTime("5 phút")
    setEditSummary("")
    setEditContentText("")
    setIsEditingGuide(true)
  }

  const handleOpenEditModal = (guide: GuideArticle, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingGuideId(guide.id)
    setEditTitle(guide.title)
    setEditCategory(guide.category)
    setEditReadTime(guide.readTime || "5 phút")
    setEditSummary(guide.summary)
    setEditContentText(guide.content.join("\n\n"))
    setIsEditingGuide(true)
  }

  const handleDeleteGuide = async (guide: GuideArticle, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!window.confirm(`Bạn có chắc chắn muốn xóa bài viết "${guide.title}" không?`)) {
      return
    }

    try {
      await deleteGuide(guide.id)
      loadData()
      setNotice(`Đã xóa bài viết "${guide.title}" thành công!`)
      if (selectedGuide?.id === guide.id) {
        setSelectedGuide(null)
      }
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi xóa bài viết")
    }
  }

  const handleSaveGuide = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editTitle.trim() || !editSummary.trim() || isSubmitting) return

    setIsSubmitting(true)
    try {
      const isNew = !editingGuideId
      const paragraphs = editContentText
        .split(/\n\n+/)
        .map((p) => p.trim())
        .filter(Boolean)

      const guideItem: GuideArticle = {
        id: editingGuideId || `guide_${Date.now()}`,
        title: editTitle.trim(),
        category: editCategory,
        readTime: editReadTime.trim() || "5 phút",
        summary: editSummary.trim(),
        content: paragraphs.length > 0 ? paragraphs : [editSummary.trim()],
      }

      await saveGuide(guideItem, isNew)
      loadData()
      setIsEditingGuide(false)
      setNotice(
        isNew
          ? "Đã tạo bài viết hướng dẫn mới thành công!"
          : "Đã cập nhật bài viết hướng dẫn thành công!",
      )
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi lưu bài viết")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> CẨM NANG TOÀN TẬP
        </div>
        <h1 className="wiki-hero-title">📖 Wiki Hướng Dẫn Toàn Tập Aniimo</h1>
        <p className="wiki-hero-desc">
          Tổng hợp tất cả bài viết hướng dẫn chuyên sâu, mẹo tối ưu tài nguyên,
          cẩm nang tân thủ và kinh nghiệm leo top chiến trường từ các cao thủ
          game Aniimo.
        </p>

        {isAdmin && (
          <div className="wiki-admin-inline-actions">
            <button
              type="button"
              className="wiki-admin-add-btn"
              onClick={handleOpenCreateModal}
            >
              <span>➕</span> Thêm Bài Viết Mới
            </button>
          </div>
        )}
      </div>

      <div className="wiki-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`wiki-tab-btn ${activeTab === cat ? "active" : ""}`}
            onClick={() => setActiveTab(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="guides-list-grid">
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            className="guide-card"
            onClick={() => setSelectedGuide(guide)}
          >
            <div className="guide-card-top">
              <span className="guide-cat-tag">{guide.category}</span>
              <span className="guide-time-tag">⏱️ {guide.readTime}</span>
            </div>

            <h3 className="guide-card-title">{guide.title}</h3>
            <p className="guide-card-summary">{guide.summary}</p>

            <div className="guide-card-bottom-row">
              <button type="button" className="guide-read-btn">
                Đọc Bài Viết ➔
              </button>

              {isAdmin && (
                <div className="guide-admin-btn-group" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    className="wiki-inline-edit-btn"
                    onClick={(e) => handleOpenEditModal(guide, e)}
                    title="Chỉnh sửa bài viết trực tiếp"
                  >
                    ✏️ Sửa
                  </button>
                  <button
                    type="button"
                    className="wiki-inline-delete-btn"
                    onClick={(e) => handleDeleteGuide(guide, e)}
                    title="Xóa bài viết này"
                  >
                    🗑️
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Guide Reader Modal */}
      {selectedGuide && (
        <div className="modal-backdrop" onClick={() => setSelectedGuide(null)}>
          <div className="guide-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="guide-modal-header">
              <div>
                <span className="guide-cat-tag">{selectedGuide.category}</span>
                <h2>{selectedGuide.title}</h2>
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                {isAdmin && (
                  <button
                    type="button"
                    className="wiki-inline-edit-btn"
                    onClick={(e) => {
                      const g = selectedGuide
                      setSelectedGuide(null)
                      handleOpenEditModal(g, e)
                    }}
                  >
                    ✏️ Sửa bài này
                  </button>
                )}
                <button
                  className="aniimo-modal-close"
                  onClick={() => setSelectedGuide(null)}
                >
                  ✕
                </button>
              </div>
            </div>
            <div className="guide-modal-body">
              <p className="guide-modal-intro">{selectedGuide.summary}</p>
              <div className="guide-modal-paragraphs">
                {selectedGuide.content.map((p, i) => (
                  <p key={i} className="guide-modal-p">
                    {p}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Admin Edit / Create Guide Modal */}
      {isEditingGuide && (
        <div className="modal-backdrop" onClick={() => setIsEditingGuide(false)}>
          <div
            className="guide-modal-box wiki-admin-edit-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="guide-modal-header">
              <div>
                <span className="guide-cat-tag">🛠️ ADMIN WIKI</span>
                <h2>
                  {editingGuideId
                    ? "Chỉnh Sửa Bài Viết Hướng Dẫn"
                    : "Thêm Bài Viết Hướng Dẫn Mới"}
                </h2>
              </div>
              <button
                type="button"
                className="aniimo-modal-close"
                onClick={() => setIsEditingGuide(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveGuide} className="wiki-admin-form">
              <div className="wiki-form-group">
                <label>Tiêu đề bài viết *</label>
                <input
                  type="text"
                  required
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="Ví dụ: Cẩm Nang Tân Thủ: 7 Ngày Khởi Đầu..."
                  className="wiki-input"
                />
              </div>

              <div className="wiki-form-row">
                <div className="wiki-form-group">
                  <label>Chuyên mục</label>
                  <select
                    value={editCategory}
                    onChange={(e) => setEditCategory(e.target.value)}
                    className="wiki-input"
                  >
                    <option value="Tân Thủ">Tân Thủ</option>
                    <option value="Tài Nguyên">Tài Nguyên</option>
                    <option value="Ấp Trứng & Bắt Thú">Ấp Trứng & Bắt Thú</option>
                    <option value="Chiến Thuật">Chiến Thuật</option>
                  </select>
                </div>

                <div className="wiki-form-group">
                  <label>Thời gian đọc</label>
                  <input
                    type="text"
                    value={editReadTime}
                    onChange={(e) => setEditReadTime(e.target.value)}
                    placeholder="Ví dụ: 5 phút"
                    className="wiki-input"
                  />
                </div>
              </div>

              <div className="wiki-form-group">
                <label>Tóm tắt ngắn *</label>
                <textarea
                  rows={2}
                  required
                  value={editSummary}
                  onChange={(e) => setEditSummary(e.target.value)}
                  placeholder="Mô tả ngắn gọn nội dung bài viết..."
                  className="wiki-input"
                />
              </div>

              <div className="wiki-form-group">
                <label>Nội dung chi tiết (Mỗi đoạn cách nhau một dòng trống)</label>
                <textarea
                  rows={8}
                  value={editContentText}
                  onChange={(e) => setEditContentText(e.target.value)}
                  placeholder="Nhập nội dung bài viết...&#10;&#10;Đoạn 1...&#10;&#10;Đoạn 2..."
                  className="wiki-input"
                />
              </div>

              <div className="wiki-form-actions">
                <button
                  type="button"
                  className="wiki-form-cancel-btn"
                  onClick={() => setIsEditingGuide(false)}
                >
                  ✕ Hủy Bỏ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="wiki-form-submit-btn"
                >
                  {isSubmitting ? "Đang lưu..." : "💾 Lưu Bài Viết"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
