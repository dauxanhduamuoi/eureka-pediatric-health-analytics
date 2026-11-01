# Top nhóm bệnh — chuyển đổi hai dạng biểu đồ

**Kết luận: PASS_WITH_FINDINGS.** Targeted tests, typecheck, build và diff check đạt. Browser/visual chưa xác minh được.

## Thay đổi

- Mặc định **Biểu đồ tròn** khi mở/mount Dashboard. Có hai nút nhỏ “Biểu đồ tròn | Thanh ngang” ở header card, tự xuống hàng khi thiếu chiều ngang; nhóm có nhãn accessibility, nút dùng `aria-pressed`, focus bàn phím theo cơ chế button native hiện có.
- Đổi dạng chỉ cập nhật một state nội bộ của component trình bày; không gọi lại API, không đổi Top K hoặc dữ liệu. Đổi Top K/refresh giữ chế độ đang chọn trong phiên component. Mở Dashboard mới trở về donut.
- Donut dùng Recharts hiện có, khoét giữa, màu từ palette Admin hiện có, không gradient. Không đặt nhãn phần trăm quanh vòng để tránh chồng chữ; tỷ trọng và số ca luôn có trong chú giải, tooltip hiển thị tên Việt/Anh đầy đủ, số ca và tỷ trọng.
- Chú giải dùng danh sách nhãn tự xuống dòng, không cắt tên hoặc thêm vùng cuộn riêng. Với container từ 560px, donut và chú giải nằm cạnh nhau; container nhỏ hơn xếp dọc. Dựa trên chiều rộng thực tế của card bằng container query.
- Thanh ngang giữ thứ tự xếp hạng, tên Việt/Anh, số ca, tỷ trọng, thanh biểu diễn, tooltip native và kiểu hiện tại. Hai chế độ dùng cùng hàm render danh sách; chỉ khác dấu màu/thứ hạng và việc có thanh bên dưới.
- Giữ nguyên bố cục Dashboard: KPI → theo kỳ bên trái / Top nhóm bệnh bên phải → theo năm → chi tiết. Không sửa biểu đồ theo kỳ/năm.

## Dữ liệu chung

`DashboardOverview` vẫn xử lý `rankedGroups` một lần: sắp xếp trên bản sao theo số ca giảm dần, giữ nguyên số ca, tách tên Việt/Anh, tính tỷ trọng trên tổng ca **của các nhóm đang hiển thị**. Cả Pie và danh sách nhận cùng mảng này; tooltip dùng tỷ trọng đã tính, không tính mẫu số lần hai. Không tạo nhóm “Khác”, không đổi API hoặc làm tròn số ca.

Giữ điều kiện tổng > 0 và bổ sung kiểm tra tổng hữu hạn. Tổng bằng 0/không hữu hạn → share `null`, hiển thị `—`, không có phần trăm hoặc lát donut giả; danh sách nhóm bệnh vẫn giữ đầy đủ. Công thức cho dữ liệu hợp lệ không đổi.

Giữ lựa chọn Top K hiện có **5/6/8/10/12**, mặc định 8, không thêm hoặc đổi option. Dữ liệu 3 nhóm được kiểm tra bằng mock để xác nhận không phụ thuộc số lát cố định.

## File đã sửa

1. `Frontend/src/app/components/admin/DashboardTopGroupsChart.tsx` — component trình bày mới, state hai dạng, donut và danh sách dùng chung; không gọi API.
2. `Frontend/src/app/components/DashboardOverview.tsx` — truyền danh sách hiện có và empty/loading state vào component; kiểm tra mẫu số hữu hạn.
3. `Frontend/src/app/components/DashboardOverview.test.tsx` — cập nhật test thanh ngang cho chế độ mới, thêm test chuyển đổi và dữ liệu chung.
4. `Frontend/src/app/components/admin/content.css` — thêm style riêng cho toggle/donut/tooltip/container query; không đổi rule bố cục khác.
5. `Frontend/src/i18n/locales/vi.ts` — bốn nhãn mới cho dạng biểu đồ và tỷ trọng chưa hợp lệ.
6. `Frontend/src/i18n/locales/en.ts` — bản dịch tương ứng.

## Kiểm thử

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Targeted Dashboard + AdminContent regression, 2 file | **13 PASS, 0 FAIL** | `dashboard-tests.log` |
| TypeScript typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Tests kiểm tra mặc định donut, chuyển sang thanh ngang và quay lại; dữ liệu/thứ tự/số ca/tỷ trọng trùng nhau; tooltip tên dài/đầy đủ; số lần gọi cả sáu API không tăng khi đổi dạng; trạng thái chọn/focus; Top K ở cả hai dạng và remount; tổng 0/không hữu hạn; loading/error/empty/retry; thứ tự các khối, dữ liệu theo kỳ/năm, cảnh báo tháng thiếu, chạy dự báo, refresh, bảng chi tiết/tìm kiếm và breakdown tuổi. Dùng mock API, không truy cập dữ liệu thật.

Không chạy toàn bộ backend/model tests hoặc audit toàn Eureka.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser, công cụ trả “The browser access host is unavailable”. Không có ảnh hoặc Chrome/Edge E2E. Tests dùng JSDOM và mock Recharts để kiểm tra data/semantics; chưa xác minh hình dạng donut, tooltip khi hover, độ dài chú giải hoặc không tràn ngang ở kích thước thực tế. Responsive được kiểm tra qua source, không coi là visual PASS.

## Safety closure

- Baseline 484 file: thay đổi đúng 5 file có trước và thêm 1 component kể trên. Lưu `source_before/`, `baseline.json`, `toggle.diff`, `safety_closure.json` tại thư mục này.
- Đối chiếu source xác nhận nguyên vẹn: API/cache/aggregations hiện có; forecast/KPI/state; header/thao tác/KPI/biểu đồ theo kỳ; biểu đồ năm và toàn bộ chi tiết phía dưới.
- Không đổi backend, API, DB, model/AI/SHAP, Medical Knowledge, Parent, sidebar/topbar, trang Admin khác, font, dependency hoặc `.env`. Không truy cập/sửa Graduation.
- Không mở/ghi DB thật, gọi HTTP ứng dụng, import/migration/retrain hoặc restart backend. Build/tests chạy local; chỉ thử inventory công cụ browser.
- HEAD và Git index giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout; giữ mọi thay đổi có trước.

Hoàn thành đúng phạm vi và dừng.
