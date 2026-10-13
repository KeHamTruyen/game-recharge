# Backend Integration & Service Contracts

Giao diện người dùng (Frontend) tương tác với Backend API thông qua domain types tại `src/domain/models.ts` và tầng dịch vụ `src/services/api.ts` (kế thừa wrapper `HttpClient` tại `src/services/http-client.ts`).

Mọi endpoint được cấu hình tiền tố qua biến môi trường `VITE_API_URL` (mặc định là `/api` trên môi trường cùng domain hoặc reverse proxy).

## Cấu trúc Tầng Dịch vụ (Services)

- `src/services/http-client.ts`: Wrapper fetch chuẩn hóa gửi kèm cookie phiên (`credentials: "include"`), header bảo vệ CSRF (`X-CSRF-Protection: "1"`), và xử lý phản hồi/lỗi JSON thống nhất.
- `src/services/api.ts`: Hiện thực hóa toàn bộ các API client:
  - `authApi`: Đăng nhập, đăng ký OTP, quên mật khẩu, phiên làm việc (`session`), đổi mật khẩu.
  - `catalogApi`: Lấy danh sách dịch vụ, gói nạp, trạng thái sản phẩm, mẫu form nạp (Topup Templates), cấu hình công khai.
  - `ordersApi`: Tạo đơn đơn lẻ, đặt hàng giỏ hàng (`checkout` có `idempotencyKey`), tra cứu lịch sử, lấy thông tin VietQR tiếp tục thanh toán, hủy đơn.
  - `adminApi`: Quản trị danh mục dịch vụ, gói nạp, mẫu nạp, trạng thái sản phẩm, tags, upload ảnh WebP, tra cứu giao dịch kèm giải mã thông tin nạp, cập nhật trạng thái đơn & hoàn tiền, đối soát bất thường thanh toán, tài khoản người dùng, cấu hình hệ thống & công tắc bảo trì.
  - `wikiApi`: Đội hình (Teams), giftcode, bình chọn mã quà tặng, tra cứu wiki.

## Danh mục Endpoints Thực tế (REST API)

Tất cả các route dưới đây nằm dưới tiền tố `/api` (ví dụ: `/api/auth/login`):

```text
# Xác thực (Auth)
POST   /auth/login
POST   /auth/register
POST   /auth/register/verify
POST   /auth/forgot-password
POST   /auth/reset-password
POST   /auth/logout
GET    /auth/session
PUT    /auth/profile
POST   /auth/change-password

# Danh mục (Catalog)
GET    /catalog/services
GET    /catalog/services/:id
GET    /catalog/packages/:id
GET    /catalog/product-statuses
GET    /catalog/tags
GET    /catalog/topup-templates
GET    /catalog/settings/:key

# Đơn hàng & Thanh toán (Orders & Payments)
POST   /orders
POST   /orders/checkout
GET    /orders/mine
GET    /orders/:code
GET    /orders/:code/payment
POST   /orders/:code/cancel
GET    /payments/status/:orderCode
POST   /payments/webhook

# Quản trị (Admin) — Quyền ADMIN
GET|POST          /admin/services
GET|PUT|DELETE    /admin/services/:id
GET|POST          /admin/packages
GET|PUT|DELETE    /admin/packages/:id
GET|POST|DELETE   /admin/tags
GET|POST          /admin/product-statuses
DELETE            /admin/product-statuses/:id
GET|POST          /admin/topup-templates
PUT|DELETE        /admin/topup-templates/:id
GET               /admin/transactions
GET               /admin/transactions/:id
PATCH             /admin/transactions/:id/status
GET               /admin/payment-anomalies
PATCH             /admin/payment-anomalies/:id/resolve
GET               /admin/audit-logs
GET|PATCH         /admin/users[/:id]
GET|PUT           /admin/settings/:key
POST              /admin/upload
GET               /admin/media

# Wiki & Cộng đồng (Wiki)
GET               /wiki
POST|PUT|DELETE   /wiki/teams[/:id]
POST|PUT|DELETE   /wiki/giftcodes[/:id]
POST              /wiki/giftcodes/:id/vote
PUT               /wiki/aniimos/:id
```

## Phân quyền & Bảo mật

1. **Phiên làm việc (Session):** Xác thực thông qua cookie HttpOnly `auth_token`. Phân quyền dựa trên trường `role` trong CSDL (`CUSTOMER` hoặc `ADMIN`), không dựa vào email hay claim client-side.
2. **CSRF & Origin:** Mọi mutation request (`POST`, `PUT`, `PATCH`, `DELETE`) bắt buộc có header `X-CSRF-Protection: 1` và nằm trong danh sách `CORS_ORIGIN` được phép.
3. **Mã hóa thông tin nạp:** Mật khẩu/thông tin nhạy cảm của khách hàng được mã hóa AES-256-GCM. Phía client luôn nhận giá trị ẩn (`••••••••`); chỉ tài khoản quản trị `ADMIN` mới có thể xem thông tin giải mã khi tra cứu chi tiết đơn.
