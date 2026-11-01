# Eureka — Data Import & Management, Batch 3

**Kết luận: PASS_WITH_FINDINGS.** Bốn khu vực đã được triển khai. Regression cuối **91/91 PASS**, typecheck/build/diff-check PASS. **BROWSER NOT VERIFIED**; chưa nghiệm thu hình ảnh, responsive hoặc thao tác thật trên Chrome.

## Baseline và audit

- Baseline lấy từ working tree thực tế khi bắt đầu, không lấy Git HEAD: `baseline.json`, `git-status-before.txt` và bốn bản trong `source_before/Frontend/src/app/components/`.
- Đã đối chiếu lại tài liệu có sẵn tại `DoiChieu_Source/audit_frontend_admin_v2/`: `LEGACY_UI_INVENTORY.md` và `FRONTEND_COMPARISON_V2.md`. Inventory ghi nhận ba manager đang được DataImport sử dụng và còn kế thừa presentation. Không xóa attribution, lịch sử hoặc source của bản thực tập.
- Đọc bốn entry, API/types được gọi, `importJobs`, cache, route/permission, shared heading/details và tests liên quan trước migration.
- DataImport có hai loại upload DS-MaBenh/DS-BenhNhan, job dùng chung, thông báo và ba manager nối trong trang; không có lịch sử tác vụ riêng để đưa thêm vào UI.
- DiseaseCodes là tra cứu chỉ đọc: mở danh sách theo yêu cầu, search debounce 250ms, lọc thiếu nhóm, phân trang server; không có CRUD.
- ProvinceRegions có status, chọn file → preview → hủy/import, xem mẫu và cache invalidation. Không có danh sách toàn bộ tỉnh đã lưu, form sửa hay tìm kiếm tỉnh riêng trong manager hiện tại.
- ParentGuide có status, preview/import và danh sách đọc theo search/phân trang; không có chỉnh sửa từng hướng dẫn, duyệt hay xuất bản.
- Confirmation hiện có là bước kiểm tra file và nút Hủy trước import. Không bổ sung dialog hoặc thao tác ghi mới.

## Thiết kế và tổ chức code

| Khu vực | Trình bày mới | Nghiệp vụ được giữ |
|---|---|---|
| Nhập dữ liệu | Các hàng nguồn dữ liệu tách tên/mô tả, metadata và nút chọn file; DS-MaBenh đứng trước theo khuyến nghị đã có; trạng thái job riêng | Hai kind, File object, helper, job subscription/polling, toast, ba manager |
| Mã bệnh | Vùng tra cứu với số liệu thật, bộ lọc gắn nhãn, bảng semantic sáu cột, cuộn trong bảng và phân trang có accessible name | Lazy loading, search/filter/page-size/offset, thứ tự và các trường mã/nhóm |
| Phân miền | Hai vùng status và công cụ kiểm tra file; preview ở dưới; yêu cầu cột và mẫu mapping hiển thị rõ | Chọn/preview/hủy/import, trường tùy chọn aliases, mapping nhận từ API, cache |
| Hướng dẫn | Import/preview tách khỏi vùng đọc; mỗi nhóm là card với ba phần nội dung đầy đủ thay bảng rộng và chữ bị clamp | Bốn trường mapping cũ, chuỗi nguyên gốc, search server, page-size, paging và import |

Các entry giữ tên và default export để giữ consumers/route. Mỗi manager sở hữu hook và scope của view; không tạo route hay entry tương thích thứ hai. `useCatalogManagers.ts` giữ controller hiện có; bốn workspace đảm nhận presentation. `ManagementParts.tsx` chỉ chia sẻ metadata, feedback, preview/mẫu giữa nhóm này.

Tái sử dụng hợp lệ: React, Lucide, API/importJobs/cache hiện có, AdminPageHeading/AdminDetails, Nunito offline và tokens Admin. Không thêm dependency hoặc asset, không sử dụng AnalyticsContext/analytics-workspace.css của task đã hủy. Không tuyên bố tỷ lệ code mới hoặc khác biệt thị giác khi chưa có browser.

## Các sửa lỗi nhỏ được chứng minh

1. Baseline test tái hiện response mã bệnh cũ về sau và ghi đè truy vấn mới. Đã thêm version guard cho dữ liệu/error/loading của đọc danh sách.
2. `baseline-guide-stale.log` tái hiện cùng lỗi ở danh sách hướng dẫn trên entry cũ. Đã thêm version guard cho các lần đọc danh sách hướng dẫn. Luồng preview/import không đổi.
3. Metadata chưa đọc được dùng trạng thái chưa xác định và dấu `—`, không biến thành 0/chưa import. DataImport hiện lỗi metadata cùng nút thử tải lại chỉ đọc.
4. Promise lỗi khi đồng bộ job được hiển thị thay vì bỏ ngỏ. Polling 3 giây, subscription, localStorage và helper vẫn giữ nguyên.
5. Danh sách hướng dẫn chưa tải được không được trình bày như phản hồi rỗng thành công hoặc tổng 0. Khi API thực sự trả total=0, empty state vẫn hiển thị.

## Hợp đồng bảo toàn

- Không thay `api.ts`, endpoint, method, FormData/payload hoặc response DTO. AST đối chiếu tất cả lệnh `api.*` trong bốn controller: cùng tên và biểu thức tham số.
- `handleImport` của DataImport và `handlePreview`/`handleImport` của hai manager import giữ nguyên theo AST. Controller ProvinceRegions **12/12** statements không đổi.
- Khác biệt controller được khoanh rõ trong `contract-and-scope-check.json`: feedback metadata/job và hai guard đọc danh sách; không có khác biệt ngoài danh sách cho phép.
- Guide giữ chính xác mapping `disease_group`, `symptoms ?? ''`, `warning_signs ?? ''`, `prevention ?? ''`. Test đối chiếu chuỗi nhiều dòng, cảnh báo và phòng bệnh; không viết lại nội dung.
- Input vẫn `.xlsx`, reset input sau chọn, cùng File object được chuyển vào helper/API. Điều kiện import vẫn yêu cầu file, preview, không thiếu cột và không importing. Không tự thêm điều kiện `valid_rows > 0`; validation nội dung file vẫn thuộc API hiện có.
- Giữ invalidation Area/Chart trước import phân miền như baseline; không sửa helper, cache hoặc key `sd_active_import_job`.
- Route giữ `/?section=data-import`, permission giữ `feature.data_import`. Admin và Staff đủ quyền được route cho vào; thiếu quyền không được route cho vào. Không tự cấp quyền hoặc thay backend authorization.
- Giữ lazy disclosure hiện có của DS-MaBenh và nút xem/ẩn hướng dẫn, trạng thái tìm kiếm/phân trang, trạng thái preview sau lỗi để thử lại. Không thêm CRUD hay lịch sử giả.

## File thay đổi

**Sửa bốn file có trước:**

- `Frontend/src/app/components/DataImport.tsx`
- `Frontend/src/app/components/DiseaseCodesManager.tsx`
- `Frontend/src/app/components/ProvinceRegionsManager.tsx`
- `Frontend/src/app/components/ParentGuideManager.tsx`

**Thêm mười file:**

- `Frontend/src/app/components/DataImport.test.tsx`
- `Frontend/src/app/components/data-management/useCatalogManagers.ts`
- `Frontend/src/app/components/data-management/ImportWorkspace.tsx`
- `Frontend/src/app/components/data-management/DiseaseCodesWorkspace.tsx`
- `Frontend/src/app/components/data-management/RegionsWorkspace.tsx`
- `Frontend/src/app/components/data-management/GuidesWorkspace.tsx`
- `Frontend/src/app/components/data-management/ManagementParts.tsx`
- `Frontend/src/app/components/data-management/data-management.css`
- `Frontend/src/app/components/data-management/DataManagers.test.tsx`
- `Frontend/src/app/components/data-management/DataManagement.navigation.test.tsx`

Không đổi tên hoặc loại source. Build tạo artifact thông thường trong `Frontend/dist`. Báo cáo, script kiểm chứng và log nằm riêng trong thư mục evidence này.

## Kiểm thử

| Lượt | Kết quả | Evidence |
|---|---|---|
| Baseline trước migration | 19 PASS / 3 files, gồm diagnostic lỗi stale mã bệnh | `baseline-tests.log`, `baseline-DataManagers.test.txt` |
| A — DataImport | 4 PASS | `step-A-import.log` |
| B — Mã bệnh | 3 PASS | `step-B-codes.log` |
| C — Phân miền | 3 PASS | `step-C-regions.log` |
| Diagnostic hướng dẫn trên entry cũ | Tái hiện thành công lỗi stale | `baseline-guide-stale.log` |
| D — Hướng dẫn | 4 PASS | `step-D-guides.log` |
| Bổ sung error paths | 22 PASS | `error-path-regression.log` |
| Regression cuối độc lập | **91/91 PASS, 9 files** | `final-regression.log` |
| TypeScript | PASS, exit 0 | `typecheck.log` |
| Production build | PASS, exit 0 | `build.log` |
| `git diff --check` | PASS, exit 0 | `diff-check.log` |
| Contract/scope/hash và whitespace source mới | PASS | `verification.log`, `contract-and-scope-check.json`, `protected-hashes-after.json` |

Không cộng lặp số test giữa các lượt. Regression cuối gồm DataImport, DataManagers, DataManagement.navigation, AdminPages, AdminPageTitles, AdminLayout, App.navigation, navigation và useAdminSectionNavigation. Không chạy full frontend/backend/model suite.

Các ca bảo vệ: identity file/kind, accept XLSX, lỗi file rỗng/sai từ mock provider, job active và lỗi sync, import lỗi/không báo thành công giả, thử lại; preview/hủy/thiếu cột; metadata lỗi và 0 hợp lệ; mapping mẫu; GET/ghi mock lỗi 401/403/409/500; search không có kết quả, phân trang và stale response; chuỗi hướng dẫn đầy đủ; permission/deep link/navigation và sidebar/header regression. Xác nhận cache phân miền được gọi đúng như baseline.

Fixture là chuỗi/File tổng hợp và API mocks. Không parse workbook thật hoặc kiểm chứng validation backend qua upload thật. Test router và lỗi quyền mock không chứng minh backend RBAC/E2E thực tế. Không thay dependency shared của Parent nên không chạy thêm Parent suite.

Script kiểm chứng ban đầu so sánh cách printer in cả object hướng dẫn một dòng/nhiều dòng và báo khác định dạng. Đã lưu kết quả ở `contract-check-format-diagnostic.json`; kiểm chứng cuối so sánh từng tên thuộc tính/biểu thức giá trị và khớp hoàn toàn. Không sửa mapping hay nới assertion test nội dung để đạt kết quả.

## Responsive, accessibility và giới hạn

- CSS mới được PostCSS kiểm tra: tất cả selector nằm dưới `.data-management-scope`; không sửa global CSS/theme.
- Dùng token hiện có, kế thừa Nunito; có focus-visible, label cho input/select, native button, role alert/status, table headers và vùng cuộn bảng focusable.
- Cấu hình theo container thực: nguồn import thành hàng ba vùng khi >=950px; phân miền hai vùng khi >=700px; nội dung guide ba phần khi >=950px; dưới ngưỡng xếp dọc. Padding module giảm ở viewport <=599px; bảng có scroll riêng, nội dung dài wrap/pre-wrap.
- **1440 / 1280 / 768 / 390px: BROWSER NOT VERIFIED.** Native pipe không tồn tại; CUA trả apps=[]/browsers=[] và browser access host unavailable. Không có screenshot/E2E, không tuyên bố không tràn ngang hay các theme đã được nhìn thực tế.
- `MANUAL_BROWSER_CHECKLIST.md` ghi phần nghiệm thu còn lại, chỉ dùng browser với API mock/fixture.
- Giữ disclosure DS-MaBenh có sẵn của entry và manager để bảo toàn vòng đời fetch hiện tại. Không mở rộng task để đổi hành vi đó.
- Các thông báo chung của manager giữ chính sách baseline; không thiết kế lại controller lỗi hoặc validation backend.

## Hash và safety closure

- Inventory **612 file**; bốn source được phép sửa; **608 protected files không đổi**. Bốn bản source_before khớp hash baseline. Có hash sau sửa của cả 14 source/test/CSS.
- Không có source mới ngoài mười file được liệt kê; không có khác biệt bất ngờ trong protected inventory.
- `.git/index` không đổi. Git chỉ đọc status/diff/check; không stage/commit/push/reset/stash/clean/restore/checkout.
- Không sửa backend/Python, API, DB, model, Forecast, Weather AI/SHAP, Parent, Dashboard/Seasonal/Area/Age/AdvancedAnalytics/Notifications, Login/Reports/Permissions/Account, shared theme, `.env` hoặc Graduation. Không sửa bản thực tập.
- Không mở/ghi DB thật, không dùng DB test, migration, startup/lifespan, retrain, import Excel thật, tài khoản thật hoặc đổi quyền thật. DB thật được loại khỏi hash inventory; không khẳng định hash DB không đổi do tiến trình khác.
- Không gọi backend thật, không upload/POST/PATCH/PUT/DELETE thật, không external network, không đưa dữ liệu bệnh nhân vào evidence.
- Không kill/restart server, không cài dependency. Npm chỉ chạy test/typecheck/build.

**Dừng sau Batch 3.** Phần chưa nghiệm thu là browser/responsive/theme và backend upload/RBAC thực tế; không mở thêm redesign hoặc sửa nghiệp vụ.
