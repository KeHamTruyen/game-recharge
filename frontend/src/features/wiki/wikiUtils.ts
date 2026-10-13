export function formatImageUrl(url: string | undefined): string {
  if (!url) return ""

  if (url.startsWith("http://") || url.startsWith("https://")) return url

  if (url.startsWith("/wiki/") || url.startsWith("wiki/")) {
    return url.startsWith("/") ? url : "/" + url
  }

  return "https://koiseki.com/" + url.replace(/^\//, "")
}

