import React, { useState } from "react"
import type { AniimoMonster } from "./types"
import {
  formatImageUrl,
  getAniimoReviews,
  addAniimoReview,
  saveAniimo,
} from "./wikiData"
import rawAniipediaTierList from "@/data/wiki/aniipedia_tier_list.json"
import { useAppStore } from "@/app/AppStore"
import { Link } from "react-router"

const tierRankMap: Record<
  string,
  {
    rank: string
    label: string
    color: string
  }
> = {}
rawAniipediaTierList.forEach((tier) => {
  tier.names.forEach((name: string) => {
    tierRankMap[name.toLowerCase().trim()] = {
      rank: tier.rank,
      label: tier.label,
      color: tier.color,
    }
  })
})

interface ModalProps {
  monster: AniimoMonster | null
  onClose: () => void
  initialEditMode?: boolean
}

export const AniimoDetailModal: React.FC<ModalProps> = ({
  monster,
  onClose,
  initialEditMode = false,
}) => {
  return monster ? (
    <AniimoDetailContent
      key={monster.id}
      monster={monster}
      onClose={onClose}
      initialEditMode={initialEditMode}
    />
  ) : null
}

function AniimoDetailContent({
  monster,
  onClose,
  initialEditMode = false,
}: {
  monster: AniimoMonster
  onClose: () => void
  initialEditMode?: boolean
}) {
  const { user, setNotice } = useAppStore()
  const isAdmin = user?.role === "admin"
  const [submitting, setSubmitting] = useState(false)

  const [currentMonster, setCurrentMonster] = useState<AniimoMonster>(monster)
  const [isEditing, setIsEditing] = useState(isAdmin && initialEditMode)

  // Admin edit fields
  const [editTitle, setEditTitle] = useState(monster.title)
  const [editHp, setEditHp] = useState(monster.stats.hp)
  const [editAtk, setEditAtk] = useState(monster.stats.atk)
  const [editBreak, setEditBreak] = useState(monster.stats.break)
  const [editPdef, setEditPdef] = useState(monster.stats.pdef)
  const [editMdef, setEditMdef] = useState(monster.stats.mdef)
  const [editRegen, setEditRegen] = useState(monster.stats.regen)
  const [editLocation, setEditLocation] = useState(
    monster.forms_and_maps?.basic?.map || "",
  )
  const [saveSuccess, setSaveSuccess] = useState(false)

  const tierInfo = tierRankMap[currentMonster.title.toLowerCase().trim()]
  const element = currentMonster.taxonomies.elements?.[0]
  const role = currentMonster.taxonomies.roles?.[0]
  const stage = currentMonster.taxonomies.stages?.[0]

  const [reviews, setReviews] = useState(getAniimoReviews(currentMonster.id))
  const [commentText, setCommentText] = useState("")
  const [reviewSent, setReviewSent] = useState(false)

  const handleSaveMonster = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    setSubmitting(true)
    try {
      const updated: AniimoMonster = {
        ...currentMonster,
        title: editTitle.trim() || currentMonster.title,
        stats: {
          hp: Math.max(0, Number(editHp) || 0),
          atk: Math.max(0, Number(editAtk) || 0),
          break: Math.max(0, Number(editBreak) || 0),
          pdef: Math.max(0, Number(editPdef) || 0),
          mdef: Math.max(0, Number(editMdef) || 0),
          regen: Math.max(0, Number(editRegen) || 0),
        },
        forms_and_maps: {
          ...currentMonster.forms_and_maps,
          basic: {
            form: currentMonster.forms_and_maps?.basic?.form || "Basic Form",
            map: editLocation.trim() || currentMonster.forms_and_maps?.basic?.map || "",
          },
        },
      }

      await saveAniimo(updated)
      setCurrentMonster(updated)
      setSaveSuccess(true)
      setNotice(`Đã cập nhật thông tin "${updated.title}" thành công!`)
      setTimeout(() => {
        setSaveSuccess(false)
        setIsEditing(false)
      }, 1200)
    } catch (err: any) {
      setNotice(err?.message || "Lỗi khi lưu thông tin thú cưng")
    } finally {
      setSubmitting(false)
    }
  }

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return
    if (!user) {
      alert("Vui lòng đăng nhập tài khoản để chia sẻ mẹo chơi!")
      return
    }
    if (!commentText.trim()) return

    setSubmitting(true)
    try {
      await addAniimoReview(currentMonster.id, {
        author: user.name || user.email.split("@")[0],
        rating: 5,
        comment: commentText.trim(),
        createdAt: "Vừa xong",
      })

      setReviews(getAniimoReviews(currentMonster.id))
      setCommentText("")
      setReviewSent(true)
      setTimeout(() => setReviewSent(false), 3000)
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Không thể lưu đánh giá.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="aniimo-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aniimo-modal-header">
          <div className="aniimo-modal-title-group">
            <span className="aniimo-modal-no">#{currentMonster.no}</span>
            <h2>{currentMonster.title}</h2>
            {element && (
              <span className="aniimo-elem-pill">
                {element.icon && (
                  <img
                    src={formatImageUrl(element.icon)}
                    alt=""
                    className="badge-inline-icon"
                  />
                )}
                {element.name}
              </span>
            )}
            {role && (
              <span className="aniimo-role-pill">
                {role.icon && (
                  <img
                    src={formatImageUrl(role.icon)}
                    alt=""
                    className="badge-inline-icon"
                  />
                )}
                {role.name}
              </span>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {isAdmin && (
              <button
                type="button"
                className={`wiki-inline-edit-btn ${isEditing ? "active" : ""}`}
                onClick={() => setIsEditing(!isEditing)}
                title="Bật/Tắt chế độ chỉnh sửa thông tin trực tiếp cho Admin"
              >
                {isEditing ? "👁️ Xem Thường" : "✏️ Sửa Thông Tin (Admin)"}
              </button>
            )}
            <button className="aniimo-modal-close" onClick={onClose}>
              ✕
            </button>
          </div>
        </div>

        <div className="aniimo-modal-content">
          <div className="aniimo-modal-left">
            <div className="aniimo-modal-img-wrap">
              <img
                src={formatImageUrl(currentMonster.thumbnail)}
                alt={currentMonster.title}
                className="aniimo-modal-img"
              />
            </div>
            {tierInfo && (
              <div
                className="aniimo-score-badge"
                style={{ borderColor: tierInfo.color }}
              >
                🏆 Bậc Xếp Hạng Meta:{" "}
                <strong style={{ color: tierInfo.color }}>
                  Tier {tierInfo.rank}
                </strong>{" "}
                — {tierInfo.label}
              </div>
            )}

            {/* Admin In-Place Edit Mode vs Normal Stat Bars */}
            {isEditing && isAdmin ? (
              <div className="aniimo-admin-edit-box">
                <div className="admin-edit-box-header">
                  <h3>🛠️ Chỉnh Sửa Trực Tiếp (Admin)</h3>
                  {saveSuccess && (
                    <span className="save-success-tag">✓ Đã lưu</span>
                  )}
                </div>

                <form onSubmit={handleSaveMonster} className="aniimo-edit-form">
                  <div className="form-group">
                    <label>Tên Aniimo:</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="wiki-input"
                      required
                    />
                  </div>

                  <div className="aniimo-stats-edit-grid">
                    <div className="stat-input-group">
                      <label>HP (Máu)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editHp}
                        onChange={(e) => setEditHp(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                    <div className="stat-input-group">
                      <label>ATK (Công)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editAtk}
                        onChange={(e) => setEditAtk(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                    <div className="stat-input-group">
                      <label>BREAK (Phá)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editBreak}
                        onChange={(e) => setEditBreak(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                    <div className="stat-input-group">
                      <label>P.DEF (Thủ Lý)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editPdef}
                        onChange={(e) => setEditPdef(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                    <div className="stat-input-group">
                      <label>M.DEF (Thủ Phép)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editMdef}
                        onChange={(e) => setEditMdef(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                    <div className="stat-input-group">
                      <label>REGEN (Hồi)</label>
                      <input
                        type="number"
                        min="1"
                        max="999"
                        value={editRegen}
                        onChange={(e) => setEditRegen(Number(e.target.value))}
                        className="wiki-input"
                      />
                    </div>
                  </div>

                  <div className="form-group" style={{ marginTop: "10px" }}>
                    <label>Vị Trí &amp; Môi Trường Xuất Hiện:</label>
                    <textarea
                      rows={2}
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Mô tả vị trí xuất hiện trên bản đồ..."
                      className="wiki-input"
                    />
                  </div>

                  <div className="admin-edit-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => setIsEditing(false)}
                    >
                      Hủy Bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary"
                    >
                      {submitting ? "Đang lưu..." : "💾 Lưu Thay Đổi"}
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="aniimo-modal-stats-box">
                <h3>Chỉ số cơ bản</h3>
                <div className="aniimo-stat-bars">
                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>HP (Máu)</span>
                      <strong>{currentMonster.stats.hp}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-hp"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.hp / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>ATK (Công)</span>
                      <strong>{currentMonster.stats.atk}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-atk"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.atk / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>BREAK (Phá Giáp)</span>
                      <strong>{currentMonster.stats.break}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-break"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.break / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>P.DEF (Thủ Vật Lý)</span>
                      <strong>{currentMonster.stats.pdef}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-pdef"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.pdef / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>M.DEF (Thủ Phép)</span>
                      <strong>{currentMonster.stats.mdef}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-mdef"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.mdef / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>

                  <div className="stat-bar-item">
                    <div className="stat-bar-label">
                      <span>REGEN (Hồi Phục)</span>
                      <strong>{currentMonster.stats.regen}</strong>
                    </div>
                    <div className="stat-track">
                      <div
                        className="stat-fill stat-regen"
                        style={{
                          width: `${Math.min(100, (currentMonster.stats.regen / 120) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {stage && (
              <div className="aniimo-info-row">
                <span>Giai đoạn:</span>
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {stage.icon && (
                    <img
                      src={formatImageUrl(stage.icon)}
                      alt=""
                      style={{
                        width: "18px",
                        height: "18px",
                        objectFit: "contain",
                      }}
                    />
                  )}
                  <strong>{stage.name}</strong>
                </div>
              </div>
            )}
          </div>

          <div className="aniimo-modal-right">
            <h3>
              Bộ Kỹ Năng Chiến Đấu ({currentMonster.combat_skills?.length || 0})
            </h3>
            <div className="aniimo-skills-list">
              {currentMonster.combat_skills &&
              currentMonster.combat_skills.length > 0 ? (
                currentMonster.combat_skills.map((skill, idx) => (
                  <div key={idx} className="aniimo-skill-card">
                    <div className="aniimo-skill-icon-wrap">
                      <img
                        src={formatImageUrl(skill.icon)}
                        alt={skill.name}
                        className="aniimo-skill-img"
                      />
                    </div>
                    <div className="aniimo-skill-body">
                      <div className="aniimo-skill-head">
                        <h4>{skill.name}</h4>
                        <div className="aniimo-skill-tags">
                          {skill.cd && (
                            <span className="skill-badge cd">
                              CD: {skill.cd}
                            </span>
                          )}
                          {skill.break && (
                            <span className="skill-badge break">
                              Break: {skill.break}
                            </span>
                          )}
                          {skill.might && (
                            <span className="skill-badge might">
                              Lực: {skill.might}
                            </span>
                          )}
                        </div>
                      </div>
                      <p className="aniimo-skill-desc">{skill.desc}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="aniimo-no-skills">
                  Chưa có thông tin kỹ năng chiến đấu.
                </div>
              )}
            </div>

            {currentMonster.build_guide?.next_stages &&
              currentMonster.build_guide.next_stages.length > 0 && (
                <div className="aniimo-evo-chain">
                  <h3>Tiến Hóa Tiếp Theo:</h3>
                  <div className="aniimo-evo-list">
                    {currentMonster.build_guide.next_stages.map((evo) => (
                      <div key={evo.id} className="aniimo-evo-item">
                        <img
                          src={formatImageUrl(evo.thumbnail)}
                          alt={evo.name}
                        />
                        <span>{evo.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {currentMonster.forms_and_maps?.basic?.map && (
              <div className="aniimo-habitat-box">
                <h3>Vị Trí &amp; Môi Trường Xuất Hiện:</h3>
                <p>{currentMonster.forms_and_maps.basic.map}</p>
              </div>
            )}

            {/* Community Reviews & Tips Section */}
            <div className="aniimo-community-reviews-section">
              <div className="reviews-section-head">
                <h3>💬 Đóng Góp Ý Kiến & Mẹo Chơi ({reviews.length})</h3>
                {reviewSent && (
                  <span className="review-sent-toast">✓ Đã gửi nhận xét!</span>
                )}
              </div>

              {/* Submit form */}
              {user ? (
                <form
                  onSubmit={handleSubmitReview}
                  className="review-submit-form"
                >
                  <div className="review-form-top">
                    <span className="review-user-name">
                      Đăng mẹo chơi bởi:{" "}
                      <strong>{user.name || user.email}</strong>
                    </span>
                  </div>
                  <textarea
                    rows={2}
                    placeholder={`Chia sẻ mẹo combo, cách bắt hoặc cách build trang bị cho ${currentMonster.title}...`}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    required
                  />
                  <button
                    type="submit"
                    className="review-submit-btn"
                    disabled={submitting}
                  >
                    Gửi Mẹo Chơi
                  </button>
                </form>
              ) : (
                <div className="review-login-prompt">
                  <span>
                    🔒 Đăng nhập để chia sẻ kinh nghiệm chơi Aniimo này.
                  </span>
                  <Link to="/login" className="review-login-link">
                    Đăng Nhập
                  </Link>
                </div>
              )}

              {/* Reviews List */}
              <div className="reviews-list-container">
                {reviews.length > 0 ? (
                  reviews.map((rev) => (
                    <div key={rev.id} className="review-item-card">
                      <div className="review-item-head">
                        <strong>{rev.author}</strong>
                        <small>{rev.createdAt}</small>
                      </div>
                      <p className="review-item-comment">{rev.comment}</p>
                    </div>
                  ))
                ) : (
                  <div className="no-reviews-hint">
                    Chưa có nhận xét nào. Hãy là người đầu tiên chia sẻ bí kíp
                    chơi Aniimo này!
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
