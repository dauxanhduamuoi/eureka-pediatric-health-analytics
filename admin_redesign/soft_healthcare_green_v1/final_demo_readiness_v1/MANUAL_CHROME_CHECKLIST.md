# Nghiệm thu Chrome trước demo

Trạng thái hiện tại: **BROWSER NOT VERIFIED**. Checklist này chưa được thực hiện bằng browser trong audit.

Các bước đăng nhập/chạy Forecast/import/bật-tắt/xuất báo cáo cần môi trường test hoặc bản sao DB được phép ghi. Không thực hiện chúng trên DB Eureka thật để tiếp tục audit này. Ngay cả GET có token hiện cũng cập nhật `login_sessions.last_seen_at`.

1. **Đăng nhập/quyền:** Admin và Staff test đăng nhập được; sai mật khẩu có lỗi, thử lại được. Staff thiếu quyền không thấy mục bị cấm và truy cập URL/API trực tiếp nhận 403. Đăng xuất xóa phiên đăng nhập trên giao diện. Không dùng tài khoản thật trong các phép thử sửa quyền.
2. **Desktop 1440px và mobile khoảng 390px:** Login, sidebar/drawer, Dashboard, Weather AI, Reports không trắng trang, không loading vô hạn hoặc tràn ngang. Kiểm tra console/network cho 401/403/500 ngoài các phép thử chủ đích. Kiểm tra dấu tiếng Việt và ảnh slideshow/font khi offline.
3. **Dashboard/phân tích:** Chọn kỳ/năm; cảnh báo năm thiếu tháng vẫn hiện. Đổi donut/thanh ngang giữ tổng số. Lọc tuổi/giới/mùa/tên bệnh dài; phân biệt số 0 đã ghi nhận với tháng không có dữ liệu. Không mô tả dữ liệu demo cũ thành dữ liệu hôm nay.
4. **Forecast:** Tải lại và chạy horizon 1 trên DB test. Kết quả đúng tháng kế tiếp dữ liệu quan sát. Mô phỏng lỗi đọc API sau khi chạy: không báo hoàn tất, không xóa cache thành dữ liệu rỗng; phần giữ lại có nhãn kết quả trước đó và thử lại được. Đổi tab trong lúc request chậm không làm kết quả cũ ghi đè lượt mới.
5. **Weather AI:** Chọn hai tỉnh lần lượt, tuổi/giới/Top K; bốn giá trị có đơn vị đúng. Chi tiết một nhóm mở mỗi lần, SHAP UP/DOWN/MIXED đầy đủ, phân trang đúng. Đổi input xóa ngữ cảnh cũ; cache/lỗi 502 ghi rõ dữ liệu cũ và cho thử lại. Không trình bày ranking là xác suất mắc bệnh.
6. **Parent:** GPS cho phép/từ chối/timeout, thử lại và chuyển thủ công; chỉ dự đoán với tọa độ hợp lệ. Một nhóm mỗi lần, Trước/Tiếp, SHAP và nội dung y khoa/nguồn tham khảo mở đúng. Browser GPS và một lượt Weather AI trực tiếp qua UI vẫn cần nghiệm thu.
7. **Medical Knowledge:** Đọc nội dung có sẵn; phân biệt Reviewed/Auto, trạng thái duyệt, hạn chế bằng chứng và nguồn. Không bấm tạo job, import, duyệt hoặc cập nhật trên DB thật.
8. **Báo cáo:** Trên DB test, preview → PDF/CSV → tải lại từ lịch sử, kiểm tra quyền owner/Staff. Tổng bảng khớp biểu đồ; loại Forecast ghi rõ dự báo. Kiểm tra in A4, tên dài, bảng dài lặp tiêu đề. File PDF minh chứng trong audit dùng dữ liệu tổng hợp, không phải DB thật.
9. **Import/visibility:** Chỉ trên DB test: file tổng hợp hợp lệ và file lỗi, tìm/lọc ba tab bệnh, bật/tắt rồi xử lý CAS conflict. Kiểm tra quyền API. Không import bệnh nhân hoặc thay trạng thái nhóm bệnh thật.

Điều kiện chốt demo: các bước phù hợp kịch bản trình diễn đã được người nghiệm thu xác nhận; có mạng nếu cần Open-Meteo. Lần kiểm tra provider thật trong audit là một thời điểm, không bảo đảm mạng/provider luôn sẵn sàng.
