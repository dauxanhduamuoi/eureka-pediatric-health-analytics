# Sửa branding, tiếng Việt và điều hướng phân quyền

Ngày 29/10/2026. **PASS_WITH_FINDINGS**.

Đã sửa frontend trong ba phạm vi yêu cầu, giữ giao diện Soft Healthcare Green. Full frontend **489 PASS / 0 FAIL**; typecheck, production build và diff check PASS. Giới hạn: browser chưa xác minh; hai lỗi text backend có sẵn được giữ nguyên theo guardrail; hash toàn file DB thật thay đổi trong phiên dù không có thao tác ghi DB thật từ task và 32 bảng theo dõi không đổi.

## 1. Branding trước/sau

Nguyên nhân: redesign trước ghi cứng `Eureka.` trong `AdminLayout.tsx` và `LoginPage.tsx`, bỏ qua cấu hình dịch `brand.name` vốn đã đúng. Document title, metadata UTF-8 và cơ chế đặt title qua I18nProvider vốn đúng, không cần sửa.

Đã dùng lại `t('brand.name')` ở sidebar, login và tên sản phẩm trên topbar. Bản tiếng Việt hiển thị **Theo dõi sức khỏe trẻ em**, dùng chung nguồn với document title; giữ bản dịch tiếng Anh hiện có. Logo vẫn là icon y tế xanh. Sidebar mở có tên/mô tả; rail thu gọn vẫn giữ tên/mô tả trong accessibility tree và tooltip của logo. Topbar có tên sản phẩm trên cả mobile; không còn literal `Eureka.` trong JSX nhận diện.

Chỉ sửa chữ nhận diện. Các identifier nội bộ như `.eureka-admin`, tên thư mục, báo cáo dự án, repository và tài liệu lịch sử không bị replace hàng loạt. Parent dùng `brand.name` như trước và source Parent không đổi.

## 2. Nguyên nhân tiếng Việt và cách sửa

**Lỗi nội dung đã xảy ra trước render, không phải thiếu glyph font.** Sáu mô tả mới của Dashboard, Mùa, Forecast, Báo cáo, Thông báo và Cài đặt đã chứa ký tự `?` thay dấu, ví dụ `T?ng h?p d? li?u`. File vẫn decode UTF-8 hợp lệ; đổi font hoặc thêm charset không thể khôi phục ký tự đã mất. Placeholder chờ số liệu Dashboard cũng bị đổi từ dấu gạch dài thành `?`.

Đã phục hồi câu tiếng Việt đúng và chuyển mô tả sang các key `admin.description.*` trong vi/en để tránh ghi text lặp và lỗi khi sinh source. Cài đặt có mô tả riêng về giao diện/ngôn ngữ/thông báo sau khi tách quản trị quyền. Dashboard dùng lại `—` lúc chưa có số liệu. Không sửa nội dung y khoa hoặc dữ liệu API.

Audit `Frontend/src`: strict UTF-8 decode PASS, không còn mẫu từ nghi hỏng trong lần quét sau sửa (`encoding_after.json`). Các dấu hỏi trong URL query là cú pháp hợp lệ, đã phân loại riêng trong `encoding_before.json`; không thay chúng. Smoke tests assert nguyên câu có dấu, không chỉ kiểm tra file đọc được.

Nunito regular/italic vẫn tải từ TTF local, `font-display: swap`, fallback Segoe UI / Arial / sans-serif. Cả hai file có glyph tiếng Việt NFC/NFD và dải độ đậm 400–700, **3 kiểm tra font PASS**. Không đổi font/assets hay CSS font dùng chung. Tên sản phẩm dùng weight 700 trong scope Admin thay cho wordmark 800 cũ. Cấu hình fallback khi font lỗi được kiểm tra ở source; **chưa giả lập mất font trong browser thực tế**.

**Finding ngoài phạm vi:** `seasonal_disease_backend/app/routers/admin.py`, hàm `_set_user_permissions`, có hai thông báo validation đã chứa dấu `?` trong source: yêu cầu Admin phải có ít nhất một quyền nâng cao và cấm cấp quyền Admin cho Staff. Đây là lỗi nội dung backend, có thể hiện khi API trả lỗi tương ứng. Chỉ ghi nhận, không chỉnh backend hoặc tự thay ý nghĩa response ở frontend. Dữ liệu động từ DB/API thật chưa được truy vấn để audit encoding toàn bộ.

## 3. Phân quyền: cấu trúc và bảo toàn nghiệp vụ

Trước: Cài đặt trộn preferences và quản lý tài khoản/quyền, dùng chung state cho danh sách, phân quyền, tạo tài khoản, vai trò, khóa/mở, reset mật khẩu và tạo hàng loạt.

Sau:

- Nhóm **Vận hành**: Import dữ liệu → Báo cáo → **Phân quyền**.
- Route mới: **`/?section=permissions`**.
- Cài đặt vẫn ở `/?section=settings`, chỉ còn preferences và thông tin hệ thống; không mount danh sách hay editor quyền, không gọi API quản trị tài khoản.
- Trang Phân quyền tái sử dụng nguyên cụm tài khoản/quyền có phụ thuộc state với nhau; không tạo bản quản lý thứ hai. Bảng, tìm kiếm, lọc, phân trang, tạo tài khoản, vai trò, khóa/mở, reset, xóa theo xác nhận và tạo hàng loạt đều còn.
- Toàn bộ API, mã quyền, payload, validation, default permissions và lưu/đóng hiện có được giữ. Đóng dialog không gửi API; không biến hành vi đóng hiện có thành một cơ chế rollback draft mới.
- Lỗi lưu quyền được hiển thị ngay trong dialog đang mở, tránh nằm sau overlay và không tạo thông báo thành công giả. Bộ lọc danh sách dùng hai cột phù hợp vùng chứa, tránh bốn cột có tổng chiều rộng cứng vượt vùng danh sách.

Không tìm thấy route hoặc anchor phân quyền riêng trong Settings cũ; trước đây chỉ có nút mở modal. Để tương thích liên kết theo ý nghĩa, hỗ trợ `/?section=settings#permissions` và `#settings-users`, canonicalize sang route mới, giữ query khác. Settings thông thường không bị redirect. Anchor Parent visibility cũ vẫn hoạt động như trước.

## 4. Quyền frontend và backend

- Menu lọc bằng `canAccessTab`; section mới có `TAB_ROLES.permissions = ['admin']`, khớp policy đọc backend hiện có. Staff, kể cả có chuỗi `admin.assign_permissions` giả trong fixture, không được vào route.
- `useAdminSectionNavigation` kiểm tra quyền khi resolve direct URL/history; `PermissionsPage` có guard riêng trước khi mount hook/API quản trị. Không dựa riêng vào việc ẩn sidebar.
- Điều kiện `canAdmin` và từng quyền `admin.assign_permissions`, `admin.create_user`, `admin.reset_password`, `admin.toggle_user`, `admin.delete_user` giữ nguyên; Admin thiếu quyền thao tác vẫn bị chặn ở UI.
- Backend đọc danh sách/quyền dùng `require_admin`; API ghi dùng `require_admin_permission(...)`. Giữ nguyên cả chính sách Admin legacy chưa có quyền explicit. Không sửa role, seed, default permissions hoặc dữ liệu quyền thật.
- `verify_backend_guards.py` dùng router/dependency thật với identity test và SQLite RAM: Staff đọc/ghi bị 403; Admin thiếu assign bị 403; Admin có assign và Admin legacy đi qua guard rồi gặp target không tồn tại 404. **8 PASS**, không có request ghi thành công, **0 kết nối DB thật**, không import app.main/lifecycle.

## 5. Cấu trúc code và file thay đổi

**17 file có trước:**

- `Frontend/src/app/navigation.ts`, `useAdminSectionNavigation.ts`, `AppPages.tsx`: section, permission/legacy link và lazy composition.
- `Frontend/src/app/App.navigation.test.tsx`: direct URL, refresh, history, Staff, mobile và legacy links.
- `Frontend/src/app/components/AdminMainNavigation.tsx`: mục Phân quyền trong Vận hành.
- `Frontend/src/app/components/admin/AdminLayout.tsx`, `admin.css`, `Frontend/src/app/components/LoginPage.tsx`: branding và typography nhận diện, vẫn scope Admin.
- `Frontend/src/i18n/locales/vi.ts`, `en.ts`: key mô tả và nhãn menu; dùng branding có sẵn.
- `Frontend/src/app/components/DashboardOverview.tsx`, `SeasonalAnalysis.tsx`, `Forecast.tsx`, `Reports.tsx`, `NotificationsPanel.tsx`: chỉ text mô tả; Dashboard thêm phục hồi placeholder.
- `Frontend/src/app/components/Settings.tsx`: bỏ state/logic/UI quản trị đã chuyển; preferences giữ nguyên.
- `Frontend/src/app/components/admin/AdminPages.regression.test.tsx`: kiểm tra Settings không còn load/nhân đôi quản trị.

**8 file mới:**

- `Frontend/src/app/components/PermissionsPage.tsx`: page guard và bảng/composition hiện có.
- `Frontend/src/app/components/admin/permissions/useUserAdministration.ts`: state, handlers và policy từ Settings, 261 dòng.
- Cùng thư mục: `PermissionControls.tsx` (105 dòng), `PermissionDialogs.tsx` (117 dòng), `UserAccountForms.tsx` (129 dòng): tách phần trình bày, không nhân đôi logic.
- `Frontend/src/app/components/admin/AdminSection.tsx`: primitive section cũ dùng chung với Settings.
- `Frontend/src/app/components/PermissionsPage.test.tsx`, `Frontend/src/app/components/admin/BrandingVietnamese.test.tsx`: regression tests mới.

Không đổi tên hoặc xóa file cũ, không thêm dependency/framework. Script/báo cáo/evidence nằm trong thư mục này. `source_before/` giữ bản Settings/navigation trước task để đối chiếu.

`verify_extraction.mjs` so AST sau chuẩn hóa CRLF/LF: **14 thân hàm**, **9 biểu thức policy/filter**, tập hooks/effects và tập API calls/payloads giữ nguyên. Bao gồm lưu quyền, tạo/reset/tạo hàng loạt, tìm kiếm/phân trang, PermissionChecklist và preferences. PASS (`extraction_contract.json`); kiểm tra tĩnh không thay thế browser E2E.

## 6. Tests và browser

| Kiểm tra | Kết quả |
|---|---|
| Targeted frontend | **55 PASS / 0 FAIL**, 6 files (`targeted_tests.json`) |
| Full frontend | **489 PASS / 0 FAIL**, 24 files (`frontend_tests.json`) |
| Font local / glyph / weight / fallback declaration | **3 PASS**: `node --test src/styles/nunito.test.mjs` |
| Backend role/action dependency chain trên RAM | **8 PASS** (`backend_guards.json`) |
| Extraction parity | PASS (`extraction_contract.json`) |
| Typecheck | PASS: `npm.cmd run typecheck` |
| Production build | PASS: `npm.cmd run build`, 2325 modules |
| Git diff whitespace | PASS: `git diff --check`; cảnh báo LF/CRLF hiện có |
| Browser/visual | **BROWSER NOT VERIFIED** |

Các trường hợp mới: branding/title/login và logo rail; bảy mô tả tiếng Việt đúng nguyên câu; route mới/Settings/legacy/refresh/Back-Forward qua event state; mobile drawer; Staff/direct component guard; Admin thiếu quyền; tìm kiếm kết hợp trạng thái; giữ payload mã quyền; đóng không gửi API; lưu thành công; lỗi 403/409/500 và retry; validation/default permissions khi tạo; lỗi tải danh sách. Full suite tiếp tục kiểm tra Parent, visibility/CAS, Medical Knowledge và Weather AI hiện có.

`cua.listBrowsers()` trả `The browser access host is unavailable`. Không có browser session an toàn để xem desktop/mobile, API text thật hoặc font-failure thực tế. Không dùng unit tests/JSDOM để tuyên bố UI không vỡ. Không có screenshot hoặc live browser E2E trong task này.

## 7. Safety closure

`safety_closure.json` đối chiếu **508 file baseline**: đúng 17 file frontend sửa và 8 file frontend mới nêu trên. Không có backend, model, Excel, font/assets, Parent, `.env` hoặc đường dẫn bảo vệ khác bị chỉnh sửa. Graduation không được chỉnh sửa. API client/auth/security backend giữ nguyên.

- Không ghi DB thật, đổi quyền thật, import/migration, retrain, thay model hoặc restart backend. Backend guard verification chỉ dùng RAM và chặn kết nối engine thật; frontend dùng mocks.
- 32 bảng được snapshot không đổi; connection snapshot read-only có `total_changes=0`. **Hash toàn file DB thật trước/sau khác nhau**. Bảng session động không có hash riêng trong baseline; chưa đủ bằng chứng xác định nguyên nhân biến động toàn file. Không kết luận DB toàn bộ bất biến hoặc tự quy nguyên nhân cho một process.
- Không network lấy dữ liệu/tài nguyên ngoài; browser chỉ được kiểm tra availability, không thao tác dữ liệu sống.
- HEAD và Git index giống baseline. Không stage/commit/push/reset/stash/clean/restore/checkout. Giữ các thay đổi trước task.

**PASS_WITH_FINDINGS:** ba sửa đổi frontend đã triển khai và kiểm thử đạt; chưa xác minh visual/browser, text validation backend hỏng nằm ngoài phạm vi và biến động hash toàn DB được ghi rõ. Dừng, không redesign tiếp hoặc sửa backend.
