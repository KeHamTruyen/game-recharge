import React, { useState } from "react"
import { Icon } from "@/components/ui"

interface GuideArticle {
  id: string
  title: string
  category: string
  readTime: string
  summary: string
  content: string[]
}

const GUIDES: GuideArticle[] = [
  {
    id: "tan-thu-khoi-dau",
    title: "Cẩm Nang Tân Thủ: 7 Ngày Khởi Đầu Thu Phục Aniimo Hiệu Quả Nhất",
    category: "Tân Thủ",
    readTime: "5 phút",
    summary:
      "Tối ưu lộ trình những ngày đầu trải nghiệm game: cách chọn Aniimo khởi đầu, nhận đủ các mốc quà tân thủ và mở khóa bản đồ thế giới nhanh chóng.",
    content: [
      "1. Chọn Aniimo khởi đầu phù hợp: Khi bắt đầu cuộc phiêu lưu, hãy ưu tiên các thú cưng có khả năng cân bằng giữa sát thương (DPS) và hồi phục. Emberpup hoặc Glacy là 2 lựa chọn cực tốt cho tân thủ.",
      "2. Nhập toàn bộ Giftcode tân thủ: Mở mục Giftcode trên Wiki để nhận hàng ngàn tinh thể và các vật phẩm ấp trứng miễn phí.",
      "3. Chú ý chỉ số Phá Giáp (BREAK): Trong Aniimo, việc phá giáp quái vật nhanh sẽ giúp team gây sát thương gấp 2-3 lần. Luôn kẹp ít nhất 1 thú cưng hệ Phá Giáp trong đội hình.",
      "4. Khám phá bản đồ thế giới: Đừng bỏ qua các rương kho báu và trứng ấp nằm rải rác ở Bình Nguyên Gió Hôn.",
    ],
  },
  {
    id: "toi-uu-tai-nguyen",
    title: "Mẹo Tối Ưu Tinh Thể & Xu Voxel Cho Người Chơi Free-To-Play (F2P)",
    category: "Tài Nguyên",
    readTime: "4 phút",
    summary:
      "Cách tích lũy và sử dụng Tinh Thể Ánh Sáng (Lumin Crystals), Xu Bạn Đồng Hành để không bị thâm hụt tài nguyên khi nâng cấp đội hình.",
    content: [
      "1. Đừng nâng đều tất cả Aniimo: Hãy tập trung 100% tài nguyên nâng max cấp cho 1 chủ lực DPS và 1 Hỗ Trợ chính trước.",
      "2. Tiêu phí Tinh Thể vào đâu: Ưu tiên mở rộng túi đồ và mua các gói vật phẩm tăng tốc ấp trứng thay vì quay gacha vô tội vạ.",
      "3. Hoàn thành nhiệm vụ ngày (Daily Quests): Đây là nguồn thu nhập đá quý và exp ổn định nhất mỗi ngày.",
    ],
  },
  {
    id: "bi-quyet-ap-trung",
    title: "Bí Quyết Ấp Trứng & Săn Biến Thể Hiếm (Shiny / Rare Variant)",
    category: "Ấp Trứng & Bắt Thú",
    readTime: "6 phút",
    summary:
      "Toàn tập về hệ thống ấp trứng Máy Ấp Trứng (Hatchinator), tỉ lệ nở ra biến thể đặc biệt và các điều kiện thời tiết để bắt thú hiếm.",
    content: [
      "1. Kiểm tra thời tiết môi trường: Một số thú cưng chỉ xuất hiện ngoài tự nhiên khi trời mưa sấm sét hoặc ban đêm.",
      "2. Sử dụng đúng loại thức ăn: Mỗi chủng loài Aniimo thích một loại quả/mồi khác nhau, dùng đúng mồi sẽ tăng 40% tỉ lệ bắt thành công.",
      "3. Máy Ấp Trứng cổ đại: Trứng Cổ Đại thu thập từ chiến dịch Egg Heist luôn có tỉ lệ cao nở ra các Aniimo tư chất bậc S.",
    ],
  },
  {
    id: "xay-dung-doi-hinh-meta",
    title: "Hướng Dẫn Build Đội Hình Chuẩn Meta Cho Mọi Phó Bản & Đấu Trường",
    category: "Chiến Thuật",
    readTime: "7 phút",
    summary:
      "Phân tích công thức chuẩn: 1 Tanker/Break + 2 DPS Nguyên Tố + 1 Healer/Buffer giúp bạn vượt qua mọi tầng tháp và Boss thế giới.",
    content: [
      "1. Công thức 4 vị trí vàng: 1 Thú cưng Phá Giáp đứng đầu + 1 DPS chủ lực đơn mục tiêu + 1 DPS diện rộng (AOE) + 1 Healer hồi máu.",
      "2. Kết hợp nguyên tố khắc chế: Lửa > Cây > Đất > Sét > Nước > Lửa. Nắm rõ vòng tuần hoàn này để gây thêm 50% sát thương lên Boss.",
      "3. Sử dụng công cụ Tool Build trên Wiki DUKE1305 để thử nghiệm cộng hưởng chỉ số trước khi dồn đá nâng cấp.",
    ],
  },
]

export default function WikiGuidePage() {
  const [selectedGuide, setSelectedGuide] = useState<GuideArticle | null>(null)
  const [activeTab, setActiveTab] = useState("Tất cả")

  const categories = [
    "Tất cả",
    "Tân Thủ",
    "Tài Nguyên",
    "Ấp Trứng & Bắt Thú",
    "Chiến Thuật",
  ]

  const filteredGuides = GUIDES.filter(
    (g) => activeTab === "Tất cả" || g.category === activeTab,
  )

  return (
    <div className="inner-page page-width wiki-page-container">
      <div className="wiki-hero-banner">
        <div className="wiki-badge-pill">
          <span className="wiki-dot-live"></span> CẨM NANG TOÀN TẬP
        </div>
        <h1 className="wiki-hero-title">📖 Wiki Hướng Dẫn Toàn Tập Aniimo</h1>
        <p className="wiki-hero-desc">
          Tổng hợp tất cả bài viết hướng dẫn chuyên sâu, mẹo tối ưu tài nguyên,
          cẩm nang tân thủ và kinh nghiệm leo top chiến trường từ các cao thủ
          game Aniimo.
        </p>
      </div>

      <div className="wiki-category-tabs">
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`wiki-tab-btn ${activeTab === cat ? "active" : ""}`}
            onClick={() => setActiveTab(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      <div className="guides-list-grid">
        {filteredGuides.map((guide) => (
          <div
            key={guide.id}
            className="guide-card"
            onClick={() => setSelectedGuide(guide)}
          >
            <div className="guide-card-top">
              <span className="guide-cat-tag">{guide.category}</span>
              <span className="guide-time-tag">⏱️ {guide.readTime}</span>
            </div>
            <h3 className="guide-card-title">{guide.title}</h3>
            <p className="guide-card-summary">{guide.summary}</p>
            <button type="button" className="guide-read-btn">
              Đọc Bài Viết ➔
            </button>
          </div>
        ))}
      </div>

      {selectedGuide && (
        <div className="modal-backdrop" onClick={() => setSelectedGuide(null)}>
          <div className="guide-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="guide-modal-header">
              <div>
                <span className="guide-cat-tag">{selectedGuide.category}</span>
                <h2>{selectedGuide.title}</h2>
              </div>
              <button
                className="aniimo-modal-close"
                onClick={() => setSelectedGuide(null)}
              >
                ✕
              </button>
            </div>
            <div className="guide-modal-body">
              <p className="guide-modal-intro">{selectedGuide.summary}</p>
              <div className="guide-modal-paragraphs">
                {selectedGuide.content.map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
