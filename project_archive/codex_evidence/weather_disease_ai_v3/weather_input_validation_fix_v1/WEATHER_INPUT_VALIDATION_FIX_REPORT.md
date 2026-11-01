# EUREKA — Fix Weather Input Validation W01/W02

Ngày: **25/10/2026**, Asia/Bangkok. Kết luận: **PASS trong phạm vi W01/W02**.

Workspace Eureka, branch `feature/medical-knowledge-v1-20260820`, HEAD `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`. Đã đọc báo cáo audit được chỉ định và kiểm tra source thực tế. Toàn bộ thay đổi chưa commit từ trước được giữ nguyên; đối chiếu baseline đầu task, không coi toàn bộ `git diff HEAD` là thay đổi mới.

## 1. W01 — Nguyên nhân và sửa chữa

Trước sửa, numeric coercion tạo NaN, nhưng aggregation `sum` có thể biến rain/precipitation toàn null thành 0; mean/min/max có thể bỏ qua một số giờ thiếu. Kiểm tra finite ở cuối không phát hiện được số 0 đã bị tạo sai.

Đã kiểm tra trước aggregation tất cả trường thực sự dùng: temperature_2m, relative_humidity_2m, precipitation, rain, weather_code, wind_speed_10m, wind_gusts_10m. Thiếu/null/NaN/infinite/không chuyển được thành số bị từ chối, không điền 0. Boolean không được coi là số thời tiết. Giá trị 0 thật vẫn hợp lệ.

`_daily_from_hourly` dùng lại gate kiểm tra, nên gọi riêng hàm aggregation cũng không bỏ qua validation. `_weather_feature_frame` kiểm tra daily aggregates đầy đủ và hữu hạn trước rolling, tránh nhánh manual daily bỏ qua invalid values. Các công thức mean/sum/min/max/mode/rounding không đổi.

## 2. W02 — Nguyên nhân và sửa chữa

Trước sửa chỉ kiểm tra nhãn ngày liên tục; một giờ/ngày vẫn tạo đủ bảy ngày và features.

Đã thêm `_complete_hourly_window`, yêu cầu chính xác **168 timestamp theo giờ từ D−6 00:00 đến D 23:00**, 24 giờ/ngày theo contract Parent `Asia/Ho_Chi_Minh`. Từ chối timestamp không hợp lệ, trùng, sai thứ tự, không nằm đầu giờ hoặc thiếu bất kỳ giờ nào. Không âm thầm sort/drop timestamp lỗi.

Timestamp không offset được hiểu là local wall-clock theo timezone request, sau khi kiểm tra timezone metadata provider. Timestamp có offset phải khớp wall-clock của timezone yêu cầu; `+07:00` hợp lệ được nhận, UTC offset sai bị từ chối. Timezone input không hợp lệ vẫn là lỗi input.

Khi gọi provider, D được neo vào `target_date` nếu có, nếu không là ngày hiện tại theo timezone request. Do đó thiếu cả ngày hôm nay không làm hệ thống lùi sang ngày cuối payload/D−1. **Không cắt giờ tương lai trong chính D**, không đổi D thành D−1. Cửa sổ 3d/7d và H14 giữ nguyên.

Gate 168 giờ áp dụng cho nguồn hourly provider. Contract manual locked features/manual daily aggregates đã có được giữ lại; manual aggregates phải đầy đủ/hữu hạn, không giả vờ chứng minh hourly coverage khi request không có hourly data. Parent UI vẫn chỉ gửi tuổi/giới/Top K/tọa độ/timezone, không gửi manual weather.

## 3. Kết quả hợp lệ có giữ nguyên không?

**Có, trong các regression đã chạy.** Trước khi sửa đã chụp baseline với 168 giờ synthetic hợp lệ, đủ 45 encoded features và toàn bộ Top 5 predictions gồm scores, SHAP, Tier 2. File fixture:

`seasonal_disease_backend/tests/fixtures/weather_input_valid_baseline.json`.

Sau sửa, test so sánh **array_equal cho 45 features** và **equality toàn bộ predictions với baseline trước sửa** đều PASS. Regression đối chiếu pipeline khóa và standalone boosters hiện có cũng PASS. Không tuyên bố đã vét cạn mọi tổ hợp input, nhưng không thay công thức hoặc artifacts model.

Giữ nguyên 221 model/manifest, thứ tự 45 features, H14, score semantics, stable ranking, filter-before-Top-K và SHAP. Source ranking/SHAP/guidance/Medical Knowledge/visibility/Admin statistics không bị sửa.

## 4. Dữ liệu thiếu và thông báo lỗi

Các trường hợp W01/W02 đã kiểm thử không còn lọt qua provider validation. Spy xác nhận **không gọi model scoring hoặc SHAP** khi provider thiếu/null/sai timezone. Việc registry có thể nạp model để đọc schema không phải inference trên dữ liệu lỗi.

Thêm `WeatherProviderError` cho lỗi upstream, gồm fetch/timeout/JSON hoặc payload không đầy đủ. Hai API `/api/public/parent-risk` và `/api/weather-ai/predict-risk` trả:

```json
{
  "detail": {
    "code": "WEATHER_DATA_UNAVAILABLE",
    "message": "Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại."
  }
}
```

HTTP status: **502 Bad Gateway**. Input phụ huynh sai vẫn **422**; model unavailable vẫn **503**. Không trả chi tiết private upstream/traceback cho Parent.

Frontend API helper nhận mã lỗi và hiện đúng thông báo trên. Không sửa component/layout Parent; test xác nhận không còn card cũ, không gọi thống kê địa phương để fallback, nút Xem kết quả bật lại và lần thử tiếp thành công. Optional Medical Knowledge không được gọi khi prediction thất bại.

## 5. File sửa/thêm trong task

Source (4 file):

- `seasonal_disease_backend/app/services/weather_ai_features.py`
- `seasonal_disease_backend/app/routers/public.py`
- `seasonal_disease_backend/app/routers/weather_ai.py`
- `Frontend/src/lib/api.ts` — chỉ thêm xử lý mã lỗi weather, không đổi API payload hay UI.

Tests/fixture (5 file):

- Thêm `seasonal_disease_backend/tests/test_weather_input_validation.py`.
- Thêm `seasonal_disease_backend/tests/fixtures/weather_input_valid_baseline.json` — chỉ dữ liệu tổng hợp synthetic/model output, không bệnh án.
- Sửa `seasonal_disease_backend/tests/test_weather_ai_release_readiness.py`: fixture hourly theo ngày hiện tại của múi giờ ứng dụng thay cho ngày lịch sử cố định; vẫn kiểm tra timezone request và expected anchor.
- Thêm `Frontend/src/lib/weatherAIError.test.ts`.
- Bổ sung `Frontend/src/app/components/ParentPortal.test.tsx` cho provider error → retry.

Evidence mới: báo cáo này và `safety_closure.json` trong cùng thư mục. Không ghi đè audit trước.

## 6. Kiểm thử

| Nhóm | Kết quả |
| --- | --- |
| Backend validation/runtime/API/visibility/Medical Knowledge regression | **143 PASS**, 161 deprecation warnings hiện hữu |
| Frontend toàn bộ | **382 PASS / 18 files** |
| Frontend targeted Parent + error mapping | **47 PASS** |
| TypeScript typecheck | **PASS** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |
| Browser/live Open-Meteo | **NOT VERIFIED**; offline mock đủ cho sửa validation, không gọi external network |

Bao phủ: 168 giờ đầy đủ; zero rain thật; toàn bộ null rain/precipitation; null/NaN/±infinity/non-numeric ở từng field bắt buộc; một giờ/ngày; lần lượt xóa **từng vị trí trong 168 giờ**; timestamp sai/trùng/đảo thứ tự/sai phút/sai offset; `+07:00` hợp lệ; metadata timezone sai/thiếu; payload thiếu field/sai độ dài/rỗng/null; timeout; daily infinite; D có giờ dự báo sau thời điểm giả lập 12:00 vẫn được giữ; mất cả D không dịch về hôm qua; 502 và không inference ở cả hai route; input sai 422; retry Parent.

Backend command tại `seasonal_disease_backend`:

```text
.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/test_weather_input_validation.py tests/test_weather_ai_runtime.py tests/test_weather_ai_release_readiness.py tests/test_weather_ai_api.py tests/test_weather_ai_parent_eligibility.py tests/test_parent_disease_visibility.py tests/test_parent_weather_only_contract.py tests/test_published_medical_knowledge_public.py
```

Frontend: `npm.cmd test -- --reporter=dot`, `npm.cmd run typecheck`, `npm.cmd run build`.

## 7. Safety closure

Backend đã được dừng trước lần bắt đầu triển khai này; inventory không còn Python/uvicorn. Agent không tự dừng/restart server, không khởi động `app.main` hoặc lifecycle trên DB thật. Tests dùng app/router tối thiểu, mocked provider và DB RAM/tmp cô lập ngoài repo.

| Safety item | Kết quả |
| --- | --- |
| Source changed? | **YES**, chỉ 4 source files và 5 test/fixture files nêu trên trong phạm vi baseline |
| Real DB changed? | **NO** tại hai checkpoint: SHA-256 toàn `seasonal_disease_backend/database.db` bằng nhau; cả 32 bảng snapshot cũng không đổi |
| Agent writes to real DB? | **NO**, kiểm tra mode=ro + query_only, total_changes=0; không production API requests |
| Test DB changed? | **YES**, chỉ fixture RAM/tmp ngoài repo; không test ghi DB thật |
| Model/schema/H14/training data changed? | **NO**, hashes bằng baseline; 221 models/45 features/H14 giữ nguyên |
| Training performed? | **NO** |
| Excel/guidance/Medical Knowledge changed? | **NO** |
| Visibility policy/Admin statistics changed? | **NO**, code/policy/bảng thật giữ nguyên; chỉ fixtures test có ghi |
| Graduation changed? | **NO**, không sửa/truy cập workspace đó |
| `.env` changed? | **NO** |
| Parent layout/Nunito changed? | **NO**, không sửa component giao diện/CSS/font |
| External network/upload? | **NO**, provider được mock, không gửi dữ liệu ra ngoài |
| Git index/HEAD changed? | **NO**, hash cached diff và HEAD bằng baseline |
| Commit/push/stage/reset/stash/clean/restore/checkout? | **NO** |
| Backend started/reloaded/deploy? | **NO** |

Hash DB trước/sau và danh sách 9 file thay đổi được lưu tại `safety_closure.json`. Không xóa hoặc hoàn tác các thay đổi trước task. Build chỉ tạo lại frontend output thông thường.

## 8. Trước live demo và dừng

**Không còn việc sửa code W01/W02 bắt buộc theo các ca đã yêu cầu và kiểm thử.** Live Open-Meteo/browser chưa được xác minh; trước demo thực tế nên smoke test có kiểm soát với mạng/đồng hồ-múi giờ đúng, dùng cách chạy đã chuẩn bị để tránh reload/lifecycle tự ghi DB. Không tự làm các thao tác đó trong task này.

Các finding nguồn Excel 274/275/269 và tài liệu chạy demo từ audit trước không thuộc bản sửa validation này, vẫn giữ nguyên; không tuyên bố toàn bộ nội dung y khoa hoặc E2E live đã được nghiệm thu.

**PASS cho W01/W02. DỪNG sau sửa và regression, không mở phase mới hoặc tối ưu/redesign thêm.**
