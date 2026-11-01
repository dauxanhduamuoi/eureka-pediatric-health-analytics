# Eureka — Safe Project Housekeeping & Document Archive V1

Ngày: **01/11/2026**. Kết luận: **PASS_WITH_FINDINGS**.

Đã gom **67 cụm evidence, 553 file, 7.123.521 byte** vào `project_archive/codex_evidence/`. SHA-256 trước/sau khớp cho toàn bộ 553 file. Bảo toàn **210 file snapshot** trong các nhánh source_before/current_source_backup/pre_restore_backup/removed_source. Không di chuyển source đang chạy.

Đây là đợt sắp xếp những mục đủ bằng chứng an toàn, **không phải kết luận đã dọn sạch toàn bộ project**. Còn 23 cụm REVIEW_REQUIRED, một cụm fixture KEEP_ACTIVE và phần evidence nền tảng được giữ nguyên.

## Trước khi dọn

Working tree có nhiều source đã sửa, file mới chưa commit, một source đã bị xóa từ trước và các task evidence chưa tracked. Lưu trạng thái gốc bằng Git chỉ đọc; không dùng HEAD làm bản khôi phục.

Tài liệu rải tại root, `admin_redesign/soft_healthcare_green_v1/`, các nhánh task của `weather_disease_ai_v3/`, `output/pdf/`, `tmp/pdfs/`. Inventory ứng viên gồm **91 cụm, 1.299 file**. Root và tài liệu giữ nguyên có catalog riêng; số này không bao gồm việc kiểm kê sâu dữ liệu bệnh nhân, model, môi trường hoặc dependency.

## Phân loại và kết quả

| Nhóm | Số cụm ứng viên | Số file ứng viên | Xử lý |
|---|---:|---:|---|
| SAFE_TO_ARCHIVE | 67 | 553 | Chuyển nguyên cụm, giữ cây con và nội dung |
| KEEP_ACTIVE | 1 | 8 | Giữ cụm SHAP đang phục vụ test |
| REVIEW_REQUIRED | 23 | 673 | Giữ tại chỗ; một số cụm còn chứa payload PROTECTED bên dưới |
| PROTECTED | Không tách thành cụm riêng | 65 | DB/SQLite trong cụm evidence được giữ nguyên; không mở nội dung |

673 + 65 file thuộc 23 cụm cần xem xét. Các source/config/assets, model, raw data, uploads, `.env`, `.git`, dependency, dist/cache và project gốc không thuộc tập cho phép di chuyển. Xem [phân loại từng file](housekeeping_evidence/FINAL_CLASSIFICATION.csv), [root catalog](housekeeping_evidence/ROOT_CATALOG.csv), [catalog tài liệu giữ nguyên](housekeeping_evidence/RETAINED_DOCUMENT_CATALOG.csv) và [inventory đầy đủ](housekeeping_evidence/inventory-reviewed.json).

## Đã chuyển

- 17 cụm Admin: chart visual refinement; micro-polish; Weather AI compact/missing values; ba đợt Dashboard; Login photo/micro-polish; Permissions; sidebar; topbar; typography; evidence task Distinctive gửi nhầm và đợt rollback đã RESTORED.
- 50 cụm báo cáo Weather AI/Medical Knowledge/Parent đã xác minh không có dependency đang sử dụng vị trí cũ.
- Đường dẫn mới luôn theo quy tắc: `project_archive/codex_evidence/<đường_dẫn_gốc>`. Hai cụm Distinctive/rollback cùng giữ cấu trúc tương đối; không tiếp tục hoặc tái áp dụng thiết kế đã hủy.

[INDEX](INDEX.md) liệt kê cả 67 cụm, đường dẫn trước/sau và liên kết báo cáo. [MOVE_MANIFEST.csv](MOVE_MANIFEST.csv) có 553 dòng, mỗi dòng chứa original_path, archived_path, classification, reason, original_sha256, archived_sha256, status và tracked_before. Tất cả có trạng thái `MOVED_VERIFIED`.

## Giữ nguyên và cần xem xét

- **KEEP_ACTIVE:** `weather_disease_ai_v3/shap_explanation_fix_v1/`. Nhiều test Parent/Admin/Tier 1 import trực tiếp `backend_after.json` và `medical_selectors_before.json`; backend test cũng có đường dẫn xuất vào cụm này. Không chạy test đó để tránh ghi lại evidence.
- Cụm có verifier phụ thuộc vị trí: Admin double-scroll, scroll root-cause, Area/Age/analytics/data-management/Forecast, branding/content và Reports. Giữ toàn bộ cụm thay vì sửa script hoặc tách report khỏi baseline.
- Final Demo Readiness có DB/SQLite và payload kiểm thử; PDF layout còn script, pycache và hình. Giữ nguyên.
- `output/pdf/`, `tmp/pdfs/`, file eligibility spreadsheet và các artefact nghiên cứu chưa rõ nguồn không được chuyển.
- `weather_disease_ai_v3/reports/` được giữ do tên đường dẫn chung và reference cần phân biệt thêm. Các match từ khóa tổng quát không được coi là bằng chứng import trực tiếp vào thư mục này.
- Các file rời và `source_before/` ở nền tảng `admin_redesign/soft_healthcare_green_v1/` giữ cùng verifier gốc.

Danh sách cụ thể của 23 cụm và lý do có tại phần Retained trong INDEX và trường `issues` của inventory. Không có symlink/junction thay thế vị trí cũ.

## README, hướng dẫn và nguồn gốc

Giữ nguyên bốn README ở root: `README.md`, `README_RUN_FIXED.md`, `README_IMPORT_AND_MODEL_DATA.md`, `README_MODEL_TRAIN_EXCEL.md`. Giữ README frontend/backend, kiến trúc/API/deployment và license/attribution tại chỗ.

**Không chuyển README cũ nào:** chưa có bằng chứng đủ để kết luận tài liệu đã hết vai trò. `legacy_docs/` và `misc_archive/` hiện chỉ có README giải thích phạm vi, chưa chứa tài liệu được chuyển.

Finding: hướng dẫn điều hướng trong `README_RUN_FIXED.md` còn nhắc Settings cho chức năng visibility, trong khi UI hiện ở nhóm AI thời tiết. Các README còn mô tả các giai đoạn khác nhau của project. Ghi nhận để xem xét, không tự viết lại hoặc chọn xóa. Nguồn gốc và lịch sử trong báo cáo/snapshot được giữ nguyên từng byte.

## Kiểm tra đã thực hiện sau di chuyển

| Kiểm tra mới trong task này | Kết quả |
|---|---|
| Hash và số lượng file tại đích, không thiếu/thừa/ghi đè | PASS — 553/553 |
| Hash source/config/docs/assets giữ nguyên | PASS — 1.395/1.395, gồm Git index |
| Metadata các file ứng viên giữ lại | PASS — kích thước/mtime không đổi |
| Frontend literal imports và lazy imports tương đối/alias | PASS — 569 đường dẫn, không có đường dẫn mới bị hỏng |
| Backend imports local | PASS — AST 94 module, 311 import; không import/chạy backend |
| Markdown local links có trước | PASS — 22 link, không có link mới bị hỏng |
| Asset/config/package paths và reference tới cụm chuyển | PASS — scan source/script/config, assets giữ hash; các reference chưa rõ được giữ tại chỗ |
| Git status ngoài phạm vi di chuyển | PASS — giữ nguyên trạng thái trước task |
| `git diff --check` | PASS — exit 0; warning LF/CRLF hiện có được giữ nguyên |

Chi tiết: [verification.json](housekeeping_evidence/verification.json), [path-verification.json](housekeeping_evidence/path-verification.json), [expanded-reference-review.json](housekeeping_evidence/expanded-reference-review.json).

Các đường dẫn repo ghi trong logs/baseline là hồ sơ lịch sử, không đổi nội dung chúng để cập nhật vị trí. Các liên kết Markdown thực sự được kiểm tra. Scripts có vấn đề tương đối không bị chuyển. INDEX/manifest cung cấp ánh xạ để tra lại vị trí gốc.

Không chạy lại frontend/backend full suite, typecheck, build hoặc browser trong task chỉ chuyển tài liệu này. Không dùng các kết quả test từ task trước để khẳng định đường dẫn mới đúng; bằng chứng ở trên được thu sau lần di chuyển này. Static verification không phải browser/runtime E2E.

## Git và cách thực hiện

**114 file tracked** được di chuyển bằng filesystem: Git ghi nhận đường dẫn cũ `D`, đích mới chưa stage. **439 file** vốn untracked cũng được chuyển. Nội dung gốc vẫn tại archive với hash tương ứng. Trạng thái của tất cả đường dẫn ngoài tập chuyển và `project_archive/` không đổi, gồm thay đổi source có trước và source đã bị xóa từ trước.

Đã xác minh đường dẫn tuyệt đối nguồn/đích nằm trong workspace, không có reparse point, không trùng đích; kiểm tra tập file, size, mtime và SHA-256 trước khi chuyển. Native rename trên cùng ổ đĩa, không ghi đè, kiểm tra hash ngay sau chuyển. Không có preflight conflict hoặc mục bị skip.

PowerShell chặn chạy file `.ps1` theo execution policy. Không thay chính sách máy; sử dụng native filesystem Python với các kiểm tra tương đương. Script PS chưa được thực thi và được giữ làm evidence. Journal thực tế: [move-journal-native.jsonl](housekeeping_evidence/move-journal-native.jsonl).

## Safety closure và giới hạn

- Không sửa/di chuyển source runtime frontend/backend/API, migration, config, assets, quyền hoặc logic.
- Không mở/ghi DB thật, không kiểm kê sâu raw patient data, dataset, uploads, secrets hoặc model binaries. Model/DB không thuộc phép move; không đọc binaries để tạo tuyên bố hash model trong task này.
- Không sửa `.env`, project thực tập gốc hoặc Graduation. Không retrain, migration hay import dữ liệu thật.
- Không cài dependency, không network ngoài, không restart/kill server. Kiểm tra tiến trình Uvicorn trước thao tác move không thấy tiến trình phù hợp.
- Không xóa node_modules, dist, cache, backup hoặc bất kỳ payload chưa rõ. Không dùng thao tác xóa hàng loạt.
- Không stage/commit/push/reset/stash/clean/restore/checkout; không sửa lịch sử hoặc Git index.
- Những phụ thuộc bên ngoài workspace và các mục REVIEW_REQUIRED chưa được xác minh đủ để chuyển; giữ nguyên. Không tuyên bố đã dọn toàn bộ project hoặc nghiệm thu lại hệ thống.

**Hoàn tất phạm vi an toàn và dừng.**
