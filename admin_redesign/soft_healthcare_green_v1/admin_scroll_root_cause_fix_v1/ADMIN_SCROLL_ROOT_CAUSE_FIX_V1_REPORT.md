# Eureka — Admin Global Scroll & Content Clipping

**BLOCKED — chưa đủ bằng chứng runtime để chọn bản sửa an toàn.**

**BROWSER NOT VERIFIED. Không sửa source ứng dụng/CSS trong task này.** Đã audit shared render/layout, lưu baseline và chuẩn bị công cụ DOM chỉ đọc. Chưa xác định được phần tử tạo vùng xám, vùng đang cuộn thực tế hoặc ancestor cắt nội dung trên Chrome. Không tuyên bố đã sửa hết lỗi.

## Triệu chứng và khả năng tái hiện

Người dùng báo Trend/Monthly bị cắt nội dung và có nền xám phía dưới, cùng vấn đề scroll trước đó tại Area. Chưa tái hiện trong browser: inventory trả `apps=[]`, `browsers=[]`, native pipe unavailable và browser access host unavailable. Không có DOM runtime, screenshot hoặc số đo scrollHeight/clientHeight/scrollTop/elementFromPoint. Không dùng JSDOM để thay thế bằng chứng kích thước Chrome.

## Audit source và scroll ownership

Đã kiểm tra chuỗi App → AdminLayout → main/admin-page → AppPages → page roots. AppPages render một route con trong Suspense; AdminLayout cung cấp main và wrapper. Styles nhập qua AdminLayout, AppPages, stylesheet chính và module cũng được đối chiếu. Không coi class/file là tồn tại khi chưa đọc source.

| Vùng | Source xác nhận | Vai trò dự kiến / điều chưa biết |
|---|---|---|
| html, body, #root | Height 100%, margin body 0 trong index.html | Document viewport; chưa đo liệu body có scroll dư thực tế |
| `.eureka-admin` | flex, height 100dvh, min-height 0, overflow hidden | Shell viewport; có thể cắt descendant nếu scroll ownership/runtime height sai, nhưng chưa chứng minh lỗi tại selector này |
| `.admin-workspace` | flex 1, column, min-height/min-width 0 | Bố trí topbar và main |
| `.admin-topbar` | flex-shrink 0, min-height 76px | Giữ ngoài main scroll; source hiện không đặt sticky cho topbar |
| `.admin-content` | flex 1, min-height/min-width 0, overflow auto | Scroll chính theo thiết kế; chưa có computed style/height/scroll thực tế |
| `.admin-page` | max-width 1560px, margin ngang auto, không ép height viewport | Wrapper nội dung, không thêm scroll chủ đích |
| `.admin-page-stack` | flex column, gap nội dung | Page flow; phải đo chiều cao thật sau API response |
| `.admin-navigation` | min-h-0, flex-1, overflow-y-auto/overflow-x-hidden | Sidebar scroll riêng có chủ đích |
| Area tỉnh | max-height 300px, overflow-y auto | Scroll con chủ đích |
| Area/analytics tables | overflow-x auto, không đặt khung height dọc tại wrapper | Cuộn ngang khi bảng rộng; cần đo cả hai trục runtime |
| Monthly bar viewport | max-height 420px, overflow-y auto | Vùng cuộn biểu đồ dài chủ đích; chart giữ chiều cao theo toàn bộ dữ liệu |
| Pickers | menu giới hạn chiều cao và overflow auto | Scroll lựa chọn có chủ đích |
| Trend tooltip/positioned elements | Có phần tử positioned và page container inline-size | Cần đo containing ancestor/overflow; chưa quy kết là nguyên nhân của lỗi đa trang |

Padding đáy main hiện 40px desktop, 32px ở breakpoint trung gian, 28px mobile. Source này không tự chứng minh vùng xám lớn; không sửa padding để che triệu chứng. Các pseudo-element/positioned styles cần đối chiếu với phần tử thực tế dưới điểm xám; không có phép đo hiện tại để quy lỗi cho chúng.

Bản sửa placeholder 180px trước đó có phạm vi trạng thái rỗng/loading của Area. Bằng chứng đó chưa xác định nguyên nhân cắt nội dung khi Trend/Monthly đang có dữ liệu.

## Giả thuyết cần kiểm chứng

1. Body/document đang cuộn trong khi shell vẫn bị giới hạn viewport và clipping, hoặc main chưa có chiều cao hữu hạn theo CSS thực tế. Source flex/min-height hiện phù hợp với ý định main-scroll; cần computed values để biết có override/khác biệt runtime hay không.
2. Descendant hoặc positioned element góp overflow ra ngoài content nhưng bị ancestor cắt, tạo scroll range hoặc nền document khác vùng app. Cần vị trí phần tử cuối và clipping ancestors.
3. CSS/runtime bundle/page state khác source đang audit, hoặc kích thước thay đổi sau dữ liệu/resize. Cần xác định root trang đang render, viewport, computed dimensions và scroll owners.

Các mục trên **chưa phải root cause được xác minh**. Không áp dụng overflow hidden, height auto, min-height 0, reset body hoặc thay cơ chế shell trên cơ sở các giả thuyết này.

## Bằng chứng cần lấy và công cụ đã chuẩn bị

Chạy `CAPTURE_SCROLL_MEASUREMENTS.js` trong Chrome Console **khi lỗi còn hiện**, sau đó cuộn bằng tay và lấy snapshot lần hai. Đổi tọa độ `grayPoint` nếu điểm mặc định chưa nằm trong vùng xám. Hướng dẫn ở `CHROME_MEASUREMENTS_GUIDE.md`.

Script thu:

- innerHeight/innerWidth, scrollY/scrollX, devicePixelRatio và visualViewport;
- document scrollingElement, html/body/#root rect và scroll/client sizes;
- shell/workspace/main/page/sidebar, page root và các scroll containers chủ đích;
- computed height/min/max-height, overflow, flex/grid, position, containment, transform, padding/margin và pseudo-element geometry properties;
- phần tử cuối có text trong DOM, phần tử text có đáy xa nhất và ancestor; không ghi nội dung text;
- elementFromPoint tại vùng xám và ancestor;
- vị trí hàng cuối của từng bảng, số hàng DOM và danh sách ứng viên overflow có giới hạn.

Chỉ đọc: không mutate DOM/CSS, không scroll tự động, không API/fetch, không đọc cookies/storage/form values, không clipboard, không event listener hoặc interval. Không ghi nội dung bảng/tài khoản/y khoa hoặc URL. Output là JSON trong Console. ID được giới hạn vào các ID cấu trúc đã biết.

Độ đo ngoài viewport không tự chứng minh lỗi clipping; snapshot cần được đọc cùng scrollTop/maxScrollY/remainingScrollY và chain overflow. Nếu mở DevTools khiến lỗi biến mất, cần ghi nhận resize/dock như một phần bằng chứng.

## File/evidence và kiểm tra

Chỉ tạo file trong thư mục evidence này:

- `CAPTURE_SCROLL_MEASUREMENTS.js`, `CHROME_MEASUREMENTS_GUIDE.md`.
- Báo cáo, baseline/source_before, browser status và scripts/log kiểm chứng.

Không sửa/thêm source frontend, backend, CSS hoặc test ứng dụng. Baseline là working tree thực tế, không lấy Git HEAD. Source_before giữ 10 file render/layout đã audit, không sao chép secrets.

| Kiểm tra | Kết quả / giới hạn |
|---|---|
| Browser / DOM runtime / 1440,1280,768,390px | **NOT VERIFIED** |
| node --check script đo | PASS |
| Fixture check script đo | PASS: schema/JSON hợp lệ, DOM không đổi, không network/scroll/storage/cookie, không lộ fixture text hoặc input |
| Fixture geometry | Không xác minh; JSDOM không có layout thật |
| Protected hash | **626/626 không đổi**, không có source mới, Git index không đổi |
| git diff --check | PASS |
| Frontend tests/typecheck/build của task này | **NOT RUN**: không có application patch; điều kiện dừng yêu cầu BLOCKED khi thiếu bằng chứng |
| Backend/model tests | Không chạy |

Không sử dụng PASS từ các task trước để tuyên bố lỗi hiện tại đã hết. Chưa chạy nghiệm thu hồi quy runtime cho Area, Monthly, Trend, Seasonal, Age, Dashboard, Forecast, Reports/Permissions vì chưa có bản sửa và browser. Sau khi đủ số đo và xác định nguyên nhân, phạm vi affected pages mới được chốt theo selector/component cần sửa.

Chi tiết kiểm tra ở `capture-script-check.json`, `safety-check.json`, `protected-hashes-after.json`, `browser-verification.json`. Script `verify-capture-script.cjs` chạy trên fixture JSDOM tổng hợp, không load app hoặc gọi backend.

## Safety closure

- Bảo toàn toàn bộ working tree, Forecast F01/F02, các batch redesign, Parent/Login, các vùng scroll con hiện có và mọi nghiệp vụ/API/cache/permission.
- Không sửa backend/Python, DB, migration, model/retrain, `.env`, dữ liệu thật, tài khoản/quyền thật, bản thực tập hoặc Graduation.
- Không import/sync dữ liệu, startup/lifespan, gọi API thật, network ngoài, restart/kill backend hoặc cài dependency.
- DB thật không được mở/ghi và bị loại khỏi hash inventory; không khẳng định thay đổi do tiến trình khác.
- Git chỉ đọc status/diff/check; không stage/commit/push/reset/stash/clean/restore/checkout.

**Dừng ở trạng thái BLOCKED theo mục 12 của task.** Cần hai JSON DOM measurements từ trạng thái lỗi để tiếp tục chọn sửa đúng nguyên nhân; không sửa CSS theo phỏng đoán.
