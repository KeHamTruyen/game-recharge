import React, { useState, useMemo, useEffect } from "react"
import { getEffectiveAniimos, formatImageUrl, getEffectiveTierMap } from "./wikiData"
import { AniimoDetailModal } from "./AniimoDetailModal"
import type { AniimoMonster } from "./types"
import { Icon } from "@/components/ui"

const ELEMENTS = [
  { name: "Tất cả", slug: "all", icon: "" },
  { name: "Fire", slug: "elem-fire", icon: "/wiki/icons/element-fire.png" },
  { name: "Water", slug: "elem-water", icon: "/wiki/icons/element-water.png" },
  { name: "Wind", slug: "elem-wind", icon: "/wiki/icons/element-wind.png" },
  {
    name: "Lightning",
    slug: "elem-electric",
    icon: "/wiki/icons/element-electric.png",
  },
  { name: "Earth", slug: "elem-rock", icon: "/wiki/icons/element-rock.png" },
  { name: "Grass", slug: "elem-grass", icon: "/wiki/icons/element-grass.png" },
  { name: "Ice", slug: "elem-ice", icon: "/wiki/icons/element-ice.png" },
  { name: "Light", slug: "elem-holy", icon: "/wiki/icons/element-holy.png" },
  { name: "Dark", slug: "elem-dark", icon: "/wiki/icons/element-dark.png" },
]

const ROLES = [
  { name: "Tất cả", slug: "all", icon: "" },
  { name: "DPS", slug: "role-dps", icon: "/wiki/icons/class-dps.png" },
  { name: "BREAK", slug: "role-break", icon: "/wiki/icons/class-break.png" },
  {
    name: "SUPPORT",
    slug: "role-support",
    icon: "/wiki/icons/class-support.png",
  },
  { name: "HEAL", slug: "role-heal", icon: "/wiki/icons/class-healer.png" },
  { name: "REGEN", slug: "role-regen", icon: "/wiki/icons/class-regen.png" },
]

import { useAppStore } from "@/app/AppStore"

export default function AniimoListPage() {
  const { user } = useAppStore()
  const isAdmin = user?.role === "admin"

  const [monsters, setMonsters] = useState(getEffectiveAniimos())
  const [tierRankMap, setTierRankMap] = useState(() => getEffectiveTierMap())
  const [selectedMonster, setSelectedMonster] = useState<AniimoMonster | null>(
    null,
  )
  const [startInEditMode, setStartInEditMode] = useState(false)
  const [selectedElement, setSelectedElement] = useState("all")
  const [selectedRole, setSelectedRole] = useState("all")
  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const handleUpdate = () => {
      setMonsters(getEffectiveAniimos())
      setTierRankMap(getEffectiveTierMap())
    }
    window.addEventListener("wiki-data-changed", handleUpdate)
    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  const filteredList = useMemo(() => {
    return monsters.filter((m) => {
      const matchSearch =
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.no.toLowerCase().includes(searchQuery.toLowerCase())

      const matchElement =
        selectedElement === "all" ||
        m.taxonomies.elements?.some(
          (e) =>
            e.slug === selectedElement ||
            e.name.toLowerCase().includes(selectedElement.replace("elem-", "")),
        )

      const matchRole =
        selectedRole === "all" ||
        m.taxonomies.roles?.some(
          (r) =>
            r.slug === selectedRole ||
            r.name.toLowerCase().includes(selectedRole.replace("role-", "")),
        )

      return matchSearch && matchElement && matchRole
    })
  }, [monsters, selectedElement, selectedRole, searchQuery])

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> POKEDEX ANIIMO
        </div>
        <h1 className="wiki-hero-title">🐾 Danh Sách Tất Cả Aniimo</h1>
        <p className="wiki-hero-desc">
          Bộ sưu tập 98 sinh vật huyền bí trong thế giới Aniimo. Tra cứu chi
          tiết chỉ số, hệ nguyên tố, kỹ năng chiến đấu và chuỗi tiến hóa.
        </p>
      </div>

      <div className="wiki-filter-bar">
        <div className="wiki-filter-group">
          <span className="wiki-filter-label">Hệ Nguyên Tố:</span>
          <div className="wiki-pill-list">
            {ELEMENTS.map((el) => (
              <button
                key={el.slug}
                type="button"
                className={`wiki-pill-btn ${
                  selectedElement === el.slug ? "active" : ""
                }`}
                onClick={() => setSelectedElement(el.slug)}
              >
                {el.icon && (
                  <img src={el.icon} alt="" className="filter-pill-icon" />
                )}
                {el.name}
              </button>
            ))}
          </div>
        </div>

        <div className="wiki-filter-group">
          <span className="wiki-filter-label">Vai Trò:</span>
          <div className="wiki-pill-list">
            {ROLES.map((role) => (
              <button
                key={role.slug}
                type="button"
                className={`wiki-pill-btn ${
                  selectedRole === role.slug ? "active" : ""
                }`}
                onClick={() => setSelectedRole(role.slug)}
              >
                {role.icon && (
                  <img src={role.icon} alt="" className="filter-pill-icon" />
                )}
                {role.name}
              </button>
            ))}
          </div>
        </div>

        <div className="wiki-toolbar">
          <div className="search-box wiki-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc số hiệu (ví dụ: Emberpup, 001)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <span className="wiki-count-badge">
            Hiển thị <strong>{filteredList.length}</strong> / {monsters.length}{" "}
            Aniimo
          </span>
        </div>
      </div>

      <div className="aniimo-grid">
        {filteredList.map((m) => {
          const tierInfo = tierRankMap[m.title.toLowerCase().trim()]
          const elem = m.taxonomies.elements?.[0]
          const role = m.taxonomies.roles?.[0]

          return (
            <div
              key={m.id}
              className="aniimo-card"
              onClick={() => {
                setStartInEditMode(false)
                setSelectedMonster(m)
              }}
            >
              <div className="aniimo-card-img-wrap">
                <span className="aniimo-no-tag">#{m.no}</span>
                {isAdmin && (
                  <button
                    type="button"
                    className="aniimo-card-admin-edit-btn"
                    onClick={(e) => {
                      e.stopPropagation()
                      setStartInEditMode(true)
                      setSelectedMonster(m)
                    }}
                    title="Sửa thông tin trực tiếp (Admin)"
                  >
                    ✏️ Sửa
                  </button>
                )}
                <img
                  src={formatImageUrl(m.thumbnail)}
                  alt={m.title}
                  loading="lazy"
                  className="aniimo-card-img"
                />
              </div>

              <div className="aniimo-card-body">
                <h3 className="aniimo-card-title">{m.title}</h3>

                <div className="aniimo-tags-row">
                  {elem && (
                    <span className="aniimo-elem-badge">
                      {elem.icon && (
                        <img
                          src={formatImageUrl(elem.icon)}
                          alt=""
                          className="badge-inline-icon"
                        />
                      )}
                      {elem.name.replace(/\s*\([^)]*\)/g, "")}
                    </span>
                  )}
                  {role && (
                    <span className="aniimo-role-badge">
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

                <div className="aniimo-quick-stats">
                  <div>
                    <small>HP</small>
                    <strong>{m.stats.hp}</strong>
                  </div>
                  <div>
                    <small>ATK</small>
                    <strong>{m.stats.atk}</strong>
                  </div>
                  <div>
                    <small>DEF</small>
                    <strong>{m.stats.pdef}</strong>
                  </div>
                  {tierInfo && (
                    <div>
                      <small>TIER</small>
                      <strong
                        className="tier-score"
                        style={{ color: tierInfo.color }}
                      >
                        {tierInfo.rank}
                      </strong>
                    </div>
                  )}
                </div>

                <button type="button" className="aniimo-detail-btn">
                  Xem Kỹ Năng &amp; Chỉ Số ➔
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <AniimoDetailModal
        monster={selectedMonster}
        onClose={() => setSelectedMonster(null)}
        initialEditMode={startInEditMode}
      />
    </div>
  )
}
