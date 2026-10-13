# TODO bàn giao — DUKE1305

> Cập nhật **13/10/2026**; **Đã hoàn tất 100% các mục P1 (A01–A06) và 2 mục P2 (A07, A10)**. Toàn bộ 150 backend tests và 24 E2E tests đạt 100%. Còn 7 mục P2 tối ưu hóa (A08, A09, A11–A15).

Mã A01–A15 dưới đây thuộc audit **13/10**, khác A01–A04 của audit **11/10** (OTP, receipt webhook, trạng thái cuối, snapshot trường nhạy cảm). Các bản sửa cũ đó vẫn còn; không coi việc dùng lại số thứ tự là lỗi cũ tái phát.

## Phạm vi và kết quả kiểm tra

Đã đối chiếu README gốc, README trong `frontend/src/services`, audit cũ với các luồng auth/OTP, checkout, webhook, quản trị, wiki, lưu trữ trình duyệt, Prisma/migrations, Docker, backup và bộ kiểm thử. Không coi lỗi trong audit 10/10 là còn tồn tại nếu code hiện tại đã sửa.

| Kiểm tra trên phiên bản hiện tại | Kết quả |
| --- | --- |
| `npm test --prefix backend` | **150/150 đạt**, 19 suites; schema thử nghiệm riêng, đã dọn sau khi chạy |
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

## P2 — Logic, xử lý lỗi và vận hành cần hoàn thiện

### A07 — Đã sửa: Admin hiển thị Toast thông báo lỗi & Form hoàn tiền an toàn
- [x] `frontend/src/features/admin/route.tsx`: Đưa `{store.notice && <div className="toast">{store.notice}</div>}` ra giao diện Admin đã đăng nhập. Lỗi server (như 409 khi xóa template đang dùng) hiển thị thông báo rõ ràng cho admin.
- [x] `frontend/src/features/admin/index.tsx`: Form hoàn tiền chuyển sang `await onUpdate(...)` có `try/catch`, trạng thái `refundSubmitting`, hiển thị lỗi `refundError` tại chỗ và không đóng modal sớm khi API thất bại.
- **Bằng chứng:** Ca test Playwright `tests/handoff.spec.ts:209` (`template deletion preserves the editor on server rejection and closes only after success`) đã chuyển từ ĐỎ sang XANH (100% pass).

### A08 — Validation template chưa đồng nhất, chưa chống ReDoS

- [ ] Đồng bộ `backend/src/routes/admin.ts:513`, `orders.ts:37` và form frontend.
- **Đã tái hiện:** template key 51 ký tự tạo thành công (admin cho tối đa 100), nhưng đặt đơn bị 400 (orders tối đa 50).
- Pattern chỉ được kiểm tra cú pháp bằng new RegExp. API admin chấp nhận `^(a+)+$`; thử với 30 chữ a + ! trong tiến trình riêng vượt timeout 2 giây. **Nếu admin cấu hình pattern như vậy**, đầu vào khách có thể nghẽn event loop API. Không có cơ chế chống ReDoS như tài liệu cũ khẳng định.
- **Hướng sửa:** thống nhất key/type/options; giới hạn regex được hỗ trợ bằng quy tắc an toàn hoặc bỏ regex tự do nếu không cần. Giới hạn độ dài pattern/input không giải quyết backtracking.
- **Nghiệm thu:** mẫu lưu được phải dùng được; test regex nguy hiểm trong tiến trình có timeout, không treo runner chính.

### A09 — Quota PENDING bị vượt bởi checkout nhiều dòng

- [ ] Sửa checkOrderCreationAllowed tại `backend/src/routes/orders.ts:213` và hai đường tạo đơn.
- **Đã tái hiện:** quota 5, tài khoản chưa có đơn, checkout 6 dòng trả 201 và tạo 6 transaction PENDING. Chỉ đếm số hiện tại, không cộng số sắp tạo; chưa khóa theo user để chống tạo đồng thời.
- Chốt quota theo nhóm checkout hay từng dòng và thực thi đúng định nghĩa. Rate limit theo IP không đồng nghĩa đã có quota PENDING theo IP như TODO cũ.
- **Nghiệm thu:** sát ngưỡng, nhiều dòng, hai idempotency key chạy đồng thời, hủy/hết hạn giải phóng quota; validate MAX_PENDING_ORDERS.

### A10 — Đã sửa: README và bootstrap production đồng bộ mã nguồn

- [x] Tạo script bootstrap chuẩn production `backend/src/scripts/bootstrap.ts` (biên dịch `dist/scripts/bootstrap.js`, npm script `db:bootstrap`) để khởi tạo CSDL sạch: chỉ tạo tài khoản ADMIN (theo `ADMIN_EMAIL` & `ADMIN_PASSWORD` >= 12 ký tự), nạp danh mục `ProductStatus`, `TopupTemplate`, cài đặt mặc định và tags mà không chèn tài khoản thử nghiệm hay dữ liệu demo vào DB production.
- [x] Bổ sung chế độ `bootstrap` trong `backend/scripts/container-entrypoint.js` để dễ dàng khởi tạo qua Docker (`docker compose exec backend node dist/scripts/bootstrap.js`).
- [x] Cập nhật `README.md`:
  - Chuẩn hóa vai trò RBAC: Chỉ có `CUSTOMER` và `ADMIN` (loại bỏ `STAFF`).
  - Sửa thông tin tài khoản đăng nhập mẫu: yêu cầu `ADMIN_EMAIL` và `ADMIN_PASSWORD` (tối thiểu 12 ký tự), chỉ rõ `customer@test.com / 123456` chỉ sinh khi chạy `npm run db:seed`.
  - Đồng bộ 100% bảng REST API Reference: `/auth/register/verify`, `GET /payments/status/:orderCode`, `PATCH /admin/transactions/:id/status` (hoàn tiền & đổi trạng thái), `/catalog/product-statuses`, `/catalog/tags`, `/orders/:code/cancel`, `PUT /auth/profile`, `POST /auth/change-password`, cookie `auth_token`.
  - Chuẩn hóa mô tả kiểm tra mẫu nạp và thời điểm cộng dồn `totalSpent` (khi đơn hoàn tất `COMPLETED`).
- [x] Cập nhật `frontend/src/services/README.md` đồng bộ toàn bộ service contracts và endpoints thực tế.
- **Bằng chứng:** Toàn bộ build, typecheck và 150/150 test backend đạt 100%. Mọi tài liệu và script đã được kiểm tra trên bản làm việc.

### A11 — Backup thiếu kiểm chứng restore; retention có thể xóa backup mới

- [ ] Validate BACKUP_KEEP_DAYS tại `backend/scripts/backup.mjs:48`: giá trị 0/âm tạo cutoff ở hiện tại/tương lai, có thể xóa file vừa dump sau khi in thông báo thành công.
- [ ] Diễn tập restore vào **database riêng** với backup tạo bởi script và service backup trong Compose. Chưa kiểm chứng định dạng backup tự động tương thích pg_restore trong restore.mjs hay cần lệnh khác.
- Script backup/restore bỏ schema khỏi URL, thao tác ở phạm vi database; tài liệu cần nêu rõ. Không dùng DB thật làm đích thử.
- **Nghiệm thu:** retention sai bị từ chối trước thao tác; restore kiểm tra đơn/receipt/anomaly/tài khoản và giải mã bằng key tương ứng; có phương án sao lưu uploads/key, cảnh báo backup lỗi.

### A12 — Wiki tải toàn bộ dữ liệu mỗi 30 giây, kể cả nội dung đã xóa

- [ ] Rà `backend/src/routes/wiki.ts:32`, `frontend/src/features/wiki/wikiStore.ts:18`, `WikiLayout.tsx:22`.
- API phân trang 200 bản ghi nhưng frontend tải hết mọi trang mỗi chu kỳ/focus và sau thao tác ghi. Request, byte tải và xử lý tăng theo toàn bộ dữ liệu cộng đồng dù chỉ mở một trang.
- GET công khai trả nguyên bản ghi deleted=true cùng data; soft-delete chỉ ẩn UI, nội dung cũ vẫn đọc được qua API. Với dữ liệu tĩnh cần tombstone, chỉ trả định danh cần thiết.
- **Nghiệm thu:** tải phần cần dùng/phần đã đổi, không tải nền khi tab ẩn; đo với dữ liệu lớn; nội dung cộng đồng đã xóa không còn trong response công khai.

### A13 — Admin/lịch sử tải hết dữ liệu trước khi phân trang UI

- [ ] Rà `frontend/src/services/api.ts:67`, admin.transactions(), admin.users(), orders.mine() và màn hình sử dụng.
- allPages tải toàn bộ theo lô 100 trước khi hiển thị. Dữ liệu tăng sẽ làm admin chậm, tăng bộ nhớ và có thể chạm rate limit; bộ lọc mới chủ yếu chạy trên mảng đã tải.
- **Hướng sửa:** phân trang/lọc trên API cho giao dịch/người dùng; thống kê dùng aggregate API.
- **Nghiệm thu:** với hàng chục nghìn đơn, trang đầu không kéo toàn bộ lịch sử; tìm kiếm/bộ lọc/tổng doanh thu đúng qua các trang.

### A14 — Chunk wiki còn lớn

- [ ] Tối ưu theo số đo, không chỉ nâng ngưỡng cảnh báo Vite.
- Build hiện tại: LibraryPage khoảng **2.243 MB** (gzip 237 KB), map_key_markers **1.205 MB** (gzip 122 KB), wikiData 613 KB. Route đã lazy-load nhưng dữ liệu trong route vẫn lớn khi mở lần đầu.
- **Nghiệm thu:** đo tải lần đầu và parse/render trên mobile chậm; tách dữ liệu theo tab/khu vực nếu vượt ngân sách bàn giao.

### A15 — SEO chủ yếu được cập nhật sau khi JavaScript chạy

- [ ] Rà `frontend/src/app/Seo.tsx`, `frontend/vite.config.ts`, `frontend/nginx/default.conf` theo yêu cầu SEO của khách.
- Metadata từng route được đổi bằng effect phía client; HTML ban đầu dùng metadata chung. Nginx fallback index.html trả HTTP 200 cho URL không tồn tại dù React hiển thị 404/noindex.
- **Hướng xử lý:** nếu cần preview chia sẻ/index riêng từng trang, prerender HTML cho các trang cần SEO và có chính sách HTTP 404 phù hợp; không nhất thiết chuyển cả ứng dụng sang SSR.
- **Nghiệm thu:** kiểm tra HTML response không chạy JS, canonical/OG của dịch vụ/wiki và URL không tồn tại, không chỉ DOM sau React render.

## Kiểm thử đã bổ sung và kế hoạch tiếp theo

Đã hoàn thành bổ sung và kiểm thử thành công toàn bộ các ca kiểm thử cho P1 (A01–A06) và A07, nâng tổng số kiểm thử backend lên **150/150 đạt (19 suites)** và kiểm thử frontend lên **24/24 E2E đạt**:

| Nhóm | Ca kiểm thử đã bổ sung | Trạng thái |
| --- | --- | --- |
| A01 | Hủy đồng thời webhook/admin xác nhận; hủy dòng trong nhóm | **Đạt** (`order-cancellation.test.ts`) |
| A02 | Chặn đơn chưa thanh toán, vượt quá số tiền, số lẻ, lý do cụ thể, hoàn trùng lặp | **Đạt** (`p1-fixes-verification.test.ts`) |
| A03 | Resume nhóm nhiều dòng tính đúng tổng tiền, chặn FAILED/EXPIRED/REFUNDED, chống báo giả | **Đạt** (`p1-fixes-verification.test.ts`) |
| A04 | Mật khẩu/PIN tùy chỉnh dạng số được chuẩn hóa và mã hóa AES (`enc:`), giải mã cho admin | **Đạt** (`p1-fixes-verification.test.ts`) |
| A05–A06/A10 | Mạng `duke_network`, schema `MAIL_FROM`, script bootstrap admin DB sạch `bootstrap.js` | **Đạt** (Đã kiểm tra build, Compose & unit) |
| A07 | Xóa template 409 hiển thị toast notice; hoàn tiền an toàn giữ modal và báo lỗi khi server lỗi | **Đạt** (`handoff.spec.ts`, Playwright E2E) |
| A08–A09 | Key biên 50/51/100, regex ReDoS; quota nhiều dòng checkout | Kế hoạch P2 tiếp theo |
| A11 | Diễn tập dump/restore DB riêng, retention biên, key giải mã | Kế hoạch P2 tiếp theo |
| A12–A15 | Phân trang/tải wiki, allPages admin, chunk size, SEO prerender | Kế hoạch P2 tiếp theo |

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
- [ ] Diễn tập backup/restore. Chốt lưu audit tài chính: hiện tự xóa sau 60 ngày, cleanup mặc định 30 ngày có thể xóa cả log hoàn tiền/đổi trạng thái; thống nhất thời hạn và cách xuất lưu.
- [ ] Chốt quy định chuyển thiếu/thừa/trùng, tiền vào đơn hủy/hết hạn, hoàn một phần/toàn phần; người vận hành biết đối soát/ghi chứng từ.
- [ ] Nghiệm thu mobile/laptop thực tế; test viewport hiện có không chứng minh đã kiểm tra mọi trang/thiết bị.

## P3 — Tùy chọn sau khi luồng bán hàng ổn định

Giữ lại đề xuất trước đây, không coi là điều kiện bắt buộc để sửa lỗi tiền/bảo mật:

- [ ] Đồng bộ ghim bản đồ theo tài khoản; lộ trình thu thập tài nguyên.
- [ ] Bộ lọc Team Builder theo tier/vai trò/hệ; radar so sánh; link chia sẻ đội hình.
- [ ] Tìm kiếm/bộ lọc lịch sử khách; xuất CSV/Excel theo nhu cầu kế toán.
- [ ] Màn hình thanh toán thành công; broadcast khi có nhu cầu vận hành.

**Giới hạn:** Đã sửa và kiểm thử 100% các mục P1 (A01–A06) cùng 2 mục P2 (A07, A10); không thao tác dữ liệu production/gửi mail/Telegram/chuyển tiền thật. Chưa diễn tập restore/toàn bộ Compose, quét CVE mới nhất hoặc đo tải trên hạ tầng production. Mục “đã tái hiện” dựa trên thử nghiệm cục bộ/schema riêng; các mục P2 còn lại tiếp tục là kế hoạch hoàn thiện tiếp theo.
