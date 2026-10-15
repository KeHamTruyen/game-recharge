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
│   │   │   ├── regex.ts               # Bộ lọc ReDoS đa tầng (Static analysis + VM sandbox)
│   │   │   ├── telegram.ts            # Module bắn tin nhắn thông báo Telegram Bot
│   │   │   └── pagination.ts          # Chuẩn hóa phân trang danh sách
│   │   └── index.ts                   # Điểm khởi chạy Express server & graceful shutdown
│   ├── scripts/
│   │   ├── backup.mjs                 # Script sao lưu CSDL tự động (pg_dump, kiểm tra retention an toàn)
│   │   ├── restore.mjs                # Script khôi phục CSDL an toàn (pg_restore / psql tự động nhận diện)
│   │   ├── container-entrypoint.js    # Entrypoint Docker chuyển tiếp tín hiệu SIGTERM/SIGINT
│   │   ├── test.mjs                   # Runner chạy test trên schema CSDL độc lập
│   │   └── test-container-shutdown.mjs# Integration test kiểm tra dừng container an toàn
│   ├── tests/                         # Bộ 26 test suites kiểm thử toàn diện backend (176 tests)
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
  - `CUSTOMER`: Mua hàng, tra cứu lịch sử đơn của bản thân, tiếp tục thanh toán, hủy đơn pending, bình chọn & đăng đội hình, đóng góp giftcode.
  - `ADMIN`: Toàn quyền quản trị hệ thống: danh mục dịch vụ, gói nạp, mẫu form nạp, xử lý đơn hàng & giải mã thông tin nạp, ghi nhận hoàn tiền, đối soát giao dịch bất thường, quản lý người dùng, cấu hình bảo trì và xem nhật ký Audit Log.
- **Mã hóa dữ liệu nhạy cảm (AES-256-GCM):**
  - Mọi trường nhạy cảm trong `topupInfo` (như mật khẩu tài khoản game, mã PIN) được chuẩn hóa và mã hóa an toàn tại tầng CSDL với khóa `DATA_ENCRYPTION_KEY` (tiền tố `enc:`).
  - Phản hồi trả về phía khách hàng tự động che (mask) trường nhạy cảm (`••••••••`). Tài khoản quản trị `ADMIN` có thể xem thông tin đã giải mã khi tra cứu chi tiết đơn để hỗ trợ và xử lý nạp game.

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
  - Chuyển `paymentStatus` sang `PAID`, `status` sang `PROCESSING` (chống xử lý trùng lặp khi webhook gửi lại). Tổng chi tiêu (`totalSpent`) của khách hàng được cộng dồn khi đơn hàng được quản trị viên xử lý hoàn tất (`status = COMPLETED`) và tự động khấu trừ tương ứng nếu đơn hàng được hoàn tiền.
  - Trường hợp đơn hàng đã bị hủy (`FAILED`) trước khi thanh toán tới muộn, webhook vẫn ghi nhận `paymentStatus = PAID` nhưng giữ nguyên `status = FAILED` để CSKH đối soát chứng từ, không tự động mở lại đơn hoặc cộng chi tiêu sai lệch.

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
  - Webhook thanh toán ghi thông báo vào bảng `telegram_notifications` trong cùng transaction với thanh toán; chỉ gửi sau khi commit. Nội dung hàng đợi được mã hóa bằng `DATA_ENCRYPTION_KEY`, giải mã khi gửi; Telegram vẫn hiển thị đầy đủ thông tin nạp và mật khẩu theo cấu hình nghiệp vụ. Chỉ cấp quyền chat cho người xử lý đơn. Script `db:migrate-passwords` mã hóa cả thông báo cũ chưa gửi; Docker chạy bước này trong service `migrate`.
  - Backend xử lý tối đa 10 thông báo mỗi lượt, quét lại mỗi 30 giây và khi khởi động. Gửi lỗi sẽ thử lại với khoảng chờ tăng từ 30 giây đến tối đa 1 giờ; công việc đang xử lý được giữ chỗ 60 giây để phục hồi sau restart. Nếu chưa cấu hình Telegram, thông báo nằm chờ và được gửi khi bật cấu hình.
  - Không thể bảo đảm Telegram chỉ nhận đúng một lần: nếu Telegram đã nhận nhưng phản hồi bị mất, hoặc tiến trình dừng trước khi ghi nhận thành công, lần thử lại có thể tạo tin trùng. Nhân viên đối chiếu mã đơn trên Admin trước khi xử lý; việc gửi lại không thanh toán lại đơn.
  - Node được tăng thời gian thử kết nối IPv4/IPv6 lên tối thiểu 1.500 ms; mỗi yêu cầu gửi giới hạn 6 giây. Tin dài được chia thành các phần văn bản thuần tối đa 4.000 ký tự, giữ nguyên dữ liệu; cả lượt gửi giới hạn 45 giây. Nếu một phần thất bại, lần gửi lại có thể lặp phần đã nhận.
  - Test gửi thật: `npm run test:email --prefix backend -- recipient@example.com` và `npm run test:telegram --prefix backend`. Script trả mã thoát khác 0 khi lỗi; SMTP chấp nhận thư chưa đồng nghĩa thư đã vào Inbox.
- **Tự động Sao lưu Cơ sở dữ liệu hàng ngày & Khôi phục Tương thích:**
  - Script độc lập `backend/scripts/backup.mjs` (và container `backup` trong Docker Compose) tự động dump CSDL bằng `pg_dump` định kỳ và dọn dẹp các bản sao lưu cũ. Bắt buộc kiểm tra an toàn `BACKUP_KEEP_DAYS >= 1` (từ chối ngay nếu `<= 0` hoặc không hợp lệ để chống xóa nhầm bản sao lưu mới tạo), kiểm tra dung lượng file kết xuất sau dump và in URL kết nối che mật khẩu.
  - Script khôi phục `backend/scripts/restore.mjs`: hỗ trợ `.dump`, `.sql` và `.sql.gz` từ container backup. File gzip được giải nén ra file tạm, kiểm tra đầy đủ trước khi chạy SQL rồi dọn file tạm. SQL lỗi trả mã khác 0 và rollback (`ON_ERROR_STOP=1`, `--single-transaction`).
- **Chống spam đơn PENDING & Khóa cạnh tranh giỏ hàng:**
  - Giới hạn số đơn PENDING tối đa mà một tài khoản hoặc một địa chỉ IP có thể tạo (`MAX_PENDING_ORDERS_PER_USER`, `MAX_PENDING_ORDERS_PER_IP`).
  - Áp dụng khóa giao dịch PostgreSQL Advisory Transaction Lock (`pg_advisory_xact_lock`) theo từng người dùng, tính đúng tổng số món hàng sắp tạo (`incomingCount`) trong giỏ hàng nhiều dòng checkout, ngăn chặn triệt để tình trạng gọi song song vượt trần quota. Hủy đơn lập tức giải phóng hạn ngạch.
- **Phòng chống ReDoS đa tầng trong Mẫu form nạp (Topup Templates):**
  - Phân tích tĩnh Regex: cấm lượng từ lồng nhau nguy hiểm dạng `(a+)+`, `(a|a)+`, cấm nhiều wildcard liên tiếp `.*.*`, giới hạn độ dài pattern <= 150 ký tự.
  - Fuzzing Sandbox `node:vm` với timeout 35ms phát hiện sớm các biểu thức backtracking nguy hiểm khi Admin cấu hình mẫu.
  - Hàm `safeRegexTest(pattern, input, timeoutMs = 50)` thực thi an toàn trong luồng tạo đơn của khách, bảo vệ máy chủ khỏi nghẽn luồng xử lý.
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
- **Tối ưu hóa dung lượng Chunk & Lazy-loading:** Tách `library_items_full.json` (2.23 MB) sang cơ chế dynamic `import()`, tách module `wikiUtils.ts`. Giúp kích thước trang Thư Viện (`LibraryPage`) giảm **99.6%** từ **2,243 kB** xuống chỉ còn **9.36 kB** (gzip **3.09 kB**).
- **Tiết kiệm tài nguyên Polling & Bảo vệ dữ liệu xóa:** Tự động ngắt polling nền khi người dùng ẩn tab (`document.visibilityState === 'hidden'`) và làm mới tức thì khi mở lại. Bản ghi soft-delete trên API `GET /api/wiki` được dọn sạch dữ liệu cá nhân (`authorId: null`, `data: {}`), chống rò rỉ nội dung cộng đồng đã gỡ.

### 6. Bảng điều khiển Quản trị (Admin Panel)
- **Quản lý Danh mục & Gói nạp:** Tạo, chỉnh sửa, bật/tắt dịch vụ game và gói nạp linh hoạt.
- **Trình tạo Form nạp game (Topup Templates):**
  - Thiết lập các trường nhập liệu động (UID, Server, Mật khẩu, Ghi chú...).
  - Kiểm tra an toàn: Tối đa 20 trường, cấm trùng key (tối đa 50 ký tự), bắt buộc danh sách options cho kiểu `select`, kiểm tra tính hợp lệ và chống ReDoS.
- **Quản lý Giao dịch & Thống kê Tổng hợp CSDL:**
  - Bộ lọc theo mã đơn, email, khoảng ngày, trạng thái thanh toán và trạng thái xử lý; yêu cầu nhập lý do bắt buộc khi Admin đổi trạng thái thủ công.
  - Endpoint `GET /api/admin/transactions` tính toán tổng doanh thu và số lượng đơn hoàn tất trực tiếp qua Prisma Aggregates (`stats: { totalRevenue, totalCompleted }`), không cần duyệt toàn bộ lịch sử ở client.
  - Hỗ trợ phân trang server-side chuẩn hóa (`admin.transactionsPaginated`, `admin.usersPaginated`, `orders.minePaginated`) với trần an toàn `maxPages = 5`.
- **Giao diện thông báo lỗi Toast & Modal hoàn tiền an toàn:**
  - Hiển thị Toast thông báo lỗi trực quan cho Admin khi bị server từ chối (ví dụ: mã lỗi 409 khi xóa template đang có gói sử dụng).
  - Modal hoàn tiền giữ nguyên trạng thái form và báo lỗi tại chỗ khi API thất bại, không đóng modal sớm gây mất ngữ cảnh thao tác.
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
| `SEPAY_API_KEY` | Bắt buộc khi nhận đơn | — | Khóa xác thực webhook; thiếu khóa hoặc thông tin ngân hàng sẽ chặn tạo đơn/cấp lại QR với HTTP 503 |
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
| `ADMIN_EMAIL` | **Khi Seed/Bootstrap** | `admin@duke1305.vn` | Email tài khoản quản trị khi chạy seed hoặc bootstrap |
| `ADMIN_PASSWORD` | **Khi Seed/Bootstrap** | — | Mật khẩu tài khoản quản trị khi chạy seed hoặc bootstrap (tối thiểu **12 ký tự**) |

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

Sau đó tạo schema và khởi tạo dữ liệu:
```powershell
npm run db:migrate

# Lựa chọn 1: Khởi tạo dữ liệu phát triển (Dịch vụ mẫu, gói nạp demo, tài khoản test)
npm run db:seed

# Lựa chọn 2: Khởi tạo dữ liệu hệ thống sạch (Chỉ tạo Admin & danh mục gốc, không chèn dữ liệu rác)
npm run db:bootstrap
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

### 5. Khởi tạo dữ liệu & Tài khoản thử nghiệm
Khi khởi tạo CSDL bằng lệnh seed hoặc bootstrap:
- **Tài khoản Quản trị viên (Admin):** Khởi tạo tự động dựa trên 2 biến môi trường `ADMIN_EMAIL` và `ADMIN_PASSWORD` (bắt buộc tối thiểu **12 ký tự**) khai báo trong `.env`.
- Chạy lại **bootstrap** sẽ đặt lại mật khẩu admin và thu hồi toàn bộ phiên đăng nhập cũ của tài khoản đó; admin cần đăng nhập lại.
- **Tài khoản Khách hàng thử nghiệm (chỉ có khi chạy `npm run db:seed`):** `customer@test.com` / `123456`.

*(Lưu ý: Luôn đổi mật khẩu quản trị và giữ bí mật trước khi triển khai môi trường công khai).*

---

## 🧪 Kiểm thử tự động (Automated Testing)

Dự án sở hữu bộ kiểm thử tự động toàn diện được thiết kế để chạy độc lập trên các schema thử nghiệm riêng biệt, không gây ảnh hưởng đến dữ liệu đang chạy:

### 1. Kiểm thử Backend (Node Test Runner)
Chạy toàn bộ 26 test suites với 176 ca kiểm thử tự động:
```powershell
npm test --prefix backend
# Hoặc từ thư mục gốc:
npm run test:backend
```
Bộ test kiểm tra nghiêm ngặt:
- Luồng OTP, đăng ký, đăng nhập và bảo vệ cookie phiên `auth_token` (`auth.test.ts`).
- Khóa nguyên tử chống trùng lặp checkout và xử lý cạnh tranh hủy đơn (`orders.test.ts`, `order-cancellation.test.ts`).
- Chống spam đơn PENDING & Rate Limiting (`operational-features.test.ts`).
- Cơ chế phục hồi lỗi CSDL 503 (`operational-features.test.ts`).
- Đối soát webhook SePay và phát hiện giao dịch bất thường (`payment-reconciliation.test.ts`, `payments.test.ts`).
- Nghiệp vụ hoàn tiền an toàn, trừ tổng chi tiêu và phân quyền Audit Log (`operational-features.test.ts`, `p1-fixes-verification.test.ts`, `admin.test.ts`).
- Chuẩn hóa và mã hóa AES trường mật khẩu topup (`p1-fixes-verification.test.ts`).
- Phân quyền RBAC Wiki, bình chọn Giftcode và chống spam Team Builder (`wiki.test.ts`).
- Bộ xác minh toàn diện P2 (`p2-fixes-verification.test.ts`):
  - Chống ReDoS đa tầng (AST Regex check, sandbox VM fuzzing, safe runtime timeout).
  - PostgreSQL Advisory Lock cho hạn ngạch đơn `PENDING` giỏ hàng nhiều dòng.
  - Script sao lưu kiểm tra `BACKUP_KEEP_DAYS >= 1` và khôi phục tự động nhận diện định dạng.
  - Làm sạch dữ liệu Tombstone wiki soft-deleted và tối ưu polling khi tab ẩn.
  - Phân trang API trực tiếp từ máy chủ và tính toán doanh thu tổng hợp (DB Aggregates).
- Kiểm tra hồi quy đối soát & tổng hợp nhóm thanh toán (`review-regressions.test.ts`):
  - Tổng hợp trạng thái nhóm tại `GET /api/payments/status/:orderCode`: chỉ báo `PAID` khi tất cả các dòng đã thanh toán (chống báo thành công giả khi mới trả 1 phần).
  - Bảo toàn trạng thái đơn hủy nhận tiền muộn: trả về `status: FAILED` kèm `paymentStatus: PAID` để CSKH đối soát chứng từ, không báo nhầm `PROCESSING`.

### 2. Kiểm tra Kiểu dữ liệu & Build Frontend
```powershell
# Kiểm tra TypeScript Frontend (0 lỗi)
npm run typecheck --prefix frontend

# Build Frontend (Tự động prerender SEO tĩnh cho 13 route công khai)
npm run build --prefix frontend
```

### 3. Kiểm thử End-to-End Frontend (Playwright)
```powershell
# Chạy toàn bộ 28 ca kiểm thử E2E
npx playwright test --config frontend/playwright.config.ts
```
Bao gồm kiểm tra toast thông báo lỗi Admin, luồng hoàn tiền, giỏ hàng checkout, hủy đơn hàng, phát hiện thanh toán muộn trên đơn hủy hiển thị thông báo liên hệ CSKH, và xử lý trang 404.

### 4. Kiểm thử Dừng Container An toàn
```powershell
npm run test:container --prefix backend
```

---

## 🐳 Triển khai Production với Docker

Hệ thống đã sẵn sàng cho Docker Compose với kiến trúc tách biệt gồm:
1. `postgres`: Cơ sở dữ liệu PostgreSQL 16 Alpine với healthcheck.
2. `migrate`: Container chạy migration CSDL (`prisma migrate deploy`) và mã hóa dữ liệu tự động trước khi API khởi động.
3. `backend`: Ứng dụng Node.js production loại bỏ npm/npx trong runtime image để giảm thiểu rủi ro bảo mật.
4. `frontend`: Bản build static Nginx phục vụ SPA với cấu hình nén gzip và bảo vệ security headers.
5. `backup`: Container tự động sao lưu dữ liệu PostgreSQL hàng ngày vào thư mục `./backups`.

### Các bước triển khai:

1. **Chuẩn bị cấu hình môi trường:**
   ```powershell
   Copy-Item .env.production.example .env
   ```
   Chỉnh sửa `.env` với các giá trị bí mật thực tế (`JWT_SECRET`, `COOKIE_SECRET`, `DATA_ENCRYPTION_KEY`, `CORS_ORIGIN`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `SEPAY_*`, `SMTP_*`).
   *(Lưu ý: `ADMIN_EMAIL` và `ADMIN_PASSWORD` dùng để tạo tài khoản quản trị đầu tiên, mật khẩu bắt buộc từ 12 ký tự trở lên).*

2. **Khởi chạy hệ thống:**
   ```powershell
   docker compose up -d --build
   ```
   Container `migrate` sẽ tự động áp dụng các migration PostgreSQL mới nhất và chuẩn hóa bảo mật dữ liệu trước khi dịch vụ backend tiếp nhận request.

3. **Khởi tạo dữ liệu hệ thống Production (Bootstrap an toàn):**
   Trên cơ sở dữ liệu production mới tinh, chạy lệnh bootstrap để tạo tài khoản quản trị `ADMIN` đầu tiên và nạp các danh mục/trạng thái hệ thống thiết yếu (không chèn tài khoản hoặc dữ liệu thử nghiệm):
   ```powershell
   docker compose exec backend node dist/scripts/bootstrap.js
   # Hoặc nếu chạy container độc lập một lần:
   docker compose run --rm backend node dist/scripts/bootstrap.js
   ```

4. **Sao lưu & Khôi phục CSDL:**
   Chạy các lệnh dưới đây từ thư mục `backend` trên máy quản trị có Node.js và PostgreSQL client (`pg_dump`, `pg_restore`, `psql`) trong PATH. Runtime Docker DHI không chứa các công cụ này. Đặt `DATABASE_URL` trỏ đúng CSDL đích; lần đầu diễn tập trên CSDL staging riêng.

   - **Sao lưu thủ công:**
     ```powershell
     npm run db:backup
     ```
   - **Khôi phục từ file dump:**
     ```powershell
     npm run db:restore -- path/to/backup.dump
     ```
   - **Khôi phục bản sao lưu tự động của Compose:**
     ```powershell
     npm run db:restore -- ../backups/daily/duke1305_db-YYYYMMDD.sql.gz
     ```
     Thay tên file theo bản backup thực tế. SQL được khôi phục vào CSDL sạch; cần đủ dung lượng thư mục tạm cho file SQL sau giải nén. Script không tự xóa dữ liệu hiện có khi dùng `.sql`/`.sql.gz`.

---

## 📖 Danh mục REST API Reference

Toàn bộ phản hồi API đều tuân thủ chuẩn cấu trúc:
- Thành công: `{ "success": true, "data": ... }`
- Thất bại: `{ "success": false, "error": "Thông báo lỗi", "requestId": "..." }`

### Xác thực & Người dùng (`/api/auth`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `POST` | `/api/auth/register` | Public | Gửi mã OTP xác nhận đăng ký tài khoản qua email |
| `POST` | `/api/auth/register/verify` | Public | Xác thực mã OTP và hoàn tất đăng ký (cấp cookie `auth_token`) |
| `POST` | `/api/auth/login` | Public | Đăng nhập và nhận cookie phiên `auth_token` |
| `POST` | `/api/auth/forgot-password` | Public | Gửi mã OTP thiết lập lại mật khẩu qua email |
| `POST` | `/api/auth/reset-password` | Public | Xác thực OTP và cập nhật mật khẩu mới |
| `POST` | `/api/auth/logout` | Public | Xóa cookie phiên `auth_token` và đăng xuất |
| `GET` | `/api/auth/session` | Customer/Admin | Lấy thông tin tài khoản đang đăng nhập |
| `PUT` | `/api/auth/profile` | Customer/Admin | Cập nhật tên hiển thị tài khoản |
| `POST` | `/api/auth/change-password` | Customer/Admin | Đổi mật khẩu tài khoản và cấp mới phiên |

### Danh mục & Gói nạp (`/api/catalog`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET` | `/api/catalog/services` | Public | Danh sách dịch vụ/game đang hoạt động |
| `GET` | `/api/catalog/services/:id` | Public | Chi tiết dịch vụ kèm danh sách gói nạp |
| `GET` | `/api/catalog/packages/:id` | Public | Chi tiết một gói nạp cụ thể |
| `GET` | `/api/catalog/product-statuses` | Public | Danh sách trạng thái sản phẩm (`available`, `paused`, `sold-out`) |
| `GET` | `/api/catalog/tags` | Public | Danh sách thẻ phân loại sản phẩm |
| `GET` | `/api/catalog/topup-templates` | Public | Danh sách mẫu form thông tin nạp game |
| `GET` | `/api/catalog/settings/:key` | Public | Lấy cài đặt công khai (`siteConfig`, `footerConfig`, `middlemanInfo`, `contactInfo`) |

### Đơn hàng & Thanh toán (`/api/orders` & `/api/payments`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `POST` | `/api/orders` | Customer | Tạo đơn hàng đơn lẻ |
| `POST` | `/api/orders/checkout` | Customer | Tạo đơn giỏ hàng đa sản phẩm với `idempotencyKey` |
| `GET` | `/api/orders/mine` | Customer | Lấy lịch sử đơn hàng của người dùng hiện tại |
| `GET` | `/api/orders/:code` | Owner/Admin | Xem chi tiết đơn hàng theo mã |
| `GET` | `/api/orders/:code/payment` | Owner/Admin | Lấy thông tin & mã QR tiếp tục thanh toán (tính tổng tiền nhóm) |
| `POST` | `/api/orders/:code/cancel` | Owner/Admin | Hủy đơn hàng pending và mở khóa toàn nhóm thanh toán |
| `GET` | `/api/payments/status/:orderCode` | Owner/Admin | Polling kiểm tra trạng thái thanh toán đơn/nhóm thanh toán (tổng hợp trạng thái nhóm, phát hiện đơn hủy nhận tiền muộn trả về status FAILED và paymentStatus PAID để CSKH đối soát) |
| `POST` | `/api/payments/webhook` | SePay Key | Webhook nhận thông báo biến động số dư VietQR từ SePay |

### Quản trị viên (`/api/admin`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET/POST` | `/api/admin/services` | Admin | Lấy danh sách hoặc tạo mới dịch vụ game |
| `GET/PUT/DELETE` | `/api/admin/services/:id` | Admin | Chi tiết, cập nhật hoặc xóa dịch vụ game |
| `GET/POST` | `/api/admin/packages` | Admin | Lấy danh sách hoặc tạo mới gói nạp |
| `PUT/DELETE` | `/api/admin/packages/:id` | Admin | Cập nhật hoặc xóa gói nạp |
| `GET/POST/DELETE` | `/api/admin/tags[/:id]` | Admin | Quản lý thẻ tag phân loại sản phẩm |
| `GET/POST` | `/api/admin/product-statuses` | Admin | Lấy danh sách hoặc tạo mới trạng thái sản phẩm |
| `DELETE` | `/api/admin/product-statuses/:id` | Admin | Xóa trạng thái sản phẩm |
| `GET/POST` | `/api/admin/topup-templates` | Admin | Lấy danh sách hoặc tạo mới mẫu form nạp (max 20 fields) |
| `PUT/DELETE` | `/api/admin/topup-templates/:id` | Admin | Cập nhật hoặc xóa mẫu form nạp |
| `GET` | `/api/admin/transactions` | Admin | Danh sách đơn hàng kèm phân trang server-side, bộ lọc trạng thái, ngày, tìm kiếm & thống kê doanh thu aggregate (`stats`) |
| `GET` | `/api/admin/transactions/:id` | Admin | Chi tiết đơn kèm thông tin nạp game đã giải mã AES |
| `PATCH` | `/api/admin/transactions/:id/status` | Admin | Cập nhật trạng thái đơn/thanh toán hoặc ghi nhận hoàn tiền (`REFUNDED`) |
| `GET` | `/api/admin/payment-anomalies` | Admin | Danh sách các giao dịch bất thường chờ đối soát |
| `PATCH` | `/api/admin/payment-anomalies/:id/resolve` | Admin | Đánh dấu đã giải quyết giao dịch bất thường |
| `GET` | `/api/admin/audit-logs` | Admin | Xem nhật ký kiểm toán hoạt động hệ thống |
| `GET/PATCH` | `/api/admin/users[/:id]` | Admin | Quản lý danh sách người dùng kèm phân trang server-side và phân quyền |
| `GET/PUT` | `/api/admin/settings/:key` | Admin | Quản lý cài đặt hệ thống & công tắc bảo trì |
| `POST` | `/api/admin/upload` | Admin | Tải lên hình ảnh (tự động tối ưu WebP) |
| `GET` | `/api/admin/media` | Admin | Lấy danh sách ảnh đã tải lên |

### Bách khoa toàn thư Wiki (`/api/wiki`)
| Phương thức | Endpoint | Yêu cầu quyền | Mô tả |
|---|---|:---:|---|
| `GET` | `/api/wiki` | Public | Lấy danh sách nội dung wiki (phân trang cursor; tự động dọn sạch dữ liệu tombstone đã xóa) |
| `POST/PUT/DELETE` | `/api/wiki/teams[/:id]` | Customer/Admin | Đăng, chỉnh sửa và xóa đội hình đề cử |
| `POST` | `/api/wiki/giftcodes` | Customer/Admin | Đóng góp mã giftcode cộng đồng |
| `PUT/DELETE` | `/api/wiki/giftcodes/:id` | Admin | Duyệt chỉnh sửa hoặc xóa mã giftcode |
| `POST` | `/api/wiki/giftcodes/:id/vote` | Customer | Bình chọn trạng thái giftcode (upvote/report) |
| `PUT` | `/api/wiki/aniimos/:id` | Admin | Cập nhật chỉ số và thông tin chi tiết Aniimo |

---

## 🛡️ Giấy phép & Bản quyền
Dự án được phát triển và vận hành độc quyền bởi **DUKE1305**. Mọi quyền được bảo lưu.
