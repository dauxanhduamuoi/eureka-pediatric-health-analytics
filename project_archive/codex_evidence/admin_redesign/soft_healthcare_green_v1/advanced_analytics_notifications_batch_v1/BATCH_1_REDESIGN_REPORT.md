# Admin Frontend Multi-screen Redesign Batch 1

31/10/2026 — **PASS_WITH_FINDINGS**. Hoàn thành Monthly, Gender, Trend và Notifications. **BROWSER NOT VERIFIED**.

## Baseline và audit

Baseline là working tree thực tế, không phải Git HEAD. `baseline.json` lưu hash 589 file; `source_before/` giữ nguyên hai entry trước sửa. Danh sách thay đổi có trước được lưu ở `git-status-before.txt`. Area Insights V1 và Age Insights V1 nằm trong inventory bảo vệ.

Đã đối chiếu bốn dòng liên quan trong Audit V2 `ADMIN_SCREEN_COMPARISON.csv` với source đang chạy, lưu tại `audit-v2-reference.json`. Kết luận UX dưới đây dựa trên source hiện tại và tests; không coi audit lịch sử là nghiệm thu hình ảnh.

| Màn hình | Contract xác nhận trước sửa | Vấn đề presentation |
|---|---|---|
| Monthly | Kỳ và limit 5/10/15/20/30; summary, top tháng, tỷ trọng, so sánh tháng trước; không phân trang | Ba metric, hai chart ngang và chart so sánh nối tiếp; thiếu bảng đối chiếu các tên/số liệu đầy đủ |
| Gender | Hai scope độc lập month/year/all: tổng giới tính và một nhóm bệnh; chọn disease; không phân trang | Nhiều card và lưới lồng nhau; khó phân biệt hai phạm vi lọc, dữ liệu số phân tán |
| Trend | Chọn kỳ cuối, một/nhiều disease; API trend và year-over-year theo từng disease; highlight/Chỉ xem/Hiện tất cả | Picker/chips và focus panel lớn ở phía trên chart; tên focus bị clamp, không có bảng đọc số liệu tương ứng |
| Notifications | Danh sách localStorage; all/unread/bốn type; đồng bộ, đánh dấu một/tất cả, xóa một/tất cả có confirm | Bốn metric trùng thông tin với filter; action hàng chỉ có icon không label; read state và thông tin hàng khó đọc trên mobile |

NotificationsPanel chỉ được import bởi AppPages. Topbar dùng hook/helper thông báo dùng chung, không render component này. Không đổi helper, key store hoặc hook Topbar.

### API và cache giữ nguyên

- Khởi tạo Advanced: `getDashboardPeriods()`, `getDashboardDiseaseGroups()`, helper bilingual hiện có. Chọn kỳ mới nhất và disease mặc định như trước.
- Monthly: `getSummaryCard(period)`, `getTopDiseaseGroupsByMonth(period, limit)`, `getDiseasePercentageByMonth(period, limit)`, `getMonthlyComparison(period, limit)`.
- Gender: `getCasesByGender({period})` / `({year})` / `({})`; `getDiseaseByGender` với cùng scope, `diseaseGroup`, `limit:1`.
- Trend: `getDiseaseTrend({diseaseGroup,startPeriod:periods[0]?.period,endPeriod:selectedPeriod})` và `getYearOverYear(month,diseaseGroup)` cho cùng danh sách chọn; giữ flat và các pivot/sort hiện có.
- Giữ cache `sd_chart_cache_advanced_monthly`, `_gender`, `_trend` và mọi field trong `AdvancedAnalyticsCacheState`. Tìm kiếm option, giới hạn 150 disease options, các scope/limit và tự load theo thay đổi giữ nguyên.
- Notifications giữ `sd_notifications`, helper tải/ghi/đồng bộ, nội dung title/description/meta, thứ tự store và xác nhận xóa. Trang không có thao tác điều hướng từ hàng; không tự thêm link theo meta.
- Quyền/route không sửa: `monthly-disease-analysis` → `feature.monthly_disease`, `gender-analysis` → `feature.gender_analysis`, `disease-trend-analysis` → `feature.disease_trend`; Notifications tiếp tục chính sách hiện tại của App/navigation. Không đổi quyền API hoặc tài khoản.

## Thiết kế và code mới

**A — Monthly:** bộ lọc riêng theo kỳ/limit, summary gọn, chart số ca làm vùng chính và tỷ trọng có chú giải đủ tên. Chart so sánh giữ nguyên dữ liệu/series/giới hạn; bổ sung bảng chỉ đọc từ các hàng comparison đang có, gồm số ca hiện tại/trước, thay đổi và trend. Không tính KPI hoặc tỷ lệ mới.

**B — Gender:** hai vùng làm việc song song khi đủ rộng, xếp dọc khi hẹp. Mỗi vùng đặt scope cạnh nội dung của chính nó; tổng phân bố dùng bar + bảng số liệu, nhóm bệnh dùng picker + donut + bảng và tổng đã có. Không sao chép bố cục Monthly, không gộp hai scope thành một.

**C — Trend:** bộ chọn kỳ/disease riêng; chart chuỗi thời gian cạnh focus panel khi đủ rộng. Tên focus/chips có thể đọc đầy đủ. Chart year-over-year giữ cùng stack/series. Bảng chỉ đọc bên dưới hai chart dùng chính pivot đã có; ô không có quan sát hiện dấu “—”, không điền 0. Các nút làm rõ đường chỉ đổi presentation, không gọi thêm API hoặc loại dữ liệu.

**D — Notifications:** hộp thư có bộ lọc và bộ đếm thực tế từ cùng danh sách; mailbox toolbar và hàng nội dung tách rõ loại, mức độ, read state, ngày, các nút có accessible name. Giữ nguyên nội dung có sẵn; chỉ dùng placeholder khi thiếu title/thời gian. Mọi thao tác ghi vẫn do controller cũ gọi helper hiện có.

CSS chuyên trách thừa hưởng Soft Healthcare Green, Nunito, palette và token Admin. Không sửa global/theme/legacy CSS. Tất cả 74 rule analytics và 46 rule inbox đều có page scope, được xác nhận bằng parser PostCSS.

### File sửa/thêm

Sửa đúng hai file đã có:

- `Frontend/src/app/components/AdvancedAnalytics.tsx`: entry giữ default export/mode, sở hữu controller, header/loading/error và chọn presentation phù hợp.
- `Frontend/src/app/components/NotificationsPanel.tsx`: giữ state/filter/mutation handlers; ghép inbox presentation và xử lý exception được helper truyền ra.

Thêm 8 file trong `Frontend/src/app/components/advanced-analytics/`:

- `useAdvancedAnalytics.ts`: state, API/cache và derived data chuyển nguyên từ entry; thêm request version guard.
- `MonthlyWorkspace.tsx`, `GenderWorkspace.tsx`, `TrendWorkspace.tsx`: composition riêng theo dữ liệu/tác vụ từng mode.
- `AnalyticsControls.tsx`: các bộ chọn hiện có, giữ tìm kiếm/chọn/clear; sửa label association và bỏ truncate của chip.
- `TrendInteractions.tsx`: tái sử dụng logic hover/focus hiện có, đưa vào vùng làm việc mới.
- `AnalyticsPrimitives.tsx`: panel, trạng thái rỗng, formatter và table wrapper chỉ dùng trong module này.
- `analytics.css`: stylesheet mới của module; không tái sử dụng file `analytics-workspace.css` đã hủy.

Thêm `notifications/NotificationInbox.tsx`, `notifications/notifications.css` và hai test `AdvancedAnalytics.test.tsx`, `NotificationsPanel.test.tsx`. Tổng cộng 12 file source mới. Các file còn lại của task thuộc evidence.

Không đổi AppPages/lazy imports/route, không remove entry cũ vì hai entry vẫn có trách nhiệm composition/lifecycle thực tế. Không tạo wrapper tương thích. Không đọc/copy AnalyticsContext hoặc thiết kế đã rollback; không xóa attribution/lịch sử hoặc đổi tên hàng loạt.

## Correctness, lỗi và giới hạn kế thừa

1. **Stale response đã chứng minh và sửa nhỏ.** Baseline test cho thấy request tháng cũ trả sau ghi đè tháng mới trong cache. Bản test baseline được lưu riêng. `requestVersion` nay chặn response/error/finally lỗi thời ở cả ba nhánh và khi unmount. API/payload/derived math không đổi; test mới xác nhận kết quả mới và loading còn đúng.
2. **Thiếu số liệu:** formatter không biến null/undefined/nonfinite thành 0; summary thiếu top item không crash. Số 0 thật, phần trăm do API cung cấp và thứ tự đều được giữ. Không tính lại tỷ trọng để khép đủ 100%.
3. **Exception đồng bộ:** controller trước có try/finally không catch. Nay lỗi được helper truyền ra có thông báo tiếng Việt, không cập nhật lastSync giả và có thể retry; nội dung store vẫn nguyên.
4. **Giới hạn helper đồng bộ chưa đổi:** `refreshRiskNotifications()` vốn catch lỗi provider và trả 0, giống trường hợp không có thông báo mới. Test gọi helper thật với provider mock xác nhận contract này. UI không thể phát hiện lỗi đã bị helper nuốt; không tuyên bố đã sửa khả năng phân biệt mọi lỗi API. Helper dùng chung với Topbar không bị thay đổi.
5. **Ngữ nghĩa chart kế thừa:** trend vẫn `connectNulls` và monotone như trước; pivot không tạo quan sát thiếu. Gender comparison vẫn loại mục `case_count <= 0` khỏi donut theo derived logic cũ; tổng ca 0 và hàng zero của tổng giới tính vẫn được giữ. Không thay công thức other-percent hoặc trình tự màu theo lựa chọn.
6. Cache vẫn lưu cả filter state và kết quả như contract cũ; khi đang cập nhật hoặc lỗi, giao diện ghi rõ kết quả trước được giữ lại. Không đổi thành schema snapshot mới.

## Tests và đối chiếu

| Giai đoạn | Kết quả và evidence |
|---|---|
| Baseline trực tiếp | 13/13 PASS, gồm test chẩn đoán xác nhận stale bug (`baseline-tests.log`) |
| A Monthly | 3 PASS, các mode khác không chạy do `-t monthly` (`step-A-monthly.log`) |
| B Gender | 2 PASS (`step-B-gender.log`) |
| C Trend | 2 PASS (`step-C-trend.log`) |
| D Notifications | 6 PASS (`step-D-notifications.log`) |
| Regression tổng hợp | 91 PASS / 1 timeout, 9 files (`frontend-regression.log`) |
| Rerun suite bị timeout | AdminPageTitles 19/19 PASS, không đổi source/assertion/timeout (`header-recheck.log`) |
| Advanced cuối | 12/12 PASS sau sửa fixture theo response type và thêm old-cache case (`advanced-final-recheck.log`) |
| Notifications cuối | 9/9 PASS trong regression tổng hợp; không thay source Notifications sau lượt này |
| Typecheck cuối | PASS (`typecheck.log`) |
| Production build cuối | PASS (`build.log`) |
| `git diff --check` | PASS, exit 0; có warning LF/CRLF cho working tree có trước |
| Source/parity/hash/CSS scope | PASS (`source-preservation.json`, `source-files-after.json`) |

Có bằng chứng PASS cho **93 trường hợp riêng biệt** qua regression và các targeted rerun; không tuyên bố một lượt 93/93 liền mạch. Lượt tổng hợp có timeout ở lazy-load Dashboard khi build/typecheck chạy đồng thời; rerun riêng đạt 19/19. Source Dashboard giữ hash. Có thể liên quan tải CPU/I/O nhưng chưa đo nguyên nhân chính xác, ghi TIMING FINDING. Không nới assertion hoặc sửa Dashboard để ép PASS.

Typecheck ban đầu phát hiện fixture DiseaseByGenderRow có field `period` ngoài contract; đã sửa fixture đúng type, không đổi API/dữ liệu thật. Lần tách JSX ban đầu có lỗi ranh giới CRLF; đã sửa ở bước A trước khi đi tiếp. Không còn lỗi TypeScript/build/test đã biết chưa xử lý trong phạm vi.

Regression tổng hợp gồm hai suite mới, ChartVisuals, AdminPages.regression, AdminPageTitles, AdminLayout, App.navigation, navigation và useAdminSectionNavigation. Parent smoke không chạy vì không đổi shared CSS/component hay Parent; backend/model suite không chạy. Các suite liên quan được chạy lại khi có lỗi/thay đổi, không chạy full suite sau mỗi bước.

Các test bảo vệ payload, filter scope, giá trị/thứ tự chart, zero/null/empty/error/retry, input đóng băng, tên dài, chọn nhiều disease, highlight không fetch, pivot thiếu quan sát, old cache schema, loading/stale error, inbox order/content/read/type/clear-confirm/remove, helper failure contract, labelled actions và keyboard focus. Recharts mock không chứng minh geometry.

AST đối chiếu giữ nguyên state initializers, **26 derived declarations** ngoài request, helper tìm kỳ, các biểu thức API và cache/object fields. Notification filtering/unread/mutation/reload/store calls không đổi. Request guards và catch/formatting mới được công bố, không khẳng định toàn bộ source byte-identical.

## Browser/responsive/theme

`cua.getState()` trả apps/browsers rỗng: native pipe và browser access host unavailable. **Không có screenshot hoặc nghiệm thu Chrome thực tế.**

| Mốc | Cấu hình source | Thực tế |
|---|---|---|
| 1440/1280px | Theo container thực: Monthly main chart + tỷ trọng, Gender hai pane, Trend chart + focus khi đủ 1000px; inbox filter rail từ 900px | NOT VERIFIED |
| 768px | Các vùng phân tích xếp dọc khi container hẹp; filter thích ứng, table có vùng cuộn | NOT VERIFIED |
| 390px | Một cột, padding nhỏ, text wrap; bảng cuộn bên trong region và action inbox xuống hàng | NOT VERIFIED |
| Light/dark/multicolor/developer | Dùng token/palette hiện có, scoped CSS và style lỗi/severity dark | NOT VERIFIED |

Source checks không chứng minh không tràn/chồng. Các bước nghiệm thu còn lại: xem bốn viewport, theme, nhãn dài/legend/tooltip/chart thật, thao tác picker bằng bàn phím, filter nhanh/cache/retry và read/remove/clear trên dữ liệu test. Không dùng thao tác ghi DB thật để thử giao diện.

## Safety closure

- 589 file baseline: **587 giữ nguyên hash**, chỉ hai entry được phép sửa; không thiếu hoặc đổi file ngoài allowlist. Source trước sửa được lưu nguyên byte.
- AppPages, navigation, permission mapping, Topbar helper, global CSS, Nunito, Dashboard, Seasonal, Area, Age, Weather/Forecast, Parent, Login, Reports, Permissions đều giữ nguyên trong inventory.
- Không sửa backend/API, DB thật, model/SHAP, Excel, `.env`, Graduation hoặc project thực tập. Không migration/import/retrain hoặc đổi quyền tài khoản.
- Không truy cập DB thật; DB không nằm trong bộ hash, không suy luận DB bất biến từ source hash.
- Không restart/kill server hoặc sửa source Python backend; chỉ dùng script cục bộ để xử lý source/evidence frontend.
- Không thêm dependency. Không gọi backend/provider thật; test helper cũng mock provider và dùng localStorage JSDOM cô lập. Không đưa dữ liệu ra ngoài.
- Git chỉ đọc với optional locks tắt, index hash giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout.

Đã hoàn thành cả bốn màn hình. **PASS_WITH_FINDINGS** do browser chưa xác minh, timing finding và giới hạn helper được ghi rõ. Dừng, không mở Forecast/Account/Import hoặc phần việc khác.
