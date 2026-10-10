import React, { useState, useMemo, useRef, useEffect } from "react"
import keyMarkers from "@/data/wiki/map_key_markers.json"
import mapZones from "@/data/wiki/map_zones.json"
import { formatImageUrl } from "./wikiData"

interface MapMarker {
  id: string
  mapId?: string
  item_id: string
  layer: string
  name: string
  desc: string
  x: number
  y: number
  normX: number
  normY: number
  icon: string
  areaName?: string
  isUnderground?: boolean
}

interface ZonePolygon {
  id: string
  name: string
  desc: string
  labelPos: [number, number]
  poly: number[]
}

interface UndergroundTile {
  src: string
  left: number
  top: number
  width: number
  height: number
}

interface UndergroundPlan {
  id: string
  label: string
  labelVi: string
  centerX: number
  centerY: number
  tiles: UndergroundTile[]
}

const MAP_AREAS = [
  {
    id: "country-of-time",
    name: "Bình Nguyên Gió Hôn (Country of Time)",
    shortName: "Bình Nguyên Gió Hôn",
    totalPoints: 2953,
    width: 4256,
    height: 3264,
    tileFolder: "idyll-mainland",
    tilesX: 5,
    tilesY: 4,
    hasZones: true,
    hasUnderground: true,
  },
  {
    id: "lost-islets",
    name: "Quần Đảo Thất Lạc (Lost Islets)",
    shortName: "Quần Đảo Thất Lạc",
    totalPoints: 462,
    width: 6144,
    height: 4096,
    tileFolder: "lost-islets",
    tilesX: 6,
    tilesY: 4,
    hasZones: false,
    hasUnderground: false,
  },
  {
    id: "whisperwake-isles",
    name: "Quần Đảo Whisperwake (Whisperwake Isles)",
    shortName: "Whisperwake",
    totalPoints: 146,
    width: 2048,
    height: 3072,
    tileFolder: "whisperwake-isles",
    tilesX: 2,
    tilesY: 3,
    hasZones: true,
    hasUnderground: false,
  },
  {
    id: "astra",
    name: "Thành Phố Astra & Vùng Phụ Cận",
    shortName: "Thành Phố Astra",
    totalPoints: 23,
    width: 7680,
    height: 4608,
    tileFolder: "astra",
    tilesX: 8,
    tilesY: 5,
    hasZones: false,
    hasUnderground: false,
  },
]

const UNDERGROUND_PLANS: UndergroundPlan[] = [
  {
    id: "all",
    label: "All Underground Areas",
    labelVi: "Toàn Bộ Hang Ngầm (8 Khu Vực)",
    centerX: 2128,
    centerY: 1632,
    tiles: [],
  },
  {
    id: "path-1",
    label: "Minespine",
    labelVi: "Hang Minespine (Khu Xương Quặng)",
    centerX: 800,
    centerY: 1536,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/underground-08.png",
        left: -96,
        top: 1024,
        width: 1024,
        height: 1024,
      },
      {
        src: "/wiki/maps/underground/breezy-plains/underground-09.png",
        left: 928,
        top: 1024,
        width: 1024,
        height: 1024,
      },
    ],
  },
  {
    id: "path-2",
    label: "Crystal Cave / Mistrider",
    labelVi: "Động Pha Lê / Mistrider",
    centerX: 1440,
    centerY: 2048,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/underground-10.png",
        left: 928,
        top: 1024,
        width: 1024,
        height: 1024,
      },
      {
        src: "/wiki/maps/underground/breezy-plains/underground-11.png",
        left: 928,
        top: 2048,
        width: 1024,
        height: 1024,
      },
    ],
  },
  {
    id: "path-3",
    label: "Geoclaw Cavern",
    labelVi: "Hang Geoclaw (Geoclaw Cavern)",
    centerX: 1083,
    centerY: 1600,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/geoclaw-boundary.png",
        left: 980,
        top: 1511,
        width: 206,
        height: 179,
      },
    ],
  },
  {
    id: "path-4",
    label: "Magmarex Cavern",
    labelVi: "Hang Hỏa Nham Magmarex",
    centerX: 3802,
    centerY: 843,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/magmarex-boundary.png",
        left: 3478,
        top: 672,
        width: 648,
        height: 342,
      },
    ],
  },
  {
    id: "path-5",
    label: "Mistwoods Underground / Rigged Maze",
    labelVi: "Mê Cung Dưới Rừng Sương Mù",
    centerX: 1594,
    centerY: 1258,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/mistwoods-boundary.png",
        left: 1526,
        top: 1193,
        width: 136,
        height: 131,
      },
    ],
  },
  {
    id: "path-6",
    label: "Yellow Forest Hidden Cave",
    labelVi: "Mật Động Rừng Vàng (Yellow Forest)",
    centerX: 1940,
    centerY: 2303,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/yellow-forest-cave-boundary.png",
        left: 1817,
        top: 2191,
        width: 247,
        height: 225,
      },
    ],
  },
  {
    id: "path-7",
    label: "Sea of Flowers Underground",
    labelVi: "Hang Dưới Biển Hoa (Sea of Flowers)",
    centerX: 2635,
    centerY: 1645,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/sea-of-flowers-underground-boundary.png",
        left: 2551,
        top: 1549,
        width: 169,
        height: 193,
      },
    ],
  },
  {
    id: "path-8",
    label: "Sparkling Butterfly Cave",
    labelVi: "Động Hồ Điệp Lấp Lánh",
    centerX: 1569,
    centerY: 1402,
    tiles: [
      {
        src: "/wiki/maps/underground/breezy-plains/sparkling-butterfly-cave-boundary.png",
        left: 1501,
        top: 1343,
        width: 137,
        height: 119,
      },
    ],
  },
]

const LAYER_CONFIG: Record<string, {
  label: string
  icon: string
  color: string
  defaultOn: boolean
}> = {
  boss: {
    label: "Boss Thế Giới & Khiêu Chiến",
    icon: "👑",
    color: "#ef4444",
    defaultOn: true,
  },
  chests: {
    label: "Rương Báu & Hũ Thưởng",
    icon: "📦",
    color: "#a855f7",
    defaultOn: true,
  },
  items: {
    label: "Vật Phẩm & Thu Thập",
    icon: "🌿",
    color: "#10b981",
    defaultOn: true,
  },
  teleports: {
    label: "Trạm Dịch Chuyển & Điểm Hồi Sinh",
    icon: "📍",
    color: "#ec4899",
    defaultOn: true,
  },
  ambers: {
    label: "Lumin Marking & Amber",
    icon: "✨",
    color: "#38dbf8",
    defaultOn: true,
  },
  eggs: {
    label: "Tổ Trứng & Trứng Ấp",
    icon: "🥚",
    color: "#f59e0b",
    defaultOn: true,
  },
  caves: {
    label: "Cổng Hang Ngầm Bí Mật",
    icon: "🕳️",
    color: "#06b6d4",
    defaultOn: true,
  },
  poi: {
    label: "Phân Khu Đặc Biệt",
    icon: "🏛️",
    color: "#6366f1",
    defaultOn: true,
  },
}

const COLLECTED_STORAGE_KEY = "duke1305_collected_markers"

export default function WorldMapPage() {
  const [selectedArea, setSelectedArea] = useState(MAP_AREAS[0])
  const [activeLayers, setActiveLayers] = useState<Record<string, boolean>>({
    boss: false,
    chests: false,
    items: false,
    teleports: false,
    ambers: false,
    eggs: false,
    caves: false,
    poi: false,
  })
  const [showZones, setShowZones] = useState(false)
  const [currentLevel, setCurrentLevel] = useState<"surface" | "underground">(
    "surface",
  )
  const [selectedPlanId, setSelectedPlanId] = useState<string>("all")
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(() => {
    if (typeof window !== "undefined") {
      return window.innerWidth >= 1024
    }
    return false
  })
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null)
  const [selectedZone, setSelectedZone] = useState<ZonePolygon | null>(null)
  const [hoveredZone, setHoveredZone] = useState<ZonePolygon | null>(null)
  const [zoomLevel, setZoomLevel] = useState(0.85)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [searchQuery, setSearchQuery] = useState("")
  const [collectedMarkers, setCollectedMarkers] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(COLLECTED_STORAGE_KEY)
      return saved ? new Set(JSON.parse(saved)) : new Set()
    } catch {
      return new Set()
    }
  })

  const mapViewportRef = useRef<HTMLDivElement>(null)

  // Non-passive wheel listener prevents the outer webpage from scrolling while zooming
  useEffect(() => {
    const viewport = mapViewportRef.current
    if (!viewport) return

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault()
      const delta = e.deltaY < 0 ? 0.12 : -0.12
      setZoomLevel((prev) =>
        Math.min(2.8, Math.max(0.4, Number((prev + delta).toFixed(2)))),
      )
    }

    viewport.addEventListener("wheel", handleNativeWheel, { passive: false })
    return () => {
      viewport.removeEventListener("wheel", handleNativeWheel)
    }
  }, [])

  const toggleLayer = (layerKey: string) => {
    setActiveLayers((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }))
  }

  const toggleCollected = (markerId: string) => {
    setCollectedMarkers((prev) => {
      const next = new Set(prev)
      if (next.has(markerId)) {
        next.delete(markerId)
      } else {
        next.add(markerId)
      }
      try {
        localStorage.setItem(COLLECTED_STORAGE_KEY, JSON.stringify([...next]))
      } catch {}
      return next
    })
  }

  // Current zones for active map area
  const currentZones: ZonePolygon[] = useMemo(() => {
    return (mapZones as any)?.[selectedArea.id] as ZonePolygon[] || []
  }, [selectedArea.id])

  // Filter markers based on current selectedArea, layer toggles, underground level & search query
  const filteredMarkers = useMemo(() => {
    return (keyMarkers as Array<MapMarker & { isUnderground?: boolean }>).filter(
      (m) => {
        const mArea = m.mapId || "country-of-time"
        if (mArea !== selectedArea.id) return false

        if (!activeLayers[m.layer]) return false

        if (selectedArea.hasUnderground) {
          if (currentLevel === "surface") {
            // On surface: hide underground markers except cave entrances (caves layer)
            if (m.isUnderground && m.layer !== "caves") return false
          } else {
            // In underground mode: show underground markers + cave entrances
            if (!m.isUnderground && m.layer !== "caves") return false
          }
        }

        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase()
          return (
            m.name.toLowerCase().includes(q) || m.desc.toLowerCase().includes(q)
          )
        }
        return true
      },
    )
  }, [
    selectedArea.id,
    selectedArea.hasUnderground,
    activeLayers,
    currentLevel,
    searchQuery,
  ])

  // Mouse pan handling
  const handleMouseDown = (e: React.PointerEvent) => {
    if (!e.isPrimary || e.button !== 0) return
    if (
      (e.target as HTMLElement).closest(
        ".map-marker-pin, .zone-map-label-tag, button, input, select, .map-interactive-hud",
      )
    )
      return
    e.currentTarget.setPointerCapture(e.pointerId)
    setIsDragging(true)
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y })
  }

  const handleMouseMove = (e: React.PointerEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) =>
      Math.min(2.8, Math.max(0.4, Number((prev + delta).toFixed(2)))),
    )
  }

  const handleResetView = () => {
    setZoomLevel(0.85)
    setPanOffset({ x: 0, y: 0 })
    setSelectedMarker(null)
    setSelectedZone(null)
  }

  // Quick jump to zone
  const handleJumpToZone = (zone: ZonePolygon) => {
    setSelectedZone(zone)
    setSelectedMarker(null)
    const canvasW = selectedArea.width * 0.35
    const canvasH = selectedArea.height * 0.35
    const targetX = (zone.labelPos[0] / selectedArea.width) * canvasW
    const targetY = (zone.labelPos[1] / selectedArea.height) * canvasH
    setPanOffset({
      x: canvasW / 2 - targetX,
      y: canvasH / 2 - targetY,
    })
    setZoomLevel(1.4)
  }

  // Quick jump / select underground cavern plan
  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId)
    const plan = UNDERGROUND_PLANS.find((p) => p.id === planId)
    if (plan && planId !== "all") {
      const canvasW = selectedArea.width * 0.35
      const canvasH = selectedArea.height * 0.35
      const targetX = (plan.centerX / selectedArea.width) * canvasW
      const targetY = (plan.centerY / selectedArea.height) * canvasH
      setPanOffset({
        x: canvasW / 2 - targetX,
        y: canvasH / 2 - targetY,
      })
      setZoomLevel(1.5)
    }
  }

  // Generate tile matrix for background rendering (prefer local, fallback to remote)
  const tilesMatrix = useMemo(() => {
    const list: Array<{
      x: number
      y: number
      src: string
      fallbackSrc: string
      left: number
      top: number
      width: number
      height: number
    }> = []
    const step = 1024
    for (let r = 0; r < selectedArea.width; r += step) {
      for (let i = 0; i < selectedArea.height; i += step) {
        list.push({
          x: r,
          y: i,
          src: `/wiki/maps/render_tiles/${selectedArea.tileFolder}/${r}_${i}.webp`,
          fallbackSrc: `https://koiseki.com/assets/maps/render_tiles/${selectedArea.tileFolder}/${r}_${i}.webp`,
          left: (r / selectedArea.width) * 100,
          top: (i / selectedArea.height) * 100,
          width: (step / selectedArea.width) * 100,
          height: (step / selectedArea.height) * 100,
        })
      }
    }
    return list
  }, [selectedArea])

  const totalPointsInArea = useMemo(() => {
    return (keyMarkers as MapMarker[]).filter(
      (m) => (m.mapId || "country-of-time") === selectedArea.id,
    ).length
  }, [selectedArea.id])

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="game-map-wrapper">
        {/* Top Floating Action Bar */}
        <div className="map-floating-top-bar">
          {/* Left / Upper HUD: Level toggle & Region Switcher */}
          <div className="map-top-left-hud">
            {selectedArea.hasUnderground ? (
              <div className="map-level-control-group">
                <button
                  type="button"
                  className={`map-level-toggle-pill ${
                    currentLevel === "underground" ? "is-underground" : ""
                  }`}
                  onClick={() => {
                    setCurrentLevel((prev) => {
                      const next =
                        prev === "surface" ? "underground" : "surface"
                      if (next === "underground") setSelectedPlanId("all")
                      return next
                    })
                  }}
                  title="Chuyển đổi tầng Mặt Đất / Hang Ngầm"
                >
                  <span className="level-icon">
                    {currentLevel === "surface" ? "⛰️" : "🕳️"}
                  </span>
                  <strong>
                    {currentLevel === "surface" ? "Mặt Đất" : "Hang Ngầm"}
                  </strong>
                </button>

                {currentLevel === "underground" && (
                  <select
                    className="underground-plan-select"
                    value={selectedPlanId}
                    onChange={(e) => handleSelectPlan(e.target.value)}
                    title="Chọn khu vực hang ngầm"
                  >
                    {UNDERGROUND_PLANS.map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.labelVi}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : null}

            <div className="map-area-pills">
              {MAP_AREAS.map((area) => (
                <button
                  key={area.id}
                  type="button"
                  className={`map-area-tab-btn ${
                    selectedArea.id === area.id ? "active" : ""
                  }`}
                  onClick={() => {
                    setSelectedArea(area)
                    handleResetView()
                  }}
                >
                  <span className="area-tab-name">{area.shortName || area.name.split(" (")[0]}</span>
                  <span className="area-tab-count">({area.totalPoints.toLocaleString()})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Right / Lower HUD: Pin Filter, Boundaries & Create Pin */}
          <div className="map-top-right-hud">
            <button
              type="button"
              className={`map-filter-drawer-toggle ${
                filterDrawerOpen ? "active" : ""
              }`}
              onClick={() => setFilterDrawerOpen(!filterDrawerOpen)}
              title="Mở bảng lọc ghim"
            >
              <span>🎯 Lớp Ghim</span>
              <span className="filter-count-badge">
                {filteredMarkers.length}/{totalPointsInArea}
              </span>
            </button>

            <button
              type="button"
              className={`map-action-pill ${showZones ? "is-cyan-active" : ""}`}
              onClick={() => setShowZones(!showZones)}
              title="Bật/Tắt ranh giới các phân khu"
            >
              <span>🗺️ Ranh Giới</span>
            </button>
          </div>
        </div>

        {/* Collapsible Floating Left Filter Drawer */}
        {filterDrawerOpen && (
          <>
            <div
              className="map-drawer-backdrop"
              onClick={() => setFilterDrawerOpen(false)}
              aria-label="Đóng bảng lọc điểm ghim"
            />
            <div className="map-floating-filter-drawer">
            <div className="filter-drawer-head">
              <h3>🎯 Bộ Lọc Điểm Ghim</h3>
              <div className="filter-quick-toggles">
                <button
                  type="button"
                  className="quick-toggle-text-btn"
                  onClick={() => {
                    const allOn: Record<string, boolean> = {}
                    Object.keys(LAYER_CONFIG).forEach((k) => (allOn[k] = true))
                    setActiveLayers(allOn)
                  }}
                  title="Bật tất cả các lớp điểm ghim"
                >
                  Bật tất cả
                </button>
                <span className="quick-toggle-sep">|</span>
                <button
                  type="button"
                  className="quick-toggle-text-btn"
                  onClick={() => {
                    const allOff: Record<string, boolean> = {}
                    Object.keys(LAYER_CONFIG).forEach(
                      (k) => (allOff[k] = false),
                    )
                    setActiveLayers(allOff)
                  }}
                  title="Tắt tất cả các lớp điểm ghim"
                >
                  Tắt tất cả
                </button>
              </div>
              <button
                type="button"
                className="drawer-close-btn"
                onClick={() => setFilterDrawerOpen(false)}
              >
                ✕
              </button>
            </div>

            <div className="drawer-search-box">
              <input
                type="text"
                placeholder="Tìm tên vật phẩm, boss, rương..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="drawer-categories-list">
              <h4>Loại Điểm Ghim</h4>
              {Object.entries(LAYER_CONFIG).map(([key, cfg]) => {
                const count = (keyMarkers as MapMarker[]).filter(
                  (m) =>
                    (m.mapId || "country-of-time") === selectedArea.id &&
                    m.layer === key,
                ).length
                const isOn = !!activeLayers[key]
                return (
                  <button
                    key={key}
                    type="button"
                    className={`drawer-layer-btn ${isOn ? "active" : ""}`}
                    onClick={() => toggleLayer(key)}
                  >
                    <span
                      className="layer-bullet"
                      style={{ borderColor: cfg.color }}
                    >
                      {cfg.icon}
                    </span>
                    <span className="layer-title">{cfg.label}</span>
                    <span className="layer-qty">{count}</span>
                  </button>
                )
              })}
            </div>

            {currentZones.length > 0 && (
              <div className="drawer-zones-list">
                <h4>Phân Khu Lãnh Thổ ({currentZones.length})</h4>
                <div className="drawer-zones-grid">
                  {currentZones.map((zone) => (
                    <button
                      key={zone.id}
                      type="button"
                      className={`drawer-zone-btn ${
                        selectedZone?.id === zone.id ? "active" : ""
                      }`}
                      onClick={() => handleJumpToZone(zone)}
                      title={`Nhấp để di chuyển tới ${zone.name}`}
                    >
                      {zone.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          </>
        )}

        {/* Interactive Map Viewport Canvas */}
        <div
          className={`game-map-viewport ${isDragging ? "is-grabbing" : ""}`}
          ref={mapViewportRef}
          style={{ touchAction: "none" }}
          onPointerDown={handleMouseDown}
          onPointerMove={handleMouseMove}
          onPointerUp={handleMouseUp}
          onPointerCancel={handleMouseUp}
          onLostPointerCapture={handleMouseUp}
        >
          {/* Transform Canvas */}
          <div
            className="game-map-canvas"
            style={{
              width: `${selectedArea.width * 0.35}px`,
              height: `${selectedArea.height * 0.35}px`,
              marginLeft: `${-(selectedArea.width * 0.35) / 2}px`,
              marginTop: `${-(selectedArea.height * 0.35) / 2}px`,
              transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomLevel})`,
              transformOrigin: "center center",
            }}
          >
            {/* Tile Images Layer */}
            <div
              className={`game-map-tiles-layer ${
                currentLevel === "underground" ? "is-underground" : ""
              }`}
            >
              {tilesMatrix.map((tile, idx) => (
                <img
                  key={idx}
                  src={tile.src}
                  alt=""
                  className="game-map-tile-img"
                  style={{
                    left: `${tile.left}%`,
                    top: `${tile.top}%`,
                    width: `${tile.width}%`,
                    height: `${tile.height}%`,
                  }}
                  draggable={false}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement
                    if (!el.dataset.fallback) {
                      el.dataset.fallback = "1"
                      el.src = tile.fallbackSrc
                    } else {
                      el.style.opacity = "0.15"
                    }
                  }}
                />
              ))}
            </div>

            {/* Underground Cavern Boundary Layer */}
            {currentLevel === "underground" && selectedArea.hasUnderground && (
              <div className="game-map-underground-layer">
                {(selectedPlanId === "all"
                  ? UNDERGROUND_PLANS.filter((p) => p.id !== "all")
                  : UNDERGROUND_PLANS.filter((p) => p.id === selectedPlanId)
                ).map((plan) => (
                  <div key={plan.id} className="map-underground-plan-group">
                    {plan.tiles.map((tile, tIdx) => (
                      <img
                        key={tIdx}
                        src={tile.src}
                        alt={plan.labelVi}
                        className="map-underground-tile"
                        style={{
                          left: `${(tile.left / selectedArea.width) * 100}%`,
                          top: `${(tile.top / selectedArea.height) * 100}%`,
                          width: `${(tile.width / selectedArea.width) * 100}%`,
                          height: `${(tile.height / selectedArea.height) * 100}%`,
                        }}
                        draggable={false}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* Region Zones SVG Overlay (White boundaries exactly like Image 2) */}
            {showZones && currentZones.length > 0 && (
              <svg
                className="game-map-svg-zones"
                viewBox={`0 0 ${selectedArea.width} ${selectedArea.height}`}
                preserveAspectRatio="none"
              >
                {currentZones.map((zone) => {
                  const points: string[] = []
                  for (let i = 0; i < zone.poly.length; i += 2) {
                    points.push(`${zone.poly[i]},${zone.poly[i + 1]}`)
                  }
                  const isHovered = hoveredZone?.id === zone.id
                  const isSel = selectedZone?.id === zone.id

                  return (
                    <g key={zone.id}>
                      <polygon
                        points={points.join(" ")}
                        className={`zone-svg-polygon ${
                          isHovered || isSel ? "active" : ""
                        }`}
                        onMouseEnter={() => setHoveredZone(zone)}
                        onMouseLeave={() => setHoveredZone(null)}
                        onClick={(e) => {
                          e.stopPropagation()
                          handleJumpToZone(zone)
                        }}
                      />
                    </g>
                  )
                })}
              </svg>
            )}

            {/* Region Label Markers on Map (Match Image 2 labels) */}
            {showZones &&
              currentZones.length > 0 &&
              currentZones.map((zone) => {
                const left = (zone.labelPos[0] / selectedArea.width) * 100
                const top = (zone.labelPos[1] / selectedArea.height) * 100
                const isHovered = hoveredZone?.id === zone.id
                const isSel = selectedZone?.id === zone.id

                return (
                  <div
                    key={`lbl-${zone.id}`}
                    className={`game-zone-label-badge ${
                      isHovered || isSel ? "active" : ""
                    }`}
                    style={{ left: `${left}%`, top: `${top}%` }}
                    onClick={(e) => {
                      e.stopPropagation()
                      handleJumpToZone(zone)
                    }}
                  >
                    <span>{zone.name}</span>
                  </div>
                )
              })}

            {/* Marker Pins Layer */}
            <div className="game-map-pins-layer">
              {filteredMarkers.map((marker) => {
                const cfg = LAYER_CONFIG[marker.layer] || {
                  label: "Điểm Thám Hiểm",
                  color: "#38dbf8",
                  icon: "📍",
                }
                const left = marker.normX * 100
                const top = marker.normY * 100
                const isSelected = selectedMarker?.id === marker.id
                const isCollected = collectedMarkers.has(marker.id)

                return (
                  <div
                    key={marker.id}
                    className={`game-map-pin ${isSelected ? "selected" : ""} ${
                      isCollected ? "is-collected" : ""
                    }`}
                    style={{
                      left: `${left}%`,
                      top: `${top}%`,
                      borderColor: cfg.color,
                    }}
                    onClick={(e) => {
                      e.stopPropagation()
                      setSelectedMarker(marker)
                      setSelectedZone(null)
                    }}
                    title={`${marker.name} (${cfg.label})`}
                  >
                    <div
                      className="pin-halo-wrapper"
                      style={{
                        borderColor: cfg.color,
                        boxShadow: isSelected
                          ? `0 0 16px ${cfg.color}`
                          : `0 2px 8px rgba(0,0,0,0.6)`,
                      }}
                    >
                      {marker.icon ? (
                        <img
                          src={formatImageUrl(marker.icon)}
                          alt=""
                          className="pin-icon-img"
                          loading="lazy"
                          onError={(e) => {
                            ;(e.target as HTMLElement).style.display = "none"
                            const fb =
                              (e.target as HTMLElement).parentElement?.querySelector(
                                ".pin-fallback-emoji",
                              ) as HTMLElement | null
                            if (fb) fb.style.display = "flex"
                          }}
                        />
                      ) : null}
                      <span
                        className="pin-fallback-emoji"
                        style={{
                          display: marker.icon ? "none" : "flex",
                          color: cfg.color,
                        }}
                      >
                        {cfg.icon}
                      </span>
                    </div>
                    <div className="pin-hover-tooltip">
                      <span>{marker.name}</span>
                      {isCollected && <small> (Đã nhặt)</small>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Marker Detail Modal Popup */}
          {selectedMarker && (
            <div
              className="map-detail-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="detail-close-btn"
                onClick={() => setSelectedMarker(null)}
              >
                ✕
              </button>
              <div className="detail-header">
                <div
                  className="detail-icon-wrapper"
                  style={{
                    borderColor:
                      LAYER_CONFIG[selectedMarker.layer]?.color || "#38dbf8",
                  }}
                >
                  {selectedMarker.icon ? (
                    <img
                      src={formatImageUrl(selectedMarker.icon)}
                      alt=""
                      className="detail-icon"
                      onError={(e) => {
                        ;(e.target as HTMLElement).style.display = "none"
                        const fb =
                          (e.target as HTMLElement).parentElement?.querySelector(
                            ".detail-fallback-emoji",
                          ) as HTMLElement | null
                        if (fb) fb.style.display = "flex"
                      }}
                    />
                  ) : null}
                  <span
                    className="detail-fallback-emoji"
                    style={{
                      display: selectedMarker.icon ? "none" : "flex",
                      fontSize: "22px",
                    }}
                  >
                    {LAYER_CONFIG[selectedMarker.layer]?.icon || "📍"}
                  </span>
                </div>
                <div>
                  <h4>{selectedMarker.name}</h4>
                  <span
                    className="detail-layer-pill"
                    style={{
                      color:
                        LAYER_CONFIG[selectedMarker.layer]?.color || "#38dbf8",
                    }}
                  >
                    {LAYER_CONFIG[selectedMarker.layer]?.icon}{" "}
                    {LAYER_CONFIG[selectedMarker.layer]?.label}
                  </span>
                </div>
              </div>
              {selectedMarker.areaName && (
                <div className="detail-meta-row">
                  <span className="detail-meta-label">Phân khu:</span>
                  <span className="detail-meta-val">
                    {selectedMarker.areaName}
                  </span>
                </div>
              )}
              {selectedMarker.desc && (
                <p className="detail-desc">{selectedMarker.desc}</p>
              )}
              <div className="detail-coords-grid">
                <div className="coord-box">
                  <small>Tọa độ Game X</small>
                  <strong>{Math.round(selectedMarker.x)}</strong>
                </div>
                <div className="coord-box">
                  <small>Tọa độ Game Y</small>
                  <strong>{Math.round(selectedMarker.y)}</strong>
                </div>
              </div>
              <div className="detail-collect-action">
                <button
                  type="button"
                  className={`collect-toggle-btn ${
                    collectedMarkers.has(selectedMarker.id) ? "collected" : ""
                  }`}
                  onClick={() => toggleCollected(selectedMarker.id)}
                >
                  {collectedMarkers.has(selectedMarker.id)
                    ? "✓ Đã Thu Thập (Bỏ đánh dấu)"
                    : "📌 Đánh Dấu Đã Thu Thập"}
                </button>
              </div>
            </div>
          )}

          {/* Zone Detail Modal Popup */}
          {selectedZone && !selectedMarker && (
            <div
              className="map-detail-card zone-detail-card"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="detail-close-btn"
                onClick={() => setSelectedZone(null)}
              >
                ✕
              </button>
              <h4>🏞️ {selectedZone.name}</h4>
              <div
                className="zone-desc-html"
                dangerouslySetInnerHTML={{ __html: selectedZone.desc }}
              />
            </div>
          )}

          {/* Bottom Controls HUD */}
          <div className="map-bottom-hud">
            <div className="hud-zoom-controls">
              <button
                type="button"
                onClick={() => handleZoom(0.25)}
                title="Phóng to"
                className="zoom-btn"
              >
                +
              </button>
              <button
                type="button"
                onClick={() => handleZoom(-0.25)}
                title="Thu nhỏ"
                className="zoom-btn"
              >
                −
              </button>
              <button
                type="button"
                onClick={handleResetView}
                title="Căn giữa bản đồ"
                className="reset-btn"
              >
                🎯 Căn Giữa
              </button>
              <span className="zoom-value-text">
                {Math.round(zoomLevel * 100)}%
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
