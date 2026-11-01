# Tinh chỉnh màu sidebar thu gọn

**Kết luận: PASS_WITH_FINDINGS** — code và kiểm thử đạt; chưa xác minh thị giác bằng browser thật.

## Phạm vi và audit

Chỉ sửa `Frontend/src/app/components/admin/admin.css`. Đã đọc báo cáo sidebar trước, source hiện tại và kiểm tra working tree trước khi sửa; giữ mọi thay đổi có trước.

Màu collapsed cũ quá nhạt (`#E9F8EE`); icon, hover, active, separator và focus kế thừa palette sidebar chung. CSS hiện có đủ xử lý nên không sửa React/navigation, không tạo tests chỉ để khớp mã màu.

Palette mới chỉ áp dụng dưới `@media (min-width: 1024px)` và `data-sidebar='collapsed'`. Tái sử dụng các biến CSS mà icon, hover, active, indicator và scrollbar đang dùng. Focus giữ outline hiện có, đổi sang xanh đậm để dễ thấy. Giữ sidebar expanded, mobile drawer, topbar, nội dung trang và Parent.

## Màu trước/sau

| Thành phần collapsed desktop | Trước | Sau |
| --- | --- | --- |
| Nền | `#E9F8EE` | `#D8F3E1` |
| Icon thường | `#586E61` | `#276749` |
| Nền hover | `#EFF8F2` | `#CCEFD8` |
| Icon hover | `#253D2E` | `#166534` |
| Nền active | `#E1F3E7` | `#BFEACD` |
| Icon active | `#21623B` | `#166534` |
| Vạch active 3px | `#218247` | `#16A34A` |
| Separator/border | `#DEEBE2` | `#C4E4CF` |
| Focus outline | `#218247` | `#166534` |
| Scrollbar track | `#E9F8EE` | `#D8F3E1` |
| Scrollbar thumb | `#A5CFB2` | `#65B981` |
| Thumb khi hover navigation | `#87BB99` | `#449B62` |

Giữ 80px chiều rộng, icon Lucide 19px, scrollbar WebKit 5px bo tròn, fallback thin, bỏ nút scrollbar mặc định và toàn bộ khoảng cách. Không thêm gradient, shadow hoặc opacity. Active vẫn có nền riêng và vạch 3px; hover không làm mất active. Scrollbar chỉ áp dụng trong navigation sidebar.

## Tương phản

Tính bằng độ chói tương đối sRGB từ các mã màu, evidence trong `contrast.json`:

- Icon thường/nền: **5,71:1** (trước 5,01:1).
- Icon active/nền active: **5,39:1**.
- Icon hover/nền hover: **5,74:1**.
- Focus/nền rail: **6,05:1**.

Các tỷ lệ này mô tả cặp màu, không thay thế đánh giá hình ảnh hoặc toàn bộ accessibility trong browser.

## Kiểm thử

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Full frontend, 27 file | **508 PASS, 0 FAIL** | `frontend-tests.log` |
| Typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Full suite gồm layout/branding/navigation, submenu, direct URL/history, quyền Admin/Staff, tooltip rail, dropdown tài khoản, focus trap, mobile drawer/resize, Parent và regression chức năng hiện có. Không thay đổi test. Expanded/mobile được bảo toàn bằng phạm vi media query và selector collapsed; chưa xác minh màu thực tế qua ảnh.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser, công cụ trả “The browser access host is unavailable”. Không có ảnh hoặc Chrome/Edge E2E; không tuyên bố active/hover/focus hay cuộn thực tế đã được xác minh bằng browser.

## Safety closure

- Đối chiếu 483 file baseline: chỉ `Frontend/src/app/components/admin/admin.css` thay đổi. Lưu `admin.before.css`, `colors.diff`, `baseline.json` và `safety_closure.json` trong thư mục này.
- Không sửa logic React, nhãn/brand, icon, route, quyền, submenu, Cài đặt/Đăng xuất, API hoặc nghiệp vụ.
- Không mở/ghi database thật; không gọi HTTP ứng dụng hoặc external network. Chỉ kiểm tra inventory công cụ browser.
- Backend, models, SHAP, Medical Knowledge, Parent, Graduation và `.env` không sửa. Không migration/retrain, thêm dependency hoặc restart server.
- HEAD và Git index giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout. Không xóa thay đổi có trước.

Hoàn tất phạm vi màu collapsed desktop và dừng; không mở rộng thiết kế.
