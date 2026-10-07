# Danh sách công việc cần hoàn thiện (TODO)

> Toàn bộ các hạng mục đã hoàn thành trước đó đã được loại bỏ để tập trung vào các công việc còn lại cho giai đoạn Go-Live và nâng cấp.

---

## 🚀 P0 — Cấu hình bắt buộc khi triển khai Production (Go-Live)

### 1. Tích hợp thanh toán SePay thật
- [ ] Đăng ký tài khoản SePay chính thức và liên kết tài khoản ngân hàng thật của cửa hàng.
- [ ] Cập nhật biến môi trường trên server: `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`.
- [ ] Cấu hình Webhook SePay trỏ về endpoint HTTPS công khai: `https://<domain>/api/payments/webhook`.
- [ ] Chạy kiểm thử giao dịch thật giá trị nhỏ (1.000đ - 10.000đ) để xác nhận: tiền vào tài khoản -> SePay bắn webhook -> đơn hàng tự động chuyển sang `PROCESSING` (Đang xử lý).

### 2. Dịch vụ Email SMTP cho mã OTP
- [ ] Đăng ký dịch vụ gửi email chuyên nghiệp (Resend, Brevo, AWS SES hoặc Gmail App Password).
- [ ] Cập nhật biến môi trường trên server: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- [ ] Kiểm thử luồng gửi email mã OTP đăng ký và quên mật khẩu trên hộp thư thực tế.

### 3. Vận hành & Sao lưu dữ liệu
- [ ] Cấu hình tự động hóa backup database định kỳ (sử dụng script `backend/scripts/backup.ps1` hoặc cron job `pg_dump` trên Linux).
- [ ] Lưu trữ bản backup ra ngoài máy chủ (Google Drive, Cloud Storage, S3).
- [ ] Đổi mật khẩu tài khoản quản trị mặc định (`admin@duke1305.vn`) trên production.

---

## 🎨 P1 — Nâng cấp Trải nghiệm Người dùng (Customer UX)

### 1. Màn hình kết quả sau khi thanh toán thành công
- [ ] Khi Webhook xác nhận tiền vào (`paymentStatus === "PAID"`), hiển thị màn hình chúc mừng / modal thông báo "Thanh toán thành công" kèm mã đơn và nút chuyển nhanh về trang "Xem tiến độ nạp game" thay vì chỉ đổi nhãn trạng thái.

### 2. Thông báo & Tra cứu đơn hàng
- [ ] Gửi email tự động thông báo đơn hàng thành công kèm chi tiết nạp game khi Admin duyệt hoàn tất (`COMPLETED`).
- [ ] Thêm thanh tìm kiếm và lọc theo trạng thái (Hoàn thành / Đang xử lý / Chờ thanh toán) trong tab "Lịch sử giao dịch" của trang Cá nhân khi danh sách đơn hàng nhiều.

---

## 🛠️ P2 — Nâng cấp Tính năng Quản trị (Admin Panel)

### Báo cáo & Thống kê
- [ ] Xuất báo cáo danh sách đơn hàng và doanh thu theo ngày/tháng ra file Excel / CSV.

---

## 🔮 P3 — Mở rộng Kiến trúc trong tương lai

- [ ] Hỗ trợ giỏ hàng đa game (mua cùng lúc gói của nhiều game khác nhau) bằng cách tách mô hình `Order` và `OrderItem`.
- [ ] Tích hợp API đối tác nạp game tự động (nếu có đối tác API như SmileOne, Razer Gold...) để tự động trả đá/nạp game vào UID mà không cần thao tác thủ công.
