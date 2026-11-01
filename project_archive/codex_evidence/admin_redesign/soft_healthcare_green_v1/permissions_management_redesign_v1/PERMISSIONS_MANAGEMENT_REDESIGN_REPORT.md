# Hoàn thiện quản lý người dùng và phân quyền Eureka

Kết luận: **PASS_WITH_FINDINGS**. Frontend đã hoàn thành được giữ nguyên; 7 backend candidate đã áp dụng và kiểm thử trên source workspace. Không khởi động backend hoặc thao tác tài khoản/DB thật. Chưa xác minh visual/E2E bằng trình duyệt thật; có ranh giới API khu vực legacy/public được ghi nhận ngoài phạm vi sửa.

## Trạng thái tiếp tục sau gián đoạn

Đã kiểm tra độc lập bằng Win32_Process và TCP listener: PID **37800**, PID **20368** không còn tồn tại; không có tiến trình Python/Uvicorn liên quan và không có listener cổng **8000**. Kiểm tra trước khi áp dụng và sau khi kiểm thử đều an toàn. Không kill/restart/start server.

7 file trong `C:\Users\LENOVO\AppData\Local\Temp\eureka-permissions-review-m38c67zv` khớp SHA256 của manifest. Bốn source đích có sẵn khớp baseline, ba file mới chưa tồn tại trước khi áp dụng. Hash của cả 7 file sau áp dụng tiếp tục khớp candidate. Không chép các stub thử nghiệm `app/database.py`, `app/config.py` từ Temp. Không có xung đột source.

Toàn bộ `Frontend/src` khớp checkpoint `frontend_before_backend_apply.json`: **không sửa lại bất kỳ file frontend nào trong lượt tiếp tục này**, bao gồm 10 file của phần giao diện đã hoàn thành.

## Giao diện trước và sau

Trước: form tạo tài khoản nằm cạnh bảng làm bảng hẹp; checkbox quyền và mã kỹ thuật dày; chọn quyền sửa trực tiếp danh sách user trong bộ nhớ nên đóng mà không lưu vẫn để lại thay đổi hiển thị.

Sau: bảng toàn chiều ngang, tìm theo tên đăng nhập/họ tên, lọc vai trò/trạng thái, phân trang; tạo đơn/hàng loạt trong drawer riêng. Permission editor có nhóm, tìm kiếm, số quyền đã chọn, thu gọn nhóm và nhãn tiếng Việt. Draft tách khỏi dữ liệu đã lưu, có Lưu/Hủy và xác nhận bỏ thay đổi. Các thao tác khóa/reset/xóa có xác nhận, trạng thái chờ và lỗi; chỉ thông báo thành công sau API thành công. Xuất danh sách tài khoản hàng loạt được giữ nguyên.

Drawer rộng tối đa 760px và không vượt viewport; form/checklist chuyển một cột trên màn hình nhỏ; bảng có vùng cuộn ngang riêng. Có focus trap, Escape, trả focus và khóa đóng khi đang lưu. Đây là xác nhận từ code/tests; chưa phải xác nhận hình ảnh thực tế tại 1440/1280/768/390px.

Lựa chọn bảng rộng, toolbar tìm/lọc và tách form chi tiết phù hợp với hướng dẫn [Carbon Data table](https://www.carbondesignsystem.com/building-blocks/core/components/data-table/guidelines). Phần áp dụng cụ thể là quyết định cho giao diện hiện có; giữ Nunito, tokens màu và shell Admin.

## Kiến trúc quyền và đối chiếu 17 section

Nguồn chuẩn vẫn là `app/permissions.py`; bảng `User`, `UserPermission`, `UserProfile`, `LoginSession` giữ nguyên. Auth/JWT và dependency kiểm tra quyền hiện có được tái sử dụng. Không thêm hệ thống quyền song song, key mới hoặc cột DB.

Đã đối chiếu **17 section** với navigation, AuthContext, API client và kiểm kê **98 route APIRouter**: xem [PERMISSION_MATRIX.md](PERMISSION_MATRIX.md). Có 17 permission keys: 11 feature mặc định, 1 feature visibility chuyên biệt, 5 admin. Số section và số keys bằng nhau nhưng không ánh xạ một-một: Medical Knowledge dùng role; Account/Settings/Notifications dùng chính sách tài khoản/local hiện hành.

Giữ nguyên Admin dùng mọi feature, Staff cần feature tương ứng; trang Phân quyền chỉ Admin và từng mutation cần admin key riêng. Fallback Admin legacy không có explicit grants được giữ tương thích. `feature.parent_disease_visibility` không được thêm vào default Staff. Không đọc hoặc sửa grants tài khoản thật.

## Lỗi đã xác nhận và xử lý

- Admin hạn chế trước đây có thể cấp admin key mình không có; role promotion cũng cấp toàn bộ admin keys. Nay kiểm tra phạm vi ủy quyền tại backend, promotion chỉ cấp bộ admin key actor được phép cấp. UI phản ánh giới hạn tương ứng.
- Thiếu bảo vệ snapshot khi hai phiên sửa user: thêm revision fingerprint và transaction khóa writer SQLite trước khi đọc/ghi. Hai yêu cầu cùng revision được test đồng thời: một 200, một 409.
- Thiếu bảo vệ khả năng quản trị cuối cùng: ngăn mutation làm mất Admin active cuối có quyền quản lý phân quyền. Giữ cấm tự hạ role/khóa/xóa.
- Payload thiếu/không hợp lệ: validate username, role, catalog, password tối thiểu 6 ký tự và tối đa 72 byte UTF-8, boolean/count; missing permissions không âm thầm xóa grants. Bulk thất bại rollback toàn bộ, lỗi DB trả thông báo an toàn.
- Đổi sang cùng role trước đây có thể reset quyền riêng; nay giữ nguyên quyền nếu role không đổi.
- `/api/reports/disease-bilingual` được các trang phân tích dùng chung nhưng trước đây bắt buộc `feature.reports`. Chỉ guard metadata tên bệnh được đổi sang một feature đã được cấp; hai endpoint dữ liệu Reports vẫn yêu cầu Reports. Có test trực tiếp Staff Dashboard lấy được labels nhưng không lấy được dữ liệu báo cáo.
- Permission draft frontend không còn sửa trực tiếp users khi chưa lưu; hủy/mở lại khôi phục dữ liệu đã lưu.

Chỉ chuẩn hóa label/group/description của catalog. Không đổi mã quyền hoặc default grants; không tách thêm quyền chạy/xem Forecast, không thay quyền Reviewed/Auto Medical Knowledge.

## File của toàn task

Frontend đã hoàn thành từ trước, giữ nguyên trong lượt tiếp tục:

1. `Frontend/src/app/components/PermissionsPage.tsx`
2. `Frontend/src/app/components/PermissionsPage.test.tsx`
3. `Frontend/src/app/components/admin/permissions/PermissionControls.tsx`
4. `Frontend/src/app/components/admin/permissions/PermissionDialogs.tsx`
5. `Frontend/src/app/components/admin/permissions/UserAccountForms.tsx`
6. `Frontend/src/app/components/admin/permissions/useUserAdministration.ts`
7. `Frontend/src/lib/api.ts`
8. `Frontend/src/app/components/admin/permissions/UserManagementDialog.tsx` — mới
9. `Frontend/src/app/components/admin/permissions/UserTable.tsx` — mới
10. `Frontend/src/app/components/admin/permissions/permissions.css` — mới

Backend áp dụng đúng 7 candidate:

1. `seasonal_disease_backend/app/routers/admin.py` — router mỏng, giữ URL/dependency
2. `seasonal_disease_backend/app/routers/reports.py` — guard metadata dùng chung
3. `seasonal_disease_backend/app/permissions.py` — catalog labels
4. `seasonal_disease_backend/app/schemas.py` — UserOut thêm revision tùy chọn
5. `seasonal_disease_backend/app/services/user_administration.py` — mới, transaction/policy user mutations
6. `seasonal_disease_backend/app/user_administration_schemas.py` — mới, validation payload
7. `seasonal_disease_backend/tests/test_user_administration.py` — mới, test app/DB cô lập

Evidence bổ sung/cập nhật nằm trong thư mục báo cáo này. Patch `BACKEND_CANDIDATE_NOT_APPLIED.patch` giữ tên lịch sử từ lúc bị chặn bởi reload; trạng thái hiện hành nằm trong `candidate_manifest.json`, không còn là “chưa áp dụng”.

## API và tương thích

Giữ các URL quản lý user/roles/permissions/sessions và response fields cũ. User response thêm `revision` là fingerprint, không thêm dữ liệu mật khẩu. Mutation nhận `expected_revision`; DELETE nhận `If-Match`. UI hiện tại gửi token từ snapshot đang sửa. Token cũ trả 409, không ghi đè dữ liệu mới.

Revision tùy chọn để client cũ vẫn gọi được: **client không gửi token không có bảo vệ stale snapshot**. Validation chặt hơn có thể trả 400/422 cho payload sai từng được chấp nhận trước đây; đây là sửa có chủ đích. SQLite là cấu hình thực tế và dialect đã kiểm thử; không tuyên bố concurrency an toàn trên mọi DB dialect.

## Kiểm thử trên workspace sau khi áp dụng

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Backend user administration | **35 PASS** | `backend-workspace-tests.log` |
| Backend Parent disease visibility | **13 PASS** | cùng log, tổng **48 PASS** |
| Frontend permissions + navigation/Admin regression, 6 test files | **81 PASS** | `frontend-tests.log` |
| Typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |
| Visual/browser E2E | **NOT VERIFIED** | browser access host unavailable |

Backend tests dùng FastAPI test app chỉ ghép admin/reports routers, SQLite tại pytest temp và memory; không import `app.main` hoặc chạy lifespan. Guard chặn mọi kết nối SQLite tới DB workspace: **49 kết nối test được phép, 0 lần cố mở DB thật**; xem `backend_db_guard.json`. Có real password hash/verify trên user giả trong DB test; không sử dụng credentials thật.

Đã test 401/403, role và action key, Staff thiếu quyền, invalid payload/catalog, create/duplicate/bulk rollback, grant/revoke, role change, lock/unlock/reset/delete, session revoke, tự bảo vệ/last manager, DB failure, stale revision và hai request đồng thời. Feature policy probes dùng dependency thật, không gọi model/provider hay chạy mọi nghiệp vụ của 17 trang. Visibility regression giữ guard chuyên biệt và CAS hiện có.

Frontend tests bao gồm tìm/lọc/phân trang, tạo đơn/hàng loạt bằng mocks, Lưu/Hủy draft, dirty close, API 401/403/409/500, action confirmations, limited Admin, route/section guards và shell Admin/mobile. Lần chạy đầu nhiều worker từng có timeout import lazy Dashboard; lần chạy cuối giới hạn `--maxWorkers=2` đạt 81/81, không chỉnh test unrelated để che lỗi. Backend còn 675 deprecation warnings từ stack hiện có; không có test fail.

## Findings và giới hạn còn lại

1. **BROWSER NOT VERIFIED:** không có browser host để kiểm tra ảnh hoặc E2E thật. Không suy ra visual PASS từ unit tests/build.
2. Bốn GET khu vực legacy/public (`provinces`, `province-regions`, `local-risks`, `recommendations`) không có auth dependency; `sync-defaults` dùng lại admin.assign_permissions. Đã ghi rõ trong matrix; không sửa vì guardrail không thay thống kê địa lý và cần xác nhận policy riêng. Không tuyên bố toàn bộ API hệ thống đã kín quyền/pentest.
3. Revision tùy chọn cho client cũ như trên; concurrency tests áp dụng SQLite.
4. Fingerprint Git index trong baseline cũ là hash dữ liệu rỗng nên không đủ làm bằng chứng byte-for-byte của index gốc. Đã bỏ kết luận cũ “index_unchanged=true”; kiểm tra cuối `git diff --cached` rỗng, không có staged changes, không thực hiện lệnh stage hoặc thao tác Git bị cấm.

## Safety closure

- Hai DB file hiện có giữ nguyên SHA256 so với ngay trước áp dụng; không mở DB thật qua SQLite/SQLAlchemy để test. Không thay tài khoản/quyền thật, không migration/import Excel.
- 528 file baseline được đối chiếu: chỉ 7 file frontend và 4 file backend có sẵn thuộc task khác hash; 3 frontend mới và 3 backend mới được liệt kê ở trên. Các file baseline ngoài phạm vi, `.env` và 221 model deployment giữ nguyên. Frontend không đổi so với checkpoint hoàn thành.
- Không sửa Parent, Weather AI/Forecast AI, SHAP, Medical Knowledge business, thống kê địa lý, sidebar/topbar, Graduation hoặc Excel. Không retrain/thay model.
- Không tự start/restart/kill backend; PIDs cũ và port 8000 vẫn dừng sau kiểm thử.
- Không reset/stash/clean/restore/checkout/stage/commit/push. HEAD giữ nguyên; staged diff rỗng. Giữ mọi thay đổi có trước.
- Kiểm thử tiếp tục này offline, không gửi dữ liệu hoặc credentials ra ngoài; không thêm dependency. Tham khảo thiết kế công khai được thực hiện ở phần frontend trước đó.

Triển khai và kiểm thử frontend/backend trong phạm vi đã hoàn tất; kết luận **PASS_WITH_FINDINGS**, không phải xác minh DB thật hoặc visual E2E. Dừng tại đây.
