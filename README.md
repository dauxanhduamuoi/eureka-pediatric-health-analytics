# Eureka — Theo dõi sức khỏe trẻ em

> **Bản Public: source và model; dữ liệu bệnh nhân được sao lưu riêng.** Không có DB, `.env`, uploads, raw/processed datasets hoặc notebook output. Forecast **không chạy được** nếu thiếu workbook `train_history.xlsx` đi kèm đã được cấp hợp lệ; training/evaluation cũng cần dataset riêng. Không có dữ liệu giả thay thế và không retrain. Xem [phạm vi và hướng dẫn clone/LFS](PUBLIC_BACKUP.md), [model manifest](PUBLIC_MODEL_MANIFEST.json).


Eureka hỗ trợ phân tích dữ liệu lượt bệnh nhi, dự báo số lượt theo tháng và xếp hạng nhóm bệnh theo tuổi, giới tính, thời tiết. Hệ thống có không gian Admin/Staff và giao diện Parent dành cho phụ huynh.

Đây là công cụ hỗ trợ theo dõi, phân tích và tham khảo. Kết quả Weather AI không phải xác suất mắc bệnh cá nhân hoặc chẩn đoán; nội dung y khoa cần được đọc cùng mức độ bằng chứng, nguồn và trạng thái kiểm duyệt.

## Chức năng chính

- Dashboard và phân tích theo mùa, tuổi, giới tính, tháng, xu hướng, khu vực.
- Import Excel mã bệnh và bệnh nhân; quản lý dữ liệu theo quyền.
- Forecast số lượt theo nhóm bệnh/nhóm tuổi, dựa trên lịch sử dữ liệu đã import.
- Weather AI V3, giải thích SHAP, hướng dẫn và Kho kiến thức y khoa Reviewed/Auto.
- Quản lý nhóm bệnh tham gia Parent Top K trong **AI thời tiết → Nhóm bệnh hiển thị trên Parent**. Tạm ẩn nhóm bệnh không xóa hoặc retrain model.
- Báo cáo có preview, lịch sử, PDF và CSV; quản lý tài khoản và quyền theo chức năng.
- Parent chọn thông tin trẻ và vị trí, xem từng nhóm bệnh, điều hướng Trước/Tiếp và mở nội dung giải thích.

## Công nghệ và môi trường

- Frontend: React 18, TypeScript, Vite 6, Tailwind CSS, Recharts, Lucide; font Nunito lưu offline.
- Backend: FastAPI, SQLAlchemy, SQLite, Pydantic; pandas, scikit-learn/Joblib, LightGBM; ReportLab cho PDF.
- Dependency frontend theo [package.json](Frontend/package.json) và package lock; backend theo [requirements.txt](seasonal_disease_backend/requirements.txt).
- Môi trường đang có đã xác minh: Python **3.14.5**, Node.js **24.15.0**, npm **11.12.1**. Đây là mốc quan sát tại workspace, không phải kết quả kiểm thử mọi tổ hợp phiên bản. Engine của Vite đang cài: `^18.0.0 || ^20.0.0 || >=22.0.0`.

Source không bao gồm đầy đủ DB, dữ liệu nguồn và mọi model artifact khi clone sang máy khác. Cần được cấp các tài nguyên hợp lệ riêng. Không đưa dữ liệu bệnh nhân, DB hoặc secrets vào Git.

## Cài đặt và chạy local

Thực hiện từ root repository, trong hai cửa sổ PowerShell. [Hướng dẫn local](docs/local-development.md) mô tả cấu hình, điều kiện DB và hai chế độ startup.

Cài dependency backend, chỉ tạo `.venv` khi chưa có:

```powershell
cd seasonal_disease_backend
if (-not (Test-Path .venv)) { py -3.14 -m venv .venv }
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
```

Cần cấu hình `SECRET_KEY` riêng theo [app/config.py](seasonal_disease_backend/app/config.py), có DB/schema và model phù hợp. Tài liệu không cung cấp thông tin đăng nhập hoặc giá trị secrets.

Với workspace **đã có DB/schema được chuẩn bị**, chạy API ở chế độ local không chạy startup migration/seed/worker nền:

```powershell
cd seasonal_disease_backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --lifespan off
```

Mỗi khối `cd` bắt đầu từ root repository. Chế độ này không thay thế khởi tạo DB mới và không chạy worker sinh nội dung Auto. Chế độ startup đầy đủ có tác động DB, được giải thích riêng trong tài liệu local.

Cài và chạy frontend ở cửa sổ khác:

```powershell
cd Frontend
npm.cmd ci
npm.cmd run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

- Admin/Staff: http://127.0.0.1:5173/ — dùng tài khoản do quản trị viên cấp.
- Parent: http://127.0.0.1:5173/phu-huynh.
- API docs: http://127.0.0.1:8000/docs. Vite proxy `/api` tới cổng 8000.

## Hai luồng AI

**Forecast theo tháng** dùng model `seasonal_disease_forecast_model.pkl`, workbook lịch sử đi kèm và dữ liệu `predict_current` trong DB. Mốc dự báo mặc định là tháng sau kỳ mới nhất trong dữ liệu đã import; không mặc định là tháng hiện tại theo đồng hồ. Ví dụ minh họa: dữ liệu dừng ở `2025-04` thì kỳ tiếp theo là `2025-05`. UI hiện chọn horizon một tháng.

**Weather AI V3** dùng deployment LightGBM OVR gồm **221 model**, **45 feature**, horizon khóa **H14**. Input là nhóm tuổi, giới tính và ngữ cảnh thời tiết; vị trí Parent phục vụ lấy thời tiết. Score dùng để xếp hạng nhóm bệnh, không chuyển thành xác suất mắc bệnh trong cộng đồng. SHAP giải thích đóng góp của feature vào đầu ra model, không chứng minh quan hệ nhân quả.

## Dữ liệu và giới hạn

- Forecast cần dữ liệu lịch sử đủ theo contract; nhóm bệnh/tuổi chưa có trong tập huấn luyện được báo riêng. Dữ liệu import mới không tự retrain model.
- Model Forecast và `train_history.xlsx` phải là cặp tương ứng. Workbook này không phải file import thông thường của người dùng.
- Luồng hourly Weather AI dùng cửa sổ `D−6..D`, đủ 168 giờ theo `Asia/Ho_Chi_Minh`; dữ liệu thiếu hoặc không hợp lệ bị từ chối. Ngày D có thể chứa giờ dự báo của provider.
- Kết quả phụ thuộc độ đầy đủ, thời điểm và phạm vi dữ liệu. Tài liệu không đưa ra cam kết độ chính xác, hiệu quả lâm sàng hoặc khả năng ngoại suy chưa được chứng minh.
- Trạng thái nguồn, tự động tạo và kiểm duyệt của Medical Knowledge phải được giữ khi sử dụng kết quả.

## Cấu trúc chính

```text
README.md                    Điểm bắt đầu hiện hành
docs/                        Hướng dẫn local và dữ liệu/model
Frontend/                    Source UI, tests và assets
seasonal_disease_backend/     API, services, migrations, tests, artifact runtime
weather_disease_ai_v3/        Runtime V3 và tài liệu/nghiên cứu liên quan
weather_disease_ai_v2/        Nghiên cứu/legacy còn được bảo toàn
Train_5/                     Training artifacts và dữ liệu, giữ nguyên
uploads/                     Payload upload cần bảo vệ
project_archive/             Báo cáo, snapshot, tài liệu lịch sử và manifest
```

DB mà backend khai báo ở `seasonal_disease_backend/database.db`; file `database.db` tại root là một file riêng, chưa được hợp nhất hoặc thay thế. Không tự đổi vị trí DB, uploads, model hoặc dataset để dọn cấu trúc.

## Kiểm thử

Frontend, từ thư mục `Frontend/`:

```powershell
npm.cmd run test -- src/app/components/admin/AdminLayout.test.tsx --maxWorkers=1
npm.cmd run typecheck
npm.cmd run build
```

Backend dùng pytest; chọn tests/fixture cô lập trước khi chạy, không dùng DB vận hành làm DB test. Ví dụ file kiểm thử renderer PDF và hướng dẫn chọn phạm vi có trong [tài liệu local](docs/local-development.md#kiểm-thử). Build/unit tests không thay thế nghiệm thu trình duyệt thật. Các lệnh ở đây là hướng dẫn, không phải tuyên bố đã chạy lại trong task tổ chức tài liệu.

## Tài liệu và nguồn gốc

- [Chạy local, cấu hình và kiểm thử](docs/local-development.md).
- [Import dữ liệu và artifact mô hình](docs/data-and-models.md).
- [Manifest model V3](weather_disease_ai_v3/deployment/lightgbm_h14_weather/model_manifest.json), [feature schema](weather_disease_ai_v3/deployment/lightgbm_h14_weather/feature_schema.json), [locked config](weather_disease_ai_v3/deployment/lightgbm_h14_weather/locked_config.json).
- [Kho lịch sử và evidence](project_archive/INDEX.md); [báo cáo chuẩn hóa root V2](project_archive/ROOT_CLEANUP_V2_REPORT.md).
- [Nguồn gốc frontend](Frontend/README.md) được giữ nguyên cùng attribution/license. Một số README module là ghi chú của các giai đoạn trước; dùng README root và `docs/` làm điểm bắt đầu vận hành hiện hành. Các bản README root trước chuẩn hóa được lưu nguyên nội dung trong archive.
