# Eureka — Bộ lọc danh sách nhóm bệnh Parent

Ngày: 26/10/2026. **Kết luận: PASS_WITH_FINDINGS.** Chức năng và kiểm thử đạt; browser thật chưa xác minh, hash toàn DB có biến động dù các bảng nghiệp vụ được kiểm tra không đổi.

## Files đã sửa

1. Frontend/src/app/components/ParentDiseaseVisibilitySettings.tsx — chuyển ba bộ đếm thành tabs, kết hợp bộ lọc với search, keyboard/ARIA và empty states.
2. Frontend/src/app/components/ParentDiseaseVisibilitySettings.test.tsx — cập nhật nhãn counters và thêm 11 cases, tổng 18 tests component.

Không tạo trang mới hoặc sửa frontend API, route/permission wrapper, backend, model, SHAP hay Medical Knowledge. Các thay đổi chưa commit có trước được giữ nguyên.

## Audit và hoạt động

API GET/PATCH hiện có đã trả đầy đủ items, enabled, total_count, enabled_count, disabled_count và version. Vì vậy không cần sửa API hoặc thêm request:

| Tab | Điều kiện | Số đếm |
| --- | --- | --- |
| Tất cả — mặc định | Toàn bộ items | total_count từ API |
| Đang hiển thị | item.enabled === true | enabled_count từ API |
| Đã ẩn | item.enabled === false | disabled_count từ API |

Một danh sách settings.items duy nhất được lọc theo trạng thái **AND** từ khóa ID/tên/mã bệnh. Chuyển tab chỉ đổi state frontend, không gọi GET/PATCH hoặc ghi DB. Số đếm là toàn bộ cấu hình API, không phải số kết quả tìm kiếm.

Tab và từ khóa được giữ khi đổi tab, lưu, bấm nút Tải lại hoặc reload do CAS conflict. Sau lưu thành công vẫn dùng response đầy đủ của API như trước; nhóm chuyển trạng thái tự rời tab đang chọn, số đếm cập nhật và thông báo cũ giữ nguyên. Không tự chuyển tab hoặc xóa từ khóa.

Danh sách trống phân biệt không có nhóm trong tab và không có kết quả phù hợp từ khóa. Font/palette và kiểu badge bo tròn hiện có được giữ; tab được chọn có ring rõ ràng. Tablist flex-wrap cho màn hình hẹp, không thêm chiều rộng cố định.

Tabs dùng button/role=tab, aria-selected, shared tabpanel và roving tabIndex. Phím trái/phải chuyển vòng, Home/End đến đầu/cuối và focus theo tab mới. Đây là dữ liệu local nên chọn tab bằng bàn phím cập nhật ngay. Enter/Space dùng hành vi button gốc.

## Quyền và nghiệp vụ

Không sửa load/requestChange/confirmChange/cancelChange, payload enabled/expected_version/reason hoặc xử lý lỗi hiện có. Không optimistic toggle. Quyền route và API vẫn là thẩm quyền cũ: Admin theo chính sách hiện tại, Staff cần feature.parent_disease_visibility. Không cấp quyền mới, không bỏ qua kiểm tra API.

403/500 không cập nhật giả danh sách/counters hoặc báo thành công. 409 giữ thông báo conflict và tải cấu hình mới; tab/search vẫn được giữ. Backend regression kiểm tra quyền Staff, CAS và Parent eligibility trên DB RAM/snapshot cô lập; không thử bật/tắt nhóm thật.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Ba tabs, số đếm thật từ fixture và mặc định All | PASS |
| Search ID/tên/mã + trạng thái, giữ từ khóa | PASS |
| Bật lại trong Hidden / tạm ẩn trong Visible | PASS, cập nhật danh sách/count/version đúng |
| Tải lại và CAS reload giữ filter/search | PASS |
| Lỗi GET 403, PATCH 403/500/409, không success giả | PASS |
| Empty states, keyboard arrows/Home/End/focus/ARIA | PASS trong jsdom |
| Fixture manifest 221 groups | PASS, không hard-code số lượng trong production |
| Targeted component/navigation/Settings tests | **34 PASS** |
| Toàn bộ frontend (gồm Parent, SHAP, MK, Admin) | **448 PASS / 19 files** |
| Regression backend permissions/CAS/Parent eligibility | **17 PASS**, DB cô lập |
| TypeScript typecheck / production build | **PASS / PASS**, 2313 modules |
| git diff --check | **PASS** |
| Browser thật, visual desktop/mobile và phím vật lý | **NOT VERIFIED** |

Lệnh chạy trong Frontend:

~~~powershell
npm.cmd test -- src/app/components/ParentDiseaseVisibilitySettings.test.tsx src/app/App.navigation.test.tsx src/app/components/Settings.parentDiseaseVisibility.test.tsx
npm.cmd test
npm.cmd run typecheck
npm.cmd run build
~~~

Trong seasonal_disease_backend, với PYTHONDONTWRITEBYTECODE=1:

~~~powershell
.venv/Scripts/python.exe -B -m pytest tests/test_parent_disease_visibility.py tests/test_weather_ai_parent_eligibility.py -q -p no:cacheprovider
~~~

Backend tests dùng FastAPI cô lập + SQLite RAM, không app.main/lifespan; không migration DB thật. Có warnings deprecation sẵn có của Starlette/httpx/datetime.utcnow và LF/CRLF từ Git, không gây fail và không sửa ngoài phạm vi.

## Safety closure

- Snapshot 499 protected files trước/sau: chỉ đúng hai frontend files trên thay đổi; backend source/tests/migrations, model/manifest/45 features/H14, data, .env, Excel, font/styles và các chức năng khác không đổi.
- Không sửa Graduation; không retrain/import/migration; không start/stop/restart server hoặc external network.
- Không gọi API quản lý visibility thật hay bật/tắt nhóm bệnh thật. Tests frontend dùng mocks; các thao tác ghi của backend tests chỉ ở DB test cô lập.
- Kết nối snapshot DB thật là mode=ro + query_only, total_changes=0. Cả 32 bảng snapshot (trừ login_sessions) giữ nguyên count/hash, gồm cấu hình/audit visibility và Medical Knowledge.
- **FINDING:** SHA256 toàn file DB trước/sau khác nhau. Không đủ bằng chứng quy nguồn biến động; không tuyên bố toàn DB bất biến hoặc chỉ do một bảng cụ thể. Không có thao tác ghi DB thật từ task và không tự hoàn tác thay đổi ngoài task.
- HEAD và staged diff giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout. Không xóa thay đổi trước đó.

Evidence: baseline.json và safety_closure.json tại thư mục này; test cases nằm trong module test hiện có. Không rải artifacts ở repo root.

**Đã hoàn tất đúng phạm vi. DỪNG, không redesign hoặc refactor thêm.**
