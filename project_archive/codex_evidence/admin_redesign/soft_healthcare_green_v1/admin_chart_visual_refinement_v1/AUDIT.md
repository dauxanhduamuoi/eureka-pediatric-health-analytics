# Kiểm kê trước sửa — Admin/Staff charts

Source: 17 section trong `AppPages.tsx`; 17 chart instances Recharts trong 8 section. Các chart dùng ResponsiveContainer; font Nunito và grid/tooltip đã có adapter Admin. Không gọi API hoặc DB thật để audit.

| Section / biểu đồ | Loại và nguồn | Màu / legend / tooltip / responsive hiện có | Phân loại |
| --- | --- | --- | --- |
| Dashboard — tổng theo kỳ | Line; getMonthlyStatistics(predict_current) | Một màu chủ đạo; trục thời gian, tooltip số ca; width 100%, height 280 | KEEP: một đại lượng, giữ thời gian/sums |
| Dashboard — Top nhóm | Donut + HTML horizontal bars; getTopDiseaseGroups | Palette theo index rank; list song ngữ và tỷ trọng; tooltip custom; container query hai vùng | REFINE: màu đổi khi rank đổi, các màu đầu gần nhau; đồng bộ key màu và tooltip |
| Dashboard — tổng năm | Bar; getCasesByYear | Xanh năm đủ, amber năm thiếu; tooltip coverage, danh sách tháng thiếu; 280px | KEEP: trạng thái nghiệp vụ phải giữ |
| Dashboard — Top theo kỳ (details) | Stacked bar; monthly + Top hiện có | Index màu, bilingual legend, tooltip default; height 280 | REFINE cùng map màu của Top, chỉ presentation |
| Mùa — 5 nhóm xu hướng | Line; monthly statistics, năm chọn | Palette index, line 2px/dot false; legend song ngữ max-height 128px; formatter tooltip; 280px | REFINE ưu tiên: phân biệt màu/nét, điểm quan sát rời, tên dài, tooltip/legend |
| Mùa — phân bố khô/mưa | Grouped horizontal bar; monthly aggregates hiện có | Amber khô/blue mưa có legend/tooltip; axis song ngữ; height theo rows | KEEP: hai chuỗi có ý nghĩa cố định |
| Mùa — lịch sử theo năm | Grouped bar; comparativeData hiện có | Palette legacy theo year, legend, tooltip; height 260 | KEEP: nhóm năm nhỏ, không thay công thức/tổ hợp thiếu; đã có note dữ liệu thiếu |
| Độ tuổi — Top bệnh | Horizontal bar; getDiseaseByAgeRange | Mỗi bar một màu index nhưng chỉ một đại lượng số ca; LabelList; axis tên Việt, tooltip chưa chắc có tên song ngữ đầy đủ; height 360 | REFINE ưu tiên: một màu chủ đạo, tooltip từ raw disease_group |
| Theo tháng — Top bệnh | Horizontal bar; getTopDiseaseGroupsByMonth | Palette legacy theo index, label hai dòng, tooltip số ca; height theo rows | FINDING: màu trang trí/rank-based tương tự nhưng ngoài ba chart ưu tiên; không mở rộng đợt sửa |
| Theo tháng — tỷ lệ | Donut; getDiseasePercentageByMonth | Palette index, list tên/tỷ lệ riêng, tooltip phần trăm API; 260px | FINDING: raw disease_group không có ID; không chuẩn hóa palette toàn bộ analytics trong task nhỏ này |
| Theo tháng — so sánh | Grouped bar; getMonthlyComparison | Previous grey/current primary, legend, tooltip; 270px | KEEP: hai chuỗi có ý nghĩa rõ |
| Giới tính — tổng ca | Bar; getCasesByGender | Palette theo row index; card legend; 270px | FINDING: quy ước màu khác donut giới tính, cần thống nhất quy ước riêng nếu đổi |
| Giới tính — nhóm bệnh | Donut; getDiseaseByGender | Nam blue/Nữ red/other grey cố định; card tỷ lệ, tooltip; 250px | KEEP: không tự đổi quy ước hiện có |
| Xu hướng — theo kỳ | Multi-line; getDiseaseTrend từng nhóm | Palette theo thứ tự chọn; highlight/dim, custom hover tooltip và dots; 320px | FINDING: có index color nhưng interaction riêng; không refactor hệ thống highlight/tooltip trong task ưu tiên mùa |
| Xu hướng — cùng tháng qua năm | Stacked bar; getYearOverYear | Cùng trendSeries, legend/tooltip; 320px | KEEP trong phạm vi: đồng bộ với chart xu hướng hiện hành |
| Khu vực — tổng ca | Horizontal bar; getAreaCaseSummary | Hash province code cộng rank index; LabelList/tooltip; height theo nhóm, scroll khi nhiều | REFINE nhỏ: bỏ index khỏi hash khi có code, giữ màu tỉnh khi reorder; không đổi thống kê |
| Dự báo — previous/predicted | Grouped horizontal bar; forecast group summary/results | Previous và risk fill/stroke riêng, legend risk, tooltip; height theo rows | KEEP: semantic risk + guardrail Forecast AI |

Các section còn lại: Nhập dữ liệu, AI thời tiết, Nhóm bệnh Parent, Medical Knowledge, Báo cáo, Phân quyền, Thông báo, Cài đặt, Tài khoản không thêm chart Recharts trực tiếp. AI thời tiết có presentation SHAP trong module dùng chung: **KEEP / protected**, không thay màu dấu hay dữ liệu. Báo cáo/export không phải chart UI cần redesign.

## Quyết định trước triển khai

- Giữ palette legacy và ADMIN_CHART.primary để tránh đổi ngầm những chart KEEP hoặc màu trạng thái.
- Thêm palette categorical riêng dựa trên Carbon cho các chart REFINE; map theo raw key, không theo thứ tự render. API bệnh hiện chỉ có tên/raw group, không có ID catalog ổn định dùng chung. Map sẽ ổn định khi reorder cùng tập nhóm; không hứa định danh toàn cục khi tên/tập nhóm thay đổi. Dashboard dùng chung một map cho donut/bars/stacked.
- Mùa có thêm kiểu nét tương ứng trong legend/tooltip để không dựa duy nhất vào màu. Không sửa transform khoảng trống null/zero.
- Độ tuổi dùng màu primary đồng nhất; giữ slice/ranking/count/filter, sửa tooltip tên đầy đủ. Tỉnh có code thì chỉ dùng code cho màu.
- Không sửa các FINDING bằng refactor toàn bộ AdvancedAnalytics, không đổi loại biểu đồ, không gộp nhóm hoặc giảm Top K.

Tham khảo trực tiếp [Carbon categorical/alert palettes](https://www.carbondesignsystem.com/building-blocks/data-visualization/color-palettes), [Datawrapper về tính nhất quán màu](https://www.datawrapper.de/blog/colors) và [bớt màu khi vị trí đã phân biệt dữ liệu, thêm nét/ký hiệu](https://www.datawrapper.de/blog/10-ways-to-use-fewer-colors-in-your-data-visualizations). Áp dụng trong giới hạn dữ liệu hiện có; không tự đổi aggregations theo gợi ý thiết kế.

Đã lưu baseline 501 file và source đang có trước sửa; giữ nguyên working tree cũ.
