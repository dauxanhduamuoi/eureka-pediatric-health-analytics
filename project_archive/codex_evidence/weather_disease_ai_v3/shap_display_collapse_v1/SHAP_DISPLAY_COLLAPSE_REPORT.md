# Eureka — Thu gọn phần SHAP trên Parent

Ngày: 25/10/2026. **Kết luận: PASS_WITH_FINDINGS.** Chức năng và kiểm thử đạt; chưa kiểm tra browser thật, và DB có biến động trong khi server riêng vẫn chạy (chi tiết safety bên dưới).

## Trước/sau

Trước: mở chi tiết SHAP là render mọi nhóm UP/DOWN/MIXED.

Sau: Parent mặc định tối đa **3 nhóm mỗi loại**, theo độ lớn đóng góp. Một nút chung **Xem tất cả yếu tố / Thu gọn** chỉ xuất hiện nếu có nhóm bị ẩn. Mở tất cả vẫn giữ toàn bộ dữ liệu, loại nhóm và mũi tên của từng member. Accordion ngoài giữ cách mở/đóng cũ.

Trạng thái xem tất cả reset khi đổi disease hoặc nhận dữ liệu prediction mới; Trước/Tiếp và dự đoán lại đều được kiểm thử. Đóng rồi mở accordion ngoài vẫn giữ trạng thái xem tất cả của cùng kết quả. Cập nhật Medical Knowledge bất đồng bộ không tự thu gọn SHAP.

## Cách chọn nhóm

Helper mới **selectShapDisplayGroups** chỉ xử lý nhóm đã được buildTier1Presentation tạo:

- Chia theo direction hiện có, không tính hoặc đổi UP/DOWN/MIXED.
- Trong từng loại, xếp giảm dần theo **sum(abs(member.shap_value))** trên rawFactors đầy đủ đã có. Không dùng net signed sum.
- Bằng nhau giữ thứ tự nhóm ban đầu bằng tie index ổn định.
- Lấy tối đa 3 khi thu gọn; trả đủ các nhóm theo cùng thứ tự khi mở tất cả. Không mutate/xóa nhóm hoặc factors.
- Response cũ thiếu display_factors vẫn dùng cơ chế MIXED/PARTIAL an toàn đã có. PARTIAL giữ nguyên phần giải thích chưa đầy đủ, không bị gán UP/DOWN. Với legacy, chỉ có thể dùng contributions đã nhận, không giả định đó là toàn bộ model.
- Chỉ Parent áp dụng thu gọn/sắp lại. Clinical/Admin giữ đầy đủ nhóm và thứ tự cũ.

Ba yếu tố dương chính và tóm tắt phía trên không dùng helper chọn nhóm mới, nên không đổi quy tắc ưu tiên positive của phần chính.

## Files đã sửa

1. Frontend/src/app/components/weather-ai/tier1Presentation.ts — thêm helper chọn/sắp xếp riêng cho phần chi tiết; grouping, primary factors và summary không sửa.
2. Frontend/src/app/components/weather-ai/WeatherAIResults.tsx — state xem tất cả, reset theo disease/Tier1, nút chung và aria-expanded/aria-controls.
3. Frontend/src/app/components/weather-ai/WeatherAIResults.test.tsx — 11 cases mới cho số lượng, toggle, ưu tiên/tie, MIXED, legacy, empty, reset và clinical.
4. Frontend/src/app/components/weather-ai/tier1Presentation.test.tsx — thêm regression không đổi primary/summary/Top5/selectors.
5. Frontend/src/app/components/ParentPortal.test.tsx — thêm 2 integration tests cho Trước/Tiếp, dự đoán lại, accordion ngoài và nội dung chính.

ParentPortal.tsx, ParentDiseaseCard.tsx, API types, CSS/font và backend không sửa. Chỉ thêm báo cáo/evidence trong thư mục này, giữ nguyên artifacts/task cũ.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Fixture 5 UP / 4 DOWN / 6 MIXED | **PASS**: mặc định 3/3/3 → mở 5/4/6 → thu 3/3/3 |
| Mỗi loại chỉ có 1, 2 hoặc 3 nhóm | **PASS**, không nút thừa hoặc nhóm giả |
| Ưu tiên sum absolute, cancellation và stable ties | **PASS** |
| MIXED giữ đủ dấu/mũi tên và dữ liệu không mutate | **PASS** |
| Trước/Tiếp, prediction mới cùng disease | **PASS**, quay về thu gọn |
| Legacy thiếu field, empty/unavailable | **PASS**, không khẳng định chiều chưa chứng minh |
| Medical Knowledge / primary / summary | **PASS**, so sánh exact với snapshot trước sửa trên 10 disease |
| Targeted frontend tests | **132 PASS** |
| Toàn bộ frontend | **437 PASS / 19 files** |
| Typecheck | **PASS** |
| Production build | **PASS**, 2313 modules |
| git diff --check | **PASS**, chỉ warnings LF/CRLF sẵn có |
| Browser desktop/mobile thật | **NOT VERIFIED** |

Ví dụ fixture local từ task SHAP trước, không phải prediction ảnh gốc:

| Disease | Tổng nhóm UP/DOWN/MIXED | Mặc định | Khi xem tất cả |
| --- | --- | --- | --- |
| ID6 | 3/5/7 | 3/3/3 | 3/5/7 |
| ID169 | 1/6/9 | 1/3/3 | 1/6/9 |

Nút dùng button HTML gốc, type=button, focus indicator, aria-expanded và aria-controls. Tests kiểm tra focus, tabIndex và click detail=0 tương ứng activation không dùng chuột. **Không coi đó là đã kiểm tra phím Enter/Space trên trình duyệt thật.** Không sửa breakpoint, container, font hoặc grid responsive; visual thực tế vẫn NOT VERIFIED.

Lệnh đã chạy trong Frontend:

~~~powershell
npm.cmd test -- src/app/components/weather-ai/WeatherAIResults.test.tsx src/app/components/weather-ai/tier1Presentation.test.tsx src/app/components/ParentPortal.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
~~~

Tại repo root: git diff --check. Không chạy lại inference/training/backend tests vì task chỉ sửa lựa chọn hiển thị frontend.

## Medical Knowledge và dữ liệu chính

Snapshot trước/sau xác nhận **toàn bộ presentation gốc** (grouping/rawFactors/directions/summary/primary factors) của 10 disease giống hệt; chỉ danh sách render rút gọn thay đổi. Cả **44 selectors** khớp trước sửa. Top5 positive/negative và display_factors API không mutate.

Không sửa publishedMedicalKnowledge.ts, selector/mapping/query/worker hoặc nội dung y khoa/guidance. Phần Medical Knowledge trong file Results dùng chung cũng không sửa. State xem tất cả không ảnh hưởng tới request hoặc nguồn dữ liệu.

## Safety closure

Snapshot 499 protected files trước/sau chỉ có đúng 5 frontend source/test files nêu trên thay đổi. Backend Python, model/manifest/feature schema/221 models/45 features/H14/runtime/ranking/W01-W02, training data, Excel, .env và font/styles không đổi. Không sửa Graduation; không migration/retrain/import. HEAD và staged diff giữ nguyên; không stage/commit/push hoặc dùng Git reset/stash/clean/restore/checkout. Không start/stop/restart backend, không gọi external network hoặc API Eureka thật từ task.

**FINDING — không thể tuyên bố DB thật giữ nguyên trong toàn bộ task:**

- Hash toàn file DB trước/sau khác nhau. Snapshot thay đổi ở auto_medical_knowledge_topic_states, parent_disease_visibility_settings và parent_disease_visibility_audits.
- Các kết nối DB của task là mode=ro + query_only, total_changes=0. Không chạy backend/lifespan. Tests Parent/visibility/MK dùng mocks; API client trong tests không gọi server thật.
- Có process uvicorn --reload riêng đang chạy (PID 14852, child 44180 lúc kiểm tra). Không đủ bằng chứng quy nguồn ghi DB cho tác nhân cụ thể; không tự dừng server hoặc hoàn tác các thay đổi đó.
- Code/chính sách visibility không đổi do task, nhưng trạng thái DB live đã biến động. Không dùng kết quả unit test để khẳng định ngược lại.

Evidence: baseline.json, presentation_before.json, display_evidence.json, safety_closure.json. Báo cáo và evidence chỉ nằm trong shap_display_collapse_v1.

**Đã hoàn tất đúng phạm vi. DỪNG, không redesign hoặc mở thêm task.**
