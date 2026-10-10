# Kế hoạch Hoàn thiện & Danh mục Công việc (TODO) - DUKE1305

> Cập nhật lần cuối: **10/10/2026** — Toàn bộ hệ thống Game Recharge Storefront, Admin Portal, Backend API và Aniimo Wiki đã được kiểm tra, biên dịch và chạy test thành công (Backend 59/59 tests pass, Frontend Vite build 0 lỗi).

---

## 🏆 Các hạng mục vừa hoàn thành & kiểm thử ổn định (Recently Completed)

- [x] **Áp dụng Migration CSDL & Đồng bộ Prisma Client**:
  - Triển khai migration `20261010120000_checkout_ownership` (bảo vệ quyền sở hữu checkout theo userId & hash payload).
  - Triển khai migration `20261010121000_wiki_content` (bảng `wiki_entries` và `wiki_votes` với PostgreSQL advisory locks).
  - Khắc phục xung đột file khóa DLL trên Windows, tạo mới Prisma client (`@prisma/client`) với đầy đủ kiểu dữ liệu.
- [x] **Cập nhật Quản Trị Wiki (`AdminWikiManager`) qua REST API**:
  - Thay thế hàm lưu trữ cục bộ cũ `saveWikiOverrides` bằng các API endpoint bảo mật: `saveGiftcode`, `deleteGiftcode`, `saveAniimo`.
  - Hỗ trợ lưu trữ trực tiếp vào CSDL PostgreSQL, tự động phát sự kiện cập nhật thời gian thực trên toàn trang.
- [x] **Bảo Mật Đăng Xuất (`AppStore.logout`)**:
  - Đảm bảo gọi `api.auth.logout()` độc lập để luôn xóa sạch cookie phiên httpOnly trên server, kèm bộ bắt lỗi mạng dự phòng.
- [x] **Tối Ưu SEO Toàn Diện cho 11 Đường Dẫn Wiki (`Seo.tsx`)**:
  - Bổ sung thẻ tiêu đề, mô tả và cấu trúc Schema.org chuẩn cho `/wiki/giftcode`, `/wiki/list`, `/wiki/so-sanh`, `/wiki/tier-list`, `/wiki/map`, `/wiki/build`, `/wiki/teams`, `/wiki/thu-vien`, `/wiki/huong-dan`.
- [x] **Khắc Phục Khoảng Trống Responsive Trên Tablet (681px - 920px)**:
  - Đồng bộ điểm ngắt hiển thị thanh điều hướng di động (`.mobile-nav`) ở mốc 920px và thêm đệm chân trang an toàn (`padding-bottom`), khắc phục tình trạng mất hoàn toàn menu điều hướng trên màn hình máy tính bảng.
- [x] **Chuẩn hóa cột "HỆ" trong Bảng So Sánh Chỉ Số (Stats Comparison)**:
  - Sửa lỗi vỡ giao diện inline box khiến icon và chữ bị tách thành 3 hàng dọc.
  - Áp dụng badge `inline-flex`, hiển thị liền khối với icon `14px` và tên hệ.
  - Hỗ trợ hiển thị đầy đủ cả 2 hệ đối với 13 Aniimo có song hệ (ví dụ: *Inferlupa* có Dark & Fire).
- [x] **Cơ chế chống spam & chống trùng lặp Đội hình (Team Builder)**:
  - Giới hạn thời gian đăng bài (cooldown 20 giây giữa các lần đăng).
  - Kiểm tra bắt buộc phải đủ 4 Aniimo mới được chia sẻ lên cộng đồng.
  - Chống đăng trùng đội hình (so sánh tổ hợp 4 Aniimo đã tồn tại).
  - Chống đăng trùng tiêu đề đội hình.
- [x] **Phân quyền Quản lý Đội hình Đề cử (Recommended Teams RBAC)**:
  - Tác giả được quyền chỉnh sửa (`✏️ Sửa`) và xóa (`🗑️ Xóa`) đội hình của chính mình.
  - Tài khoản Admin / Staff có toàn quyền chỉnh sửa và xóa mọi đội hình vi phạm.
  - Tích hợp nạp đội hình trực tiếp vào Team Builder để chỉnh sửa.
- [x] **Khắc phục tài khoản kiểm thử khách hàng**:
  - Cập nhật tài khoản `customer@test.com` với mật khẩu `123456` (bcrypt cost 12 chuẩn).
  - Bổ sung cấu hình seed tài khoản khách hàng mặc định vào `prisma/seed.ts`.
- [x] **Nâng cấp Bản Đồ Tương Tác Aniimo (World Map Page)**:
  - Khắc phục lỗi cuộn chuột: Ngăn chặn cuộn trang web ngoài khi phóng to/thu nhỏ trên bản đồ (`passive: false` wheel listener).
  - Mặc định mở thanh chọn lớp ghim (Lớp Ghim Drawer) nhưng chưa kích hoạt ghim để tránh giật lag khi tải lần đầu.
  - Tích hợp 8 khu vực hang ngầm (Underground Cavern Boundaries) chi tiết với chế độ xem riêng biệt.
  - Lưu trạng thái các điểm đã nhặt (Collected pins) vào bộ nhớ cục bộ `localStorage`.
- [x] **Đồng bộ thương hiệu DUKE1305 toàn diện**:
  - Loại bỏ hoàn toàn các chuỗi thương hiệu cũ trên toàn bộ hệ thống.
  - Chuẩn hóa bộ lọc chống rò rỉ tên cũ trong Storefront và Wiki.

---

## 🚀 P0 — Cấu hình bắt buộc khi Triển khai Production (Go-Live)

### 1. Tích hợp thanh toán SePay thật
- [ ] Đăng ký tài khoản SePay chính thức và liên kết tài khoản ngân hàng thực tế của cửa hàng.
- [ ] Cấu hình biến môi trường server: `SEPAY_API_KEY`, `SEPAY_BANK_CODE`, `SEPAY_ACCOUNT_NUMBER`, `SEPAY_ACCOUNT_NAME`.
- [ ] Cấu hình Webhook SePay trỏ về endpoint HTTPS công khai: `https://<domain>/api/payments/webhook`.
- [ ] Thực hiện giao dịch thử nghiệm giá trị nhỏ (1.000đ - 10.000đ) để xác nhận: tiền vào tài khoản -> SePay kích hoạt webhook -> đơn hàng tự động chuyển sang `PROCESSING` (Đang xử lý).

### 2. Dịch vụ Email SMTP cho mã OTP
- [ ] Đăng ký dịch vụ email chuyên nghiệp (Resend, Brevo, AWS SES hoặc Gmail App Password).
- [ ] Cập nhật biến môi trường: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, `MAIL_FROM`.
- [ ] Kiểm thử luồng gửi email mã OTP đăng ký và quên mật khẩu trên hộp thư thực tế.

### 3. Vận hành, Bảo mật & Sao lưu
- [ ] Đổi mật khẩu tài khoản quản trị mặc định (`admin@duke1305.vn`) trên môi trường production.
- [ ] Thiết lập cronjob / task scheduler sao lưu cơ sở dữ liệu định kỳ (sử dụng `backend/scripts/backup.ps1` hoặc `pg_dump`).
- [ ] Đồng bộ bản backup lên lưu trữ đám mây an toàn (S3 / Google Drive / Cloud Storage).
- [ ] Thiết lập chứng chỉ SSL (HTTPS) và cấu hình tường lửa (WAF/Cloudflare) trước domain chính thức.

---

## 🗺️ P1 — Nâng cấp Trải nghiệm Bản Đồ & Bách Khoa Aniimo (Wiki Enhancements)

### 1. Nâng cấp Dữ liệu Bản đồ tương tác (Tham khảo donneeee/MinMax-Aniipedia)
- [ ] Mở rộng dữ liệu tọa độ ghim bản đồ từ nguồn mã nguồn mở MinMax-Aniipedia: bổ sung thêm các điểm hòm ẩn, hoa cỏ nguyên liệu hiếm, và vị trí boss theo thời gian thực.
- [ ] Hỗ trợ đồng bộ điểm ghim "Đã thu thập" (Collected) lên tài khoản người dùng trên máy chủ (thay vì chỉ lưu `localStorage`).
- [ ] Thêm tính năng "Lộ trình cày cuốc" (Farming Route Guide) vẽ đường đi mẫu trên bản đồ để hỗ trợ người chơi mới thu thập tài nguyên nhanh.

### 2. Bách khoa & Công cụ xây dựng đội hình (Team Builder & Pokedex)
- [ ] Bổ sung bộ lọc nhanh trên Team Builder: cho phép lọc Aniimo theo Tier (S+, S, A, B), theo vai trò chính và thuộc tính để chọn tướng vào đội hình nhanh hơn.
- [ ] Bổ sung tính năng So sánh trực quan 2 Aniimo (Side-by-Side Compare) với biểu đồ Radar (Radar/Spider Chart) thể hiện rõ tương quan HP, ATK, BREAK, PDEF, MDEF, REGEN.
- [ ] Thêm tính năng chia sẻ đội hình bằng liên kết trực tiếp (Share via Link hoặc mã Base64 / Short Code) để người dùng gửi cho nhau ngoài trang web.

---

## 🛒 P2 — Nâng cấp Trải nghiệm Nạp Game & Quản trị (Storefront & Admin)

### 1. Trải nghiệm Nạp game (Customer Checkout UX)
- [ ] Khi Webhook SePay xác nhận thanh toán thành công (`paymentStatus === "PAID"`), hiển thị màn hình chúc mừng / modal thông báo "Thanh toán thành công" kèm mã đơn và nút chuyển nhanh về trang "Xem tiến độ nạp game" thay vì chỉ đổi nhãn trạng thái.
- [ ] Thêm thanh tìm kiếm và lọc theo trạng thái (Hoàn thành / Đang xử lý / Chờ thanh toán) trong tab "Lịch sử giao dịch" của trang Cá nhân khi danh sách đơn hàng nhiều.
- [ ] Gửi email tự động thông báo đơn hàng thành công kèm chi tiết nạp game khi Admin duyệt hoàn tất (`COMPLETED`).

### 2. Tính năng Quản trị (Admin Panel)
- [ ] Xuất báo cáo danh sách đơn hàng và doanh thu theo ngày/tháng ra file Excel / CSV.
- [ ] Tích hợp tính năng gửi thông báo hệ thống (Notification broadcast) từ Admin đến toàn bộ người dùng hoặc hiển thị popup thông báo bảo trì/khuyến mãi trên trang chủ.

---

## 🔮 P3 — Mở rộng Tính năng Nâng cao (Future Expansion)

- [ ] **Giỏ hàng nạp đa game**: Hỗ trợ người dùng chọn mua cùng lúc nhiều gói nạp của các game khác nhau trong 1 đơn hàng (tách mô hình `Order` và `OrderItem`).
- [ ] **Tích hợp API đối tác nạp game tự động**: Tích hợp với nhà cung cấp API nạp tự động (như SmileOne, Razer Gold...) để tự động trả đá/nạp game vào UID người chơi ngay khi thanh toán thành công mà không cần nhân viên thao tác tay.
