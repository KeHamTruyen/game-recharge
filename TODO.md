# TODO bàn giao — DUKE1305

> Rà soát **13/10/2026**, trên code tại commit `d52c495`; đã sửa và kiểm thử **A01** trên bản làm việc. **Còn 5 mục P1 và 9 mục P2; chưa đủ căn cứ kết luận sẵn sàng production.** Các mục A02–A15 chưa được sửa trong lượt này.

Mã A01–A15 dưới đây thuộc audit **13/10**, khác A01–A04 của audit **11/10** (OTP, receipt webhook, trạng thái cuối, snapshot trường nhạy cảm). Các bản sửa cũ đó vẫn còn; không coi việc dùng lại số thứ tự là lỗi cũ tái phát.

## Phạm vi và kết quả kiểm tra

Đã đối chiếu README gốc, README trong `frontend/src/services`, audit cũ với các luồng auth/OTP, checkout, webhook, quản trị, wiki, lưu trữ trình duyệt, Prisma/migrations, Docker, backup và bộ kiểm thử. Không coi lỗi trong audit 10/10 là còn tồn tại nếu code hiện tại đã sửa.

| Kiểm tra trên phiên bản hiện tại | Kết quả |
| --- | --- |
| `npm test --prefix backend` sau sửa A01 | **141/141 đạt**, 15 suites; schema thử nghiệm riêng, đã dọn sau khi chạy |
| `npm run build:all --prefix frontend` | Typecheck frontend, build frontend/backend đạt; còn cảnh báo chunk lớn |
| Bộ E2E đầy đủ ở lượt audit trước sửa A01 | **21/22 đạt**; lỗi thông báo khi xóa template, xem A07; chưa chạy lại toàn bộ ở lượt sửa A01 |
| E2E luồng hủy đơn sau sửa A01 | **3/3 đạt**: xác nhận phạm vi hủy, báo lỗi, refresh cả nhóm tại 375/1280 px và lịch sử responsive |
| API bổ sung trên schema riêng | Đã tái hiện A01 trước sửa; A02–A04, A08 (key dài/regex), A09 còn mở |
| Render Docker Compose | Xác nhận A05–A06; chưa khởi động toàn bộ stack production |
| SIGTERM/SIGINT trên Docker thật | Đã đạt ở lượt sửa trước cùng ngày; không chạy lại trong lượt audit này |

Test trình duyệt mock API, không thay thế frontend → API → PostgreSQL thật. Không gửi mail/Telegram/giao dịch ngân hàng thật trong audit. Log nằm ở `%TEMP%/duke-audit-current-backend.log`, `duke-audit-current-build.log`, `duke-audit-current-ui.log`, `duke-audit-repros.log`.

Log sửa A01: `%TEMP%/duke-cancel-before.log` (7 test mới thất bại trước sửa), `duke-cancel-after.log` (141/141 đạt), `duke-cancel-ui.log` (3/3 đạt), `duke-cancel-build.log`. Typecheck riêng file test mới cũng đạt.

**Quy ước:** P1 cần sửa trước khi nhận đơn thật/triển khai theo hướng dẫn; P2 cần hoàn thiện hoặc ghi rõ giới hạn nghiệm thu; P3 tùy chọn. Mật khẩu tối thiểu 6 ký tự là quyết định chủ dự án đã chấp nhận, không đưa yêu cầu tăng độ dài vào danh sách bắt buộc.

## P1 — Cần sửa trước production

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

### A10 — README và bootstrap production còn sai/thiếu

- [ ] Cập nhật `README.md`, `frontend/src/services/README.md` và hướng dẫn kiến trúc cũ sau khi sửa.
- README ghi admin@test.com/123456, customer@test.com/123456; seed thực tế yêu cầu ADMIN_EMAIL/ADMIN_PASSWORD ít nhất 12 ký tự, không tạo các tài khoản mặc định này. Compose migrate không tạo admin cho DB mới; hướng dẫn chưa có bước bootstrap production khả dụng.
- API reference cần sửa: /auth/verify-registration → /auth/register/verify; /orders/:code/payment-status → /payments/status/:orderCode; POST /admin/transactions/:id/refund → PATCH /admin/transactions/:id/status; /catalog/statuses → /catalog/product-statuses. Cookie thực tế auth_token; role chỉ CUSTOMER/ADMIN.
- Mô tả regex an toàn, lý do bắt buộc, thời điểm cộng tổng chi tiêu, phạm vi giải mã thông tin nạp và một số env mặc định chưa khớp code. README services vẫn là hướng dẫn tích hợp dự kiến với endpoint cũ.
- **Nghiệm thu:** người mới làm theo tài liệu trên DB trống đăng nhập admin, tạo danh mục/gói, đặt đơn được. Không chạy seed ghi đè dữ liệu production để thay cho bootstrap an toàn.

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

## Kiểm thử còn thiếu — bổ sung khi sửa từng mục

133 test ở lượt audit xanh vẫn bỏ sót A01. Đã bổ sung test A01 và chạy 141/141 đạt; các ca còn lại trong bảng tiếp tục là kế hoạch, chưa được xem là hoàn thành.

| Nhóm | Ca cần thêm | Tiêu chí |
| --- | --- | --- |
| A01 — đã đạt | Hủy đồng thời webhook/admin xác nhận; hủy dòng trong nhóm | Không mất trạng thái/metadata tiền đã nhận; nhóm nhất quán; xem test mới phía trên |
| A02 | Chưa trả tiền, vượt tiền, số lẻ, lý do trống, hoàn lặp/đồng thời, chỉ đổi paymentStatus | Validation/audit đúng, không ghi đè chứng từ hoặc sai tổng chi tiêu |
| A03 | Resume nhóm nhiều dòng; hết hạn/hủy/hoàn; PROCESSING nhưng UNPAID | QR/số tiền/nội dung đúng; không báo đã nhận tiền sai |
| A04 | Password/PIN/key tùy chỉnh là string/number/boolean, chuỗi có 0 đầu/khoảng trắng | Mã hóa dữ liệu hợp lệ; không lọt bí mật vào Telegram/cache/log |
| A05–A06/A10 | Compose từ DB trống, env mẫu, bootstrap admin, readiness | Toàn stack chạy và admin đăng nhập được; cấu hình thiếu fail rõ |
| A07 | Xóa template 409; hoàn tiền/đổi trạng thái 500, mất mạng, gửi lặp | Thấy lỗi, giữ bản nháp, không đóng sớm/promise rejection |
| A08–A09 | Key biên 50/51/100, regex nguy hiểm; quota nhiều dòng/nhiều request | Template dùng được; không nghẽn runner/API; quota đúng |
| Bảo vệ API | CSRF thiếu/sai header, Origin lạ, cookie production, IP qua proxy, request N+1 nhận 429 | Server riêng với limiter bật; môi trường test hiện bỏ qua limiter |
| Upload | Giả MIME, SVG, file hỏng, >5 MB, quá pixel, ảnh động, ảnh hợp lệ | Reject đúng, ảnh hợp lệ thành WebP; chưa có test trực tiếp normalizeUpload |
| A11 | Dump/restore DB riêng, retention biên, key giải mã, uploads | Restore đọc được dữ liệu; không xóa backup mới/chạm DB thật |
| A12–A15 | Dữ liệu lớn, tombstone, tab ẩn, HTML không JS, mạng mobile chậm | Ngân sách tải rõ, không lộ nội dung đã xóa, SEO/404 đúng hợp đồng |
| Tích hợp | Frontend → API thật → DB thử: OTP, checkout, webhook mô phỏng, xử lý đơn/hoàn | Bổ sung ngoài Playwright mock; không gửi tiền/email thật trong CI |

## Những phần đã có kiểm chứng, giữ nguyên khi sửa

- [x] OTP có khóa/transaction, chống tiêu thụ lặp; đổi mật khẩu kiểm tra cạnh tranh và thu hồi token cũ.
- [x] Phân quyền API, chặn tài khoản bị khóa, cô lập đơn theo chủ sở hữu.
- [x] Checkout chống trùng theo user/idempotency key, khôi phục sau mất response/reload; test không lưu password/credential vào sessionStorage.
- [x] Webhook validate đầu vào, đối chiếu tài khoản, receipt theo event ID, chống lặp và ghi anomaly; có test đồng thời/rollback.
- [x] Nhiều dòng đơn được dùng chung bank reference; migration đã bỏ unique index cũ. Không thêm lại @unique vào Transaction.bankTransactionId vì sẽ phá nhóm đơn.
- [x] Xử lý JSON lỗi/body quá lớn; lỗi DB tạm thời ở xác thực không xóa cookie; có tracing trong các đường đã test.
- [x] Upload kiểm tra bytes/decoder/pixel và chuyển WebP; không còn đúng khi nói ghi base64/SVG thẳng ra file. Còn thiếu test hồi quy.
- [x] Production yêu cầu key mã hóa riêng; Docker entrypoint chuyển tín hiệu và đã kiểm chứng shutdown ở lượt trước.
- [x] Có UI đối soát/thanh toán lại/hoàn tiền/audit/bảo trì và Telegram trong Compose. Có chức năng không đồng nghĩa A01–A15 đã hoàn thiện.

## Cổng nghiệm thu trước bàn giao

- [ ] Đóng P1, chạy lại regression backend/frontend, xử lý E2E đang đỏ; thống nhất giới hạn P2 bằng văn bản.
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

**Giới hạn:** đã sửa code/test cho A01, chưa sửa A02–A15; không thao tác dữ liệu production/gửi mail/Telegram/chuyển tiền thật. Chưa diễn tập restore/toàn bộ Compose, quét CVE mới nhất hoặc đo tải trên hạ tầng production. Mục “đã tái hiện” dựa trên thử nghiệm cục bộ/schema riêng; các mục khác có căn cứ đọc code hoặc bước nghiệm thu cần làm.
