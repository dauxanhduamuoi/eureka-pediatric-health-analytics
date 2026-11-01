# Eureka — Area Insights Scroll Bug Fix V1

**PASS_WITH_FINDINGS cho bản sửa source đã xác nhận. BROWSER NOT VERIFIED.** Đã bỏ chiều cao rỗng cố định ở phần khuyến nghị và giới hạn grid chi tiết theo nội dung. **Chưa thể kết luận toàn bộ hiện tượng scroll dư trên Chrome đã hết**, đặc biệt nếu khoảng trắng vẫn xuất hiện khi đã có các dòng khuyến nghị.

## Audit và phạm vi xác nhận

Đã kiểm tra App/AppPages, AdminLayout, CSS shell/content/typography, styles/index/theme, AreaInsights, AreaResults và CSS Area V2 trước sửa.

| Container | Layout/scroll hiện tại | Kết luận |
|---|---|---|
| html/body/#root | height 100% | Phù hợp shell viewport, không tự sửa |
| `.eureka-admin` | height 100dvh, flex, overflow hidden | Chứa shell; chưa có bằng chứng phải đổi |
| `.admin-workspace` | flex column, flex 1, min-height 0 | Cho phép content co đúng viewport |
| `.admin-content` | flex 1, min-height 0, overflow auto | Scroll chính; padding đáy 40px desktop/28px mobile là khoảng đệm hiện có |
| `.admin-page` | max-width, không ép height/min-height viewport | Không thấy chiều cao dư từ wrapper |
| Area root | flex column từ admin-page-stack, container inline-size; không có 100vh/height 100% | Không thêm scroll hoặc chiều cao viewport mới |
| `.area-province-choices` | max-height 300px, overflow-y auto | Scroll tỉnh chủ đích, giữ nguyên |
| `.area-table-scroll` | overflow-x auto, không đặt chiều cao | Giữ cuộn ngang bảng, không đặt khung scroll dọc mới |
| `.area-detail-workspace` | grid auto rows, gap 14px | Bổ sung hàng theo nội dung, không phân bố không gian dư |
| Khuyến nghị rỗng/loading | Dùng chung `Empty`, có utility `h-[180px]` | Nguồn chiều cao thừa cuối trang được xác nhận từ source và test |

Placeholder 180px hợp lý cho vùng biểu đồ nhưng bị dùng cho một dòng thông báo cuối trang. Điều này làm phần rỗng khuyến nghị chiếm block lớn cả khi đang tải và khi API không có khuyến nghị. `baseline-empty-height-diagnostic.log` tái hiện việc phần cuối nhận `h-[180px]` trước sửa.

Không có browser để đo scrollHeight/bounding boxes hoặc đối chiếu đúng state runtime của người dùng. Không khẳng định grid stretch hoặc Admin wrapper là nguyên nhân đã được tái hiện. Gia cố track grid chỉ làm rõ quy tắc kích thước tự nhiên; không được coi là bằng chứng pixel.

## Thay đổi tối thiểu

1. `Frontend/src/app/components/AreaInsights.tsx`
   - Thêm tùy chọn presentation `compact` cho Empty, chỉ truyền ở `recommendationEmpty`.
   - Trạng thái khuyến nghị rỗng/loading dùng chiều cao tự nhiên; cùng nội dung/spinner.
   - Các placeholder biểu đồ/bảng khác giữ nguyên 180px.
2. `Frontend/src/app/components/areas/AreaInsights.css`
   - Detail grid: `align-content: start; grid-auto-rows: max-content` để các hàng theo nội dung thay vì giãn vào không gian dư.
   - Recommendation: `align-self: start`.
   - Thông báo compact chỉ có padding dọc 4px, line-height 1.6; không đặt height/min-height hoặc overflow để giấu nội dung.
3. `Frontend/src/app/components/AreaInsights.test.tsx`
   - Bảo vệ trạng thái footer không còn block chart 180px, cả rỗng và đang tải.
   - Bảo vệ placeholder chart cũ, recommendation/cache, hierarchy V2 và không gọi thêm request khi đổi view.

Không sửa shared wrapper/CSS, không chuyển scroll chính sang body, không thêm overflow hidden để che bug, không thêm nested scroll hoặc bỏ nội dung. Bảng vẫn full-width ngoài grid hai cột, khuyến nghị vẫn ngay sau bảng với gap 14px. Giữ toàn bộ font/màu/typography V2.

## Baseline và logic bảo toàn

- `baseline.json`: 626 file từ working tree thực tế, không dùng Git HEAD; ba source_before và git status được lưu trước sửa.
- `scope-and-contract-check.json` xác nhận toàn bộ statements controller AreaInsights không đổi. API/payload, cache, permissions, ranking/Top 12, pagination và helper nghiệp vụ giữ nguyên.
- Các helper gốc ngoài Empty không đổi theo AST; data props của filter/summary/distribution/details không đổi. Chỉ placeholder khuyến nghị thêm compact.
- AreaResults, AreaFilterPanel, Admin shell và các cải tiến V2 đều nằm trong protected inventory, hash không đổi.
- CSS chỉ thay hai rule trong Area, thêm một rule compact; mọi rule khác giữ nguyên, bao gồm scroll tỉnh 300px, scroll bảng, breakpoint desktop/mobile và chiều cao chart.
- Các assertion test gốc giữ nguyên; không nới timeout hoặc bỏ assertion.
- **623 protected files không đổi**, không có source mới, không có thay đổi ngoài scope hoặc trailing whitespace. Git index không đổi.

## Kiểm thử

| Lượt | Kết quả | Log |
|---|---|---|
| Baseline Area + AdminLayout | 29 PASS | `baseline-tests.log` |
| Diagnostic nguồn height 180px | Tái hiện được | `baseline-empty-height-diagnostic.log` |
| Targeted regression cuối | **77/77 PASS, 5 files** | `final-regression.log` |
| Typecheck | PASS, exit 0 | `typecheck.log` |
| Production build | PASS, exit 0 | `build.log` |
| git diff --check | PASS, exit 0 | `diff-check.log` |
| AST/hash/CSS scope/whitespace | PASS | `verification.log`, `scope-and-contract-check.json`, `protected-hashes-after.json` |

Suite cuối gồm AreaInsights (20), AdminLayout (11), ChartVisuals (5), AdminPageTitles (19), App.navigation (22). Bao phủ filter miền/tỉnh, chọn/bỏ chọn/xóa bộ lọc, hai view chart/ranking, hai bảng và phân trang, page-size, cache, số liệu/order/màu/zero/missing, loading/error/retry và quyền sync với API mock. Không cộng lặp test qua các lượt, không chạy full frontend/backend/model suite, không có timeout.

Unit tests và kiểm tra CSS source không đo được scroll thực hoặc chứng minh hết khoảng trắng trên Chrome.

## Browser và finding còn lại

`browser-verification.json`: apps=[], browsers=[]; native pipe unavailable và browser access host unavailable. Chưa kiểm tra pixel/scroll ở 1440, 1280, 768, 390px.

- Đã xử lý được case nguồn: khuyến nghị rỗng/loading có height 180px.
- Chưa tái hiện đầy đủ hiện tượng runtime người dùng mô tả. Nếu khoảng trắng xuất hiện khi đang có nội dung khuyến nghị, chưa có đủ bằng chứng xác định nguyên nhân của case đó.
- Không sửa shell hoặc đặt hàng loạt height/min-height về 0 dựa trên phỏng đoán.
- Cần nghiệm thu browser thật: kéo tới cuối `.admin-content`, kiểm tra trạng thái có/rỗng/loading, cả chart/ranking, đổi bảng/page-size, sidebar expanded/collapsed và mobile. Nội dung cuối chỉ nên cộng khoảng đệm shell; không được clipping khuyến nghị. Checklist này chưa được thực hiện.

Hai câu hỏi về mode và nội dung khuyến nghị đã được gửi để đối chiếu state thực tế; chưa có câu trả lời tại thời điểm lập báo cáo. Bản sửa chỉ dựa vào case đã chứng minh trong source.

## Safety closure

Không sửa backend/API, DB, model, dữ liệu/ranking/pagination, Parent, trang khác, shared layout/theme, `.env`, bản thực tập hoặc Graduation. Không migration, import/sync thật, retrain, startup/lifespan hoặc thay quyền thật.

Chỉ dùng fixture/API mocks; không gọi backend thật, không chứa dữ liệu bệnh nhân thật trong evidence, không restart/kill server hoặc cài dependency. DB thật không được mở/ghi và bị loại khỏi inventory hash; không khẳng định trạng thái DB do tiến trình khác.

Git chỉ đọc status/diff/check; không stage/commit/push/reset/stash/clean/restore/checkout. Build tạo artifact thông thường trong Frontend/dist. Giữ nguyên working tree và các batch trước. Dừng sau bản sửa đã kiểm chứng, không tiếp tục redesign.
