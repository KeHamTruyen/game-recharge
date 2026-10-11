import React, { useState, useEffect } from "react"
import { useNavigate } from "react-router"
import { useAppStore } from "@/app/AppStore"
import { api } from "@/services/api"
import { initialFooterConfig } from "@/data/mock-data"
import type { FooterCommunityGroup, FooterConfig } from "@/domain/models"

export function SiteFooter() {
  const { footerConfig, setFooterConfig, user, setNotice } = useAppStore()
  const navigate = useNavigate()

  const [showBackToTop, setShowBackToTop] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [draftConfig, setDraftConfig] = useState<FooterConfig>(footerConfig || initialFooterConfig)
  const [saving, setSaving] = useState(false)
  const [modalMessage, setModalMessage] = useState("")

  // Lắng nghe scroll để hiện nút con mèo chạy theo
  useEffect(() => {
    const handleScroll = () => {
      setShowBackToTop(window.scrollY > 80)
    }
    window.addEventListener("scroll", handleScroll, { passive: true })
    handleScroll()
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  // Đồng bộ draftConfig khi footerConfig thay đổi
  useEffect(() => {
    if (footerConfig) {
      setDraftConfig(footerConfig)
    }
  }, [footerConfig])

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const handleOpenEdit = () => {
    setDraftConfig(footerConfig || initialFooterConfig)
    setModalMessage("")
    setIsEditOpen(true)
  }

  const handleSaveFooter = async () => {
    if (saving) return
    setSaving(true)
    setModalMessage("")
    try {
      await api.admin.updateSetting("footerConfig", draftConfig as unknown as Record<string, unknown>)
      setFooterConfig(draftConfig)
      setNotice("Đã lưu cấu hình chân trang thành công!")
      setModalMessage("Đã lưu cấu hình thành công!")
      setTimeout(() => {
        setIsEditOpen(false)
      }, 700)
    } catch (err) {
      setModalMessage(err instanceof Error ? err.message : "Lỗi khi lưu cấu hình chân trang.")
    } finally {
      setSaving(false)
    }
  }

  const handleResetDefault = () => {
    if (window.confirm("Khôi phục toàn bộ chân trang về mặc định ban đầu?")) {
      setDraftConfig({ ...initialFooterConfig })
      setModalMessage("Đã khôi phục mặc định (nhấn Lưu để cập nhật lên máy chủ).")
    }
  }

  const addGroup = () => {
    const newId = String(Date.now())
    setDraftConfig((prev) => ({
      ...prev,
      communityGroups: [
        ...(prev.communityGroups || []),
        { id: newId, name: "Zalo Nhóm Mới", url: "https://zalo.me/g/" },
      ],
    }))
  }

  const updateGroup = (id: string, updates: Partial<FooterCommunityGroup>) => {
    setDraftConfig((prev) => ({
      ...prev,
      communityGroups: (prev.communityGroups || []).map((g) =>
        g.id === id ? { ...g, ...updates } : g
      ),
    }))
  }

  const removeGroup = (id: string) => {
    setDraftConfig((prev) => ({
      ...prev,
      communityGroups: (prev.communityGroups || []).filter((g) => g.id !== id),
    }))
  }

  if (!footerConfig) return null

  const isAdmin = user?.role === "admin"

  return (
    <>
      {/* ══════════════════════════════════════════════════════════════════════════
          NÚT CON MÈO CHẠY THEO MÀN HÌNH (FLOATING MASCOT BACK TO TOP)
          ══════════════════════════════════════════════════════════════════════════ */}
      <button
        type="button"
        className={`floating-mascot-fab ${showBackToTop ? "is-visible" : ""}`}
        onClick={scrollToTop}
        title="Lên đầu trang"
        aria-label="Cuộn lên đầu trang"
      >
        <div className="mascot-cat-figure" aria-hidden="true">
          <svg
            viewBox="0 0 36 32"
            fill="none"
            className="mascot-cat-svg"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Cute Cat Silhouette & Face */}
            <path
              d="M6 10L10 2L14 8C16 7 20 7 22 8L26 2L30 10C33 14 33 24 28 28C24 31 12 31 8 28C3 24 3 14 6 10Z"
              fill="#111827"
              stroke="#38bdf8"
              strokeWidth="1.6"
            />
            <polygon points="10,4 8,9 13,8" fill="#f43f5e" />
            <polygon points="26,4 28,9 23,8" fill="#f43f5e" />
            {/* Eyes */}
            <circle cx="13" cy="16" r="2.2" fill="#38bdf8" />
            <circle cx="23" cy="16" r="2.2" fill="#38bdf8" />
            <circle cx="13.7" cy="15.3" r="0.8" fill="#ffffff" />
            <circle cx="23.7" cy="15.3" r="0.8" fill="#ffffff" />
            {/* Nose & Mouth */}
            <polygon points="18,18 16.8,20 19.2,20" fill="#f43f5e" />
            <path
              d="M15.5 21.5Q18 23 20.5 21.5"
              stroke="#94a3b8"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
          <span className="mascot-top-label">TOP</span>
        </div>
      </button>

      {/* ══════════════════════════════════════════════════════════════════════════
          FOOTER CHÂN TRANG
          ══════════════════════════════════════════════════════════════════════════ */}
      <footer className="site-custom-footer" aria-label="Chân trang">
        <div className="site-footer-inner page-width">
          {/* Support / Donation Box */}
          {footerConfig.showDonationBox !== false && (
            <div className="footer-donation-card">
              <div className="footer-donation-glow-border" aria-hidden="true" />
              <div className="footer-donation-content">
                <div className="footer-donation-header">
                  <span className="footer-sparkle-icon" aria-hidden="true">✦</span>
                  <h3 className="footer-donation-title">
                    {footerConfig.donationTitle || "Nếu cảm thấy nội dung hay và hữu ích thì bạn có thể ủng hộ DUKE1305 bằng cách:"}
                  </h3>
                </div>

                <div className="footer-donation-actions">
                  {footerConfig.youtubeUrl && (
                    <a
                      href={footerConfig.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-btn footer-btn-youtube"
                      title="Đăng Ký Kênh YouTube"
                    >
                      <span className="footer-btn-icon-wrap yt-wrap">
                        <img
                          src="/icons/youtube.svg"
                          alt=""
                          className="footer-btn-icon"
                          onError={(e) => {
                            e.currentTarget.style.display = "none"
                          }}
                        />
                      </span>
                      <span className="footer-btn-text">
                        {footerConfig.youtubeBtnText || "Đăng Ký Kênh"}
                      </span>
                    </a>
                  )}

                  {footerConfig.donateUrl && (
                    <a
                      href={footerConfig.donateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="footer-btn footer-btn-donate"
                      title="Donate Cho DUKE1305"
                    >
                      <span className="footer-btn-icon-wrap donate-wrap">
                        <svg
                          className="footer-btn-icon donate-svg"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                          width="18"
                          height="18"
                          aria-hidden="true"
                        >
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                        </svg>
                      </span>
                      <span className="footer-btn-text">
                        {footerConfig.donateBtnText || "Donate Cho DUKE1305"}
                      </span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Community Zalo Groups Section */}
          <div className="footer-community-section">
            <div className="footer-community-header">
              <span className="footer-chat-icon" aria-hidden="true">💬</span>
              <h4 className="footer-community-title">
                {footerConfig.communityTitle || "Tổng Hợp Tất Cả Nhóm Zalo Cộng Đồng"}
              </h4>
            </div>

            {footerConfig.communityGroups && footerConfig.communityGroups.length > 0 && (
              <div className="footer-community-pills">
                {footerConfig.communityGroups.map((group) => (
                  <a
                    key={group.id}
                    href={group.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="community-pill-btn"
                    title={`Tham gia ${group.name}`}
                  >
                    <img
                      src="/icons/zalo.svg"
                      alt=""
                      className="community-pill-icon"
                      onError={(e) => {
                        e.currentTarget.style.display = "none"
                      }}
                    />
                    <span className="community-pill-name">{group.name}</span>
                    <span className="community-pill-arrow" aria-hidden="true">↗</span>
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Bottom Bar: Copyright & Admin Edit Button */}
          <div className="footer-bottom-bar">
            <p className="footer-copyright-text">
              {footerConfig.copyrightText || "©2026 Bản Quyền Thiết Kế Thuộc Về DUKE1305."}
            </p>

            {isAdmin && (
              <div className="footer-admin-bar">
                <button
                  type="button"
                  className="footer-admin-edit-badge"
                  onClick={handleOpenEdit}
                  title="Chỉnh sửa nội dung chân trang (Dành cho Admin)"
                >
                  <span className="badge-gear-icon">⚙️</span>
                  <span>Chỉnh sửa chân trang</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </footer>

      {/* ══════════════════════════════════════════════════════════════════════════
          MODAL CHỈNH SỬA CHÂN TRANG TRỰC TIẾP DÀNH CHO ADMIN
          ══════════════════════════════════════════════════════════════════════════ */}
      {isEditOpen && (
        <div className="modal-backdrop" onClick={() => setIsEditOpen(false)}>
          <div
            className="footer-edit-modal-box"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="footer-modal-title"
          >
            <div className="footer-edit-modal-header">
              <div>
                <h3 id="footer-modal-title">⚙️ Quản Lý Chân Trang &amp; Cộng Đồng</h3>
                <p>Chỉnh sửa trực tiếp nội dung footer, danh sách nhóm Zalo và bản quyền website.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setIsEditOpen(false)}
                aria-label="Đóng"
              >
                ✕
              </button>
            </div>

            <div className="footer-edit-modal-body">
              {modalMessage && (
                <div
                  className={`modal-alert-box ${
                    modalMessage.includes("Lỗi") || modalMessage.includes("không thể") ? "error" : "success"
                  }`}
                >
                  {modalMessage}
                </div>
              )}

              {/* 1. Hộp Ủng Hộ */}
              <div className="footer-edit-section">
                <div className="footer-section-title-row">
                  <h4>✦ Khung kêu gọi ủng hộ (Donate Card)</h4>
                  <label className="toggle-label">
                    <input
                      type="checkbox"
                      checked={draftConfig.showDonationBox}
                      onChange={(e) =>
                        setDraftConfig((prev) => ({ ...prev, showDonationBox: e.target.checked }))
                      }
                    />
                    <span>Hiển thị trên website</span>
                  </label>
                </div>

                <div className="form-group">
                  <label>Tiêu đề kêu gọi ủng hộ</label>
                  <textarea
                    rows={2}
                    value={draftConfig.donationTitle}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, donationTitle: e.target.value }))
                    }
                    placeholder="Ví dụ: Nếu cảm thấy nội dung hay và hữu ích..."
                  />
                </div>

                <div className="form-two-col">
                  <div className="form-col-box">
                    <span className="col-tag yt">📺 Kênh YouTube</span>
                    <div className="form-group">
                      <label>Tên nút</label>
                      <input
                        value={draftConfig.youtubeBtnText}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({ ...prev, youtubeBtnText: e.target.value }))
                        }
                        placeholder="Đăng Ký Kênh"
                      />
                    </div>
                    <div className="form-group">
                      <label>Đường link YouTube</label>
                      <input
                        value={draftConfig.youtubeUrl}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({ ...prev, youtubeUrl: e.target.value }))
                        }
                        placeholder="https://youtube.com/@duke1305"
                      />
                    </div>
                  </div>

                  <div className="form-col-box">
                    <span className="col-tag donate">💎 Nút Donate</span>
                    <div className="form-group">
                      <label>Tên nút</label>
                      <input
                        value={draftConfig.donateBtnText}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({ ...prev, donateBtnText: e.target.value }))
                        }
                        placeholder="Donate Cho DUKE1305"
                      />
                    </div>
                    <div className="form-group">
                      <label>Đường link Donate / MoMo</label>
                      <input
                        value={draftConfig.donateUrl}
                        onChange={(e) =>
                          setDraftConfig((prev) => ({ ...prev, donateUrl: e.target.value }))
                        }
                        placeholder="https://me.momo.vn/duke1305"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. Nhóm Zalo Cộng Đồng */}
              <div className="footer-edit-section">
                <div className="footer-section-title-row">
                  <h4>💬 Danh sách nhóm Zalo Cộng Đồng</h4>
                  <button
                    type="button"
                    className="modal-add-btn"
                    onClick={addGroup}
                  >
                    + Thêm nhóm Zalo
                  </button>
                </div>

                <div className="form-group">
                  <label>Tiêu đề danh sách cộng đồng</label>
                  <input
                    value={draftConfig.communityTitle}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, communityTitle: e.target.value }))
                    }
                    placeholder="Tổng Hợp Tất Cả Nhóm Zalo Cộng Đồng"
                  />
                </div>

                <div className="groups-list">
                  {(!draftConfig.communityGroups || draftConfig.communityGroups.length === 0) ? (
                    <p className="empty-groups-hint">Chưa có nhóm nào. Bấm &quot;+ Thêm nhóm Zalo&quot; để tạo nút.</p>
                  ) : (
                    draftConfig.communityGroups.map((group, idx) => (
                      <div key={group.id} className="group-row-item">
                        <div className="group-field">
                          <label>Tên nhóm #{idx + 1}</label>
                          <input
                            value={group.name}
                            onChange={(e) => updateGroup(group.id, { name: e.target.value })}
                            placeholder="Zalo Nhóm Aniimo..."
                          />
                        </div>
                        <div className="group-field flex-2">
                          <label>Đường link Zalo</label>
                          <input
                            value={group.url}
                            onChange={(e) => updateGroup(group.id, { url: e.target.value })}
                            placeholder="https://zalo.me/g/..."
                          />
                        </div>
                        <button
                          type="button"
                          className="group-delete-btn"
                          onClick={() => removeGroup(group.id)}
                          title="Xóa nhóm này"
                        >
                          ✕
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* 3. Dòng Bản Quyền */}
              <div className="footer-edit-section">
                <h4>© Bản quyền chân trang</h4>
                <div className="form-group">
                  <label>Dòng chữ bản quyền (Copyright)</label>
                  <input
                    value={draftConfig.copyrightText}
                    onChange={(e) =>
                      setDraftConfig((prev) => ({ ...prev, copyrightText: e.target.value }))
                    }
                    placeholder="©2026 Bản Quyền Thiết Kế Thuộc Về DUKE1305."
                  />
                </div>
              </div>
            </div>

            <div className="footer-edit-modal-footer">
              <div className="modal-footer-left">
                <button
                  type="button"
                  className="modal-secondary-btn"
                  onClick={handleResetDefault}
                >
                  Khôi phục mặc định
                </button>
                <button
                  type="button"
                  className="modal-link-btn"
                  onClick={() => {
                    setIsEditOpen(false)
                    navigate("/admin")
                  }}
                >
                  Mở trang Admin đầy đủ ↗
                </button>
              </div>

              <div className="modal-footer-right">
                <button
                  type="button"
                  className="modal-cancel-btn"
                  onClick={() => setIsEditOpen(false)}
                >
                  Hủy
                </button>
                <button
                  type="button"
                  className="modal-save-btn"
                  onClick={handleSaveFooter}
                  disabled={saving}
                >
                  {saving ? "Đang lưu..." : "Lưu Thay Đổi Chân Trang"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default SiteFooter
