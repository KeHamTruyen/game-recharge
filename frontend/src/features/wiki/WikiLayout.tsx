import { useEffect, useState } from "react"
import { Outlet } from "react-router"
import { refreshWiki } from "./wikiStore"

export default function WikiLayout() {
  const [error, setError] = useState("")

  useEffect(() => {
    let active = true
    const load = (force = false) => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden" && !force) {
        return
      }
      void refreshWiki(force)
        .then(() => {
          if (active) {
            setError("")
          }
        })
        .catch(() => {
          // Graceful fallback to static wiki data
        })
    }
    load(true)
    const timer = window.setInterval(() => load(false), 30_000)
    const onFocus = () => load(true)
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        load(true)
      }
    }
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)
    return () => {
      active = false
      clearInterval(timer)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return (
    <>
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
