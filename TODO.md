# TODO sản phẩm và production

## P0 — bắt buộc trước khi nhận tiền thật

### Thanh toán VietQR

- [x] Đảm bảo checkout nhiều package là atomic, không tạo order dở dang.
- [x] Sinh mã tham chiếu thanh toán duy nhất cho mỗi lần checkout.
- [x] Sinh QR VietQR động theo số tiền và mã tham chiếu.
- [x] Lưu trạng thái thanh toán riêng với trạng thái xử lý đơn hàng.
- [x] Thêm endpoint nhận webhook và kiểm tra giao dịch tiền vào.
- [x] Đối chiếu webhook theo mã tham chiếu và tổng số tiền.
- [ ] Tạo tài khoản SePay production và liên kết đúng tài khoản ngân hàng.
- [ ] Cấu hình `SEPAY_API_KEY`, ngân hàng, số tài khoản và tên tài khoản trên server.
- [ ] Cấu hình webhook SePay bằng HTTPS công khai tại `/api/payments/webhook`.
- [ ] Kiểm thử giao dịch thật giá trị nhỏ: đúng tiền, thiếu tiền, thừa tiền, sai nội dung.
- [ ] Thêm chống xử lý trùng bằng mã giao dịch ngân hàng (`referenceCode`/transaction ID) duy nhất.
- [x] Tự động chuyển order chưa thanh toán quá 15 phút sang `EXPIRED`.
- [ ] Thêm trang kết quả thanh toán có mã order, số tiền, trạng thái và hướng dẫn tra cứu.
- [ ] Có nút xác nhận thủ công cho admin khi webhook bị gián đoạn.
- [ ] Không đánh dấu `COMPLETED` chỉ vì đã thanh toán; chỉ hoàn tất sau khi nạp game thành công.

### Bảo mật và độ tin cậy

- [x] Thêm idempotency key cho checkout để retry mạng không tạo order trùng.
- [x] Giới hạn rate limit riêng cho webhook và endpoint xem trạng thái thanh toán.
- [x] Không ghi API key, cookie, UID hoặc dữ liệu thanh toán nhạy cảm vào log.
- [x] Thêm request ID, log có cấu trúc và cảnh báo order pending/processing quá lâu.
- [x] Thêm script sao lưu database và khôi phục database bằng `pg_dump`/`pg_restore`.
- [ ] Thiết lập lịch backup tự động, lưu bản backup ngoài máy chủ và kiểm tra restore định kỳ.
- [ ] Cấu hình SMTP production (Brevo/Resend/Amazon SES), xác minh domain và kiểm thử nhận OTP.

## P1 — quyền hạn, dữ liệu và vận hành

### Phân quyền quản trị

- [x] Loại bỏ role STAFF; hệ thống hiện chỉ dùng CUSTOMER và ADMIN.
- [x] Enforce toàn bộ quyền ở backend, không chỉ ẩn nút trên frontend.
- [x] Bắt buộc đăng nhập trước khi tạo checkout/đơn hàng.
- [x] Giới hạn xem trạng thái thanh toán theo chủ đơn hoặc ADMIN.
- [x] Cấu hình CORS cho `Idempotency-Key` và `X-Request-Id`.
- [x] Cấu hình SameSite/domain cookie qua biến môi trường.
- [x] Thêm audit log cho thay đổi catalog, user, settings và trạng thái transaction.

### Catalog và nội dung

- [x] Thêm ảnh và vị trí ảnh riêng cho từng package trong database, API và admin editor.
- [x] Hoàn thiện chỉnh sửa service/game: tên, mô tả, ảnh, tone, active và sort order.
- [x] Persist categories/tags ở backend thay vì chỉ lưu frontend state/localStorage.
- [x] Lưu và validate đầy đủ schema cho contact và middleman content.

### Tài khoản

- [x] Thêm endpoint đổi mật khẩu và kết nối form tài khoản/admin.
- [x] Thu hồi session/token cũ sau khi đổi mật khẩu bằng `tokenVersion`.
- [x] Hoàn thiện email OTP 6 số khi đăng ký, có thời hạn và giới hạn thử.
- [x] Thêm email OTP reset password; email order/thanh toán vẫn chưa tích hợp.

## P1 — kiểm thử bắt buộc

- [ ] Viết API tests cho đăng ký, đăng nhập, session, block user và logout.
- [ ] Viết API tests cho phân quyền CUSTOMER/ADMIN.
- [ ] Viết API tests cho catalog CRUD và chỉ hiển thị dữ liệu active.
- [ ] Viết API tests cho checkout một package và nhiều package.
- [ ] Kiểm thử rollback khi một item trong checkout lỗi.
- [ ] Kiểm thử webhook hợp lệ, sai API key, sai mã, sai số tiền và gửi lặp.
- [ ] Kiểm thử rate limit cho auth, orders, admin và webhook.
- [ ] Thiết lập database test riêng và chạy test trong CI.
- [ ] Thực hiện checklist kiểm thử trong `TESTING-CHECKLIST.md` và lưu báo cáo lỗi/nghiệm thu.

## P2 — nâng cấp mô hình đơn hàng

- [ ] Cân nhắc tách `Order`, `OrderItem`, `Payment` và `Fulfillment` khi có nhiều phương thức thanh toán.
- [x] Tạm thời giới hạn giỏ hàng cùng game và cùng template nạp.
- [ ] Thêm tra cứu order cho guest bằng mã order + email.
- [ ] Thêm cơ chế retry fulfillment sau khi thanh toán thành công.
- [ ] Thêm xử lý hoàn tiền và đối soát giao dịch.

## Đã triển khai trong phạm vi hiện tại

- [x] Auth JWT bằng HttpOnly cookie, bcrypt và block user.
- [x] Validation request bằng Zod.
- [x] Rate limit cho auth, API, admin và orders.
- [x] SePay VietQR động và webhook API key ở mức tích hợp ban đầu.
- [x] Frontend polling trạng thái thanh toán.
- [x] Email OTP 6 số cho đăng ký và quên mật khẩu; lưu hash, hết hạn 10 phút, tối đa 5 lần thử.
- [x] Đồng bộ validation mật khẩu và hiển thị chi tiết lỗi từ backend.

> Không chuyển các mục thanh toán sang trạng thái hoàn tất production cho đến khi đã cấu hình webhook HTTPS, chạy giao dịch thật giá trị nhỏ và kiểm thử đầy đủ.
