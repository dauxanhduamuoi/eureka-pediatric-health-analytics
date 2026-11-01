# Eureka — Area Insights Layout & Readability V2

**PASS_WITH_FINDINGS.** Đã sửa cấu trúc bố cục và typography của Khu vực. Regression tổng hợp **73/73 PASS**, typecheck/build/diff-check PASS. **BROWSER NOT VERIFIED**: chưa nghiệm thu chiều rộng/pixel ở desktop/mobile.

## Nguyên nhân và baseline

Baseline lấy từ working tree thực tế trước sửa, không dùng Git HEAD: `baseline.json` có 626 file; `source_before/` giữ bốn file thuộc task; `git-status-before.txt` lưu trạng thái ban đầu.

Source xác nhận `AreaDetails` nằm trong `.area-results`, là cột phải của `.area-workspace-grid`. Vì bảng và khuyến nghị kéo dài cột phải, cột trái chỉ có bộ lọc bị bỏ trống ở phần dưới. Đây là lỗi composition/presentation; không có bằng chứng cần sửa API hay dữ liệu.

Audit trước code đã đọc AreaInsights, AreaFilterPanel, AreaResults, toàn bộ CSS module và tests trực tiếp/ChartVisuals. Tại container >=900px, grid dùng `minmax(230px,.55fr) minmax(0,1.45fr)`; danh sách tỉnh có scroll max-height 340px; chart cao max(360, số hàng × 54). Phân trang do AreaInsights sở hữu, độc lập hai bảng, có 5/10/20/50 dòng.

Baseline **19 tests PASS**. Diagnostic `baseline-layout-diagnostic.log` tái hiện: cả `.area-workspace-grid` và `.area-results` đều chứa `.area-detail-workspace`. Diagnostic này kiểm tra DOM, không phải ảnh browser.

## Before / after

Trước:

```text
AreaInsights
  Header / actions / error / message
  area-workspace-grid [hai cột]
    AreaFilterPanel
    area-results
      Scope / AreaSummary / AreaDistribution
      AreaDetails
        Nhóm bệnh / Nguy cơ + pagination
        Khuyến nghị
```

Sau:

```text
AreaInsights
  Header / actions / error / message
  area-workspace-grid [chỉ workspace phía trên]
    AreaFilterPanel
    area-results
      Scope / AreaSummary / AreaDistribution
  AreaDetails [cùng parent với grid, width 100%]
    Nhóm bệnh / Nguy cơ + pagination
    Khuyến nghị
```

Bảng không còn là descendant của grid hoặc cột phải. Test kiểm tra cùng parent và nằm ngay sau grid; giữ cấu trúc đó khi chuyển bảng hoặc đổi tỉnh. Đây là kiểm chứng cấu trúc full-width; không khẳng định kết quả pixel khi chưa xem browser.

Không thêm component hay wrapper mới, không đổi tên file hoặc viết lại controller. Giữ trạng thái chọn tab, view chart/ranking và cơ chế pagination. `aria-busy` được truyền sang vùng chi tiết sau khi di chuyển.

## CSS và khả năng đọc

- Giữ tỷ lệ/breakpoint grid phía trên và chiều cao chart, không bỏ hàng hoặc giảm diện tích plot.
- Vùng chi tiết width 100%, min-width 0; bảng width 100%, cuộn ngang trong vùng bảng focusable. Risk table vẫn có min-width 440px để không ép cột.
- Danh sách tỉnh cuộn riêng tối đa **300px**, không thêm sticky hoặc scroll cho toàn bộ filter. Province checkbox đã chọn có nền mint và vạch accent, giữ native checked/focus.
- Bảng từ 13 lên **14px**, header 13px/màu ink; padding hàng từ 14px dọc xuống 12px. Số căn phải, tabular và weight 500; header cột số cũng căn phải.
- Nhãn/caption/tổng quan quan trọng dùng 13px và ink; metadata tỉnh 12px. Giữ Nunito và các token/theme hiện có, palette tỉnh và badge nguy cơ.
- Tên nhóm bệnh giữ nguyên toàn bộ chuỗi Việt/Anh và wrap tự nhiên; không cắt/viết lại nhãn hoặc thêm lookup/API.
- Khuyến nghị nằm dưới bảng ở chiều rộng trang; dòng văn bản giới hạn 100ch để dễ đọc, không giới hạn chiều cao hoặc cắt nội dung.
- Formatter trình bày trả `—` khi thiếu/không hữu hạn; số 0 thật giữ 0. Bỏ coercion `Number(value)` tại Summary để null không bị hiển thị như 0. Không đổi aggregation/fallback trong controller.
- Thêm caption semantic cho hai bảng; giữ th/td, row/column scope, label/select, accessible pagination, focus và keyboard semantics hiện có.

Tất cả CSS vẫn có scope `.area-insights-workspace`; không sửa shared CSS hoặc AdminLayout. Mobile giữ cơ chế một cột, padding 14px và scroll bảng hiện có.

## File sửa

1. `Frontend/src/app/components/AreaInsights.tsx` — chuyển AreaDetails ra ngoài grid; truyền busy.
2. `Frontend/src/app/components/areas/AreaResults.tsx` — missing-value formatter, busy và table captions.
3. `Frontend/src/app/components/areas/AreaInsights.css` — width, scroll tỉnh, selected state và typography scoped.
4. `Frontend/src/app/components/AreaInsights.test.tsx` — thêm regression hierarchy, missing/zero, bảng song ngữ và chuyển filter.

Không thêm file ứng dụng hoặc sửa AreaFilterPanel. Report/script/log nằm trong thư mục evidence này; build tạo artifact thông thường trong Frontend/dist.

## Bảo toàn logic và dữ liệu

`verify-scope.cjs` đối chiếu AST/hash với source_before:

- Toàn bộ controller trước JSX của AreaInsights không đổi: API/request payload, cache, region lookup, selected provinces, totals, aggregation, risk classification, recommendations, effects và sync role gate.
- Các helper ngoài component không đổi, bao gồm PageSizeSelect, PaginationControls, Empty và công thức màu tỉnh.
- AreaDistribution và AreaAxisTick không đổi theo AST: data/height, palette, tooltip, đơn vị, thứ tự và view switch giữ nguyên.
- Props lọc, summary, distribution và details khớp baseline; chỉ thêm busy cho details. Recommendation rendering giữ nguyên.
- Top 12 khi không chọn tỉnh giữ nguyên; baseline hiển thị toàn bộ tập tỉnh chọn khi có lựa chọn cũng được giữ, không tự áp giới hạn mới.
- Hai bảng vẫn dùng page/page-size/cache hiện có. Chuyển trang không gọi lại API; đổi page-size vẫn refetch theo baseline, không tự thay chính sách đó.
- Các assertion test gốc được giữ nguyên; không nới timeout hoặc bỏ assertion.

## Kiểm thử

| Lượt | Kết quả | Evidence |
|---|---|---|
| Baseline Area + Chart | 19 PASS | `baseline-tests.log` |
| Diagnostic trước sửa | Tái hiện cấu trúc lồng sai | `baseline-layout-diagnostic.log` |
| Sau sửa composition | 20 PASS | `area-regression.log` |
| Regression tổng hợp | **73/73 PASS / 6 files** | `final-regression.log` |
| Area sau sửa kiểu test | 18/18 PASS | `area-tests-after-typing-fix.log` |
| Typecheck | PASS, exit 0 | `typecheck.log` |
| Production build | PASS, exit 0 | `build.log` |
| git diff --check | PASS, exit 0 | `diff-check.log` |
| AST / scope / protected hash / whitespace | PASS | `scope-and-contract-check.json`, `verification.log` |

Regression gồm AreaInsights, ChartVisuals, AdminPageTitles, App.navigation, navigation và useAdminSectionNavigation. Bao phủ filter miền/tỉnh, search, chọn/bỏ chọn/xóa bộ lọc, màu/order/Top 12/totals/địa chỉ không xác định, chart/ranking, hai bảng/paging, page-size, loading/error/empty/retry, cached state và sync gate bằng mock.

Test mới xác nhận hai bảng/khuyến nghị ngoài grid, giữ view khi đổi tỉnh, các lựa chọn 5/10/20/50, nhãn song ngữ đầy đủ, missing khác zero ở cả hai bảng và Summary, badge/period/recommendation nguyên gốc. Không dùng unit tests để tuyên bố UI đẹp hoặc responsive đã đạt.

Typecheck ban đầu phát hiện hai query trong test mới trả `Element` thay vì `HTMLElement` mà matcher yêu cầu. Đã bổ sung generic đúng kiểu, giữ nguyên assertion; chạy lại typecheck và riêng suite Area. Log ban đầu ở `typecheck-initial-test-typing.log`. Source ứng dụng không đổi sau lượt regression/build thành công nên không lặp lại toàn bộ regression hoặc build. Không có timeout; không chạy full frontend/backend/model suite.

## Browser và finding còn lại

**BROWSER NOT VERIFIED** tại 1440 / 1280 / 768 / 390px. CUA inventory trả apps=[]/browsers=[], native pipe unavailable và browser access host unavailable; lưu trong `browser-verification.json`. Không có screenshot hoặc E2E thực tế.

Đã xác minh bằng DOM rằng bảng dùng parent toàn chiều rộng; chưa đo bounding box desktop hoặc nghiệm thu pixel. Cần xem bằng browser với fixture/mock để kiểm tra: bảng span đúng chiều rộng, không tràn trang, tên dài không chồng, vùng cuộn tỉnh, chart/ranking, keyboard và các theme. Chưa xác nhận contrast/font/render thực tế trên laptop. Không dùng tài khoản hoặc đồng bộ dữ liệu thật để thực hiện checklist này.

## Hash và safety closure

- Inventory **626 file**, bốn file được phép sửa, **622 protected files không đổi**. Backup khớp hash baseline; có hash cuối của bốn file chỉnh sửa.
- Không có file source mới, khác biệt protected ngoài dự kiến, whitespace lỗi hoặc selector CSS ngoài scope. `.git/index` không đổi.
- Không sửa backend/API/cache, DB, model/retrain, Parent, các trang khác, Sidebar/Topbar, global theme, `.env`, bản thực tập hoặc Graduation.
- Không mở/ghi DB thật, migration, import/sync thật, startup/lifespan hoặc gọi backend thật. Tất cả API trong test là mock và fixture tổng hợp; sync control chỉ được bấm trong mock, không có thao tác dữ liệu thật.
- Không restart/kill server, network ngoài hoặc thêm dependency. DB thật bị loại khỏi hash inventory; không khẳng định trạng thái DB do tiến trình khác.
- Git chỉ đọc status/diff/check; không stage/commit/push/reset/stash/clean/restore/checkout. Các batch trước được bảo toàn.

**Dừng sau Area Insights V2.** Không tiếp tục redesign, dọn CSS hoặc sửa nghiệp vụ ngoài phạm vi.
