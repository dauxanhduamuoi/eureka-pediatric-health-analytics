# Login Photo Carousel — Eureka

Kết luận: **PASS_WITH_FINDINGS**. Đã sửa frontend thực tế, tích hợp **3 ảnh riêng**, giữ login logic và đạt kiểm thử. **BROWSER NOT VERIFIED**: công cụ native/browser không kết nối được, chưa có xác minh visual thực tế tại 1440/1280/768/390px.

## Audit và đối chiếu tham khảo

Trước sửa, Login đã có hai cột, Nunito offline, SVG tĩnh, form `onSubmit` gọi `login(username, password)` từ AuthContext, required/autocomplete, loading/error và link `/phu-huynh`. Có thể tái sử dụng toàn bộ form/handler và token Soft Healthcare Green. Không cần sửa backend, API, dependency hoặc font.

ZIP chưa có lúc bắt đầu. Sau khi người dùng báo vừa tải, đã tìm thấy `C:\Users\LENOVO\Downloads\eureka_login_visual_reference.zip`, kiểm tra cấu trúc/path an toàn và đọc README. Đã xem trực tiếp hai ảnh `reference/login_single_layout_reference.png`, `reference/four_login_layouts_reference.png` cùng asset ảnh riêng. `reference_manifest.json` lưu SHA256 và danh sách đã xem. Các screenshot chỉ tham khảo bố cục; **không được dùng trong runtime**.

Áp dụng container giữa màn hình, ảnh trái/form phải khoảng 55/45, nền mint gần trắng, bo 24px, viền/shadow nhẹ. Chữ, logo, điều hướng đều là HTML/CSS. Logo/tên hệ thống đặt một lần ở cột form; phần ảnh chỉ có thông điệp ngắn và chú thích nguồn minh họa. Không thêm tuyên bố AI chẩn đoán/cam kết hiệu quả y tế hoặc các nút Quên mật khẩu/Ghi nhớ không có chức năng.

## Ảnh thực sự tích hợp

Ảnh runtime đặt tại `Frontend/public/assets/login/`:

| File | Nguồn | Kích thước | Dung lượng |
| --- | --- | --- | --- |
| `pediatric-consultation.webp` | Asset `assets/pediatric_consultation_slide_01.webp` trong ZIP người dùng; chép nguyên byte | 1122×1402 | 70.306 bytes |
| `parent-child-lounge.webp` | Ảnh tạo mới: mẹ và con trong phòng chờ | 960×1200 | 81.428 bytes |
| `pediatric-clinic.webp` | Ảnh tạo mới: không gian phòng khám nhi | 960×1200 | 71.616 bytes |

Tổng **223.350 bytes (~218KiB)**. Ba hash khác nhau; cả ba có trong production output. Không dùng URL ảnh bên ngoài lúc runtime, watermark, screenshot UI hoặc dữ liệu bệnh nhân. Chú thích trên giao diện: **“Ảnh minh họa · không phải bệnh nhân của hệ thống”**; alt của ảnh tạo mới nói rõ AI.

Hai ảnh bổ sung được tạo bằng **built-in image_gen**, kiểm tra trực quan rồi tối ưu WebP theo yêu cầu, không dùng CLI/API key hoặc stock không rõ quyền. Prompt đầy đủ và trạng thái sử dụng lưu tại [IMAGE_PROMPTS.json](IMAGE_PROMPTS.json); provenance/hash/dimensions tại [asset_manifest.json](asset_manifest.json). Có một ảnh consultation tạo tạm trước khi ZIP xuất hiện, sau đó loại khỏi carousel và thay bằng đúng asset người dùng; bản gốc tạo tạm vẫn ở generated_images, không nằm trong bundle runtime.

Mỗi slide có `object-position` riêng trong `loginSlides.ts`; ảnh dùng `object-fit: cover`, không nhúng chữ/logo. Đã kiểm tra nội dung ảnh nguồn, chưa kiểm tra crop bằng browser thật.

## Carousel và fallback

- `LoginVisualCarousel` độc lập với auth; config ảnh/câu chữ/position nằm trong `loginSlides.ts`.
- Đổi ảnh mỗi **6.500ms**, crossfade CSS **700ms**; không trượt hoặc zoom.
- Chấm điều hướng chọn thủ công; lựa chọn thủ công dừng autoplay đến khi bấm Tiếp tục. Có nút Tạm dừng/Tiếp tục và focus bàn phím.
- Tạm dừng khi hover, focus nằm trong carousel, chạm vùng ảnh, form đang submit, tab bị ẩn hoặc viewport chỉ hiện form.
- Reduced motion: tắt autoplay và transition; vẫn chọn ảnh thủ công được. Cập nhật khi preference đổi trong phiên.
- Một interval đang hoạt động tối đa; cleanup khi điều kiện dừng hoặc unmount, có kiểm tra StrictMode. Việc nhập tài khoản không tạo thêm interval hoặc mất focus/dữ liệu.
- Ảnh đầu eager/high priority; không chờ các ảnh sau. Ảnh sau lazy/low priority. Native `fetchpriority` viết lowercase để tương thích React 18 không phát cảnh báo.
- Chỉ autoplay tới ảnh đã tải xong. Ảnh chậm có dot tạm disabled; ảnh lỗi bị loại khỏi vòng quay. Nếu ảnh hiện tại lỗi, chọn ảnh còn dùng được. Nếu tất cả lỗi, giữ nền/chú thích “Không tải được ảnh minh họa.”; form đăng nhập vẫn độc lập, không bị lỗi theo.

## Responsive

- Desktop: max-width **1320px**, tỷ lệ khoảng 55/45, photo pane có min-height 660px để ổn định; form và trang có chiều cao tự nhiên, không cắt nội dung bằng fixed height.
- Khoảng 901–1100px: tỷ lệ 50/50 và padding nhỏ hơn để form không bị bó.
- Từ 900px trở xuống, gồm tablet 768px và mobile 390px: chỉ hiện form, khung tối đa 500px (mobile 480px); ẩn ảnh và dừng timer, không bắt người dùng cuộn qua ảnh lớn.
- Đây là cấu hình CSS và kiểm tra matchMedia bằng mocks. **Chưa xác minh hình ảnh/overflow/crop thực tế** tại các viewport yêu cầu.

## Login giữ nguyên

`handleSubmit` được đối chiếu nguyên văn với bản trước sửa và không đổi. Username/password state, required/autocomplete, `busy`, error từ context, nút submit và Parent href giữ nguyên. Không sửa AuthContext, API client, token/session/JWT hoặc quyền tài khoản.

Form vẫn dùng semantic `<form onSubmit>` và `<button type="submit">`, không thêm key handler riêng. Unit test xác minh native `requestSubmit()` đi qua validation và submit hiện có; **phím Enter thực tế trong browser chưa xác minh** do thiếu browser host. Pending request giữ loading/disabled; reject/error vẫn hiển thị và có thể thử lại, không có success giả. Không gọi backend thật để thử credentials.

## Files sửa/thêm

Sửa đúng ba file có sẵn trong working tree:

1. `Frontend/src/app/components/LoginPage.tsx` — thay SVG bằng carousel, đặt brand ở form; giữ handler.
2. `Frontend/src/app/components/login.css` — layout ảnh/form, overlay/crossfade/control và responsive riêng Login.
3. `Frontend/src/app/components/LoginPage.test.tsx` — thêm kiểm tra native form/required validation.

Thêm ba file source:

1. `Frontend/src/app/components/LoginVisualCarousel.tsx`
2. `Frontend/src/app/components/loginSlides.ts`
3. `Frontend/src/app/components/LoginVisualCarousel.test.tsx`

Thêm ba asset WebP như bảng trên. Evidence đặt trong thư mục báo cáo này; [scoped.diff](scoped.diff) chỉ chứa thay đổi của task, không trộn các sửa đã có trước.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Carousel lifecycle/interaction/error/slow/reduced-motion/focus, 11 tests | **PASS** |
| Login render/submit/loading/error/retry/required/native submit/Parent link, 5 tests | **PASS** |
| Branding tiếng Việt, 9 tests | **PASS** |
| App navigation regression, 22 tests | **PASS** |
| Tổng targeted frontend: 4 files | **47 PASS** |
| Typecheck | **PASS** |
| Production build | **PASS** |
| `git diff --check` + whitespace file mới | **PASS** |
| Browser visual/real Enter, desktop/mobile | **NOT VERIFIED** |

Lệnh tests: `npm.cmd test -- src/app/components/LoginVisualCarousel.test.tsx src/app/components/LoginPage.test.tsx src/app/components/admin/BrandingVietnamese.test.tsx src/app/App.navigation.test.tsx --maxWorkers=1`. Logs: `frontend-tests.log`, `typecheck.log`, `build.log`, `diff-check.log`.

Trong quá trình test đã sửa assertion vòng quay/fallback và assertion interval: ảnh tải bổ sung có thể thay interval sau khi cleanup; điều cần giữ là không có hai interval hoạt động đồng thời và nhập liệu không tạo interval mới. Test cuối đạt và không còn warning React fetchPriority. Không sửa auth/product logic để làm test qua.

## Safety closure

- Không sửa backend/auth policy/DB/quyền tài khoản/Parent/Admin dashboard/sidebar/topbar/các trang khác/Weather AI/Forecast AI/SHAP/Medical Knowledge.
- Không đọc DB qua SQL, ghi DB thật, migration, import, retrain, start/restart/kill backend hoặc thử tài khoản thật.
- Giữ Nunito offline và toàn bộ dependencies; không sửa `.env`, Graduation/model hoặc dữ liệu bệnh nhân.
- Baseline **495 file** được đối chiếu: chỉ ba source Login nêu trên đổi hash; mọi file baseline ngoài phạm vi và hai DB file giữ nguyên hash. Handler login được đối chiếu riêng.
- HEAD và Git index giữ nguyên SHA256; staged diff rỗng. Không stage/commit/push/reset/stash/clean/restore/checkout; không xóa thay đổi có trước.
- Chỉ gửi prompt tạo các cảnh minh họa giả định tới built-in image_gen; không gửi dữ liệu project/bệnh nhân/credentials. Runtime chỉ dùng ảnh local.
- Browser tool trả native pipe unavailable/browser access host unavailable; không tạo screenshot giả hoặc tuyên bố visual/E2E PASS.

Kết luận **PASS_WITH_FINDINGS** vì triển khai và kiểm thử hoàn tất, còn giới hạn visual/browser nêu trên. Dừng đúng phạm vi Login.
