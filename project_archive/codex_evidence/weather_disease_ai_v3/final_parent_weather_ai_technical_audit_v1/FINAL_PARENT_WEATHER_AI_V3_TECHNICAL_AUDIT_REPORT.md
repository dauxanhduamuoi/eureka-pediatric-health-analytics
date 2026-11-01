# EUREKA — Final Parent & Weather AI V3 Technical Audit

Ngày: 24/10/2026, Asia/Bangkok. **AUDIT-ONLY — không sửa code ứng dụng/tests, dữ liệu hoặc cấu hình.**

Workspace: `D:\OS_C\Bài học trên trường\Thực tập\Fullstack_2\ThucTap-main`.
Branch: `feature/medical-knowledge-v1-20260820`.
HEAD: `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`.

## Quyết định cuối

**FAIL ở tiêu chí nghiệm thu độ tin cậy đầu vào weather cho live demo.** Có hai trường hợp lỗi kỹ thuật tái hiện được trong cùng bước validation/aggregation: mưa thiếu bị coi là 0 và thiếu giờ vẫn được coi là đủ ngày. Không phải model bị hỏng, không phải lỗi ranking theo tỉnh, cũng không phải kết luận toàn bộ guidance thất bại.

**Chưa đủ điều kiện tuyên bố “không cần sửa code tiếp”.** Phần cần sửa nhỏ nhất là kiểm tra tính đầy đủ của hourly weather trước khi tạo features; không cần đổi 221 model, 45 features, H14, SHAP, visibility hay thiết kế giao diện. Audit này không thực hiện sửa chữa và không mở phase mới.

379 frontend tests, 72 backend tests, typecheck và build hiện có đều PASS. Những tests đó chưa kiểm tra hai trường hợp thiếu dữ liệu vừa tái hiện; số lượng PASS không loại trừ BUG mới.

## 1. Trả lời trực tiếp tám câu hỏi

1. **Weather AI V3 còn bug kỹ thuật thật không?** Có, ở bộ nhận/kiểm tra dữ liệu thời tiết, xem W01/W02. Registry nạp đúng 221 model, manifest/checksum được xác minh; chưa thấy bug mới trong tính score, stable ranking, filter-before-K hoặc thứ tự 45 features.
2. **Parent còn sai nghiệp vụ không?** Không thấy hồi quy của nghiệp vụ đã chốt: vị trí chỉ dẫn tới tọa độ lấy weather; không gọi local-risks/recommendations, không ghép số ca bệnh viện, không dùng address/Forecast AI để thay đổi thứ hạng. Input weather không đủ vẫn có thể lọt tới kết quả do W01/W02 ở backend.
3. **Weather và feature builder ổn không?** Công thức/ngày/cửa sổ/order đúng trên dữ liệu đầy đủ; validation dữ liệu thiếu chưa đủ an toàn. Live Open-Meteo **NOT VERIFIED** vì không gọi Internet.
4. **Có nguy cơ hiển thị sai nhóm/giải thích/hướng dẫn không?** Chưa thấy lỗi ghép mới: SHAP theo đúng disease ID; guidance exact full-name duy nhất; Medical Knowledge exact selector. Vẫn có ba nội dung Excel sai đã biết, và weather thiếu có thể tạo features sai dù disease ID mapping vẫn đúng.
5. **Có thao tác DB không mong muốn không?** Có các side effect sẵn có phải tính đến: startup migration/seed/job recovery/worker, GET province có backfill+commit, đọc Medical Knowledge có thể tăng demand/tạo job. Audit không kích hoạt các đường ghi này trên DB thật.
6. **Có lỗi quyền/rò dữ liệu public không?** Chưa tìm thấy bypass quyền visibility hoặc response Parent lấy patient address/PII trong đường source/schema và smoke tests đã kiểm tra. Không phải chứng nhận pentest toàn hệ thống. API nội dung public được thiết kế anonymous; cơ chế enqueue public là finding tài nguyên/ghi DB, không phải quyền sửa visibility.
7. **Điểm nào chỉ là giới hạn khoa học?** Score không phải xác suất cá nhân; SHAP không chứng minh nhân quả hay mức nguy hiểm. Train chủ yếu từ TP.HCM, chưa có bằng chứng kiểm chứng toàn quốc trong audit. Weather ngày D có thể gồm giờ dự báo trong chính D, không phải toàn bộ quan trắc đã xảy ra.
8. **Cần sửa tiếp hay dừng?** Cần xử lý tối thiểu W01/W02 trước khi chốt live-weather demo có xử lý dữ liệu thiếu đáng tin cậy. Không cần xây lại hệ thống. **Dừng audit tại đây; không tự sửa code.**

## 2. Bảng vấn đề và quyết định trước demo

| Vấn đề | Bằng chứng | BUG/FINDING/LIMITATION | Ảnh hưởng Parent/Model/DB | Có cần sửa trước demo? | Cách sửa nhỏ nhất — chưa thực hiện |
| --- | --- | --- | --- | --- | --- |
| **W01 — Mưa thiếu thành 0** | 168 hourly rows, cả `rain` và `precipitation` đều null; builder vẫn tạo đủ 45 số hữu hạn, rain/precipitation 7d=0, trả 5 predictions. `weather_probes.json` | **BUG** | Parent có thể nhận ranking từ dữ liệu giả “không mưa”; artifacts model/DB không hỏng | **Có**, nếu dùng weather live và cần xử lý null đúng | Chặn null/missing bắt buộc trước aggregation; không để sum all-null thành 0. `sum(min_count=1)` chỉ là một phần, vẫn phải kiểm coverage/partial missing |
| **W02 — Có ngày nhưng thiếu giờ vẫn được nhận** | Chỉ giữ một timestamp mỗi ngày trong 7 ngày: 7 rows vẫn được nhận, rain 7d=14 thay vì 336 ở fixture đầy đủ, vẫn trả 5 predictions | **BUG** | Features mưa/min/max/mean có thể sai mà không báo lỗi; không đổi model hoặc DB | **Có**, cùng bản sửa validation W01 | Validate hourly coverage, khoảng cách thời gian và giá trị bắt buộc cho D−6…D theo timezone; Parent `Asia/Ho_Chi_Minh` cần đủ 24 giờ/ngày; không dùng partial day âm thầm |
| **W03 — “Hiện tại” là aggregate cả ngày D** | `/v1/forecast`, `past_days=6`, `forecast_days=1`; không cắt theo giờ hiện tại. Fixture D nửa đầu 20°C/nửa sau 40°C → feature current=30°C | **FINDING / LIMITATION** | Banner/giải thích không phải nhiệt độ tức thời; trong D có thể có forecast hours chưa xảy ra | Cần trình bày đúng khi demo; không cần thay feature contract | Nói rõ daily aggregate ngày D gồm phần dự báo nếu chưa hết ngày; không tự cắt giờ/chuyển D−1 vì sẽ đổi ngữ nghĩa input đã khóa |
| **R01 — Startup/`--reload` có side effect DB** | `main.py:lifespan` gọi create_all, migrations v002…v018, seed, recover jobs, workers; uvicorn PID 14512 đang chạy `--reload`, không `--lifespan off` | **FINDING**, đã biết và vẫn tồn tại | Reload có thể ghi DB/tạo hoạt động nền; không phải lỗi model | **Có về cách vận hành** nếu demo phải giữ DB ổn định | Dùng quy trình demo đã có: schema chuẩn bị sẵn, không reload, `--lifespan off` khi phù hợp; không tự chạy/restart server trong audit |
| **R02 — GET danh mục vị trí không thuần đọc** | `area_service.py:252–276`: `get_province_options → fill_known_province_coordinates`, commit khi thiếu tọa độ | **FINDING**, đã biết | Mở Parent có thể backfill DB nếu metadata thiếu | Kiểm tra metadata sẵn có trước demo; không có bằng chứng hiện tại cần backfill | Chuẩn bị metadata có kiểm soát trước demo; nếu có task sửa sau, tách backfill khỏi GET. Audit không gọi endpoint này |
| **M01 — Đọc Medical Knowledge có ghi demand/job** | Public dependency inject queue; `read_batch:105 → enqueue_selectors`; demand tăng trước khi skip job READY. DB settings hiện enabled=1, `REVIEWED_WITH_AUTO_FALLBACK` | **FINDING**, thiết kế hiện hữu | DB có thể ghi dù chỉ xem kết quả; worker dùng tài nguyên. FE không chờ Tier 2 để hiện ranking | Cần biết rõ khi demo/đặt yêu cầu “DB không đổi”; chưa đo production queue latency | Không gọi đường này trong audit DB thật; mô tả rõ chế độ demo. Không hạ gate, đổi worker hoặc tự tắt setting |
| **D01 — Hướng dẫn chạy/demo chưa đồng bộ** | README root còn mô tả forecast `.pkl`/correlation cũ và tài khoản mẫu; backend README còn `/api/public/current-risks`; README_RUN_FIXED/deploy README còn nói visibility ở Settings, có lệnh reload ở phần cũ | **FINDING** tài liệu | Dễ mở sai chức năng/khởi động chế độ ghi DB; không chứng minh Parent đang dùng model cũ | **Nên đồng bộ trước demo** | Chỉ cập nhật runbook cho V3, menu AI thời tiết và tài khoản hiện hữu; không tự tạo admin, migrate hoặc retrain. Chưa sửa tài liệu |
| **G01 — Guidance nguồn 274/275/269** | Hash `disease_knowledge` vẫn bằng đợt exact-mapping audit; lỗi nội dung từ Excel đã chứng minh trước | **FINDING nguồn đã biết**, không phải lỗi mapping/model mới | Ba nhóm có thể hiện hướng dẫn nguồn không phù hợp; không kết luận 311 nhóm đều sai | Cần người phụ trách dữ liệu xác nhận trước khi giới thiệu như hướng dẫn y khoa đã đúng | Sửa workbook đầy đủ sau xác nhận, thử trên DB copy; tuyệt đối không import file chỉ ba dòng |
| **S01 — Khả năng khái quát/scientific semantics** | Runtime disclaimer/metadata nói relative score, lịch sử TP.HCM; UI không tuyên bố validation toàn quốc; Parent không render riêng `runtime_weather_note` | **LIMITATION** | Chưa có xác suất cá nhân/nhân quả/độ nặng hay kiểm chứng toàn quốc | Không cần đổi model trong task này | Demo đúng giới hạn; không tự tuyên bố hiệu quả hoặc kiểm duyệt y khoa chưa có |
| **V01 — Browser/live provider chưa nghiệm thu** | Computer Use dừng do không xác định được URL hiện tại đủ chắc chắn; không gọi Open-Meteo thật | **LIMITATION / NOT VERIFIED** | Không có bằng chứng browser desktop/mobile hoặc live provider E2E PASS | Không được ghi E2E PASS | Kiểm tra thủ công có kiểm soát riêng; không tiếp tục automation sau khi bị dừng |

## 3. Bằng chứng tái hiện W01/W02 — offline, không DB/network

File/hàm: `seasonal_disease_backend/app/services/weather_ai_features.py`:

- `_hourly_frame`, dòng 81: kiểm tra tên cột, timestamp trùng, numeric coercion; chưa xác minh đủ giờ hoặc chặn null tại từng trường bắt buộc.
- `_daily_from_hourly`, dòng 107: pandas `sum` của cột rain/precipitation toàn NaN cho ra 0; mean/min/max cũng có thể bỏ qua giá trị thiếu.
- `_weather_feature_frame`, dòng 171: chỉ kiểm tra chuỗi **ngày** liên tục, không biết mỗi ngày có đủ hourly coverage.
- `_select_from_daily`, dòng 229 và `prepare`, dòng 315: chỉ phát hiện missing/nonfinite còn lại sau aggregation; giá trị 0 giả đã là hữu hạn nên không bị chặn.

Cách tái hiện:

1. Tạo response Open-Meteo giả đủ 168 giờ của 7 ngày, đầy đủ cột required. Mỗi giờ rain=2 mm và precipitation=2 mm; các trường khác hợp lệ.
2. Patch `app.services.weather_ai_features.urllib.request.urlopen` bằng response local trong RAM; không gọi Internet. Chạy builder và runtime hiện tại.
3. Control đầy đủ: rain 3d=144 mm, rain 7d=336 mm. W01: thay hai mảng rain/precipitation bằng `[None] * 168` → không exception, rain/precipitation 7d=0, rain_days_7d=0, vẫn có 5 predictions.
4. W02: từ control giữ `values[::24]` của mọi field, chỉ còn 7 giờ nhưng trải đều 7 ngày → không exception, rain 7d=14 mm, vẫn có 5 predictions.

Đây là lỗi chấp nhận dữ liệu không đầy đủ, **không khẳng định Open-Meteo live đang trả hai payload lỗi đó**. Chưa tuyên bố thứ hạng nhất thiết đổi trong mọi input; chứng minh được features đã sai và runtime vẫn dự đoán. Lỗi đủ liên quan trực tiếp để chưa chốt validation PASS.

## 4. Những phần được xác nhận hoạt động

### Model/ranking và weather đủ dữ liệu

- Registry xác minh checksum/size/order của đúng **221 LightGBM boosters**, feature schema/manifest đúng **45 features**, category mapping không đổi; horizon **H14**. Không retrain hay nghiên cứu lại hiệu quả mô hình.
- Tính score của 221 nhóm rồi lọc disabled IDs, sort stable giảm dần, lấy K. Các tests xác nhận K=3/5/10, stable ties, zero enabled, disabled không xuất hiện và không lấy lượt bệnh viện làm tie-break.
- H14 theo thiết kế là D…D+13, không mặc định “14 ngày bắt đầu từ ngày mai”.
- Input demographic/calendar gồm age_group, gender, month, season, sin/cos ngày trong năm, cộng 39 weather features. Tọa độ không nằm trong mảng features. Test cùng weather/date/input, khác tọa độ hoặc tên timezone tương đương vẫn cho features/score/order nhất quán.
- Request Open-Meteo dùng lat/lon đã chọn, timezone `Asia/Ho_Chi_Minh`, hourly nhiệt độ/độ ẩm/precipitation/rain/weather_code/wind_speed/wind_gust, `past_days=6`, `forecast_days=1`, timeout 15s.
- Ngày D lấy từ ngày cuối của payload; current=D, 3d=D−2…D, 7d=D−6…D, rolling trailing không lấy D+1…D+13 làm features. Không thấy đường đọc patient address/local cases/Forecast AI/Count V2 trong feature builder/ranking.
- Fixture đủ dữ liệu cho current temperature=30°C, mean 3d=16.666667°C, mean 7d=12.857143°C; kiểm tra đối chiếu pipeline khóa hiện có PASS.
- Không gọi archive API; “past_days” lấy qua forecast endpoint, không được mặc định toàn bộ là dữ liệu quan trắc trạm đã xác nhận. Không kiểm chứng chất lượng/units/độ tươi provider live trong audit offline. Anchor tự chọn ngày cuối payload, không có kiểm tra freshness theo clock; fixture lịch sử được dùng có chủ ý, không phải bằng chứng hôm nay provider stale.
- Payload thiếu hẳn field hourly/empty hourly bị ValueError; lỗi provider bị RuntimeError. Router map lỗi input thành 422, model unavailable 503, lỗi runtime bất ngờ thành 500 thông báo chung. Parent có loading/error/reset, không fallback số ca địa phương. **Những nhánh đó không khắc phục W01/W02.**

### Parent và giải thích

- Source hiện tại chỉ gọi province catalog, weather options, DB guidance, parent-risk và optional published Medical Knowledge. Không gọi `/api/areas/local-risks` hoặc `/api/areas/recommendations`.
- Input tuổi/giới/số nhóm/vị trí đổi thì reset card, weather, navigation và invalidate request IDs; response cũ không đè request mới; optional Tier 2 lỗi/chậm không chặn ranking.
- Một card mỗi lần; navigation theo **số row thực nhận**, không theo K yêu cầu. Tests có K=5 nhưng chỉ 1/2 kết quả, cũng như 0 enabled, xác nhận không out-of-range và nút Trước/Tiếp đúng.
- SHAP lấy disease ID đang dự đoán, dấu contribution được giữ; grouping MIXED không đổi thành UP/DOWN một chiều; explanation và note nói rõ không phải quan hệ nhân quả. Chuyển card reset disclosure và không đổi raw SHAP arrays trong test.
- Guidance chỉ nhận exact normalized full-name duy nhất. Cases 105→109, 152→117, 11→13, 265→217 PASS; missing/ambiguous không mượn bệnh khác. Table hash hiện tại bằng baseline của đợt đã đối chiếu đủ 311/311, nên không chạy lại audit workbook/patient data rộng.
- Guidance vẫn đọc symptoms/prevention/warning_signs từ DB; không hard-code lời khuyên chuyên biệt. Rủi ro `splitText` tách dấu gạch nối là finding cũ; không có bằng chứng mới gây sai nội dung cụ thể nên không nâng thành bug mới.

### Medical Knowledge, quyền và privacy

- Selector từ positive SHAP gồm disease ID + factor_type/key/value; AGE giữ nhóm tuổi cụ thể, WEATHER dùng mapping chuẩn; backend lookup exact selector, không lấy bệnh/tuổi khác làm fallback.
- Reviewed chỉ hiển thị publication/revision nhất quán, APPROVED, parent_display_allowed, evidence/source/pediatric safety đủ điều kiện; Auto giữ nhãn AUTO, trạng thái tự động/chưa kiểm duyệt và nguồn đúng revision. Không đổi gate để tăng số nội dung.
- 72 backend tests bao gồm sai topic pointer, wrong source ownership, malformed/draft/unpublished content, bounded selectors, no private fields và missing medical KB không làm hỏng ranking. Frontend tests xác nhận nguồn/labels/selector/stale-response và không hiển thị content bệnh khác.
- Đọc production qua queue có thể ghi DB ngay cả khi Auto READY đã tồn tại; external discovery/generation diễn ra ở worker, không đồng bộ trong ranking request. Hiện có 261 jobs: 23 READY, 233 INSUFFICIENT, 5 FAILED. Không đồng nhất số jobs với số nhóm có kiến thức hiển thị.
- Chưa đo thời gian queue/worker trên DB thật, không khẳng định không có contention. FE request Tier 2 chạy riêng nên ranking đã nhận có thể hiển thị ngay; lỗi Tier 2 làm thiếu nội dung phụ, không thay thứ hạng.
- Visibility Admin/Staff đủ quyền hoạt động; Staff thiếu `feature.parent_disease_visibility` bị chặn tại menu/URL/page và GET/PATCH API. Không tự cấp quyền hoặc bật/tắt nhóm.
- Parent response/source không truy vấn PatientRecord; smoke response không có patient_id/name/address/province_code/local/forecast count keys. Medical/guidance public views chỉ serialize nội dung kiến thức/schema được kiểm tra, không bệnh án. Đây là kiểm tra scoped của đường Parent, không phải kiểm toán PII toàn bộ nội dung free-text hoặc pentest mọi API.
- Menu AI thời tiết hiện có mục con **“AI thời tiết”**, visibility và Medical Knowledge; nhãn “Tổng quan AI thời tiết” trong báo cáo menu cũ là lịch sử trước task đổi tên. Route `?section=weather-risk` và route Medical Knowledge không đổi; full frontend navigation regression PASS.

## 5. Smoke performance và kiểm thử

Smoke nhỏ với response weather giả lập trong RAM, 221 model thật, Top 5, SHAP thật; không lifecycle/DB/provider thật:

- Model load + service init: **617.918 ms**.
- Hai lượt healthy: tổng runtime **165.566 / 229.579 ms**, riêng scoring 221 models **126.598 / 188.304 ms**.
- Cả 5 kết quả có Tier 1, input lặp cho cùng ID/score/order.
- Không bao gồm network Open-Meteo, publication queue, HTTP production hoặc cold browser; không phải benchmark/SLA hay chứng nhận latency demo ngoài mạng.

| Kiểm tra | Kết quả |
| --- | --- |
| `npm.cmd test -- --reporter=dot` | **379 PASS / 17 files** |
| Backend tập runtime/API/visibility/Medical Knowledge liên quan | **72 PASS**, 161 deprecation warnings |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run build` | **PASS**, 2313 modules |
| Offline healthy feature windows và inference smoke | **PASS** trong điều kiện fixture đầy đủ |
| Offline weather thiếu/null/thiếu giờ | **FAIL validation kỳ vọng**, tái hiện W01/W02; không thêm tests vào source |
| Live Open-Meteo | **NOT VERIFIED**, không external request |
| Browser Parent desktop/mobile | **NOT VERIFIED**, Computer Use bị dừng bởi kiểm tra URL/policy trước khi điều khiển trang |

Backend command tại `seasonal_disease_backend`:

```text
.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/test_weather_ai_runtime.py tests/test_weather_ai_release_readiness.py tests/test_weather_ai_api.py tests/test_weather_ai_parent_eligibility.py tests/test_parent_disease_visibility.py tests/test_parent_weather_only_contract.py tests/test_published_medical_knowledge_public.py
```

Đã dùng tests hiện có, không tạo hàng loạt tests hoặc sửa fixture để làm PASS. Một probe ban đầu lỗi encoding console khi in tiếng Việt; chạy lại xuất JSON ASCII thành công, không phải lỗi ứng dụng.

## 6. Browser và giới hạn xác minh

Chrome có native window nhưng không có browser-tab connector. Theo skill **Computer Use**, đã chọn đúng cửa sổ New tab, chưa navigate trang production. Lệnh quan sát/activation bị công cụ dừng vì không xác định được URL hiện tại đủ chắc chắn để enforce policy. Đã dừng mọi UI input, không thử bypass.

Một HTTP server chỉ bind `127.0.0.1` được chuẩn bị trong RAM để phục vụ build với weather giả lập, guidance chỉ đọc và Medical Knowledge rỗng; không forward API production. Chưa truy cập được trang này qua automation, nên **không có UI PASS/screenshot**. Đã tắt đúng process của server giả lập qua identity+port check; không dừng/restart uvicorn đang chạy của người dùng. Không có browser E2E PASS suy ra từ jsdom/build.

## 7. Safety closure

Evidence mới chỉ nằm trong `weather_disease_ai_v3/final_parent_weather_ai_technical_audit_v1/`:

- Báo cáo này.
- `weather_probes.json`: fixture/results/timing/error paths, không bệnh án.
- `safety_closure.json`: before/after hashes và số lượng tổng hợp.

Đã đọc đủ ba báo cáo được yêu cầu và đối chiếu source hiện tại: ParentPortal/card/helper/selectors/SHAP UI; runtime/features/explanations/public router/visibility; Medical read/queue/repository/schema; main lifecycle/area service; README root, backend, runbook, V3 và deploy. Không đọc lại toàn bộ workbook bệnh nhân hoặc tái nghiên cứu training/evaluation đã chứng minh trước.

| Safety item | Kết quả |
| --- | --- |
| Source/tests changed? | **NO** — hashes của 493 file trong phạm vi snapshot không đổi; chỉ thêm báo cáo/evidence. `Frontend/dist` được build lại bình thường, không deploy |
| Real DB writes do audit? | **NO** — mode=ro + query_only; cả ba số `total_changes` kiểm tra đều 0; không gọi endpoint production, import, migration hoặc lifecycle |
| Real DB toàn file changed? | **YES**, hash khác trong khi server chạy sẵn; **32 bảng được snapshot giữ nguyên count/SHA-256**. `login_sessions` loại từ đầu vì cập nhật last_seen; không khẳng định toàn DB bất biến hoặc đã chứng minh mọi nguồn ghi. Không restore DB |
| Test DB changed? | **YES**, chỉ fixtures RAM và tmp cô lập ngoài repo; không dùng DB thật làm test DB |
| Model/training data changed? | **NO** — baseline hashes không đổi, manifest verified; không retrain |
| Graduation changed? | **NO**, không truy cập/sửa workspace đó |
| `.env` changed? | **NO**, chỉ hash, không xuất secrets |
| Visibility/Medical Knowledge/Excel changed? | **NO**, source/policy/bảng thật giữ nguyên; không bật/tắt hoặc sửa nội dung |
| External network/data upload? | **NO** do audit. Chỉ loopback server giả lập đã dừng; hoạt động độc lập của server/Chrome đang chạy không thuộc kiểm soát audit |
| Git index/HEAD changed? | **NO**, cached diff hash và HEAD bằng baseline |
| Commit/push/reset/stash/clean/restore? | **NO** |

Snapshot không phải một transaction đóng băng toàn hệ thống đang chạy. Không suy ra DB tuyệt đối bất biến chỉ từ kết nối audit read-only.

## 8. Nhắc lại Excel và dừng

ID **274, 275, 269** còn nội dung nguồn chưa phù hợp; không viết thay thế hoặc import trong audit. Sau khi có nội dung được nhân viên y tế xác nhận, sửa **workbook đầy đủ**, thử trên DB copy ngoài repo, đối chiếu 311 nhóm và bảo toàn 308 nhóm khác trước khi xin phép import thật. Importer hiện xóa toàn bảng guidance rồi insert: **không import file chỉ ba dòng**.

**Kết luận FAIL cho bước nghiệm thu weather-input robustness, không phải toàn bộ hệ thống FAIL.** Happy path/runtime/ranking/guidance mapping/permission regressions PASS; chỉ cần bản sửa validation nhỏ và đồng bộ cách chạy/tài liệu, không redesign hoặc retrain. Không tuyên bố đủ điều kiện dừng phát triển khi W01/W02 chưa xử lý. **Audit đã dừng; chưa sửa code hoặc DB.**
