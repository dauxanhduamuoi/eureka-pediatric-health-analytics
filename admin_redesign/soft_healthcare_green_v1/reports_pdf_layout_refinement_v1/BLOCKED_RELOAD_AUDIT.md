# Final PDF layout refinement - dừng an toàn

**FAIL / BLOCKED_RELOAD - CHƯA TRIỂN KHAI. Không kết luận PDF mới hoặc task đã PASS.**

## Blocker

Đã kiểm tra process trước khi sửa Python:

- PID **40364**: `python -m uvicorn app.main:app --reload --port 8000`.
- Child PID **33960**, parent 40364: interpreter `seasonal_backend`, multiprocessing spawn.
- Listener **127.0.0.1:8000**, owner PID **40364**.

Task yêu cầu: “Kiểm tra Uvicorn --reload trước khi sửa Python; dừng nếu có nguy cơ.” Vì có auto-reload đang hoạt động và main/lifespan của Eureka có thao tác khởi tạo/migration DB, chưa sửa source hoặc chạy quy trình tạo PDF mới. Không tự kill/restart backend. Evidence process tại `process_guard.json`.

## Audit chỉ đọc đã thực hiện

Đã đọc renderer `seasonal_disease_backend/app/services/report_export.py`, script tạo PDF kiểm thử của task trước và mở PDF hiện có bằng PyMuPDF: **10 trang**. Đã xem ảnh render lưu từ lượt trước ở các trang **2, 4, 7, 10**, đối chiếu nội dung text của PDF hiện tại. Đây chưa phải kiểm tra toàn bộ một PDF sau sửa.

| Vị trí | Quan sát và nguyên nhân từ code |
| --- | --- |
| Trang 2 | Hai cột mùa khô/mưa dùng `1`, `2`, rồi liệt kê tên bên dưới. `ReportChart.draw` dùng tên chỉ cho line chart; mọi bar chart đều đổi nhãn thành chỉ số, không đo độ rộng nhãn. Đây là nguyên nhân xác nhận, không phải thiếu tên trong dữ liệu. |
| Trang 4 | Còn 3 dòng bảng theo bệnh, header lặp và ghi chú. LongTable tự chia khi hết frame A4; tổng độ cao metadata, summary, chart 195pt, danh sách chú giải, heading, row padding 7pt mỗi cạnh đẩy phần đuôi sang trang tiếp. Không có PageBreak riêng bắt buộc trước phần đuôi. |
| Trang 7 | Có **16 dòng bảng tháng tuổi**, header lặp và ghi chú, không chỉ một đoạn ngắn. Phần cuối nội dung khoảng y=546.8pt trên A4 cao 841.9pt. Tổng bảng 24 dòng cùng chart/metadata vượt một trang với cỡ chữ hiện tại. Có thể cân bằng phần ngắt, nhưng chưa có bằng chứng có thể gộp thành một trang mà vẫn dễ đọc; không được ép gộp. |
| Trang 10 | Chỉ heading Khuyến nghị nghiệp vụ và 2 đoạn ngắn. Heading `keepWithNext=True` giữ với đoạn đầu; phần còn lại của frame trang trước không đủ. Renderer chưa có chiến lược bố trí/đo toàn cụm cuối trang để hạn chế trang đuôi quá ngắn. |

Các mẫu được tạo thành từng PDF riêng rồi gộp trong minh chứng. Ngắt giữa các mẫu là đúng, không được gộp nội dung hai báo cáo khác nhau chỉ để giảm tổng trang. Sửa tiếp cần tập trung khoảng cách hợp lý, row padding và vị trí chia nội dung; giữ font/cỡ chữ dễ đọc, đủ toàn bộ dòng, header/footer và header bảng.

Nhãn ngắn như Mùa khô/Mùa mưa có thể dùng trực tiếp nếu đo bằng font Nunito và bề rộng slot thực tế cho phép. Nhãn dài cần giữ chỉ số/chú giải. Đây là hướng sửa đã xác định, **chưa áp dụng** khi reload đang chạy.

## File và PDF

- Không sửa bất kỳ source frontend/backend nào.
- Không ghi đè PDF cũ, không xuất PDF mới.
- Chỉ thêm báo cáo này, process/hash evidence và log kiểm tra diff trong thư mục task.
- Số trang trước: **10**. Sau: **chưa có bản sửa**; PDF cũ vẫn 10 trang.
- SHA-256 renderer trước/sau: `e97de4d9bfa7896d96269c80dd34f82bc4635b3640eb05a209f0cc276c614629`.
- SHA-256 PDF trước/sau: `c6c06fca72e4dff0ce6c7bc0ce175d3a9e9432ae38fa7a9c4cd385199bf0d38f`.

## Tests

- Audit đọc PDF 10 trang và xem ảnh các trang có finding: đã thực hiện.
- Targeted PDF/backend tests: **NOT RUN**, chưa sửa vì blocker reload.
- PDF mới, đối chiếu dữ liệu trước/sau, render toàn bộ bản mới: **NOT RUN**.
- Browser: **NOT VERIFIED**, không thực hiện trong lượt dừng an toàn này.
- `git diff --check`: xem `diff-check.log` và `safety-evidence.json`; kiểm tra working tree hiện có, không chứng minh layout mới PASS.
- 76 frontend / 65 backend PASS là kết quả lịch sử, không được dùng như kết quả task refinement này.

## Safety closure

Không sửa/query DB thật, không migration, retrain, sửa model, API, snapshot, bộ lọc hoặc dữ liệu. Không sửa frontend, Parent, Graduation hay .env. Không start/kill/restart server. Không stage/commit/push/reset/stash/clean/restore/checkout. Renderer, PDF và Git index giữ nguyên hash. Chỉ ghi evidence ngoài source backend.

Cần người dùng dừng backend bằng Ctrl+C tại terminal đang chạy. Sau đó phải kiểm tra độc lập lại PID 40364, child 33960 và listener 8000 trước khi tiếp tục sửa renderer. Dừng tại đây theo guardrail; chưa hoàn tất task.
