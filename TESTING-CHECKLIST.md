# Checklist kiểm thử NEXA TOPUP

Tài liệu này dùng để giao cho người kiểm thử hệ thống trước khi demo hoặc bàn giao khách hàng.

## 1. Phạm vi và môi trường

- Dùng database test riêng, không chạy test phá dữ liệu production.
- Dùng Mailtrap, Brevo test account hoặc email test riêng.
- Nếu test thanh toán thật, chỉ dùng giao dịch giá trị nhỏ.
- Hệ thống hiện chỉ có hai role: `CUSTOMER` và `ADMIN`. Không kiểm thử role `STAFF`.
- Kiểm thử cả API trực tiếp và giao diện frontend.

## 2. Đăng ký và OTP email

### AUTH-001 — Đăng ký hợp lệ

1. Nhập tên hợp lệ, email chưa tồn tại và mật khẩu hợp lệ.
2. Gửi form đăng ký.

Mong đợi:

- Tài khoản chưa được tạo trước khi xác minh.
- Email chứa mã OTP đúng 6 chữ số được gửi.
- OTP có hiệu lực 10 phút.
- Giao diện chuyển sang bước nhập OTP.

### AUTH-002 — Xác minh OTP đúng

- Nhập đúng OTP.
- Tài khoản được tạo với role `CUSTOMER`.
- User được đăng nhập tự động.
- Cookie auth được tạo với thuộc tính HttpOnly.
- Có thể truy cập trang tài khoản.

### AUTH-003 — OTP sai/hết hạn

- Nhập mã sai: không tạo tài khoản, số lần thử tăng.
- Nhập sai từ 5 lần: mã bị vô hiệu hóa.
- Nhập mã sau 10 phút: bị từ chối.
- Không thể dùng lại OTP đã xác minh.

### AUTH-004 — Email đã tồn tại

- Không tạo tài khoản trùng.
- Không ghi đè tài khoản cũ.
- Không tạo dữ liệu OTP rác không cần thiết.

### AUTH-005 — Validation đăng ký

Kiểm tra tên rỗng/quá dài, email sai định dạng, mật khẩu dưới 6 ký tự hoặc vượt 72 ký tự.

Mong đợi: request bị từ chối và không gửi email.

## 3. Đăng nhập, đăng xuất và session

- Đăng nhập đúng: tạo session và vào đúng khu vực.
- Sai email/mật khẩu: trả lỗi, không tạo session.
- User bị `BLOCKED`: không đăng nhập được.
- Đăng xuất: cookie bị xóa và API riêng tư trả `401`.
- Cookie/JWT bị sửa hoặc hết hạn: trả `401`, cookie không hợp lệ bị xóa.
- User đã bị xóa hoặc block sau khi cấp token: session không còn hiệu lực.

## 4. Ma trận phân quyền

### CUSTOMER được phép

- Xem catalog, tags và settings public.
- Đăng nhập/đăng xuất.
- Tạo đơn và checkout.
- Xem đơn của chính mình.
- Xem payment status của đơn của chính mình.

### CUSTOMER không được phép

- Gọi API admin.
- Xem user hoặc transaction của người khác.
- Tạo/sửa/xóa service, package, tag, template, settings.
- Xem audit log.
- Tự gửi `userId`, `role`, `status`, `paymentStatus` để nâng quyền.

### ADMIN được phép

- Quản lý service/game, package, tags, status, template và settings.
- Xem user và toàn bộ transaction.
- Cập nhật transaction theo quyền quản trị.
- Xem payment status của mọi đơn.

### Kiểm thử quyền bắt buộc

- Chưa đăng nhập gọi `/api/admin/*`: `401`.
- CUSTOMER gọi `/api/admin/*`: `403`, dữ liệu không thay đổi.
- CUSTOMER xem order code của người khác: `403` hoặc `404`, không lộ dữ liệu.
- CUSTOMER xem payment status của người khác: không trả trạng thái.
- Chưa đăng nhập gọi `POST /api/orders`: `401`.
- Chưa đăng nhập gọi `POST /api/orders/checkout`: `401`.

## 5. Catalog public

- Chỉ service/package `isActive = true` xuất hiện ở public API.
- Kết quả sắp xếp đúng theo `sortOrder`.
- Image, imagePosition, tags, giá và oldPrice trả đúng.
- Package có status không purchasable không được mua.
- Service inactive hoặc package inactive không thể checkout.
- Customer không thể tạo/xóa tag.
- Tag trùng, rỗng hoặc quá dài bị từ chối.

## 6. Tạo đơn và dữ liệu topup

- Customer tạo order hợp lệ: `userId` và `userEmail` lấy từ session backend.
- Gửi `userEmail` của người khác trong body không được ghi đè email session.
- Package không tồn tại: `404`, không tạo transaction.
- Quantity bằng 0, âm, thập phân hoặc vượt 100: bị từ chối.
- Thiếu field bắt buộc trong template: bị từ chối.
- Gửi field không tồn tại: bị từ chối.
- Sai pattern, email hoặc option select: bị từ chối.
- Quá 20 topup fields hoặc field/value quá dài: bị từ chối.
- Client không thể tự gửi `status = COMPLETED` hoặc `paymentStatus = PAID`.

## 7. Checkout atomic và idempotency

### CHECKOUT-001 — Một package

- Tạo đúng một transaction.
- Tổng tiền đúng bằng giá package nhân quantity.
- Payment order code duy nhất.
- QR có đúng ngân hàng, số tài khoản, số tiền và nội dung chuyển khoản.

### CHECKOUT-002 — Nhiều package

- Các transaction được tạo trong cùng luồng atomic.
- Một item lỗi thì toàn bộ checkout rollback.
- Không có transaction dở dang.
- Tổng tiền bằng tổng tất cả item.

### CHECKOUT-003 — Idempotency

- Gửi lại cùng `Idempotency-Key`: chỉ có một bộ transaction.
- Response retry giống response ban đầu.
- Không tạo QR hoặc payment order code mới.
- Key thiếu, dưới 16 hoặc trên 128 ký tự: `400`.
- Dùng cùng key cho payload khác: không được tạo đơn ngoài ý muốn; trả response cũ hoặc conflict rõ ràng.

## 8. SePay/VietQR và webhook

- QR dùng đúng bank code, account number, account name, amount và transfer content.
- Webhook đúng API key, `transferType = in`, đúng amount và đúng mã `NEXA`: chuyển `PAID` và `PROCESSING`.
- Không đánh dấu `COMPLETED` chỉ vì đã thanh toán.
- Sai API key: `401`, không cập nhật đơn, không log key.
- `transferType = out`: không cập nhật.
- Sai số tiền, thiếu tiền, thừa tiền hoặc số tiền bằng 0: không chuyển `PAID`.
- Sai mã order: không cập nhật.
- Gửi cùng `referenceCode` nhiều lần: không xử lý trùng, không cộng tiền hai lần.
- Webhook không trả dữ liệu nội bộ hoặc secret cho bên gửi.

## 9. Lịch sử và chi tiết đơn

- `GET /api/orders/mine` chỉ trả đơn của user hiện tại.
- Pagination, filter status và sort mới nhất hoạt động đúng.
- `GET /api/orders/:code` chỉ cho chủ đơn hoặc ADMIN.
- Mã không tồn tại trả lỗi phù hợp.
- Response không chứa passwordHash, API key, cookie, thông tin ngân hàng hoặc metadata nhạy cảm không cần thiết.

## 10. Admin CRUD

### Service/Game

- Tạo, sửa, xóa service.
- Sửa tên, game, mô tả, ảnh, imagePosition, tone, active và sortOrder.
- Tên rỗng, URL ảnh sai hoặc imagePosition sai bị từ chối.

### Package

- Tạo, sửa, xóa package.
- Sửa tên, giá, oldPrice, tags, status, template, ảnh, imagePosition, active và sortOrder.
- Giá không dương, serviceId không tồn tại hoặc dữ liệu sai bị từ chối.

### Settings

- Admin cập nhật được `contactInfo`, `middlemanInfo`, `siteConfig`.
- Dữ liệu thiếu, URL sai, platform sai, chuỗi vượt giới hạn hoặc fees sai cấu trúc bị từ chối.
- Public API chỉ trả settings được phép public.

## 11. Rate limit và bảo mật

Kiểm tra vượt giới hạn cho:

- `/api/auth/*`
- `/api/orders/*`
- `/api/admin/*`
- `/api/payments/status/*`
- `/api/payments/webhook`

Mong đợi:

- Trả `429`.
- Server không crash.
- Không bypass bằng header IP giả.
- CORS origin không hợp lệ bị chặn.
- Không bị SQL injection/XSS qua email, mã đơn, search, tên service, package, tags hoặc settings.
- Không lộ stack trace production.
- Không log password, cookie, token, OTP, API key, UID hoặc thông tin thanh toán nhạy cảm.

## 12. Audit log và request ID

Kiểm tra các thao tác admin tạo/sửa/xóa service, package, tag, settings và transaction.

Mong đợi:

- Có audit log với userId, action, method, path, statusCode và requestId.
- Response có header `X-Request-Id`.
- Khi lỗi, client nhận request ID để tra log.
- Audit metadata đã được sanitize.

## 13. Backup và restore

- Chạy backup và kiểm tra file không rỗng.
- Backup có users, services, packages, transactions, settings và OTP schema.
- Không commit backup có dữ liệu thật lên Git.
- Restore vào database test.
- Kiểm tra dữ liệu sau restore.
- Kiểm tra migration/schema vẫn tương thích.

## 14. Frontend và responsive

- Đăng ký hiển thị loading, lỗi validation, OTP sai và OTP thành công.
- Quên mật khẩu gửi OTP, nhập mã, đặt mật khẩu mới và đăng nhập lại được.
- User chưa đăng nhập không thể checkout.
- QR và trạng thái `PENDING`, `PAID`, `PROCESSING`, `COMPLETED`, `FAILED` hiển thị đúng.
- Retry và refresh không tạo đơn trùng.
- Kiểm tra desktop 1440px, laptop 1280px, tablet 768px, mobile 390px và mobile 360px.

## 15. Thứ tự ưu tiên

Nếu thời gian hạn chế, kiểm thử theo thứ tự:

1. Đăng nhập và phân quyền.
2. Chặn checkout khi chưa đăng nhập.
3. Tạo đơn một package.
4. Checkout nhiều package và rollback.
5. Idempotency.
6. Webhook SePay.
7. Sai tiền, sai mã và webhook lặp.
8. OTP đăng ký.
9. OTP quên mật khẩu.
10. Customer không xem đơn người khác.
11. Admin CRUD.
12. Backup/restore.
13. Rate limit và bảo mật.
14. Responsive frontend.

## 16. Tiêu chí nghiệm thu

Hệ thống chỉ đạt khi:

- Chưa đăng nhập không thể tạo đơn.
- CUSTOMER không thể gọi API admin hoặc xem đơn người khác.
- Đăng ký chỉ hoàn tất sau OTP đúng.
- OTP hết hạn và giới hạn số lần thử.
- Checkout lỗi rollback toàn bộ.
- Retry checkout không tạo đơn trùng.
- Webhook sai không cập nhật thanh toán.
- Webhook lặp không xử lý trùng.
- Sai số tiền không đánh dấu PAID.
- Không lộ secret hoặc dữ liệu nhạy cảm trong response/log.
- Backup và restore thành công trên database test.
- Frontend và backend build thành công.
- Không có lỗi nghiêm trọng trên mobile.

## 17. Báo cáo lỗi

Mỗi lỗi cần ghi:

- Mã test case.
- Môi trường và phiên bản build.
- Tài khoản/role sử dụng.
- Các bước tái hiện.
- Kết quả thực tế.
- Kết quả mong đợi.
- Request/response đã che secret.
- Screenshot hoặc log có request ID.
- Mức độ: Critical, High, Medium hoặc Low.
