# Admin Redesign Batch 2 — Forecast & Account

31/10/2026. **PASS_WITH_FINDINGS — BROWSER NOT VERIFIED**.

Đã hoàn tất hai màn hình đúng phạm vi. Không sửa các màn hình của Batch 1 hoặc mở lại Distinctive UI đã rollback.

## Baseline và audit

- Baseline là working tree hiện tại, không phải HEAD: 601 file trong `baseline.json`, gồm các thay đổi chưa commit và các module đã hoàn thành. Source trước sửa của Forecast, Account và test Forecast gốc được lưu trong `source_before/`.
- Đã đọc source hiện tại, consumer AppPages, API/cache/auth context và hai dòng Audit V2 tương ứng (`audit-v2-reference.json`). Source hiện tại là căn cứ triển khai; audit lịch sử không được dùng như bằng chứng browser.
- Chỉ AppPages lazy-import hai entry này. Giữ nguyên default exports, đường dẫn import và các route; không cần migration entry hoặc wrapper tương thích.

### Forecast contract

| Nội dung | Giữ nguyên |
|---|---|
| Đọc | `getForecastGroupSummary()` và `getForecastResults()` trong cùng Promise.all |
| Chạy | `runForecast('auto', 1)`; horizon luôn 1, không thêm lựa chọn 2/3 tháng |
| Sau chạy | Chỉ cập nhật kết quả/cache và báo hoàn tất sau khi cả hai GET đọc được kết quả |
| F01 | GET lỗi không biến thành response rỗng thành công; giữ dữ liệu/cache trước, error và previous-result flag |
| F02 | Request generation guard trước/sau POST, sau GET, trong catch/finally và cleanup unmount |
| Dữ liệu | Previous series dùng `previous_cases`; predicted series dùng `predicted_cases`, không tráo nguồn |
| Chart | Clone/sort predicted giảm dần, giới hạn 10, cùng name/previous/predicted/risk; giữ palette và hai series |
| Filters | Kỳ, risk, tìm kiếm song ngữ; hai search debounce 200ms. Chỉ lọc tại client, không đổi tham số chạy |
| Tổng quan | Số hàng summary, tổng predicted, số risk Cao, số kỳ; giữ phạm vi toàn bộ dữ liệu đã tải |
| Bảng | Search bảng riêng, page 10/20/50/100/custom, custom clamp 1–1000 như trước; mở một/tất cả, chi tiết tuổi qua helper cũ |
| Cache | `sd_chart_cache_forecast`; giữ summary, details, riskFilter, searchTerm, summarySearchTerm, selectedPeriod, summaryPage, summaryPageSize, summaryCustomSize |
| CSV | Cùng `downloadReport`, columns/rows/formats/totals và tập `summaryTableFiltered` |
| Quyền | Route `forecast` tiếp tục `feature.forecast`; không thay policy hoặc API |

API frontend cung cấp kỳ dự báo và cột “Kỳ trước”, không có mốc quan sát riêng để giao diện tự gán. Không suy diễn một ngày/tháng quan sát mới. Forecast vẫn là dự báo số ca bệnh, không trở thành Weather AI.

### Account contract

- `useAuth()` tiếp tục cung cấp user/logout/refreshUser; không sửa AuthContext, Login hoặc API client.
- Hồ sơ gửi đúng bốn field `full_name`, `birth_date`, `gender`, `position` qua `updateProfile`, sau đó await refreshUser. Không gửi role/permission.
- Đổi mật khẩu giữ required, tối thiểu 6 ký tự và xác nhận khớp; cùng `changePassword` và cơ chế chỉ xóa input sau thành công, giữ input khi lỗi.
- Sessions dùng `listSessions`, `revokeSession(id)`, `revokeOtherSessions`, rồi reload như trước. Không có nút thu hồi riêng cho phiên current/revoked; nút thu hồi các phiên khác vẫn theo điều kiện active > 1.
- Logout vẫn gọi hàm đồng bộ `logout(): void` của AuthContext sau cùng xác nhận cũ. Đây không phải endpoint logout HTTP mới.
- Token vẫn lấy/mask/copy theo code cũ. Không đưa raw token vào component trình bày; chỉ truyền nhãn đã mask và callback sao chép. Không đọc token/phiên tài khoản thật để kiểm thử.

## Thiết kế mới

**Forecast:** tách cấu hình bên trái khỏi vùng phân tích khi đủ chiều rộng, trên mobile xếp một cột. Horizon cố định, nút chạy/làm mới và bộ lọc được nhóm rõ. Tổng quan toàn bộ kết quả nằm trong vùng phân tích; biểu đồ giữ vai trò chính. Bảng chi tiết toàn chiều rộng phía dưới, CSV đặt tại khu vực bảng, tên bệnh đầy đủ và nút mở chi tiết có label/aria-expanded. Chart/table có vùng cuộn riêng khi cần thay vì ép nhãn và số liệu vào chiều rộng mobile.

**Account:** identity gọn, hồ sơ và bảo mật cạnh nhau khi đủ rộng, sessions toàn chiều rộng bên dưới. Hồ sơ có form riêng; mật khẩu có form riêng và message thành công/lỗi rõ. Thông tin token nằm trong details đóng mặc định, không chiếm vùng chính; đây là thay đổi presentation, không phải cơ chế bảo mật mới. Danh sách phiên giữ thứ tự active rồi revoked, có nhãn current/revoked bằng chữ, thiết bị, IP/thời gian và thao tác hiện có.

Native form submit dùng lại handler cũ, không thêm browser validation làm thay đổi các quy tắc hiện có. Giữ font Nunito, Soft Healthcare Green, token/theme. CSS chỉ theo `.forecast-workspace` và `.account-workspace`, không sửa global CSS.

## Cấu trúc file

Sửa hai entry:

- `Frontend/src/app/components/Forecast.tsx`: composition, feedback và trạng thái kết quả.
- `Frontend/src/app/components/Account.tsx`: giữ state/actions/auth contract, ghép các vùng presentation.

Thêm trong `forecast-workspace/`:

- `useForecastWorkspace.ts`: controller/data/cache được chuyển nguyên, không viết lại logic.
- `ForecastControls.tsx`: horizon, run/refresh và bộ lọc.
- `ForecastAnalysis.tsx`: tổng quan và chart.
- `ForecastSummaryTable.tsx`: bảng, phân trang, CSV và chi tiết tuổi.
- `forecast.css`: style riêng.

Thêm trong `account-workspace/`:

- `AccountProfile.tsx`: identity và hồ sơ tự phục vụ.
- `AccountSecurity.tsx`: form mật khẩu và technical session details.
- `AccountSessions.tsx`: danh sách phiên và thao tác.
- `account.css`: style riêng.

Thêm `Account.test.tsx`, `Forecast.workspace.test.tsx`. Không sửa test Forecast F01/F02 có trước. Tổng cộng 11 file source mới; các file khác của task chỉ là evidence.

## Những thay đổi presentation có chủ đích

1. Forecast chưa đọc được dữ liệu không hiển thị banner khẳng định kết quả rỗng. Chỉ hiển thị empty-confirmed sau một lần đọc thành công; error-first có placeholder chưa tải được kết quả. Đây không phải đổi API/controller.
2. Khi có dữ liệu cũ và loading/running/error, giữ nguyên câu cảnh báo kết quả trước. Không gắn nhãn hoàn tất cho POST thành công nhưng GET thất bại.
3. Metric chưa từng tải thành công dùng dấu “—”; kết quả rỗng thành công và số 0 thật vẫn được giữ. Không sửa phép tổng hợp.
4. Account thêm feedback nếu logout đồng bộ ném exception. Không đổi implementation/chính sách auth, không tự điều hướng hoặc giả định logout thành công.
5. Profile controller vốn dùng cùng `profileMessage` cho cả thành công/lỗi. UI giữ message trung tính, không tô xanh mọi response để tạo thành công giả. Mật khẩu dùng success/error riêng như trước.

Giữ các hành vi kế thừa: maskToken và clipboard handling cũ; không thêm confirmation/revoke flow mới; các session action không có optimistic update; helper nhóm tuổi Forecast dùng danh mục tuổi hiện có, nhãn ngoài danh mục giữ thứ tự ổn định. Không thay bằng cách sắp xếp tháng tuổi của Parent.

## Tests và evidence

| Giai đoạn | Kết quả |
|---|---|
| Baseline Forecast F01/F02 + Account + AdminPages | 21/21 PASS (`baseline-tests.log`) |
| Parity Forecast bổ sung trước sửa | 6/6 PASS (`forecast-parity-before.log`) |
| Bước A Forecast | 11/11 PASS (`step-A-forecast.log`) |
| Bước B Account | 13/13 PASS (`step-B-account.log`) |
| Regression cuối batch | **104/104 PASS, 10 files** (`frontend-regression.log`) |
| Recheck sau hoàn thiện type của mock CSV | 7/7 PASS (`forecast-final-recheck.log`) |
| Typecheck cuối | PASS (`typecheck.log`) |
| Production build | PASS (`build.log`) |
| git diff --check | PASS, exit 0; có warning LF/CRLF của working tree hiện có |
| Whitespace source mới/sửa | 0 lỗi (`source-files-after.json`) |
| Source preservation | PASS (`source-preservation.json`) |

Regression gồm Forecast gốc, Forecast workspace, Account, LoginPage, AdminPages.regression, AdminPageTitles, App.navigation, navigation, useAdminSectionNavigation và reports CSV. Không chạy full frontend/backend/model suite. Lượt test tổng hợp chạy riêng trước build/typecheck, không gặp timeout của Batch 1.

Typecheck lần đầu phát hiện mock `downloadReport` thiếu field MIME bắt buộc. Đã bổ sung đúng return contract và rerun suite liên quan; không đổi assertion hoặc code production để ép PASS. Khi viết parity baseline, đã đối chiếu nhãn page-size thực tế và giữ cả kiểm tra nhóm tuổi được helper hỗ trợ lẫn nhãn không được nhận diện; không sửa helper để thay thứ tự.

Các trường hợp bảo vệ: GET lỗi, POST lỗi, POST thành công/GET lỗi, cache giữ khi refresh thất bại, response cũ về sau, unmount khi POST còn chờ, empty thật/zero, series previous/predicted, sort/filter/search/pagination/custom-size/chi tiết tuổi/CSV, profile payload/auth refresh/error, mật khẩu validation/pending/success/wrong-password/retry, session 401/403/500, refresh và revoke failures, no-session, logout confirm/error/retry, native labels/forms/focus và technical details mặc định đóng.

AST xác nhận **toàn bộ 49 statement controller Forecast trước return không đổi**, kể cả F01/F02. API/cache/notification/CSV calls giữ nguyên. Account core, API calls, validation và helper mask/copy/date/device giữ nguyên ngoài state/catch logout feedback đã công bố. Test Forecast gốc giữ hash.

## Browser, responsive và theme

`cua.getState()` không có app/browser, native pipe và browser access host unavailable. **BROWSER NOT VERIFIED**; không có screenshot và không tuyên bố kiểm tra Chrome thành công.

| Mốc/theme | Cấu hình source | Thực tế |
|---|---|---|
| 1440/1280px | Forecast rail + analysis khi container đủ 950px; Account profile/security song song ở ngưỡng tương tự | NOT VERIFIED |
| 768px | Xếp một cột khi vùng thực không đủ rộng; chart/table có vùng cuộn riêng | NOT VERIFIED |
| 390px | Một cột, padding nhỏ, text/form wrap; chart canvas tối thiểu 640px cuộn nội bộ để không ép trục | NOT VERIFIED |
| Light/dark/multicolor/developer | Tái sử dụng token, palette risk và shape hiện có; không sửa theme global | NOT VERIFIED |

Parser CSS xác nhận cả 50 rule Forecast và 56 rule Account đều có scope riêng. Source checks không thay nghiệm thu layout. Còn cần Chrome thật để kiểm tra overflow, nhãn/chart/legend, bảng/chi tiết tuổi, form/keyboard và theme trên bốn viewport, dùng mocks hoặc tài khoản/môi trường test cô lập.

## Protected files và safety closure

- 601 file baseline: **599 giữ nguyên hash**, chỉ Forecast.tsx và Account.tsx đổi; không thiếu hoặc thay file ngoài allowlist. Source trước sửa được lưu nguyên byte.
- Batch 1, Dashboard, Seasonal, Area, Age, Weather AI/SHAP, Parent, Login, Reports, Permissions, AppPages/navigation, AuthContext, API client, global CSS và Nunito giữ nguyên trong inventory.
- Không sửa backend/Python, DB thật, model, Excel, `.env`, Graduation hoặc project thực tập. Không migration/import/retrain, không thay quyền/hồ sơ/phiên thật, không chạy Forecast thật.
- Không truy cập DB thật hoặc suy luận DB bất biến từ source hash; DB không nằm trong inventory.
- Không restart/kill backend, không chạy backend/model tests.
- Tests dùng mocks và JSDOM cô lập. Không đọc credentials thật; dữ liệu mật khẩu giả chỉ tạo trong bộ nhớ, token mock là absent. Runner lọc output nhạy cảm trước khi ghi log, không lưu raw output trung gian; log scan không thấy runtime credential markers. Đây không phải công cụ scan secret tổng quát.
- Không thêm dependency, không gọi backend/provider thật hoặc đưa dữ liệu ra ngoài. Build chỉ sinh/cập nhật output frontend theo script có trước.
- Git chỉ đọc với optional locks tắt; index hash không đổi. Không stage/commit/push/reset/stash/clean/restore/checkout.

**PASS_WITH_FINDINGS** vì chưa nghiệm thu browser/viewport/theme/keyboard thực tế. Code, F01/F02, parity, tests/typecheck/build đã đạt. Dừng tại Forecast & Account; không tiếp tục Import hoặc cleanup khác.
