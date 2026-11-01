# Chạy Eureka local và kiểm thử

Các đường dẫn trong tài liệu tính từ root repository. Đây là hướng dẫn được đối chiếu source; không phải chứng nhận cài đặt sạch hoặc browser E2E. [README chính](../README.md) giới thiệu chức năng và giới hạn.

## Môi trường và dependency

Workspace đang có Python 3.14.5 trong `.venv` backend, Node.js 24.15.0 và npm 11.12.1. Không suy ra rằng mọi phiên bản khác đều đã được kiểm thử. Frontend có package lock; backend có requirements pin version.

Backend:

```powershell
cd seasonal_disease_backend
if (-not (Test-Path .venv)) { py -3.14 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Frontend, từ root ở cửa sổ khác:

```powershell
cd Frontend
npm.cmd ci
```

Chỉ chạy bước cài đặt khi chuẩn bị môi trường; không xóa môi trường hoặc dependency đang có để thực hiện housekeeping.

## Cấu hình và tài nguyên

- [app/config.py](../seasonal_disease_backend/app/config.py) đọc `seasonal_disease_backend/.env` với `override=False`; biến môi trường đã có được ưu tiên. Không đưa nội dung `.env` vào tài liệu hoặc Git.
- Startup đầy đủ yêu cầu `SECRET_KEY` ít nhất 32 ký tự. Người vận hành cấp giá trị bí mật riêng; không có tài khoản/mật khẩu/API key mẫu trong hướng dẫn này.
- [app/database.py](../seasonal_disease_backend/app/database.py) khai báo SQLite tại `seasonal_disease_backend/database.db`, không phải file cùng tên ở root.
- Chạy backend với working directory `seasonal_disease_backend/`. Các đường dẫn upload trong router là tương đối; việc đổi working directory có thể đổi nơi lưu upload.
- Model và workbook Forecast, deployment V3 cùng DB/schema phải được chuẩn bị hợp lệ. Xem [dữ liệu/model](data-and-models.md). Clone source không tự cung cấp các payload riêng này.

## Chế độ API local trên DB đã chuẩn bị

Từ root, mở PowerShell riêng:

```powershell
cd seasonal_disease_backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --lifespan off
```

`--lifespan off` bỏ qua lifespan trong [app/main.py](../seasonal_disease_backend/app/main.py): không chạy startup migration, seed, preload hoặc worker Auto nền. Model V3 có thể được nạp khi có request. Đây không phải chế độ kiểm thử worker tạo nội dung Auto, cũng không phải cách khởi tạo DB rỗng.

Việc gọi chức năng có ghi dữ liệu như import, phân quyền, visibility, Forecast hoặc lưu báo cáo vẫn có thể ghi DB theo nghiệp vụ. Cờ lifespan không biến API thành read-only. Khi thử thao tác ghi, phải dùng môi trường/DB test cô lập đã được chuẩn bị cho mục đích đó.

## Startup đầy đủ

Với cấu hình bảo mật và DB đã được người vận hành phê duyệt, lệnh không có `--lifespan off` chạy lifespan:

```powershell
cd seasonal_disease_backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Theo source, lifespan kiểm tra cấu hình, tạo/migrate schema đến v018, seed khu vực, có thể preload Weather AI và chạy worker Auto. Vì có tác động DB, cần quy trình backup và quyền vận hành trước khi dùng với DB quan trọng. Task tổ chức tài liệu không chạy các bước này và không xác nhận trạng thái schema của DB thật.

Không cần `--reload` để demo. Khi chủ động dùng reload trong phát triển, sửa Python có thể làm tiến trình tự nạp lại; không di chuyển source/artefact đang được watcher hoặc script sử dụng.

## Frontend và đường dẫn

Từ root, ở cửa sổ khác:

```powershell
cd Frontend
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Vite proxy `/api` tới `http://127.0.0.1:8000` theo [vite.config.ts](../Frontend/vite.config.ts). Admin/Staff dùng `/`; Parent dùng `/phu-huynh` hoặc `/parents`; OpenAPI ở backend `/docs`.

Đăng nhập bằng tài khoản được quản trị viên cấp. Trang quản lý nhóm bệnh là `/?section=parent-disease-visibility`, trong nhóm **AI thời tiết**; Staff cần quyền `feature.parent_disease_visibility` theo chính sách hiện có.

## Kiểm thử

Frontend, từ `Frontend/`:

```powershell
npm.cmd run test -- src/app/components/admin/AdminLayout.test.tsx --maxWorkers=1
npm.cmd run typecheck
npm.cmd run build
```

Backend, từ `seasonal_disease_backend/`, ví dụ phạm vi renderer PDF dùng dữ liệu tổng hợp, không khởi động app hoặc DB:

```powershell
.\.venv\Scripts\python.exe -m pytest -q tests/test_reports_pdf_layout.py
```

File PDF test còn cần `PyMuPDF` và `pypdf`; hai package này chưa được liệt kê trong requirements backend hiện tại. Kiểm tra môi trường test trước khi chạy, không coi bước cài requirements runtime là đủ cho mọi test.

Trước khi chọn file/suite khác, đọc fixture và đường dẫn ghi. Không giả định đặt `DATABASE_URL` là đủ để đổi DB, vì module database hiện khai báo đường dẫn riêng. Một số test SHAP đọc/ghi evidence tại `weather_disease_ai_v3/shap_explanation_fix_v1/`; thư mục này phải giữ nguyên vị trí. Không chạy những test có ghi lại evidence chỉ để kiểm tra việc dọn tài liệu.

Unit tests/typecheck/build không chứng minh giao diện đã được nghiệm thu trên browser. Bằng chứng lịch sử nằm trong [archive](../project_archive/INDEX.md); mỗi báo cáo ghi phạm vi và giới hạn kiểm tra của đợt đó.
