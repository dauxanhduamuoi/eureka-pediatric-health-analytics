# Admin content redesign V1

Ngày 29/10/2026. **PASS_WITH_FINDINGS**.

Đã xử lý nội dung của **17 section Admin/Staff trên source**, giữ shell/branding/route/quyền hiện có. Full frontend **501 PASS / 0 FAIL**, typecheck và production build PASS. **BROWSER / VISUAL NOT VERIFIED**: chưa thể nghiệm thu hình ảnh hoặc khẳng định tất cả trang đã đẹp/không overflow ở các breakpoint thật. Hash toàn file DB thật thay đổi trong phiên; các bảng theo dõi không đổi, không có thao tác ghi DB thật từ task.

## 1. Baseline và phạm vi audit

- Workspace đúng `ThucTap-main`; không có AGENTS.md được tìm thấy trong workspace.
- Working tree đã dirty trước task; `baseline.json` ghi 516 file bảo vệ, HEAD/index và snapshot DB read-only. `source_before/` giữ frontend source trước sửa.
- Baseline frontend: **489 PASS / 0 FAIL / 24 files** (`tests_before.json`).
- `inventory.json` kiểm kê 17 route, component, mode, permission, dependency component, hàm API/domain, chart và handler. Đây là inventory tĩnh; không tuyên bố mọi nhánh API đã được chạy.
- Đọc API/dashboard backend để xác minh ngữ nghĩa KPI và phạm vi tổng hợp, không sửa backend hoặc gọi endpoint production.
- Các component Import, quản trị quyền, Reviewed/Auto, nguồn/draft/cấu hình y khoa và phần giải thích dùng chung đã được đối chiếu dependency. Parent và các tính toán SHAP/Medical Knowledge không nằm trong phần sửa.

## 2. Kiểm kê và bố cục trước/sau

Mọi URL dưới đây vẫn là `/?section=<section>`. Không thêm route nghiệp vụ.

| Section / component | Mục đích UX và thông tin ưu tiên | Trước → sau | API / quyền được bảo toàn |
|---|---|---|---|
| dashboard / DashboardOverview | Hiểu nhanh tình trạng dữ liệu và diễn biến | Bốn card lớn, lặp “Hiện tại”, chart năm cao → strip chỉ số gọn; toolbar mỏng; chart năm 230px, cảnh báo tháng thiếu vẫn hiện; thành phần theo kỳ/bảng dự báo ở vùng mở rộng | overview, monthly/yearly cases, top groups, forecast; feature.dashboard |
| seasonal / SeasonalAnalysis | Đọc xu hướng năm và đối chiếu mùa đúng phạm vi | Ba card cao, phạm vi trộn, stacked area → summary có số tháng quan sát; đường từng nhóm; so sánh mùa toàn dữ liệu; bảng/đối chiếu lịch sử ở vùng mở rộng | monthly-statistics, seasonal-summary/comparison/peak; feature.seasonal |
| age-analysis / AgeAnalysis | Lọc tuổi và đọc số ca theo nhóm | Card thời gian lặp bộ lọc → phạm vi tuổi/thời gian thành một dòng, ba chỉ số có dữ liệu; nhãn trục hai dòng có tên đầy đủ; bảng tìm kiếm giữ nguyên | periods, age-range APIs; feature.age_analysis |
| monthly-disease-analysis / AdvancedAnalytics monthly | So sánh nhóm trong tháng và với tháng trước | Card kỹ thuật `predict_current` chiếm một ô → ba chỉ số thực; chart/filter gọn; chiều cao bar theo số nhóm để không ép nhãn | monthly summary/top/percentage/comparison; feature.monthly_disease |
| gender-analysis / AdvancedAnalytics gender | So sánh theo giới và nhóm bệnh | Giữ phạm vi/thao tác; chuẩn hóa khoảng cách, header chart và surface, không đổi cặp series/tooltip/bảng | cases/disease-by-gender; feature.gender_analysis |
| disease-trend-analysis / AdvancedAnalytics trend | Theo dõi nhiều nhóm theo thời gian | Giữ multi-select, hover/tooltip và so sánh năm; nhịp nội dung và chart panel thống nhất | disease-trend, year-over-year; feature.disease_trend |
| areas / AreaInsights | Ưu tiên số ca/bảng xếp hạng địa lý | Giữ bộ lọc miền/tỉnh và chart chính; chi tiết nhóm bệnh, nguy cơ/khuyến nghị theo dữ liệu khu vực đưa xuống vùng mở rộng | areas/provinces, summaries, risks, recommendations/sync; feature.areas |
| forecast / Forecast | Chạy dự báo và đọc kết quả | Toolbar và chỉ số gọn; bảng, tìm kiếm, lọc, phân trang và mở chi tiết tiếp tục là nội dung chính | forecast run/summary/results, export; feature.forecast |
| weather-risk / WeatherRisk | Tách đầu vào khỏi kết quả Admin preview | Form trải ngang năm cột → workspace nhập bên trái/kết quả bên phải khi đủ rộng; stack trên màn hình hẹp; weather metrics hai cột | status/options/provinces/predict; feature.weather_risk |
| parent-disease-visibility / ParentDiseaseVisibilityPage + Settings | Tìm và quản lý nhóm hiển thị | Tab/counter/version thành toolbar; hàng danh sách gọn, vùng cuộn theo viewport; search và confirmation không đổi | visibility read/update/version/CAS; feature.parent_disease_visibility |
| medical-knowledge / MedicalKnowledgeResearchPage + AutoMedicalKnowledgePanel | Topic → nguồn → draft/review hoặc queue | Header thấp hơn, tabs rõ, workspace xét chiều rộng container; Auto counts gọn và hai vùng processing/content có trách nhiệm rõ | Toàn bộ medicalKnowledgeApi, Reviewed/Auto, nguồn/draft/settings; Admin/Staff, từng control giữ guard |
| data-import / DataImport + managers | Chọn file/đọc validation và kết quả | Import inputs vẫn hiện; tra cứu mã đã nhập chuyển vào vùng mở rộng để giảm độ dài; phân miền và hướng dẫn/preview/confirm giữ nguyên | import jobs/status, codes, province regions, parent guide; feature.data_import |
| reports / Reports | Chọn mẫu → cấu hình → xem trước → xuất | Counts lịch sử dạng strip; template gọn; cấu hình và preview theo tỷ lệ phù hợp; dùng section primitive chung | Report builders/API/data filters/download/history; feature.reports |
| permissions / PermissionsPage | Danh sách tài khoản và thao tác rõ | Grid bảng/form có cột form tối đa 320px; checklist quyền có phân nhóm/viền nhẹ | Danh sách/quyền/tạo/role/toggle/reset/delete/bulk; Admin và từng admin.* như cũ |
| settings / Settings | Preferences và lưu/reset | Hai nhóm giao diện/thông báo cạnh nhau khi đủ rộng; metadata hệ thống là chi tiết; lưu/reset vẫn luôn hiện | Preferences local; quản trị quyền vẫn ở trang riêng |
| notifications / NotificationsPanel | Xem/lọc và xử lý thông báo | Bốn card lớn → count strip; toolbar lọc và thao tác nằm gần danh sách | Notification sync/mark/clear theo cơ chế cũ; đăng nhập |
| account / Account | Hồ sơ, mật khẩu và phiên | Section dùng chung, spacing gọn, giữ bố cục hồ sơ/bảo mật/phiên và toàn bộ trường/lưu/thu hồi | Profile/password/session APIs; tài khoản hiện tại |

Những trang ít cần thay đổi cấu trúc (giới tính, xu hướng, tài khoản) được chuẩn hóa panel/spacing/nhãn thay vì ép sang cùng một dashboard. Các chart, bảng, bộ lọc và thao tác của chúng vẫn còn. Không có section bị bỏ khỏi scope source; **chưa xác minh trực quan từng trang**.

## 3. Dashboard: audit ngữ nghĩa và thay đổi

- `overview.total_records` là số dòng PatientRecord của `predict_current`, không phải số bệnh nhân duy nhất. `total_periods` và `total_disease_groups` là số giá trị distinct trong MonthlyStatistic. Giữ nguyên các giá trị và nhãn theo nghĩa bản ghi/kỳ/nhóm.
- KPI “Dự báo đã chạy” thực tế dùng `forecast.length`, tức số dòng kết quả nhóm/kỳ từ group-summary, không phải số lần chạy. Đổi nhãn hiển thị thành **Kết quả dự báo**, không đổi phép đếm/API.
- Bỏ dòng “Hiện tại” lặp dưới từng KPI, giảm icon và padding; không thêm % tăng trưởng hoặc KPI giả.
- Chart năm giữ BarChart, số ca và thứ tự từ API, tooltip có monthCount/isCompleteYear, màu năm thiếu tháng vẫn phân biệt. Chiều cao 320 → **230px**.
- Cảnh báo năm thiếu tháng vẫn nằm ngay dưới chart: năm, số tháng/12 và danh sách tháng thiếu. Không hard-code năm 2025 hoặc số tháng từ ảnh.
- Giữ Chạy dự báo/Top/Làm mới. Chart tháng 300 → 260px; chart thành phần theo kỳ 350 → 280px trong vùng chi tiết; tìm kiếm/phân trang/mở từng dòng dự báo vẫn sử dụng được sau khi mở.

## 4. Trang mùa: phạm vi, 0 và thiếu bản ghi

Audit xác nhận từ source:

1. `insights` tính peak trên các tháng có bản ghi của **năm được chọn**. Peak không bị giới hạn theo mùa được chọn; vì vậy chọn mùa mưa vẫn có thể thấy peak tháng 3/mùa khô. Nhãn mới nói rõ phạm vi này.
2. Tổng mùa hiện tại chỉ cộng các bản ghi thuộc mùa/năm; nếu không có bản ghi mùa đó thì hàm cộng vẫn trả **0**. Không thể suy ra mùa đó thực sự không có ca.
3. Phần trăm hiện có chỉ kiểm tra `prev > 0`, không kiểm tra đủ tháng hai năm, nên có thể cho -100% khi năm hiện tại chưa có bản ghi của mùa. Không thay công thức gốc; **phần trình bày chỉ hiện so sánh khi cả hai mùa có đủ tháng xuất hiện trong dữ liệu**. Khi chưa đủ, hiện “Chưa đủ phạm vi so sánh” và số tháng mỗi bên.
4. `monthlyChartData` tạo đủ 12 tháng và điền 0 sẵn. Bản sao dành riêng cho chart đổi những điểm **không có bản ghi tháng đó trong năm đó** thành `null` để tạo khoảng trống. Bản ghi có `case_count=0` vẫn là 0. Không sửa source rows, cache, phép cộng hoặc làm tròn số.
5. Xu hướng vốn chọn 5 nhóm có tổng cao nhất toàn bộ dữ liệu; Top K ở toolbar tác động API bảng chi tiết, không phải danh sách 5 nhóm xu hướng. Giữ cơ chế này và đổi nhãn phạm vi: **Mùa tóm tắt / Năm xu hướng / Top nhóm trong bảng**. Không tự thay số nhóm hoặc công thức chọn nhóm.
6. Distribution, comparativeData, top-of-season và các bảng là tổng toàn bộ dữ liệu, không lọc selectedYear như chart xu hướng. Nhãn/caption và vùng chi tiết mới nói rõ điều này. Chart lịch sử vẫn giữ tổng hiện có; cảnh báo giải thích tổng 0 khi thiếu tổ hợp mùa/năm không chứng minh 0 ca.

Kiểm tra đủ tháng chỉ xác nhận phạm vi tháng có bản ghi, **không chứng minh dữ liệu nhập đầy đủ hay chất lượng y tế của từng tháng**. Không sửa backend hoặc dữ liệu để chữa các bất thường này.

## 5. Biểu đồ và tên bệnh

- Stacked area → **LineChart không xếp chồng** cho câu hỏi “từng nhóm thay đổi theo tháng thế nào”. Giữ series, nhóm, đơn vị, điểm quan sát và trục 12 tháng; không dùng các vùng chồng làm việc so sánh từng nhóm khó hơn. Đường thẳng, không nối qua tháng chưa có quan sát.
- Distribution vẫn là bar ngang hai mùa vì phù hợp so sánh. Bỏ khoảng trái trùng lặp 140px margin + 130px axis; axis mới 136px + 8px margin; chart cao theo số hàng. Màu hai mùa vẫn amber/blue, phân biệt rõ.
- `DiseaseAxisTick` dùng chung cho mùa/tuổi/tháng: nhãn hai dòng, có dấu rút gọn khi cần; giữ nguyên tên đầy đủ song ngữ trong SVG title/aria và tooltip/bảng. Không đổi tên dữ liệu gốc.
- `DiseaseChartLegend` giữ toàn bộ tên Việt/Anh, chia cột, có vùng cuộn và focus bàn phím; không bỏ series để rút ngắn legend.
- Advanced monthly bar chart cao theo số nhóm thực tế để tránh nhãn bị ép khi chọn nhiều. Donut/forecast risk charts và ý nghĩa màu nguy cơ giữ nguyên.
- Không thêm chart library/dependency, không đổi dataKey, stack/aggregation của các chart khác hoặc nghĩa thống kê của Forecast/Weather AI.

## 6. Kiến trúc và file sửa

Tận dụng primitive có sẵn thay vì framework mới: mở rộng `AdminSection` cho title/subtitle/actions/optional icon; Reports và Account dùng lại section này. `content.css` chỉ định kiểu **main content**, không sửa Sidebar/Topbar, brand hoặc font family. `AdminStatCard` được tái sử dụng, không nhân đôi card.

**23 file có trước thay đổi:**

- `Frontend/src/app/AppPages.tsx`: import stylesheet nội dung, không đổi route/lazy/guard.
- `Frontend/src/i18n/locales/vi.ts`, `en.ts`: nhãn KPI/phạm vi mới.
- Trong `Frontend/src/app/components/`: `Account.tsx`, `AdvancedAnalytics.tsx`, `AgeAnalysis.tsx`, `AreaInsights.tsx`, `DashboardOverview.tsx`, `DataImport.tsx`, `Forecast.tsx`, `NotificationsPanel.tsx`, `ParentDiseaseVisibilitySettings.tsx`, `PermissionsPage.tsx`, `Reports.tsx`, `SeasonalAnalysis.tsx`, `Settings.tsx`, `WeatherRisk.tsx`.
- Trong `medical-knowledge/`: `MedicalKnowledgeResearchPage.tsx`, `AutoMedicalKnowledgePanel.tsx`, `AutoMedicalKnowledgePanel.test.tsx`.
- Trong `admin/`: `AdminSection.tsx`, `AdminPages.regression.test.tsx`, `permissions/PermissionControls.tsx`.

**10 file mới trong `Frontend/src/app/components/admin/`:**

- `AdminDetails.tsx`: vùng chi tiết native, không thêm fetch/state nghiệp vụ.
- `DiseaseAxisTick.tsx`, `DiseaseChartLegend.tsx`: trình bày nhãn/legend đầy đủ, dùng nhiều nơi.
- `seasonalPresentation.ts`, `SeasonalSummary.tsx`, `SeasonalCharts.tsx`: chỉ metadata quan sát và chart/view mùa; không chứa API hoặc thay aggregation.
- `content.css`: token spacing, toolbar, metric strip, panel và grid theo nhiệm vụ.
- `seasonalPresentation.test.tsx`, `AdminContent.regression.test.tsx`, `AdminWorkflows.content.test.tsx`: kiểm thử mới.

Hai test cũ cập nhật có chủ đích: Import mở phần tra cứu rồi xác nhận manager còn dùng được; Auto MK kiểm tra hai region thực trong container mới thay vì class Tailwind đã thay. Không bỏ assertion nghiệp vụ hoặc sửa để giấu lỗi.

## 7. Chức năng và contract được giữ

`content_contract.json` đối chiếu AST **17 file source**: hooks/state, domain API calls/payloads, field/event attributes và handler đều PASS. Có ngoại lệ được ghi rõ: nhãn KPI kết quả dự báo; không so prop KPI hoặc type/mark chart vì thuộc redesign. Đây là đối chiếu tĩnh, không thay cho E2E.

Auth/session, navigation/permission policy, defaults, validation, filter/search/sort/pagination, Forecast handlers, Weather payload/reset/pagination, visibility/CAS, Reviewed/Auto/source/draft/worker gates, import và report builders không thay. Vùng mở rộng giữ children mounted như trước; không tạo API trùng để lọc hoặc mở chi tiết. Các trường nhập/xác nhận bắt buộc không bị giấu; vùng Import thu gọn chỉ là tra cứu danh sách mã đã nhập.

## 8. Kiểm thử và visual QA

| Kiểm tra | Kết quả |
|---|---|
| Baseline frontend | 489 PASS / 0 FAIL / 24 files |
| Full frontend cuối | **501 PASS / 0 FAIL / 27 files** (`tests_after.json`) |
| Typecheck | PASS: `npm.cmd run typecheck` |
| Production build | PASS: `npm.cmd run build`, 2332 modules |
| Nunito local/glyph/fallback declaration | 3 PASS: `node --test src/styles/nunito.test.mjs` |
| AST contract | PASS: `node admin_redesign/soft_healthcare_green_v1/content_redesign_v1/verify_content_contract.mjs` |
| UTF-8 / từ nghi hỏng | PASS, 0 suspect (`encoding_check.json`) |
| Git whitespace | PASS: `git diff --check`, chỉ cảnh báo LF/CRLF |
| Browser/desktop/mobile thật | **NOT VERIFIED** |

12 test mới kiểm tra: phân biệt zero/thiếu tháng; không mutate input; đủ tháng hai mùa; không diễn giải -100% khi thiếu quan sát; true-zero có đủ tháng vẫn giữ %; empty; tên bệnh đầy đủ; Dashboard KPI/chart/year warning/actions/error; seasonal filter/Top/search/caption/gaps; Weather Admin payload và pagination/reset theo fixture hiện có; report lọc tháng/giá trị CSV/lịch sử thành công và lỗi/retry.

Full suite còn bao gồm navigation/Admin-Staff/Permissions, Parent 66 tests, visibility/CAS 18 tests, Reviewed/Auto/provider/source/draft controls, Forecast/Import/Settings regression và SHAP/published knowledge. Mock chart tests xác minh dữ liệu truyền vào, **không chứng minh layout SVG thật đẹp hoặc không vỡ**. Một số trang phân tích dùng source parity và full suite, chưa có test tương tác mới riêng cho từng control.

Breakpoints triển khai: 1440/1280 desktop; dưới 1280 xếp dọc workspace mùa/Weather/quyền; dưới 768 summary/settings/report stack và metric strip hai cột; Medical workspace xét container 1050px. Các smoke tests shell/bàn phím hiện có vẫn PASS. Chưa đo overflow, tooltip, chữ dài, modal hoặc tương tác vật lý tại **1440/1280/768/390px**.

`cua.listBrowsers()` trả `The browser access host is unavailable`. Không có screenshot before/after hoặc browser E2E. Hai ảnh mô tả trong yêu cầu không có ảnh đính kèm khả dụng trong turn để đối chiếu pixel; audit dựa vào source và tình huống được mô tả. Không tuyên bố tất cả trang đã đẹp hoặc nghiệm thu visual hoàn tất.

## 9. Findings và giới hạn còn lại

- Phạm vi mùa theo năm và toàn bộ dữ liệu vẫn khác nhau theo cơ chế gốc; đã gắn nhãn rõ, không tự thay query/phép tổng. Top K bảng không điều khiển 5 series xu hướng; được nói rõ thay vì âm thầm thay logic.
- Dữ liệu monthly không cung cấp chứng nhận completeness: hiện chỉ biết tháng có xuất hiện bản ghi. Không kết luận tháng không có bản ghi là 0 ca.
- ComparativeData lịch sử và phép tổng mùa cũ vẫn có zero mặc định; giữ nguyên và cảnh báo, không dùng chúng làm so sánh phần trăm đủ điều kiện.
- Forecast reads hiện có vẫn có nhánh `.catch(() => [])`; task không đổi cơ chế lỗi/API thành nghiệp vụ mới. Vì vậy số dòng kết quả không phải trạng thái sức khỏe dịch vụ hoặc số lần chạy thành công.
- Browser/visual chưa xác minh; không có kiểm thử live với dữ liệu DB thật. Các fixtures là test cô lập, không được chèn vào UI production.
- Biến động hash toàn file DB được ghi dưới đây, chưa đủ bằng chứng gán nguyên nhân.

## 10. Safety closure

`safety_closure.json` đối chiếu 516 file baseline: đúng 23 file frontend sửa và 10 file frontend mới nêu trên. Backend/model/45 features/H14/ranking/SHAP/Medical Knowledge logic, API client, permissions, navigation, Parent, font, `.env`, Excel và các file bảo vệ khác không đổi. `AdminLayout.tsx`, `AdminMainNavigation.tsx`, `App.tsx` và stylesheet shell không bị sửa trong task. Graduation không được chỉnh sửa.

Không ghi DB thật, gọi thao tác visibility/quyền/import thật, migration, retrain, restart backend hoặc tạo server preview. Không thêm dependency hoặc tải tài nguyên mạng. Test dùng mocks và browser storage JSDOM; snapshot DB read-only có `total_changes=0`.

32 bảng được theo dõi có hash/số dòng không đổi. **SHA-256 toàn file DB thật khác trước/sau**; baseline không có hash riêng bảng session động, không xác định được nguyên nhân biến động toàn file. Không tuyên bố toàn bộ DB bất biến hoặc tự quy lỗi cho process khác.

HEAD và Git index giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout. Working tree trước task được giữ lại.

**PASS_WITH_FINDINGS**: phần triển khai và kiểm thử tự động đã đạt, visual/browser và biến động hash DB được ghi rõ. Dừng, không mở phase mới, không sửa backend/AI hoặc tiếp tục redesign ngoài phạm vi.
