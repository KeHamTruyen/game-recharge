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
    const serviceId = location.pathname.match(/^\/nap-game\/([^/]+)$/)?.[1]
    const service = serviceId
      ? store.services.find((item) => String(item.id) === serviceId)
      : undefined
    const page = service
      ? {
          title: `Nạp ${service.name} nhanh, an toàn | ${siteName}`,
          description: service.description || `Nạp ${service.name} tự động, nhanh chóng và bảo mật tại ${siteName}.`,
        }
      : location.pathname === "/trung-gian"
        ? { title: `Dịch vụ trung gian game | ${siteName}`, description: "Dịch vụ trung gian giao dịch game an toàn, minh bạch và hỗ trợ nhanh." }
        : location.pathname === "/lien-he"
          ? { title: `Liên hệ hỗ trợ nạp game | ${siteName}`, description: "Liên hệ DUKE1305 để được hỗ trợ nạp game và xử lý giao dịch." }
          : location.pathname === "/nap-game"
            ? { title: `Nạp game online nhanh, an toàn | ${siteName}`, description: "Nạp game chính hãng, giá tốt, thanh toán an toàn và hỗ trợ 24/7." }
            : { title: siteName, description: defaultDescription }
    const canonicalUrl = `${window.location.origin}${location.pathname}`
    const isPrivatePage = ["/tai-khoan", "/thanh-toan"].includes(location.pathname) || location.pathname.startsWith("/admin")

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

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')
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
    let jsonLd = document.head.querySelector<HTMLScriptElement>('script[data-seo="json-ld"]')
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
