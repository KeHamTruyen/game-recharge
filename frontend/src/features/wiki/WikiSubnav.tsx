import React from "react"
import { NavLink } from "react-router"

const WIKI_NAV_ITEMS = [
  { to: "/wiki/build", label: "Build Đội hình", icon: "🛠️" },
  { to: "/wiki/teams", label: "Đội hình đề xuất", icon: "👥" },
  { to: "/wiki/list", label: "Danh sách Aniimo", icon: "📖" },
  { to: "/wiki/tier-list", label: "Tier List", icon: "🏆" },
  { to: "/wiki/map", label: "Bản đồ", icon: "🗺️" },
  { to: "/wiki/giftcode", label: "Giftcode", icon: "🎁" },
  { to: "/wiki/so-sanh", label: "So sánh chỉ số", icon: "⚖️" },
  { to: "/wiki/thu-vien", label: "Thư viện", icon: "📚" },
  { to: "/wiki/huong-dan", label: "Cẩm nang", icon: "🧭" },
]

export function WikiSubnav() {
  return (
    <nav className="wiki-subnav-bar" aria-label="Điều hướng Wiki Aniimo">
      <div className="wiki-subnav-scroll">
        {WIKI_NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) =>
              `wiki-subnav-item${isActive ? " active" : ""}`
            }
          >
            <span className="wiki-subnav-icon" aria-hidden="true">{item.icon}</span>
            <span>{item.label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}

export default WikiSubnav

