# Audit trước triển khai — Reports

Blocker reload trước đó đã được kiểm tra lại: không còn process Uvicorn/app.main liên quan, không có listener 8000. Không tự start/kill/restart. Baseline 503 file và source đang có đã được lưu trước sửa.

## Đối chiếu nguồn hiện có

| Mẫu/thao tác | Frontend hiện tại → API → nguồn | Kết quả audit |
| --- | --- | --- |
| Tổng quan | getMonthlyStatistics → MonthlyStatistic; Top 10 bệnh + tổng toàn phạm vi | Giữ cách cộng; cần ghi rõ Top 10 khác tổng phạm vi |
| Theo mùa | monthly → nhóm tháng khô 12,1–4 / mưa 5–11 | Mùa không có bản ghi bị điền 0; cần phân biệt thiếu dữ liệu |
| Theo bệnh | monthly → lọc tên rồi merge period/disease | Cách cộng đúng; giữ sort kỳ rồi số ca giảm |
| Dự báo | /api/forecast/group-summary → ForecastResult | Có guard feature.forecast; data source/date UI hiện không thực sự áp dụng. Phải tái sử dụng hàm tổng hợp hiện có, không sửa AI |
| Theo tháng tuổi | /api/reports/by-age-months → PatientRecord | Bucket hiện có đúng ranh giới; bệnh đã chọn không áp dụng; cần ghi giới hạn tuổi thiếu/âm |
| Tháng/năm | /api/reports/by-month-year → MonthlyStatistic | API điền tháng thiếu bằng 0, frontend không phân biệt được; cần bổ sung metadata tương thích |
| Tùy chỉnh | monthly → nhóm theo bệnh; mặc định Top 20 | Giữ giới hạn/nhóm và ghi rõ trong output |
| Tạo/xuất | build bundle client → downloadReport | PDF/Word chỉ là HTML; Excel là CSV. Chưa có PDF/chart renderer thật |
| CSV | UTF-8 BOM, quote delimiter | Chưa trung hòa công thức spreadsheet từ text không tin cậy |
| History/status | localStorage sd_report_history | Metadata dùng chung browser, không có file để tải lại; processing có thể kẹt khi refresh; không phải background job backend |
| Xem trước/in/copy | chủ yếu cấu hình, window.print, URL trang | Chưa có preview nội dung thật cùng snapshot của export; cần tên thao tác trung thực |
| Quyền | route feature.reports; dữ liệu monthly; Forecast thêm feature.forecast | Giữ quyền hiện hành; export/download mới phải kiểm tra owner, không mở rộng quyền Forecast |

UI dài hơn 1.000 dòng, chọn mẫu và loại báo cáo bị trùng; format mô tả không khớp file; tùy chọn 7/30 ngày thực tế chỉ chọn tháng gần nhất. Đây là **FINDINGS / lỗi đã xác nhận từ code**, chưa phải xác minh trên DB thật.

## Hướng sửa trong phạm vi

- Một data builder/backend snapshot cho preview, biểu đồ và bảng; chỉ dữ liệu tổng hợp, không trả hồ sơ bệnh nhân.
- API mới tương thích bổ sung: options, preview, export/history/download; storage tệp tạm ngoài DB, có owner/TTL và atomic write. Không migration hoặc server startup thay đổi.
- PDF thật dùng ReportLab (dependency cần thiết duy nhất cho runtime); CSV UTF-8 an toàn. Không tiếp tục quảng bá HTML là PDF/Word hoặc CSV là workbook Excel. Lịch sử cũ giữ nguyên trong localStorage, không trộn vào server history mới hoặc tự tiết lộ giữa user.
- Tái sử dụng bucket tuổi và hàm group-summary Forecast hiện có; không copy công thức risk/trend hoặc chạy model. Mẫu Forecast cần cả reports và forecast permission.
- Giữ legacy GET contract; thêm observed metadata thay vì đổi số 0 mặc định cho client cũ. Report builder mới trả null cho tháng thiếu, 0 quan sát hợp lệ vẫn giữ.
- UI quy trình: chọn một mẫu → cấu hình tháng/nguồn/bệnh/format → nội dung preview thật → tạo/tải lại; in preview và copy cấu hình. Tất cả chart lấy từ snapshot server, không dựng dữ liệu mẫu.
- Lưu tạm báo cáo 8 giờ và preview 30 phút; synchronous export, không giả lập background job/DB history bền vững. Trạng thái lỗi/processing có timeout, không báo ready trước khi file tồn tại.

Không cần thay đổi kiến trúc ngoài module Báo cáo hoặc schema DB. Test bằng SQLite/temp store cô lập, chặn kết nối DB thật. PDF phải được đọc lại và render kiểm tra trước khi kết luận. Tài liệu renderer tham khảo [ReportLab Platypus](https://docs.reportlab.com/reportlab/userguide/ch5_platypus/) và [TrueType/Unicode fonts](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/).
