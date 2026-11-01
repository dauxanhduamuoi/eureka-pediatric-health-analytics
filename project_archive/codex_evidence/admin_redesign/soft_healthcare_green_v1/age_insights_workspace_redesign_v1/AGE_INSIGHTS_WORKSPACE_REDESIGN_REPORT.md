# Age Insights Workspace Redesign V1

Ngày 31/10/2026. **PASS_WITH_FINDINGS — BROWSER NOT VERIFIED.**

Đã triển khai riêng màn hình Phân tích độ tuổi. Không mở lại task Distinctive UI đã hủy; giữ nguyên Dashboard, Seasonal và Area Insights hiện tại.

## Audit và baseline

Source trước sửa có SHA-256 `5ca95b213081b3ad34e01b352044970a0d80d4a583c4c244b3eaf5c25a04b181`, khớp AgeAnalysis Eureka/snapshot B trong `DoiChieu_Source/audit_frontend_admin_v2/ADMIN_SCREEN_COMPARISON.csv`, được phân loại PARTIAL. Đây là đối chiếu source, không phải xác minh hình ảnh. Bản trước sửa của entry, AppPages và hai test consumer được lưu tại `source_before/`.

Baseline task gồm 584 file hiện tại, bao gồm Area Insights V1 đã hoàn thành. Không dùng Git HEAD để thay thế working tree. Mọi thay đổi chưa commit trước task được giữ trong baseline/source backup hoặc giữ nguyên tại source ngoài phạm vi.

| Contract trước sửa | Hành vi được giữ |
|---|---|
| API | `getDashboardPeriods()`, `getCasesByAgeRange({period, minMonthAge, maxMonthAge})`, `getDiseaseByAgeRange({...params, limit})`; bilingual map qua helper hiện có |
| Endpoint | `/api/dashboard/periods`, `/api/dashboard/cases-by-age-range`, `/api/dashboard/disease-by-age-range`; không sửa serializer query/API |
| Bộ lọc | Kỳ hoặc toàn bộ thời gian; khoảng tuổi theo tháng; limit 5/10/15/20/30/50. Thay đổi tự fetch, nút Cập nhật dùng để refresh/retry |
| Giá trị trống | Chuỗi tuổi trống thành undefined; kỳ trống thành undefined; giữ nguyên hàm chuyển số và điều kiện validation âm/đảo khoảng |
| Thống kê | Tổng từ `total_cases`, số nhóm từ `rows.length`, nhóm cao nhất từ hàng đầu tiên API. Không tính lại/sort lại hoặc tạo cohort tuổi mới |
| Chart | `rows.slice(0,10)`, cùng case_count, label song ngữ, thứ tự và ADMIN_CHART.primary; chart không chịu bộ lọc tìm kiếm bảng |
| Bảng | Giữ toàn bộ hàng theo limit, tìm kiếm tên thô/Việt/Anh qua helper cũ; đủ total/peak/period distribution. Giữ slice(-10) thời điểm và nhãn +N tháng |
| Phân trang | Không có phân trang trong trang cũ; không tự thêm |
| Cache | Key `sd_chart_cache_age_analysis`; cùng periods, period, minAge, maxAge, limit, total, rows, diseaseSearch; dữ liệu cache vẫn hiện khi đọc mới đang chờ |
| Quyền | Trang không có thao tác ghi/Admin-only riêng. Giữ route `age-analysis`, mapping `feature.age_analysis`, chính sách App/navigation/API hiện có |

Hai lỗi có bằng chứng trước/sau:

1. Load cũ không có guard. Test baseline tạo hai request, request mới trả tổng 222 trước, request cũ trả 111 sau và ghi đè tổng đang hiển thị. Test chẩn đoán này PASS vì xác nhận đúng lỗi, không có nghĩa baseline không có bug. Source test trước sửa được giữ ở `baseline-parity-tests.tsx.txt`.
2. Ô tháng cao nhất dùng `(peak_period_cases ?? 0)` dù trường này optional: có kỳ nhưng không có số ca vẫn hiển thị 0. Đã bỏ phép điền 0 ở presentation.

## Thiết kế và cấu trúc mới

Trước đây: header/bốn control ngang, ba StatCard ngang, chart, bảng rộng tối thiểu 900px với vùng cuộn dọc riêng. Toàn bộ state, request và JSX cùng nằm trong AgeAnalysis.

Hiện tại:

- Bộ lọc ngang tách khỏi phần giới thiệu: kỳ, một nhóm hai đầu khoảng tuổi có đơn vị tháng, và số nhóm bệnh. Không sao chép filter rail trái của Area Insights.
- Phạm vi bộ lọc và trạng thái cập nhật nằm ngay trước kết quả. Khi loading hoặc lỗi còn giữ dữ liệu cũ, có ghi chú rõ đó là kết quả được giữ lại chờ cập nhật thành công.
- Desktop đủ rộng đặt ba số liệu đã có thành một cột gọn cạnh biểu đồ chính. Khi hẹp, tổng quan và chart xếp dọc, các metric đổi cách sắp theo container.
- Bảng toàn chiều rộng phía dưới, có tìm kiếm riêng và ghi rõ tìm kiếm chỉ ảnh hưởng bảng. Tên bệnh Việt/Anh giữ đầy đủ, không truncate; bảng có vùng cuộn ngang trên màn hình hẹp, không đặt chiều cao cố định để cắt hàng.
- Giữ Soft Healthcare Green, Nunito offline và các token/theme Admin. CSS chỉ opt-in bằng `.age-insights-workspace`; không sửa global styles, shell hay legacy CSS.
- Dùng native input/select/button, label và fieldset; focus-visible; table header scope và vùng cuộn focus được. Giá trị/nhãn chữ vẫn thể hiện dữ liệu, không chỉ dùng màu.

Đây là tái tổ chức workspace và trách nhiệm module; không tạo KPI/biểu đồ tuổi giả, không đổi tên hàng loạt để che nguồn kế thừa. API, helper tìm kiếm, chart rows, state và cache được tái sử dụng có đối chiếu.

## File migration và trách nhiệm

Thêm trong `Frontend/src/app/components/age-insights/`:

- `AgeInsightsWorkspace.tsx`: entry/composition của trang, trạng thái và hành động Cập nhật.
- `useAgeInsights.ts`: state, validation, API lifecycle, cache và derived data được chuyển từ entry cũ.
- `AgeFilterPanel.tsx`: controlled inputs; không gọi API hoặc tính thống kê.
- `AgeDataViews.tsx`: tổng quan, chart và bảng; formatter số không biến giá trị thiếu thành 0.
- `AgeInsights.css`: stylesheet chuyên trách.
- `AgeInsightsWorkspace.test.tsx`: 13 tests chức năng/parity/lifecycle/accessibility.

Sửa đúng consumer:

- `Frontend/src/app/AppPages.tsx`: lazy import và entry render mới; giữ nguyên nhánh `activeTab === 'age-analysis'`.
- `Frontend/src/app/components/admin/AdminPages.regression.test.tsx`.
- `Frontend/src/app/components/admin/ChartVisuals.test.tsx`.

Hai test shared chỉ đổi import/tên entry render; giữ nguyên assertions và phần kiểm thử các trang khác. Script đối chiếu xác nhận cả ba consumer chỉ có đúng phép migration này, gồm giữ line ending trước đó.

Đã loại `Frontend/src/app/components/AgeAnalysis.tsx` sau khi migration tests/typecheck/build PASS, quét không còn import cũ, và hash file vẫn khớp cả baseline lẫn source_before. Không để lại wrapper. Tên type nội bộ `AgeAnalysisCacheState` và cache key cũ được giữ; chúng không phải entry còn thừa. Xem `entry-references.json`.

## Các sửa lỗi nhỏ và giới hạn giữ nguyên

- `requestVersion` chỉ cho request mới nhất cập nhật total/rows/error/loading/cache; cleanup vô hiệu hóa response khi unmount hoặc đổi bộ lọc. Không đổi endpoint, payload, tham số hoặc thêm abort contract.
- Khi khoảng tuổi mới invalid, request trước bị vô hiệu và loading được giải phóng, tránh kẹt nút sau khi thêm guard. Validation message/điều kiện giữ nguyên.
- Lỗi danh mục kỳ không cập nhật state sau unmount.
- Thiếu `peak_period_cases` hiển thị `—`, số 0 thật vẫn hiện 0. Khi chưa có kết quả, metric chưa biết dùng dấu `—`; không tạo hàng bệnh hoặc tự tính số thay thế.

Giữ hành vi kế thừa: cùng giới hạn API và chart 10 hàng; bảng vẫn chỉ trình bày 10 phần tử cuối của period distribution cộng nhãn +N. Nút Cập nhật refresh hai API dữ liệu; danh mục kỳ vẫn được tải ở mount. Cache vẫn lưu cả filter state và kết quả như trước, không chuyển thành schema snapshot mới.

## Kiểm thử và bằng chứng

| Kiểm tra | Kết quả |
|---|---|
| Baseline trước sửa | 19 tests / 3 files PASS (`baseline-tests.log`), gồm test chẩn đoán stale response |
| Migration trước khi loại entry cũ | 24 tests / 3 files, typecheck, build PASS |
| Targeted cuối sau loại entry | **102 tests / 10 files PASS** (`frontend-regression.log`) |
| Age workspace cuối | 13/13 PASS, nằm trong suite trên |
| Typecheck | PASS (`typecheck.log`) |
| Production build | PASS (`build.log`) |
| `git --no-optional-locks diff --check` | PASS, exit 0; log có cảnh báo LF/CRLF của working tree hiện có |
| Whitespace file sửa/thêm | 0 lỗi (`source-files-after.json`) |
| Source/API/cache parity | PASS (`source-preservation.json`) |
| Browser | **BROWSER NOT VERIFIED** |

102 tests gồm Age workspace, Area Insights V1, ChartVisuals, AdminPages.regression, AdminPageTitles, AdminContent.regression, AdminLayout, App.navigation, navigation và useAdminSectionNavigation. Không chạy lại backend/model suite.

Cases bảo vệ: payload mặc định và sau đổi kỳ/tuổi/limit, 0 tháng tuổi, âm/đảo khoảng, refresh/retry, API lỗi, loading kéo dài, total 0/no rows, nhóm không có dữ liệu không bị tạo thêm, chart 10/bảng toàn bộ, thứ tự và input đóng băng, tìm kiếm chỉ ở bảng, tên dài, zero peak, thiếu peak count, cache schema, đổi lọc liên tục/response cũ/error cũ/unmount, loading của request mới, native labels và table semantics. Không dùng mock Recharts để kết luận hình học SVG thực tế.

AST đối chiếu xác nhận giữ nguyên helper/type cache, state initializers, derived labels/chartRows/filteredRows và mọi biểu thức gọi API/load-save cache cùng object fields. Các thay đổi lifecycle và formatter được công bố ở trên, không tuyên bố toàn bộ code byte-identical sau migration.

## Responsive, theme và browser

`cua.getState()` trả apps/browsers rỗng, native pipe và browser access host unavailable. Không có ảnh Chrome mới hoặc nghiệm thu thao tác thật.

| Kích thước | Cấu hình source/CSS | Chrome |
|---|---|---|
| 1440 / 1280px | Container đủ 950px: tổng quan cạnh chart; filter ngang từ 650px | NOT VERIFIED |
| 768px | Khi container dưới 950px: tổng quan phía trên chart; filter thích ứng theo chiều rộng thực | NOT VERIFIED |
| 390px | Một cột, khoảng tuổi hai đầu, padding 14px; bảng min-width 660px cuộn trong vùng bảng | NOT VERIFIED |
| Light/dark/multicolor/developer | Dùng palette/radius/control tokens và chart preference hiện có; error có style dark riêng | NOT VERIFIED |

Parser CSS xác nhận cả 64 rules đều có scope của trang. Min-width/minmax/overflow và container queries được kiểm tra source; chưa chứng minh bằng hình ảnh rằng không tràn/chồng ở mọi viewport. Kiểm tra thủ công còn lại: bốn viewport trên, theme hiện có, tick/tooltip/tên bệnh dài, Tab/Enter/Space, lọc nhanh, tìm kiếm, scroll bảng và loading/error/retry bằng dữ liệu test. Không thao tác ghi thật để nghiệm thu giao diện.

## Safety closure

- Inventory 584 file: **580 giữ nguyên hash**, 3 consumer chỉ đổi entry, 1 entry được loại có backup khớp baseline. Các file mới chỉ thuộc module Age và evidence được yêu cầu. Area Insights, Dashboard, Seasonal, Weather/Forecast, Parent, Login, Reports, Permissions và global CSS giữ nguyên trong inventory.
- Không sửa backend/API, DB thật, model, Excel, SHAP, Medical Knowledge, `.env`, Graduation hoặc project thực tập. Không migration/import/retrain; không đổi quyền tài khoản thật.
- Không truy cập DB thật; không đưa DB vào hash inventory hoặc tự kết luận DB bất biến từ hash source.
- Không restart/kill backend, không sửa Python backend và không chạy backend tests trong khi server có thể --reload.
- Không dependency mới; không sửa font/theme global. Build chỉ sinh output theo script frontend hiện có.
- Git chỉ dùng đọc với optional locks tắt. Git index hash giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout.
- Không gọi backend/provider thật hoặc đưa dữ liệu project ra ngoài; test dùng fixtures/mock. Không xóa source ngoài entry đã được phép migration.

**PASS_WITH_FINDINGS** do browser/responsive/theme/keyboard thực tế chưa xác minh. Code, migration, parity và targeted checks đã hoàn thành. Dừng tại Phân tích độ tuổi; không mở trang/phần việc tiếp theo.
