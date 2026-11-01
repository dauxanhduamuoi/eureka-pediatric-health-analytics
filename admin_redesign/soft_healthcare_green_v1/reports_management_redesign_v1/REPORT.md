# Eureka - Hoàn thiện module Báo cáo

**Kết luận: PASS_WITH_FINDINGS.** Triển khai frontend/backend, kiểm thử cô lập và kiểm tra PDF đã hoàn tất. **BROWSER NOT VERIFIED**: Computer Use báo `native pipe is unavailable`; Browser Use báo `browser access host is unavailable`. Không coi unit tests/build là bằng chứng giao diện desktop/mobile hoặc browser E2E đã đạt.

## 1. Audit frontend

Source ban đầu có 7 mẫu, bộ lọc nguồn/thời gian/bệnh, tùy chọn nội dung, tạo file, in, copy liên kết và history localStorage. Kiểm tra trước sửa được ghi trong `AUDIT.md`; bản source đang có trước task nằm trong `source_before/`, không dùng HEAD để ghi đè working tree.

Các vấn đề xác nhận: lựa chọn mẫu/loại trùng nhau; preview chủ yếu là cấu hình; nhãn PDF/Word thực tế tải HTML, Excel thực tế CSV; history chỉ là metadata dùng chung browser, không lưu file để tải lại; lựa chọn 7/30 ngày không đúng độ phân giải tháng. Bộ lọc bệnh chưa áp dụng cho mẫu tháng tuổi; nguồn/thời gian trên mẫu dự báo gây hiểu nhầm.

## 2. Audit backend

Backend trước task có GET tổng hợp theo tháng tuổi, tháng/năm và metadata song ngữ; chưa có API snapshot, tạo PDF, file history, download hoặc job báo cáo. Nguồn hiện có là MonthlyStatistic, PatientRecord và ForecastResult. Giữ quyền `feature.reports`; dự báo cần thêm `feature.forecast`. Không cần schema/migration DB hoặc chạy model.

## 3. Lỗi logic đã xác nhận

| Finding | Cách xử lý |
| --- | --- |
| HTML được mô tả như PDF/Word | PDF thật bằng ReportLab; chỉ cung cấp PDF và CSV |
| Tháng/mùa không có bản ghi bị coi là 0 | Snapshot mới dùng null; 0 quan sát được giữ nguyên. GET tháng/năm cũ giữ giá trị cũ và bổ sung `observed` |
| Bộ lọc chưa nhất quán | Áp dụng nguồn, khoảng tháng và bệnh tại builder trước khi dựng bảng/chart |
| Preview/file có thể lấy dữ liệu ở thời điểm khác nhau | File đọc đúng snapshot preview, không query lại |
| History không có file thực hoặc owner | Tệp tạm backend theo tài khoản cụ thể, UUID, TTL, kiểm tra quyền trên mọi thao tác |
| Văn bản CSV có thể trở thành công thức | Trung hòa tiền tố công thức, BOM UTF-8, quote delimiter/quote/newline |
| Khuyến nghị mùa suy diễn từ tổng ca không đồng đều | Giữ tùy chọn khuyến nghị; nhắc đối chiếu số tháng, không suy ra nguy cơ từ tổng ca mùa |
| Font PDF biến thiên bị render ở độ đậm 200 | Bản Nunito tĩnh 400/700 từ font hiện có, giữ font gốc và OFL |

## 4. Những phần đã sửa

Một quy trình duy nhất: chọn mẫu -> cấu hình -> xem nội dung thật -> tạo/tải file. Có lựa chọn chart, bảng, tóm tắt, ghi chú và khuyến nghị trong PDF. CSV luôn là bảng thuần. Preview thay đổi ngay theo lựa chọn nội dung xuất; thay nguồn/bộ lọc hủy preview cũ, bỏ qua response cũ. Loading/empty/error/retry rõ; không báo thành công khi tạo hoặc tải file lỗi.

History lấy từ server, có trạng thái/bộ đếm thật, tìm kiếm/lọc mẫu, tải lại, xóa bản lưu tạm và refresh. Processing được polling; xử lý quá hạn bị chuyển failed, không kẹt ready giả. In chỉ nội dung preview; copy là liên kết bộ lọc, không chia sẻ token hoặc quyền/file riêng tư. Người mở vẫn cần quyền và lấy dữ liệu lại.

## 5. Những chức năng đúng được giữ

Giữ đủ 7 mẫu, nguồn hiện tại/lịch sử, tổng hợp số ca, Top 10/20 có chú thích, ranh giới 6 bucket tháng tuổi, lọc bệnh/tháng, CSV, các tùy chọn nội dung phù hợp, khuyến nghị nghiệp vụ, in và copy cấu hình. Tái sử dụng chính `forecast.get_group_summary` để giữ cách cộng, loại dòng không thể dự đoán, risk/trend, kỳ mặc định; không copy thuật toán hoặc chạy dự báo.

Trang Forecast hiện có dùng helper CSV trong `lib/reports.ts`; giữ adapter CSV tương thích (có thêm bảo vệ công thức), không sửa Forecast.tsx hay AI. Giữ các GET cũ và quyền metadata song ngữ hiện hành. History localStorage cũ không xóa; không đưa metadata không có file sang history server hoặc trộn dữ liệu giữa người dùng.

## 6. Định dạng sau triển khai

- **PDF `.pdf`, application/pdf**: tiêu đề, ngày UTC, nguồn, phạm vi, nhóm bệnh, nội dung được chọn; Nunito embedded, A4, bảng tự ngắt trang và lặp header, footer số trang, vector chart.
- **CSV `.csv`, text/csv**: UTF-8 BOM, đúng cột và toàn bộ dòng bảng của snapshot; null là ô trống, 0 là `0`; không nhúng chart, không giả workbook Excel.
- Bỏ quảng bá HTML thành PDF/Word; không thêm ZIP/format thừa.

## 7. Xuất chart và dữ liệu

Builder tạo `rows`, `columns`, `summary`, `charts`, `notes`, `recommendations` cùng phạm vi. Frontend/Recharts và PDF dùng trực tiếp arrays từ snapshot. Chart Top nhóm giới hạn 12 nhóm, xu hướng giới hạn 36 kỳ cuối và ghi rõ trên tiêu đề; bảng không bị cắt ngầm. Mẫu dự báo tách series số ca kỳ trước và số ca dự báo, ghi rõ không phải xác suất bệnh cá nhân. Line chart không nối qua tháng thiếu dữ liệu.

PDF dùng [ReportLab Platypus](https://docs.reportlab.com/reportlab/userguide/ch5_platypus/) và [font TrueType/Unicode](https://docs.reportlab.com/reportlab/userguide/ch3_fonts/). Font offline lấy từ tài nguyên có sẵn, không tải font trong request. Chỉ thêm `reportlab==4.4.10` vào runtime requirements; các công cụ đọc/render/tạo font chỉ dùng kiểm thử. Đã xác nhận import routes/font bằng interpreter backend hiện có, không import main/lifespan/start server.

## 8. Đối chiếu đầu vào/đầu ra

| Luồng frontend -> API | Backend/nguồn -> đầu ra |
| --- | --- |
| Chọn nguồn -> GET `/api/reports/options` | Danh sách kỳ/nhóm từ MonthlyStatistic + PatientRecord; ForecastResult chỉ khi có quyền Dự báo; formats thật |
| Xem trước -> POST `/api/reports/preview` | Validate request; builder read-only; snapshot riêng 30 phút; dữ liệu thực tế cho preview |
| Tổng quan/tùy chỉnh | MonthlyStatistic, sum cùng filter; Top 10/20 hoặc nhóm tùy chỉnh; summary toàn scope có chú thích |
| Theo mùa | MonthlyStatistic theo lịch tháng khô 12,1-4 / mưa 5-11; mùa thiếu là null |
| Theo bệnh | MonthlyStatistic theo kỳ/nhóm; chart tổng hợp từ các dòng bảng |
| Tháng tuổi | PatientRecord đếm lượt theo bucket; loại tuổi null/âm với số loại được ghi chú; lọc bệnh áp dụng |
| Tháng/năm | MonthlyStatistic; tháng thiếu null, ghi nhận 0 vẫn 0; cùng filter |
| Dự báo | Chính hàm group-summary hiện có; lọc kỳ dự báo và bệnh; không trộn ca quan sát |
| Tạo -> POST `/api/reports/exports` | Owner snapshot + quyền -> render PDF/CSV -> atomic file -> ready |
| History -> GET `/api/reports/exports` và GET `/{id}` | Chỉ file của tài khoản đang xác thực và quyền hiện tại |
| Tải -> GET `/{id}/download` | Owner, quyền, status, kích thước, SHA-256, PDF signature; attachment private/no-store |
| Xóa -> DELETE `/{id}` | Chỉ bản lưu tạm của owner; processing trả 409; không ghi DB |

Ví dụ cô lập trong tests: tháng 01 có Viêm phổi=5, tháng 03 có Viêm phổi=0 và Viêm mũi=3, tháng 02 vắng. Mẫu tháng/năm lọc Viêm phổi trả `[5, null, 0]` cho cả bảng và chart; CSV là `5`, ô trống, `0`. Nguồn lịch sử=900 không trộn vào nguồn hiện tại. Dự báo cộng 2+3=5 kỳ trước và 4+5=9 kỳ dự báo, bỏ dòng "Không thể dự đoán", khớp nguyên hàm cũ. Sửa DB test sau preview không đổi file của snapshot cũ.

## 9. Giao diện trước/sau

Trước: component hơn 1.000 dòng, nhiều vùng cấu hình trùng, preview chưa có nội dung thật, nhãn format không khớp output. Sau: một danh sách mẫu, vùng cấu hình trái/preview phải, history phía dưới; nền trắng/mint, xanh lá, Nunito hiện tại, không đổi shell Admin. CSS module chỉ scope Reports. <=1100px chuyển workbench một cột, <=599px form một cột; bảng có vùng cuộn khi cần. Đây là kết quả kiểm tra source/CSS, **chưa xác minh trực quan browser desktop/mobile hoặc in trong trình duyệt**.

## 10. File sửa/thêm

**6 file có sẵn đã sửa so với baseline của task:**

1. `Frontend/src/app/components/Reports.tsx`
2. `Frontend/src/lib/reports.ts`
3. `Frontend/src/app/components/admin/AdminWorkflows.content.test.tsx` (port kiểm thử reports sang snapshot; giữ test Weather AI)
4. `Frontend/src/app/components/admin/AdminPageTitles.test.tsx` (mock reads Reports mới; giữ kiểm tra 17 trang)
5. `seasonal_disease_backend/app/routers/reports.py`
6. `seasonal_disease_backend/requirements.txt`

**File mới:**

- `Frontend/src/app/components/reports/ReportForm.tsx`
- `Frontend/src/app/components/reports/ReportPreview.tsx`
- `Frontend/src/app/components/reports/reports.css`
- `Frontend/src/app/components/Reports.test.tsx`
- `Frontend/src/lib/reports.test.ts`
- `seasonal_disease_backend/app/report_schemas.py`
- `seasonal_disease_backend/app/services/report_data.py`
- `seasonal_disease_backend/app/services/report_export.py`
- `seasonal_disease_backend/app/services/report_store.py`
- `seasonal_disease_backend/tests/test_reports_management.py`
- `seasonal_disease_backend/app/assets/report_fonts/`: Nunito-Regular.ttf, Nunito-Bold.ttf, Nunito-Variable.ttf, OFL.txt, README.md.
- Evidence tại thư mục này; PDF kiểm thử tổng hợp ở `output/pdf/eureka-reports-validation.pdf`.

## 11. Cấu trúc và giới hạn vận hành

Frontend container điều phối request/state; Form chọn mẫu/cấu hình; Preview dựng chart/table; lib/reports quản lý types/API/download. Backend tách schema, builder đọc dữ liệu, renderer không query DB, store lưu tệp tạm, router kiểm tra quyền và điều phối.

Snapshot 30 phút; file/history tạm 8 giờ ngoài DB/webroot. Không phải kho báo cáo bền vững nhiều máy, không thêm background job hoặc migration. Mỗi tài khoản tối đa 30 previews/40 exports; preview/file tối đa 20MB; quota tệp hiện hữu kiểm tra trước cấp phát 250MB. Cleanup TTL theo thao tác; quét file hết hạn cả owner không hoạt động trước tạo file mới. Từ chối >5.000 dòng tổng hợp, >600 tháng hoặc PDF bảng >1.500 dòng bằng 413, không cắt ngầm; dùng lọc hẹp hoặc CSV cho bảng phù hợp giới hạn.

Ready chỉ sau ghi file atomic. Processing gián đoạn quá 10 phút -> failed khi đọc trạng thái. File thiếu/corrupt không tải thành công. Namespace theo ID và thời điểm tạo tài khoản, nên ID được tái sử dụng không thừa hưởng tệp cũ. Dữ liệu chỉ là tổng hợp; không đưa đường dẫn nội bộ/token vào response/link. Quyền được kiểm tra lại khi tạo/xem/tải/xóa, cả direct URL và sau thu hồi quyền Forecast.

## 12. Kết quả kiểm thử cuối

| Kiểm tra | Kết quả/evidence |
| --- | --- |
| Frontend targeted + navigation/page-title/workflow regression | **76 PASS**, 6 files, `frontend-tests.log` |
| Backend reports + permission management regression, SQLite cô lập | **65 PASS** (30 Reports + 35 quyền), `backend-tests-final.log` |
| Typecheck | **PASS**, `typecheck.log` |
| Production build | **PASS**, `build.log` |
| `git diff --check` | **PASS**, exit 0, `diff-check.log` (có cảnh báo LF/CRLF từ working tree) |
| Backend interpreter import ReportLab/routes/font offline | **PASS**, `runtime-import.log` |
| PDF đọc lại/render/kiểm tra ảnh | **PASS trong dữ liệu kiểm thử**, mục 13 |
| Browser UI/responsive/E2E/print/clipboard/download hệ điều hành | **NOT VERIFIED** |

Tests gồm 7 mẫu, source/period/disease filter, bucket biên, null vs zero, chart/table/CSV giống snapshot, PDF magic/font embedded/chart vector/text Việt, đọc lại và tải nhiều lần, quyền/401/403/404/409/410/422/500, owner/IDOR/tái sử dụng ID, quyền Forecast thu hồi, request đồng thời, snapshot bất biến, empty/large/failure, processing timeout/expiry/missing/corrupt file, CSV formula injection, frontend stale response, options retry, history refresh/poll/cleanup, không báo thành công giả, in/copy cấu hình qua mock.

Backend tests chỉ dựng FastAPI với router cần kiểm thử và override get_db; không import main/lifespan. Report tests chặn connect production engine và dùng token test không liên quan tài khoản thật. Warnings là deprecation datetime.utcnow/Starlette TestClient của dependencies và code hiện có, không đổi ngoài phạm vi.

## 13. Browser/PDF verification

Không có browser/app surface khả dụng: lỗi native pipe và browser access host đã xác minh; không start server để né hạn chế. Không có screenshot UI trước/sau, không tuyên bố E2E PASS.

PDF cuối gồm **10 trang, 7 mẫu**, dữ liệu hoàn toàn tổng hợp, có nhãn **DỮ LIỆU KIỂM THỬ CÔ LẬP**. Đã mở bằng pypdf/PyMuPDF, extract text và xem ảnh render tất cả trang. Kiểm tra chữ có dấu, tên dài, ký tự `&`/`<...>`, chart/legend hai series, line bị ngắt tại null, table header lặp, dòng đầu/cuối và phân trang; không thấy clipping/overlap, ô vuông glyph hoặc trang trống. Mẫu tùy chỉnh kiểm tra thêm phần khuyến nghị tùy chọn. Không đồng nghĩa mọi bộ dữ liệu thực hoặc mọi máy in/browser đều đã xác minh.

`validate_pdf.py` tái tạo bằng SQLite in-memory, có chặn engine thật; `validation/pdf-manifest.json` ghi scope/summary/chart arrays của từng mẫu, `validation/pdf-extracted-text.txt` và `validation/page-01.png` đến `page-10.png` lưu evidence. PDF không chứa dữ liệu bệnh nhân hoặc bản ghi DB thật.

## 14. Safety closure

| Hạng mục | Xác nhận |
| --- | --- |
| Frontend/backend | Có sửa, chỉ Reports, client CSV tương thích và tests cần thiết như mục 10 |
| API contract | Bổ sung endpoints/schemas; GET cũ giữ, tháng/năm thêm observed; không sửa API Forecast/Weather AI |
| Format | Thêm PDF thật có chart/table; giữ CSV; bỏ nhãn format giả |
| DB thật | Không query/write DB thật; chỉ đọc hash tệp để đối chiếu. Hai tệp DB khớp baseline |
| Migration/quyền thật/import Excel | Không thực hiện; test chỉ DB tạm/in-memory và tài khoản giả |
| Server | Không start/kill/restart; Uvicorn và listener 8000 không còn trước sửa và khi kết thúc |
| PID cũ | 37800/20368 không tồn tại; 32864/45724 được hệ điều hành tái sử dụng bởi node/Chrome, không phải Uvicorn |
| Models/AI | 221 model V3 byte-identical; không retrain, không sửa Forecast AI/Weather AI/H14/features/SHAP |
| Parent/MK/Sidebar/Topbar/Graduation/.env/raw data | Không sửa. Hash các source được baseline bao phủ và .env khớp ngoài allowlist Reports |
| Network | Chỉ tài liệu renderer và cài dependencies; không upload dữ liệu/source/DB, không gọi API provider hoặc backend thật để test |
| Git | Không stage/commit/push/reset/stash/clean/restore/checkout. HEAD và hash Git index khớp baseline |
| Working tree có trước | Đối chiếu 503 file: không mất file, không có thay đổi ngoài allowlist 6 file. `safety-comparison.json` ghi chi tiết |

`process_guard.json` và `BLOCKED_RELOAD_REPORT.md` là evidence lịch sử của lượt bị chặn; trạng thái hiện tại ở `process_guard_final.json`. Dependency renderer đã cài vào venv test và interpreter backend hiện có; không chạy main/lifespan.

## 15. Kết luận và giới hạn

**PASS_WITH_FINDINGS**: code/kiểm thử theo phạm vi và PDF đã hoàn tất; giới hạn còn lại là browser UI/E2E/print thực tế chưa xác minh, và lịch sử chủ đích là lưu tạm 8 giờ thay vì kho lưu trữ DB dài hạn. Không kiểm thử trên DB thật theo guardrail. Không tuyên bố live demo hoặc triển khai đang chạy đã PASS. Không có blocker migration/AI/quyền thật.

Dừng tại phạm vi module Báo cáo. Không mở phase mới, không khởi động backend, không commit/push.
