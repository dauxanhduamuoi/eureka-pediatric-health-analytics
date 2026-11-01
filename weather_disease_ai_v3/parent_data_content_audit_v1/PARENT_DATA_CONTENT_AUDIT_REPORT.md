# EUREKA — Audit dữ liệu và nội dung Parent

Ngày: 24/10/2026, Asia/Bangkok. **AUDIT-ONLY: chưa sửa ứng dụng hoặc dữ liệu.**

Workspace: `D:\OS_C\Bài học trên trường\Thực tập\Fullstack_2\ThucTap-main`.
Branch: `feature/medical-knowledge-v1-20260820`.
HEAD: `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`.

## Kết luận

**FAIL về tính đúng đắn của một số dữ liệu/nội dung Parent.** Audit đã xác định được nguyên nhân; chưa thực hiện sửa chữa.

Các lỗi quan trọng:

1. Thống kê khu vực bị cắt theo Top K số lượt rồi ghép vào Top K Weather AI: “chưa có dữ liệu” có thể sai dù DB có hàng trăm/hàng nghìn lượt.
2. Hướng dẫn hô hấp của nhóm gãy xương có sẵn trong Excel và được import nguyên văn; không phải SHAP/Medical Knowledge hoặc fallback sang bệnh khác trong trường hợp này.
3. Frontend fuzzy matching chọn sai hướng dẫn ở 3/311 nhóm, gồm 2 nhóm có model đang bật.
4. Mã tỉnh lịch sử khác mã dropdown ở 10 địa phương, ảnh hưởng 56.821 lượt khi truy vấn bằng mã chuẩn.
5. “Dữ liệu khu vực: Cao” có thể lấy từ dự báo toàn hệ thống 05/2025, không phải nguy cơ riêng của tỉnh/tuổi/thời điểm hiện tại.

## Phương pháp và giới hạn xác minh

- Đọc source hiện tại, không dựa vào kết luận báo cáo cũ. Bảo toàn working tree bẩn có trước.
- DB thật: `seasonal_disease_backend/database.db`, xác định từ `app/database.py`, không nhầm với `database.db` ở root.
- Mọi kết nối audit dùng SQLite `mode=ro`, `PRAGMA query_only=ON` và authorizer chặn INSERT/UPDATE/DELETE/DDL/ATTACH. Không import `app.main`, không khởi động server, không chạy importer/migration/worker.
- Gọi trực tiếp handler `areas.local_risks`, `areas.recommendations`, `public.disease_knowledge`, `dashboard.overview` với SQLAlchemy session read-only. Đây là payload của handler hiện tại, không phải xác minh HTTP/browser đang mở trên máy.
- Medical Knowledge chạy đúng publication read service nhưng **không inject auto queue**, tránh side effect ghi demand/job của endpoint production.
- Excel chỉ đọc. File bệnh nhân chỉ lấy 2 cột ICD và ngày khám để kiểm tra tổng hợp; không xuất hàng bệnh nhân, tên, ngày sinh hoặc địa chỉ. Các nhãn tỉnh không hợp lệ có khả năng là mảnh địa chỉ đã bị loại khỏi evidence export; chỉ giữ số lượng.
- Đã quét mapping toàn bộ 311 nhóm. Không khẳng định đã thẩm định y khoa thủ công cả 311 hướng dẫn.
- Chưa kiểm tra trình duyệt thật. Các nhận định frontend là kết quả truy vết code/ghép dữ liệu và tests, không phải screenshot hay live UI PASS.

## A. Dữ liệu gốc, 236 nhóm thống kê và 221 model

### A1. Hai đường dữ liệu

Đường dashboard/Parent khu vực:

`DS-BenhNhan + DS-MaBenh → import_patient_file → process_patients → attach_patient_areas → patient_records + monthly_statistics → /api/areas/local-risks → ParentPortal.combinedRisks → ParentDiseaseCard`.

Đường Weather AI V3:

`Tool/weather/train_history.xlsx → V3 data/raw/train_history.xlsx → src/data_pipeline.py → daily_cases / contexts / targets / disease_catalog → TRAIN split supported disease IDs → model_manifest + 221 LightGBM files → parent-risk ranking / Tier 1`.

SHA256 file gốc và bản V3 raw đều là `ae148fdadbcc901a3ade4bff9281bc856f34fc24906fa0c561a2cb09a3f28c78`.
Source gốc có 257.771 lượt. Số lượt theo từng tên nhóm của source, khi exact-map theo catalog dashboard, khớp DB: **0 nhóm lệch tổng**; cả 12.230 bản ghi catalog ICD cùng ID/tên/report code khớp source.

Lưu ý provenance: file đã import có tên `dulieu_import.xlsx`; hiện thư mục `uploads/predict_current` chỉ còn `latest_import.json`, không còn workbook đó. Vì vậy đã chứng minh cùng tổng theo nhóm và cùng catalog, nhưng **không thể chứng minh byte-identical cho chính file upload đã mất** hoặc sự bằng nhau của mọi hàng/địa chỉ.

| Tập dữ liệu | Số nhóm / lượt | Giải thích |
| --- | ---: | --- |
| Catalog nguồn / DB / V3 candidate | 311 nhóm | 12.230 mã ICD, 311 ID và tên nhóm |
| `patient_records`, `predict_current` | 257.771 lượt, 236 nhãn | 235 nhóm hợp lệ + nhãn “Không rõ nhóm bệnh” gồm 3 lượt |
| `monthly_statistics` | 19.429 dòng, tổng 257.771 lượt | 236 nhãn, 52 tháng; không có duplicate khóa data_type/period/group/age |
| V3 daily cases | 257.769 lượt, 235 nhóm | Bỏ 2 lượt không map được; chuẩn hóa ICD khác dashboard ở một ký hiệu |
| Nhóm có xuất hiện nhưng không có model | 14 nhóm | Không có positive target trong TRAIN; không dùng validation/test để bổ sung model |
| Chưa từng xuất hiện | 76 nhóm | Có trong catalog, không có lượt trong source |
| Model deploy | 221 | Tập ID model bằng tập ID TRAIN-supported của catalog; 221/221 checksum model khớp manifest, đủ 45 features; không phải phải đủ 311/236 |

TRAIN-supported được chọn từ `has_case_h3/h7/h14 > 0` trong TRAIN. Đối chiếu catalog cho thấy đúng 221 ID có `train_positive_queries_h14 > 0`, bằng manifest. Đây không phải bộ lọc theo tỉnh hay theo tuổi phụ huynh chọn. Hai nhóm cụ thể 6 và 274 đều có file model.

14 ID có xuất hiện trong source nhưng không có model: `2,15,16,35,40,61,67,114,158,219,280,294,295,298`. Không đề xuất thêm model hoặc retrain.

### A2. Quy tắc mapping không hoàn toàn giống nhau

- Cùng ưu tiên ICD xuất viện, thiếu mới lấy ICD nhập viện; dùng exact catalog lookup, không tự lấy ICD cấp cha nếu mã con không tồn tại.
- V3 giữ `disease_group_id` và canonical tên/report block; `patient_records`/`monthly_statistics` chỉ lưu tên nhóm, không có FK ID nhóm.
- V3 loại `†`/`*` trong ICD; dashboard importer hiện chỉ trim/uppercase. DB có 1 lượt mã `B02.2` nằm trong “Không rõ nhóm bệnh”, trong khi catalog có `B02.2†`, ID 34. V3 map được lượt này. Hai lượt còn lại dùng `A91` và `Z22.7`, không có exact catalog match. Do đó 257.768 lượt có nhóm hợp lệ trong DB so với 257.769 trong V3.
- V3 còn dùng tháng tuổi fallback khi thiếu ngày sinh; dashboard tính tuổi theo ngày sinh. Không phải khác model, nhưng không nên tuyên bố hai pipeline có mọi quy tắc giống hệt nhau.

### A3. Nguyên nhân thiếu số liệu trên result card

`ParentPortal.tsx:374` gọi `getAreaLocalRisks({ provinceCode, limit: topK })`.
`areas.py:187` GROUP BY bệnh, ORDER BY COUNT giảm dần rồi LIMIT.
`ParentPortal.tsx:396` ghép bằng tên chuẩn hóa với danh sách Weather AI.

**Hai Top K khác nhau:** danh sách AI sắp theo điểm model; danh sách khu vực sắp theo tổng số lượt trong lịch sử. Bệnh có trong AI nhưng ngoài Top K địa phương sẽ không được trả về; frontend đổi thiếu row thành `null`, rồi hiển thị “chưa có dữ liệu”. Đây là **BUG**, không phải thiếu model hoặc chắc chắn thiếu bệnh án.

| Tỉnh | Nhóm | Có lượt gốc / model? | Lượt DB và API khi không cắt Top 5 | Hạng theo lượt địa phương | API `limit=5` | Parent nếu nhóm nằm trong AI Top 5 |
| --- | --- | --- | ---: | ---: | --- | --- |
| Bình Dương `74` | 6 — Các bệnh nhiễm khuẩn ruột khác | Có / Có | 1.032 | 5 | Có row, 1.032 | 1.032 ca |
| Bình Dương `74` | 274 — Gãy các phần khác của chi do lao động và giao thông | Có / Có | 508 | 11 | Không có row | “chưa có dữ liệu” **sai** |
| TP.HCM `79` | 6 | Có / Có | 3.313 | 5 | Có row, 3.313 | 3.313 ca |
| TP.HCM `79` | 274 | Có / Có | 1.855 | 10 | Không có row | “chưa có dữ liệu” **sai** |

Mã nhóm 6: `A02,A04-A05,A07-A08`; nhóm 274: `S42,S52,S62,S82,S92,T10,T12`. Exact ICD prefixes trong DB khớp các block này. Source toàn bộ tỉnh có 11.572 lượt nhóm 6 và 4.490 lượt nhóm 274.

Khi chọn 3 nhóm bệnh, nhóm 6 cũng bị mất số liệu vì hạng địa phương là 5. Với nhóm 274, Bình Dương cần limit ít nhất 11, TP.HCM cần ít nhất 10. Như vậy đổi số nhóm hiển thị có thể làm số liệu lịch sử xuất hiện/biến mất dù DB không đổi.

Bình Dương có 191 nhóm; TP.HCM có 208 nhóm. API giới hạn tối đa 200: chỉ tăng limit lên 200 cũng không bảo đảm đầy đủ toàn bộ dữ liệu.

### A4. Bộ lọc, thời gian và nhãn “Cao”

- Lọc `data_type='predict_current'`, `province_code`, tùy chọn district/ward. Parent chỉ gửi province. Không lọc tuổi, giới, lượt nội/ngoại trú hay trạng thái hồ sơ. Không có điều kiện thời gian gần đây trong local-risks.
- `recent_cases` thực tế là COUNT tất cả lượt trong data_type/tỉnh qua toàn bộ 2021–04/2025, không phải ca mới hôm nay. Đơn vị là lượt ghi nhận, không phải số trẻ duy nhất.
- “2021-01 đến 2025-04” lấy từ `MIN/MAX(patient_records.period)` cho toàn bộ tỉnh/data_type, **không hard-code**. Nhóm gãy xương riêng Bình Dương bắt đầu 08/2021, TP.HCM 07/2021; API vẫn gắn kỳ toàn tỉnh bắt đầu 01/2021 cho từng nhóm. Cần phân biệt phạm vi dữ liệu tỉnh với kỳ thực sự có lượt của nhóm.
- `_forecast_risk_map` lấy tháng forecast mới nhất toàn DB: **2025-05**, gộp rủi ro cao nhất qua các tuổi, không lọc tỉnh hoặc tuổi trẻ đang chọn.
- `_classify_area_risk` ưu tiên forecast Cao/Trung bình; nếu không có hai mức này, dùng ngưỡng tổng lượt >=20 là Cao, >=5 là Trung bình. Forecast Thấp không chặn ngưỡng lịch sử.
- Cả nhóm 6/274 có ít nhất 1 tuổi forecast Cao trong 05/2025, nên API trả Cao cho hai tỉnh. Không thể diễn giải đây là nguy cơ hiện tại của trẻ hoặc tình hình mới của Bình Dương/TP.HCM.
- Hàm phân loại trả Cao cho `(0,'Cao')`, nhưng API hiện GROUP BY từ row thật nên không tự tạo row cho bệnh không có bản ghi. Chưa tìm thấy card hiện Cao khi hoàn toàn không có area row; frontend giữ `localRisk=null` và không render badge.

### A5. Không có bản ghi, số 0, lỗi và không map được

- Frontend dùng `area?.recent_cases ?? null`: số 0 được giữ là 0, không bị đổi thành thiếu dữ liệu.
- API không trả các nhóm 0 lượt; không có row, bị LIMIT, tên không match và lỗi API đều có thể dẫn đến cùng trạng thái `null`.
- `Promise.allSettled` biến lỗi area API thành `[]`, không làm hỏng ranking, nhưng cũng không phân biệt lỗi truy vấn với không có dữ liệu.
- Guidance API lỗi lúc mount cũng bị `.catch(() => [])`, dễ thành thông báo chưa import dù thực tế đã import.
- Tên chuẩn hóa giữa 311 catalog V3 và DB hiện khớp. Tuy nhiên join bằng tên thay vì ID là điểm yếu khi catalog đổi tên.

## B. Bảng nguồn dữ liệu Parent

Đường dẫn frontend trong bảng bắt đầu tại `Frontend/src/`; backend tại `seasonal_disease_backend/app/`.

| Thông tin hiển thị | Frontend | API | Backend xử lý | Bảng/cột DB hoặc nguồn khác | Hard-coded? | Kết luận / cập nhật |
| --- | --- | --- | --- | --- | --- | --- |
| Tên nhóm bệnh | ParentPortal → ParentDiseaseCard; splitDiseaseLabel | POST `/api/public/parent-risk` | weather_ai_service + LightGBMModelRegistry | CSV V3 `disease_catalog.csv`, `disease_group_name` | Không phải tên viết cố định trong card | Theo catalog deploy, không theo guidance DB; Admin sửa guidance không đổi tên model |
| Mã ICD hiển thị | ParentDiseaseCard `report_group_code` | parent-risk | registry/catalog | CSV `report_group_code` | Không | Là block mã báo cáo, không phải ICD cá nhân; deploy catalog không tự refresh theo Admin import |
| Thứ hạng | ParentPortal, ParentDiseaseCard | parent-risk | weather_ai_service: sort scores sau visibility filter | 221 model LightGBM, feature/category schema | Không | Điểm xếp hạng tương đối, không phải số ca/xác suất cá nhân |
| Giải thích ranking / SHAP | key factors + WeatherAIExplanationSections | parent-risk `tier1` | Tier1ExplanationService trong module `weather_ai_explanations` | Booster SHAP + input tuổi/giới/thời tiết; không phải bảng guidance | Nhãn trình bày chung có cố định; số liệu không | Không lấy triệu chứng hoặc phòng bệnh từ SHAP |
| Lượt ghi nhận khu vực | combinedRisks → ParentDiseaseCard | GET `/api/areas/local-risks` | areas.local_risks + apply_area_filters | COUNT `patient_records.id`, lọc data_type/province | Không | Có BUG cắt Top K trước khi join; cập nhật DB phản ánh khi dự đoán lại |
| Nhãn Cao/Trung bình/Thấp | ParentDiseaseCard `localRisk` | local-risks | _forecast_risk_map + _classify_area_risk | `forecast_results.forecast_period/risk_level` + ngưỡng tổng lượt | Ngưỡng 20/5 viết cố định | Không phải risk riêng của tỉnh/tuổi/thời điểm hiện tại |
| Triệu chứng | ParentAdviceSection → GuidanceList | GET `/api/public/disease-knowledge` | public.disease_knowledge | `disease_knowledge.symptoms` ← Excel `TRIEUCHUNGTHUONGGAP` | Nội dung riêng bệnh không hard-code FE | DB thật, nhưng fuzzy matching có thể chọn sai row |
| Cách phòng bệnh | row.knowledge.prevention | disease-knowledge | import_parent_guide_file / public reader | `disease_knowledge.prevention` ← `CACHPHONGBENH` | Không trong card | Import nguyên văn, bao gồm lỗi nội dung nguồn |
| “Phụ huynh nên làm gì?” | ParentAdviceSection, `rows={prevention}` | disease-knowledge | cùng đường ở trên | **Chính `CACHPHONGBENH` → prevention → splitText → GuidanceList** | Chỉ tiêu đề cố định | Đã truy vết trực tiếp, không suy đoán theo tên field |
| Khuyến nghị khu vực bên dưới result | ParentPortal `recommendations` | GET `/api/areas/recommendations` | areas.recommendations, _find_disease_knowledge, _split_guidance | `disease_knowledge.prevention`, chọn từ 5 nhóm nhiều lượt khu vực | Format/tối đa 2 ý mỗi nhóm cố định | Không theo disease card đang chọn; caption hiện đã nói rõ “dữ liệu khu vực đã nhập” |
| Khi nào đi khám | DangerSignsAlert | disease-knowledge | public reader | `disease_knowledge.warning_signs` ← `DAUHIEUCANDIKHAM` | Có fallback chung khi rỗng/không match | Không fallback riêng sang bệnh khác chủ ý; fuzzy match sai vẫn gây sai nội dung |
| Medical Knowledge Reviewed/Auto | ExpandableExplanation → PublishedMedicalKnowledgeSections | POST `/api/public/medical-knowledge/published` | PublishedMedicalKnowledgeReadService + repositories | medical topics/revisions/source links hoặc auto revisions/topic states | Nhãn/cảnh báo an toàn chung cố định | Không dùng Excel guidance; chọn theo ID + factor type/key/value |
| Tài liệu tham khảo | PublishedMedicalKnowledgeSections | published endpoint | _safe_item/_safe_auto_item/_safe_citation_url | `medical_evidence_sources`, revision source links, evidence contents | URL PubMed được dựng từ PMID khi hợp lệ | Nguồn theo đúng revision; không phải tài liệu chung dùng cho mọi bệnh |

Không tìm thấy nội dung kiểu ho/tiêm chủng/gãy xương được hard-code trong ParentPortal, ParentDiseaseCard hoặc area guidance handlers. Các chuỗi chung về thiếu dữ liệu, cần khám khi bất thường, non-causality, trạng thái Auto là UI fallback/cảnh báo chung và được phân loại riêng, không phải hướng dẫn chuyên biệt.

## C. Excel hướng dẫn phụ huynh

File thật: `seasonal_disease_backend/uploads/parent_guide/huong_dan_phu_huynh_backend_mapping_ready (1).xlsx`.
Sheet: `HuongDan-PhuHuynh`; SHA256 `8b2967dd5024565f5b6202280f670423162732218ec01c75200bd167904fa906`.

- Workbook có **312 dòng dữ liệu**, không phải 311 dòng ban đầu; importer dedupe thành **311** bản ghi DB. Public API trả đúng 311.
- Một tên trùng ở dòng Excel 24 và 153: ID 19, “Giang mai bẩm sinh - Congenital syphilis”, report block lần lượt A49 và H54. Không phải dòng trắng. Importer báo `invalid_rows=1` nhưng thực chất là dedupe, không phải thiếu nội dung.
- Import logs 7 và 8 xác nhận đã import hai lần, mỗi lần 312 total / 311 valid / 1 invalid. Quét toàn bộ sau chuẩn hóa importer: **0 sai khác** về triệu chứng, dấu hiệu khám, prevention so với DB hiện tại; không có duplicate tên trong DB, không có trường rỗng ở ba cột này.
- Route: POST `/api/import/parent-guide`, preview `/api/import/parent-guide/preview`, status/list GET tương ứng, trong `routers/import_data.py:225` trở đi.
- Importer `import_service.py:232` **xóa toàn bộ DiseaseKnowledge rồi bulk insert** và log, trong transaction. Không phải upsert theo ID. Dedupe theo `disease_group.strip().lower()`, giữ dòng cuối; import subset sẽ làm mất các hướng dẫn ngoài subset. Dữ liệu Admin sửa thủ công trong cùng bảng cũng sẽ bị thay thế khi import lại.
- `IDNHOMICD` và `MANHOMBAOCAO` **chỉ được ghép vào chuỗi `source`**, không có FK/cột ID typed trong `disease_knowledge`. `disease_knowledge.id=220` là ID bản ghi hướng dẫn, không phải disease ID 274.
- Tất cả 312 cặp tên/ID Excel tồn tại trong catalog hiện tại; điều này **không chứng minh nội dung y khoa hay nhãn ICD trong catalog đúng về chuyên môn**.
- Public endpoint không trả `source` dù DB có. FE vì vậy gán nguồn nội bộ chung vào state; card hiện không render field nguồn guidance. Không thể hiện được provenance import thật qua field này.
- Parent tải guidance **một lần khi component mount**. Không thấy cache module/localStorage cho guidance; tuy nhiên state đang mở không tự refetch khi Admin import/cập nhật. Cần reload/remount Parent để lấy bản mới. Bấm dự đoán lại chỉ refresh ranking/area/medical, không refresh danh sách guidance.
- Không thử import lại trên DB thật hoặc DB test. Kết luận overwrite/dedupe dựa trên mã nguồn và hai import logs, không tuyên bố đã kiểm thử ghi.

## D. Vì sao gãy xương có hướng dẫn hô hấp?

Truy vết xác định:

1. V3 disease ID `274`; ICD block `S42,S52,S62,S82,S92,T10,T12`.
2. Frontend chọn đúng `disease_knowledge.id=220`, tên đầy đủ của chính nhóm gãy xương. Source lưu `IDNHOMICD=274` và block tương ứng.
3. Workbook **dòng 222**, cột D/E/F (`TRIEUCHUNGTHUONGGAP`, `DAUHIEUCANDIKHAM`, `CACHPHONGBENH`) đã chứa ho kéo dài/ho ra máu, hướng dẫn hô hấp, thông khí và tiêm chủng.
4. Cả ba cột DB khớp Excel nguyên văn. Parent không tự viết thêm và không bị Medical Knowledge ưu tiên ghi đè guidance.

**Root cause trường hợp này là dữ liệu hướng dẫn nguồn sai về nhóm, được import đúng kỹ thuật.** Sửa riêng fuzzyMatch sẽ không sửa được nội dung gãy xương này.

Ba nhóm ngoài bệnh lao có cùng nguyên bộ 3 trường với nhóm lao:

| Disease ID | Knowledge row | Nhóm | Kết luận |
| --- | ---: | --- | --- |
| 274 | 220 | Gãy các phần khác của chi do lao động và giao thông | Sai nội dung nguồn, tái hiện trường hợp người dùng |
| 275 | 221 | Gãy nhiều xương của cơ thể do lao động và giao thông | Cùng nguyên bộ hướng dẫn hô hấp/ho |
| 269 | 197 | Lão suy | Cùng nguyên bộ hướng dẫn hô hấp/ho |

Ba nhóm còn lại cùng signature là ID 7, 8 và 54 (các nhóm lao/di chứng lao). Tên các nhóm sai có “lao động”/“lão”; có thể file được tạo bằng matching từ khóa không phân biệt dấu, **nhưng không có code tạo workbook để khẳng định cơ chế sinh lỗi đó**.

### D2. Lỗi mapping độc lập ở frontend

`findKnowledge` lấy first match từ API sắp `id DESC`; `fuzzyMatch` chỉ yêu cầu mọi token query xuất hiện đâu đó trong `disease_group + title`. Không ưu tiên exact match.

| Disease ID | Đúng phải lấy knowledge ID | Đang lấy | Kết quả | Model bật? |
| --- | ---: | ---: | --- | --- |
| 105 — Suy dinh dưỡng | 109 | 239 | Lấy hướng dẫn thai chậm phát triển/suy dinh dưỡng thai | Có |
| 152 — Bệnh tim khác | 117 | 156 | Lấy hướng dẫn bệnh tim thiếu máu cục bộ khác | Có |
| 11 — Phong | 13 | 47 | Lấy hướng dẫn di chứng phong | Không có model deploy |

Quét: 311/311 có ít nhất một match, 4 nhóm có nhiều match, 3 nhóm chọn sai. Nhóm thứ tư ID 265 có ambiguity nhưng hiện first match đúng. “Không có nhóm unmatched” không có nghĩa mapping an toàn.

Backend khuyến nghị dùng hàm substring khác và query order khác: quét 311 nhóm với DB hiện tại **0 first-match sai**, nhưng không có ràng buộc exact ID và có rủi ro khi thứ tự/tên thay đổi. Không gom lỗi backend và frontend thành một kết luận chung sai.

## E. Phát hiện bổ sung và Medical Knowledge

### E1. BUG: Mã tỉnh legacy không khớp dropdown

| Tỉnh | Mã lưu trong patient_records | Mã dropdown/catalog | Lượt bị ảnh hưởng |
| --- | --- | --- | ---: |
| Đồng Nai | ĐONG_NAI | 75 | 31.740 |
| Lâm Đồng | LAM_ĐONG | 68 | 7.467 |
| Bình Định | BINH_ĐINH | 52 | 5.309 |
| An Giang | AN_GIANG | 89 | 3.848 |
| Thanh Hóa | THANH_HOA | 38 | 2.786 |
| Nghệ An | NGHE_AN | 40 | 2.751 |
| Cần Thơ | CAN_THO | 92 | 1.205 |
| Quảng Nam | QUANG_NAM | 49 | 1.124 |
| Đà Nẵng | ĐA_NANG | 48 | 371 |
| Hải Phòng | HAI_PHONG | 31 | 220 |
| **Tổng** | | | **56.821** |

Direct handler bằng `province_code='75'` trả `[]`, bằng legacy code Đồng Nai trả 5 dòng. Bình Dương và TP.HCM không mắc lỗi mã tỉnh này. Có thêm 169 lượt/14 nhãn tỉnh không resolve được vào catalog; không xuất các nhãn có thể chứa mảnh địa chỉ. Đây là giới hạn chất lượng dữ liệu khu vực, không phải thiếu model.

### E2. FINDING nghiêm trọng: catalog nguồn tự có collision ID/report block

`disease_codes` và DS-MaBenh nguồn cùng gộp ID 19 / tên “Giang mai bẩm sinh” cho hai report block **A49 và H54**, tương ứng 7 và 10 mã ICD. V3 canonical chọn một tên/block theo số lượt quan sát; Excel guidance có cả hai dòng rồi importer giữ dòng cuối. Tên khớp qua các tầng chỉ chứng minh chúng đang dùng cùng catalog, không bảo đảm catalog đúng về y khoa.

Cần chủ sở hữu dữ liệu/nhân viên y tế xác nhận catalog gốc. Không tự đổi ID/ICD/tên model hoặc retrain trong audit này.

### E3. INTENTIONALLY CORRECT / FINDING: Medical Knowledge tách biệt khỏi guidance

- Reviewed: `medical_knowledge_topics`, `medical_knowledge_revisions`, `medical_knowledge_publications`, `medical_revision_sources`, `medical_evidence_sources`, `medical_evidence_contents`.
- Auto: dùng cùng topic/source, lưu revision tại `auto_medical_knowledge_revisions`, nguồn revision tại `auto_medical_knowledge_revision_sources`, trạng thái current/hidden/demand tại `auto_medical_knowledge_topic_states`, job tại `auto_medical_knowledge_jobs`, settings tại `auto_medical_knowledge_settings`.
- Selector exact gồm `(disease_group_id, factor_type, factor_key, factor_value)`. AGE dùng đúng chuỗi nhóm tuổi từ input đóng góp SHAP; không lấy nội dung nhóm tuổi khác để lấp thiếu. WEATHER theo factor chuẩn; chỉ positive SHAP được frontend đưa vào selectors.
- Reviewed được ưu tiên khi published pointer đúng topic, status APPROVED, parent_display_allowed=true, evidence displayable, source/evidence link hợp lệ và có direct pediatric support. APPROVED một mình chưa đủ được hiển thị.
- Auto fallback chỉ khi thiếu Reviewed hợp lệ và display_mode cho phép; vẫn cùng selector, current revision, READY, không hidden, source/trust/population đủ điều kiện. Đây là fallback **loại nội dung**, không phải fallback sang bệnh khác.
- DB: 16 Reviewed revisions (4 APPROVED, 12 DRAFT); chỉ 1 pointer hiện tại tới revision 14/topic 2 (ID 169, humidity). Pointer này hiện **không được trả cho Parent** vì source population UNKNOWN, không có pediatric direct support, lý do `PARENT_TIER2_PEDIATRIC_SUPPORT_REQUIRED`. Không hạ gate để hiển thị cho đủ nội dung.
- Chạy publication reader không queue trên 225 selector hiện có: **23 Auto hợp lệ, 0 Reviewed hợp lệ, 0 selector chéo**. 2 Auto được resolve STRICT, còn 21 BASIC. Không đồng nhất 23 nội dung đủ điều kiện với 23 nhóm bệnh hoặc với mọi kết quả dự đoán.
- DB có 256 Auto revisions nhưng phần lớn INSUFFICIENT; chỉ current revision hợp lệ mới được lấy. 188 PubMed sources và 1 WHO source trong library không đồng nghĩa tất cả đang được trích dẫn cho Parent.
- UI hiển thị Auto chưa được nhân viên y tế kiểm duyệt, giữ evidence label và nguồn; không lấy cờ APPROVED để đổi Auto thành Reviewed.

**Đọc Parent có thể ghi DB:** production dependency luôn inject `AutoMedicalKnowledgeQueueService`. Với selector thiếu Reviewed hợp lệ, `read_batch` gọi `enqueue_selectors`; settings hiện enabled=1 và REVIEWED_WITH_AUTO_FALLBACK. Queue có thể tạo topic/state/job, tăng demand và commit, kể cả khi Auto READY đã tồn tại (ghi demand trước khi skip tạo job). External discovery/LLM chạy sau ở worker. Audit đã cố ý không gọi endpoint này với queue thật.

`GET /api/areas/provinces` còn gọi backfill tọa độ, có thể commit khi thiếu. Vì vậy “GET” hoặc tên “ReadService” không mặc định đồng nghĩa không có side effect. Audit không gọi province endpoint này; dùng pure catalog lookup.

### E4. FINDING / LIMITATION khác

- Guidance chỉ là nội dung import, không có trạng thái staff-reviewed bắt buộc như Medical Knowledge; “311 nhóm đã import” không đồng nghĩa 311 nhóm đã kiểm duyệt.
- 94 đoạn prevention khác nhau cho 311 nhóm; trùng template không tự động chứng minh sai, nhưng đã tìm được 3 nhóm sai có cùng signature với hướng dẫn lao. Cần rà soát có mục tiêu các template còn lại, không tự viết lại y khoa.
- Frontend `splitText` tách cả dấu `-`; có rủi ro làm vỡ khoảng số/thuật ngữ. Scan symptoms/prevention hiện tại chưa thấy khoảng `số-số` bị ảnh hưởng, nên chưa kết luận lỗi số liệu thực tế từ nhánh này.
- Source public API bỏ field `source`; import IDs không phải canonical disease IDs. Không dùng source string hoặc ID bản ghi guidance làm khóa model.
- Chưa thấy stale area/Medical Knowledge response ghi đè ranking mới trong code đang có; 87 tests liên quan vẫn PASS. Điều này không kiểm chứng sự đúng đắn y khoa của Excel.

## F. Hướng sửa tối thiểu — chỉ đề xuất, chưa thực hiện

| Ưu tiên | Phần cần sửa | File / nguồn liên quan | Thay đổi nhỏ nhất | Kiểm thử cần có |
| --- | --- | --- | --- | --- |
| 1 | Hướng dẫn gãy xương/lão suy sai | Workbook hướng dẫn do người quản lý nội dung sở hữu; importer validation | Nhân viên y tế rà soát ít nhất ID 274/275/269 và xác nhận nội dung đúng; không tự thay bằng text bệnh khác. Kiểm tra trên DB bản sao trước thao tác ghi được phê duyệt | Exact ID/ICD/nguồn cho 3 trường; import dry-run/diff; so sánh trước/sau; không đổi model |
| 1 | Ghép sai guidance | `Frontend/src/app/components/ParentPortal.tsx`; có thể chia helper dùng chung với backend | Exact canonical disease ID ưu tiên; tối thiểu exact normalized full name trước và không cho fuzzy tự chọn khi nhiều match. Thiếu/ambiguous thì hiển thị chưa có guidance phù hợp | Regression ID 105/152/11/265; đảo thứ tự rows không đổi match; không match trả empty, không mượn bệnh khác |
| 1 | Mất local counts vì Top K | `routers/areas.py`, `Frontend/src/lib/api.ts`, `ParentPortal.tsx` | Truy vấn giới hạn theo chính tập disease IDs/tên của kết quả AI, không lấy Top N lịch sử rồi join. Có thể resolve ID qua DiseaseCode sang tên, chưa cần migration | BD 508/HCM 1.855 luôn có khi card 274 xuất hiện; nhóm 6 không mất khi K=3; đủ bệnh dưới rank 200; phân biệt missing/error/0 |
| 1 | Mã tỉnh không đồng nhất | `services/area_service.py`, `routers/areas.py`, importer khi được phép sửa | Chuẩn hóa lookup hoặc chấp nhận alias legacy khi đọc; không cần ghi sửa DB thật để có compatibility | Canonical `75` và legacy Đồng Nai trả cùng totals; regression cả 10 tỉnh; không lấy lẫn vùng |
| 1 | Nhãn Cao gây hiểu sai | `routers/areas.py`, `ParentDiseaseCard.tsx` và API metadata | Không gán forecast toàn quốc/qua tuổi/stale cho nhãn khu vực hiện tại; tách rõ nguồn/kỳ. Nếu chưa có risk khu vực hợp lệ, trả unavailable thay vì gán Cao | Stale 05/2025, tỉnh khác, tuổi khác, 0/null/error; không suy ra risk cá nhân |
| 2 | Import guidance không có FK, overwrite/dedupe âm thầm | `models.py`, `services/import_service.py`, public schema — chỉ khi có task cho phép | Trước mắt thêm validate uniqueness và preview warnings; cân nhắc ID field dưới task migration riêng, không tự migrate trong audit | Duplicate 312→311 phải nói rõ; partial import không âm thầm xóa; rollback file lỗi; chỉ dùng DB test ngoài repo |
| 2 | Parent đang mở giữ guidance cũ | `ParentPortal.tsx`, public endpoint | Refetch/invalidate guidance khi có version đổi hoặc khi người dùng refresh; đưa lỗi tải ra trạng thái riêng; trả source thật nếu cần provenance | Import/cập nhật ở Admin rồi Parent refresh; không hiện nội dung cũ sau fail; request race |
| 2 | Catalog ID19/A49/H54; dấu †/* | DS-MaBenh và `data_processing_service.py` | Chủ sở hữu xác nhận collision; thống nhất normalize importer cho tương lai, không sửa model/catalog deploy tự động | Data validation ID→report block; B02.2/B02.2†; tổng mapping/unknown trước-sau trong DB copy |

Không đề xuất xây lại hệ thống, redesign, thay model hoặc retrain. Không yêu cầu bỏ cảnh báo hay bỏ pediatric safety gate để tăng số lượng Medical Knowledge.

## Bằng chứng và kiểm thử

- `inventory.json`: schema/counts, không có thông tin nhận diện bệnh nhân.
- `analysis.json`: đối chiếu 311 guidance, hai tỉnh/hai nhóm, catalog/forecast/medical counts.
- `guidance_mapping_all_groups.json`: 311 kết quả match, candidate IDs và exact expected ID.
- `deep_analysis.json`: source hashes/tổng hợp, mã tỉnh, signature guidance, publication reader không queue.
- `supplement.json`: duplicate Excel, mapping ký hiệu ICD, ID19 collision, safety gating, metadata server đồng thời.
- `baseline.json` và `closure.json`: hash trước/sau source/model/DB/`.env`, hash git diff/index. Không chứa nội dung `.env`.
- Tests hiện có: `ParentPortal`, `WeatherAIResults`, `publishedMedicalKnowledge`, Parent visibility settings và Settings visibility: **5 files / 87 tests PASS**. Không sửa tests hoặc ứng dụng.
- Không chạy backend integration tests có ghi DB, không tạo DB test, không retrain hoặc suy diễn UI đẹp/đúng từ unit tests.

Các điểm source chính đã kiểm tra: `ParentPortal.tsx:43,51,204,374,396`; `lib/disease.ts:75`; `ParentDiseaseCard.tsx:122,221`; `routers/areas.py:39,51,87,187,228`; `routers/public.py:50,64,84`; `services/import_service.py:162,232,456`; `data_processing_service.py:119,213,274`; `published_medical_knowledge_read_service.py:46,105,109,194`; `auto_medical_knowledge_service.py:750`; `src/data_pipeline.py:90,171,221`; benchmark LightGBM: dòng 712.

## Safety closure

| Kiểm tra | Kết quả |
| --- | --- |
| Eureka source changed? | **Không do audit.** Hash mọi file trong Frontend/src, backend app/migrations và tracked diff giữ nguyên. Chỉ thêm thư mục audit này chứa script/báo cáo/evidence. |
| Graduation changed? | Không truy cập hoặc sửa. |
| Real DB changed? | **Hash toàn file khác baseline trong thời gian audit.** Không thể xác nhận toàn DB bất biến. Tất cả kết nối audit read-only, total_changes=0 và không gọi queue/auth endpoint. Server uvicorn đã chạy sẵn; thời gian DB mtime khớp `login_sessions.last_seen_at` cập nhật, phù hợp với side effect `security.py:78` của phiên đang hoạt động. Không khẳng định đã chứng minh đây là thay đổi duy nhất. |
| Các bảng dữ liệu đang audit? | Counts patient/monthly/guidance/catalog/medical/jobs vẫn bằng inventory; snapshot không phải transaction toàn hệ thống được freeze. Không dừng server hay khôi phục DB. |
| Test DB changed? | Không tạo/ghi DB test. |
| Model changed? | Không. Hash model/deployment giữ nguyên. |
| `.env` changed? | Không. Hash giữ nguyên, không xuất secrets. |
| Training performed? | Không. |
| External network used? | Không do audit. Không gọi weather/PubMed/WHO/LLM hoặc GitHub; chỉ source/file/DB local và tests mock. Hoạt động độc lập của server đang chạy không thuộc kiểm soát audit. |
| Git index changed? | Không, hash index diff giữ nguyên. |
| Commit/push performed? | Không. |

**DỪNG:** đã xác định nguyên nhân và đề xuất hướng sửa tối thiểu. Chưa tự sửa code, Excel, database, trạng thái duyệt hoặc model.
