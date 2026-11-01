# Eureka - Final PDF Layout Refinement

**PASS_WITH_FINDINGS** - Hoàn tất phần sửa bố cục PDF và kiểm thử cô lập. **Browser NOT VERIFIED** do công cụ không kết nối được. Mẫu tháng tuổi vẫn cần hai trang; giữ khoảng trắng cuối báo cáo thay vì ép/cắt nội dung.

## 1. Xác minh an toàn và tái sử dụng audit

Đã xác minh độc lập trước sửa: PID **40364**, child **33960** không còn tồn tại; không có Uvicorn/app.main/multiprocessing backend liên quan và không có listener cổng **8000**. Không tự kill/start/restart server.

Hash renderer và PDF cũ khớp audit lượt trước, nên tái sử dụng audit; bản audit bị chặn được giữ ở `BLOCKED_RELOAD_AUDIT.md`. Evidence trước sửa ở `baseline.json` (563 file), `report_export_before.py` và `process_guard_resumed.json`. `process_guard.json` là evidence lịch sử khi server còn chạy, không phải trạng thái cuối.

## 2. Nguyên nhân và chỉnh sửa

| Finding | Nguyên nhân xác nhận | Cách sửa trong renderer |
| --- | --- | --- |
| Mùa khô/mưa dùng 1, 2 | Bar chart luôn dùng số thứ tự, chỉ line chart dùng tên; không đo nhãn | Dùng `pdfmetrics.stringWidth` với Nunito 8pt, so với bề rộng plot chia số cột trừ khoảng hở 12pt. Nếu tất cả nhãn vừa thì hiển thị trực tiếp; tên dài vẫn dùng số/chú giải |
| Chú giải chiếm chiều cao | Mỗi tên dài là một Paragraph riêng, có khoảng sau đoạn | Chú giải đánh số thành một đoạn tự xuống dòng, giữ đủ mọi tên; nhóm cùng tiêu đề/chart bằng KeepTogether |
| Bảng đẩy phần đuôi sang trang | Padding trên/dưới 7pt và khoảng heading cộng dồn | Padding mỗi cạnh 7 -> 4pt; heading trước/sau 10/7 -> 6/4pt; khoảng sau đoạn nhỏ 3 -> 2pt |
| Khuyến nghị ngắn ở trang riêng | Heading giữ với đoạn đầu nhưng trang trước không còn đủ chỗ sau bảng/ghi chú | Tận dụng phần chiều cao tiết kiệm trong luồng tự dàn trang. Mẫu minh chứng gộp được khuyến nghị vào cùng trang, không thêm tọa độ tuyệt đối hoặc ép fit |

**Không giảm cỡ chữ**: Nunito nội dung 9.3pt, bảng/ghi chú/axis/footer 8pt, heading 13pt, title 19pt giữ nguyên. Leading, kích thước chart, cột/đường, màu sắc, A4 và margins/header/footer giữ nguyên. Không thay thuật toán hoặc số liệu. LongTable vẫn lặp header, tự chia trang và giữ toàn bộ nội dung, kể cả ô rất dài cần tiếp nối.

## 3. Số trang trước/sau

Cùng 7 bộ dữ liệu kiểm thử và cùng tùy chọn xuất, từng mẫu vẫn là một báo cáo độc lập:

| Mẫu | Trước | Sau | Dòng bảng |
| --- | ---: | ---: | ---: |
| Tổng quan | 1 | 1 | 4 |
| Theo mùa | 1 | 1 | 2 |
| Theo nhóm bệnh | 2 | 1 | 12 |
| Dự báo | 1 | 1 | 4 |
| Tháng tuổi | 2 | 2 | 24 |
| Tháng/năm | 1 | 1 | 6 |
| Tùy chỉnh, có khuyến nghị | 2 | 1 | 4 |
| **Tổng** | **10** | **8** | **56** |

Trang 4 cũ (đuôi bảng theo bệnh) và trang 10 cũ (khuyến nghị) không còn phải đứng riêng. Mùa khô/Mùa mưa được đặt trực tiếp dưới cột, không còn danh sách 1/2 dư thừa. Các nhãn tháng tuổi cũng vừa slot và dùng tên trực tiếp.

**Lý do giữ hai trang tháng tuổi:** 24 dòng, biểu đồ, metadata và ghi chú vẫn vượt chiều cao nội dung A4 khi giữ nguyên cỡ chữ, chart và margins. Bản mới có 16 dòng ở trang đầu, 8 dòng còn lại cùng ghi chú ở trang sau, header lặp. Khoảng trắng dưới phần cuối vẫn còn; không kéo giãn/cắt nội dung hoặc thu nhỏ font để ép thành một trang. Không gộp trang của hai mẫu khác nhau để làm đẹp số trang tổng.

## 4. File sửa/thêm

Source sản phẩm chỉ sửa:

- `seasonal_disease_backend/app/services/report_export.py`

Thêm kiểm thử:

- `seasonal_disease_backend/tests/test_reports_pdf_layout.py`

Evidence:

- `validate_refinement.py`: tái sử dụng fixture SQLite in-memory của task trước, chạy renderer trước/sau trên cùng snapshot; không ghi đè script/PDF/evidence trước đó.
- `renderer.diff`: diff so với source đang có trước task, không lấy HEAD làm baseline.
- `validation/comparison.json`: so sánh từng mẫu, số trang, hash bundle, bảng, CSV, ghi chú/khuyến nghị.
- `validation/chart-comparison.json`: payload chart và kích thước vector trước/sau của cả 7 mẫu.
- `validation/page-01.png` đến `page-08.png`: toàn bộ PDF chính.
- `validation/long-table-01.png` đến `long-table-04.png`, `long-name-01.png` và `long-name-02.png`: stress rendering.
- `backend-tests.log`, `pdf-validation.log`, `safety-final.json`, `process_guard_final.json`, `diff-check.log`.

**PDF minh chứng mới:** `output/pdf/eureka-reports-layout-refined.pdf`.

PDF gốc `output/pdf/eureka-reports-validation.pdf` giữ nguyên hash và vẫn 10 trang để đối chiếu. PDF stress là tài liệu kiểm thử tạm tại `tmp/pdfs/eureka-refinement-long-table.pdf` và `tmp/pdfs/eureka-refinement-long-name.pdf`, không phải dữ liệu/báo cáo thật.

## 5. Tests và đối chiếu

- **35 targeted PDF/backend tests PASS**: 5 tests layout mới và 30 tests quản lý báo cáo hiện có. Lệnh chạy từ `seasonal_disease_backend`:

  `.venv/Scripts/python.exe -m pytest tests/test_reports_pdf_layout.py tests/test_reports_management.py -q --tb=short`

- **PDF chính 8/8 trang đã render và xem trực quan** bằng PyMuPDF, đồng thời đọc text bằng pypdf. Kiểm tra nhãn mùa, tiếng Việt, chú giải dài, 2 series dự báo, khoảng thiếu trên line chart, phần đuôi bảng/khuyến nghị, footer và phân trang. Không thấy chữ/legend chồng nhau hoặc tràn lề.
- **Stress 120 dòng/4 trang và tên dài hơn 1.000 ký tự/2 trang**: đã xem đủ 6 trang ảnh. Đủ các mã REF-000 đến REF-119 đúng một lần; không mất dòng, header lặp đúng. Ô rất dài có thể tiếp nối sang trang sau; nội dung không bị cắt bỏ. Không cố ép bảng/ô dài vào một trang.
- **Đối chiếu dữ liệu PASS:** toàn bộ text bảng có thứ tự (bỏ header lặp/footer) giống trước; ghi chú và khuyến nghị giống trước; snapshot không bị mutate; CSV byte-identical cho cùng bundle, đủ cả 7 mẫu. Tổng 56 dòng bảng được giữ.
- **Biểu đồ PASS:** arrays nhãn/series/giá trị giống artifact cũ; đối chiếu vector rectangle/line/curve sau khi bỏ tọa độ dịch chuyển xác nhận kích thước và hình dạng giữ nguyên cho 7 mẫu. Chỉ thay nhãn và cách đặt chú giải.
- **Font/layout PASS theo tests:** cỡ chữ tối thiểu vẫn 8pt; title/body/heading giữ cỡ cũ; khổ A4, giới hạn ngang, tên có `&`/`<...>` và các đoạn dài đều được kiểm tra.
- **`git diff --check` PASS**, exit 0; kiểm tra thêm trailing whitespace cho renderer/test mới vì các file có thể chưa được track.
- Warnings: deprecation `datetime.utcnow`, Starlette/httpx TestClient và PyMuPDF SWIG của môi trường hiện có; không có test fail, không nâng dependency ngoài phạm vi.
- **Browser NOT VERIFIED**: `Computer Use native pipe is unavailable` và `browser access host is unavailable`. Không tuyên bố Chrome hoặc in máy thật đã PASS.
- Không sửa frontend nên không chạy lại frontend tests/typecheck/build trong task chỉ PDF này; 76 frontend PASS là kết quả task trước, không gán thành kiểm thử mới.

## 6. Safety closure và kết luận

- Chỉ renderer trình bày PDF và test mới được thay đổi; API, schemas, builder/snapshot, store, quyền, CSV logic và định dạng giữ nguyên.
- Không query/write DB thật, migration, nhập Excel, sửa dữ liệu hoặc thay quyền tài khoản thật. Tests dùng SQLite cô lập; script in-memory chặn kết nối production engine.
- Hash hai DB, .env, 221 model và các source được baseline bao phủ giữ nguyên ngoài đúng renderer. Frontend/Parent/Medical Knowledge/AI/Graduation không sửa.
- Đối chiếu **563 file baseline**: chỉ `report_export.py` thay đổi, không mất file. Bản PDF cũ, HEAD và Git index khớp baseline.
- Không network/cài dependency mới trong lượt refinement, không start/kill/restart backend, không stage/commit/push/reset/stash/clean/restore/checkout.
- Phần đã xác minh: renderer/tests, dữ liệu trước/sau, toàn bộ PDF mới và stress PDF. Phần chưa xác minh: trình duyệt, máy in thật và mọi bộ dữ liệu thực có thể có; không test trên DB thật theo guardrail.

**PASS_WITH_FINDINGS** vì browser chưa khả dụng và mẫu tháng tuổi vẫn có phần trắng cuối trang cần thiết. Không còn trang riêng chỉ cho khuyến nghị ngắn trong bộ minh chứng. Hoàn tất đúng phạm vi, dừng tại đây.
