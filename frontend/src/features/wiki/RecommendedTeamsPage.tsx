import React, { useState, useEffect } from "react"

import {
  getEffectiveCommunityTeams,
  getMonsterById,
  formatImageUrl,
  deleteCommunityTeam,
  canManageTeam,
} from "./wikiData"

import type { CommunityTeam } from "./types"

import { useAppStore } from "@/app/AppStore"

import { Link, useNavigate } from "react-router"

import { Icon } from "@/components/ui"

export default function RecommendedTeamsPage() {
  const { user, setNotice } = useAppStore()

  const navigate = useNavigate()

  const [teams, setTeams] = useState<CommunityTeam[]>(
    getEffectiveCommunityTeams(),
  )

  const [filterQuery, setFilterQuery] = useState("")

  const [activeTab, setActiveTab] = useState<"all" | "mine">("all")

  const isAdmin = user?.role === "admin"

  useEffect(() => {
    const handleUpdate = () => setTeams(getEffectiveCommunityTeams())

    window.addEventListener("wiki-data-changed", handleUpdate)

    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  const handleDelete = async (teamId: number, title: string) => {
    if (
      confirm(`Bạn có chắc chắn muốn xóa đội hình "${title}" khỏi danh sách?`)
    ) {
      try { await deleteCommunityTeam(teamId) }
      catch (error) { setNotice(error instanceof Error ? error.message : "Không thể xóa đội hình.") }
    }
  }

  const myTeamsCount = teams.filter(
    (t) =>
      user &&
      user.id && String(t.user_id) === String(user.id),
  ).length

  const filteredTeams = teams.filter((team) => {
    if (activeTab === "mine") {
      if (!user) return false

      const isMine =
        user.id && String(team.user_id) === String(user.id)

      if (!isMine) return false
    }

    const q = filterQuery.toLowerCase().trim()

    if (!q) return true

    const matchTitle = team.title.toLowerCase().includes(q)

    const matchNick = team.nickname.toLowerCase().includes(q)

    const matchDesc = (team.description || "").toLowerCase().includes(q)

    return matchTitle || matchNick || matchDesc
  })

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> CỘNG ĐỒNG CHIA SẺ
        </div>
        <h1 className="wiki-hero-title">👥 Đội Hình Đề Nghị & Bình Chọn</h1>
        <p className="wiki-hero-desc">
          Tổng hợp các chiến thuật kết hợp 4 Aniimo xuất sắc nhất từ cộng đồng.
          Bạn có thể đánh giá sao, tham khảo combo, hoặc đóng góp chiến thuật
          của chính mình!
        </p>
      </div>

      {/* Action Header & Tabs */}
      <div className="teams-action-bar">
        <div className="teams-tabs">
          <button
            type="button"
            className={`wiki-pill-btn ${activeTab === "all" ? "active" : ""}`}
            onClick={() => setActiveTab("all")}
          >
            🔥 Tất Cả Đội Hình ({teams.length})
          </button>
          <button
            type="button"
            className={`wiki-pill-btn ${activeTab === "mine" ? "active" : ""}`}
            onClick={() => setActiveTab("mine")}
          >
            ⭐ Đội Hình Của Tôi ({myTeamsCount})
          </button>
        </div>

        <Link to="/wiki/build" className="create-team-cta-btn">
          <span>🛠️</span> Tạo & Đóng Góp Đội Hình Mới ➔
        </Link>
      </div>

      <div className="wiki-toolbar">
        <div className="search-box wiki-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Tìm kiếm đội hình, tác giả hoặc mô tả..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        <span className="wiki-count-badge">
          Hiển thị <strong>{filteredTeams.length}</strong> đội hình
        </span>
      </div>

      {filteredTeams.length === 0 ? (
        <div className="wiki-empty-state">
          <p>
            {activeTab === "mine"
              ? "Bạn chưa đăng đội hình nào lên cộng đồng. Hãy sử dụng Tool Build để tạo và đóng góp ngay!"
              : "Không tìm thấy đội hình nào phù hợp với từ khóa tìm kiếm."}
          </p>
          <Link to="/wiki/build" className="wiki-pill-btn active">
            Tới Tool Build Đội Hình
          </Link>
        </div>
      ) : (
        <div className="teams-feed-grid">
          {filteredTeams.map((team) => {
            const isMyTeam =
              user &&
              (String(team.user_id) === String(user.id) ||
                team.nickname.toLowerCase() ===
                  (user.name || "").toLowerCase() ||
                team.nickname.toLowerCase() ===
                  (user.email || "").toLowerCase())

            const canManage = canManageTeam(team, user)

            return (
              <div
                key={team.id}
                className={`team-post-card ${
                  team.isCommunity ? "is-community-card" : ""
                }`}
              >
                <div className="team-card-header">
                  <div className="team-author-info">
                    <span className="team-avatar-icon">
                      {team.isCommunity ? "💎" : "👤"}
                    </span>
                    <div>
                      <div className="author-name-row">
                        <strong>{team.nickname}</strong>
                        {team.isCommunity && (
                          <span className="community-tag-badge">Cộng Đồng</span>
                        )}
                        {isMyTeam && (
                          <span className="my-team-tag-badge">Của bạn</span>
                        )}
                      </div>
                      <small>{team.time_ago || "Gần đây"}</small>
                    </div>
                  </div>

                  {/* Actions Bar on card */}
                  <div className="team-card-actions-row">
                    <Link
                      to={`/wiki/build?loadTeamId=${team.id}`}
                      className="team-action-pill load-btn"
                      title="Nạp cấu hình đội hình này vào Builder để thử nghiệm"
                    >
                      📥 Nạp Builder
                    </Link>

                    {canManage && (
                      <Link
                        to={`/wiki/build?editTeamId=${team.id}`}
                        className="team-action-pill edit-btn"
                        title="Chỉnh sửa đội hình"
                      >
                        ✏️ Sửa
                      </Link>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        className="team-action-pill delete-btn"
                        onClick={() => handleDelete(team.id, team.title)}
                        title="Xóa đội hình"
                      >
                        🗑️ Xóa
                      </button>
                    )}
                  </div>
                </div>

                <div className="team-title-row">
                  <h3 className="team-post-title">{team.title}</h3>
                </div>

                {team.description && (
                  <p className="team-post-desc">{team.description}</p>
                )}

                {/* 4 slots with skills & carried items */}
                <div className="team-slots-container">
                  {team.aniimo_ids.map((id, idx) => {
                    const monster = getMonsterById(id)

                    const build = team.build_data?.[idx]

                    return (
                      <div key={idx} className="team-slot-card">
                        <div
                          className="team-slot-avatar"
                          style={{ position: "relative" }}
                        >
                          {monster ? (
                            <>
                              <img
                                src={formatImageUrl(monster.thumbnail)}
                                alt={monster.title}
                                className="slot-monster-avatar-img"
                              />
                              {monster.taxonomies?.elements?.[0]?.icon && (
                                <img
                                  src={formatImageUrl(
                                    monster.taxonomies.elements[0].icon,
                                  )}
                                  alt=""
                                  className="slot-elem-icon-badge"
                                />
                              )}
                            </>
                          ) : (
                            <span>#{id}</span>
                          )}
                        </div>
                        <strong className="team-slot-name">
                          {monster ? monster.title : `Aniimo #${id}`}
                        </strong>

                        {build && (
                          <div className="team-slot-build">
                            {/* Skills row */}
                            <div className="team-skill-row">
                              {build.s1_icon ? (
                                <img
                                  src={formatImageUrl(build.s1_icon)}
                                  title={`Chiêu 1: ${build.s1_name}`}
                                  alt=""
                                />
                              ) : (
                                <span className="empty-skill-dot" />
                              )}
                              {build.s2_icon ? (
                                <img
                                  src={formatImageUrl(build.s2_icon)}
                                  title={`Chiêu 2: ${build.s2_name}`}
                                  alt=""
                                  className="ult-skill-dot"
                                />
                              ) : (
                                <span className="empty-skill-dot" />
                              )}
                              {build.s3_icon ? (
                                <img
                                  src={formatImageUrl(build.s3_icon)}
                                  title={`Chiêu 3: ${build.s3_name}`}
                                  alt=""
                                />
                              ) : (
                                <span className="empty-skill-dot" />
                              )}
                            </div>

                            {/* Carried item badge */}
                            {build.item_name && (
                              <div
                                className={`team-item-badge quality-${(
                                  build.item_quality || "legendary"
                                )

                                  .toLowerCase()}`}
                                title={`Vật phẩm: ${build.item_name}`}
                              >
                                {build.item_icon && (
                                  <img
                                    src={formatImageUrl(build.item_icon)}
                                    alt=""
                                  />
                                )}
                                <span>{build.item_name}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
