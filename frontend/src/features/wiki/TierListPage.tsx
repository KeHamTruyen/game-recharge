import React, { useState, useEffect, useMemo } from "react"

import { getEffectiveAniimos, formatImageUrl } from "./wikiData"

import { AniimoDetailModal } from "./AniimoDetailModal"

import rawAniipediaTierList from "@/data/wiki/aniipedia_tier_list.json"

import type { AniimoMonster } from "./types"

interface TierDefinition {
  rank: string

  label: string

  color: string

  names: string[]
}

const tierConfig: TierDefinition[] = rawAniipediaTierList as TierDefinition[]

export default function TierListPage() {
  const [monsters, setMonsters] = useState<AniimoMonster[]>(
    getEffectiveAniimos(),
  )

  const [selectedMonster, setSelectedMonster] = useState<AniimoMonster | null>(
    null,
  )

  const [searchQuery, setSearchQuery] = useState("")

  useEffect(() => {
    const handleUpdate = () => setMonsters(getEffectiveAniimos())

    window.addEventListener("wiki-data-changed", handleUpdate)

    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  // Fast map by normalized title and slug

  const monsterMap = useMemo(() => {
    const map = new Map<string, AniimoMonster>()

    monsters.forEach((m) => {
      map.set(m.title.toLowerCase().trim(), m)

      if (m.slug) map.set(m.slug.toLowerCase().trim(), m)
    })

    return map
  }, [monsters])

  // Build the 6 tiers directly from Aniipedia Meta Tier List

  const tierCategories = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()

    return tierConfig.map((tier) => {
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
  }, [monsterMap, searchQuery])

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> BẢNG XẾP HẠNG ANII P位於 META
        </div>
        <h1 className="wiki-hero-title">🏆 Tier List Xếp Hạng Aniimo</h1>
        <p className="wiki-hero-desc">
          Bảng xếp hạng sức mạnh tổng hợp chuẩn từ Aniipedia Meta Tier List,
          phân định rõ ràng sức mạnh chiến đấu, kỹ năng khống chế, khả năng dồn
          sát thương và tương thích đội hình.
        </p>
      </div>

      <div className="wiki-toolbar" style={{ marginBottom: "20px" }}>
        <div className="search-box wiki-search">
          <input
            type="text"
            placeholder="Tìm kiếm Aniimo trong Tier List..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <span className="wiki-count-badge">
          Tổng cộng <strong>{monsters.length}</strong> Aniimo được xếp hạng
        </span>
      </div>

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
                  Không có Aniimo nào phù hợp tìm kiếm trong bậc này.
                </div>
              ) : (
                tier.list.map((m) => (
                  <div
                    key={m.id}
                    className="tier-monster-item"
                    onClick={() => setSelectedMonster(m)}
                    title={`${m.title} (#${m.no}) - Bậc ${tier.name}`}
                  >
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

      <AniimoDetailModal
        monster={selectedMonster}
        onClose={() => setSelectedMonster(null)}
      />
    </div>
  )
}
