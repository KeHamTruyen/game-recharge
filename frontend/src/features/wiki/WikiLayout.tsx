import { useEffect, useState } from "react"
import { Outlet } from "react-router"
import { refreshWiki } from "./wikiStore"

export default function WikiLayout() {
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
