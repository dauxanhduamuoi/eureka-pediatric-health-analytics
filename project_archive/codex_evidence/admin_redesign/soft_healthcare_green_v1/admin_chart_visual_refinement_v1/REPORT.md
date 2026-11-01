# Admin Chart Visual Quality & Color Consistency

Kết luận: **PASS_WITH_FINDINGS**. Đã audit 17 chart Recharts trong 8 section, chỉnh các vấn đề có bằng chứng ở biểu đồ ưu tiên và kiểm thử đạt. **BROWSER NOT VERIFIED**: chưa xác minh hình ảnh, crop/overflow hoặc tooltip placement thực tế tại 1440/1280/768/390px.

## Kiểm kê và phạm vi

[AUDIT.md](AUDIT.md) ghi từng biểu đồ, trang/component, nguồn dữ liệu, loại, màu, legend/tooltip/trục, responsive và phân loại **KEEP / REFINE / FINDING** sau khi đọc source 17 section.

17 chart instances gồm Dashboard 4, Mùa 3, Độ tuổi 1, Theo tháng 3, Giới tính 2, Xu hướng 2, Khu vực 1, Dự báo 1. Những section khác không có chart Recharts trực tiếp; SHAP của AI thời tiết là presentation được bảo vệ, không sửa. Không dùng dữ liệu giả cho giao diện thật.

Giữ nguyên các chart đơn chuỗi Dashboard theo kỳ, tổng năm, phân bố khô/mưa, lịch sử mùa theo năm, so sánh tháng, donut giới tính, tương tác chart Xu hướng và chart Dự báo. Lý do: vai trò màu đã rõ hoặc có nghiệp vụ/trạng thái riêng; không tự thay loại chart hoặc mở refactor ngoài các ưu tiên.

Các FINDING của AdvancedAnalytics được ghi nhận: palette index ở một số view, quy ước màu giới tính chưa đồng nhất giữa các view, nhóm bệnh thiếu ID dùng chung và interaction highlight/hover riêng. Không thay hệ thống chọn nhóm/highlight hoặc chart thống kê của các trang này trong task tinh chỉnh nhỏ.

## Các chỉnh sửa

### Mùa — 5 đường xu hướng

Trước: các màu đầu gần nhau, màu theo index render; đường 2px không có dot, legend dùng max-height 128px nên tên song ngữ có thể buộc cuộn.

Sau: dùng palette phân loại riêng và 5 kiểu nét phân biệt; line 2,5px, điểm quan sát nhỏ 2px/active 4px, vẫn `linear` và `connectNulls=false`. Điểm rời vẫn hiển thị được khi xung quanh là tháng thiếu.

Legend biểu diễn đúng màu/kiểu nét của từng series, wrap tự nhiên, giữ tên song ngữ; bỏ giới hạn cuộn 128px **chỉ ở legend 5 đường**, không áp toàn bộ hệ thống legend. Tooltip dùng cùng mẫu nét và tên đầy đủ, số ca cùng dữ liệu gốc; chữ dùng neutral ink thay vì lấy các màu mark sáng để viết chữ nhỏ. Khoảng trống vẫn là null từ `seasonalChartRows` hiện có; 0 hợp lệ vẫn là 0.

### Độ tuổi — Top nhóm bệnh

Trước: mỗi bar khác màu dù đều là số ca; tooltip/axis dùng label rút gọn nên chưa bảo đảm tên đầy đủ.

Sau: tất cả bar dùng màu chủ đạo hiện có **#16a34a**, còn nguyên tên/thứ hạng/LabelList. Trục lấy raw `disease_group`, hiển thị qua DiseaseAxisTick có wrapping/title/aria-label; tooltip giữ tên Việt/Anh đầy đủ, có word-wrap và giới hạn chiều ngang theo chart. Grid chỉ giữ đường hướng dẫn giá trị để bớt nhiễu. Không đổi giới hạn tối đa 10 bar, Top K API, filter, số ca hoặc bảng dữ liệu.

### Dashboard — Top nhóm và stacked theo kỳ

Trước: donut swatch/segment dùng index thứ hạng, bars dùng màu primary riêng; thứ tự dữ liệu có thể làm một tên nhóm nhận màu khác.

Sau: một map màu theo raw key từ `topGroups` được dùng chung cho donut, swatch, bar track, dấu màu tooltip và stacked theo kỳ trong details. Toggle và `useState` hiện có giữ nguyên; không phát sinh request hoặc tính lại tỷ trọng chỉ vì đổi view. Donut vẫn gọn, không thêm label vào từng phân khúc. Danh sách giữ tên/số ca/tỷ trọng và tooltip đầy đủ để không chỉ dựa vào màu.

### Khu vực — ổn định theo mã tỉnh

Audit thấy hash màu có cộng thêm index thứ hạng dù đã có province code. Chỉ bỏ index khỏi hash khi có code; cùng tỉnh giữ màu khi API reorder. Fallback khi không có code vẫn giữ hành vi cũ. Không sửa API, tổng ca, thứ tự, ranking, phạm vi địa lý hoặc dữ liệu bảng.

## Palette và quy tắc

Tham khảo [Carbon categorical/alert palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes): palette phân loại dành cho nhóm rời rạc, tách khỏi màu trạng thái. Dùng sequence light categorical 14 màu của Carbon cho các chart REFINE; các màu đầu purple/cyan/teal/magenta/red giúp phân biệt 5 đường hơn chuỗi xanh gần nhau trước đó.

Theo [Datawrapper về cách dùng màu](https://www.datawrapper.de/blog/colors) và [giảm màu không cần thiết](https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations), bar đã có vị trí/tên để phân biệt có thể dùng cùng màu; thêm nét/ký hiệu khi màu chưa đủ. Áp dụng ở Age và Seasonal, không gộp nhóm hoặc đổi loại chart theo các ví dụ thiết kế.

Không đổi `ADMIN_CHART_COLORS` legacy hoặc `ADMIN_CHART.primary`: các chart KEEP/risk không bị đổi ngầm. Màu incomplete year **#f59e0b**, cảnh báo dữ liệu thiếu, lỗi/thành công, Forecast risk và dấu SHAP giữ nguyên. `palette_contrast.json` lưu phép tính contrast của mark trên nền trắng; đây không phải chứng nhận accessibility hoặc mô phỏng thị giác màu.

`categoryStyles(keys)` tạo map từ danh sách raw keys đã sort trên một bản sao. Series vẫn render theo thứ tự cũ; đảo thứ tự cùng tập nhóm không đổi màu hoặc kiểu nét. **Giới hạn:** API hiện không có ID bệnh chuẩn dùng chung; tên bị đổi hoặc tập nhóm thay đổi có thể làm mapping thay đổi. Không tuyên bố đây là registry màu toàn cục giữa mọi trang/tập dữ liệu. Sau 14 category, palette lặp; không tạo 236 màu riêng. Riêng mã tỉnh có định danh nên màu không phụ thuộc thứ hạng.

## File thay đổi

Sửa tám file hiện có:

1. `Frontend/src/app/components/admin/chartPalette.ts` — thêm categorical palette/map và tooltip wrap style; giữ legacy palette.
2. `Frontend/src/app/components/admin/SeasonalCharts.tsx` — đường/nét/dot, tooltip và legend.
3. `Frontend/src/app/components/admin/DiseaseChartLegend.tsx` — variant line sample, giữ default legend.
4. `Frontend/src/app/components/admin/DashboardTopGroupsChart.tsx` — identity màu thống nhất các view.
5. `Frontend/src/app/components/DashboardOverview.tsx` — cung cấp map dùng chung cho Top/stacked, không sửa data derivation.
6. `Frontend/src/app/components/AgeAnalysis.tsx` — một màu, tên đầy đủ và tooltip/grid.
7. `Frontend/src/app/components/AreaInsights.tsx` — màu mã tỉnh không cộng index.
8. `Frontend/src/app/components/admin/content.css` — CSS scope riêng cho legend/tooltip được tinh chỉnh.

Thêm `Frontend/src/app/components/admin/ChartVisuals.test.tsx` — kiểm tra composition/style identity/data bằng fixture cô lập. Không thêm thư viện hoặc dependency. Diff của riêng task ở [scoped.diff](scoped.diff).

## Kiểm chứng dữ liệu và tests

**30 targeted tests PASS** trong 5 files, gồm 5 test mới và các regression hiện có:

| Kiểm chứng | Evidence |
| --- | --- |
| 5 series: thứ tự, dữ liệu không mutate, 0 thật, tháng thiếu null; màu/nét series khớp legend/tooltip | `ChartVisuals.test.tsx` |
| Màu category ổn định khi đảo thứ tự; 5 màu và 5 kiểu nét khác nhau | cùng file |
| Dashboard donut/bar: cùng values/share, màu theo key, width tỷ trọng giữ nguyên | cùng file + `DashboardOverview.test.tsx` |
| Top K, toggle không gọi API thừa, giữ trạng thái view; zero/missing/empty | `DashboardOverview.test.tsx` |
| Tổng kỳ theo thứ tự thời gian; năm đủ/thiếu, tooltip coverage, màu amber | `DashboardOverview.test.tsx` |
| Age API payload, ranking/số ca và tooltip tên đầy đủ; cùng một màu | `ChartVisuals.test.tsx` + `AdminPages.regression.test.tsx` |
| Tỉnh có code giữ màu sau refresh với thứ tự API đảo, số ca không đổi | `ChartVisuals.test.tsx` |
| Mùa: dữ liệu/năm/season/filter, warnings và null/zero | `AdminContent.regression.test.tsx`, `seasonalPresentation.test.tsx` |

Ví dụ fixture kiểm chứng: Dashboard số ca **30/10/0**, tỷ trọng **75/25/0%**; tổng năm **120/10** với năm thứ hai **1/12 tháng**; Age **12/3**. Seasonal quan sát T1 giữ `[0,3,6,9,12]`, T2 không có bản ghi thành null như trước; source T2 không bị mutate. Khu vực `[12,3]` khi API đảo vẫn `[3,12]` theo thứ tự API mới, giữ mã tỉnh/màu tương ứng — không tự sort dữ liệu.

Lệnh: `npm.cmd test -- src/app/components/admin/ChartVisuals.test.tsx src/app/components/DashboardOverview.test.tsx src/app/components/admin/seasonalPresentation.test.tsx src/app/components/admin/AdminContent.regression.test.tsx src/app/components/admin/AdminPages.regression.test.tsx --maxWorkers=1`.

| Check cuối | Kết quả |
| --- | --- |
| Targeted frontend | **30/30 PASS**, 5 files |
| Typecheck | **PASS** |
| Production build | **PASS** |
| `git diff --check` + whitespace file mới | **PASS** |
| Browser/screenshot desktop/mobile | **NOT VERIFIED** |

Typecheck ban đầu phát hiện fixture Age mới thiếu metadata `period/min_month_age/max_month_age`; đã bổ sung đúng type, không dùng `any` hoặc sửa API contract. Không chạy backend/model tests vì không sửa logic backend/model.

## Responsive và giới hạn

Giữ ResponsiveContainer, loại biểu đồ và chiều cao chart đang dùng; không cố định chiều rộng viewport. Legend 5 đường auto-fit/wrap; tooltip giới hạn chiều ngang và ngắt tên dài; map/count/title cung cấp tín hiệu ngoài màu. Không thêm animation; tiếp tục dùng preference/reduced-motion hiện có.

Browser/native host trả unavailable. **Chưa xác minh** hình ảnh thật tại 1440/1280/768/390px, label/legend overlap, vị trí tooltip hoặc contrast dark/colour-vision simulation. Unit tests chỉ chứng minh composition/props/data và hành vi, không chứng minh UI không vỡ. Palette mới lấy từ light categorical cho giao diện sáng; không tuyên bố đạt mọi theme/thị giác màu.

## Safety closure

- Baseline **501 file** được đối chiếu: chỉ tám file thuộc task đổi hash; một test mới được thêm. Mọi source/asset baseline ngoài phạm vi giữ nguyên.
- Backend, DB thật, API client/contracts, Parent, Forecast AI, Weather AI, SHAP, Medical Knowledge, Login slideshow, User permissions, font assets, `.env`, Graduation và model không sửa.
- Hai DB file giữ nguyên hash; không mở DB qua SQL, ghi DB, migration, retrain, import hoặc restart backend. Fixtures/mock chỉ chạy trong tests.
- Không thay tổng ca, ranking, Top K, numerator/denominator, thứ tự thời gian, filter hay aggregation; chỉ presentation metadata màu/nhãn/nét. Cảnh báo năm thiếu không bị bỏ hoặc đổi màu.
- HEAD và Git index giữ nguyên SHA256; staged diff rỗng. Không stage/commit/push/reset/stash/clean/restore/checkout, giữ các sửa có trước.
- Chỉ truy cập tài liệu thiết kế công khai Carbon/Datawrapper; không gửi dữ liệu project, bệnh nhân hoặc credentials ra ngoài.

Kết luận **PASS_WITH_FINDINGS**: code và kiểm thử trong phạm vi hoàn tất, còn giới hạn browser/identity và các finding ngoài ưu tiên được ghi rõ. Dừng tại đây.
