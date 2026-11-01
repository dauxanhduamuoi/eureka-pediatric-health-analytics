# Area Insights Workspace Redesign V1

Ngày: 31/10/2026. Kết luận: **PASS_WITH_FINDINGS — BROWSER NOT VERIFIED**.

Đã triển khai frontend riêng cho Phân tích khu vực. Không tiếp tục task Distinctive UI đã hủy và không sửa các màn hình khác.

## 1. Audit và nguồn đối chiếu

- Tham chiếu bốn tài liệu Audit V2 tại `D:/OS_C/Bài học trên trường/Thực tập/DoiChieu_Source/audit_frontend_admin_v2/`: `FRONTEND_COMPARISON_V2.md`, `ADMIN_SCREEN_COMPARISON.csv`, `REDESIGN_COMPLETENESS.md`, `LEGACY_UI_INVENTORY.md`.
- AreaInsights Eureka trước sửa có SHA-256 `4a1dd78b04c6f63b294368406b8ca7421631fdb46a87fe5dc95bd04ae1367c01`, khớp snapshot B của Audit V2, phân loại PARTIAL. Bản source trước sửa được lưu trong `source_before/`.
- File AreaInsights của bản thực tập tại `DoiChieu_Source/ThucTap-Master_1/Frontend/src/app/components/AreaInsights.tsx` có hash `5865e05493cdeb761bee4eaf9eef5b80dd6b52f95e9a39ad67efdefb0b21c886`, khớp snapshot A của Audit V2. Chỉ đọc file này để xác nhận hash; không sửa project thực tập. Xem `legacy-baseline.json`.
- Kết luận về lịch sử dựa trên Audit V2 và hash source; không coi đó là bằng chứng giao diện đã được nghiệm thu bằng Chrome. Không đọc/copy source Graduation để thiết kế và không đưa ra tỷ lệ phần trăm code mới.

Các vấn đề UX xác nhận từ source Eureka trước sửa:

1. Bộ lọc miền và popup tỉnh nằm trong header lớn; việc tìm/chọn tỉnh bị tách khỏi vùng kết quả.
2. Biểu đồ và xếp hạng đặt cạnh nhau dù dùng cùng `coloredCases`; nhiều nội dung lặp, tên khu vực trong xếp hạng bị truncate.
3. Chi tiết nhóm bệnh/nguy cơ nằm sau một disclosure chung và chia hai vùng hẹp; phân trang từng vùng khó theo dõi.
4. Khuyến nghị cũng nằm trong disclosure đó. Đây là nhận xét về cấu trúc source, không phải kết quả kiểm tra hình ảnh mới.

## 2. Phạm vi nghiệp vụ đã kiểm tra và giữ nguyên

| Thành phần | Contract hiện tại được bảo toàn |
|---|---|
| Danh mục | `listAreaProvinces()` và `loadProvinceRegions()` |
| Toàn bộ dữ liệu | `getAreaCaseSummary({limit: 200})`, `getAreaDiseaseSummary({limit: 200})`, `getAreaLocalRisks({limit: 200})`, `getAreaRecommendations({})` |
| Lọc khu vực | Dùng lookup miền hiện có; summary lấy cùng API, disease/risk theo `provinceCode` với `limit: 200`, cùng hàm tổng hợp và giới hạn 200 |
| Bộ lọc | Miền; tìm tên/mã tỉnh; chọn nhiều tỉnh; bỏ chọn; bỏ lọc. Không có bộ lọc thời gian độc lập trong trang hiện tại và không thêm mới |
| Tổng quan | `caseSummary.length`, tổng `case_count`, `diseaseSummary.length`, giữ nhãn/phạm vi hiện có |
| Biểu đồ/xếp hạng | Cùng `coloredCases`, cùng thứ tự, cùng hash màu tỉnh, giữ giới hạn 12 khi không chọn tỉnh và toàn bộ tập đã chọn như trước |
| Biểu đồ cột ngang | Cùng `case_count`, cùng số liệu, `minPointSize=3` và animation preference; chỉ đổi cách bố trí và hiển thị nhãn/theme |
| Nguy cơ/khuyến nghị | Giữ nguyên hàm phân loại, giá trị, nhãn mức nguy cơ, chuỗi khuyến nghị và API; không viết lại hướng dẫn |
| Phân trang | Disease/risk có page/page-size độc lập; giữ phép tính range và số trang, options 5/10/20/50; đổi page-size vẫn refetch như logic cũ |
| Cache | Giữ `sd_area_insights_state`, schema, load/save và các trường hiện có; dữ liệu cache vẫn hiện khi background read đang chờ |
| Quyền | Không sửa route/permission. Nút Đồng bộ mặc định vẫn chỉ render khi role `admin`; không thay API hay quyền backend |
| Lỗi/loading/empty | Giữ luồng load/error/retry và thông báo gốc; loading tổng quan hiện “Đang tải”; số 0 thật vẫn được hiển thị |

Không xóa bản ghi không rõ địa chỉ khỏi kết quả API. Không thêm bộ lọc thời gian, KPI mới, bản đồ hoặc dữ liệu bệnh nhân.

Lưu ý kế thừa: `buildTargetCaseRows` vốn tạo hàng 0 cho tỉnh được chọn không có hàng summary; các request disease/risk theo tỉnh vốn có catch trả `[]`. Các hành vi này được giữ nguyên theo yêu cầu không sửa tổng hợp/API; task này không chứng nhận rằng hàng tổng hợp 0 luôn đồng nghĩa provider đã cung cấp dữ liệu đầy đủ.

## 3. Thiết kế và triển khai mới

- Bộ lọc thành vùng riêng bên trái; danh sách tỉnh là checkbox native có tìm kiếm, tên đầy đủ, mã, selected chips và nút bỏ lọc. Không còn popup phải mở lại khi chọn tỉnh.
- Kết quả bên phải gồm phạm vi đang phân tích, ba số liệu hiện có và vùng phân bố chính.
- Chuyển **Biểu đồ / Xếp hạng** bằng state trình bày tại component; không fetch lại, không sort lại. Xếp hạng đọc đủ tên dài; tick biểu đồ wrap tối đa ba dòng, có SVG title đầy đủ và cách xem xếp hạng để đọc toàn tên.
- Chuyển **Nhóm bệnh / Nguy cơ khu vực** vào bảng toàn chiều rộng của vùng kết quả, giữ phân trang riêng từng bảng khi chuyển qua lại. Các mốc `period_from/period_to` có sẵn từ API được trình bày bên dưới nhóm bệnh nếu có; không tự tạo kỳ dữ liệu.
- Khuyến nghị thành vùng đọc riêng, giữ mọi chuỗi từ API/hàm tổng hợp. Không lồng thêm disclosure.
- Native button/checkbox/input/select, aria-pressed, label, table header, vùng bảng có thể focus và focus-visible. Thông tin thứ hạng, số ca và mức nguy cơ có nhãn chữ, không chỉ dựa vào màu.
- CSS chỉ opt-in theo `.area-insights-workspace`; tái sử dụng token Admin, Nunito và chart palette. Không sửa global CSS, legacy theme, shell hoặc component shared.
- Container query từ 900px của vùng nội dung chuyển sang hai cột; dưới ngưỡng đó xếp bộ lọc trước kết quả. Summary ba ô chuyển thành dạng dọc khi hẹp. Bảng nguy cơ có vùng cuộn ngang riêng khi cần; trang/chart không bị đặt chiều rộng desktop cố định. Đây là cấu hình CSS đã kiểm tra source, chưa phải kết luận hình ảnh PASS.

Đây là thay đổi workflow và tổ chức thông tin thực tế, cùng component trình bày có trách nhiệm riêng. Các helper tổng hợp/API/cache được tái sử dụng nguyên trạng, không đổi tên để giả lập code mới. Không xóa attribution, lịch sử hoặc bằng chứng cũ.

## 4. File sửa/thêm

1. Sửa `Frontend/src/app/components/AreaInsights.tsx`: composition mới, import presentation/CSS, bỏ state mở popup không còn dùng, thêm accessible name/type cho nút phân trang. Giữ toàn bộ state/load nghiệp vụ.
2. Thêm `Frontend/src/app/components/areas/AreaFilterPanel.tsx`: controlled filter presentation.
3. Thêm `Frontend/src/app/components/areas/AreaResults.tsx`: summary, chart/ranking, bảng chi tiết và khuyến nghị; chỉ giữ local state chuyển cách xem.
4. Thêm `Frontend/src/app/components/areas/AreaInsights.css`: CSS riêng của trang, dùng token theme hiện có.
5. Thêm `Frontend/src/app/components/AreaInsights.test.tsx`: 14 tests, gồm 11 parity cases được chạy trước redesign và ba case cho tương tác mới.

Các file còn lại được tạo trong thư mục evidence này: baseline/source_before, logs, script đối chiếu, kết quả kiểm tra và báo cáo. Không sửa test/component shared đang có.

## 5. Kiểm thử và đối chiếu

| Kiểm tra | Kết quả |
|---|---|
| Trước sửa: Area parity + ChartVisuals | 16/16 PASS (`before-tests.log`) |
| Sau sửa: AreaInsights | 14/14 PASS (`interaction-tests.log`) |
| Targeted regression cuối | 96/96 PASS, 10 files (`frontend-regression.log`) |
| Typecheck | PASS (`typecheck.log`) |
| Production build | PASS (`build.log`) |
| `git --no-optional-locks diff --check` | PASS, exit 0 (`git-diff-check.log`); có warning LF/CRLF trên working tree có trước |
| Whitespace của năm file source sửa/thêm | PASS (`new-file-whitespace-check.json`) |
| AST đối chiếu | 44 statements ngoài return của AreaInsights và 20 declarations/helper/types/constants giữ nguyên; loại trừ duy nhất imports/JSX, state popup cũ và thuộc tính accessibility phân trang |
| Hash inventory | 580 file: chỉ AreaInsights.tsx đổi; 579 file còn lại giữ hash, không thiếu file (`preservation-check.json`) |
| Git index | Hash giữ nguyên trong inventory; không stage/commit/push |
| Trình duyệt thực tế | **BROWSER NOT VERIFIED** |

Regression gồm AreaInsights, ChartVisuals, AdminPageTitles, AdminContent.regression (Dashboard/Seasonal), DashboardOverview, AdminLayout, useAdminChartAnimation, App.navigation, navigation và useAdminSectionNavigation. Không chạy lại backend/model suite.

Các assertion dữ liệu dùng mock cô lập: tổng 16 = 12 + 4 + 0; bản ghi không rõ khu vực giữ nguyên; 14 khu vực vẫn có tổng 91 dù chart giữ 12 hàng; lọc miền dùng provinceCode 79; chọn tỉnh 0 không tự tạo disease rows; hai phân trang giữ độc lập; đổi page-size giữ refetch; lỗi API và retry; cache; admin/staff sync gate; tên dài; đổi view không request thêm; nguy cơ/khuyến nghị không đổi. API mock input đóng băng trong case parity để phát hiện mutation.

Lần typecheck đầu phát hiện type readonly array không phù hợp prop Recharts, đã sửa kiểu prop trình bày cho phù hợp API thư viện; lần typecheck/build cuối PASS. Một số regression hiện có phát cảnh báo React `act(...)`; suite vẫn exit 0, các file đó không được sửa để làm mất cảnh báo. Không coi unit tests/typecheck/build là nghiệm thu layout.

## 6. Browser, responsive và theme

Lần gọi `cua.getState()` không có app/browser: native pipe không kết nối được và browser access host unavailable. Không có screenshot mới, không thao tác live site hoặc đổi cấu hình máy.

| Kích thước/theme | Source/CSS | Hình ảnh và tương tác Chrome |
|---|---|---|
| 1440px / 1280px | Container ≥900px dùng filter rail + results; minmax(0,...) ở vùng dữ liệu | NOT VERIFIED |
| 768px | Container hẹp chuyển một cột | NOT VERIFIED |
| 390px | Một cột, padding riêng, wrap tên dài, bảng nguy cơ cuộn trong vùng bảng | NOT VERIFIED |
| Light / dark | Dùng admin surface/ink/muted/border/mint/primary; dark badge dùng token | NOT VERIFIED |
| Multicolor / developer | Thừa hưởng admin color/radius/control tokens, không hard-code theme mới | NOT VERIFIED |

Nghiệm thu thủ công còn lại: tại bốn viewport trên, mở Area Insights bằng Admin/Staff; kiểm tra overflow toàn trang, tick/tooltip, tên tỉnh/nhóm bệnh dài, lọc và xóa lựa chọn, hai cách xem phân bố, phân trang từng bảng, loading/error/retry; dùng Tab/Space/Enter với checkbox và các nút; đổi các theme được hỗ trợ. Không bấm Đồng bộ trên dữ liệu thật chỉ để nghiệm thu giao diện.

## 7. Safety closure

- Chỉ viết năm file frontend liệt kê ở trên và evidence tại thư mục được yêu cầu; build tạo output `Frontend/dist` theo script hiện có.
- Không sửa backend/API contracts, DB, model, Parent, Weather AI/Forecast, SHAP, Medical Knowledge, Reports, Login, permissions, sidebar/topbar, font hoặc global theme. Inventory kiểm tra các file bảo vệ hiện có; không tuyên bố hash cho mọi file nằm ngoài inventory.
- Không đọc/ghi DB thật trong task này; DB không nằm trong bộ hash, không suy luận DB bất biến từ kiểm tra source.
- Không migration/import/retrain, không đổi quyền tài khoản thật, không restart/kill server và không gọi API thật để thử Đồng bộ.
- Không thêm dependency; package/package-lock, assets/fonts, index và source ngoài trang giữ nguyên trong inventory.
- Không sửa `.env`, project thực tập, Graduation hoặc lịch sử/evidence rollback. Không chạy backend tests; không sửa Python trong lúc server có thể --reload.
- Không reset/restore/checkout/stash/clean/stage/commit/push. Git chỉ dùng đọc status/diff với optional locks tắt; Git index hash không đổi.
- Không gửi dữ liệu project ra ngoài. Kiểm thử dùng dữ liệu tổng hợp/mock, không có request live provider/backend.

Đã hoàn tất code và kiểm thử đúng phạm vi. **PASS_WITH_FINDINGS** do thiếu xác minh hình ảnh/keyboard thực tế và các lưu ý kế thừa đã ghi. Dừng tại đây, không redesign trang khác.
