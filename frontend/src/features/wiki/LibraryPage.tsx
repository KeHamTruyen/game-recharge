import { libraryFullData } from "./libraryData"

import React, { useState, useMemo, useEffect, useRef } from "react"

import { formatImageUrl } from "./wikiData"

import type { LibraryItem } from "./types"

import { Icon } from "@/components/ui"

const CATEGORIES = [
  { id: "all", label: "Tất Cả", icon: "✨" },

  { id: "Ngoại Trang", label: "Ngoại Trang", icon: "👗" },

  { id: "Nội Thất & Gia Viên", label: "Nội Thất & Gia Viên", icon: "🛋️" },

  { id: "Trang Bị & Khí Cụ", label: "Trang Bị & Khí Cụ", icon: "⚔️" },

  { id: "Trứng Ấp", label: "Trứng Ấp", icon: "🥚" },

  { id: "Tiến Hóa & Cộng Hưởng", label: "Tiến Hóa & Cộng Hưởng", icon: "🧬" },

  { id: "Rương & Kho Báu", label: "Rương & Kho Báu", icon: "🎁" },

  { id: "Nhiệm Vụ & Đồ Hiếm", label: "Nhiệm Vụ & Đồ Hiếm", icon: "📜" },

  { id: "Tiêu Hao & Thức Ăn", label: "Tiêu Hao & Thức Ăn", icon: "🍎" },

  { id: "Tiền Tệ & Tiện Ích", label: "Tiền Tệ & Tiện Ích", icon: "💎" },
]

const QUALITIES = [
  { val: "all", label: "Tất cả" },

  { val: "normal", label: "Thường (Normal)" },

  { val: "uncommon", label: "Không Phổ Biến" },

  { val: "rare", label: "Hiếm (Rare)" },

  { val: "epic", label: "Cực Phẩm (Epic)" },

  { val: "legendary", label: "Huyền Thoại (Legendary)" },

  { val: "prismatic", label: "Cổ Đại (Prismatic)" },
]

const PAGE_SIZE_OPTIONS = [24, 48, 96]

export default function LibraryPage() {
  const [selectedCat, setSelectedCat] = useState("all")

  const [selectedQuality, setSelectedQuality] = useState("all")

  const [searchQuery, setSearchQuery] = useState("")

  const [activeItem, setActiveItem] = useState<LibraryItem | null>(null)

  // Pagination state

  const [currentPage, setCurrentPage] = useState(1)

  const [pageSize, setPageSize] = useState(48)

  const itemsGridRef = useRef<HTMLDivElement>(null)

  // Calculate category counts

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = { all: libraryFullData.length }

    CATEGORIES.forEach((c) => {
      if (c.id !== "all") {
        counts[c.id] = libraryFullData.filter(
          (item) => item.categoryGroup === c.id,
        ).length
      }
    })

    return counts
  }, [])

  // Filter items

  const filteredItems = useMemo(() => {
    return libraryFullData.filter((item) => {
      const q = searchQuery.trim().toLowerCase()

      const matchSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        (item.sub || "").toLowerCase().includes(q) ||
        item.category.toLowerCase().includes(q)

      const matchCat =
        selectedCat === "all" || item.categoryGroup === selectedCat

      const matchQuality =
        selectedQuality === "all" ||
        item.quality.toLowerCase() === selectedQuality.toLowerCase()

      return matchSearch && matchCat && matchQuality
    })
  }, [searchQuery, selectedCat, selectedQuality])

  // Reset page to 1 when filters change

  useEffect(() => {
    setCurrentPage(1)
  }, [selectedCat, selectedQuality, searchQuery, pageSize])

  // Total pages

  const totalPages = Math.ceil(filteredItems.length / pageSize) || 1

  // Current slice of items

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize

    return filteredItems.slice(start, start + pageSize)
  }, [filteredItems, currentPage, pageSize])

  // Change page with smooth scroll

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages) return

    setCurrentPage(newPage)

    if (itemsGridRef.current) {
      itemsGridRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      })
    }
  }

  // Generate pagination buttons with smart ellipsis

  const getPageNumbers = () => {
    const pages: (number | string)[] = []

    const delta = 2

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
    } else {
      const left = Math.max(1, currentPage - delta)

      const right = Math.min(totalPages, currentPage + delta)

      if (left > 1) {
        pages.push(1)

        if (left > 2) pages.push("...")
      }

      for (let i = left; i <= right; i++) {
        pages.push(i)
      }

      if (right < totalPages) {
        if (right < totalPages - 1) pages.push("...")

        pages.push(totalPages)
      }
    }

    return pages
  }

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> BÁCH KHOA TOÀN THƯ
        </div>
        <h1 className="wiki-hero-title">📚 Bách Khoa Toàn Thư Aniimo</h1>
        <p className="wiki-hero-desc">
          Kho dữ liệu tra cứu đầy đủ{" "}
          <strong>{libraryFullData.length.toLocaleString()}</strong> vật phẩm:
          Ngoại trang, nội thất gia viên, trứng ấp, nguyên liệu tiến hóa, cộng
          hưởng, rương báu và trang bị quý hiếm trong thế giới Aniimo.
        </p>
      </div>

      <div className="wiki-filter-bar">
        {/* Category Pills */}
        <div className="wiki-filter-group">
          <span className="wiki-filter-label">Danh Mục:</span>
          <div className="wiki-pill-list">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={`wiki-pill-btn ${
                  selectedCat === cat.id ? "active" : ""
                }`}
                onClick={() => setSelectedCat(cat.id)}
              >
                <span>{cat.icon}</span>
                <span>{cat.label}</span>
                <span className="pill-count-tag">
                  {categoryCounts[cat.id] ?? 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Quality Filter */}
        <div className="wiki-filter-group">
          <span className="wiki-filter-label">Phẩm Chất:</span>
          <div className="wiki-pill-list">
            {QUALITIES.map((q) => (
              <button
                key={q.val}
                type="button"
                className={`wiki-pill-btn ${
                  selectedQuality === q.val ? "active" : ""
                }`}
                onClick={() => setSelectedQuality(q.val)}
              >
                {q.label}
              </button>
            ))}
          </div>
        </div>

        {/* Search and Toolbar */}
        <div className="wiki-toolbar">
          <div className="search-box wiki-search">
            <Icon name="search" size={16} />
            <input
              type="text"
              placeholder="Tìm kiếm vật phẩm, nguyên liệu, ngoại trang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="wiki-toolbar-right">
            <span className="wiki-count-badge">
              Tìm thấy <strong>{filteredItems.length.toLocaleString()}</strong>{" "}
              vật phẩm
            </span>
            <div className="library-page-size-selector">
              <span>Hiển thị:</span>
              <select
                className="library-page-size-select"
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / trang
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Anchor for auto scroll */}
      <div ref={itemsGridRef} style={{ scrollMarginTop: "90px" }} />

      {/* Items Grid */}
      {paginatedItems.length === 0 ? (
        <div className="wiki-empty-state">
          <p>🔍 Không tìm thấy vật phẩm nào phù hợp với bộ lọc hiện tại.</p>
          <button
            type="button"
            className="wiki-pill-btn active"
            onClick={() => {
              setSelectedCat("all")

              setSelectedQuality("all")

              setSearchQuery("")
            }}
          >
            Đặt Lại Bộ Lọc
          </button>
        </div>
      ) : (
        <div className="library-items-grid">
          {paginatedItems.map((item) => (
            <div
              key={item.id}
              className={`library-item-card quality-${(item.quality || "normal").toLowerCase()}`}
              onClick={() => setActiveItem(item)}
            >
              <div className="library-item-icon-box">
                <img
                  src={formatImageUrl(item.icon)}
                  alt={item.name}
                  loading="lazy"
                  onError={(e) => {
                    ;(e.target as HTMLElement).style.display = "none"
                  }}
                />
              </div>
              <div className="library-item-info">
                <h4 className="library-item-name" title={item.name}>
                  {item.name}
                </h4>
                <span
                  className="library-item-sub"
                  title={item.category || item.categoryGroup}
                >
                  {item.category || item.categoryGroup}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="library-pagination-wrapper">
          <div className="library-pagination-info">
            Trang <strong>{currentPage}</strong> / <strong>{totalPages}</strong>{" "}
            (Hiển thị{" "}
            {Math.min(filteredItems.length, (currentPage - 1) * pageSize + 1)} -{" "}
            {Math.min(filteredItems.length, currentPage * pageSize)} trên tổng
            số {filteredItems.length.toLocaleString()})
          </div>

          <div className="library-pagination-controls">
            <button
              type="button"
              className="library-page-btn"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(1)}
              title="Trang đầu"
            >
              «
            </button>
            <button
              type="button"
              className="library-page-btn"
              disabled={currentPage === 1}
              onClick={() => handlePageChange(currentPage - 1)}
              title="Trang trước"
            >
              ‹ Trước
            </button>

            {getPageNumbers().map((p, idx) =>
              p === "..." ? (
                <span key={`dots-${idx}`} className="library-pagination-dots">
                  ...
                </span>
              ) : (
                <button
                  key={`page-${p}`}
                  type="button"
                  className={`library-page-btn ${
                    currentPage === p ? "active" : ""
                  }`}
                  onClick={() => handlePageChange(p as number)}
                >
                  {p}
                </button>
              ),
            )}

            <button
              type="button"
              className="library-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(currentPage + 1)}
              title="Trang sau"
            >
              Sau ›
            </button>
            <button
              type="button"
              className="library-page-btn"
              disabled={currentPage === totalPages}
              onClick={() => handlePageChange(totalPages)}
              title="Trang cuối"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* Item Detail Modal */}
      {activeItem && (
        <div className="modal-backdrop" onClick={() => setActiveItem(null)}>
          <div className="item-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="item-modal-header">
              <div className="item-modal-title-row">
                <img
                  src={formatImageUrl(activeItem.icon)}
                  alt=""
                  className="item-modal-icon"
                />
                <div>
                  <h3>{activeItem.name}</h3>
                  <span
                    className={`item-modal-quality ${(activeItem.quality || "normal").toLowerCase()}`}
                  >
                    Phẩm chất: {activeItem.qualityVi || activeItem.quality}
                  </span>
                </div>
              </div>
              <button
                className="aniimo-modal-close"
                onClick={() => setActiveItem(null)}
              >
                ✕
              </button>
            </div>
            <div className="item-modal-body">
              <div className="item-modal-prop">
                <small>Nhóm danh mục:</small>
                <strong>{activeItem.categoryGroup}</strong>
              </div>
              <div className="item-modal-prop">
                <small>Phân loại chi tiết:</small>
                <strong>{activeItem.category}</strong>
              </div>

              {activeItem.desc && (
                <div className="item-modal-desc">
                  <small>Mô tả vật phẩm:</small>
                  <p>{activeItem.desc}</p>
                </div>
              )}

              {activeItem.detail_facts &&
                activeItem.detail_facts.length > 0 && (
                  <div className="item-modal-facts-list">
                    <small>Thông số chi tiết:</small>
                    <div className="item-facts-grid">
                      {activeItem.detail_facts.map((fact, i) => (
                        <div key={i} className="fact-badge">
                          <span className="fact-lbl">{fact.label}:</span>
                          <span className="fact-val">{fact.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              {activeItem.obtain_methods &&
                activeItem.obtain_methods.length > 0 && (
                  <div className="item-modal-obtain">
                    <small>Cách nhận / Lộ trình thu thập:</small>
                    <ul>
                      {activeItem.obtain_methods.map((method, i) => (
                        <li key={i}>{method}</li>
                      ))}
                    </ul>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
