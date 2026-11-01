# Eureka — Root Cleanup & Canonical README V2

Ngày: **01/11/2026**. Kết luận: **PASS_WITH_FINDINGS**.

Root còn một README chính là [README.md](../README.md). Tài liệu hiện hành ở `docs/`; nguyên bản bốn README cũ được giữ đầy đủ, gồm nội dung working tree chưa commit của `README_RUN_FIXED.md`. Không sửa business logic, backend/frontend source hoặc cấu hình runtime.

## Cấu trúc trước và sau

| Mục | Trước V2 | Sau V2 |
|---|---|---|
| README ở root | 4 file | 1 README canonical |
| Hướng dẫn kỹ thuật hiện hành | Rải trong README root | `docs/local-development.md`, `docs/data-and-models.md` |
| Nguyên bản README root | Tại root | `legacy_docs/root_readmes_v2/` trong archive; 3 move, 1 copy trước rewrite |
| Cache pytest root | 5 file tự sinh | Giữ nguyên byte trong `misc_archive/pytest_cache_root_v2/` |
| Evidence Codex đã lưu | 67 cụm / 553 file của V1 | Thêm 3 cụm / 72 file; tổng 70 cụm / 625 file Codex |
| Fixture SHAP, models, DB, uploads, nghiên cứu | Các vị trí cũ | Giữ nguyên |

[MOVE_MANIFEST_V2.csv](MOVE_MANIFEST_V2.csv) riêng có **81 dòng**: 80 file di chuyển và một bản copy lịch sử của README chính. Các bản lưu tại đích giữ nguyên SHA-256. Manifest, report và evidence V1 không bị viết lại; INDEX được cập nhật có backup.

## README và nội dung được bảo toàn

Đã đọc đủ bốn README trước khi chuẩn hóa. Sao lưu working tree bằng bytes/hash, không lấy Git HEAD. Có bảy bản sao tài liệu trước sửa tại `root_cleanup_v2_evidence/source_before/`: bốn README root, INDEX và hai README chỉ mục archive.

- README mới: giới thiệu Eureka, chức năng, công nghệ, môi trường quan sát được, cài/chạy local, cấu trúc, hai luồng AI, giới hạn, tests và tài liệu.
- `docs/local-development.md`: phân biệt API local trên DB đã chuẩn bị (`--lifespan off`) với startup đầy đủ có migration/seed/worker; vị trí DB, upload phụ thuộc cwd, navigation hiện tại và cách chọn tests.
- `docs/data-and-models.md`: hợp nhất thông tin import và workbook Forecast, tách với Weather AI V3; giữ các đường dẫn artifact còn đúng, loại các bước/API cũ chưa còn trong router khỏi hướng dẫn hiện hành.
- Nguyên bản đầy đủ ở [root_readmes_v2](legacy_docs/root_readmes_v2/), không xóa đoạn lịch sử để che nguồn gốc. README frontend cùng attribution/Figma và license giữ nguyên.

Nội dung lỗi thời đã đối chiếu: tạo tài khoản với thông tin mẫu trong root README cũ; import train-history theo quy trình cũ; endpoint run-weather/model-data-status không có trong router hiện tại; Settings cho visibility; gợi ý drop bảng cũ. Không đưa các hướng dẫn này vào README canonical. Phần còn đúng về model/workbook, mapping mã bệnh và `predict_current` được đưa vào tài liệu hiện hành.

Forecast được mô tả theo kỳ sau dữ liệu đã import, không gắn với tháng hiện tại. Không tự xác định thuật toán của pickle bằng cách deserialize model. Weather AI V3 được đối chiếu manifest/schema/config: 221 model, 45 feature, H14; score ranking và SHAP không được mô tả thành xác suất cá nhân hoặc quan hệ nhân quả.

Môi trường xác minh từ CLI/metadata: Python backend 3.14.5, Node 24.15.0, npm 11.12.1; engine Vite từ package đang cài. Không chạy cài đặt sạch hoặc tuyên bố đã kiểm thử mọi phiên bản. Hai dependency test PDF `PyMuPDF` và `pypdf` có trong venv hiện tại nhưng chưa được khai báo trong requirements runtime; tài liệu đã ghi rõ, không thêm dependency trong task này.

## Audit các mục root

Chi tiết công dụng, lý do, tracked/untracked và trạng thái trước/sau: [ROOT_AUDIT.csv](root_cleanup_v2_evidence/ROOT_AUDIT.csv).

| Vị trí | Kết quả |
|---|---|
| `.kilo/` | Chỉ có `.gitignore`, không thấy rules/config. Chưa chứng minh đầy đủ usage của extension/workflow ngoài repo; giữ REVIEW_REQUIRED, không đổi extension |
| `.pytest_cache/` | Git không track; CACHEDIR.TAG đúng chuẩn pytest, nodeids/lastfailed là JSON cache; không thấy process pytest chạy. Chuyển nguyên 5 file, không xóa vĩnh viễn |
| `admin_redesign/` | Chuyển ba bundle đủ điều kiện; giữ các bundle còn root-relative script hoặc payload chưa xác minh |
| `Frontend/` | Giữ source/assets/tests/config và attribution; không đổi logic/style |
| `node_modules/` | Giữ nguyên, gồm cache Vite ở root; không dọn dependency |
| `output/`, `tmp/` | PDF có reference cố định từ `validate_refinement.py`; giữ toàn bộ, không tách hoặc xóa |
| `project_archive/` | V1 được bảo toàn; thêm manifest V2, lịch sử README/cache/evidence và cập nhật INDEX |
| `seasonal_disease_backend/` | Giữ source/API/migrations/config/DB/model; không import app để audit |
| `Train_5/` | Có Excel, notebook, model và kết quả nghiên cứu; metadata cấp đầu, không mở dataset |
| `uploads/` | Payload cần bảo vệ, đường dẫn phụ thuộc working directory; giữ nguyên |
| `weather_disease_ai_v2/` | Có nghiên cứu, data, model, môi trường và legacy; giữ, không kết luận hết dùng từ tên v2 |
| `weather_disease_ai_v3/` | Giữ runtime và fixture SHAP. Xác minh `src/data_pipeline.py` còn ghi `reports/DATA_PREPARATION_REPORT.md`, nên thư mục reports chuyển từ REVIEW sang KEEP_ACTIVE |
| `database.db` root | Giữ nguyên; source dùng DB riêng tại backend, không tự hợp nhất hoặc suy ra root DB là thừa |
| `seasonal_backend_packages.txt` | Giữ danh sách package lịch sử; tài liệu cài hiện hành trỏ requirements backend |
| `ThucTap-main.zip` | Giữ nguyên 288.576.556 byte; chưa kiểm kê privacy hoặc tính duy nhất của bản khôi phục, không mở/chuyển |

Không xác minh nội dung raw patient data, uploads, DB hoặc ZIP để làm sạch root. Không có thao tác xóa hàng loạt, symlink/junction hoặc thay đổi execution policy.

## Ba cụm evidence được xét lại

1. `advanced_analytics_notifications_batch_v1`
2. `age_insights_workspace_redesign_v1`
3. `forecast_account_redesign_batch_v1`

Cả ba verifier dùng `process.cwd()` làm root repo, nạp TypeScript/PostCSS từ `Frontend/node_modules`, dùng `__dirname` cho baseline/source_before/output trong bundle. Chuyển cùng cấu trúc vào `project_archive/codex_evidence/admin_redesign/soft_healthcare_green_v1/` không đổi các quan hệ này. Script không sửa. Khi tra lại script lịch sử, working directory phải là root repo; assertion vẫn thuộc baseline thời điểm task gốc, không phải chứng nhận source hiện tại.

Đã kiểm tra cú pháp bốn file CJS tại đích và xác minh module dependency có thật, không thực thi verifier hoặc run-tests để ghi đè evidence lịch sử. Chi tiết: [evidence-location-review.json](root_cleanup_v2_evidence/evidence-location-review.json).

Trong 23 cụm REVIEW của V1: ba cụm được lưu trữ, một cụm reports được xác minh còn dùng, **19 cụm còn giữ REVIEW_REQUIRED**. Fixture SHAP KEEP_ACTIVE từ V1 không chuyển. Không bắt buộc gom hết, không sửa hàng loạt script.

## Kiểm tra và protected hashes

Kết quả chốt tại [verification.json](root_cleanup_v2_evidence/verification.json):

- **2.200 protected-file hashes không đổi**, ngoài bảy đường dẫn tài liệu được cho phép tổ chức/rewrite. Bao gồm source/config/assets được baseline, mọi file archive V1 khác INDEX/chỉ mục được phép sửa, Git index, **221 model V3 và model Forecast**.
- Model chỉ được đọc streaming để tính SHA-256, không deserialize, predict hoặc retrain. DB/dataset/ZIP/secrets không được mở để kiểm kê nội dung.
- **81/81** file archive V2 khớp hash; không thiếu hoặc ghi đè đích. Working tree của README_RUN_FIXED khớp bản lưu nguyên văn.
- Imports/lazy paths frontend, module local backend, các liên kết README/docs/INDEX, package/config và dependency của script được kiểm tra sau move.
- Git status ngoài tập tài liệu/đường dẫn move được bảo toàn; V1 manifest giữ hash.
- `git diff --check` PASS; kiểm tra whitespace và local links của các tài liệu mới/cập nhật.

Không chạy frontend/backend full suite, build, test có tác động DB hoặc browser: chỉ đổi tài liệu và chuyển các artefact đã xác minh. Không dùng test PASS từ V1 hay các task AI/UI trước để thay việc kiểm tra hash/path sau move. Không tuyên bố fresh-install, runtime API hoặc E2E đã được nghiệm thu lại.

## Git status và safety closure

README chính trở thành modified; ba README phụ tracked ở root thành deleted tại đường dẫn cũ và có bản archive tương ứng chưa stage. 114 đường dẫn tracked đã di chuyển ở V1 được giữ nguyên trạng thái; không khôi phục. Các thay đổi source và source đã deleted trước task cũng được bảo toàn. Manifest V2, docs và evidence mới chưa stage; cache gốc vốn ignored.

- Không stage/commit/push/reset/stash/clean/restore/checkout; không viết Git history/index.
- Không sửa frontend/backend business logic, API, Forecast/Weather AI/SHAP, quyền, schema, model hoặc `.env`.
- Không ghi DB thật, migration, import dữ liệu, retrain, restart/kill server hoặc thay model.
- Không xóa source, dataset, model, backup, node_modules, dist hoặc cache khác; không thao tác Graduation/project gốc ngoài workspace.
- Filesystem move chỉ dùng đường dẫn tuyệt đối đã xác minh trong workspace, kiểm tra hash/mtime trước, từ chối đích tồn tại, xác minh hash sau. Tất cả nguyên bản tài liệu được lưu trước sửa.

Những mục chưa đủ chứng cứ như `.kilo`, ZIP và 19 bundle REVIEW tiếp tục ở vị trí cũ. Đây là các finding, không bị ép chuyển để làm root trông sạch hơn.

**Hoàn thành phạm vi V2 và dừng.**
