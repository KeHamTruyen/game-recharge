# Kế hoạch Hoàn thiện & Danh mục Công việc (TODO) — DUKE1305

> Cập nhật mới nhất: **13/10/2026**. Hệ thống đã hoàn thiện **toàn bộ 9/9 nhận xét vận hành & bảo mật chuyên sâu**, cùng 5 tính năng vận hành quan trọng (Telegram alerts, Tự động Backup CSDL hàng ngày, Chống spam PENDING, Audit Log UI, Chế độ Bảo trì). Toàn bộ **133/133 test backend đạt** trên 14 suites, Frontend typecheck và production build đạt **0 lỗi**.

---

## 🏆 Các hạng mục vừa hoàn thành & kiểm thử ổn định (Recently Completed)

### 1. Bộ 9 Nhận xét Vận hành & Cải tiến Chuyên sâu (13/10/2026)
- [x] **1. Khôi phục checkout khi mất mạng:**
  - Khóa chống trùng lặp `idempotencyKey` được gắn liền với hash giỏ hàng và lưu an toàn trong `sessionStorage`.
  - Khi mất mạng hoặc F5 tải lại trang, hệ thống tự động nhận diện khóa cũ và truy xuất đơn hàng đã tạo thay vì sinh đơn trùng.
- [x] **2. Xử lý sự cố CSDL tạm thời:**
  - Trả về mã HTTP `503 Service Unavailable` kèm header `Retry-After: 30`.
  - Giữ nguyên cookie xác thực HttpOnly, tuyệt đối không đăng xuất khách hàng nhầm khi CSDL gặp lỗi tạm thời.
- [x] **3. Chuẩn hóa lỗi đầu vào & Tracing:**
  - JSON hỏng cấu trúc trả về `400 Bad Request`.
  - Request body vượt quá dung lượng cho phép trả về `413 Payload Too Large`.
  - Gắn kèm `X-Request-Id` (UUIDv4) trên mọi response để phục vụ tra cứu log hệ thống.
- [x] **4. Validation Topup Template an toàn:**
  - Giới hạn tối đa 20 trường nhập liệu cho mỗi mẫu template.
  - Ngăn chặn triệt để key trùng lặp.
  - Kiểm tra tính an toàn của biểu thức RegEx (`safe pattern testing`), chống tấn công ReDoS.
- [x] **5. Dừng Container Graceful Shutdown:**
  - Script `container-entrypoint.js` chuyển tiếp chính xác tín hiệu dừng `SIGTERM` / `SIGINT` tới tiến trình Node.js.
  - Đóng kết nối HTTP và ngắt kết nối Prisma sạch sẽ trong vòng 10 giây; có test integration `test-container-shutdown.mjs`.
- [x] **6. Tách biệt Trạng thái & Audit Log:**
  - Tách bạch rõ ràng `paymentStatus` (`PENDING`, `PAID`, `REFUNDED`) và `status` (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `REFUNDED`).
  - Thao tác cập nhật trạng thái thủ công của Admin bắt buộc phải có lý do và được ghi nhận vào `AuditLog`.
- [x] **7. Đối soát Thanh toán Bất thường (`PaymentAnomaly`):**
  - Tự động ghi nhận các giao dịch sai số tiền, sai nội dung hoặc chuyển tiền lặp lại vào bảng `PaymentAnomaly`.
  - Giao diện Admin **"Đối soát thanh toán"** (`PaymentAnomalyManager`) cho phép kiểm tra chi tiết, đối soát và xử lý theo từng trường hợp.
- [x] **8. Tiếp tục thanh toán đơn chờ (Resume Payment):**
  - Cung cấp API `GET /api/orders/:code/payment` và nút "Thanh toán ngay" trong tab Lịch sử tài khoản.
  - Modal `ResumePaymentModal` hiển thị mã VietQR động cùng cơ chế polling thời gian thực kiểm tra giao dịch hoàn tất.
- [x] **9. Ghi nhận Hoàn tiền Chuẩn doanh nghiệp (Refund Flow):**
  - Modal `RefundModal` chuyên dụng trong Admin: ghi nhận số tiền hoàn (`refundAmount`), mã giao dịch ngân hàng (`refundTxId`), lý do hoàn tiền (`refundReason`).
  - Lưu vết ID người duyệt (`refundedById`), thời điểm (`refundedAt`), cập nhật `paymentStatus` thành `REFUNDED` và ghi sự kiện `TRANSACTION_REFUND` vào `AuditLog`.

### 2. Các Tính Năng Vận Hành Bổ Sung (12-13/10/2026)
- [x] **10. Bắn thông báo Telegram khi có đơn hàng mới:**
  - Tích hợp module `telegram.ts` (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`) tự động gửi tin nhắn Telegram thông báo mã đơn, sản phẩm, số tiền và thông tin khách hàng.
- [x] **11. Tự động Sao lưu CSDL hàng ngày & Khôi phục an toàn:**
  - Script sao lưu `backend/scripts/backup.mjs` (và service `backup` trong `docker-compose.yml`) tự động sao lưu hàng ngày và dọn dẹp bản backup cũ vượt quá 7 ngày.
  - Script khôi phục cross-platform `backend/scripts/restore.mjs` tích hợp lệnh `npm run db:restore -- <dump_file>`.
- [x] **12. Chống spam tạo đơn PENDING:**
  - Cấu hình giới hạn số lượng đơn PENDING tối đa theo từng tài khoản và từng địa chỉ IP, ngăn chặn tình trạng tạo hàng loạt đơn chờ gây nghẽn hệ thống.
- [x] **13. Bảng Xem Nhật Ký Hoạt Động (Audit Log Viewer):**
  - Giao diện Admin `AuditLogViewer` với bộ lọc theo loại hành động, mã đơn hàng, người thực hiện và phân trang trực quan.
- [x] **14. Công tắc Chế độ Bảo trì (Maintenance Mode):**
  - Cho phép Admin bật/tắt chế độ bảo trì trực tiếp từ bảng điều khiển; trả về 503 cho khách hàng và hỗ trợ cơ chế Admin bypass.

### 3. Các Sửa Lỗi Bảo Mật Trước Đó (A01–A04, A07, A10)
- [x] **A01 — Khóa OTP nguyên tử:** Khóa OTP theo email + mục đích trong transaction, giới hạn 5 lần sai, chống race condition.
- [x] **A02 — Webhook SePay an toàn:** Yêu cầu ID webhook là số nguyên dương an toàn, ghi nhận receipt và thanh toán nguyên tử.
- [x] **A03 — Webhook không ghi đè đơn đã kết thúc:** Không mở lại đơn `COMPLETED`/`FAILED`/`REFUNDED`, chống cộng dồn chi tiêu hai lần.
- [x] **A04 — Mã hóa dữ liệu nhạy cảm AES-256-GCM:** Lưu snapshot loại trường `topupFields`, che thông tin nhạy cảm cho khách và mã hóa tại tầng CSDL.
- [x] **A06 — Bộ kiểm thử tự động toàn diện:** Nâng tổng số ca kiểm thử backend lên **133/133 tests đạt** trên 14 test suites.
- [x] **A07 — Bỏ ép kiểu `tx as any` ở webhook:** Sử dụng kiểu dữ liệu chuẩn của Prisma transaction delegate.
- [x] **A10 — Hoàn thiện tài liệu triển khai & khôi phục:** Cập nhật toàn diện `README.md`, bổ sung `restore.mjs` và các script `db:backup`/`db:restore`.

### 4. Nâng Cấp Giao Diện & Bách Khoa Aniimo
- [x] Đồng bộ nhận diện thương hiệu DUKE1305 toàn diện, loại bỏ chuỗi cũ.
- [x] Bản đồ tương tác Aniimo: 8 khu vực hang ngầm độc lập, chống giật cuộn chuột, lưu ghim đã nhặt vào `localStorage`.
- [x] Team Builder: Bắt buộc 4 Aniimo, chống đăng trùng lặp tổ hợp tướng và tiêu đề, cooldown 20 giây.
- [x] Phân quyền Đội hình đề cử: Tác giả được sửa/xóa đội hình của mình; Admin/Staff có quyền quản trị toàn bộ.
- [x] Chuẩn hóa bảng so sánh chỉ số hiển thị huy hiệu song hệ (Dual-Element) đẹp mắt cho 13 Aniimo đặc biệt.
- [x] Khắc phục responsive tablet (681px - 920px), menu điều hướng di động hiển thị mượt mà không bị tràn khung.

---

## 🚀 P0 — Cấu hình bắt buộc khi Triển khai Production (Go-Live)

Các bước kiểm tra cấu hình thực tế trước khi mở cổng dịch vụ cho khách hàng:

### 1. Cổng thanh toán SePay & VietQR
- [ ] Điền thông tin SePay thật vào file `.env`: `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`.
- [ ] Cấu hình Webhook trên trang quản trị SePay trỏ về endpoint HTTPS: `https://<domain>/api/payments/webhook`.
- [ ] Thực hiện 1 giao dịch thử nghiệm giá trị nhỏ (10.000đ) để xác nhận: Quét mã QR -> Tiền vào tài khoản -> Webhook bắn về -> Đơn hàng tự động chuyển sang `PROCESSING`.

### 2. Dịch vụ Gửi Mail OTP (SMTP)
- [ ] Điền thông tin máy chủ SMTP thật: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- [ ] Thử nghiệm đăng ký tài khoản mới và luồng quên mật khẩu để xác nhận email OTP gửi đến hộp thư thành công.

### 3. Thông báo Telegram Bot
- [ ] Tạo bot Telegram qua `@BotFather`, lấy `TELEGRAM_BOT_TOKEN`.
- [ ] Thêm bot vào nhóm quản trị, lấy `TELEGRAM_CHAT_ID` và điền vào file `.env`.
- [ ] Xác nhận bot bắn tin nhắn thông báo khi có đơn hàng mới phát sinh.

### 4. Bảo mật Môi trường & Khóa Bí Mật
- [ ] Tạo chuỗi ngẫu nhiên dài >= 64 ký tự cho `JWT_SECRET`.
- [ ] Tạo chuỗi ngẫu nhiên dài >= 32 ký tự cho `COOKIE_SECRET`.
- [ ] Tạo chuỗi ngẫu nhiên dài >= 32 ký tự cho `DATA_ENCRYPTION_KEY`.
- [ ] Đổi mật khẩu tài khoản quản trị mặc định (`admin@duke1305.vn`).
- [ ] Cấu hình chứng chỉ SSL/TLS (HTTPS) thông qua Nginx / Cloudflare.

---

## 🗺️ P1 — Nâng cấp Trải nghiệm Bách Khoa Aniimo (Wiki Enhancements)

- [ ] **Đồng bộ ghim bản đồ lên tài khoản:** Hỗ trợ lưu trữ các mốc ghim "Đã thu thập" (Collected) lên server theo tài khoản người dùng thay vì chỉ lưu `localStorage`.
- [ ] **Lộ trình cày cuốc (Farming Routes):** Vẽ đường đi mẫu hỗ trợ người chơi mới thu thập tài nguyên và hòm kho báu nhanh trên bản đồ tương tác.
- [ ] **Bộ lọc nhanh trên Team Builder:** Bổ sung lọc Aniimo theo Tier (S+, S, A, B), vai trò chính và thuộc tính để chọn tướng vào đội hình tiện lợi hơn.
- [ ] **Biểu đồ Radar so sánh chỉ số:** Hiển thị biểu đồ radar (Spider Chart) so sánh trực quan HP, ATK, BREAK, PDEF, MDEF, REGEN giữa 2 Aniimo.
- [ ] **Chia sẻ đội hình qua liên kết rút gọn:** Hỗ trợ tạo link chia sẻ trực tiếp (hoặc short code) để gửi đội hình ra các nền tảng mạng xã hội.

---

## 🛒 P2 — Nâng cấp Trải nghiệm Nạp Game & Quản trị Nâng cao

- [ ] **Màn hình Chúc mừng sau Thanh toán:** Khi Webhook SePay ghi nhận thanh toán thành công, hiển thị modal hiệu ứng chúc mừng kèm nút xem tiến độ nạp thay vì chỉ đổi nhãn.
- [ ] **Tìm kiếm & Phân loại Lịch sử đơn hàng:** Thêm thanh tìm kiếm và bộ lọc trạng thái (Đã hoàn thành / Đang xử lý / Chờ thanh toán) trong tab Lịch sử tài khoản.
- [ ] **Xuất báo cáo Doanh thu (Excel / CSV):** Cho phép Admin xuất danh sách đơn hàng và thống kê doanh thu theo ngày/tháng ra file Excel/CSV.
- [ ] **Thông báo Broadcast toàn hệ thống:** Tính năng gửi thông báo nổi (Announcement popup) từ Admin đến toàn bộ người dùng đang online.
- [ ] **Chính sách mật khẩu nâng cao (A05):** Nâng mức tối thiểu lên 8-12 ký tự cho tài khoản mới kèm đánh giá độ mạnh mật khẩu (zxcvbn).
- [ ] **Code Splitting tối ưu dung lượng Wiki (A09):** Tiếp tục tách nhỏ các chunk thư viện lớn (`LibraryPage`, `map_key_markers`) để tăng tốc độ tải trang trên thiết bị di động mạng yếu.
