# Eureka — Audit end-to-end Weather AI V3 SHAP

Ngày kiểm tra: 25/10/2026. Phạm vi: SHAP của Weather AI V3 từ feature builder tới Parent. **AUDIT-ONLY, không sửa code ứng dụng.**

**Kết luận: FAIL ở tiêu chí giải thích end-to-end.** Phép tính SHAP, additivity, serialization và gắn disease ID đạt kiểm tra. Tuy nhiên, có bug làm mất chiều đối nghịch khi nhóm, chọn yếu tố chính thiên về phía dương, tóm tắt không nhất quán và câu chữ khẳng định thay đổi thứ hạng vượt quá điều SHAP chứng minh. Audit đã hoàn thành; các bug được giữ nguyên theo yêu cầu chưa sửa code.

## A. SHAP đang tính gì?

SHAP ở đây phân rã đầu ra của **một model bệnh cụ thể**, với tuổi/giới và thời tiết của một context. Nó không phân rã thứ hạng tương đối giữa 221 model, không phải số ca bệnh, xác suất mắc bệnh cá nhân hay tác động nhân quả.

| Bước | Source/hàm | Kết quả đã xác minh |
| --- | --- | --- |
| Input Parent | `Frontend/src/app/components/ParentPortal.tsx:353`, `run` | Gửi tuổi, giới, top_k, tọa độ, timezone. Vị trí dùng lấy weather; không gửi địa chỉ bệnh viện/thống kê tỉnh để xếp hạng. |
| Feature builder | `seasonal_disease_backend/app/services/weather_ai_features.py:380`, `prepare` | 6 demographic/calendar + 39 weather = 45 cột đúng manifest. Categorical age/gender/season được encode; giải thích giữ giá trị gốc. |
| Daily/window | Cùng file, `_daily_from_hourly:158`, `_weather_feature_frame:222`, `_select_from_daily:284` | CURRENT = aggregate toàn ngày D; 3D = D−2..D; 7D = D−6..D. Không cắt forecast của ngày D, không đổi W01/W02. |
| Điểm model | `weather_ai_runtime.py:215`, `predict_scores` | Chấm đủ 221 model, dùng `Booster.predict` mặc định; binary sigmoid:1. |
| Raw SHAP | `weather_ai_runtime.py:229`, `local_contributions` | LightGBM native `predict(pred_contrib=True)`/Tree SHAP, không gọi package `shap`, không dùng attribution của model khác. |
| Giải thích | `weather_ai_explanations.py:96`, `Tier1ExplanationService.explain` | Lấy 45 contributions; bỏ |φ| ≤ 1e−12; chọn tối đa 5 dương + 5 âm riêng rẽ. |
| Chọn disease | `weather_ai_service.py:154–183`, `predict` | Score 221 → visibility filter → stable descending → Top K → gọi Tier1 bằng chính disease ID của phần tử đó. |
| API | `routers/public.py:105`, `parent_risk` | Trả nguyên factor/value/sign/base/error của runtime. Thử router thật trên FastAPI cô lập với DB RAM, không dùng app.main hay DB thật. |
| Nhóm ở frontend | `tier1Presentation.ts:234`, `buildTier1DisplayGroups` | Chỉ nhìn phần factors đã qua cắt Top 5 mỗi dấu. Nhóm theo khái niệm/cửa sổ; không tính lại SHAP. |
| Parent | `ParentDiseaseCard.tsx:158–166`, `WeatherAIResults.tsx:197–222` | Tóm tắt dùng summary_vi phía backend; 3 nhóm chính lấy đầu danh sách; chi tiết render mọi nhóm nhận được, không in số SHAP. |

Đầu ra `pred_contrib` có shape **(1,46)**: 45 contributions và 1 base value. Base là expected value/bias của Tree SHAP trên raw margin của từng booster, không phải ranking_score trung bình của 221 bệnh hay một số ca nền. Các model trong mẫu có objective `binary sigmoid:1`.

Quan hệ được kiểm tra:

```text
raw_margin = base_value_raw + Σ(φ_i), i = 1..45
ranking_score = sigmoid(raw_margin)
```

SHAP **không** được sigmoid từng giá trị rồi cộng. φ và base có đơn vị raw margin/log-odds của model. Dấu dương/âm là hướng đóng góp so với baseline của chính model đó. Sigmoid tăng đơn điệu nên hướng đóng góp phù hợp với hướng điểm model, nhưng không chứng minh thứ hạng so với các model khác thay đổi. Không thể lấy hiệu ranking_score theo từng φ như một phân rã cộng tính trên thang probability.

Runtime kiểm tra `abs(base + sum(φ) − raw_score) ≤ 1e−6`; sai shape hoặc vượt ngưỡng sẽ báo lỗi. Service bắt lỗi Tier1, giữ ranking và trả `available=false`, factors rỗng. Frontend không mượn explanation bệnh khác. Chi tiết khi không available hiện trống; đây là giới hạn minh bạch nhỏ, không phải bằng chứng SHAP được tính thành 0.

## B. Có tính đủ 45 features không?

**Có, cho từng disease được giải thích.** Ranking chấm 221 model; SHAP chỉ được gọi cho disease đã chọn sau Top K, không tính SHAP cả 221 bệnh mỗi request.

Thứ tự được khóa bởi `feature_schema.json` và `model_manifest.json`; registry kiểm tra order/count. Bảng [ID6_45_FEATURES.md](ID6_45_FEATURES.md) liệt kê đủ 45 features theo đúng thứ tự, giá trị input, SHAP, dấu, nhóm và lý do hiện/ẩn. JSON còn lưu giá trị categorical đã encode.

Quy tắc hiện tại:

1. Backend bỏ zero và gần zero theo ngưỡng tuyệt đối `1e−12` trên raw SHAP. Không có ngưỡng tương đối theo score hay tổng đóng góp.
2. Dương sắp giảm dần φ, lấy 5. Âm sắp giảm dần |φ|, lấy 5. Đây không phải Top 10 tuyệt đối chung, cũng không phải Top N nhóm.
3. API không gửi 35 features còn lại khi đủ 10 factors; không có phần residual/other-contributions.
4. Frontend ghép **positive trước negative**, Map giữ thứ tự xuất hiện. Không sắp lại theo |φ| hay tổng quan trọng của nhóm.
5. Group age, gender riêng; month/season/sin/cos vào thời điểm trong năm; weather theo family + CURRENT/3D/7D. Rain và precipitation cùng family mưa.
6. Group có một dấu được gắn UP/DOWN; có cả hai dấu nhận MIXED. **Không dùng tổng có dấu để đặt MIXED và không yêu cầu hai phía cân bằng.** Điều này đúng cho ý nghĩa “có các đóng góp trái chiều” nếu đủ các thành viên đã tính.
7. Chi tiết không có giới hạn nhóm bổ sung. 3 nhóm chính `.slice(0,3)`; tóm tắt backend lấy tối đa 3 `label_vi` duy nhất trong positive list.

Trong fixture ID 6: **45 được tính, 40 khác zero, 10 vào API, 8 nhóm chi tiết, 3 nhóm chính.** 5 zero gồm season, precipitation_sum_current, rain_sum_current, rain_day_current, rain_sum_3d. 30 nonzero còn lại bị cắt Top 5 cùng dấu. Ở 10 disease mẫu, có 33–41 nonzero mỗi disease, đều gửi 10 factors, tạo 7–9 nhóm UI.

Zero không bị tự diễn giải là có tác động trong pipeline bình thường: backend loại trước khi đến frontend. Câu fallback “AI sử dụng để xếp hạng” ở một số nhóm thiếu mô tả chi tiết áp dụng cho factors đã được chọn, không phải tự render mọi input có φ=0. Frontend tin direction của payload; không tính lại sign.

## C. Phân loại kết quả

| ID | Phân loại | Kết quả / bằng chứng |
| --- | --- | --- |
| S01 | CORRECT | Đủ 45 contributions, đúng cột, đúng sign từng factor được gửi; additivity đúng raw scale trên 10 model mẫu. |
| S02 | CORRECT | Top 3/5/10, visibility và serialization giữ đúng disease/SHAP. Không thấy hoán đổi ID, cache explanation bệnh trước hoặc dùng thống kê tỉnh. |
| S03 | LIMITATION | Cắt 5 mỗi dấu là chủ đích rõ trong source, không phải mất số do model. Nhưng không thể từ 10 factors dựng lại đầy đủ score hoặc toàn bộ chiều của một concept. |
| S04 | BUG | Cắt trước khi nhóm có thể loại phía đối nghịch, sau đó UI khẳng định UP/DOWN cho cả concept. ID 6: Gió 7D hiện UP, trong đủ features có cả hai dấu và tổng còn âm. |
| S05 | BUG | “Yếu tố xếp hạng chính” dùng positive-first + slice(0,3), không chọn 3 nhóm quan trọng nhất. ID 6 bỏ nhóm thời điểm |φ| lớn hơn cả gió/nhiệt độ đang chọn. |
| S06 | BUG | Tóm tắt chỉ nhìn positive labels, không dùng group/direction chung với chi tiết. ID 169 nói thời điểm trong năm góp phần xếp cao hơn, chi tiết cùng payload ghi MIXED và tổng selected của nhóm âm. |
| S07 | BUG | Câu “đẩy thứ hạng lên/xuống”, “được xếp cao/thấp hơn” không được chứng minh bởi SHAP riêng từng model. Disclaimer không làm các câu này trở nên chính xác. |
| S08 | FINDING | CURRENT được gọi “hiện tại”, “cao nhất hiện tại”; giá trị thực là aggregate toàn ngày D, có thể gồm giờ forecast. Dễ bị hiểu thành đo tức thời. |
| S09 | FINDING | “Thời điểm trong năm” có thể hiện hai dòng cùng tên với hai mũi tên; số SHAP, net và full coverage không hiện. Không sai sign nhưng khó giải thích cho phụ huynh. |
| S10 | LIMITATION | Không có prediction gốc/metadata của ảnh để tái lập đúng ảnh; không thực hiện browser visual/E2E. |

### Bằng chứng ID 6: phía đối nghịch đã bị bỏ

Fixture thay thế: **1–5 tuổi, Nam, ngày D=2026-08-07, 168 giờ giả lập hợp lệ D−6..D**, cùng fixture số đã dùng cho baseline W01/W02. Không phải weather live hoặc prediction của ảnh gốc.

| Feature | Raw SHAP | Vào API? |
| --- | ---: | --- |
| wind_speed_mean_7d | +0.138080164914 | Có, Top 5 dương |
| wind_speed_max_7d | −0.171751057995 | Không, đứng sau Top 5 âm |
| wind_gust_max_7d | +0.0301808712525 | Không, sau Top 5 dương |
| temperature_min_7d | +0.131695700928 | Có |
| temperature_max_7d | −0.0582886177027 | Không |
| temperature_mean_7d | −0.0317740179729 | Không |

Gió 7D đúng là **MIXED**, tổng đầy đủ **−0.00349002182945**, trong khi UI hiển thị UP và summary nói gió làm xếp cao hơn. Nhiệt độ 7D cũng là MIXED; tổng đầy đủ +0.0416330652527 không xóa sự tồn tại của hai chiều. Hành vi này được xác nhận bằng gọi helper trình bày thật và render card với API payload thật trong jsdom.

Trong 80 nhóm UI thuộc 10 disease của cùng fixture, có **32 nhóm** mà dấu một chiều của phần đã cắt khác phân loại MIXED khi lấy đủ contributions. Đây là thống kê trên fixture này, không phải tỷ lệ lỗi của tất cả input/model.

### Bằng chứng lựa chọn “chính”

ID 6 chọn **Độ tuổi → Gió 7D → Nhiệt độ 7D**, do thứ tự positive factors. Thời điểm trong năm xuất hiện sau:

- day_of_year_cos = **−0.604980698101**; day_of_year_sin = +0.108784861728.
- Tổng |φ| hai factors gửi của nhóm thời điểm = **0.713765559829**.
- Gió 7D được gửi có |φ|=0.138080164914; nhiệt độ 7D được gửi có |φ|=0.131695700928.
- Độ ẩm 7D −0.364019548423 và gió 3D tổng |φ|=0.442901933195 cũng không nằm trong 3 nhóm chính.

Vì vậy 3 nhóm chính hiện không phải 3 nhóm lớn nhất, theo cả max |φ| hoặc tổng |φ|. Ngoài ra −0.171751057995 bị loại khỏi API dù lớn hơn một số factors dương được giữ; điều này xuất phát từ quota **5 mỗi dấu**, không phải lỗi sorting cùng dấu.

## D. Câu tăng/giảm thứ hạng có chính xác không?

**Không, nếu nói về thứ hạng tương đối giữa 221 bệnh.** SHAP giải thích margin/điểm một bệnh so với baseline riêng, không tính rank attribution hay so với 220 model khác. Dương không đồng nghĩa bệnh sẽ vượt một bệnh khác.

Đề xuất nhỏ nhất, chưa áp dụng:

| Hiện tại | Thay thế |
| --- | --- |
| Đang làm nhóm bệnh này được xếp cao hơn / Góp phần xếp cao hơn | Góp phần làm điểm mô hình của nhóm bệnh này tăng. |
| Đang làm nhóm bệnh này được xếp thấp hơn / Góp phần xếp thấp hơn | Góp phần làm điểm mô hình của nhóm bệnh này giảm. |
| Các yếu tố ảnh hưởng đến thứ hạng | Các yếu tố góp phần vào điểm mô hình. |
| Nhiều đặc điểm … tác động đến thứ hạng theo các hướng khác nhau | Các đặc điểm trong nhóm này có đóng góp làm tăng và giảm điểm mô hình. |
| Nhiệt độ hiện tại / cao nhất hiện tại | Nhiệt độ trong ngày D / nhiệt độ cao nhất trong ngày D. |

Chỉ sửa câu chữ chưa giải quyết S04: cần lấy đủ phía đối nghịch trước khi gọi cả nhóm UP/DOWN. Có thể dùng một câu dẫn ngắn “Đây là các yếu tố nổi bật được chọn để giải thích”, thay câu dẫn đang nói đẩy thứ hạng. Không cần thêm nhiều khung cảnh báo.

## E. Tóm tắt nhanh có khớp chi tiết không?

**Không được đảm bảo.** Backend `_summary` đi qua 5 dương, deduplicate theo human_label rồi lấy 3; không thấy negative hay group MIXED. Nhãn schema có thể gộp nhiều features cùng family/window, và calendar month/sin/cos còn có nhãn khác nhau trước khi frontend nhóm.

Ví dụ ID **169**: summary có “Thời điểm trong năm … xếp hạng cao hơn”. Phần mở rộng dùng cùng payload ghi MIXED cho nhóm đó; tổng selected **−0.0414321253546**. Không có dấu hiệu lấy nhầm disease: khác biệt do **hai quy tắc tạo tóm tắt**.

ID 6 còn cho thấy tóm tắt có vẻ khớp nhóm UP của UI nhưng cả hai cùng thiếu features âm bị backend loại. Không được coi sự khớp câu chữ đó là chứng minh đúng với raw SHAP đầy đủ.

## F. Có thiếu yếu tố quan trọng không?

**Có, đã đo bằng SHAP thật.** ID 6 thiếu gió mạnh nhất 7D −0.171751057995 ở API; 3 nhóm chính thiếu nhóm thời điểm/độ ẩm/gió 3D lớn hơn nhóm đang hiện. Các yếu tố không hề biến mất ở LightGBM; chúng bị lọc ở giải thích backend hoặc cắt 3 nhóm frontend.

Với ID 6:

```text
base                           = 0.8115087651344552
sum của đủ 45 contributions    = 1.6518337927259181
raw margin                     = 2.463342557860373
sigmoid(raw) / ranking_score   = 0.9215317074106136
additivity error               = 4.440892098500626e-16
sum của 10 factors gửi API     = 2.2988452484524786
sum của phần bị lược bỏ        = -0.6470114557265605
```

Base + 10 factors không bằng raw margin. API không hứa 10 factors cộng lại bằng score, nhưng không nêu coverage/residual nên phụ huynh không thấy tính chọn lọc. Tổng |φ| được giữ 5.56232357355055 / toàn bộ 6.4060226449564395; đây không phải “% nguyên nhân gây bệnh” hoặc mức tin cậy.

## Trường hợp mô tả trong ảnh, semantics và đơn vị

Không có tọa độ/ngày/response gốc hoặc ảnh thực trong attachment audit này. Không xác nhận đã tái lập prediction ảnh. Các nhóm được mô tả có thể được tạo bởi:

| Nhóm ảnh | Quy tắc |
| --- | --- |
| Độ tuổi | `age_group` |
| Thời điểm trong năm | month, season, day_of_year_sin, day_of_year_cos; hướng phụ thuộc những thành viên còn sau Top 5 mỗi dấu |
| Gió 3D | wind_speed_mean_3d, wind_speed_max_3d, wind_gust_max_3d |
| Nhiệt độ CURRENT | temperature_mean/max/min_current = daily aggregates ngày D |
| Mưa 7D | precipitation_sum_7d, rain_sum_7d, rain_days_7d, rain_max_daily_7d |
| Gió 7D MIXED | Mean/max/gust 7D, khi ít nhất một dương và một âm thực sự tới frontend |
| Nhiệt độ 7D MIXED | Mean/min/max 7D, khi ít nhất một dương và một âm tới frontend |

Gió trung bình dương nhưng gió mạnh nhất âm là hợp lệ: hai features có SHAP riêng, không phải sign của giá trị vận tốc. Tương tự, min nhiệt độ dương và max âm không mâu thuẫn toán học. Test cô lập xác nhận helper hiển thị cả hai mũi tên nếu nhận đủ hai phía; fixture model ID 6 xác nhận chính hiện tượng dấu gió/nhiệt độ đối nghịch thật.

3D/7D đúng cửa sổ bao gồm D; không phải 3/7 ngày trước D. Mean là trung bình các daily mean; max/min là cực trị daily trong cửa sổ; rain/precipitation là tổng, rain_days là số ngày daily rain>0; weather_code_current là mode ngày D. Không có rolling weather_code trong 45 cột. CURRENT không phải thời tiết tại thời điểm bấm nút. Với D có forecast, câu “hôm nay có ghi nhận mưa” của `rain_day_current` cũng có thể gợi ý dữ liệu quan trắc dù input bao gồm dự báo.

Đơn vị UI °C, %, mm, km/h nhất quán với schema sử dụng và header file lịch sử `weather_disease_ai_v3/data/raw/weather_hcm_history.csv` (dòng 4). Ngày mưa dùng đơn vị ngày; sin/cos không có đơn vị và không in số thô lên Parent. Runtime fetch hiện không yêu cầu rõ unit params hoặc kiểm tra `hourly_units`; audit offline không xác minh response live của provider, nên không chứng nhận đơn vị live từ nhà cung cấp. Không có chuyển đổi unit trong feature builder/presentation.

## G. Có cần sửa không? Đề xuất phạm vi nhỏ nhất

**Có, trước khi coi phần giải thích Parent là nhất quán. Chưa thực hiện sửa.** Không cần retrain, đổi model, ranking, feature formula/order/H14 hay W01/W02.

1. `weather_ai_explanations.py`, `Tier1ExplanationService.explain`: giữ full nonzero contributions cho nhánh trình bày trước khi cắt; bổ sung trường tương thích ngược (ví dụ `display_factors`) chứa tối đa 45 factors. Giữ danh sách positive/negative cũ và nhánh Medical Knowledge hiện có để không đổi chính sách y khoa ngoài phạm vi. Không đơn giản tăng 5 thành một số khác rồi tiếp tục nhóm thiếu thành viên.
2. `weather_ai_schemas.py` và `Frontend/src/lib/api.ts`: khai báo trường mới; giữ sign/value/feature/window gốc. Không đổi API input hoặc Top K.
3. `tier1Presentation.ts`, `buildTier1DisplayGroups`: dùng đầy đủ display factors để quyết định direction/MIXED; không dựa direction của vài đại diện. Chọn nhóm nổi bật bằng tiêu chí rõ ràng (ví dụ tổng |φ| toàn nhóm, tie ổn định); giữ cả hai hướng, không dùng net để che cancellation. Giá trị chi tiết phải lấy đúng feature, không gán sign chung cho mọi thành viên.
4. `ParentDiseaseCard.tsx`: tạo tóm tắt nhanh và 3 yếu tố chính từ cùng các group đã xếp; tránh summary positive-only mô tả cả concept MIXED. `WeatherAIResults.tsx`: dùng cùng nhóm/direction và thay các câu “thứ hạng” bằng “điểm mô hình”. `Tier1ExplanationService._summary` cũng cần bỏ khẳng định thứ hạng đối với các client còn dùng summary backend.
5. `tier1Presentation.ts`, `windowPhrase`/nhãn mixed: CURRENT nói rõ aggregate ngày D. Không thay semantics dữ liệu hoặc cắt forecast. Không thêm cảnh báo dài hay redesign.

Tests cho bản sửa sau: raw model ID 6 giữ wind/temperature 7D MIXED; ID169 quick summary khớp expanded; yếu tố âm lớn được xét khi chọn 3 nhóm; zero/near-zero không thành tác động; residual/coverage đúng nếu công khai; sign/unit/calendar/current đúng; Top 3/5/10 và visibility giữ ID/SHAP; không đổi input/ranking/Tier2. Các assertion audit hiện xác nhận bug đang tồn tại, **không** phải regression tests chứng minh bug đã sửa.

## Kiểm thử và giới hạn

| Kiểm tra | Kết quả |
| --- | --- |
| Existing backend runtime/API/eligibility | **21 PASS** |
| Existing ParentPortal + WeatherAIResults | **96 PASS** |
| Isolated presentation audit với payload thật + edge fixtures | **9 PASS** |
| Script audit model/backend, 13 nhóm assertions | **PASS**, evidence JSON |
| 10 model SHAP của fixture | 45 mỗi model; max additivity error **4.440892098500626e−15** |
| API public Top 3/5/10 → factors raw/serialization | **PASS**, FastAPI TestClient + DB RAM; không app.main |
| Visibility hide top disease, giữ SHAP disease còn lại | **PASS**, immutable snapshot, không ghi DB thật |
| Invalid SHAP shape / failed additivity / Tier1 exception | **PASS**: reject hoặc unavailable; ranking không bị mượn explanation khác |
| Zero + đúng biên 1e−12 | **PASS** |
| Switching real distinct cards + collapsed state | **PASS jsdom**; Trước/Tiếp/state của Parent được existing tests kiểm tra |
| `git diff --check` | **PASS**, chỉ warning LF/CRLF của thay đổi đã có |
| Typecheck/build | Không chạy lại: audit không đổi code/build config ứng dụng |
| Chrome thật / hình ảnh desktop-mobile | **NOT VERIFIED**, không tuyên bố E2E/visual PASS |
| Prediction ảnh gốc | **NOT REPRODUCED**, thiếu metadata; dùng fixture thay thế được mô tả rõ |

Lệnh tái chạy offline:

```powershell
# Từ repo root
seasonal_disease_backend/.venv/Scripts/python.exe -B weather_disease_ai_v3/shap_end_to_end_audit_v1/audit_shap.py
# Từ seasonal_disease_backend
.venv/Scripts/python.exe -B -m pytest tests/test_weather_ai_runtime.py tests/test_weather_ai_api.py tests/test_weather_ai_parent_eligibility.py -q -p no:cacheprovider
# Từ Frontend
npm.cmd test -- src/app/components/ParentPortal.test.tsx src/app/components/weather-ai/WeatherAIResults.test.tsx
node node_modules/vitest/vitest.mjs run --config ../weather_disease_ai_v3/shap_end_to_end_audit_v1/vitest.audit.config.mjs
```

Script chặn `urllib.request.urlopen`; nguồn số duy nhất là fixture/model local. Traceback “isolated unavailable explanation probe” là lỗi được chủ động mô phỏng để kiểm tra fallback, không phải lỗi inference của fixture. Có một warning deprecation Starlette/httpx từ môi trường test, không gây fail.

## H. Safety closure

- **Source ứng dụng không đổi**: so sánh 496 file được snapshot trước/sau gồm frontend/backend/tests/migrations/deployment/data; `changed_protected_files=[]`. Các sửa chưa commit có từ trước được giữ nguyên.
- **DB thật không đổi trong cửa sổ audit**: SHA256 toàn `seasonal_disease_backend/database.db` trước/sau bằng nhau; 32 bảng snapshot (trừ login_sessions) count/hash bằng nhau; kết nối audit mode=ro/query_only, total_changes=0. Test API chỉ tạo 2 bảng visibility trong **SQLite RAM**, không migrate DB thật.
- **Model/manifest/45 features/H14/training data/Excel/Medical Knowledge/.env/Graduation**: không chỉnh hoặc chạy cập nhật; deployment/data được kiểm tra hash. Không truy cập Graduation để sửa.
- **Network**: không gọi weather/medical service ngoài, không gọi server Eureka đang chạy, không đưa dữ liệu ra ngoài. TestClient nội bộ không dùng HTTP production.
- **Lifecycle**: không import app.main, không khởi động/dừng/restart uvicorn; process uvicorn của người dùng vẫn được giữ nguyên. Audit script được đặt ngoài backend watcher source.
- **Git**: HEAD/index giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout. HEAD `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`.
- Chỉ tạo evidence/script/config test cô lập trong thư mục audit này; không rải file repo root.

Evidence: [backend_evidence.json](backend_evidence.json), [frontend_evidence.json](frontend_evidence.json), [presentation_findings.json](presentation_findings.json), [ID6_45_FEATURES.md](ID6_45_FEATURES.md), [safety_closure.json](safety_closure.json).

**DỪNG sau audit. Không áp dụng đề xuất sửa trong task này.**
