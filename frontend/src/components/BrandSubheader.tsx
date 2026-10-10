import { NavLink } from "react-router"
import { Icon } from "@/components/ui"

export default function BrandSubheader() {
  return (
    <aside className="brand-subheader-card" aria-label="Giới thiệu thương hiệu DUKE1305">
      {/* Khung logo / mascot bên trái giống ảnh 3 */}
      <div className="brand-badge-box">
        <div className="brand-badge-header">
          <span className="badge-crown">👑</span>
          <span className="badge-name">DUKE1305</span>
        </div>
        <div className="brand-badge-avatar-wrap">
          <img
            src="/duke1305.jpg"
            alt="Mascot DUKE1305"
            className="brand-badge-avatar"
            loading="eager"
          />
        </div>
      </div>

      {/* Phần thông điệp & các nút thao tác nhanh bên phải */}
      <div className="brand-subheader-body">
        <p className="brand-subheader-text">
          <strong>Duke</strong> nhận <strong>Nạp Giá Rẻ Game Mobile</strong> —{" "}
          <strong>Trung Gian Đổi Mail</strong> — <strong>Cày Hộ Acc Game</strong>,
          mọi người có nhu cầu thì ủng hộ Duke nha, nhớ bấm theo dõi kênh &amp; liên hệ hỗ trợ 24/7, cám ơn mọi người rất nhiều!
        </p>

        <div className="brand-action-pills">
          <NavLink to="/nap-game" className="brand-pill-btn">
            <span className="pill-icon">🎮</span>
            <span>Nạp Game Giá Rẻ</span>
          </NavLink>

          <NavLink to="/trung-gian" className="brand-pill-btn">
            <span className="pill-icon">🤝</span>
            <span>Trung Gian Đổi Mail</span>
          </NavLink>

          <NavLink to="/cay-thue" className="brand-pill-btn">
            <span className="pill-icon">⚔️</span>
            <span>Nhận Cày Hộ Acc</span>
          </NavLink>

          <NavLink to="/lien-he" className="brand-pill-btn highlight">
            <span className="pill-icon">💬</span>
            <span>Kênh Hỗ Trợ Duke</span>
          </NavLink>
        </div>
      </div>
    </aside>
  )
}

