# EUREKA — Final Parent Data Flow & Guidance Correctness Fix

Ngày: 24/10/2026. Kết luận code: **PASS_WITH_FINDINGS**.

Workspace: `D:\OS_C\Bài học trên trường\Thực tập\Fullstack_2\ThucTap-main`.
Branch: `feature/medical-knowledge-v1-20260820`; HEAD: `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`.
Working tree đã có nhiều thay đổi trước task; đối chiếu baseline riêng, không coi toàn bộ `git diff HEAD` là thay đổi của task này.

## A. Luồng Weather AI

- Parent không còn gọi `/api/areas/local-risks` hoặc `/api/areas/recommendations`; đã bỏ state, reset, helper join, props và UI phụ thuộc hai API này.
- Giữ `/api/areas/provinces` để tra danh mục địa lý/tọa độ, không dùng số lượt bệnh. Giữ định vị GPS và chọn địa điểm thủ công.
- Payload dự đoán vẫn chỉ gồm `age_group`, `gender`, `top_k`, `latitude`, `longitude`, `timezone`; không thêm `province_code`, tên tỉnh, địa chỉ bệnh nhân hoặc lượt bệnh viện.
- Không thay backend ranking vì code hiện tại đã đúng: tính score 221 model → áp dụng visibility → stable score order → lấy K. Không có bước điều chỉnh theo tỉnh hoặc Forecast AI trong luồng Parent sau sửa.
- Test actual runtime với cùng thời tiết/ngày/tuổi/giới và hai tọa độ khác nhau cho cùng mảng 45 features và cùng ID/rank/score. Test K=3/5/10 so trực tiếp với score model; test đồng điểm giữ thứ tự manifest. Feature order/H14 không đổi.
- Đổi địa điểm, tuổi, giới tính hoặc số nhóm bệnh vẫn xóa kết quả cũ; stale-response protection giữ nguyên. Thiếu tọa độ, từ chối GPS hoặc dự đoán lỗi không fallback sang dữ liệu bệnh viện.

## B. Kết quả Parent

Không còn “Khu vực ghi nhận”, số ca địa phương, kỳ thống kê, badge “Dữ liệu khu vực: Cao/Trung bình/Thấp”, badge tỉnh trong kết quả hoặc panel khuyến nghị theo tỉnh. Tên tỉnh vẫn xuất hiện ở bộ chọn vị trí lấy thời tiết.

Giữ thứ tự API trả về, một disease card mỗi lần, Trước/Tiếp, trạng thái rỗng khi không có nhóm đủ điều kiện, SHAP, guidance và Medical Knowledge độc lập. Giữ Nunito, banner gradient, hình thời tiết và bố cục nhập trái/kết quả phải; không sửa CSS/font/spacing. Chỉ bỏ vùng dữ liệu địa phương và thông báo chung trùng lặp; giữ một lưu ý chung ngắn về giới hạn kết quả.

## C. Guidance

Thêm `findUniqueDiseaseKnowledge`: chuẩn hóa Unicode NFD, dấu tiếng Việt/đ, hoa-thường và khoảng trắng; so **toàn bộ tên nhóm bệnh** với `disease_knowledge.disease_group`. Chỉ nhận đúng một bản ghi. Không dùng title, substring, token fuzzy, record đầu tiên hoặc `disease_knowledge.id` làm model ID. Không tìm được hoặc trùng tên chuẩn hóa → không mượn hướng dẫn bệnh khác; hiển thị chưa có hướng dẫn phù hợp.

Triệu chứng, prevention và warning signs vẫn lấy từ response DB; giữ cách tách văn bản hiện có, không thêm lời khuyên chuyên biệt. `fuzzyMatch` cũ vẫn dùng cho tìm kiếm địa điểm, không còn dùng để ghép guidance Parent.

| Disease ID | Knowledge row đúng | Kiểm chứng |
| --- | ---: | --- |
| 105 — Suy dinh dưỡng | 109 | Unit + Parent render + DB read-only |
| 152 — Bệnh tim khác | 117 | Unit + Parent render + DB read-only |
| 11 — Phong | 13 | Unit + Parent render + DB read-only; ID này không thuộc 221 model deploy |
| 265 — Dị dạng bẩm sinh khác | 217 | Unit + Parent render + DB read-only |

`readonly_contracts.json`: catalog 311 dòng và guidance 311 dòng hiện khớp duy nhất **311/311**, thiếu 0, mơ hồ 0. Đây là kiểm chứng liên kết tên, không phải chứng nhận nội dung y khoa đúng. Unit tests còn kiểm tra đảo thứ tự, tên gần giống, duplicate normalized names và missing match.

## D. Excel — finding chưa sửa

Workbook đầy đủ: `huong_dan_phu_huynh_backend_mapping_ready (1).xlsx`.

| Khóa nhận diện dòng nguồn | Knowledge row | Nội dung cần nhân viên y tế sửa |
| --- | ---: | --- |
| IDNHOMICD 274 — Gãy các phần khác của chi do lao động và giao thông; audit xác minh dòng Excel 222 | 220 | Cả ba cột triệu chứng/dấu hiệu khám/phòng bệnh đang chứa hướng dẫn hô hấp/lao không phù hợp |
| IDNHOMICD 275 — Gãy nhiều xương của cơ thể do lao động và giao thông | 221 | Cùng lỗi nguồn trên |
| IDNHOMICD 269 — Lão suy | 197 | Cùng lỗi nguồn trên |

Ba nhóm **vẫn còn sai từ nguồn**. Exact matching không chữa được nội dung nguồn đã sai nhưng mang đúng tên. Không tự viết thay thế, sửa Excel, import hoặc dùng Medical Knowledge che lỗi. Dùng IDNHOMICD + TENNHOMICD để tìm dòng, không suy đoán số dòng Excel của 275/269.

Quy trình cập nhật an toàn về sau (chưa thực hiện):

1. Sao lưu/version workbook đầy đủ và DB; nhân viên y tế xác nhận nội dung mới của đúng ba nhóm.
2. Sửa ba cột `TRIEUCHUNGTHUONGGAP`, `DAUHIEUCANDIKHAM`, `CACHPHONGBENH` trong **workbook đầy đủ**, giữ các dòng khác và khóa mapping. Preview phải giải thích rõ duplicate hiện hữu 312 dòng → 311 nhóm duy nhất; không tự xử lý collision catalog ngoài phạm vi.
3. Thử importer trên DB copy cô lập ngoài repo, kiểm tra rollback, mapping, số nhóm và đối chiếu tất cả trường của **308 nhóm còn lại** không thay đổi; kiểm tra cả guidance từng được sửa thủ công trong Admin.
4. Chỉ import DB thật sau xác nhận riêng, có backup/rollback; reload/remount Parent để tải guidance mới.

**Không import workbook chỉ có ba dòng:** importer hiện xóa toàn bảng `DiseaseKnowledge` rồi insert, có thể làm mất 308 nhóm còn lại và các sửa thủ công.

Phương án giảm rủi ro tạm thời, **chỉ báo cáo, chưa triển khai**: chặn hiển thị guidance của đúng ba khóa nguồn đã xác minh, trả trạng thái chưa có hướng dẫn phù hợp; không thêm lời khuyên, không đổi ranking/SHAP/Medical Knowledge/DB. Tác động: ba nhóm không còn hướng dẫn Excel trong thời gian chờ sửa; cần quyết định riêng, không mở hệ thống duyệt mới.

## E. Kiểm thử và giới hạn

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd test -- --reporter=dot` | **PASS — 16 files, 364 tests** |
| Parent + guidance helper targeted | **PASS — 52 tests**; chạy lại helper sau sửa tên test: **8 PASS** |
| `node --test src/styles/nunito.test.mjs` | **PASS — 3 tests**, font local có glyph tiếng Việt và weight 400–700 |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run build` | **PASS**, production Vite build |
| Backend pytest tập liên quan bên dưới | **PASS — 55 tests**, 161 deprecation warnings |
| Admin handler read-only: overview, case-summary, local-risks | **PASS** về xử lý dữ liệu/shape; không phải HTTP/auth/browser E2E |
| `git diff --check` | **PASS**, chỉ có cảnh báo Git LF→CRLF |
| Parent/Admin desktop/mobile, Chrome thực tế | **NOT VERIFIED** — công cụ trả `apps=[]`, `browsers=[]`; không chụp được ảnh |

Backend command, chạy tại `seasonal_disease_backend`:

```text
.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/test_parent_weather_only_contract.py tests/test_weather_ai_parent_eligibility.py tests/test_parent_disease_visibility.py tests/test_weather_ai_release_readiness.py tests/test_published_medical_knowledge_public.py
```

Frontend tests bao phủ payload chỉ tọa độ, không gọi hai API địa phương kể cả khi chúng trả lỗi/pending, K=3/5/10 và navigation, guidance đúng ba trường, GPS/tọa độ thiếu, weather loading/error, stale results, empty result, mở/đóng SHAP/Medical Knowledge. Không dùng chúng để tuyên bố bố cục thực tế PASS.

Read-only Admin handlers trả 257.771 lượt, 52 kỳ, 236 nhóm; tổng 77 dòng thống kê tỉnh bằng overview; local-risks tỉnh 74 vẫn trả 5 dòng đúng shape. Không sửa API/statistics/Admin code, permission hay migration v018. HTTP permission/visibility regression kiểm thử bằng app test tối thiểu và DB cô lập, không qua lifecycle production.

## F. File thay đổi và file chỉ đọc

Source sửa trong task này (5 file):

- `Frontend/src/app/components/ParentPortal.tsx`
- `Frontend/src/app/components/parent/ParentDiseaseCard.tsx`
- `Frontend/src/lib/disease.ts`
- `Frontend/src/i18n/locales/vi.ts`
- `Frontend/src/i18n/locales/en.ts`

Tests sửa/thêm (3 file):

- Sửa `Frontend/src/app/components/ParentPortal.test.tsx`.
- Thêm `Frontend/src/lib/disease.test.ts`.
- Thêm `seasonal_disease_backend/tests/test_parent_weather_only_contract.py` — không sửa backend application source.

Evidence mới chỉ trong thư mục báo cáo này: `verify_safety.py`, `baseline.json`, `closure.json`, `readonly_contracts.json`, `runtime_observations.json` và báo cáo này. Không ghi đè audit cũ. Build tạo output frontend thông thường.

Các file/tài nguyên chỉ đọc, đối chiếu hoặc chạy kiểm thử chính:

- Audit cũ `weather_disease_ai_v3/parent_data_content_audit_v1/PARENT_DATA_CONTENT_AUDIT_REPORT.md` và evidence mapping hiện có.
- `Frontend/src/lib/api.ts`, `Frontend/src/app/components/ParentPortalDecor.tsx`; nhóm `weather-ai/{WeatherAIResults.tsx,WeatherAIResults.test.tsx,publishedMedicalKnowledge.ts,publishedMedicalKnowledge.test.tsx,tier1Presentation.ts}`.
- `Frontend/package.json`, `Frontend/src/styles/{fonts.css,index.css,nunito.css,nunito.test.mjs}` và font assets local; `Frontend/index.html`.
- Backend `app/{database.py,models.py,permissions.py,security.py,main.py,weather_ai_schemas.py}`; routers `public.py`, `areas.py`, `dashboard.py`; services `weather_ai_service.py`, `weather_ai_runtime.py`, `weather_ai_features.py`, `weather_ai_explanations.py`, `weather_ai_eligibility.py`, `area_service.py`, `import_service.py`, `parent_disease_visibility_service.py`.
- `seasonal_disease_backend/tests/{conftest.py,test_weather_ai_parent_eligibility.py,test_parent_disease_visibility.py,test_weather_ai_release_readiness.py,test_published_medical_knowledge_public.py}`.
- V3 deploy manifest, schema/config/category mappings/model files; `data/processed/disease_catalog.csv`, TRAIN context/split phục vụ runtime fixture; chỉ hash đối chiếu data/model còn lại, không sửa.
- `seasonal_disease_backend/database.db` qua SQLite `mode=ro` + `query_only`; không truy xuất HTTP Medical Knowledge, auth hoặc province endpoint có side effect.
- `README_RUN_FIXED.md`; skill Computer Use được đọc trước khi kiểm tra inventory trình duyệt, không tự khởi chạy app.

Giữ nguyên 221 artifacts/45 features/H14, training data, SHAP values, Medical Knowledge/review/source rules, guidance DB, bệnh nhân/địa chỉ, visibility policy, quyền, v018, Admin, font/CSS và tất cả thay đổi trước task. Baseline/closure xác nhận chỉ 8 file code/tests ở trên thay đổi trong phạm vi source được theo dõi; các thay đổi backend/Admin/font xuất hiện trong `git status` là từ trước task.

## G. Safety closure

| Câu hỏi | YES/NO và bằng chứng |
| --- | --- |
| Eureka source changed? | **YES** — 5 file frontend, thêm/sửa 3 tests như mục F |
| Graduation changed? | **NO** — không truy cập/sửa workspace Graduation |
| Real DB changed? | **YES, quan sát được** — hash toàn file và `area_provinces` khác baseline; không được tuyên bố DB bất biến. Các kết nối kiểm tra có `total_changes=0`; không chủ động chạy migration/import/lifecycle hoặc request ghi. Xem ghi chú dưới đây. |
| Test DB changed? | **YES** — fixtures DB RAM và test persistence ở tmp ngoài repo, không dùng DB Eureka làm test DB |
| Model changed? | **NO** — file hashes bằng baseline, runtime 221 models |
| Training performed? | **NO** |
| Training data changed? | **NO** — hashes trong phạm vi baseline bằng nhau |
| `.env` changed? | **NO** |
| Medical Knowledge changed? | **NO** — source/rules và hashes các bảng nội dung/job/duyệt không đổi |
| Guidance DB changed? | **NO** — 311 rows và table hash bằng baseline |
| Parent disease visibility changed? | **NO** — code/policy/config/audit thật không đổi; ghi trong fixture test không phải policy thật |
| Admin statistics changed? | **NO** đối với code và dữ liệu patient/monthly/forecast; **YES** đối với metadata `area_provinces` quan sát đồng thời, không biết chính xác cột nào từ baseline hash |
| Existing files deleted/overwritten unexpectedly? | **NO** — không xóa file; không hoàn tác thay đổi trước task |
| External network used? | **NO** — kiểm thử offline/mock, không upload dữ liệu, không gọi weather/publication production |
| Git index changed? | **NO** — hash cached diff bằng baseline; không stage |
| Commit created? | **NO** — HEAD không đổi |
| Push performed? | **NO** |

**Finding môi trường đang chạy:** trước khi kết thúc phát hiện uvicorn PID 21312 chạy sẵn với `--reload`, không `--lifespan off`; child Python PID 39660 tạo lúc 16:46:05 giờ máy. `area_provinces` có 77 dòng, `MAX(updated_at)=2026-10-24 09:46:09.820232` (phù hợp 16:46:09 UTC+7). Code `seed_default_areas` hiện có cập nhật timestamp rồi commit khi lifecycle chạy. Điều này **phù hợp giả thuyết** watcher reload khi file Python thay đổi đã kích hoạt lifecycle có sẵn; không có log ghi/audit để khẳng định chính xác toàn bộ thay đổi hoặc nguồn ghi duy nhất. Không tự dừng/restart server hay khôi phục DB để che chênh lệch.

`closure.json` xác nhận tất cả bảng được snapshot **ngoài `area_provinces`** vẫn có cùng count và SHA-256, gồm users/permissions, patient_records, monthly_statistics, forecast_results, disease_knowledge, catalog, Medical Knowledge/jobs, visibility. `login_sessions` được loại khỏi table comparison từ baseline do phiên đang hoạt động cập nhật last_seen; không kết luận bảng đó bất biến. Kiểm tra không được chạy trong snapshot toàn hệ thống đóng băng.

Vì vậy **không chứng nhận điều kiện “DB thật hoàn toàn không đổi”**. Không có câu lệnh ghi DB thật từ công cụ kiểm thử task, nhưng môi trường reload đang hoạt động là một ngoại lệ an toàn phải báo rõ, không gộp vào PASS im lặng.

## H. Kết luận

**PASS_WITH_FINDINGS về sửa code:** Parent Weather-only, không thống kê tỉnh/bệnh nhân trong kết quả; exact guidance mapping và các regression PASS; giữ model/visibility/SHAP/Medical Knowledge/Admin. Còn ba nội dung Excel sai, browser NOT VERIFIED và finding DB môi trường chạy đồng thời ở mục G. Không tuyên bố E2E PASS hoặc DB thật bất biến.

Đã dừng sau sửa và kiểm thử. Không deploy, retrain, import Excel, redesign hoặc mở phase mới.
