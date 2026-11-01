# Module Báo cáo — dừng tại ranh giới an toàn

> Evidence lịch sử của lượt trước. Blocker đã được kiểm tra lại và giải quyết ở lượt triển khai tiếp theo: không còn Uvicorn/listener 8000 trước khi sửa Python. Kết quả hiện hành xem `REPORT.md`, `process_guard_final.json` và `safety-comparison.json`. Nội dung dưới đây giữ nguyên để lưu dấu vết lần dừng an toàn.

**CHƯA HOÀN TẤT / BLOCKED. Không kết luận PASS.**

## Blocker đã xác minh

- PID **32864**: `python -m uvicorn app.main:app --reload --port 8000`.
- Tiến trình con **45724**, parent PID 32864, chạy multiprocessing spawn.
- TCP listener **127.0.0.1:8000**, owner PID **32864**.
- Source `app/main.py` có lifespan gọi `Base.metadata.create_all`, các migration, `ensure_area_schema` và `seed_default_areas`. Vì vậy sửa Python có thể kích hoạt reload/lifespan và tác động DB thật.

Task người dùng, mục 10 và 14, yêu cầu: “Backend đang chạy auto-reload không an toàn để sửa Python” thì dừng; không tự kill/restart. Đã tuân thủ: **chưa sửa source frontend/backend, chưa áp dụng bản vá**. Chỉ ghi evidence này và process snapshot.

## Audit sơ bộ đã đọc — FINDINGS

Đã kiểm tra `Frontend/src/app/components/Reports.tsx`, `Frontend/src/lib/reports.ts`, `seasonal_disease_backend/app/routers/reports.py` và các điểm lifespan liên quan an toàn. Đây chưa phải audit đầy đủ hoặc kiểm chứng runtime/test.

| Điểm đã xác minh trong code | Finding / việc còn lại |
| --- | --- |
| `downloadReport` nhận pdf/word nhưng render HTML và tải `.html` | Chưa có file PDF/Word thật ở luồng này; cần renderer thật hoặc lựa chọn format trung thực, không báo PDF thành công khi chỉ tạo HTML |
| CSV dùng BOM UTF-8 và escape delimiter/quote/newline | Phần escape đã đọc chưa trung hòa formula spreadsheet từ văn bản chưa tin cậy; cần test và sửa trong phạm vi export |
| Backend `/api/reports/by-month-year` trả đủ 12 tháng với `months_map.get(m, 0)` | Thiếu bản ghi bị biểu diễn thành 0, không phân biệt missing với observed zero; cần xử lý tương thích và kiểm chứng dữ liệu cô lập |
| Reports history lưu ở `sd_report_history` trong localStorage; tạo trạng thái processing/ready/failed ở client | Không được tự coi đây là server job/file history. Cần audit tiếp tải lại file, refresh đang processing, phạm vi user và thống kê trạng thái |
| `handleGenerate` gọi client `downloadReport` sau build bundle | Cần đối chiếu từng mẫu/config/API/data và bảo đảm chart/table dùng cùng snapshot; chưa triển khai export biểu đồ |

Các báo cáo dữ liệu đã đọc có guard `feature.reports`; endpoint bilingual metadata có guard any-feature hiện có. Chưa kết luận đầy đủ quyền tạo/xem/download/ownership hoặc toàn bộ loại báo cáo đã đúng.

## Trạng thái thực hiện

- Frontend redesign: **chưa thực hiện**.
- Backend/export renderer/API mở rộng: **chưa thực hiện**.
- PDF có chart + table và render verification: **chưa thực hiện**.
- Tests frontend/backend/typecheck/build: **chưa chạy trong task này**, vì đã gặp stop condition trước thay đổi.
- Browser/PDF verification: **chưa thực hiện**, không tuyên bố PASS.
- Phần còn lại của audit và toàn bộ triển khai/kiểm thử phải tiếp tục sau khi server được người dùng dừng và được kiểm tra độc lập lại.

## Safety closure

Không sửa source, backend/auth policy/API contract, format export đang có, Parent, model, Forecast AI/Weather AI/SHAP, Sidebar/Topbar, `.env`, Graduation hoặc quyền thật. Không đọc/ghi DB qua SQL, tạo báo cáo thật, migration/import/retrain. Không start/restart/kill server. Không stage/commit/push/reset/stash/clean/restore/checkout, giữ working tree hiện tại.

**Bước cần người dùng thực hiện:** dừng backend Eureka bằng Ctrl+C tại terminal đang chạy. Sau đó xác minh lại PID 32864, child 45724 và mọi Uvicorn/listener 8000 liên quan trước khi sửa Python. Không áp dụng bản vá khi chưa xác minh an toàn.
