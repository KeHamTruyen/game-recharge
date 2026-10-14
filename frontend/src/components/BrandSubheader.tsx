import { NavLink } from "react-router"

export default function BrandSubheader() {
  return (
    <aside className="brand-subheader-card" aria-label="Giới thiệu thương hiệu DUKE1305">
      {/* Khung logo / mascot màu vàng */}
      <div className="brand-badge-box">
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
          <span className="brand-text-line">
            <strong>Duke</strong> nhận <strong>Nạp Giá Rẻ Game Mobile</strong> —{" "}
            <strong>Trung Gian Đổi Mail</strong> — <strong>Cày Hộ Acc Game</strong>, mọi người có nhu cầu
          </span>{" "}
          <span className="brand-text-line">
            thì ủng hộ Duke nha, nhớ bấm theo dõi kênh &amp; liên hệ hỗ trợ 24/7, cám ơn mọi người rất nhiều!
          </span>
        </p>

        <div className="brand-action-pills">
          <NavLink to="/nap-game" className="brand-pill-btn">
            Nạp Game Giá Rẻ
          </NavLink>

          <NavLink to="/trung-gian" className="brand-pill-btn">
            Trung Gian Đổi Mail
          </NavLink>

          <NavLink to="/cay-thue" className="brand-pill-btn">
            Nhận Cày Hộ Acc
          </NavLink>

          <NavLink to="/lien-he" className="brand-pill-btn highlight">
            Kênh Hỗ Trợ Duke
          </NavLink>
        </div>
      </div>
    </aside>
  )
}

