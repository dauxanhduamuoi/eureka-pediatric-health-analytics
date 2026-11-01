# Eureka — SHAP explanation correctness fix

Ngày: 25/10/2026. **Kết luận: PASS_WITH_FINDINGS.** Bản sửa đã hoàn tất trong phạm vi thống nhất; các kiểm tra logic/model/API/frontend đều PASS. Giới hạn còn lại: chưa xác minh trình duyệt thật và prediction trong ảnh gốc; hash DB có thay đổi giữa hai phiên làm việc, nhưng không thay đổi trong từng cửa sổ thực hiện được kiểm tra. Không có thao tác ghi DB thật từ task.

## 1. Nguyên nhân và cách sửa

Backend vốn tính đủ 45 contributions rồi chỉ gửi 5 dương + 5 âm. Frontend nhóm dữ liệu đã cắt, nên có thể mất phía đối nghịch và khẳng định sai UP/DOWN cho cả concept. Summary backend chỉ nhìn labels dương, trong khi phần mở rộng nhận cả hai phía; câu chữ còn khẳng định tăng/giảm thứ hạng và gọi aggregate ngày D là số đo “hiện tại”.

Bản sửa giữ nguyên mô hình, raw SHAP, điểm và ranking. Bổ sung **display_factors** để mang toàn bộ contributions đáng kể từ chính lần SHAP hiện có; không gọi model hoặc SHAP lần thứ hai. Positive/negative lists cũ không thay đổi.

Phạm vi mới chốt **ưu tiên đóng góp dương trong phần chính**. Vì vậy không áp dụng đề xuất Top 3 absolute SHAP hai chiều trong báo cáo audit cũ. Phần chính nêu member dương cụ thể; phần mở rộng nêu chiều đầy đủ của cả nhóm. Hai phần có mục đích khác nhau nhưng không còn khẳng định mâu thuẫn về cùng một concept.

## 2. Kiến trúc trước/sau

| Module | Trước | Sau |
| --- | --- | --- |
| Runtime/model | 221 scores, 45 raw SHAP cho mỗi disease được chọn | Giữ nguyên source, model, feature order, raw margin/additivity và sigmoid |
| Backend explanation | Top 5 mỗi dấu, summary theo nhãn nhóm chung | Giữ nguyên Top 5; thêm full significant display factors; compatibility summary nói contributions dương vào điểm AI |
| API schema/type | Chỉ có positive/negative lists | Optional display_factors, tối đa 45, dùng cùng Factor schema |
| Presentation helper | Group từ Top 5; thứ tự dương trước âm | Group từ full field; phân biệt response cũ thiếu coverage; cùng helper chọn member dương và tạo summary |
| Parent card | Summary backend độc lập với nhóm frontend | Summary và tối đa 3 yếu tố chính lấy chung presentation model |
| Expanded SHAP | Có thể UP/DOWN do thiếu member | UP/DOWN/MIXED từ toàn bộ contributions; legacy một dấu là PARTIAL |
| Medical Knowledge | Đọc Top 5 positive_factors | Không thay đổi bất kỳ logic, mapping, selector, query, queue, worker hay nội dung nào |

Không tạo pipeline SHAP thứ hai, không thêm framework hoặc logic bệnh cụ thể. Không hard-code ID6/169 trong production code.

## 3. SHAP vẫn đủ 45 features

PASS với fixture audit 168 giờ hợp lệ, tuổi 1–5, Nam, ngày D=2026-08-07:

- Feature order và encoded vector khớp tuyệt đối fixture trước sửa.
- Với 10 disease mẫu, đủ 45 raw contributions mỗi disease và từng giá trị khớp chính xác trước sửa.
- Base value giữ nguyên; base + sum(45 SHAP) khớp raw margin trong ngưỡng 1e−6; max error trong mẫu khoảng 4.44e−15.
- Sigmoid raw margin khớp ranking_score trong ngưỡng 1e−12.
- Tests hiện có còn so sánh cả 221 scores/order với standalone locked boosters trên TRAIN context.
- Registry xác minh checksum/count 221 models, 45 features; H14, manifest, training data và runtime source không đổi.
- display_factors chỉ lấy các contributions có |SHAP| > 1e−12, theo thứ tự feature khóa. Zero/near-zero không bị diễn giải thành tác động.
- SHAP không hữu hạn được từ chối tại lớp explanation; runtime giữ ranking và trả Tier1 unavailable, không dùng dữ liệu giả.

Đây là fixture thay thế, **không phải tái lập prediction của ảnh cũ**.

## 4. ID6 trước/sau

| Nội dung | Trước sửa | Sau sửa |
| --- | --- | --- |
| Số đóng góp tính | 45 | 45, raw values không đổi |
| Nonzero đáng kể | 40 | 40 |
| Dữ liệu giải thích | 5 dương + 5 âm | Vẫn 5+5 cho legacy/MK; thêm 40 display factors |
| Nhóm chi tiết từ fixture | 8 nhóm từ danh sách cắt | 15 nhóm từ đầy đủ contributions đáng kể |
| Gió 7D | UP, do member âm bị cắt | MIXED |
| Nhiệt độ 7D | UP, do members âm bị cắt | MIXED |
| Phần chính | Nhãn chung “Gió 7D”, “Nhiệt độ 7D” tăng/xếp cao | Nêu gió trung bình và nhiệt độ thấp nhất cụ thể góp phần tăng điểm AI |

Các số được giữ nguyên:

| Feature | Raw SHAP |
| --- | ---: |
| wind_speed_mean_7d | +0.13808016491351335 |
| wind_speed_max_7d | −0.1717510579954423 |
| wind_gust_max_7d | +0.03018087125247653 |
| temperature_min_7d | +0.13169570092829774 |
| temperature_max_7d | −0.05828861770270517 |
| temperature_mean_7d | −0.03177401797287109 |

Không dùng tổng có dấu để xóa dấu đối nghịch. Dù một phía rất nhỏ, nếu vượt ngưỡng và cả hai dấu tồn tại thì nhóm vẫn MIXED.

Tóm tắt Parent ID6 sau sửa:

> Độ tuổi của trẻ, Gió trung bình trong 7 ngày gần đây và Nhiệt độ thấp nhất trong 7 ngày gần đây góp phần làm điểm AI của nhóm bệnh này tăng.

Đây là mô tả các member dương; không nói toàn bộ nhóm gió/nhiệt độ chỉ tăng.

## 5. ID169 trước/sau

Trước: summary nói “Thời điểm trong năm … xếp hạng cao hơn” trong khi nhóm calendar ở chi tiết MIXED.

Sau: cùng helper chọn member dương **Thành phần chu kỳ trong năm (sin)**; nhóm calendar đầy đủ vẫn MIXED. Tóm tắt:

> Độ tuổi của trẻ, Thành phần chu kỳ trong năm (sin) và Độ ẩm trung bình trong 7 ngày gần đây góp phần làm điểm AI của nhóm bệnh này tăng.

Không còn gán chiều dương cho toàn bộ nhóm calendar. Không khẳng định SHAP làm disease vượt các model khác trong bảng xếp hạng.

## 6. Quy tắc ba yếu tố chính

1. Chỉ xét significant positive members trong positive_factors hiện hành.
2. Sắp giảm dần SHAP dương; bằng nhau giữ thứ tự API ổn định.
3. Mỗi concept/cửa sổ lấy member dương mạnh nhất, tối đa 3 concept.
4. Dùng tên cụ thể của member ngay cả khi concept đầy đủ MIXED hoặc legacy PARTIAL.
5. Không lấy negative lớn thay positive, không xếp theo tổng |SHAP| hai chiều.
6. Không bù cho đủ 3. Không positive thì nói không có đóng góp tăng điểm đáng kể; unavailable thì không tự tạo nguyên nhân.

Summary và phần chính dùng cùng danh sách. Group identity và labels dùng cùng helper với chi tiết. Danh sách API gốc không bị mutate.

## 7. Ngôn ngữ và CURRENT

Câu tăng/giảm chuyển sang **điểm AI của nhóm bệnh**, không khẳng định thay đổi thứ hạng giữa 221 bệnh. MIXED mô tả các member góp phần tăng và giảm điểm theo hai chiều; disclaimer không quan hệ nhân quả được giữ.

CURRENT đổi thành “trong ngày”, gồm các nhãn trung bình/cao nhất/thấp nhất. Mưa trong ngày được mô tả là dữ liệu thời tiết, không mặc định đã quan trắc. Câu dẫn hiện có nói dữ liệu trong ngày có thể gồm forecast các giờ chưa xảy ra.

3D/7D vẫn là cửa sổ gồm D, giá trị/đơn vị không thay đổi. Không sửa feature builder, target date, forecast handling hoặc W01/W02. Không sửa phần banner, font Nunito, CSS/layout/navigation hay nội dung y khoa.

## 8. API tương thích ngược và dữ liệu thiếu

- Request dự đoán giữ nguyên.
- display_factors optional; client cũ có thể bỏ qua. Field mới dùng cùng factor key/value/direction/window/input structure, không thêm thông tin nhận dạng bệnh nhân.
- Schema backend chấp nhận response cũ thiếu field và giới hạn tối đa 45 entries.
- Khi frontend thiếu/null field mới, hoặc field không hợp lệ/trùng feature, không suy luận đủ coverage từ Top 5.
- Nếu đã thấy hai dấu thì có thể xác nhận MIXED. Chỉ thấy một dấu trong response cũ thì hiển thị PARTIAL, mũi tên chỉ nói về từng member đã nhận, không kết luận UP/DOWN cho cả concept.
- Không hữu hạn/sign không nhất quán/zero không được tự diễn giải thành tác động.
- Feature thiếu nhãn thân thiện dùng fallback đọc được.
- Tier1 unavailable không làm prediction mất; Tier2 lỗi/không có nội dung vẫn giữ ranking/guidance theo luồng cũ.

## 9. Medical Knowledge: bằng chứng không đổi

Golden selectors được lưu **trước sửa** bằng hàm selector chưa thay đổi. Fixture pre-fix lưu cả Top 5 và đủ 45 raw contributions cho 10 disease.

Sau sửa:

- 10 disease: positive_factors và negative_factors khớp tuyệt đối trước sửa, gồm thứ tự, dấu, giá trị, label, category/window/input và weather_factor.
- Frontend dùng **payload thật từ public router cô lập sau sửa**. Cả **44 selectors** khớp golden trước sửa.
- Cases 0–5 positive giữ selector list; backend tests còn xác nhận 6 positives chỉ lấy 5, không bắt buộc phải có đủ 5.
- AGE/SEX/WEATHER/seasonality và dedup giữ nguyên.
- Mixed wind có positive member Top 5 vẫn tạo topic wind.
- Positive humidity ngoài Top 5 ở ID6 có trong display_factors nhưng không tự thêm selector.
- Negative không được tự chọn làm selector.
- Source publishedMedicalKnowledge.ts không đổi. PubMed/WHO query, discovery, queue/worker/retry, Reviewed/Auto publication, pediatric safety và DB/nội dung MK không chỉnh.
- Không gọi published-MK production endpoint, không tạo demand/job thật hoặc gọi PubMed trong tests.

Compatibility summary backend được sửa câu chữ nhưng không thay Top 5 hoặc phụ thuộc của Medical Knowledge. Static MedicalKnowledgeService trong cùng file explanation không sửa.

## 10. Files thay đổi

Sáu file ứng dụng:

| File | Thay đổi |
| --- | --- |
| seasonal_disease_backend/app/services/weather_ai_explanations.py | Full display contributions, finite guard, summary đúng semantics; giữ nguyên sort/cut Top 5 |
| seasonal_disease_backend/app/weather_ai_schemas.py | Optional display_factors, max 45 |
| Frontend/src/lib/api.ts | Type tương ứng |
| Frontend/src/app/components/weather-ai/tier1Presentation.ts | Grouping đầy đủ, positive representatives, shared summary, legacy fallback, labels |
| Frontend/src/app/components/weather-ai/WeatherAIResults.tsx | Render shared model, câu điểm AI/MIXED/PARTIAL |
| Frontend/src/app/components/parent/ParentDiseaseCard.tsx | Main factors và summary dùng shared model |

Năm file tests và một fixture:

- seasonal_disease_backend/tests/test_shap_explanation_correctness.py — mới, 31 cases.
- seasonal_disease_backend/tests/test_weather_input_validation.py — giữ baseline mọi số/ranking/Top5/Tier2, chỉ cho phép summary và display field thay đổi có chủ đích; không sửa fixture W01 gốc.
- Frontend/src/app/components/weather-ai/tier1Presentation.test.tsx — mới, 22 cases, gồm actual API payload và selector golden.
- Frontend/src/app/components/weather-ai/WeatherAIResults.test.tsx — cập nhật field/nhãn theo contract mới.
- Frontend/src/app/components/ParentPortal.test.tsx — cập nhật nhãn cụ thể; giữ nguyên navigation/GPS/stale/Tier2 regressions.
- seasonal_disease_backend/tests/fixtures/shap_explanation_before.json — immutable pre-fix fixture, không sửa baseline numbers.

Chỉ evidence/báo cáo/bản vá lịch sử nằm thêm trong thư mục này. Các thay đổi chưa commit của task cũ giữ nguyên.

## 11. Kiểm thử cuối cùng

| Kiểm tra | Kết quả |
| --- | --- |
| Targeted backend, gồm 31 tests mới + runtime/API/visibility/Parent/W01-W02 | **150 PASS** |
| Toàn bộ frontend, 19 test files, gồm 22 cases mới | **423 PASS** |
| Typecheck | **PASS** |
| Production build | **PASS**, 2313 modules |
| git diff --check | **PASS** |
| Raw45/order/base/additivity/sigmoid | **PASS** trên fixture và regressions local |
| Top 3/5/10 + visibility giữ đúng disease/SHAP | **PASS** |
| Public và Admin API serialization full field | **PASS**, FastAPI cô lập + SQLite RAM |
| Medical Knowledge Top 5 và 44 selectors | **PASS**, exact golden comparison |
| Zero/near-zero, 0–4 positives, negative-only, mixed lệch mạnh, stable ties, legacy/null/invalid display | **PASS** |
| Parent switching/collapsed details/stale requests/GPS/loading/Tier2 failure | **PASS** trong frontend tests |
| Chrome thật / visual desktop-mobile | **NOT VERIFIED** |
| Prediction ảnh cũ | **NOT REPRODUCED**, thiếu metadata |

Backend chạy trong seasonal_disease_backend, đặt PYTHONDONTWRITEBYTECODE=1:

~~~powershell
.venv/Scripts/python.exe -B -m pytest tests/test_shap_explanation_correctness.py tests/test_weather_ai_runtime.py tests/test_weather_ai_api.py tests/test_weather_ai_parent_eligibility.py tests/test_weather_ai_release_readiness.py tests/test_weather_input_validation.py tests/test_parent_weather_only_contract.py tests/test_parent_disease_visibility.py -q -p no:cacheprovider
~~~

Frontend chạy trong Frontend:

~~~powershell
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
~~~

Có warnings deprecation sẵn có của Starlette/httpx và datetime.utcnow trong visibility tests; không gây fail và không sửa ngoài phạm vi.

Các tests mới so sánh giá trị thật với golden trước sửa, không chỉ kiểm tra code tự khớp với chính nó. Test one-call xác nhận không tính lại SHAP chỉ để tạo display field.

## 12. Safety closure và findings

**PASS — hoạt động của task:**

- Không start/stop/restart backend. Chỉ áp dụng Python sau khi kiểm tra không còn process uvicorn/reload. Không import app.main/lifespan.
- DB thật chỉ được snapshot bằng SQLite mode=ro + query_only; total_changes=0. API tests dùng hai visibility tables trong SQLite RAM; visibility tests dùng DB cô lập, không migration thật.
- Trong phiên frontend trước, DB hash không đổi. Trong phiên tiếp tục/backend này, DB hash trước/sau cũng không đổi; 32 bảng snapshot trừ login_sessions giữ count/hash.
- Models/manifest/schema feature/training data/runtime source/W01-W02/.env/Excel/Graduation không sửa. Không retrain/import/migrate.
- Medical Knowledge selector/query/queue/worker/safety/content giữ nguyên.
- Không external network hoặc gọi API Eureka đang chạy; không đưa dữ liệu ra ngoài.
- HEAD và Git index giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout.
- Source/style ngoài danh sách 12 files của task không thay đổi trong các snapshots đã kiểm tra.

**FINDING — DB giữa hai phiên:**

Hash DB sau phiên trước khác hash khi bắt đầu phiên tiếp tục, trong khoảng agent không thực hiện task và backend trước đó do người dùng chạy. Không có đủ bằng chứng để quy nguyên nhân thay đổi này hoặc chứng nhận DB bất biến trong toàn bộ khoảng thời gian giữa hai phiên. Không có thao tác ghi DB thật từ agent; trong từng cửa sổ kiểm tra, hash DB giữ nguyên. Không dùng kết luận này để che việc thiếu toàn bộ baseline giữa hai phiên.

**LIMITATION:**

Không thực hiện browser E2E/visual; không xác minh layout thực tế chỉ bằng unit tests/build. CSS/font/layout không sửa. Không tái lập ảnh gốc thiếu tọa độ/ngày/response. Không gọi weather provider live trong task offline này.

## 13. Evidence và trạng thái cuối

- backend_after.json: payload public API sau sửa, do test cô lập sinh.
- frontend_after.json: output helper thật, ID6/169 groups/summary và selector exact checks.
- medical_selectors_before.json: golden selector trước sửa.
- resume_baseline.json và safety_closure.json: hashes/safety của phiên tiếp tục.
- safety_closure_pending.json: bằng chứng lịch sử phiên frontend trước.
- backend_changes_pending.patch: bản vá đã chuẩn bị lúc server còn chạy; **đã áp dụng trong phiên tiếp tục**, chỉ giữ làm dấu vết, không phải công việc còn chờ.

**Không còn sửa code hoặc kiểm thử bắt buộc nào đang chờ trong phạm vi đã chốt. PASS_WITH_FINDINGS do các giới hạn xác minh nêu trên. DỪNG, không tiếp tục redesign hoặc sửa Medical Knowledge.**
