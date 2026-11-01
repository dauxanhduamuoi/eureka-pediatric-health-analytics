# Lấy số đo khi lỗi đang xuất hiện

Task hiện **BLOCKED** vì chưa có số đo Chrome thực tế. Không sửa CSS ứng dụng trong lúc chờ bằng chứng.

1. Mở một trang đang bị cắt/nền xám: Xu hướng hoặc Nhóm bệnh theo tháng. Giữ nguyên bộ lọc đang gây lỗi và đợi dữ liệu tải xong.
2. Mở Chrome DevTools → Console. Nếu việc mở DevTools khiến lỗi biến mất hoặc thay đổi, ghi nhận điều đó; giữ cùng cách dock DevTools giữa các lần đo.
3. Mở `CAPTURE_SCROLL_MEASUREMENTS.js` trong thư mục này, chạy toàn bộ script trong Console. Đo ở vị trí lỗi đang nhìn thấy.
4. Nếu điểm mặc định chưa nằm trong vùng xám, chỉnh `grayPoint.x`/`grayPoint.y` ở đầu script thành tọa độ bên trong vùng xám, tính theo pixel CSS của viewport, rồi chạy lại.
5. Copy chuỗi JSON được in ra và gửi trong chat, kèm tên trang, mode Biểu đồ/Xếp hạng nếu là Khu vực và điểm đang thấy bị cắt.
6. Cuộn bằng tay tiếp xuống cuối vùng nội dung, chạy lại cùng script và gửi JSON lần hai. Hai lần đo giúp phân biệt body đang cuộn hay `.admin-content` đang cuộn.

Script chỉ đọc DOM/computed styles/geometry. Không đổi HTML/CSS, không cuộn tự động, không gọi API, không đọc cookies/storage/form values. Nó không in nội dung bảng, tên tài khoản hoặc văn bản y khoa; chỉ in loại phần tử/class, kích thước và trạng thái scroll. Không tự ghi file hoặc dùng clipboard.

Các trường chính:

- `viewport`, `html`, `body`, `scrollingElement`, `root`: chiều cao/scroll của document và viewport.
- `containers`: shell, workspace, main, page, sidebar và các scroll con có chủ đích.
- `pageRoot`, `lastTextInDomOrder`, `furthestTextByBottom`: phần tử cuối có chữ thực sự và chuỗi ancestor, không chứa chữ đó.
- `grayHit`/`grayAncestors`: phần tử nằm tại điểm vùng xám và ancestor.
- `scrollCandidates`: phần tử có overflow và chênh lệch scroll/client size; không mặc định tất cả là lỗi.
- `renderedTableRows`: số hàng DOM đang render và vị trí hàng cuối; không chứa số ca hoặc dữ liệu ô.

Phần tử có bounding box nằm ngoài viewport chưa đủ để kết luận bị cắt: đó có thể là nội dung dài cuộn bình thường. Cần so sánh hai lần đo, `remainingScrollY`, overflow của ancestor và phần tử tại vùng xám.

Ưu tiên đo một case lỗi rõ trước. Các viewport 1440/1280/768/390 và smoke các trang khác chỉ thực hiện sau khi xác định và sửa đúng nguyên nhân; không cần tự đổi hàng loạt cấu hình ngay lúc thu thập bằng chứng.
