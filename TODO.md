# Kế hoạch Hoàn thiện & Danh mục Công việc (TODO) - DUKE1305

> Cập nhật sửa lỗi: **11/10/2026**, trên bản làm việc sau commit `6cecfdd`. **Đã sửa A01–A04**, build backend và **91/91 test đạt**. Không còn P1 đã xác nhận trong phạm vi kiểm tra bên dưới; chưa phải cam kết không có lỗi chưa phát hiện hoặc đã sẵn sàng production. Cần triển khai migration trước API mới. Các mục hoàn thành cũ phía dưới là lịch sử.

## Kiểm tra bàn giao ngày 11/10/2026

Phạm vi audit ban đầu: storefront, tài khoản/OTP, thanh toán, admin/upload, wiki, cấu hình Docker/Compose, SEO và một số kích thước màn hình. Lượt sửa tiếp theo tập trung A01–A04 và các đường đọc/ghi liên quan. Chưa đo tải production.

### Kết quả sửa P1

- A01: tạo/tiêu thụ OTP khóa theo email + mục đích; tiêu thụ mã và cập nhật tài khoản chung transaction. Test đồng thời, giới hạn 5 lần sai và rollback cho đăng ký/reset đạt.
- A02: bắt buộc ID webhook là số nguyên dương an toàn; ghi receipt và thanh toán chung transaction. Test thiếu/sai ID, retry và cùng ID trỏ sang đơn khác, đơn nhiều sản phẩm đạt. Bỏ ép `tx as any` ở webhook.
- A03: webhook chỉ chuyển PENDING sang PROCESSING, giữ COMPLETED/FAILED/REFUNDED. Test webhook đến muộn và admin hoàn tất đồng thời không cộng chi tiêu hai lần đạt.
- A04: lưu `topupFields` theo thời điểm tạo đơn; che thông tin theo metadata lịch sử, không phụ thuộc template hiện tại. Dữ liệu legacy thiếu metadata được che thận trọng và mã hóa các chuỗi; admin vẫn giải mã được khi xử lý đơn. Test mất package, thay đổi template, cache checkout, chạy migration lặp và phản hồi đổi trạng thái đạt.
- Đã chạy lại `npm run build --prefix backend`, `npm test --prefix backend`: **91/91 đạt**, trong schema thử nghiệm riêng. Không chạy lại frontend/browser trong lượt sửa backend này.
- **Triển khai còn cần:** backup DB + giữ encryption key, dừng API cũ, chạy schema migration `20261011160000_topup_field_snapshot` và migration dữ liệu trước API mới; xem README. Chưa chạy lên DB ứng dụng/production. Với đơn cũ không rõ loại trường, UID cũng bị che ở phía khách.

### Kết quả đã chạy

- Build backend, typecheck và build frontend: đạt.
- Backend: **82/82 test đạt**, chạy trong schema thử nghiệm riêng và đã dọn schema.
- Frontend Playwright: **13/13 test đạt** sau khi chạy Vite tại cổng 5173. Lần chạy đầu không có server nên `ERR_CONNECTION_REFUSED`; đó là lỗi điều kiện chạy test, không phải 13 lỗi sản phẩm.
- Kiểm tra thêm `/nap-game`, `/lien-he`, `/wiki/list`, `/wiki/so-sanh`, `/wiki/map`, `/wiki/build` tại **390 / 820 / 1366 px**: không tràn ngang toàn trang, không ghi nhận `pageerror`, với API giả lập. Chưa đánh giá đầy đủ bàn phím, cảm ứng, tương phản và mọi modal trên thiết bị thật.
- `docker compose config --quiet` với biến môi trường giả: đạt. Chưa build/chạy lại toàn bộ stack Node 22 hiện tại hoặc quét CVE image hiện tại.
- Kiểm tra helper upload: PNG hợp lệ được chuyển sang WebP; SVG và ảnh rộng 9.000 px bị từ chối với 400. Chưa có test hồi quy upload trong bộ test hiện tại.

### P1 — Đã sửa; mô tả dưới đây giữ lại bằng chứng trước sửa

- [x] **A01 — OTP reset mật khẩu chưa được tiêu thụ nguyên tử.**
  - Vị trí: `backend/src/routes/auth.ts:100`, `:119`, `:177`.
  - `findFirst(consumedAt: null)` và cập nhật `consumedAt` tách rời; cập nhật mật khẩu tiếp tục nằm ngoài thao tác tiêu thụ mã.
  - Tái hiện bằng dữ liệu giả: gửi 4 request reset đồng thời cùng email/mã, nhận **3 phản hồi 200 và 1 phản hồi 400**. Một mã dùng được nhiều lần và mật khẩu cuối cùng phụ thuộc request hoàn thành sau.
  - Sửa: khóa/claim OTP có điều kiện trong transaction, đồng thời cập nhật tài khoản; bảo đảm lỗi cập nhật tài khoản không làm mất mã và giới hạn số lần thử vẫn đúng khi chạy đồng thời.
  - Nghiệm thu: cùng OTP chỉ một request thành công; mã không bị mất khi transaction rollback. Bao phủ cả đăng ký và reset.

- [x] **A02 — Webhook thiếu cả ID và reference vẫn được xử lý, bỏ qua bảng chống trùng.**
  - Vị trí: `backend/src/routes/payments.ts:13`, `:134`, `:140`.
  - `id` và `referenceCode` đều optional; khi không có cả hai, `receiptExternalId` là null và không ghi `PaymentReceipt`.
  - Tái hiện với API key thử nghiệm đúng và tài khoản nhận tiền đúng: hai payload không có định danh, khớp hai mã đơn, đều trả **200**, cả hai đơn thành **PAID**, số receipt bằng **0**. Đây là thiếu kiểm soát ở webhook đã xác thực, không phải bypass API key.
  - Sửa: yêu cầu ID SePay hợp lệ, số nguyên an toàn, không nhận boolean qua coercion; receipt phải được ghi cùng transaction cập nhật thanh toán. Không yêu cầu reference ngân hàng luôn có giá trị, vì field đó có thể rỗng.
  - Nghiệm thu: thiếu ID/ID sai trả 400 và không đổi đơn; cùng ID retry hoặc đổi nội dung sang đơn khác không thể thanh toán lần hai; một giao dịch vẫn thanh toán được nhiều dòng sản phẩm.

- [x] **A03 — Webhook mở lại đơn đã hoàn tất và có thể làm cộng chi tiêu hai lần.**
  - Vị trí: `backend/src/routes/payments.ts:156`, `:160`; `backend/src/routes/admin.ts:783`–`:796`.
  - Admin được đổi trạng thái sang COMPLETED dù paymentStatus còn PENDING. Webhook lọc theo paymentStatus nhưng luôn đặt trạng thái xử lý thành PROCESSING, bỏ qua trạng thái hoàn tất/thất bại/hoàn tiền hiện tại.
  - Tái hiện: đơn **10.000đ** → admin COMPLETED → webhook đến → trạng thái trở lại PROCESSING → admin COMPLETED lần nữa → `User.totalSpent = 20.000đ` dù chỉ một đơn.
  - Sửa: thống nhất quy tắc chuyển trạng thái thanh toán và xử lý đơn giữa admin/webhook; không ghi đè trạng thái cuối; bảo đảm cập nhật tổng chi tiêu nhất quán và nguyên tử.
  - Nghiệm thu: test webhook đến sau COMPLETED/FAILED/REFUNDED, webhook lặp và thao tác admin đồng thời; không cộng hai lần hay tự phục hồi đơn đã kết thúc.

- [x] **A04 — Mật khẩu legacy với key tùy chỉnh vẫn lộ khi đã mất package/template.**
  - Vị trí: `backend/src/scripts/migrate_passwords.ts:24`; `backend/src/routes/orders.ts:391`; `backend/src/utils/crypto.ts`.
  - Migration nhận diện key tùy chỉnh theo template hiện tại. Nếu package/template đã bị xóa, plaintext `credential` không được mã hóa; endpoint chi tiết đơn cũng không biết field đó là password.
  - Tái hiện: giao dịch cũ `packageId = null`, `topupInfo.credential` chứa mật khẩu giả → chạy migration → **0 giao dịch được mã hóa** → chủ đơn GET chi tiết nhận lại **plaintext**. Không phải lộ đơn của người khác; sai ở yêu cầu che thông tin nhạy cảm cho khách.
  - Sửa: có cách xử lý an toàn dữ liệu không còn metadata; không suy luận rằng key lạ là công khai. Che phản hồi khách và lập kế hoạch chuyển đổi dữ liệu cũ mà không phá thông tin cần cho admin hoàn tất đơn.
  - Nghiệm thu: bao phủ template bị xóa/đổi loại field, package bị xóa, cả cache checkout và endpoint chi tiết đơn.

### P2 — Cần hoàn thiện kiểm thử, cấu hình và trải nghiệm

- [ ] **A05 — Chính sách mật khẩu vẫn cho phép 6 ký tự.** `backend/src/routes/auth.ts:33` và frontend hiện dùng tối thiểu 6; danh sách chặn chỉ có vài chuỗi thông dụng. Chốt chính sách bàn giao mạnh hơn và áp dụng đồng nhất cho đăng ký/reset/đổi mật khẩu, nhưng vẫn cho tài khoản cũ đăng nhập. Không đánh dấu việc tăng lên 12 là đã hoàn thành trên bản hiện tại.
- [ ] **A06 — Bổ sung test cho các nhánh bảo mật mới.** Đã bổ sung hồi quy A01–A04, hiện 91/91 đạt. Còn test upload ảnh giả/hỏng/quá pixel, CSRF thiếu header/Origin ngoài allowlist. Test webhook đã kiểm tra trạng thái DB và receipt thay vì chỉ HTTP 200.
- [x] **A07 — Bỏ ép `tx as any` ở webhook.** Dùng delegate có kiểu thật; đã regenerate Prisma Client và build/test đạt. README ghi rõ generate trước build; Docker đã có bước generate.
- [ ] **A08 — SEO của HTML ban đầu chưa theo từng trang.** `frontend/src/app/Seo.tsx` chỉ đổi metadata trong `useEffect`; Nginx dùng chung `index.html` cho các route. HTML production kiểm tra được chỉ có tiêu đề/mô tả chung, không có nội dung trang trong `#root`. Nếu bàn giao yêu cầu preview chia sẻ/SEO theo trang, cần render/prerender metadata phù hợp và kiểm tra bằng công cụ thực tế. Không kết luận rằng mọi công cụ tìm kiếm đều không index được SPA.
- [ ] **A09 — Đo và giảm chi phí tải các trang wiki lớn.** Build hiện tại: Library khoảng **2.24 MB JS / 237 KB gzip**, marker bản đồ **1.21 MB / 122 KB gzip**, wikiData **613 KB / 62 KB gzip**. Đây là kích thước bundle đo được, chưa phải kết quả Core Web Vitals. Đo trên mạng/máy yếu, rồi tách dữ liệu theo trang hoặc tải theo nhu cầu; không suy ra trang chủ phải tải toàn bộ các chunk lazy.
- [ ] **A10 — Hoàn thiện hướng dẫn triển khai và khôi phục.** Compose đã có job migrate và backend chờ job thành công, nhưng README chưa mô tả quy trình triển khai mới, encryption key, CSRF header và topology proxy. Ghi rõ backup trước migration, giữ key giải mã cũ, cách rollback và thử restore; script `restore.ps1` còn tồn tại nhưng lệnh `db:restore` không còn trong package.json. Kiểm tra lại image Node 22 hiện tại thay vì dùng số CVE từ image Node 24 đã quét trước đó.

### Đã xác nhận có thay đổi tốt — không tiếp tục báo lỗi cũ

- Webhook đã bắt buộc `transferType`, kiểm tra tài khoản nhận tiền và loại bỏ field dư bằng `.strip()`.
- Có bảng `payment_receipts` với khóa unique ở mức giao dịch nhận tiền; **không thêm unique trực tiếp vào từng dòng `Transaction.bankTransactionId`**, vì một khoản chuyển có thể thanh toán nhiều sản phẩm. Đã bỏ nhánh xử lý thiếu receipt theo A02.
- Compose bắt buộc encryption key; backend production kiểm tra chiều dài key. Không còn chạy migration dữ liệu trong CMD của từng API container.
- Upload đã có kiểm tra bytes, giải mã/tái mã hóa WebP, giới hạn dung lượng/pixel và từ chối SVG ở endpoint upload. Không coi đây là đã kiểm chứng mọi đường lưu ảnh/settings cũ.
- Đã có header bảo vệ CSRF cùng allowlist Origin và biến cấu hình `TRUST_PROXY_HOPS`. Cần test hồi quy và kiểm chứng trên topology triển khai thật.
- Test frontend xác nhận không lưu password/credential trong checkout storage và reload giữ đơn đã tạo.

### Chưa kiểm chứng trong lượt này

- SMTP và thanh toán ngân hàng thật; không coi thiếu tích hợp đã thông báo là lỗi mới.
- Triển khai HTTPS thực tế, nhiều replica, tải lớn, toàn bộ CVE của image hiện tại, backup/restore thực tế.
- Mọi màn hình/modal, trình duyệt và thiết bị thật; dữ liệu wiki lớn được đọc theo luồng sử dụng, không kiểm chứng thủ công từng bản ghi hoặc từng tọa độ.
- Không chạy migration hoặc chỉnh dữ liệu production. Các tình huống tái hiện dùng dữ liệu giả trong schema riêng, đã dọn sau khi chạy.

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
