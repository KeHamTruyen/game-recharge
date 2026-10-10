import React, { useState } from "react"
import type { AniimoMonster } from "./types"
import { formatImageUrl, getAniimoReviews, addAniimoReview } from "./wikiData"
import rawAniipediaTierList from "@/data/wiki/aniipedia_tier_list.json"
import { useAppStore } from "@/app/AppStore"
import { Link } from "react-router"

const tierRankMap: Record<string, {
  rank: string
  label: string
  color: string
}> = {}
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
}

export const AniimoDetailModal: React.FC<ModalProps> = ({
  monster,
  onClose,
}) => {
  if (!monster) return null

  const { user } = useAppStore()
  const tierInfo = tierRankMap[monster.title.toLowerCase().trim()]
  const element = monster.taxonomies.elements?.[0]
  const role = monster.taxonomies.roles?.[0]
  const stage = monster.taxonomies.stages?.[0]

  const [reviews, setReviews] = useState(getAniimoReviews(monster.id))
  const [commentText, setCommentText] = useState("")
  const [reviewSent, setReviewSent] = useState(false)

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) {
      alert("Vui lòng đăng nhập tài khoản để chia sẻ mẹo chơi!")
      return
    }
    if (!commentText.trim()) return

    addAniimoReview(monster.id, {
      author: user.name || user.email.split("@")[0],
      rating: 5,
      comment: commentText.trim(),
      createdAt: "Vừa xong",
    })

    setReviews(getAniimoReviews(monster.id))
    setCommentText("")
    setReviewSent(true)
    setTimeout(() => setReviewSent(false), 3000)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="aniimo-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aniimo-modal-header">
          <div className="aniimo-modal-title-group">
            <span className="aniimo-modal-no">#{monster.no}</span>
            <h2>{monster.title}</h2>
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
          <button className="aniimo-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="aniimo-modal-content">
          <div className="aniimo-modal-left">
            <div className="aniimo-modal-img-wrap">
              <img
                src={formatImageUrl(monster.thumbnail)}
                alt={monster.title}
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

            <div className="aniimo-modal-stats-box">
              <h3>Chỉ số cơ bản</h3>
              <div className="aniimo-stat-bars">
                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>HP (Máu)</span>
                    <strong>{monster.stats.hp}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-hp"
                      style={{
                        width: `${Math.min(100, (monster.stats.hp / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>ATK (Công)</span>
                    <strong>{monster.stats.atk}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-atk"
                      style={{
                        width: `${Math.min(100, (monster.stats.atk / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>BREAK (Phá Giáp)</span>
                    <strong>{monster.stats.break}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-break"
                      style={{
                        width: `${Math.min(100, (monster.stats.break / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>P.DEF (Thủ Vật Lý)</span>
                    <strong>{monster.stats.pdef}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-pdef"
                      style={{
                        width: `${Math.min(100, (monster.stats.pdef / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>M.DEF (Thủ Phép)</span>
                    <strong>{monster.stats.mdef}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-mdef"
                      style={{
                        width: `${Math.min(100, (monster.stats.mdef / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>

                <div className="stat-bar-item">
                  <div className="stat-bar-label">
                    <span>REGEN (Hồi Phục)</span>
                    <strong>{monster.stats.regen}</strong>
                  </div>
                  <div className="stat-track">
                    <div
                      className="stat-fill stat-regen"
                      style={{
                        width: `${Math.min(100, (monster.stats.regen / 120) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

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
            <h3>Bộ Kỹ Năng Chiến Đấu ({monster.combat_skills?.length || 0})</h3>
            <div className="aniimo-skills-list">
              {monster.combat_skills && monster.combat_skills.length > 0 ? (
                monster.combat_skills.map((skill, idx) => (
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

            {monster.build_guide?.next_stages &&
              monster.build_guide.next_stages.length > 0 && (
                <div className="aniimo-evo-chain">
                  <h3>Tiến Hóa Tiếp Theo:</h3>
                  <div className="aniimo-evo-list">
                    {monster.build_guide.next_stages.map((evo) => (
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

            {monster.forms_and_maps?.basic?.map && (
              <div className="aniimo-habitat-box">
                <h3>Vị Trí &amp; Môi Trường Xuất Hiện:</h3>
                <p>{monster.forms_and_maps.basic.map}</p>
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
                    placeholder={`Chia sẻ mẹo combo, cách bắt hoặc cách build trang bị cho ${monster.title}...`}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    required
                  />
                  <button type="submit" className="review-submit-btn">
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
