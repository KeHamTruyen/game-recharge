# TODO bàn giao — DUKE1305

> Cập nhật **15/10/2026**. Telegram hiển thị đầy đủ thông tin nạp/mật khẩu theo yêu cầu; nội dung hàng đợi được mã hóa khi lưu và giải mã khi gửi. Đã chặn xử lý/hoàn thành đơn chưa thanh toán, chặn PAID về chưa thanh toán và chia tin dài thành nhiều phần. Migration dữ liệu bảo vệ cả hàng đợi cũ; local không còn bản ghi hàng đợi dạng rõ cần chuyển đổi. Các cổng nghiệm thu production bên dưới vẫn còn mở.

Đã chặn phản hồi/callback từ phiên cũ ghi dữ liệu riêng tư vào phiên mới, bỏ đăng nhập giả và dữ liệu mẫu tài khoản/giao dịch khỏi frontend. Bootstrap đặt lại mật khẩu admin đồng thời thu hồi token cũ. Có test hồi quy cho các thay đổi này.

## Tình trạng kiểm thử hiện tại

| Hạng mục kiểm thử | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm test --prefix backend` | **192/192 đạt** (27 suites, 15/10) | Schema riêng; thêm trạng thái thanh toán, mã hóa hàng đợi/migration cũ, lỗi giải mã và tin dài Unicode; kiểm chứng Telegram vẫn nhận mật khẩu rõ bằng mock |
| `npm run typecheck --prefix frontend` & `npm run build` | **Đạt 100%**, 0 lỗi TS | Dist biên dịch đầy đủ, prerender 13 route SEO tĩnh |
| `npm run test:e2e --prefix frontend` (Playwright) | **34/34 đạt** (15/10) | Thêm lỗi OTP đăng ký/reset hiển thị và hết lỗi sau xác minh lại thành công |
| Kiểm thử P1 & Concurrency | **100% đạt** | Khóa nguyên tử hủy đơn, hoàn tiền, resume payment, mã hóa số |
| Docker Compose & Network | **Đạt** | `migrate` đã gán `duke_network`, `MAIL_FROM` chuẩn RFC |
| Bootstrap production an toàn | **Đạt** | `dist/scripts/bootstrap.js` khởi tạo DB sạch |

---

## 1. Hạng mục tối ưu kỹ thuật còn mở (P2)

- [ ] **A13 — Tối ưu phân trang máy chủ vào giao diện:** Nối các hàm phân trang từ server (`admin.transactionsPaginated`, `admin.usersPaginated`, `orders.minePaginated`) vào các màn hình Storefront (Lịch sử đơn) và Admin (Danh sách đơn, Quản lý người dùng) cùng với bộ lọc/tìm kiếm server-side khi quy mô dữ liệu thực tế tăng cao. *(Hiện tại `allPages` đã bỏ trần 500, bảo toàn đầy đủ 100% dữ liệu không bị cắt).*
- [ ] **Theo dõi kiểm tra regex hợp lệ khi máy chủ quá tải:** Tiếp tục theo dõi độ trễ của sandbox VM fuzzing regex (hiện đặt timeout an toàn 35ms) khi CPU máy chủ chịu tải cao đồng thời, chưa thay đổi ngưỡng bảo vệ ReDoS hiện tại.

---

## 2. Cổng nghiệm thu môi trường thật trước bàn giao (Production Deployment Gates)

Các bước này cần thực hiện trực tiếp trên hạ tầng và tài khoản production thật:

- [x] **Brevo tại local:** Đã chạy luồng đăng ký/reset với SMTP thật; người dùng xác nhận nhận đủ 2 email ngày 15/10. CSDL thử đã dọn.
- [ ] **SePay & SMTP trên production:** Chạy thử giao dịch nhỏ thực tế và nhận OTP trên hạ tầng triển khai thật.
- [ ] **Telegram trên production:** Bot đã từng gửi thành công tại local theo xác nhận người dùng. Bản sửa mã hóa hàng đợi/chia tin dài được kiểm chứng bằng giả lập, chưa gửi thật lại sau sửa. Chạy service `migrate` trước API để bảo vệ dữ liệu hàng đợi cũ. Cần nghiệm thu sau khi deploy; mất phản hồi hoặc lỗi giữa các phần có thể làm tin gửi lại bị trùng.
- [ ] **Đổi secret & mật khẩu quản trị mẫu:** Thay đổi các biến `JWT_SECRET`, `COOKIE_SECRET`, `DATA_ENCRYPTION_KEY`, `ADMIN_PASSWORD` sang chuỗi bảo mật ngẫu nhiên mạnh theo chuẩn production; cấu hình đúng HTTPS, domain CORS và `TRUST_PROXY_HOPS` theo topology proxy thực tế.
- [ ] **Diễn tập sao lưu & khôi phục CSDL (Backup & Restore):** Chạy thử script backup định kỳ và diễn tập khôi phục trên CSDL staging để đảm bảo quy trình sẵn sàng khi có sự cố.
- [ ] **Chốt quy định nghiệp vụ đối soát tài chính:** Ban hành quy trình nội bộ hướng dẫn nhân viên CSKH/vận hành xử lý các trường hợp: khách chuyển thiếu/thừa/trùng tiền, tiền vào đơn đã hủy hoặc hết hạn, quy trình ghi nhận hoàn tiền qua giao diện Admin `PaymentAnomalyManager` và `RefundModal`.
- [ ] **Nghiệm thu trải nghiệm thực tế trên thiết bị:** Kiểm tra trực quan giao diện storefront và admin trên các dòng điện thoại (iOS, Android) và laptop/màn hình thực tế ngoài môi trường kiểm thử giả lập.

---

## 3. Tùy chọn nâng cao sau khi luồng bán hàng ổn định (P3)

Các tính năng tùy chọn mở rộng theo nhu cầu kinh doanh tương lai:

- [ ] **Bản đồ Aniimo:** Đồng bộ các mốc ghim bản đồ theo tài khoản người dùng đám mây; gợi ý lộ trình thu thập tài nguyên.
- [ ] **Đội hình (Team Builder):** Bổ sung bộ lọc đội hình theo tier/vai trò/nguyên tố; biểu đồ radar so sánh chỉ số; tạo link rút gọn chia sẻ đội hình mạng xã hội.
- [ ] **Báo cáo & Kế toán:** Bổ sung tìm kiếm nâng cao trong lịch sử khách; tính năng xuất dữ liệu giao dịch ra file CSV/Excel cho bộ phận kế toán.
- [ ] **Thông báo thanh toán:** Xây dựng màn hình/trang riêng thông báo thanh toán thành công chuyên biệt; tính năng broadcast thông báo hệ thống đến người dùng.

---

> **Lưu ý vận hành:** Không thao tác trực tiếp trên dữ liệu production khi chưa có backup. Luôn tuân thủ nguyên tắc bảo mật và không đưa thông tin nhạy cảm vào git.
