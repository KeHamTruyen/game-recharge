import { useEffect, useState } from "react"
import { Outlet, Link } from "react-router"
import { refreshWiki } from "./wikiStore"
import { useAppStore } from "@/app/AppStore"

export default function WikiLayout() {
  const { user } = useAppStore()
  const isAdmin = user?.role === "admin"
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    const load = () => {
      void refreshWiki()
        .then(() => {
          if (active) {
            setError("")
          }
        })
        .catch(() => {
          // Graceful fallback to static wiki data
        })
    }
    load()
    const timer = window.setInterval(load, 30_000)
    window.addEventListener("focus", load)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", load)
    }
  }, [])

  return (
    <>
      {isAdmin && (
        <aside className="admin-wiki-sticky-bar" aria-label="Thanh quản trị Wiki">
          <div className="page-width admin-wiki-bar-inner">
            <div className="admin-wiki-bar-badge">
              <span className="admin-wiki-pulse-dot" />
              <strong>⚡ ADMIN WIKI DIRECT EDIT</strong>
              <span className="admin-wiki-desc">
                Bạn có thể sửa bài viết, giftcode &amp; chỉ số Aniimo trực tiếp ngay trên trang
              </span>
            </div>
            <Link to="/admin" className="admin-wiki-bar-link">
              Quản Trị Hệ Thống ➔
            </Link>
          </div>
        </aside>
      )}

      {error && (
        <p className="page-width" role="alert">
          {error}{" "}
          <button
            onClick={() =>
              void refreshWiki()
                .then(() => setError(""))
                .catch(() => {})
            }
          >
            Thử lại
          </button>
        </p>
      )}

      <div className="wiki-layout-wrapper">
        <Outlet />
      </div>
    </>
  )
}
