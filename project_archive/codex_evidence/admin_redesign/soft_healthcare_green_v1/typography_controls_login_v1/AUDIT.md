# Audit trước chỉnh typography/control và Login

## Font và cascade thực tế

`styles/index.css` import `fonts.css` (Segoe UI fallback), rồi `nunito.css`. Nunito variable thường/nghiêng 400–700 được lưu ở `public/assets/fonts/nunito`, gồm tiếng Việt. Body và Tailwind sans dùng Nunito; không thấy font-family riêng trong các component Admin/Login. Không cần đổi font, tải font hoặc thêm dependency.

Admin được giới hạn bởi `.eureka-admin`; Login nằm trong `.eureka-admin.admin-auth`. Parent dùng root riêng. `admin.css`, `content.css` và `permissions.css` có cascade độc lập; Tailwind utilities còn nhiều kích thước riêng. Global Nunito stylesheet có quy tắc heading/p/li, cần specificity đủ rõ ở phạm vi Admin để hierarchy mới có hiệu lực.

## Scale đang có

| Vùng | Trước sửa |
| --- | --- |
| Topbar group / title | 11px/600; 21px/650, mobile 18px |
| Page title trong content | token 24px, bị content.css ghi thành 21px |
| Section/card title | 15px trong content.css; JSX còn text-lg/18px |
| Body/support | Tailwind text-sm/14px, token body 13px; support 10/11/12px |
| Table | Utilities 12/14px; bảng user header 11px, cell 12px |
| Label/input/select/button | 11/12/14px tùy trang; min-height 30/34/36px ở các stylesheet |
| Badge/status/meta | 10/11/12px, trọng lượng và line-height khác nhau |
| Pagination | User 11px, các trang khác text-xs/text-sm; select có padding riêng |
| Sidebar/submenu | 13px/600; caption 10px uppercase |
| Login | Card đơn, title 18px; mô tả dư, URL backend công khai trong giao diện |

## Vấn đề chính và hướng sửa đã chọn

1. Font family đã đồng nhất và offline; vấn đề là scale, line-height, weight cùng nhiều CSS override nhỏ.
2. Control cùng một toolbar có nhiều chiều cao; select thiếu khoảng trống ổn định cho caret, đặc biệt “Hiển thị 10”. Pagination chưa có class trình bày chung và accessible label ở một số select.
3. Table label/cell và phần user permissions quá nhỏ so với body; meta cần scale chung thay cho 10–11px rải rác.
4. Login chưa có layout desktop hai cột, chứa lời dẫn nội bộ và URL backend không cần thiết.

Quyết định: giữ Nunito/tài nguyên cũ. Tập trung token và adapter typography/control vào stylesheet Admin riêng, dùng chung class cho rows-per-page/pagination, giữ event/state/API hiện có. Login dùng visual SVG/CSS tĩnh nằm ngay trong frontend, desktop hai cột, mobile thu gọn visual để ưu tiên form. Không slideshow, không network hoặc asset mới phức tạp.

Browser/native host được thử nhưng không khả dụng. Visual desktop/mobile sẽ ghi **NOT VERIFIED** nếu không có browser host ở cuối task; không suy ra UI PASS từ tests/build.

Đã lưu baseline hash 492 file và bản source trước sửa trong thư mục evidence này; không reset hoặc ghi đè thay đổi có trước.
