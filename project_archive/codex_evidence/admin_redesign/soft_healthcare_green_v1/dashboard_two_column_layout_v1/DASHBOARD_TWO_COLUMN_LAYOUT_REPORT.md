# Dashboard — hai cột độc lập

**Kết luận: PASS_WITH_FINDINGS.** Targeted tests, typecheck, build và diff check đạt; chưa xác minh được hình ảnh trong browser thật.

## Nguyên nhân và cách sửa

Trước đây, theo kỳ và Top nhóm bệnh cùng nằm trong một hàng grid; biểu đồ năm là phần tử tiếp theo bên ngoài grid. Chiều cao hàng grid phụ thuộc card cao nhất, nên donut/danh sách Top nhóm bệnh dài đẩy biểu đồ năm xuống, để trống dưới biểu đồ theo kỳ. `align-items: start` không loại bỏ được chiều cao hàng đó.

Sau sửa, grid desktop có hai cột độc lập:

- Trái **60%**: một flex column chứa theo kỳ và theo năm, gap dùng `--content-gap` hiện có.
- Phải **40%**: Top nhóm bệnh, giữ cả donut mặc định và thanh ngang.

Biểu đồ năm đi ngay sau theo kỳ trong cột trái, không chờ chiều cao Top nhóm bệnh. Không kéo giãn card để hai cột bằng chiều cao; không dùng absolute, thêm chiều cao cố định hoặc thanh cuộn để vá layout. Chiều cao plot theo kỳ/năm vẫn là 300/230px như trước.

## Responsive

- Giữ breakpoint desktop từ **1100px** và tỷ lệ `1.5fr / 1fr`, áp dụng cho 1280/1440px.
- Dưới 1100px, wrapper trái dùng `display: contents`; CSS `order` của ba card lần lượt là theo kỳ 0, Top nhóm bệnh 1, theo năm 2. Vì vậy thứ tự thị giác tablet/mobile là **theo kỳ → Top nhóm bệnh → theo năm**.
- DOM gom hai biểu đồ trái trong cùng wrapper để desktop có luồng chiều cao độc lập; không clone biểu đồ hoặc render hai phiên bản theo breakpoint. Mỗi chart luôn có một instance. Không thêm state viewport hoặc API call.
- Giữ `min-width: 0`, `minmax(0, …)`, wrapping tên bệnh, toàn bộ chú giải và cuộn bảng hiện có.

## File đã sửa

1. `Frontend/src/app/components/DashboardOverview.tsx`: chuyển nguyên card năm vào wrapper trái, thêm ba class phục vụ thứ tự responsive.
2. `Frontend/src/app/components/admin/content.css`: wrapper flex desktop, `display: contents`/order trên màn hình nhỏ; chỉ các selector Dashboard.
3. `Frontend/src/app/components/DashboardOverview.test.tsx`: kiểm tra hai card cùng cột trái, Top nhóm bệnh ở cột riêng, chỉ một instance và không thay các chart khi đổi dạng.

## Nội dung và chức năng giữ nguyên

Đối chiếu source trước/sau xác nhận toàn bộ logic trước render giữ nguyên. Nội dung bên trong ba card giữ nguyên sau khi bỏ khác biệt thụt dòng. Phần chi tiết/bảng phía dưới giữ nguyên từng ký tự. Evidence: `safety_closure.json`, `layout.diff`, `source_before/`.

Không đổi data, API, cache, thứ tự kỳ/năm, tooltip, trục, màu sắc, font, KPI, Top K, nút dự báo/làm mới, tìm kiếm, phân trang hoặc breakdown tuổi. `DashboardTopGroupsChart.tsx` không sửa: donut mặc định, đổi dạng không gọi API, đổi Top K giữ mode, tên đầy đủ/số ca/tỷ trọng/thứ tự và xử lý tổng 0/không hữu hạn vẫn nguyên vẹn. Cảnh báo năm thiếu tháng và danh sách tháng thiếu còn đầy đủ.

## Kiểm thử

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Targeted Dashboard + AdminContent regression, 2 file | **13 PASS, 0 FAIL** | `dashboard-tests.log` |
| TypeScript typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Bao gồm cấu trúc hai cột và số instance; dữ liệu theo kỳ/năm; cảnh báo tháng thiếu; donut/thanh ngang/chuyển ngược; cùng data và không tăng API calls; Top K hiện có; tên dài, số 0, loading/error/empty/retry; chạy dự báo/làm mới; tìm kiếm/bảng/breakdown tuổi. Không chạy backend/model tests hoặc audit ngoài phạm vi.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser, công cụ trả “The browser access host is unavailable”. Không có Chrome/Edge E2E hoặc ảnh tại 1440/1280/768/390px. Source đã được kiểm tra về cấu trúc, breakpoint và thứ tự CSS; JSDOM không chứng minh khoảng cách pixel, chiều cao thực, thứ tự thị giác responsive hoặc không tràn ngang. Không tuyên bố UI/browser PASS từ unit tests/build.

## Safety closure

- Baseline **485 file**: chỉ ba file frontend trên thay đổi, không thêm source file. Giữ toàn bộ thay đổi có trước.
- Không sửa backend, DB, model/AI/SHAP, Medical Knowledge, Parent, sidebar/topbar, trang Admin khác, font, dependencies hoặc `.env`. Không truy cập/sửa Graduation.
- Không mở/ghi DB thật, gọi HTTP ứng dụng, import/migration/retrain/restart backend. Tests dùng mock; build chạy local; chỉ thử inventory công cụ browser.
- HEAD và Git index giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout.

Hoàn thành đúng phạm vi và dừng.
