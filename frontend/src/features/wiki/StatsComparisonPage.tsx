import React, { useState, useMemo, useEffect } from "react"

import { getEffectiveAniimos, formatImageUrl, getElementIcon } from "./wikiData"

import { AniimoDetailModal } from "./AniimoDetailModal"

import type { AniimoMonster } from "./types"

import { Icon } from "@/components/ui"

type StatKey = "hp" | "atk" | "break" | "pdef" | "mdef" | "regen"

export default function StatsComparisonPage() {
  const [monsters, setMonsters] = useState(getEffectiveAniimos())

  const [selectedMonster, setSelectedMonster] = useState<AniimoMonster | null>(
    null,
  )

  const [sortBy, setSortBy] = useState<StatKey>("atk")

  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc")

  const [filterQuery, setFilterQuery] = useState("")

  useEffect(() => {
    const handleUpdate = () => setMonsters(getEffectiveAniimos())

    window.addEventListener("wiki-data-changed", handleUpdate)

    return () => window.removeEventListener("wiki-data-changed", handleUpdate)
  }, [])

  const handleSort = (stat: StatKey) => {
    if (sortBy === stat) {
      setSortOrder((prev) => (prev === "asc" ? "desc" : "asc"))
    } else {
      setSortBy(stat)

      setSortOrder("desc")
    }
  }

  const sortedList = useMemo(() => {
    const list = monsters.filter(
      (m) =>
        m.title.toLowerCase().includes(filterQuery.toLowerCase()) ||
        m.no.toLowerCase().includes(filterQuery.toLowerCase()),
    )

    return list.sort((a, b) => {
      const valA = a.stats[sortBy] || 0

      const valB = b.stats[sortBy] || 0

      return sortOrder === "desc" ? valB - valA : valA - valB
    })
  }, [monsters, sortBy, sortOrder, filterQuery])

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> BẢNG XẾP HẠNG &amp; SO SÁNH
        </div>
        <h1 className="wiki-hero-title">📊 So Sánh Chỉ Số Aniimo</h1>
        <p className="wiki-hero-desc">
          Bảng xếp hạng tổng quát toàn bộ 98 Aniimo theo từng chỉ số: Máu (HP),
          Tấn Công (ATK), Phá Giáp (BREAK), Giáp Vật Lý (P.DEF), Kháng Phép
          (M.DEF), Hồi Phục (REGEN). Nhấp vào tiêu đề cột để sắp xếp tăng hoặc
          giảm dần.
        </p>
      </div>

      <div className="wiki-toolbar">
        <div className="search-box wiki-search">
          <Icon name="search" size={16} />
          <input
            type="text"
            placeholder="Tìm thú cưng..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
          />
        </div>
        <div className="wiki-sort-notice">
          Đang sắp xếp theo: <strong>{sortBy.toUpperCase()}</strong> (
          {sortOrder === "desc"
            ? "Cao nhất ➔ Thấp nhất"
            : "Thấp nhất ➔ Cao nhất"}
          )
        </div>
      </div>

      <div className="wiki-table-container">
        <table className="stats-comparison-table">
          <thead>
            <tr>
              <th className="th-rank">#</th>
              <th className="th-monster">Aniimo</th>
              <th className="th-elem">Hệ</th>
              <th
                className={`th-stat sortable ${
                  sortBy === "hp" ? "active" : ""
                }`}
                onClick={() => handleSort("hp")}
              >
                HP {sortBy === "hp" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th
                className={`th-stat sortable ${
                  sortBy === "atk" ? "active" : ""
                }`}
                onClick={() => handleSort("atk")}
              >
                ATK{" "}
                {sortBy === "atk" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th
                className={`th-stat sortable ${
                  sortBy === "break" ? "active" : ""
                }`}
                onClick={() => handleSort("break")}
              >
                BREAK{" "}
                {sortBy === "break" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th
                className={`th-stat sortable ${
                  sortBy === "pdef" ? "active" : ""
                }`}
                onClick={() => handleSort("pdef")}
              >
                P.DEF{" "}
                {sortBy === "pdef" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th
                className={`th-stat sortable ${
                  sortBy === "mdef" ? "active" : ""
                }`}
                onClick={() => handleSort("mdef")}
              >
                M.DEF{" "}
                {sortBy === "mdef" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th
                className={`th-stat sortable ${
                  sortBy === "regen" ? "active" : ""
                }`}
                onClick={() => handleSort("regen")}
              >
                REGEN{" "}
                {sortBy === "regen" ? (sortOrder === "desc" ? "▼" : "▲") : "↕"}
              </th>
              <th className="th-action">Chi Tiết</th>
            </tr>
          </thead>
          <tbody>
            {sortedList.map((m, index) => {
              return (
                <tr key={m.id} className="stats-row">
                  <td className="td-rank">
                    <span
                      className={`rank-badge ${
                        index < 3 ? `top-${index + 1}` : ""
                      }`}
                    >
                      {index + 1}
                    </span>
                  </td>
                  <td className="td-monster">
                    <div className="table-monster-cell">
                      <img
                        src={formatImageUrl(m.thumbnail)}
                        alt={m.title}
                        className="table-avatar"
                        loading="lazy"
                      />
                      <div>
                        <strong>{m.title}</strong>
                        <small>#{m.no}</small>
                      </div>
                    </div>
                  </td>
                  <td className="td-elem">
                    {m.taxonomies.elements &&
                    m.taxonomies.elements.length > 0 ? (
                      <div className="td-elem-container">
                        {m.taxonomies.elements.map((elem, idx) => {
                          const iconUrl = elem.icon
                            ? formatImageUrl(elem.icon)
                            : getElementIcon(elem.slug || elem.name)

                          return (
                            <span
                              key={elem.slug || elem.name || idx}
                              className="mini-elem-badge"
                            >
                              {iconUrl && (
                                <img
                                  src={iconUrl}
                                  alt=""
                                  className="mini-elem-icon"
                                  loading="lazy"
                                />
                              )}
                              <span>{elem.name}</span>
                            </span>
                          )
                        })}
                      </div>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td
                    className={`td-stat ${sortBy === "hp" ? "highlight" : ""}`}
                  >
                    {m.stats.hp}
                  </td>
                  <td
                    className={`td-stat ${sortBy === "atk" ? "highlight" : ""}`}
                  >
                    {m.stats.atk}
                  </td>
                  <td
                    className={`td-stat ${
                      sortBy === "break" ? "highlight" : ""
                    }`}
                  >
                    {m.stats.break}
                  </td>
                  <td
                    className={`td-stat ${
                      sortBy === "pdef" ? "highlight" : ""
                    }`}
                  >
                    {m.stats.pdef}
                  </td>
                  <td
                    className={`td-stat ${
                      sortBy === "mdef" ? "highlight" : ""
                    }`}
                  >
                    {m.stats.mdef}
                  </td>
                  <td
                    className={`td-stat ${
                      sortBy === "regen" ? "highlight" : ""
                    }`}
                  >
                    {m.stats.regen}
                  </td>
                  <td className="td-action">
                    <button
                      type="button"
                      className="view-mini-btn"
                      onClick={() => setSelectedMonster(m)}
                    >
                      Xem
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AniimoDetailModal
        monster={selectedMonster}
        onClose={() => setSelectedMonster(null)}
      />
    </div>
  )
}
