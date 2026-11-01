# Nghiệm thu trình duyệt còn lại — NOT VERIFIED

Thực hiện trong phiên frontend nối **API mock và fixture tổng hợp**. Không chọn/upload file vào backend Eureka thật, không dùng tài khoản thật để thực hiện mutation. Checklist này chưa được thực hiện trong task.

- [ ] Tại 1440, 1280, 768, 390px: source import, bộ lọc, nút, filename dài và pagination không ép trang tràn ngang; bảng cuộn bên trong vùng riêng.
- [ ] Kiểm tra Nunito tiếng Việt, focus-visible bằng Tab/Enter, native controls và vùng scroll focusable; kiểm tra các theme đang hỗ trợ.
- [ ] DS-MaBenh/DS-BenhNhan: chọn đúng file fixture, hủy picker, chọn lại cùng tên; pending/failed/success job và lỗi metadata hiển thị rõ, nút tải lại metadata chỉ GET mock.
- [ ] Mã bệnh: mở/thu gọn, tìm kiếm, lọc thiếu nhóm, đổi số dòng, Trước/Tiếp; response cũ và 403 mock không thay kết quả mới hoặc báo thành công giả.
- [ ] Phân miền: preview thiếu cột/sai file, xem mẫu đầy đủ, Hủy không gọi import; lỗi import mock và retry; đối chiếu nội dung mapping mẫu không bị đổi.
- [ ] Hướng dẫn: nhập liệu/preview tách vùng đọc; search/paging, chuỗi dài nhiều dòng không cắt; kiểm tra cả ba phần nguyên gốc; Hủy và lỗi ghi mock không làm báo thành công.
- [ ] Admin/Staff đủ quyền và Staff thiếu quyền trong auth mock; direct URL/reload/navigation đúng; không nghiệm thu backend RBAC bằng thao tác trên dữ liệu thật.
- [ ] Loading/error/empty: chưa tải được không thành số 0; zero hợp lệ vẫn hiển thị; thông báo không bị che; preview/import retry còn sử dụng được.

Không đánh dấu hoàn thành dựa vào unit tests hoặc source CSS.
