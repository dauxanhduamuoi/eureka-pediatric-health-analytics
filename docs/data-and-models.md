# Import dữ liệu và artifact mô hình

Tài liệu này hợp nhất phần còn hữu ích của hai README dữ liệu/model trước đây, đối chiếu với source hiện tại. Nguyên bản đầy đủ nằm trong [archive README cũ](../project_archive/legacy_docs/root_readmes_v2/). Không thực hiện import, đổi model hoặc thay DB trong đợt chuẩn hóa tài liệu.

## Import dữ liệu người dùng

Luồng dữ liệu chính:

1. Import Excel `DS-MaBenh`, kiểm tra mapping mã bệnh sang nhóm bệnh.
2. Import Excel `DS-BenhNhan` để phân tích và cung cấp lịch sử `predict_current` cho Forecast.
3. Kiểm tra dữ liệu và kỳ import trước khi phân tích/dự báo.

[Router import](../seasonal_disease_backend/app/routers/import_data.py) có `/api/import/disease-codes` và `/api/import/predict-current`, chịu kiểm tra quyền. Dữ liệu mã bệnh lưu trong `disease_codes`; dữ liệu bệnh nhân và thống kê tháng của luồng người dùng mang `data_type='predict_current'` theo [import service](../seasonal_disease_backend/app/services/import_service.py).

Các chức năng nhập hướng dẫn phụ huynh hoặc mapping khu vực là nghiệp vụ riêng theo giao diện/quyền. Không dùng workbook train của model thay cho luồng import dữ liệu người dùng. Không đưa dữ liệu bệnh nhân vào source, manifest tài liệu hoặc file minh họa công khai.

## Forecast theo tháng

[forecast_service.py](../seasonal_disease_backend/app/services/forecast_service.py) dùng:

```text
seasonal_disease_backend/app/ml/
├── seasonal_disease_forecast_model.pkl
└── seasonal_forecast_data/
    └── train_history.xlsx
```

Workbook đi kèm model cần hai sheet `DS-BenhNhan` và `DS-MaBenh`. Backend đọc workbook, xử lý thành thống kê tháng trong RAM và cache theo đường dẫn/mtime. Nguồn này tách với dữ liệu `predict_current` trong DB; import qua UI không tự thay model hoặc workbook đi kèm.

Feature Forecast dùng nhóm bệnh, tuổi, lịch và các lag/rolling từ lịch sử số lượt. Mốc `auto` lấy kỳ lớn nhất trong `predict_current`, rồi dự báo kỳ sau đó. UI hiện dùng horizon một tháng; API khai báo phạm vi 1–3 tháng. Phải có đủ lịch sử liên tiếp theo validation; không suy diễn thiếu tháng thành chuỗi đầy đủ. Những tổ hợp nhóm bệnh/tuổi ngoài tập model đã học được báo riêng.

Model và workbook phải tương ứng. Việc thay cặp artifact, retrain hoặc reload backend là quy trình phát hành riêng có kiểm thử; không phải bước dọn repository. Không tải/deserialize model chỉ để xem thông tin khi kiểm kê tài liệu.

Tài liệu cũ có gợi ý xóa một số bảng DB và một API kiểm tra model-data. Không đưa các bước đó vào hướng dẫn vận hành hiện hành: không suy ra bảng có thể drop từ mô tả cũ, và router hiện không khai báo endpoint model-data/status. Giữ nguyên DB và xác minh schema bằng quy trình riêng khi có yêu cầu.

## Weather AI V3

Deployment mặc định ở `weather_disease_ai_v3/deployment/lightgbm_h14_weather/`, được cấu hình trong [app/config.py](../seasonal_disease_backend/app/config.py):

- [model_manifest.json](../weather_disease_ai_v3/deployment/lightgbm_h14_weather/model_manifest.json): 221 model theo nhóm bệnh.
- [feature_schema.json](../weather_disease_ai_v3/deployment/lightgbm_h14_weather/feature_schema.json): 45 feature và thứ tự khóa.
- [locked_config.json](../weather_disease_ai_v3/deployment/lightgbm_h14_weather/locked_config.json): LightGBM OVR, H14.

Model xếp hạng nhóm bệnh theo ngữ cảnh tuổi/giới/thời tiết. H14 là horizon mô hình; score không phải xác suất mắc bệnh cá nhân. Thông tin bệnh viện hoặc tỉnh không được dùng làm số liệu thay thế khi provider thiếu thời tiết trên Parent.

Validation hourly hiện yêu cầu cửa sổ `D−6..D` đủ 168 giờ theo `Asia/Ho_Chi_Minh`; mưa bằng 0 hợp lệ được phân biệt với thiếu giá trị. Không cắt giờ dự báo của ngày D để thay đổi contract. Xem [weather_ai_features.py](../seasonal_disease_backend/app/services/weather_ai_features.py).

Visibility do operator cấu hình chỉ ảnh hưởng việc tham gia Parent Top K; không xóa, tắt hoặc retrain các model. SHAP thể hiện đóng góp vào model, không phải bằng chứng nhân quả. Medical Knowledge có nguồn và trạng thái kiểm duyệt riêng.

## Tài nguyên được bảo vệ

- DB backend, file DB ở root, uploads và dữ liệu nghiên cứu không được tự gộp, chuyển hoặc xóa.
- `Train_5/`, `weather_disease_ai_v2/` và các dataset/model cũ còn giá trị nguồn gốc, nghiên cứu hoặc khôi phục; không kết luận hết dùng từ tên thư mục.
- `ThucTap-main.zip` chưa được kiểm kê nội dung hoặc xác nhận là bản khôi phục thừa; giữ nguyên.
- README module từ giai đoạn chuẩn bị dữ liệu có thể chưa mô tả trạng thái deployment hiện tại. Dùng manifest/config runtime để xác định contract; giữ lịch sử và attribution.

Xem [README chính](../README.md), [hướng dẫn local](local-development.md) và [archive](../project_archive/INDEX.md).
