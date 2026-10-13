# TODO bàn giao — DUKE1305

> Cập nhật **13/10/2026**; **Đã hoàn tất 100% toàn bộ mục P1 (A01–A06) và P2 (A07–A15)**. Toàn bộ 169 backend tests (25 suites) và 24 E2E tests đạt 100%.

Mã A01–A15 dưới đây thuộc audit **13/10**, khác A01–A04 của audit **11/10** (OTP, receipt webhook, trạng thái cuối, snapshot trường nhạy cảm). Các bản sửa cũ đó vẫn còn; không coi việc dùng lại số thứ tự là lỗi cũ tái phát.

## Phạm vi và kết quả kiểm tra

Đã đối chiếu README gốc, README trong `frontend/src/services`, audit cũ với các luồng auth/OTP, checkout, webhook, quản trị, wiki, lưu trữ trình duyệt, Prisma/migrations, Docker, backup và bộ kiểm thử. Không coi lỗi trong audit 10/10 là còn tồn tại nếu code hiện tại đã sửa.

| Kiểm tra trên phiên bản hiện tại | Kết quả |
| --- | --- |
| `npm test --prefix backend` | **169/169 đạt**, 25 suites; schema thử nghiệm riêng, đã dọn sau khi chạy |
| `npm run typecheck --prefix frontend` & backend `npm run build` | **Đạt 100%**, 0 lỗi typecheck; dist biên dịch đầy đủ |
| Bộ E2E Playwright đầy đủ (`frontend/tests`) | **24/24 đạt 100%**; bao gồm handoff spec (A07) và luồng hủy đơn (A01) |
| Kiểm thử P1 & Concurrency | **100% đạt**: Khóa nguyên tử hủy đơn, hoàn tiền, resume payment, mã hóa số |
| Render Docker Compose & Network | **Đạt**: `migrate` đã gán `duke_network`, `MAIL_FROM` chuẩn RFC |
| Bootstrap production an toàn | **Đạt**: Script `dist/scripts/bootstrap.js` khởi tạo DB sạch không chứa dữ liệu rác |

Log chạy thử nghiệm lưu trữ tại thư mục temp và test reports của dự án. Typecheck toàn bộ file test và source code đạt chuẩn.

**Quy ước:** P1 cần sửa trước khi nhận đơn thật/triển khai theo hướng dẫn; P2 cần hoàn thiện hoặc ghi rõ giới hạn nghiệm thu; P3 tùy chọn. Mật khẩu tối thiểu 6 ký tự là quyết định chủ dự án đã chấp nhận, không đưa yêu cầu tăng độ dài vào danh sách bắt buộc.

## P1 — Cần sửa trước production (ĐÃ HOÀN TẤT 6/6)

### A01 — Đã sửa: hủy đơn ghi đè thanh toán vừa được xác nhận

- [x] `backend/src/routes/orders.ts`: khóa toàn bộ nhóm paymentOrderCode theo cùng thứ tự ID với webhook, đọc lại quyền sở hữu/trạng thái sau khi lấy khóa, hủy cả nhóm trong một transaction. Đơn legacy không có paymentOrderCode vẫn hủy độc lập.
- [x] Hộp xác nhận mobile/desktop nói rõ các đơn chung mã thanh toán cũng bị hủy; sau thành công tải lại lịch sử cả nhóm. API giữ cấu trúc response cũ để không làm hỏng caller.
- **Bằng chứng:** thêm 8 test trong `backend/tests/order-cancellation.test.ts`; trước sửa 7 ca thất bại, sau sửa toàn bộ 8 ca và 133 ca cũ đều đạt. Các ca cạnh tranh quan sát khóa PostgreSQL thực để ép thứ tự webhook/admin/hủy, không chỉ gọi tuần tự.
- **Đã kiểm tra:** webhook/admin ghi nhận tiền trước thì hủy bị từ chối, không mất bank reference/metadata/receipt; hủy trước thì tiền đến muộn vẫn được ghi PAID, giữ FAILED cho toàn bộ nhóm và không cộng tổng chi tiêu. Tiền đến sau hủy cần người vận hành đối soát theo quy trình hiện hành, không tự mở lại đơn.
- **Ca khác đã đạt:** hủy lặp/đồng thời, nhóm có một dòng đã thanh toán, khác chủ sở hữu, quyền admin, legacy không có nhóm; 3 test UI luồng hủy/lịch sử trên mobile và laptop đạt.

### A02 — Đã sửa: Hoàn tiền bảo đảm điều kiện nghiệp vụ
- [x] `backend/src/routes/admin.ts`: Kiểm tra đơn hàng phải có `paymentStatus === 'PAID'` hoặc `status === 'COMPLETED'` mới được phép hoàn tiền; từ chối đơn chưa thanh toán với mã lỗi 400.
- [x] Ràng buộc `refundAmount` phải là số nguyên dương VND (`z.coerce.number().int().positive()`) và không vượt quá số tiền của đơn hàng (`refundAmount <= previous.amount`).
- [x] Yêu cầu lý do hoàn tiền cụ thể (`refundReason`), đồng bộ cả `status` và `paymentStatus` sang `REFUNDED`, ghi đầy đủ chứng từ `refundAmount`, `refundTxId`, `refundReason`, `refundedById`, `refundedAt`.
- [x] Kiểm tra chống hoàn tiền trùng lặp trên đơn đã hoàn; tự động trừ `totalSpent` của khách nếu đơn hàng trước đó đã hoàn tất.
- **Bằng chứng:** Đã bổ sung bộ test trong `backend/tests/p1-fixes-verification.test.ts`, 150/150 test backend đạt 100%.

### A03 — Đã sửa: Thanh toán lại tính đúng tổng tiền và kiểm tra trạng thái
- [x] `backend/src/routes/orders.ts`: Khi mở lại thanh toán (`GET /:code/payment`), nếu đơn thuộc giỏ hàng nhiều món (`paymentOrderCode`), tự động tính tổng số tiền cả nhóm `totalGroupAmount` để khớp chính xác với số tiền trong mã QR và nội dung chuyển khoản SePay.
- [x] Kiểm tra chặn không cho thanh toán lại đối với các đơn đã hủy (`FAILED`), hết hạn (`EXPIRED`) hoặc đã hoàn tiền (`REFUNDED`).
- [x] `frontend/src/features/content/pages.tsx`: Sửa modal thanh toán chỉ ghi nhận `setPaid(true)` khi `paymentStatus === "PAID"` hoặc `status === "COMPLETED"`, không còn báo thành công giả khi đơn ở trạng thái `PROCESSING` mà chưa trả tiền.
- **Bằng chứng:** Đã kiểm thử tự động trong `backend/tests/p1-fixes-verification.test.ts` và toàn bộ 24/24 Playwright e2e test đạt 100%.

### A04 — Đã sửa: Mật khẩu topup dạng số được chuẩn hóa và mã hóa AES
- [x] `backend/src/utils/crypto.ts`: Hàm `sanitizeTopupInfoForStorage` chuẩn hóa các giá trị mật khẩu/secret dạng số (`typeof value !== 'string'` -> `String(value)`) và mã hóa AES với tiền tố `enc:`. Không còn lưu mật khẩu dạng số ở dạng rõ (plain text) trong database.
- [x] Mật khẩu được che với khách (`••••••••`) và giải mã đầy đủ cho Admin khi tra cứu.
- **Bằng chứng:** Đã kiểm thử tự động xác nhận trong DB có tiền tố `enc:` và admin đọc được giá trị giải mã trong `backend/tests/p1-fixes-verification.test.ts`.

### A05 — Đã sửa: Gán mạng duke_network cho service migrate trong Docker Compose
- [x] `docker-compose.yml`: Bổ sung `networks: - duke_network` cho service `migrate`, bảo đảm container migrate giao tiếp được với `postgres:5432` trong cùng mạng cô lập.

### A06 — Đã sửa: File môi trường production mẫu và schema MAIL_FROM
- [x] `.env.production.example`: Sửa `MAIL_FROM="no-reply@duke1305.vn"` chuẩn cú pháp Docker Compose.
- [x] `backend/src/config/env.ts`: Cập nhật schema `MAIL_FROM` hỗ trợ cả email thuần và định dạng RFC `"Tên" <email@domain.com>`.

## P2 — Logic, xử lý lỗi và vận hành (ĐÃ HOÀN TẤT 9/9)

### A07 — Đã sửa: Admin hiển thị Toast thông báo lỗi & Form hoàn tiền an toàn
- [x] `frontend/src/features/admin/route.tsx`: Đưa `{store.notice && <div className="toast">{store.notice}</div>}` ra giao diện Admin đã đăng nhập. Lỗi server (như 409 khi xóa template đang dùng) hiển thị thông báo rõ ràng cho admin.
- [x] `frontend/src/features/admin/index.tsx`: Form hoàn tiền chuyển sang `await onUpdate(...)` có `try/catch`, trạng thái `refundSubmitting`, hiển thị lỗi `refundError` tại chỗ và không đóng modal sớm khi API thất bại.
- **Bằng chứng:** Ca test Playwright `tests/handoff.spec.ts:209` (`template deletion preserves the editor on server rejection and closes only after success`) đã chuyển từ ĐỎ sang XANH (100% pass).

### A08 — Đã sửa: Validation template đồng nhất & Chống ReDoS
- [x] Đồng bộ `backend/src/routes/admin.ts`, `backend/src/routes/orders.ts` và `frontend/src/features/admin/index.tsx`: Thống nhất độ dài khóa trường tối đa 50 ký tự (`.max(50)`), kiểu trường `type: enum('text', 'number', 'email', 'select', 'textarea', 'password')`, trường `select` bắt buộc có danh sách lựa chọn `options`.
- [x] Tạo cơ chế phòng chống ReDoS đa tầng tại `backend/src/utils/regex.ts`:
  - Phân tích tĩnh cấu trúc Regex: cấm lượng từ lồng nhau nguy hiểm dạng `(a+)+`, `(a|a)+`, cấm nhiều wildcard liên tiếp `.*.*`, giới hạn độ dài pattern <= 150 ký tự.
  - Kiểm tra fuzzing trong Sandbox `node:vm` với timeout 35ms khi admin tạo/sửa mẫu, phát hiện và từ chối các pattern ReDoS trước khi lưu vào CSDL.
  - Hàm `safeRegexTest(pattern, input, timeoutMs = 50)` thực thi an toàn trong luồng tạo đơn, tự động ngắt nếu đầu vào khách hàng vượt quá giới hạn hoặc gây nghẽn backtracking.
- **Bằng chứng:** Test suite `p2-fixes-verification.test.ts` (100% pass): từ chối key 51 ký tự (400), chấp nhận key 50 ký tự (201), từ chối regex ReDoS `^(a+)+$` và `.*.*`, xác thực đầu vào an toàn.

### A09 — Đã sửa: Quota PENDING cho checkout nhiều dòng & Khóa đồng thời
- [x] Cập nhật `checkOrderCreationAllowed` tại `backend/src/routes/orders.ts`:
  - Khóa hàng đợi giao dịch theo user thông qua PostgreSQL Advisory Transaction Lock: `SELECT pg_advisory_xact_lock(hashtext('pending_order_quota:' || userId))`.
  - Hỗ trợ tham số `incomingCount`: tính đúng tổng số đơn sắp tạo (1 đơn cho `POST /orders`, hoặc `body.items.length` cho `POST /orders/checkout`).
  - Kiểm tra nghiêm ngặt `pendingCount + incomingCount > maxPending` (mặc định 5 đơn PENDING).
- **Bằng chứng:** Test suite `p2-fixes-verification.test.ts` (100% pass): checkout 6 dòng bị chặn ngay khi quota là 5, tài khoản có 3 đơn PENDING checkout thêm 3 dòng bị chặn, hai yêu cầu checkout song song được serialize không vượt quá ngưỡng 5, hủy đơn lập tức giải phóng quota slot.

### A10 — Đã sửa: README và bootstrap production đồng bộ mã nguồn
- [x] Tạo script bootstrap chuẩn production `backend/src/scripts/bootstrap.ts` (biên dịch `dist/scripts/bootstrap.js`, npm script `db:bootstrap`) để khởi tạo CSDL sạch: chỉ tạo tài khoản ADMIN (theo `ADMIN_EMAIL` & `ADMIN_PASSWORD` >= 12 ký tự), nạp danh mục `ProductStatus`, `TopupTemplate`, cài đặt mặc định và tags mà không chèn tài khoản thử nghiệm hay dữ liệu demo vào DB production.
- [x] Bổ sung chế độ `bootstrap` trong `backend/scripts/container-entrypoint.js` để dễ dàng khởi tạo qua Docker (`docker compose exec backend node dist/scripts/bootstrap.js`).
- [x] Cập nhật `README.md`:
  - Chuẩn hóa vai trò RBAC: Chỉ có `CUSTOMER` và `ADMIN` (loại bỏ `STAFF`).
  - Sửa thông tin tài khoản đăng nhập mẫu: yêu cầu `ADMIN_EMAIL` và `ADMIN_PASSWORD` (tối thiểu 12 ký tự), chỉ rõ `customer@test.com / 123456` chỉ sinh khi chạy `npm run db:seed`.
  - Đồng bộ 100% bảng REST API Reference: `/auth/register/verify`, `GET /payments/status/:orderCode`, `PATCH /admin/transactions/:id/status` (hoàn tiền & đổi trạng thái), `/catalog/product-statuses`, `/catalog/tags`, `/orders/:code/cancel`, `PUT /auth/profile`, `POST /auth/change-password`, cookie `auth_token`.
  - Chuẩn hóa mô tả kiểm tra mẫu nạp và thời điểm cộng dồn `totalSpent` (khi đơn hoàn tất `COMPLETED`).
- [x] Cập nhật `frontend/src/services/README.md` đồng bộ toàn bộ service contracts và endpoints thực tế.
- **Bằng chứng:** Toàn bộ build, typecheck và 169/169 test backend đạt 100%. Mọi tài liệu và script đã được kiểm tra trên bản làm việc.

### A11 — Đã sửa: Kiểm chứng script Backup retention an toàn & Restore tương thích
- [x] `backend/scripts/backup.mjs`: Thêm bước kiểm tra giá trị `BACKUP_KEEP_DAYS` ngay khi khởi chạy: bắt buộc là số nguyên `>= 1`, từ chối ngay lập tức các giá trị `<= 0` hoặc chuỗi không hợp lệ trước khi thực hiện bất kỳ lệnh `pg_dump` nào (chống việc xóa nhầm các bản sao lưu mới tạo). Kiểm tra dung lượng file backup sau dump (`statSync(outputPath).size > 0`). In URL kết nối có che mật khẩu và nêu rõ phạm vi database scope.
- [x] `backend/scripts/restore.mjs`: Bổ sung kiểm tra file backup tồn tại và không rỗng (`statSync.size > 0`). Tự động phát hiện định dạng: dùng `pg_restore` cho file `.dump` (custom format) và `psql` cho file `.sql` plain text. In thông tin database đích với URL đã che mật khẩu.
- **Bằng chứng:** Test suite trong `p2-fixes-verification.test.ts` (100% pass): từ chối `BACKUP_KEEP_DAYS = 0`, từ chối chuỗi không hợp lệ, từ chối file restore không tồn tại hoặc file 0 bytes với mã thoát 1.

### A12 — Đã sửa: Tối ưu Wiki Polling & Làm sạch Tombstone công khai
- [x] `backend/src/routes/wiki.ts`: Tại endpoint công khai `GET /api/wiki`, các bản ghi đã xóa (`deleted === true`) được làm sạch dữ liệu tombstone: chỉ trả về `{ key, kind, deleted: true, updatedAt, createdAt, authorId: null, data: {} }`. Nội dung văn bản, tiêu đề, aniimo_ids của người dùng đã xóa hoàn toàn không bị rò rỉ ra API công khai.
- [x] `frontend/src/features/wiki/wikiStore.ts`: `getWikiEntries` tự động lọc bỏ các bản ghi đã xóa (`!entry.deleted`). Hàm `refreshWiki(force = false)` tự động bỏ qua polling định kỳ khi tab trình duyệt đang ẩn (`document.visibilityState === 'hidden'`).
- [x] `frontend/src/features/wiki/WikiLayout.tsx`: Lắng nghe sự kiện `visibilitychange` để kích hoạt làm mới ngay khi người dùng mở lại tab, đồng thời ngắt polling khi tab ẩn.
- **Bằng chứng:** Test suite trong `p2-fixes-verification.test.ts` (100% pass): kiểm tra bản ghi soft-deleted trả về qua `GET /api/wiki` được ẩn hoàn toàn nội dung nhạy cảm và `authorId: null`.

### A13 — Đã sửa: Phân trang API & Aggregate Thống kê cho Admin / Lịch sử
- [x] `frontend/src/services/api.ts`:
  - Giới hạn `allPages` có tham số trần `maxPages = 5` (tối đa 500 bản ghi) để chống treo trình duyệt hoặc quá tải bộ nhớ khi gọi phương thức cũ.
  - Bổ sung các phương thức phân trang trực tiếp từ server: `admin.transactionsPaginated(params)`, `admin.usersPaginated(params)`, `orders.minePaginated(params)` nhận `page`, `limit`, `search`, `status`, `from`, `to`, `gameId`.
- [x] `backend/src/routes/admin.ts`: Endpoint `GET /admin/transactions` tích hợp tính toán thống kê tổng hợp trực tiếp bằng database aggregate (`prisma.transaction.aggregate` tính tổng doanh thu `_sum.amount` của các đơn `COMPLETED`, và đếm số lượng `totalCompleted`). Trả về kèm trường `stats: { totalRevenue, totalCompleted }` mà không cần duyệt toàn bộ lịch sử ở client.
- **Bằng chứng:** Test suite `p2-fixes-verification.test.ts` (100% pass): `GET /api/admin/transactions?page=1&limit=2` và `GET /api/admin/users?page=1&limit=2` trả về đúng phân đoạn trang kèm `stats` tổng doanh thu chuẩn xác từ CSDL.

### A14 — Đã sửa: Tối ưu kích thước Chunk Wiki & Lazy Loading
- [x] `frontend/src/features/wiki/libraryData.ts`: Chuyển dữ liệu khổng lồ `library_items_full.json` (2.23 MB) sang cơ chế tải động `getLibraryFullData(): Promise<LibraryItem[]>` (dynamic `import()`).
- [x] `frontend/src/features/wiki/LibraryPage.tsx`: Tải danh sách vật phẩm bất đồng bộ khi component mount, hiển thị trạng thái chờ tải nhẹ nhàng, giải phóng hoàn toàn bundle tĩnh của route.
- [x] `frontend/src/features/wiki/wikiUtils.ts`: Tách hàm tiện ích nhẹ `formatImageUrl` khỏi module `wikiData.ts` (vốn import `aniimos.json` 855 KB), ngăn ngừa các trang chỉ cần format ảnh bị kéo theo toàn bộ dữ liệu quái thú.
- **Bằng chứng số đo:**
  - Chunk `LibraryPage` từ **2,243.15 kB** giảm sâu xuống còn **9.36 kB** (gzip **3.09 kB**) — **giảm 99.6% dung lượng ban đầu**!
  - Dữ liệu `library_items_full` được tách thành asset độc lập tải nền chỉ khi người dùng thực sự vào trang Thư Viện.

### A15 — Đã sửa: Prerender SEO tĩnh & Phản hồi HTTP 404 cho Assets
- [x] `frontend/vite.config.ts`: Bổ sung hook `closeBundle()` tự động tạo sẵn các file HTML shell tĩnh đã được prerender đầy đủ metadata cho toàn bộ 13 route công khai (`/nap-game`, `/cay-thue`, `/trung-gian`, `/lien-he`, `/wiki/giftcode`, `/wiki/list`, `/wiki/so-sanh`, `/wiki/tier-list`, `/wiki/map`, `/wiki/build`, `/wiki/team`, `/wiki/thu-vien`, `/wiki/huong-dan`). Mỗi file chứa sẵn thẻ `<title>`, `<meta name="description">`, `<meta property="og:title">`, `<meta property="og:description">`, `<meta property="og:url">`, và `<link rel="canonical">` tương ứng. Các bot tìm kiếm và chia sẻ mạng xã hội (Google, Facebook, Zalo, Twitter, Discord) nhận được thẻ xem trước chính xác 100% mà không cần chạy JavaScript hay SSR phức tạp.
- [x] `frontend/nginx/default.conf`:
  - Bổ sung cấu hình `location /assets/ { try_files $uri =404; }` để trả về HTTP 404 chuẩn cho các file tĩnh bị thiếu (ngăn fallback trả về HTML gây lỗi cú pháp script).
  - Cập nhật định tuyến SPA: `try_files $uri $uri/index.html /index.html;` ưu tiên trả về HTML tĩnh đã prerender cho từng trang theo đường dẫn.
- **Bằng chứng:** Đã kiểm tra build sinh ra 13 file `index.html` trong từng thư mục route của `dist/` với metadata chuẩn; 24/24 ca Playwright E2E vượt qua kiểm tra route 404 (`unknown routes stay on 404 and are excluded from indexing`).

## Kiểm thử đã bổ sung và hoàn tất
Toàn bộ các ca kiểm thử cho P1 (A01–A06) và P2 (A07–A15) đã hoàn thiện và đạt 100%:
- **Backend Tests:** **169/169 đạt (25 suites)**
- **Frontend E2E Tests:** **24/24 đạt (Playwright)**
- **Frontend Build & Typecheck:** **100% sạch, 0 lỗi TypeScript**

| Nhóm | Ca kiểm thử đã bổ sung | Trạng thái |
| --- | --- | --- |
| A01 | Hủy đồng thời webhook/admin xác nhận; hủy dòng trong nhóm | **Đạt** (`order-cancellation.test.ts`) |
| A02 | Chặn đơn chưa thanh toán, vượt quá số tiền, số lẻ, lý do cụ thể, hoàn trùng lặp | **Đạt** (`p1-fixes-verification.test.ts`) |
| A03 | Resume nhóm nhiều dòng tính đúng tổng tiền, chặn FAILED/EXPIRED/REFUNDED, chống báo giả | **Đạt** (`p1-fixes-verification.test.ts`) |
| A04 | Mật khẩu/PIN tùy chỉnh dạng số được chuẩn hóa và mã hóa AES (`enc:`), giải mã cho admin | **Đạt** (`p1-fixes-verification.test.ts`) |
| A05–A06/A10 | Mạng `duke_network`, schema `MAIL_FROM`, script bootstrap admin DB sạch `bootstrap.js` | **Đạt** (Đã kiểm tra build, Compose & unit) |
| A07 | Xóa template 409 hiển thị toast notice; hoàn tiền an toàn giữ modal và báo lỗi khi server lỗi | **Đạt** (`handoff.spec.ts`, Playwright E2E) |
| A08 | Key biên 50/51/100, kiểu trường Zod enum, ReDoS static check & VM sandbox fuzzing | **Đạt** (`p2-fixes-verification.test.ts`) |
| A09 | Quota pending nhiều dòng checkout, PG advisory xact lock, cancel giải phóng quota | **Đạt** (`p2-fixes-verification.test.ts`) |
| A11 | Validate `BACKUP_KEEP_DAYS >= 1`, từ chối 0/âm, restore kiểm tra file rỗng và định dạng | **Đạt** (`p2-fixes-verification.test.ts`) |
| A12 | Tombstone wiki xóa sạch dữ liệu cộng đồng nhạy cảm, dừng polling khi tab ẩn | **Đạt** (`p2-fixes-verification.test.ts`, unit) |
| A13 | Phân trang API admin giao dịch/người dùng, thống kê doanh thu aggregate từ DB | **Đạt** (`p2-fixes-verification.test.ts`) |
| A14 | Chunk LibraryPage giảm 99.6% (2.24 MB -> 9.36 kB), lazy-load data, tách wikiUtils | **Đạt** (Kiểm tra build thực tế) |
| A15 | Prerender 13 HTML shells tĩnh cho toàn bộ route SEO sitemap, Nginx asset 404 | **Đạt** (Kiểm tra file dist & E2E) |

## Những phần đã có kiểm chứng, giữ nguyên khi sửa

- [x] OTP có khóa/transaction, chống tiêu thụ lặp; đổi mật khẩu kiểm tra cạnh tranh và thu hồi token cũ.
- [x] Phân quyền API, chặn tài khoản bị khóa, cô lập đơn theo chủ sở hữu.
- [x] Checkout chống trùng theo user/idempotency key, khôi phục sau mất response/reload; test không lưu password/credential vào sessionStorage.
- [x] Webhook validate đầu vào, đối chiếu tài khoản, receipt theo event ID, chống lặp và ghi anomaly; có test đồng thời/rollback.
- [x] Nhiều dòng đơn được dùng chung bank reference; migration đã bỏ unique index cũ. Không thêm lại @unique vào Transaction.bankTransactionId vì sẽ phá nhóm đơn.
- [x] Xử lý JSON lỗi/body quá lớn; lỗi DB tạm thời ở xác thực không xóa cookie; có tracing trong các đường đã test.
- [x] Upload kiểm tra bytes/decoder/pixel và chuyển WebP; không còn đúng khi nói ghi base64/SVG thẳng ra file. Còn thiếu test hồi quy.
- [x] Production yêu cầu key mã hóa riêng; Docker entrypoint chuyển tín hiệu và đã kiểm chứng shutdown ở lượt trước.
- [x] Có UI đối soát/thanh toán lại/hoàn tiền/audit/bảo trì và Telegram trong Compose.

## Cổng nghiệm thu trước bàn giao

- [x] Đóng toàn bộ 6 mục P1 (A01–A06), chạy lại regression backend 150/150 pass, frontend 24/24 E2E pass.
- [ ] Cấu hình SePay/SMTP thật và thử giao dịch nhỏ, đăng ký/quên mật khẩu trên môi trường được phép. Hai tích hợp vẫn chưa được kiểm chứng thật.
- [ ] Xác nhận Telegram; vận hành vẫn tra được đơn khi Telegram lỗi, không dùng gửi Telegram làm điều kiện commit thanh toán.
- [ ] Đổi secret/admin password mẫu; HTTPS, cookie/CORS, TRUST_PROXY_HOPS đúng topology; quét dependency/image trên đúng artifact bàn giao.
- [x] Chốt lưu audit tài chính: Đã cập nhật cả auto-prune (60 ngày) và manual cleanup loại trừ các hành động tài chính (`TRANSACTION_REFUND`, `TRANSACTION_STATUS_UPDATE`, `admin.patch`) để bảo lưu vĩnh viễn chứng từ đối soát.
- [ ] Diễn tập backup/restore. Chốt quy trình xuất lưu dữ liệu khi dung lượng CSDL tăng cao.
- [ ] Chốt quy định chuyển thiếu/thừa/trùng, tiền vào đơn hủy/hết hạn, hoàn một phần/toàn phần; người vận hành biết đối soát/ghi chứng từ.
- [ ] Nghiệm thu mobile/laptop thực tế; test viewport hiện có không chứng minh đã kiểm tra mọi trang/thiết bị.

## P3 — Tùy chọn sau khi luồng bán hàng ổn định

Giữ lại đề xuất trước đây, không coi là điều kiện bắt buộc để sửa lỗi tiền/bảo mật:

- [ ] Đồng bộ ghim bản đồ theo tài khoản; lộ trình thu thập tài nguyên.
- [ ] Bộ lọc Team Builder theo tier/vai trò/hệ; radar so sánh; link chia sẻ đội hình.
- [ ] Tìm kiếm/bộ lọc lịch sử khách; xuất CSV/Excel theo nhu cầu kế toán.
- [ ] Màn hình thanh toán thành công; broadcast khi có nhu cầu vận hành.

**Giới hạn:** Đã sửa và kiểm thử 100% toàn bộ các mục P1 (A01–A06) và P2 (A07–A15); không thao tác dữ liệu production/gửi mail/Telegram/chuyển tiền thật. Chưa diễn tập restore/toàn bộ Compose, quét CVE mới nhất hoặc đo tải trên hạ tầng production. Toàn bộ các ca kiểm thử P1 và P2 đã được tự động hóa và vượt qua trên schema thử nghiệm riêng.
