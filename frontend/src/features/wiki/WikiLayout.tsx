import { useEffect, useState } from "react"
import { Outlet } from "react-router"
import { refreshWiki } from "./wikiStore"

export default function WikiLayout() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    const load = () => {
      void refreshWiki()
        .then(() => {
          if (active) {
            setReady(true)
            setError("")
          }
        })
        .catch(() => {
          if (active)
            setError("Chưa thể tải nội dung cộng đồng. Vui lòng thử lại.")
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
                .then(() => {
                  setReady(true)
                  setError("")
                })
                .catch(() => {})
            }
          >
            Thử lại
          </button>
        </p>
      )}
      {ready ? (
        <Outlet />
      ) : (
        !error && (
          <p className="page-width" role="status">
            Đang tải Wiki…
          </p>
        )
      )}
    </>
  )
}
