# Weather AI Admin missing weather values — audit & minimal fix

Kết luận: **PASS_WITH_FINDINGS**. Lỗi mapping frontend đã xác nhận và sửa; regression offline PASS. **Browser/live provider NOT VERIFIED**; không suy ra chất lượng hình ảnh hoặc tình trạng provider hiện tại từ unit tests.

## 1. Nguyên nhân và bằng chứng

Bốn ô Admin đọc sai tên trường trong `result.weather.features`:

| Ô | Khóa UI trước sửa | Khóa V3 thực tế | Fixture → hiển thị sau sửa |
|---|---|---|---|
| Nhiệt độ trung bình | `temp_mean_today` | `temperature_mean_current` | 26.875 → 26.88°C |
| Độ ẩm trung bình | `humidity_mean_today` | `humidity_mean_current` | 68.833333 → 68.83% |
| Mưa | `rain_sum_today` | `rain_sum_current` | 12 → 12 mm |
| Gió lớn nhất | `wind_speed_max_today` | `wind_speed_max_current` | 9 → 9 km/h |

Các khóa cũ không tồn tại trong phản hồi V3, nên formatter trả dấu `-` dù features có dữ liệu. Bản source lưu trước task compact results cũng chứa đúng bốn khóa sai này: không quy lỗi cho task gần nhất. `mapping-evidence.json` ghi kết quả đối chiếu; `repro-before.log` ghi test FAIL trước sửa, khi kỳ vọng 26.88°C nhưng nhận -°C. Không có ảnh mới đính kèm trong yêu cầu này để đối chiếu trực quan.

Lỗi đã chứng minh là **frontend hiển thị**, không phải thiếu weather input của fixture. Không sửa backend hoặc công thức để làm UI có số. Fixture dùng bộ features thủ công hợp lệ; không trình bày nó thành một lần gọi Open-Meteo thật.

## 2. Audit luồng dữ liệu và tính đúng đắn

- `WeatherRisk.runPredict` gửi tuổi, giới, Top K, timezone và tọa độ của chế độ đang chọn; không gửi weather giả hoặc số ca khu vực.
- Route Admin gọi runtime service. Khi không gửi weather, builder lấy Open-Meteo theo tọa độ/timezone, dùng D−6 đến D và tạo vector 45 features.
- W01/W02 hiện kiểm tra đủ 168 giờ, timestamp/metadata timezone và các giá trị hữu hạn trước aggregation. `prepare` kiểm tra thứ tự và tính hữu hạn của vector. Provider thiếu dữ liệu trả `WEATHER_DATA_UNAVAILABLE`/HTTP 502 trước khi gọi model/SHAP; thông tin nhập sai có nhánh lỗi riêng.
- Runtime truyền `prepared.encoded` vào 221 model, trả `weather.features` từ cùng `prepared.raw`. Bốn metric sau sửa đọc trực tiếp object này; không lấy current weather riêng, không tự tính lại từ daily series, không thêm API.
- Model ready chỉ là trạng thái registry. Thời tiết hợp lệ và dự đoán thành công thuộc lượt dự đoán, không được suy ra từ badge Model: Sẵn sàng.
- Tests backend xác minh đủ 168 giờ giữ nguyên 45 features và thứ tự, ranking/SHAP legacy so với baseline; mưa 0 hợp lệ. Dữ liệu thiếu/null/không hữu hạn, thiếu giờ, sai timezone không đến model/SHAP và trả 502 trong các test API tương ứng.

## 3. Sửa tối thiểu

**File source sửa:**

1. `Frontend/src/app/components/WeatherRisk.tsx`.
2. `Frontend/src/app/components/WeatherRisk.test.tsx`.

Giữ bốn ô, icon, font, màu và layout. Đọc bốn khóa `*_current` đúng contract; format tối đa hai số lẻ theo formatter hiện có, giữ 0. `null`, undefined, NaN, infinity hoặc giá trị sai kiểu hiển thị **Chưa có dữ liệu**, kèm cảnh báo không thể xác nhận đầy đủ dữ liệu của phản hồi và đề nghị thử lại; không đổi thành 0 hoặc dùng alias cũ.

Hiển thị nguồn thực tế từ metadata và ngày anchor của kết quả; giữ thông tin tháng/mùa có sẵn. Đổi chữ “hôm nay” thành “ngày dự đoán” để cache cũ không bị hiểu thành thời tiết hôm nay. Nguồn không rõ được ghi rõ; không hard-code mọi phản hồi thành Open-Meteo realtime.

Cache vẫn lưu cùng response và input như trước. Khi khôi phục cache có thông báo kết quả đã lưu từ trước, không phải vừa tải. Khi chạy lại, weather và ranking cũ vẫn thuộc cùng response và được đánh dấu là kết quả trước đó; khi thất bại vẫn ghi rõ chưa có kết quả mới và cho thử lại. Thành công thay cả response một lần. Đổi input xóa cả weather/ranking; request generation guard hiện có tiếp tục bỏ qua callback cũ. Không thay API/cache module hoặc thêm nguồn dữ liệu.

Compact cards, một nhóm mở mỗi lần, pagination/reset và giải thích đầy đủ giữ nguyên. Không sửa SHAP/Medical Knowledge hay các shared renderer.

## 4. Kiểm thử

| Kiểm tra | Kết quả |
|---|---|
| Test tái hiện trước sửa | FAIL có chủ đích, `repro-before.log` |
| Frontend regression, 11 files | **229 PASS**, `frontend-tests.log` |
| Trong đó WeatherRisk | 25 PASS: mapping, zero, missing/nonfinite, thiếu weather object, nguồn/ngày, cache, 502/retry, stale response/vị trí, GPS lỗi và fallback thủ công, compact/pagination/input |
| Backend W01/W02 offline hiện có | **71 PASS**, `backend-tests.log` |
| Typecheck | **PASS**, `typecheck.log` |
| Production build | **PASS**, `build.log` |
| `git diff --check` | **PASS**, `diff-check.log` |
| Browser desktop/mobile/live API/GPS | **NOT VERIFIED** |

Frontend gồm 66 Parent tests, 8 compact component tests và các regression SHAP/Medical Knowledge/navigation hiện có. Không chỉ dùng build để tuyên bố UI đẹp hoặc không tràn ngang.

Backend chạy test suite hiện có, không sửa Python. Guard cấm kết nối SQLite file/DB thật và chặn socket external; chỉ cho DB trong bộ nhớ và Windows asyncio loopback socketpair. Lần đầu guard chặn cả socketpair làm 11 setup errors; đã sửa harness, không sửa source hoặc input để né validation. Log ban đầu giữ tại `backend-guard-initial.log`; lần cuối 71 PASS. Có một deprecation warning TestClient/httpx của môi trường hiện tại, không thay dependency trong task.

Browser inventory trả `browsers: []` và “The browser access host is unavailable”. Không có screenshot/E2E mới, không gọi API/provider thật. Kết luận về dữ liệu hợp lệ dựa trên code và fixture/regression cô lập; không khẳng định một lượt dự đoán thật ngoài môi trường test đã được xác minh.

## 5. Safety closure

- Lưu baseline của working tree hiện tại trước sửa, không dùng HEAD để ghi đè. `source_before/` và `changes.diff` chỉ ra đúng phần thay đổi của task này.
- Đối chiếu **566 files được bảo vệ**, chỉ hai file frontend nêu trên đổi hash; không mất các sửa đổi có trước. `safety-final.json` ghi chi tiết.
- 221 model giữ hash; backend, 45-feature schema/H14, SHAP, eligibility/visibility, Parent, Medical Knowledge, Forecast AI, API/cache module và các phần UI khác không sửa.
- Không ghi/kết nối DB thật, migration, Excel, retrain, thay model, sửa `.env` hoặc Graduation.
- Không start/kill/restart backend; không sửa Python source nên không kích hoạt backend reload bằng task này.
- Không stage/commit/push/reset/stash/clean/restore/checkout. Git index giữ nguyên hash.
- Network: mocks/offline, không gọi provider hoặc gửi dữ liệu ra ngoài; chỉ socketpair loopback nội bộ của test runner Windows.

Finding còn lại: xác minh browser thực tế và provider live chưa thực hiện được. Đã hoàn tất sửa nhỏ và kiểm thử đúng phạm vi; dừng, không mở phase mới.
