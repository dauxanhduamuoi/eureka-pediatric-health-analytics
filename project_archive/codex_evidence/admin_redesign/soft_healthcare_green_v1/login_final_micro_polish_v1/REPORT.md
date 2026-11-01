# Eureka - Final Login UI Micro-polish

**PASS_WITH_FINDINGS** - Hoàn tất chỉnh frontend đúng phạm vi; targeted tests/typecheck/build/diff check PASS. **BROWSER NOT VERIFIED** vì browser access host không khả dụng. Không tuyên bố visual/responsive/keyboard E2E PASS từ unit tests.

## 1. Audit trước sửa

Đã đọc LoginPage.tsx, login.css, LoginVisualCarousel.tsx, loginSlides.ts và các tests liên quan; xem cả ba ảnh nguồn hiện có.

| Quan sát | Phân loại / xử lý |
| --- | --- |
| Password chỉ có type=password, chưa có nút hiện/ẩn | REFINE: thêm nút mắt native, state hiển thị riêng |
| Input đã có focus border/ring xanh từ CSS Admin dùng chung | KEEP màu/ring/focus-visible; chỉ bổ sung transition nhanh, không chồng thêm ring |
| Nút submit có hover, chưa có phản hồi active riêng | KEEP hover và busy logic; thêm inset shadow nhẹ khi active |
| Parent link có hover màu, chưa có dấu hiệu underline khi hover/focus | REFINE gạch chân phần chữ; giữ nguyên href và điều hướng |
| Overlay kết thúc ở 90% opacity, đáy khá nặng | REFINE gradient nhiều stop mềm hơn, kết thúc 78%; không sửa file ảnh hoặc vị trí crop |
| Nunito, title, nhãn, cỡ chữ, required/autocomplete, error | KEEP vì đã rõ và phù hợp hệ thống |
| Hai cột, responsive, carousel pause/reduced motion | KEEP cấu trúc, breakpoints và toàn bộ logic |

Không redesign, không thêm mô tả/lời chào/chức năng xác thực mới.

## 2. File thay đổi

Chỉ **4 file frontend có sẵn**:

1. `Frontend/src/app/components/LoginPage.tsx`
2. `Frontend/src/app/components/login.css`
3. `Frontend/src/app/components/LoginPage.test.tsx`
4. `Frontend/src/app/components/LoginVisualCarousel.test.tsx`

`changes.diff` đối chiếu với source trước task; `baseline.json` và các snapshot LoginPage/login.css giữ dấu vết. Không lấy HEAD để ghi đè working tree.

## 3. Chi tiết tinh chỉnh

### Hiện/ẩn mật khẩu

- Mặc định vẫn ẩn. Một boolean `showPassword` chỉ điều khiển type text/password của cùng input, không sửa value hoặc gọi login.
- Dùng Eye/EyeOff của Lucide có sẵn. Nút `type=button`, aria-controls=password, aria-pressed và nhãn **Hiện mật khẩu / Ẩn mật khẩu**.
- Mouse-down được preventDefault để không lấy mất focus khi đang nhập; keyboard vẫn có thể focus và kích hoạt nút native. Không thêm key handler chặn Enter.
- Nút nằm tuyệt đối trong wrapper, vùng bấm 40px theo token control; input có padding phải 52px tránh chữ đè icon. Input display:block tránh khoảng baseline thừa do wrapper mới.
- Không log, sao chép clipboard hoặc lưu mật khẩu vào storage. Password state và luồng truyền credentials vẫn là logic có sẵn.

### Tương tác

- Input chuyển border-color/box-shadow 150ms, tái sử dụng focus xanh hiện có; min-height 46px và kích thước border giữ nguyên.
- Submit giữ hover hiện có; active có inset shadow nhẹ, không translate/kéo giãn nút. Disabled/loading giữ nguyên.
- Nút mắt có hover mint, icon xanh rõ; keyboard focus-visible tiếp tục dùng outline xanh từ stylesheet chung.
- Link phụ huynh chuyển màu 150ms, gạch chân phần chữ khi hover/focus, vẫn `/phu-huynh`.
- Reduced motion tắt các transition mới, không thêm animation.

### Lớp phủ ảnh

Trước: transparent 35% -> 28% tại 56% chiều cao -> 90% ở đáy.

Sau: 0% tại 36% -> 12% tại 52% -> 55% tại 72% -> 78% ở đáy, cùng tông xanh RGB(9,37,24). Giữ lớp phủ pointer-events:none, vị trí/z-index, chữ trắng, chú thích ảnh, các controls và image object-fit/object-position.

Đã xem ảnh gốc để tránh thay crop/khuôn mặt; cả ba file ảnh byte-identical. Tuy nhiên độ tương phản trên ảnh render thực tế và mức độ rõ khuôn mặt ở từng viewport **chưa xác minh bằng browser**. Không khẳng định chỉ từ source rằng mọi tổ hợp ảnh/kích thước đều đạt visual PASS.

## 4. Typography và thiết kế giữ nguyên

Giữ Nunito offline và hệ token hiện tại. Title Đăng nhập 28px desktop/24px mobile; label và button dùng 14px; link/error dùng token label 13px. Giữ weight, khoảng label-input 8px, hai cột, padding panel, brand và tên hệ thống.

Không đổi ảnh, nội dung slide, thời gian tự chuyển **6500ms**, fade **700ms**, cơ chế pause/resume/manual navigation/hover/focus/tab hidden/reduced motion. Không sửa LoginVisualCarousel.tsx hoặc loginSlides.ts. Không thêm Forgot password/Remember me/Registration/Social login.

## 5. Chức năng được bảo toàn

Handle submit, API/auth context, session, permissions, navigation, required/autocomplete, loading/error/retry đều không sửa. Toggle không phải submitter; form vẫn chỉ có một submit button. Link phụ huynh giữ nguyên URL.

Tests xác nhận chuỗi mật khẩu có tiếng Việt và khoảng trắng giữ đúng qua hai lần toggle; input node, selection range và focus không đổi trong JSDOM. Khi toggle được focus bằng bàn phím, kích hoạt không gọi login và nút giữ focus. Giá trị credentials vẫn được gửi nguyên vẹn qua context mock khi form submit.

## 6. Kết quả kiểm thử

| Kiểm tra | Kết quả / evidence |
| --- | --- |
| LoginPage | **9 PASS** |
| LoginVisualCarousel | **12 PASS** |
| App navigation/permission boundary smoke | **22 PASS** |
| Tổng targeted frontend | **43 PASS**, 3 files, `frontend-tests.log` |
| Typecheck | **PASS**, exit 0, `typecheck.log` |
| Production build | **PASS**, exit 0, `build.log` |
| git diff --check | **PASS**, exit 0, `diff-check.log` |
| Trailing whitespace cho các file đổi | **PASS**, kiểm tra bổ sung |
| Backend/model tests | Không chạy, đúng phạm vi frontend |

Lệnh tests:

`npm run test -- src/app/components/LoginPage.test.tsx src/app/components/LoginVisualCarousel.test.tsx src/app/App.navigation.test.tsx --maxWorkers=2`

Phạm vi: ẩn mặc định, hiện/ẩn, không mất nội dung/focus/con trỏ, native toggle không submit, loading/error/success/retry, required/autocomplete, Parent href; carousel ba ảnh, thời gian wrap, pause, slow/error/fallback, reduced motion, document hidden, form-only viewport và cleanup timers; toggle không khởi động lại timer hoặc làm mất focus khi slide đổi.

**Giới hạn Enter:** JSDOM không tự sinh implicit form submission từ keydown Enter. Tests xác nhận event không bị chặn và gọi native requestSubmit trên đúng form ở cả trạng thái password/text. Đây là kiểm thử đường submit và HTML semantics, không phải bằng chứng thao tác Enter thực tế trên Chrome.

## 7. Browser verification

Discovery trả `browsers: []` với lỗi **The browser access host is unavailable**. Không thử đăng nhập bằng tài khoản thật, không gọi API thật, không mở backend để né hạn chế.

**BROWSER NOT VERIFIED**: chưa xác minh desktop/mobile, hover/focus/active, touch, Enter implicit, layout shift và gradient sau sửa bằng trình duyệt thật. Không có ảnh chụp trước/sau của UI render. Việc đã xem ảnh nguồn không thay thế kiểm tra trình duyệt.

Responsive source/breakpoints hai cột/form-only giữ nguyên; carousel media-query tests vẫn PASS. Không tuyên bố không tràn ngang/chồng chữ chỉ từ build hoặc JSDOM.

## 8. Safety closure và kết luận

- Đối chiếu **562 file source/protected**: chỉ 4 file Login/test nêu trên thay đổi, không có thay đổi ngoài allowlist; `safety-final.json` ghi chi tiết.
- Backend source, 221 model, Parent, Dashboard, Reports PDF/CSV, permissions, AuthContext/API/navigation, Nunito assets, ba ảnh Login, carousel code/config và .env được baseline bao phủ giữ nguyên hash.
- Không thực hiện SQL, không hash/khôi phục DB trong task này, không migration/import/retrain, không dùng vấn đề hash DB ở task trước để can thiệp DB.
- Không đăng nhập thật hoặc dùng mật khẩu thật để test; toàn bộ auth trong tests là mock với credentials kiểm thử.
- Không sửa Graduation, không start/kill/restart backend, không thêm dependency hoặc network request để tải ảnh/font.
- Không stage/commit/push/reset/stash/clean/restore/checkout. Git index byte-identical. Giữ mọi thay đổi có trước.

**PASS_WITH_FINDINGS**: frontend và kiểm thử đúng phạm vi đã hoàn tất; giới hạn còn lại là browser/visual/E2E chưa xác minh. Dừng tại Login micro-polish, không tiếp tục redesign hoặc sửa Admin/backend.
