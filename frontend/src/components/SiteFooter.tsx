import React from "react"
import { useAppStore } from "@/app/AppStore"

export function SiteFooter() {
  const { footerConfig } = useAppStore()

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (!footerConfig) return null

  return (
    <footer className="site-custom-footer" aria-label="Chân trang">
      <div className="site-footer-inner page-width">
        {/* Support / Donation Box */}
        {footerConfig.showDonationBox !== false && (
          <div className="footer-donation-card">
            <div className="footer-donation-glow-border" aria-hidden="true" />
            <div className="footer-donation-content">
              <div className="footer-donation-header">
                <span className="footer-sparkle-icon" aria-hidden="true">✦</span>
                <h3 className="footer-donation-title">
                  {footerConfig.donationTitle || "Nếu cảm thấy nội dung hay và hữu ích thì bạn có thể ủng hộ DUKE1305 bằng cách:"}
                </h3>
              </div>

              <div className="footer-donation-actions">
                {footerConfig.youtubeUrl && (
                  <a
                    href={footerConfig.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-btn footer-btn-youtube"
                    title="Đăng Ký Kênh YouTube"
                  >
                    <span className="footer-btn-icon-wrap yt-wrap">
                      <img
                        src="/icons/youtube.svg"
                        alt=""
                        className="footer-btn-icon"
                        onError={(e) => {
                          e.currentTarget.style.display = "none"
                        }}
                      />
                    </span>
                    <span className="footer-btn-text">
                      {footerConfig.youtubeBtnText || "Đăng Ký Kênh"}
                    </span>
                  </a>
                )}

                {footerConfig.donateUrl && (
                  <a
                    href={footerConfig.donateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="footer-btn footer-btn-donate"
                    title="Donate Cho DUKE1305"
                  >
                    <span className="footer-btn-icon-wrap donate-wrap">
                      <svg
                        className="footer-btn-icon donate-svg"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width="18"
                        height="18"
                        aria-hidden="true"
                      >
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </span>
                    <span className="footer-btn-text">
                      {footerConfig.donateBtnText || "Donate Cho DUKE1305"}
                    </span>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Community Zalo Groups Section */}
        <div className="footer-community-section">
          <div className="footer-community-header">
            <span className="footer-chat-icon" aria-hidden="true">💬</span>
            <h4 className="footer-community-title">
              {footerConfig.communityTitle || "Tổng Hợp Tất Cả Nhóm Zalo Cộng Đồng"}
            </h4>
          </div>

          {footerConfig.communityGroups && footerConfig.communityGroups.length > 0 && (
            <div className="footer-community-pills">
              {footerConfig.communityGroups.map((group) => (
                <a
                  key={group.id}
                  href={group.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="community-pill-btn"
                  title={`Tham gia ${group.name}`}
                >
                  <img
                    src="/icons/zalo.svg"
                    alt=""
                    className="community-pill-icon"
                    onError={(e) => {
                      e.currentTarget.style.display = "none"
                    }}
                  />
                  <span className="community-pill-name">{group.name}</span>
                  <span className="community-pill-arrow" aria-hidden="true">↗</span>
                </a>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Bar: Mascot Back to Top & Copyright */}
        <div className="footer-bottom-bar">
          <button
            type="button"
            className="footer-mascot-top-btn"
            onClick={scrollToTop}
            title="Lên đầu trang"
            aria-label="Cuộn lên đầu trang"
          >
            <div className="mascot-cat-figure" aria-hidden="true">
              <svg
                viewBox="0 0 36 32"
                fill="none"
                className="mascot-cat-svg"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Cute Cat Silhouette & Face */}
                <path
                  d="M6 10L10 2L14 8C16 7 20 7 22 8L26 2L30 10C33 14 33 24 28 28C24 31 12 31 8 28C3 24 3 14 6 10Z"
                  fill="#1e293b"
                  stroke="#38bdf8"
                  strokeWidth="1.5"
                />
                <polygon points="10,4 8,9 13,8" fill="#f43f5e" />
                <polygon points="26,4 28,9 23,8" fill="#f43f5e" />
                {/* Eyes */}
                <circle cx="13" cy="16" r="2.2" fill="#38bdf8" />
                <circle cx="23" cy="16" r="2.2" fill="#38bdf8" />
                <circle cx="13.7" cy="15.3" r="0.8" fill="#ffffff" />
                <circle cx="23.7" cy="15.3" r="0.8" fill="#ffffff" />
                {/* Nose & Mouth */}
                <polygon points="18,18 16.8,20 19.2,20" fill="#f43f5e" />
                <path
                  d="M15.5 21.5Q18 23 20.5 21.5"
                  stroke="#94a3b8"
                  strokeWidth="1"
                  strokeLinecap="round"
                />
              </svg>
              <span className="mascot-top-label">TOP</span>
            </div>
          </button>

          <p className="footer-copyright-text">
            {footerConfig.copyrightText || "©2026 Bản Quyền Thiết Kế Thuộc Về DUKE1305."}
          </p>

          <div className="footer-bottom-spacer" aria-hidden="true" />
        </div>
      </div>
    </footer>
  )
}

export default SiteFooter
