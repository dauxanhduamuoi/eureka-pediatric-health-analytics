# Dashboard — bố cục và biểu đồ

**Kết luận: PASS_WITH_FINDINGS.** Targeted tests, typecheck, build và diff check đạt; browser/visual chưa xác minh được.

## Bố cục trước/sau

- Trước: tiêu đề → thao tác → KPI → biểu đồ năm → theo kỳ + donut → chi tiết.
- Sau: tiêu đề → thao tác → KPI → **theo kỳ bên trái / Top nhóm bệnh bên phải** → **biểu đồ năm** → toàn bộ phần chi tiết và bảng dự báo hiện có.
- Desktop từ 1100px: tỷ lệ 60/40; dưới 1100px xếp một cột, theo kỳ trước Top nhóm bệnh. Card dùng `minmax(0, …)`, nhãn tự xuống dòng, không thêm vùng cuộn lồng nhau. Giữ cuộn ngang riêng của bảng chi tiết để không làm mất các cột trên mobile.

## Biểu đồ

- **Theo kỳ:** giữ Recharts LineChart và nguyên dữ liệu tổng hợp/thứ tự thời gian. Cao 300px, đường 2px, marker nhỏ, grid ngang nhẹ, trục gọn, `minTickGap` và `preserveStartEnd` hạn chế nhãn thời gian chồng nhau; tooltip giữ kỳ và số ca có đơn vị.
- **Top nhóm bệnh:** thay donut/chú giải cuộn bằng các thanh ngang xếp hạng theo số ca thực tế giảm dần. Dùng HTML/CSS cho riêng phần này để tên Việt/Anh dài tự xuống dòng theo chiều cao nội dung; tránh trục SVG có chiều rộng cố định hoặc legend cuộn riêng. Không thêm dependency/component trùng lặp. Hiển thị tên đầy đủ, thứ hạng, số ca, phần trăm; tooltip native `title` chứa đầy đủ tên và giá trị. Các biểu đồ đường/cột khác tiếp tục dùng Recharts.
- Phần trăm và chiều dài thanh đều tính trên **tổng số ca của các nhóm đang hiển thị**, không phải tổng ca toàn hệ thống. Số ca không làm tròn; chỉ định dạng phần trăm một chữ số thập phân. Giữ nhóm 0 ca; nếu tổng bằng 0, tỷ trọng hiển thị `—`, không tạo tỷ lệ giả. Sắp xếp trên bản sao, không đổi danh sách API hoặc dữ liệu dùng cho biểu đồ xếp chồng.
- **Theo năm:** giữ Recharts BarChart, cao 230px; cột tối đa 40px, grid ngang nhẹ, năm rõ, bỏ nền hover xám bằng `cursor={false}`, giới hạn chiều rộng tooltip. Năm đủ dữ liệu màu xanh, năm chưa đủ màu hổ phách. Giữ nguyên tổng ca, metadata số tháng, trạng thái trong tooltip và toàn bộ cảnh báo/danh sách tháng thiếu.

## File sửa

1. `Frontend/src/app/components/DashboardOverview.tsx`: thứ tự các khối và cách trình bày ba biểu đồ.
2. `Frontend/src/app/components/admin/content.css`: thêm CSS riêng của Dashboard/ranking, không sửa style trang khác.
3. `Frontend/src/i18n/locales/vi.ts`: thêm nhãn “Tỷ trọng trong các nhóm đang hiển thị”.
4. `Frontend/src/i18n/locales/en.ts`: thêm bản dịch tương ứng.
5. `Frontend/src/app/components/DashboardOverview.test.tsx`: thêm 7 tests tập trung theo rủi ro.

## Dữ liệu và chức năng bảo toàn

Đối chiếu source trước/sau xác nhận các phần sau **giữ nguyên nội dung code**: tải API/cache, tổng hợp dữ liệu theo kỳ/năm, tổng hợp biểu đồ xếp chồng, thao tác chạy dự báo và state tìm kiếm/phân trang, KPI, phần mở rộng/bảng dự báo/breakdown tuổi. Evidence: `safety_closure.json`, `dashboard.diff`, `source_before/`.

Giữ `predict_current`, API hiện có, các lựa chọn Top 5/6/8/10/12 và mặc định 8, refresh, chạy dự báo `('auto', 1)`, thông báo thành công/thất bại, tìm kiếm và phân trang. Không thay sidebar, topbar, Nunito, brand hoặc các trang Admin khác.

## Kiểm thử vừa đủ

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Dashboard mới + AdminContent regression hiện có | **10 PASS, 0 FAIL**, 2 file | `dashboard-tests.log` |
| TypeScript typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Tests kiểm tra thứ tự tiêu đề/thao tác/KPI/biểu đồ/chi tiết; dữ liệu theo kỳ và theo năm; ranking đúng và không mutate input; tên Việt/Anh dài, số 0, tỷ trọng; giữ metadata, màu và cảnh báo tháng thiếu; nội dung tooltip năm đầu/cuối; Top K/API parameters/options; refresh/chạy dự báo; bảng dự báo và breakdown tuổi/tìm kiếm; loading/error/empty/retry. Bộ regression hiện có cũng kiểm tra scope/observations của SeasonalAnalysis khi dùng stylesheet nội dung chung.

Không chạy toàn bộ frontend/backend/model audits vì thay đổi giới hạn ở Dashboard. Không đổi test cũ để che lỗi.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser; công cụ trả “The browser access host is unavailable”. Không có Chrome/Edge E2E hoặc ảnh thực tế ở 1440/1280/768/390px. Responsive, độ dễ đọc, không tràn ngang, vị trí tooltip đầu/cuối và tooltip native mới chỉ được xem xét qua source; tests tooltip kiểm tra nội dung, không chứng minh tọa độ hoặc hiển thị thực tế.

## Safety closure

- Baseline 483 file: 4 file sản phẩm liệt kê trên thay đổi; thêm đúng 1 file test. Giữ các thay đổi chưa commit có trước.
- Backend, model, AI/SHAP, Medical Knowledge, Parent, font, sidebar, topbar, `.env`, dependency/lockfile không đổi. Không truy cập/sửa Graduation.
- Không mở/ghi database thật, gọi HTTP ứng dụng, import/migration/retrain hoặc restart backend. Tests dùng mock API, build chạy local; chỉ thử inventory browser.
- HEAD và Git index giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout.

Hoàn thành đúng phạm vi; dừng, không tiếp tục redesign hoặc mở phase khác.
