import { Link } from "react-router"

export default function NotFoundPage() {
  return <main className="page-width empty-state">
    <h1>404 — Không tìm thấy trang</h1>
    <p>Đường dẫn không tồn tại hoặc nội dung đã được gỡ.</p>
    <Link className="primary-button" to="/nap-game">Về cửa hàng</Link>
  </main>
}
