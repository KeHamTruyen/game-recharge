import React, { useState, useEffect, useMemo } from "react"
import {
  getEffectiveAniimos,
  formatImageUrl,
  getEffectiveTierList,
  saveTierList,
  resetTierListToDefault,
  type TierDefinition,
} from "./wikiData"
import { AniimoDetailModal } from "./AniimoDetailModal"
import { useAppStore } from "@/app/AppStore"
import type { AniimoMonster } from "./types"

export default function TierListPage() {
  const { user } = useAppStore()
  const isAdmin = user?.role === "admin"

  const [monsters, setMonsters] = useState<AniimoMonster[]>(getEffectiveAniimos())
  const [tiers, setTiers] = useState<TierDefinition[]>(getEffectiveTierList())
  const [workingTiers, setWorkingTiers] = useState<TierDefinition[]>(getEffectiveTierList())
  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveToast, setSaveToast] = useState<string | null>(null)

  const [selectedMonster, setSelectedMonster] = useState<AniimoMonster | null>(null)
  const [searchQuery, setSearchQuery] = useState("")

  // Bank search & element filter state
  const [bankSearch, setBankSearch] = useState("")
  const [bankElementFilter, setBankElementFilter] = useState("all")

  useEffect(() => {
    const handleUpdate = () => {
      setMonsters(getEffectiveAniimos())
      const eff = getEffectiveTierList()
      setTiers(eff)
      setWorkingTiers((prev) => (isEditing ? prev : eff))
    }

    window.addEventListener("wiki-data-changed", handleUpdate)
    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [isEditing])

  // Fast map by normalized title and slug
  const monsterMap = useMemo(() => {
    const map = new Map<string, AniimoMonster>()
    monsters.forEach((m) => {
      map.set(m.title.toLowerCase().trim(), m)
      if (m.slug) map.set(m.slug.toLowerCase().trim(), m)
    })
    return map
  }, [monsters])

  // Unique elements for filter pills
  const availableElements = useMemo(() => {
    const set = new Map<string, string>()
    monsters.forEach((m) => {
      m.taxonomies?.elements?.forEach((e) => {
        if (e.slug && e.name) set.set(e.slug, e.name)
      })
    })
    return Array.from(set.entries()).map(([slug, name]) => ({ slug, name }))
  }, [monsters])

  // Current active tier list (previewing working draft while editing)
  const activeTiers = isEditing ? workingTiers : tiers

  // Build the tiers directly from active tier configuration
  const tierCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return activeTiers.map((tier) => {
      const list: AniimoMonster[] = []

      tier.names.forEach((name) => {
        const found = monsterMap.get(name.toLowerCase().trim())
        if (found) {
          if (
            !q ||
            found.title.toLowerCase().includes(q) ||
            String(found.no).includes(q)
          ) {
            list.push(found)
          }
        }
      })

      return {
        name: tier.rank,
        label: tier.label,
        color: tier.color,
        list,
        totalInTier: tier.names.length,
      }
    })
  }, [activeTiers, monsterMap, searchQuery])

  // Map to quickly look up which rank an Aniimo belongs to
  const rankByTitleMap = useMemo(() => {
    const map = new Map<string, { rank: string; color: string }>()
    workingTiers.forEach((tier) => {
      tier.names.forEach((name) => {
        map.set(name.toLowerCase().trim(), { rank: tier.rank, color: tier.color })
      })
    })
    return map
  }, [workingTiers])

  // Filtered monsters in the Aniimo Bank
  const filteredBankMonsters = useMemo(() => {
    const q = bankSearch.toLowerCase().trim()
    return monsters.filter((m) => {
      const matchesSearch =
        !q ||
        m.title.toLowerCase().includes(q) ||
        String(m.no).toLowerCase().includes(q)
      const matchesElement =
        bankElementFilter === "all" ||
        m.taxonomies?.elements?.some((e) => e.slug === bankElementFilter)
      return matchesSearch && matchesElement
    })
  }, [monsters, bankSearch, bankElementFilter])

  // Handlers for Admin actions
  const handleStartEditing = () => {
    setWorkingTiers(JSON.parse(JSON.stringify(tiers)))
    setIsEditing(true)
  }

  const handleCancelEditing = () => {
    setWorkingTiers(tiers)
    setIsEditing(false)
  }

  const handleAssignTier = (monsterTitle: string, targetRank: string) => {
    const norm = monsterTitle.toLowerCase().trim()
    setWorkingTiers((prev) =>
      prev.map((tier) => {
        const remaining = tier.names.filter((n) => n.toLowerCase().trim() !== norm)
        if (tier.rank === targetRank) {
          return {
            ...tier,
            names: [...remaining, monsterTitle],
          }
        }
        return {
          ...tier,
          names: remaining,
        }
      }),
    )
  }

  const handleRemoveFromTier = (monsterTitle: string) => {
    const norm = monsterTitle.toLowerCase().trim()
    setWorkingTiers((prev) =>
      prev.map((tier) => ({
        ...tier,
        names: tier.names.filter((n) => n.toLowerCase().trim() !== norm),
      })),
    )
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveTierList(workingTiers)
      setTiers(workingTiers)
      setIsEditing(false)
      setSaveToast("Đã lưu bảng xếp hạng thành công!")
      setTimeout(() => setSaveToast(null), 3500)
    } catch (err: any) {
      console.error("Lỗi khi lưu bảng xếp hạng:", err)
      alert("Không thể lưu thay đổi: " + (err?.message || "Lỗi không xác định"))
    } finally {
      setIsSaving(false)
    }
  }

  const handleReset = () => {
    if (
      window.confirm(
        "Bạn có chắc muốn đặt lại toàn bộ Tier List về mặc định ban đầu?",
      )
    ) {
      resetTierListToDefault()
      const def = getEffectiveTierList()
      setTiers(def)
      setWorkingTiers(def)
      setIsEditing(false)
      setSaveToast("Đã khôi phục bảng xếp hạng mặc định!")
      setTimeout(() => setSaveToast(null), 3500)
    }
  }

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> BẢNG XẾP HẠNG ANII PHOENIX META
        </div>
        <h1 className="wiki-hero-title">🏆 Tier List Xếp Hạng Aniimo</h1>
        <p className="wiki-hero-desc">
          Bảng xếp hạng sức mạnh tổng hợp chuẩn từ Aniipedia Meta Tier List,
          phân định rõ ràng sức mạnh chiến đấu, kỹ năng khống chế, khả năng dồn
          sát thương và tương thích đội hình.
        </p>
      </div>

      {/* Admin Action Notification Toast */}
      {saveToast && <div className="tier-toast-notice">✓ {saveToast}</div>}

      {/* Admin Edit Controls Bar */}
      {isAdmin && isEditing && (
        <div className="tier-admin-bar">
          <div className="tier-admin-bar-info">
            <span className="tier-admin-badge">⚡ Chế Độ Chỉnh Sửa Admin</span>
            <span className="tier-admin-bar-desc">
              Bấm ✕ trên ảnh Aniimo để gỡ bỏ, hoặc chọn bậc [SS, S, A, B, C, D]
              trong Kho Aniimo bên dưới để chuyển bậc trực tiếp.
            </span>
          </div>
          <div className="tier-admin-actions">
            <button
              type="button"
              className="tier-save-btn"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Đang lưu..." : "💾 Lưu Thay Đổi"}
            </button>
            <button
              type="button"
              className="tier-cancel-btn"
              onClick={handleCancelEditing}
              disabled={isSaving}
            >
              ✕ Hủy Bỏ
            </button>
            <button
              type="button"
              className="tier-reset-btn"
              onClick={handleReset}
              disabled={isSaving}
              title="Khôi phục dữ liệu Tier List nguyên bản từ hệ thống"
            >
              🔄 Đặt Lại Gốc
            </button>
          </div>
        </div>
      )}

      {/* Search & Stats Toolbar */}
      <div className="wiki-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box wiki-search">
          <input
            type="text"
            placeholder="Tìm kiếm Aniimo trong Tier List..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span className="wiki-count-badge">
            Tổng cộng <strong>{monsters.length}</strong> Aniimo trong cơ sở dữ liệu
          </span>
          {isAdmin && !isEditing && (
            <button
              type="button"
              className="tier-edit-toggle-btn"
              onClick={handleStartEditing}
            >
              <span>✏️</span> Chỉnh Sửa Bậc Xếp Hạng (Admin)
            </button>
          )}
        </div>
      </div>

      {/* Tier Rows Display */}
      <div className="tier-list-container">
        {tierCategories.map((tier) => (
          <div key={tier.name} className="tier-row-wrapper">
            <div
              className="tier-badge-label"
              style={{ backgroundColor: tier.color }}
            >
              <span className="tier-letter">{tier.name}</span>
              <span className="tier-desc-text">{tier.label}</span>
              <span className="tier-count">
                ({tier.list.length}
                {searchQuery ? `/${tier.totalInTier}` : ""})
              </span>
            </div>

            <div className="tier-monsters-pool">
              {tier.list.length === 0 ? (
                <div
                  style={{
                    padding: "16px",
                    color: "#64748b",
                    fontSize: "12px",
                  }}
                >
                  Không có Aniimo nào phù hợp trong bậc này.
                </div>
              ) : (
                tier.list.map((m) => (
                  <div
                    key={m.id}
                    className="tier-monster-item"
                    style={{ position: "relative" }}
                    onClick={() => {
                      if (!isEditing) setSelectedMonster(m)
                    }}
                    title={`${m.title} (#${m.no}) - Bậc ${tier.name}${isEditing ? " (Bấm ✕ để gỡ khỏi bậc)" : ""}`}
                  >
                    {isEditing && (
                      <button
                        type="button"
                        className="tier-remove-chip-btn"
                        title={`Gỡ ${m.title} khỏi bậc ${tier.name}`}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveFromTier(m.title)
                        }}
                      >
                        ✕
                      </button>
                    )}
                    {m.taxonomies?.elements?.[0]?.icon && (
                      <img
                        src={formatImageUrl(m.taxonomies.elements[0].icon)}
                        alt=""
                        className="tier-monster-elem-badge"
                      />
                    )}
                    <img
                      src={formatImageUrl(m.thumbnail)}
                      alt={m.title}
                      className="tier-monster-avatar"
                      loading="lazy"
                    />
                    <span className="tier-monster-name">{m.title}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Admin Aniimo Selection Bank */}
      {isAdmin && isEditing && (
        <div className="tier-admin-bank-container">
          <div className="tier-bank-header">
            <div>
              <h3>📦 Kho Thú Cưng Aniimo & Điều Chỉnh Bậc Nhanh</h3>
              <p>
                Chọn nhanh bậc [SS, S, A, B, C, D] hoặc [✕] để chuyển bậc ngay lập tức cho bất kỳ Aniimo nào.
              </p>
            </div>
            <span className="wiki-count-badge">
              Hiển thị: <strong>{filteredBankMonsters.length}</strong> / {monsters.length} Aniimo
            </span>
          </div>

          <div className="tier-bank-toolbar">
            <div className="tier-bank-search">
              <input
                type="text"
                placeholder="Tìm tên hoặc số hiệu Aniimo để xếp bậc..."
                value={bankSearch}
                onChange={(e) => setBankSearch(e.target.value)}
              />
            </div>
            <div className="tier-bank-filter-pills">
              <button
                type="button"
                className={`tier-bank-pill ${bankElementFilter === "all" ? "active" : ""}`}
                onClick={() => setBankElementFilter("all")}
              >
                Tất cả hệ
              </button>
              {availableElements.map((elem) => (
                <button
                  type="button"
                  key={elem.slug}
                  className={`tier-bank-pill ${bankElementFilter === elem.slug ? "active" : ""}`}
                  onClick={() => setBankElementFilter(elem.slug)}
                >
                  {elem.name}
                </button>
              ))}
            </div>
          </div>

          <div className="tier-bank-grid">
            {filteredBankMonsters.map((m) => {
              const currentAssignment = rankByTitleMap.get(m.title.toLowerCase().trim())
              return (
                <div key={m.id} className="tier-bank-card">
                  <div className="tier-bank-card-top">
                    <img
                      src={formatImageUrl(m.thumbnail)}
                      alt={m.title}
                      className="tier-bank-card-thumb"
                      loading="lazy"
                    />
                    <div className="tier-bank-card-info">
                      <span className="tier-bank-card-name" title={m.title}>
                        {m.title}
                      </span>
                      <span className="tier-bank-card-meta">
                        #{m.no} • {m.taxonomies?.elements?.[0]?.name || "Chưa rõ"}
                      </span>
                    </div>
                    {currentAssignment ? (
                      <span
                        className="tier-bank-card-badge"
                        style={{ backgroundColor: currentAssignment.color }}
                      >
                        {currentAssignment.rank}
                      </span>
                    ) : (
                      <span
                        className="tier-bank-card-badge"
                        style={{ backgroundColor: "#475569" }}
                      >
                        Chưa xếp
                      </span>
                    )}
                  </div>

                  <div className="tier-bank-quick-ranks">
                    {workingTiers.map((t) => {
                      const isCurrent = currentAssignment?.rank === t.rank
                      return (
                        <button
                          key={t.rank}
                          type="button"
                          className={`tier-rank-mini-btn ${isCurrent ? "active" : ""}`}
                          style={
                            isCurrent
                              ? { backgroundColor: t.color, borderColor: t.color }
                              : {}
                          }
                          onClick={() => handleAssignTier(m.title, t.rank)}
                          title={`Chuyển ${m.title} sang bậc ${t.rank}`}
                        >
                          {t.rank}
                        </button>
                      )
                    })}
                    {currentAssignment && (
                      <button
                        type="button"
                        className="tier-rank-mini-btn remove-rank"
                        onClick={() => handleRemoveFromTier(m.title)}
                        title={`Gỡ ${m.title} khỏi bậc hiện tại`}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Aniimo Detail Modal (when clicking monster in read-only mode) */}
      <AniimoDetailModal
        monster={selectedMonster}
        onClose={() => setSelectedMonster(null)}
      />
    </div>
  )
}
