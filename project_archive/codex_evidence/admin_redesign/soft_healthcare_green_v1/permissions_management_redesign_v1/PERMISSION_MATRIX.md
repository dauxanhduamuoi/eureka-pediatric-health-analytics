# Đối chiếu quyền — 17 section

Kiểm kê từ frontend `navigation.ts`, AuthContext, API client và **98 route APIRouter** trong source backend (bao gồm `options_router`). Không truy vấn DB thật. Đây là kiểm kê code, không phải pentest hoặc xác nhận cấu hình tài khoản thật.

Quy ước: Admin được dùng mọi `feature.*`; Staff cần key được lưu rõ ràng. Catalog backend `app/permissions.py` là nguồn chuẩn. Quyền quản trị nâng cao của Admin dùng `admin.*`; Admin legacy chưa có dòng quyền explicit vẫn giữ fallback hiện hành. Route Phân quyền chỉ Admin, không chấp nhận Staff dù có chuỗi `admin.*`.

| Chức năng | Route frontend | Permission / vai trò | API tiêu biểu | Backend guard thực tế | Trạng thái |
| --- | --- | --- | --- | --- | --- |
| Tổng quan | `/?section=dashboard` | `feature.dashboard` | `/api/dashboard/overview`, `/cases-by-year`; `/monthly-statistics`, `/top-disease-groups` | `require_permission`, endpoint dùng chung có `require_any_permission` | Guard chính giữ nguyên; đã sửa phụ thuộc quyền Reports của bilingual metadata |
| Nhập dữ liệu | `/?section=data-import` | `feature.data_import` | `/api/import/*` | Router dependency `require_permission('feature.data_import')` | Đã có; không thay nghiệp vụ import |
| Theo mùa | `/?section=seasonal` | `feature.seasonal` | `/api/dashboard/seasonal-summary`, `/seasonal-peak`, `/disease-season-comparison`, `/year-over-year` | Quyền seasonal; year-over-year cho seasonal hoặc disease_trend | Guard chính giữ nguyên; đã sửa guard label lookup dùng chung |
| Độ tuổi | `/?section=age-analysis` | `feature.age_analysis` | `/api/dashboard/cases-by-age-range`, `/disease-by-age-range`, `/periods` | age_analysis; periods cho nhiều feature liên quan | Guard chính giữ nguyên; đã sửa guard label lookup dùng chung |
| Theo tháng | `/?section=monthly-disease-analysis` | `feature.monthly_disease` | `/api/dashboard/top-disease-groups-by-month`, `/disease-percentage-by-month`, `/monthly-comparison`, `/summary-card` | `require_permission('feature.monthly_disease')` | Guard chính giữ nguyên; đã sửa guard metadata bilingual |
| Giới tính | `/?section=gender-analysis` | `feature.gender_analysis` | `/api/dashboard/cases-by-gender`, `/disease-by-gender`, `/disease-groups` | gender_analysis; disease-groups cho một số feature liên quan | Guard chính giữ nguyên; đã sửa guard metadata bilingual |
| Xu hướng | `/?section=disease-trend-analysis` | `feature.disease_trend` | `/api/dashboard/disease-trend`, `/year-over-year`, `/disease-groups` | disease_trend; endpoint dùng chung có any-permission | Guard chính giữ nguyên; đã sửa guard metadata bilingual |
| Dự báo | `/?section=forecast` | `feature.forecast` | POST `/api/forecast/run`; GET `/results`, `/group-summary`, `/accuracy` | `require_permission('feature.forecast')` | Quyền hiện hành gồm xem/chạy, không tự tách key hoặc cấp quyền mới |
| AI thời tiết | `/?section=weather-risk` | `feature.weather_risk` | `/api/weather-ai/status`, `/options`, POST `/predict-risk` | `require_permission('feature.weather_risk')` | Đã có; không sửa model/provider/ranking |
| Nhóm bệnh hiển thị cho phụ huynh | `/?section=parent-disease-visibility` | `feature.parent_disease_visibility` | GET/PATCH `/api/admin/parent-disease-visibility` | `require_permission` cùng key; service có version/CAS riêng | Đã có, không nằm trong default Staff; không thay policy/CAS |
| Kho kiến thức y khoa | `/?section=medical-knowledge` | Vai trò `admin`/`staff`, không có feature key riêng | `/api/medical-knowledge/*`; Auto settings/jobs; provider settings | Reviewed/search/draft/approve/publish và topic visibility dùng `require_staff_or_admin`; Auto settings/retry/regenerate/provider PATCH dùng `require_admin` | Role-based rõ trong source. Giữ nguyên, không tạo key giả hoặc đổi quyền duyệt/ẩn |
| Khu vực | `/?section=areas` | `feature.areas` cho trang và thống kê | `/api/areas/case-summary`, `/disease-summary`; `/provinces`, `/province-regions`, `/local-risks`, `/recommendations`, `/sync-defaults` | case/disease summary cần feature.areas; bốn GET còn lại không có auth dependency; sync-defaults cần `admin.assign_permissions` | Ghi nhận ranh giới legacy/public và key sync dùng lại; không sửa thống kê địa lý hoặc âm thầm thay policy |
| Báo cáo | `/?section=reports` | `feature.reports` | `/api/reports/by-age-months`, `/by-month-year`, `/disease-bilingual` | Hai endpoint dữ liệu cần feature.reports; label metadata cần một feature được cấp | Đã test Staff có dashboard lấy được labels nhưng vẫn bị 403 khi gọi dữ liệu báo cáo |
| Phân quyền | `/?section=permissions` | Role Admin; action keys bên dưới | `/api/admin/users`, `/roles`, `/permissions`, user mutations/sessions | Read cần `require_admin`; writes cần `require_admin_permission` tương ứng | Đã áp dụng và test giới hạn ủy quyền, revision/CAS và bảo vệ quản trị cuối cùng |
| Thông báo | `/?section=notifications` | Tài khoản đã đăng nhập; dữ liệu notification local | Local notification store | Không có API quản trị user được mở thêm | Không tạo permission key mới |
| Cài đặt | `/?section=settings` | Đã đăng nhập; preferences local | Local preferences | Các chức năng quản trị đã tách sang trang Phân quyền | Giữ nguyên |
| Tài khoản | `/?section=account` | Đã đăng nhập, dữ liệu của chính mình | `/api/auth/me`, profile/password/session endpoints | `get_current_user` và ownership/session filtering hiện có | Không thay Auth/JWT/session policy |

### Năm quyền quản trị tài khoản hiện có

| Key | Endpoint/hành động | Guard |
| --- | --- | --- |
| `admin.create_user` | POST `/api/admin/users`, `/users/bulk` | Admin + key; candidate thêm giới hạn cấp quyền trong phạm vi của actor |
| `admin.assign_permissions` | PATCH `/users/{id}/role`, `/permissions` | Admin + key; candidate kiểm tra quyền thay đổi, revision, last-manager |
| `admin.toggle_user` | PATCH `/users/{id}/active` | Admin + key; giữ cấm tự khóa và thu hồi session; candidate thêm revision/last-manager |
| `admin.reset_password` | POST `/users/{id}/reset-password` | Admin + key; giữ thu hồi session; candidate thêm validation/revision |
| `admin.delete_user` | DELETE `/users/{id}` | Admin + key; giữ cấm tự xóa; candidate thêm If-Match/last-manager |

Không phát hiện key catalog nào hoàn toàn không có chỗ dùng trong phần source đã kiểm kê. Có **17 key**: 11 feature mặc định, 1 feature chuyên biệt, 5 admin. Tên hiển thị cũ có “Import dữ liệu”, “Parent”; candidate chỉ chuẩn hóa label/description, không đổi mã.

### Findings có bằng chứng

1. `_set_user_permissions` cũ chỉ kiểm tra key hợp lệ/role của target. Admin chỉ có `admin.assign_permissions` có thể gửi thêm admin key mà chính họ không có. Role promotion cũ còn dùng toàn bộ `ADMIN_PERMISSION_CODES`. Candidate hạn chế các thay đổi admin grant theo quyền thực tế của actor.
2. User permissions editor cũ sửa trực tiếp `users` khi click checkbox. Đóng dialog không khôi phục dữ liệu trong bộ nhớ. Frontend đã sửa bằng `permissionDraft` độc lập.
3. Endpoint mutation cũ không có revision/CAS. Candidate thêm fingerprint không lưu cột DB và transaction khóa writer SQLite trước khi đọc snapshot; hai cập nhật đồng thời dùng cùng revision có một 200, một 409 trong test.
4. Cấm tự hạ role/khóa/xóa đã có, nhưng vẫn có thể loại bỏ quyền assign cuối cùng. Candidate bảo vệ Admin active có khả năng quản lý quyền cuối cùng.
5. `ensureBilingualMap()` được các trang phân tích gọi, nhưng `/api/reports/disease-bilingual` chỉ cho feature.reports. Candidate cho phép metadata với một feature được cấp, vẫn giữ guard Reports cho dữ liệu báo cáo.
6. GET legacy `/api/areas/local-risks` và `/recommendations` không có auth dependency; provinces/province-regions cũng public. Không khẳng định đây là policy mới hoặc đã được pentest. Không thay đổi trong task vì có ràng buộc không sửa thống kê địa lý; cần quyết định riêng nếu muốn thu hẹp phạm vi public. `/sync-defaults` đang dùng lại admin.assign_permissions, được giữ tương thích.

**Cập nhật cuối:** Đã xác minh PID 37800, PID 20368 và listener cổng 8000 đều dừng; không có tiến trình Uvicorn liên quan. Cả 7 candidate đã được đối chiếu hash và source đích rồi áp dụng vào workspace. Các mô tả “candidate” phía trên chỉ bản vá đã được áp dụng này. Backend workspace đạt **48 tests** (35 quản trị tài khoản, 13 visibility), frontend đạt **81 tests**; typecheck/build đạt. Không khởi động server hoặc mở DB thật.

Giới hạn: kiểm thử feature policy dùng dependency thật trong test app cô lập, không chạy từng nghiệp vụ/model của 17 trang. Bốn route khu vực legacy/public ở trên được ghi nhận, không thay đổi. Revision là trường tùy chọn để tương thích client cũ; UI hiện tại gửi revision, client cũ bỏ qua token sẽ không có bảo vệ stale snapshot. Chưa xác minh hình ảnh/E2E bằng trình duyệt thật.
