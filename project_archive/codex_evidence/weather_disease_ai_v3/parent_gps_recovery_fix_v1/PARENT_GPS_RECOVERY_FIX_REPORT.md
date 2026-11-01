# EUREKA — Audit và sửa GPS recovery Parent

Ngày 25/10/2026, Asia/Bangkok. **PASS_WITH_FINDINGS** — đã xác nhận/sửa bug state và race; quyền GPS trên trình duyệt thật chưa xác minh.

Workspace Eureka; branch `feature/medical-knowledge-v1-20260820`; HEAD `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649`. Đã kiểm tra working tree và chụp baseline trước khi thay đổi; không hoàn tác các thay đổi có trước.

## 1. Nguyên nhân đã chứng minh trước khi sửa

Đọc `ParentPortal.tsx`, thêm tests tái hiện và chạy **trước khi sửa component**:

| Tình huống | Kết quả code cũ | Phân loại |
| --- | --- | --- |
| Lấy lại GPS sau khi đã có tọa độ | Tọa độ cũ vẫn còn, Xem kết quả vẫn bật trong lúc đang lấy tọa độ mới | **BUG readiness/stale coordinates** |
| GPS A pending → Tự chọn → dự đoán thủ công → callback A báo lỗi | Callback chỉ kiểm tra mounted, vẫn ghi lỗi GPS vào màn hình đang dùng thủ công | **BUG race** |
| GPS A pending → đổi mode → GPS B thành công → callback A lỗi | Callback A xóa tọa độ B; không gửi được prediction bằng tọa độ B | **BUG race**, có thể khiến người dùng tưởng cần reload |
| Chưa có tọa độ, GPS đang pending | Xem kết quả vẫn enabled dù handler không có đầu vào để chạy | **BUG trạng thái nút**, không phải lý do cho phép dự đoán thiếu tọa độ |
| GPS lỗi tạm thời → Lấy định vị → thành công | Đã hoạt động mà không reload | **Hành vi đúng**, test cũ trước sửa PASS |
| GPS lỗi xong → Tự chọn → chọn địa điểm → dự đoán | Đã hoạt động mà không reload | **Hành vi đúng**, test trước sửa PASS |

**Bằng chứng trước sửa: 4 tests FAIL cho các bug trên, 2 tests PASS cho retry/manual thông thường.** Không gán mọi lỗi GPS cho state bị kẹt.

Ngoài ra, callback thất bại cũ luôn coi mọi lỗi là từ chối quyền, đồng thời ghi cả `locationMessage` và `error`, nên render hai thông báo GPS. `getCurrentPosition` chưa được bọc bắt ngoại lệ đồng bộ; trường hợp API ném lỗi có thể để trạng thái loading không kết thúc.

**Thiếu tọa độ thì không dự đoán là đúng.** Reload không phải cách xử lý bắt buộc. Không có log/code lỗi GPS của lần gặp thực tế nên chưa thể khẳng định race này là nguyên nhân duy nhất của tình huống người dùng đã thấy; quyền trình duyệt hoặc dịch vụ định vị tạm thời cũng chưa được xác minh trực tiếp.

## 2. Sửa nhỏ đã thực hiện

- Thêm `gpsRequestId` độc lập với request prediction/Medical Knowledge. Callback chỉ được ghi state nếu còn thuộc yêu cầu hiện hành và component còn mounted. Khi đổi sang Tự chọn, unmount hoặc request kết thúc, callback cũ bị vô hiệu hóa.
- Mỗi lần xin/lấy lại GPS: clear kết quả cũ, xóa tọa độ GPS cũ rồi chuyển locating. Không chạy prediction bằng tọa độ của lần trước trong lúc chờ lần mới.
- Không tạo thêm request khi bấm lại nút mode GPS đang pending. Người dùng vẫn chuyển Tự chọn được ngay, kể cả khi request cũ chưa callback.
- GPS success kiểm tra latitude/longitude là số hữu hạn trong miền hợp lệ, cập nhật state bằng tọa độ mới và thoát locating. Không dùng tọa độ mặc định hoặc lấy tọa độ tỉnh gần nhất thay GPS.
- GPS failure/timeout/exception đều thoát locating và giữ khả năng Lấy định vị lại. Mã 1: từ chối quyền; mã 3: timeout; mã 2/khác: chưa lấy được vị trí. Trình duyệt không có API được thông báo rõ, vẫn chọn thủ công được.
- Một thông báo GPS trong khung vị trí, có `aria-live`; không đồng thời tạo lỗi GPS trùng ở khung lỗi chung. Nếu quyền đã bị từ chối, thông báo hướng dẫn cho phép quyền trong trình duyệt hoặc chọn thủ công; ứng dụng không tự đổi quyền và không hứa retry sẽ vượt qua quyền bị chặn.
- Xem kết quả chỉ bật khi tuổi/giới và tọa độ của mode hiện tại hợp lệ, không đang loading/locating. `run()` vẫn kiểm tra phòng vệ, không chỉ dựa vào disabled. Địa điểm thủ công thiếu tọa độ có thông báo và không gửi API.
- Chuyển sang Tự chọn hủy quyền ghi state của callback GPS cũ; lựa chọn thủ công hợp lệ được dùng ngay, không reload. Lựa chọn thủ công người dùng đã chọn trước đó có thể được giữ lại; không tự chọn địa điểm mặc định.

Giữ nguyên cấu trúc/CSS, font Nunito, banner, kết quả, Trước/Tiếp và các tùy chọn GPS hiện có (`enableHighAccuracy`, timeout 10 giây, cache tối đa 10 phút). Không thêm provider định vị hoặc fallback bệnh viện.

## 3. Phân biệt GPS và weather 502

GPS không sẵn sàng: không có request dự đoán; hiện một thông báo trong vùng vị trí, nút Lấy định vị/Tự chọn vẫn dùng được.

Weather W01/W02 trả 502: GPS có thể đã thành công, nhưng weather provider chưa đủ dữ liệu. Hiện nguyên thông báo weather ở vùng lỗi chung:

> Chưa có đủ dữ liệu thời tiết để đưa ra kết quả. Vui lòng thử lại.

Không xóa tọa độ GPS hợp lệ vì weather 502, không buộc xin GPS lại. Test xác nhận bấm Xem kết quả lần sau dùng lại đúng tọa độ và thành công. Validation W01/W02, mã/status API và backend không bị sửa.

## 4. Tests và giới hạn browser

| Kiểm tra | Kết quả |
| --- | --- |
| Audit trước sửa: bốn ca bug | **4 FAIL như kỳ vọng**, chứng minh bug trước khi sửa source |
| Audit trước sửa: retry thông thường và manual sau lỗi | **2 PASS** |
| Parent sau sửa | **64 PASS**, gồm 19 tests GPS mới và các regression đã có |
| Toàn bộ frontend | **401 PASS / 18 files** |
| TypeScript typecheck | **PASS** |
| Production build | **PASS** |
| `git diff --check` | **PASS** |
| Chrome thật: quyền bị từ chối/timeout/lỗi tạm thời rồi thành công | **NOT VERIFIED** |

Tests GPS bao phủ success, lỗi code 1/2/3 rồi retry success không reload, manual recovery, thiếu API, ngoại lệ đồng bộ, tọa độ NaN/infinite/ngoài miền, GPS cũ success/failure không đè request mới, manual không bị callback cũ ảnh hưởng, không request chồng khi bấm mode lại, readiness nút, prediction cũ không đè kết quả từ GPS mới, và phân biệt weather 502.

Các ca trên dùng callback giả lập `navigator.geolocation` trong jsdom và API mocks, **không phải browser E2E hoặc GPS vật lý**. Inventory có Chrome native nhưng không có browser-tab connector (`browsers=[]`); chưa mô phỏng quyền/timeout trên Chrome thật, không đổi quyền trình duyệt, không gọi API production/Open-Meteo hoặc lấy vị trí thật để thử. Không có screenshot/UI E2E PASS.

Commands tại `Frontend`:

```text
npm.cmd test -- --run src/app/components/ParentPortal.test.tsx --reporter=dot
npm.cmd test -- --reporter=dot
npm.cmd run typecheck
npm.cmd run build
```

Không chạy lại backend tests trong task frontend này; source/backend/W01/W02/model được đối chiếu hash không đổi, không biến kết quả test cũ thành lần chạy mới.

## 5. File sửa

Chỉ 4 file code/tests thay đổi so baseline đầu task:

- `Frontend/src/app/components/ParentPortal.tsx` — request ownership, recovery, coordinate/readiness guards, bỏ lỗi GPS trùng.
- `Frontend/src/app/components/ParentPortal.test.tsx` — tests tái hiện và regression.
- `Frontend/src/i18n/locales/vi.ts` — ba thông báo GPS riêng theo loại lỗi.
- `Frontend/src/i18n/locales/en.ts` — bản dịch tương ứng.

Evidence mới: báo cáo này và `safety_closure.json` trong `weather_disease_ai_v3/parent_gps_recovery_fix_v1/`. Không ghi đè báo cáo cũ. Frontend build output được tạo lại thông thường, không deploy.

## 6. Safety closure

| Hạng mục | Kết quả |
| --- | --- |
| Source changed? | **YES**, chỉ 4 file frontend trên; giữ thay đổi có trước |
| Backend/Weather AI V3/45 features/Top K/W01-W02/SHAP changed? | **NO**, hashes bằng baseline |
| Model/training data/retrain/migration? | **NO change / NO run** |
| Excel/guidance/Medical Knowledge/visibility policy changed? | **NO** |
| Graduation/`.env` changed? | **NO** |
| Ghi DB thật do task? | **NO** — không gọi API production/lifecycle/import, các kết nối kiểm tra mode=ro + query_only, total_changes=0 |
| DB thật toàn file bất biến? | **Không chứng nhận**: SHA-256 toàn file khác baseline trong lúc backend chạy đồng thời; **32 bảng snapshot giữ nguyên count/SHA-256**, `login_sessions` được loại khỏi table comparison từ đầu do last_seen |
| Test DB changed? | **NO** — tests frontend chỉ mock/API/jsdom, không tạo/ghi SQL DB test |
| Backend start/stop/reload do agent? | **NO** — quan sát uvicorn PID 19600 với `--reload` đã xuất hiện trong lúc task; không dừng/restart hoặc sửa Python để kích hoạt reload |
| External network/GPS thật/upload? | **NO** do task; chỉ tests mocks và kiểm tra inventory công cụ |
| Git index/HEAD changed? | **NO**, hash cached diff và HEAD giữ nguyên |
| Commit/push/stage/reset/stash/clean/restore? | **NO** |

Không kết luận toàn DB bất biến chỉ vì các kết nối task read-only; dữ liệu hash chi tiết nằm trong `safety_closure.json`. Không tự khôi phục DB hay can thiệp server đang chạy của người dùng.

## 7. Kết luận và dừng

**BUG đã xác nhận và sửa:** GPS callback không có request ownership, có thể xóa/ghi đè trạng thái sau khi chuyển mode hoặc sau request mới; readiness/old coordinates và thông báo lỗi trùng cũng được xử lý. Thiếu GPS thì không dự đoán vẫn là hành vi đúng. Retry/manual recovery không cần reload trong các ca được kiểm thử.

**PASS_WITH_FINDINGS:** tests/typecheck/build PASS; chưa chứng minh nguyên nhân duy nhất của lần gặp thật hoặc nghiệm thu quyền GPS/timeout trên browser thực tế, và không chứng nhận DB đang chạy hoàn toàn bất biến.

**DỪNG sau sửa và kiểm thử; không mở rộng thiết kế hoặc backend.**
