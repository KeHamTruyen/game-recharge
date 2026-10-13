# DUKE1305 — Nền tảng Nạp Game & Bách Khoa Toàn Thư Aniimo

Hệ thống thương mại điện tử chuyên biệt cho dịch vụ nạp game bản quyền và bách khoa toàn thư tương tác cộng đồng Aniimo, tích hợp cổng thanh toán VietQR tự động qua SePay, bảo mật đa tầng, quy trình đối soát & hoàn tiền chuẩn doanh nghiệp, cùng giao diện quản trị Admin toàn diện.

---

## 📑 Mục lục

1. [Tổng quan dự án](#-tổng-quan-dự-án)
2. [Kiến trúc & Công nghệ](#-kiến-trúc--công-nghệ)
3. [Cấu trúc thư mục](#-cấu-trúc-thư-mục)
4. [Tính năng cốt lõi](#-tính-năng-cốt-lõi)
   - [Bảo mật & Xác thực tài khoản](#1-bảo-mật--xác-thực-tài-khoản)
   - [Giỏ hàng & Thanh toán VietQR lũy thừa](#2-giỏ-hàng--thanh-toán-vietqr-lũy-thừa)
   - [Đối soát & Ghi nhận hoàn tiền](#3-đối-soát-thanh-toán--ghi-nhận-hoàn-tiền)
   - [Vận hành & Giám sát hệ thống](#4-vận-hành--giám-sát-hệ-thống)
   - [Bách khoa toàn thư Aniimo](#5-bách-khoa-toàn-thư-aniimo-interactive-wiki)
   - [Bảng điều khiển Quản trị (Admin Panel)](#6-bảng-điều-khiển-quản-trị-admin-panel)
5. [Biến môi trường (Environment Variables)](#-biến-môi-trường-environment-variables)
6. [Cài đặt & Chạy môi trường Local](#-cài-đặt--chạy-môi-trường-local)
7. [Kiểm thử tự động (Automated Testing)](#-kiểm-thử-tự-động-automated-testing)
8. [Triển khai Production với Docker](#-triển-khai-production-với-docker)
9. [Danh mục REST API Reference](#-danh-mục-rest-api-reference)

---

## 🌟 Tổng quan dự án

DUKE1305 được thiết kế nhằm đáp ứng cả nhu cầu trải nghiệm người dùng cuối (Storefront & Wiki) lẫn tính sẵn sàng vận hành thực tế (Production-ready):
- **Storefront Nạp Game:** Giao diện mua sắm mượt mà, hỗ trợ nạp đa dạng các tựa game (Genshin Impact, Honkai: Star Rail, Zenless Zone Zero, Wuthering Waves, Valorant...).
- **Tự động hóa thanh toán:** Tích hợp VietQR động, webhook SePay xử lý giao dịch tức thì, chống spam và chống thanh toán trùng lặp.
- **Vận hành an toàn:** Cơ chế khôi phục checkout khi mất mạng, xử lý lỗi cơ sở dữ liệu tạm thời (503) không làm mất phiên đăng nhập, hệ thống đối soát giao dịch bất thường (`PaymentAnomaly`) và quy trình hoàn tiền ghi nhận đầy đủ người duyệt, lý do, mã giao dịch ngân hàng.
- **Bách khoa toàn thư Aniimo:** Bản đồ tương tác 8 hang ngầm, xây dựng & chia sẻ đội hình với cơ chế chống đăng trùng lặp, bình chọn giftcode thời gian thực, so sánh chỉ số song hệ.

---

## 🛠 Kiến trúc & Công nghệ

### Frontend
- **Framework:** React 19 + TypeScript 5.7
- **Bundler & Tooling:** Vite 8, Rolldown / LightningCSS
- **Styling:** Tailwind CSS v4 (`@tailwindcss/vite`)
- **Routing:** React Router 7
- **End-to-End Testing:** Playwright

### Backend
- **Runtime & Framework:** Node.js 22 LTS, Express.js 4.21, TypeScript
- **ORM & CSDL:** Prisma ORM 5.22, PostgreSQL 14+ (chạy Postgres 16 trên Docker)
- **Bảo mật:**
  - Token JWT lưu trữ trong `HttpOnly`, `SameSite=Strict`, `Secure` Cookie.
  - Băm mật khẩu bcrypt chuẩn cost 12.
  - Mã hóa AES-256-GCM đối xứng (`DATA_ENCRYPTION_KEY`) bảo vệ thông tin tài khoản/mật khẩu nạp game tại tầng lưu trữ.
  - Helmet với chính sách CSP chặt chẽ, CORS whitelist nguồn truy cập.
  - Bộ giới hạn tần suất request (Rate Limiting) theo IP và theo phân hệ.
  - Xử lý Graceful Shutdown bắt tín hiệu `SIGTERM` / `SIGINT` đảm bảo đóng kết nối HTTP và database an toàn.
- **Tích hợp bên thứ ba:**
  - Cổng ngân hàng VietQR qua SePay Webhook.
  - Gửi mã OTP xác minh qua Nodemailer (SMTP).
  - Bắn thông báo đơn mới tức thời qua Telegram Bot API.

---

## 📂 Cấu trúc thư mục

```text
Game Recharge Website/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma              # Định nghĩa models CSDL & quan hệ
│   │   ├── migrations/                # Lịch sử migrations PostgreSQL
│   │   └── seed.ts                    # Dữ liệu khởi tạo (Admin, Dịch vụ, Gói nạp)
│   ├── src/
│   │   ├── config/
│   │   │   └── env.ts                 # Kiểm tra và parse biến môi trường bằng Zod
│   │   ├── lib/
│   │   │   └── prisma.ts              # Prisma Client singleton
│   │   ├── middleware/
│   │   │   ├── auth.ts                # Xác thực JWT cookie & phân quyền RBAC
│   │   │   ├── rateLimiter.ts         # Giới hạn tần suất request (Auth, API, Webhook)
│   │   │   └── errorHandler.ts        # Bộ xử lý lỗi tập trung, chuẩn hóa 400/413/500/503
│   │   ├── routes/
│   │   │   ├── auth.ts                # Đăng ký, OTP, đăng nhập, quên mật khẩu
│   │   │   ├── catalog.ts             # Dịch vụ, gói nạp, trạng thái, mẫu form
│   │   │   ├── orders.ts              # Tạo đơn, giỏ hàng checkout, lịch sử, tiếp tục thanh toán
│   │   │   ├── payments.ts            # Xử lý webhook SePay & phát hiện bất thường
│   │   │   ├── admin.ts               # CRUD danh mục, duyệt đơn, hoàn tiền, đối soát, audit log
│   │   │   └── wiki.ts                # Đội hình, giftcode, thông tin Aniimo & bình chọn
│   │   ├── utils/
│   │   │   ├── crypto.ts              # Mã hóa/giải mã AES-256-GCM & che thông tin nhạy cảm
│   │   │   ├── money.ts               # Xử lý số tiền an toàn, chống sai số dấu phẩy động
│   │   │   ├── telegram.ts            # Module bắn tin nhắn thông báo Telegram Bot
│   │   │   └── pagination.ts          # Chuẩn hóa phân trang danh sách
│   │   └── index.ts                   # Điểm khởi chạy Express server & graceful shutdown
│   ├── scripts/
│   │   ├── backup.mjs                 # Script sao lưu CSDL tự động (pg_dump)
│   │   ├── restore.mjs                # Script khôi phục CSDL an toàn (pg_restore)
│   │   ├── container-entrypoint.js    # Entrypoint Docker chuyển tiếp tín hiệu SIGTERM/SIGINT
│   │   ├── test.mjs                   # Runner chạy test trên schema CSDL độc lập
│   │   └── test-container-shutdown.mjs# Integration test kiểm tra dừng container an toàn
│   ├── tests/                         # Bộ 14 test suites kiểm thử toàn diện backend
│   ├── Dockerfile                     # Dockerfile tối ưu hóa bảo mật (không chứa npm trong runtime)
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── AppStore.tsx           # Context quản lý state giỏ hàng, auth, cache
│   │   │   ├── Router.tsx             # Điều hướng các trang storefront & admin
│   │   │   └── Seo.tsx                # Quản lý thẻ meta, canonical & structured data
│   │   ├── components/                # UI components tái sử dụng (Header, Footer, CartDrawer...)
│   │   ├── domain/
│   │   │   └── models.ts              # Định nghĩa TypeScript Domain Types
│   │   ├── features/
│   │   │   ├── storefront/            # Trang chủ, chi tiết gói nạp, giỏ hàng, nạp game
│   │   │   ├── admin/                 # Bảng điều khiển quản trị, đối soát, hoàn tiền, audit log
│   │   │   └── content/               # Bản đồ hang ngầm, Team builder, Giftcodes, Pokedex
│   │   ├── services/
│   │   │   ├── api.ts                 # Service gọi REST API backend
│   │   │   └── http-client.ts         # Wrapper fetch HTTP với xử lý credentials & lỗi
│   │   └── index.css                  # Cấu hình Tailwind CSS v4 & theme
│   ├── tests/                         # Bộ kiểm thử E2E Playwright
│   ├── Dockerfile                     # Multi-stage build Nginx Alpine phục vụ static file
│   └── package.json
├── docker-compose.yml                 # Orchestration Postgres + Backend + Frontend + Backup
├── .env.production.example            # Mẫu cấu hình môi trường chuẩn Production
└── README.md
```

---

## ⚡ Tính năng cốt lõi

### 1. Bảo mật & Xác thực tài khoản
- **JWT trong Cookie HttpOnly:** Không lưu JWT trong `localStorage` để triệt tiêu nguy cơ bị đánh cắp qua XSS. Hỗ trợ thuộc tính `SameSite=Strict` và cờ `Secure`.
- **Đăng ký & Quên mật khẩu qua OTP:**
  - Tạo mã OTP 6 chữ số ngẫu nhiên gửi qua SMTP.
  - Khóa nguyên tử (Atomic transaction lock) theo email + mục đích (`REGISTRATION` / `PASSWORD_RESET`).
  - Hết hạn sau 10 phút, tự động khóa sau 5 lần nhập sai, chống brute-force và replay attack.
- **Phân quyền RBAC:**
  - `CUSTOMER`: Mua hàng, xem lịch sử đơn của bản thân, bình chọn & đăng đội hình.
  - `STAFF`: Xem giao dịch, hỗ trợ khách hàng, vận hành xử lý đơn.
  - `ADMIN`: Toàn quyền quản trị danh mục, sửa template, cấu hình hệ thống, duyệt hoàn tiền, đối soát giao dịch bất thường, xem nhật ký Audit Log.
- **Mã hóa dữ liệu nhạy cảm (AES-256-GCM):**
  - Mọi trường nhạy cảm trong `topupInfo` (như mật khẩu tài khoản game) được mã hóa tại tầng CSDL với khóa `DATA_ENCRYPTION_KEY`.
  - Phản hồi trả về phía khách hàng tự động che (mask) trường nhạy cảm (`******`). Chỉ Admin/Staff mới có thể giải mã khi đơn đang ở trạng thái chờ xử lý.

### 2. Giỏ hàng & Thanh toán VietQR lũy thừa
- **Khóa chống trùng lặp (Idempotency Key):**
  - Khi khách hàng nhấn thanh toán, một khóa `idempotencyKey` duy nhất được tạo và lưu trữ trong `sessionStorage` gắn liền với hash nội dung giỏ hàng.
  - Nếu mất kết nối mạng hoặc khách tải lại trang (F5), hệ thống tự động kiểm tra và lấy lại đơn hàng đã tạo thay vì trừ tiền hoặc tạo thêm đơn hàng rác.
- **Tiếp tục thanh toán (Resume Payment):**
  - Khách hàng có thể tiếp tục thanh toán đơn hàng đang ở trạng thái `PENDING` bất cứ lúc nào từ mục "Lịch sử đơn hàng" trong trang cá nhân thông qua modal `ResumePaymentModal`.
  - Cập nhật mã VietQR động cùng cơ chế polling thời gian thực tự động nhận diện tiền vào.
- **Webhook SePay & Xử lý nguyên tử:**
  - Bắt buộc ID giao dịch SePay phải là số nguyên dương an toàn (`safe integer`).
  - Ghi nhận `PaymentReceipt` và cập nhật trạng thái đơn hàng cùng trong 1 database transaction.
  - Chuyển `paymentStatus` sang `PAID`, `status` sang `PROCESSING`, và tự động cộng dồn `totalSpent` cho khách hàng mà không lo cộng trùng khi webhook gửi lại.

### 3. Đối soát thanh toán & Ghi nhận hoàn tiền
- **Tách biệt rõ ràng 2 trạng thái:**
  - Trạng thái thanh toán (`paymentStatus`): `PENDING` → `PAID` → `REFUNDED`.
  - Trạng thái xử lý (`status`): `PENDING` → `PROCESSING` → `COMPLETED` / `FAILED` / `REFUNDED`.
- **Hệ thống Đối soát giao dịch bất thường (`PaymentAnomaly`):**
  - Nếu khách chuyển thiếu tiền, chuyển thừa tiền, ghi sai nội dung đơn, hoặc chuyển tiền nhiều lần vào cùng một đơn: hệ thống tự động lưu vào bảng `PaymentAnomaly` với mã lỗi tương ứng (`AMOUNT_MISMATCH`, `DUPLICATE_PAYMENT`, `ORDER_NOT_FOUND`, `INVALID_ORDER_STATE`).
  - Cung cấp giao diện Admin **"Đối soát thanh toán"** (`PaymentAnomalyManager`) để nhân viên kiểm tra số tiền thực tế, mã tham chiếu ngân hàng và ghi chú xử lý đối soát.
- **Quy trình Ghi nhận hoàn tiền (Refund Management):**
  - Popup `RefundModal` chuyên dụng trong Admin: ghi nhận bắt buộc số tiền hoàn trả (`refundAmount`), mã giao dịch chuyển khoản hoàn trả (`refundTxId`), lý do hoàn tiền (`refundReason`).
  - Lưu trữ tự động ID người thực hiện (`refundedById`), thời điểm (`refundedAt`), cập nhật `paymentStatus` thành `REFUNDED` và ghi nhận sự kiện `TRANSACTION_REFUND` vào `AuditLog`.

### 4. Vận hành & Giám sát hệ thống
- **Thông báo đơn mới qua Telegram Bot:**
  - Tự động gửi thông báo chi tiết (Mã đơn, Tên gói, Tựa game, Số tiền, Email khách hàng) đến nhóm quản trị Telegram ngay khi đơn được tạo hoặc thanh toán thành công.
- **Tự động Sao lưu Cơ sở dữ liệu hàng ngày:**
  - Script độc lập `backend/scripts/backup.mjs` (và container `backup` trong Docker Compose) tự động dump CSDL bằng `pg_dump` định kỳ và dọn dẹp các bản sao lưu cũ vượt quá 7 ngày.
  - Script khôi phục nhanh `backend/scripts/restore.mjs` với giao dịch an toàn (`--single-transaction`).
- **Chống spam đơn PENDING:**
  - Giới hạn số đơn PENDING tối đa mà một tài khoản hoặc một địa chỉ IP có thể tạo (`MAX_PENDING_ORDERS_PER_USER`, `MAX_PENDING_ORDERS_PER_IP`).
- **Công tắc Chế độ Bảo trì (Maintenance Mode):**
  - Bật/tắt chế độ bảo trì trực tiếp từ trang Admin Content Settings.
  - Khi bật, khách hàng truy cập API storefront sẽ nhận mã lỗi 503 kèm thông điệp bảo trì. Tài khoản Admin được phân quyền bypass tự động để tiếp tục làm việc.
- **Bảo toàn phiên khi CSDL gặp sự cố tạm thời:**
  - Khi CSDL quá tải hoặc mất kết nối, hệ thống trả về mã HTTP 503 kèm header `Retry-After: 30`, tuyệt đối không xóa cookie phiên hoặc đăng xuất nhầm người dùng.
- **Chuẩn hóa lỗi đầu vào & Tracing:**
  - Lỗi cú pháp JSON hỏng trả về `400 Bad Request`.
  - Request body vượt quá dung lượng cho phép trả về `413 Payload Too Large`.
  - Mọi phản hồi HTTP đều gắn kèm `X-Request-Id` (UUIDv4) hỗ trợ tra cứu nhật ký lỗi nhanh chóng.
- **Graceful Shutdown cho Container:**
  - File `container-entrypoint.js` chuyển tiếp chính xác tín hiệu dừng `SIGTERM` / `SIGINT` từ Docker daemon đến tiến trình Node.js, cho phép hoàn tất các request đang dang dở và ngắt kết nối Prisma sạch sẽ trong vòng 10 giây.
- **Nhật ký kiểm toán hệ thống (Audit Log):**
  - Mọi thao tác nhạy cảm (Đổi trạng thái đơn hàng, Duyệt hoàn tiền, Bật/tắt bảo trì, Giải quyết bất thường thanh toán, Chỉnh sửa quyền người dùng) đều được lưu trữ đầy đủ trong bảng `AuditLog` và hiển thị trực quan tại tab **"Nhật ký hoạt động"** trên giao diện Admin.

### 5. Bách khoa toàn thư Aniimo (Interactive Wiki)
- **Bản đồ tương tác (World Map):** Bản đồ chi tiết hỗ trợ phóng to/thu nhỏ mượt mà, phân chia 8 ranh giới hang ngầm độc lập và lưu trữ các mốc đã thu thập vào `localStorage`.
- **Xây dựng Đội hình (Team Builder):** Cơ chế chống đăng trùng lặp tổ hợp tướng, bắt buộc đủ 4 Aniimo hợp lệ và áp dụng thời gian chờ (cooldown 20s) giữa các lần chia sẻ.
- **Thư viện & So sánh tướng:** Hiển thị huy hiệu song hệ (Dual-Element) chuẩn hóa cho các Aniimo đặc biệt, bảng xếp hạng Tier List phân loại theo vai trò.
- **Kho Giftcode Cộng đồng:** Cung cấp mã quà tặng game kèm tính năng bình chọn (upvote/downvote) theo thời gian thực để lọc mã hết hạn.

### 6. Bảng điều khiển Quản trị (Admin Panel)
- **Quản lý Danh mục & Gói nạp:** Tạo, chỉnh sửa, bật/tắt dịch vụ game và gói nạp linh hoạt.
- **Trình tạo Form nạp game (Topup Templates):**
  - Thiết lập các trường nhập liệu động (UID, Server, Mật khẩu, Ghi chú...).
  - Kiểm tra an toàn: Tối đa 20 trường, cấm trùng key, kiểm tra biểu thức RegEx an toàn chống ReDoS.
- **Quản lý Giao dịch:** Bộ lọc theo mã đơn, email, khoảng ngày, trạng thái thanh toán và trạng thái xử lý; yêu cầu nhập lý do bắt buộc khi Admin đổi trạng thái thủ công.
- **Upload hình ảnh tối ưu:** Tự động chuyển đổi ảnh tải lên sang định dạng chuẩn WebP, kiểm tra kích thước tối đa và từ chối các file nguy hiểm (như SVG chứa mã script).

---

## 🔑 Biến môi trường (Environment Variables)

Hệ thống sử dụng các biến môi trường được khai báo trong file `.env` (tại thư mục gốc và thư mục `backend/`):

| Biến môi trường | Bắt buộc | Mặc định | Mô tả |
|---|:---:|---|---|
| `PORT` | Không | `3000` (Backend) / `80` (Docker) | Cổng lắng nghe của máy chủ |
| `NODE_ENV` | Không | `development` | Môi trường chạy (`development` / `production` / `test`) |
| `DATABASE_URL` | **Có** | — | Chuỗi kết nối PostgreSQL (vd: `postgresql://user:pass@localhost:5432/duke1305_db?schema=public`) |
| `JWT_SECRET` | **Có** | — | Khóa bí mật ký JWT (Production yêu cầu tối thiểu **64 ký tự**) |
| `COOKIE_SECRET` | **Có** | — | Khóa bí mật ký Cookie (Production yêu cầu tối thiểu **32 ký tự**) |
| `DATA_ENCRYPTION_KEY` | **Có** | — | Khóa mã hóa thông tin nhạy cảm AES-256-GCM (Production yêu cầu tối thiểu **32 ký tự**) |
| `PREVIOUS_ENCRYPTION_KEYS` | Không | — | Danh sách các khóa cũ khi xoay vòng key (cách nhau bởi dấu phẩy) |
| `CORS_ORIGIN` | **Có** | `http://localhost:5173` | Danh sách domain frontend được phép gọi API (cách nhau bởi dấu phẩy) |
| `TRUST_PROXY_HOPS` | Không | `0` (Local) / `1` (Nginx) | Số lượng reverse proxy phía trước máy chủ Node.js |
| `SEPAY_API_KEY` | Tùy chọn | — | Khóa API SePay để xác thực Webhook |
| `SEPAY_BANK_CODE` | Tùy chọn | `MBBANK` | Mã ngân hàng nhận thanh toán VietQR |
| `SEPAY_ACCOUNT_NUMBER` | Tùy chọn | — | Số tài khoản ngân hàng nhận tiền |
| `SEPAY_ACCOUNT_NAME` | Tùy chọn | `DUKE1305` | Tên chủ tài khoản hiển thị trên mã QR |
| `SMTP_HOST` | Tùy chọn | `smtp.gmail.com` | Địa chỉ máy chủ SMTP gửi mail OTP |
| `SMTP_PORT` | Tùy chọn | `587` | Cổng kết nối SMTP |
| `SMTP_SECURE` | Tùy chọn | `false` | Bật TLS/SSL nếu dùng cổng 465 |
| `SMTP_USER` | Tùy chọn | — | Tài khoản đăng nhập SMTP |
| `SMTP_PASSWORD` | Tùy chọn | — | Mật khẩu tài khoản hoặc App Password |
| `MAIL_FROM` | Tùy chọn | — | Địa chỉ email người gửi hiển thị (vd: `"DUKE1305" <no-reply@duke1305.vn>`) |
| `TELEGRAM_BOT_TOKEN` | Tùy chọn | — | Token của Bot Telegram nhận thông báo |
| `TELEGRAM_CHAT_ID` | Tùy chọn | — | ID nhóm hoặc chat cá nhân nhận thông báo Telegram |
| `ADMIN_EMAIL` | Tùy chọn | `admin@duke1305.vn` | Email tài khoản quản trị khi chạy seed |
| `ADMIN_PASSWORD` | Tùy chọn | — | Mật khẩu tài khoản quản trị khi chạy seed |

---

## 💻 Cài đặt & Chạy môi trường Local

### 1. Yêu cầu hệ thống
- **Node.js:** Phiên bản 20+ hoặc 22 LTS
- **PostgreSQL:** Phiên bản 14+ (khuyến nghị 16)
- **pnpm** hoặc **npm**

### 2. Cài đặt Dependencies
```powershell
# Cài đặt thư viện cho cả Frontend và Backend
npm install --prefix frontend
npm install --prefix backend
```

### 3. Thiết lập CSDL và Môi trường
Tạo file `backend/.env` từ file mẫu:
```powershell
Copy-Item backend\.env.example backend\.env
```
Điền chuỗi kết nối `DATABASE_URL` thực tế của bạn vào file `backend/.env`.

Sau đó tạo schema và seed dữ liệu mẫu:
```powershell
npm run db:migrate
npm run db:seed
```

### 4. Khởi chạy ứng dụng
Mở 2 cửa sổ terminal riêng biệt:
```powershell
# Terminal 1: Chạy Frontend (Vite)
npm run dev:frontend

# Terminal 2: Chạy Backend (Express)
npm run dev:backend
```

- **Frontend:** Truy cập tại `http://localhost:5173`
- **Backend API:** Truy cập tại `http://localhost:3000`

### 5. Tài khoản thử nghiệm mặc định
Khi seed hoàn tất, bạn có thể đăng nhập bằng các tài khoản sau:
- **Tài khoản Admin:** `admin@test.com` / `123456`
- **Tài khoản Khách hàng:** `customer@test.com` / `123456`

*(Lưu ý: Luôn thay đổi mật khẩu quản trị trước khi đưa lên môi trường công khai).*

---

## 🧪 Kiểm thử tự động (Automated Testing)

Dự án sở hữu bộ kiểm thử tự động toàn diện được thiết kế để chạy độc lập trên các schema thử nghiệm riêng biệt, không gây ảnh hưởng đến dữ liệu đang chạy:

### 1. Kiểm thử Backend (Node Test Runner)
Chạy toàn bộ 14 test suites với 133 ca kiểm thử tự động:
```powershell
npm test --prefix backend
# Hoặc từ thư mục gốc:
npm run test:backend
```
Bộ test kiểm tra nghiêm ngặt:
- Luồng OTP, đăng ký, đăng nhập và bảo vệ cookie phiên (`auth.test.ts`).
- Khóa nguyên tử chống trùng lặp checkout (`orders.test.ts`).
- Chống spam đơn PENDING & Rate Limiting (`operational-features.test.ts`).
- Cơ chế phục hồi lỗi CSDL 503 (`operational-features.test.ts`).
- Đối soát webhook SePay và phát hiện giao dịch bất thường (`payment-reconciliation.test.ts`, `payments.test.ts`).
- Quy trình ghi nhận hoàn tiền và phân quyền Audit Log (`operational-features.test.ts`, `admin.test.ts`).
- Phân quyền RBAC Wiki, bình chọn Giftcode và chống spam Team Builder (`wiki.test.ts`).

### 2. Kiểm tra Kiểu dữ liệu & Build Frontend
```powershell
# Kiểm tra TypeScript Frontend
npm run typecheck --prefix frontend

# Build thử nghiệm Frontend
npm run build --prefix frontend
```

### 3. Kiểm thử Dừng Container An toàn
```powershell
npm run test:container --prefix backend
```

---

## 🐳 Triển khai Production với Docker

Hệ thống đã sẵn sàng cho Docker Compose với kiến trúc tách biệt gồm:
1. `postgres`: Cơ sở dữ liệu PostgreSQL 16 Alpine với healthcheck.
2. `migrate`: Container chạy migration CSDL và mã hóa dữ liệu tự động trước khi API khởi động.
3. `backend`: Ứng dụng Node.js production loại bỏ npm/npx trong runtime image để giảm thiểu rủi ro bảo mật.
4. `frontend`: Bản build static Nginx phục vụ SPA với cấu hình nén gzip và bảo vệ security headers.
5. `backup`: Container tự động sao lưu dữ liệu PostgreSQL hàng ngày vào thư mục `./backups`.

### Các bước triển khai:

1. **Chuẩn bị cấu hình môi trường:**
   ```powershell
   Copy-Item .env.production.example .env
   ```
   Chỉnh sửa `.env` với các giá trị bí mật thực tế (`JWT_SECRET`, `COOKIE_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGIN`, `SEPAY_*`, `SMTP_*`).

2. **Khởi chạy hệ thống:**
   ```powershell
   docker compose up -d --build
   ```

3. **Sao lưu & Khôi phục CSDL:**
   - **Sao lưu thủ công:**
     ```powershell
     npm run db:backup
     ```
   - **Khôi phục từ file dump:**
     ```powershell
     npm run db:restore -- path/to/backup.dump
     ```

---

## 📖 Danh mục REST API Reference

Toàn bộ phản hồi API đều tuân thủ chuẩn cấu trúc:
- Thành công: `{ "success": true, "data": ... }`
- Thất bại: `{ "success": false, "error": "Thông báo lỗi", "requestId": "..." }`

### Xác thực & Người dùng (`/api/auth`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | Public | Gửi mã OTP xác nhận đăng ký tài khoản |
| `POST` | `/api/auth/verify-registration` | Public | Xác thực mã OTP và hoàn tất đăng ký |
| `POST` | `/api/auth/login` | Public | Đăng nhập và nhận cookie phiên `token` |
| `POST` | `/api/auth/forgot-password` | Public | Gửi mã OTP thiết lập lại mật khẩu |
| `POST` | `/api/auth/reset-password` | Public | Xác thực OTP và cập nhật mật khẩu mới |
| `POST` | `/api/auth/logout` | Public | Xóa cookie phiên và đăng xuất |
| `GET` | `/api/auth/session` | Public | Lấy thông tin tài khoản đang đăng nhập |

### Danh mục & Gói nạp (`/api/catalog`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET` | `/api/catalog/services` | Public | Danh sách dịch vụ/game đang hoạt động |
| `GET` | `/api/catalog/services/:id` | Public | Chi tiết dịch vụ kèm danh sách gói nạp |
| `GET` | `/api/catalog/packages/:id` | Public | Chi tiết một gói nạp cụ thể |
| `GET` | `/api/catalog/statuses` | Public | Danh sách trạng thái sản phẩm |
| `GET` | `/api/catalog/topup-templates`| Public | Danh sách mẫu form thông tin nạp |
| `GET` | `/api/catalog/settings/:key` | Public | Lấy cài đặt công khai (liên hệ, trung gian...) |

### Đơn hàng & Thanh toán (`/api/orders` & `/api/payments`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `POST` | `/api/orders` | Customer | Tạo đơn hàng đơn lẻ |
| `POST` | `/api/orders/checkout` | Customer | Tạo đơn giỏ hàng đa sản phẩm với `idempotencyKey` |
| `GET` | `/api/orders/mine` | Customer | Lấy lịch sử đơn hàng của người dùng |
| `GET` | `/api/orders/:code` | Owner/Admin | Xem chi tiết đơn hàng theo mã |
| `GET` | `/api/orders/:code/payment` | Owner/Admin | Lấy thông tin & mã QR để tiếp tục thanh toán |
| `GET` | `/api/orders/:code/payment-status`| Public | Polling kiểm tra trạng thái thanh toán theo thời gian thực |
| `POST` | `/api/payments/webhook` | SePay Key | Webhook nhận thông báo biến động số dư từ SePay |

### Quản trị viên (`/api/admin`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET/POST/PUT/DELETE` | `/api/admin/services[/:id]` | Admin | Quản lý danh mục dịch vụ game |
| `GET/POST/PUT/DELETE` | `/api/admin/packages[/:id]` | Admin | Quản lý các gói nạp |
| `GET/POST/PUT/DELETE` | `/api/admin/topup-templates[/:id]` | Admin | Quản lý mẫu nhập form nạp game (max 20 fields) |
| `GET` | `/api/admin/transactions` | Staff/Admin | Danh sách tất cả đơn hàng kèm bộ lọc nâng cao |
| `GET` | `/api/admin/transactions/:id`| Staff/Admin | Chi tiết đơn kèm thông tin nạp đã giải mã |
| `PATCH` | `/api/admin/transactions/:id/status` | Staff/Admin | Cập nhật trạng thái xử lý đơn (kèm lý do bắt buộc) |
| `POST` | `/api/admin/transactions/:id/refund` | Admin | Ghi nhận hoàn tiền đơn hàng (số tiền, mã bank, lý do) |
| `GET` | `/api/admin/payment-anomalies` | Admin | Danh sách các giao dịch bất thường chờ đối soát |
| `PATCH` | `/api/admin/payment-anomalies/:id/resolve` | Admin | Đánh dấu đã giải quyết giao dịch bất thường |
| `GET` | `/api/admin/audit-logs` | Admin | Xem nhật ký kiểm toán hệ thống |
| `GET/PATCH` | `/api/admin/users[/:id]` | Admin | Quản lý danh sách tài khoản & phân quyền |
| `GET/PUT` | `/api/admin/settings/:key` | Admin | Quản lý cài đặt hệ thống & công tắc bảo trì |
| `POST` | `/api/admin/upload` | Staff/Admin | Tải lên hình ảnh (tự động tối ưu WebP) |

### Bách khoa toàn thư Wiki (`/api/wiki`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET` | `/api/wiki` | Public | Lấy danh sách nội dung wiki |
| `POST/PUT/DELETE` | `/api/wiki/teams[/:id]` | Customer/Admin | Đăng, chỉnh sửa và xóa đội hình đề cử |
| `POST/PUT/DELETE` | `/api/wiki/giftcodes[/:id]` | Customer/Admin | Đóng góp và quản lý danh sách giftcode |
| `POST` | `/api/wiki/giftcodes/:id/vote`| Customer | Bình chọn trạng thái giftcode (upvote/downvote) |
| `PUT` | `/api/wiki/aniimos/:id` | Admin | Cập nhật chỉ số và thông tin chi tiết Aniimo |

---

## 🛡️ Giấy phép & Bản quyền
Dự án được phát triển và vận hành độc quyền bởi **DUKE1305**. Mọi quyền được bảo lưu.
