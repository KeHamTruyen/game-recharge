import { useEffect } from "react"

import { useLocation } from "react-router"

import { useAppStore } from "@/app/AppStore"

const siteName = "DUKE1305"

const defaultDescription = "Nạp game nhanh, an toàn và minh bạch với DUKE1305."

function setMeta(name: string, content: string, property = false) {
  const attribute = property ? "property" : "name"

  let element = document.head.querySelector(`meta[${attribute}="${name}"]`)

  if (!element) {
    element = document.createElement("meta")

    element.setAttribute(attribute, name)

    document.head.appendChild(element)
  }

  element.setAttribute("content", content)
}

export function Seo() {
  const location = useLocation()

  const store = useAppStore()

  useEffect(() => {
    const wikiPages: Record<string, { title: string; description: string }> = {
      "/wiki/giftcode": {
        title: `Mã Giftcode Aniimo Mới Nhất & Code Tân Thủ | ${siteName}`,

        description:
          "Tổng hợp mã Giftcode Aniimo mới nhất còn hạn sử dụng, phần thưởng tinh thể, trứng cổ đại và hướng dẫn nhập code.",
      },

      "/wiki/list": {
        title: `Danh Sách Thú Cưng Aniimo & Chỉ Số Chi Tiết | ${siteName}`,

        description:
          "Bảng tra cứu toàn bộ 98 thú cưng Aniimo, hệ nguyên tố, chỉ số công thủ HP và vị trí xuất hiện.",
      },

      "/wiki/so-sanh": {
        title: `So Sánh Chỉ Số Thú Cưng Aniimo | ${siteName}`,

        description:
          "So sánh trực quan chỉ số, thuộc tính và sức mạnh giữa các thú cưng Aniimo trong game.",
      },

      "/wiki/stats": {
        title: `So Sánh Chỉ Số Thú Cưng Aniimo | ${siteName}`,

        description:
          "So sánh trực quan chỉ số, thuộc tính và sức mạnh giữa các thú cưng Aniimo trong game.",
      },

      "/wiki/tier-list": {
        title: `Bảng Xếp Hạng Tier List Aniimo Mới Nhất | ${siteName}`,

        description:
          "Bảng xếp hạng thú cưng Aniimo từ bậc SSS đến C theo vai trò DPS, Tanker, Supporter và đa dụng.",
      },

      "/wiki/map": {
        title: `Bản Đồ Vị Trí Thú Cưng Aniimo Map | ${siteName}`,

        description:
          "Bản đồ tương tác trực quan hiển thị vị trí bắt thú cưng, boss thế giới và tài nguyên trong Aniimo.",
      },

      "/wiki/build": {
        title: `Xây Dựng Đội Hình Aniimo & Bảng Khắc Hệ | ${siteName}`,

        description:
          "Công cụ tự tạo đội hình thú cưng Aniimo, tính tổng chỉ số, radar năng lực và phân tích tương khắc nguyên tố.",
      },

      "/wiki/teams": {
        title: `Đội Hình Đề Cử & Chiến Thuật Aniimo | ${siteName}`,

        description:
          "Khám phá các đội hình mạnh nhất từ ban quản trị và cộng đồng người chơi Aniimo.",
      },

      "/wiki/team": {
        title: `Đội Hình Đề Cử & Chiến Thuật Aniimo | ${siteName}`,

        description:
          "Khám phá các đội hình mạnh nhất từ ban quản trị và cộng đồng người chơi Aniimo.",
      },

      "/wiki/thu-vien": {
        title: `Thư Viện Kiến Thức Game Aniimo | ${siteName}`,

        description:
          "Tra cứu kiến thức, kỹ năng, nguyên tố và cơ chế chiến đấu trong thế giới Aniimo.",
      },

      "/wiki/huong-dan": {
        title: `Hướng Dẫn Tân Thủ Aniimo Chi Tiết | ${siteName}`,

        description:
          "Cẩm nang hướng dẫn chơi cho người mới bắt đầu: cách bắt thú, nâng cấp, phối đội hình và tối ưu tài nguyên.",
      },
    }

    const serviceId = location.pathname.match(/^\/nap-game\/([^/]+)$/)?.[1]

    const service = serviceId
      ? store.services.find((item) => String(item.id) === serviceId)
      : undefined

    const page = service
      ? {
          title: `Nạp ${service.name} nhanh, an toàn | ${siteName}`,

          description:
            service.description ||
            `Nạp ${service.name} tự động, nhanh chóng và bảo mật tại ${siteName}.`,
        }
      : wikiPages[location.pathname]
        ? wikiPages[location.pathname]
        : location.pathname === "/trung-gian"
          ? {
              title: `Dịch vụ trung gian game | ${siteName}`,
              description:
                "Dịch vụ trung gian giao dịch game an toàn, minh bạch và hỗ trợ nhanh.",
            }
          : location.pathname === "/lien-he"
            ? {
                title: `Liên hệ hỗ trợ nạp game | ${siteName}`,
                description:
                  "Liên hệ DUKE1305 để được hỗ trợ nạp game và xử lý giao dịch.",
              }
            : location.pathname === "/nap-game"
              ? {
                  title: `Nạp game online nhanh, an toàn | ${siteName}`,
                  description:
                    "Nạp game chính hãng, giá tốt, thanh toán an toàn và hỗ trợ 24/7.",
                }
              : { title: siteName, description: defaultDescription }

    const canonicalUrl = `${window.location.origin}${location.pathname}`

    const isPrivatePage =
      ["/tai-khoan", "/thanh-toan"].includes(location.pathname) ||
      location.pathname.startsWith("/admin")

    document.title = page.title

    setMeta("description", page.description)

    setMeta("robots", isPrivatePage ? "noindex, nofollow" : "index, follow")

    setMeta("og:title", page.title, true)

    setMeta("og:description", page.description, true)

    setMeta("og:type", "website", true)

    setMeta("og:url", canonicalUrl, true)

    setMeta("og:site_name", siteName, true)

    setMeta("twitter:card", "summary", false)

    setMeta("twitter:title", page.title)

    setMeta("twitter:description", page.description)

    let canonical = document.head.querySelector<HTMLLinkElement>(
      'link[rel="canonical"]',
    )

    if (!canonical) {
      canonical = document.createElement("link")

      canonical.rel = "canonical"

      document.head.appendChild(canonical)
    }

    canonical.href = canonicalUrl

    const structuredData = {
      "@context": "https://schema.org",

      "@type": service ? "Product" : "WebSite",

      name: service?.name || siteName,

      description: page.description,

      url: canonicalUrl,

      ...(service ? { brand: { "@type": "Brand", name: siteName } } : {}),
    }

    let jsonLd = document.head.querySelector<HTMLScriptElement>(
      'script[data-seo="json-ld"]',
    )

    if (!jsonLd) {
      jsonLd = document.createElement("script")

      jsonLd.type = "application/ld+json"

      jsonLd.dataset.seo = "json-ld"

      document.head.appendChild(jsonLd)
    }

    jsonLd.textContent = JSON.stringify(structuredData)
  }, [location.pathname, store.services])

  return null
}
