# EUREKA — Tổ chức lại menu AI thời tiết

Ngày 24/10/2026. Kết luận: **PASS_WITH_FINDINGS** — chức năng/route/quyền và tests đạt; chưa xác minh browser thực tế, DB đang có hoạt động đồng thời.

## 1. Menu trước/sau

Trước: “AI thời tiết” và “Kho kiến thức y khoa” là hai mục độc lập; editor “Nhóm bệnh hiển thị trên Parent” nằm trong Cài đặt.

Sau:

```text
AI thời tiết [mở/thu gọn]
├─ Tổng quan AI thời tiết
├─ Nhóm bệnh hiển thị trên Parent
└─ Kho kiến thức y khoa
Cài đặt [mục riêng, giữ nguyên phần còn lại]
```

Giữ icon/palette/font hiện có; mục con thụt vào, active màu xanh và `aria-current=page`. Menu cha có icon/mũi tên, `aria-expanded`, `aria-controls`; tự mở khi vào trực tiếp, remount hoặc history chuyển sang route con. Có thể chủ động thu gọn khi đang ở trang con. Thanh điều hướng có `min-height:0`, cuộn dọc; header/footer sidebar không co mất chỗ. Khi sidebar thu thành icon rail, các mục con vẫn có icon, accessible name và tooltip; bổ sung nhãn cho nút mở sidebar trên mobile.

Chỉ hiển thị các mục con thực sự được phép; không ép mọi mục con phải có quyền của trang Tổng quan. Nhóm cha không hiện khi không có mục con nào khả dụng.

## 2. Route và liên kết cũ

Tái sử dụng cơ chế query `section` và browser history hiện có, không thêm router/framework mới:

| Trang | URL |
| --- | --- |
| Tổng quan AI thời tiết | `/?section=weather-risk` — giữ nguyên |
| Nhóm bệnh hiển thị trên Parent | **`/?section=parent-disease-visibility`** — mới |
| Kho kiến thức y khoa | `/?section=medical-knowledge` — giữ nguyên |
| Cài đặt | `/?section=settings` — giữ nguyên |

Trước đây không có route độc lập cho visibility. Nếu có bookmark dùng anchor của tiêu đề cũ `?section=settings#parent-disease-visibility-title`, hook chuyển bằng `replaceState` sang route mới, giữ query không liên quan, vẫn kiểm tra quyền. Link Cài đặt không có anchor vẫn mở Cài đặt bình thường. History/popstate/hashchange tiếp tục hoạt động.

## 3. Tái sử dụng và nghiệp vụ

- Trang mới `ParentDiseaseVisibilityPage` chỉ kiểm tra quyền rồi render **nguyên component `ParentDiseaseVisibilitySettings`**. Source component editor không thay đổi byte nào.
- Tái sử dụng `getParentDiseaseVisibility`, `updateParentDiseaseVisibility`, cấu hình version/CAS, tìm kiếm, xác nhận, lý do, Tải lại, thông báo và xử lý 403/409 hiện có.
- Không nhân đôi editor, API hay state lưu trữ; bỏ import/render editor và điều kiện riêng khỏi Settings. Vào lại trang tải cấu hình đã lưu từ API như trước, không reset DB hoặc cấu hình.
- Chỉ tạm ẩn khả năng tham gia Parent Top K; không xóa/tắt/retrain model.
- Kho kiến thức y khoa chỉ chuyển vị trí menu: component, route, role gate, Reviewed/Auto, evidence, nguồn và API giữ nguyên.

## 4. Bảo toàn quyền

`TAB_PERMISSIONS['parent-disease-visibility'] = 'feature.parent_disease_visibility'`, dùng lại `canAccessTab/canUse` với quy tắc Admin hiện có. Staff cần đúng quyền chuyên biệt; không cấp thêm quyền hay sửa role backend.

Ba lớp bảo vệ:

1. Sidebar lọc theo quyền từng route.
2. URL resolver không chọn trang visibility khi thiếu quyền; page guard độc lập cũng chặn trước khi mount editor, kể cả render trực tiếp hoặc bị thu hồi quyền khi đang mở.
3. API GET/PATCH giữ nguyên `require_permission('feature.parent_disease_visibility')`. Backend regression xác nhận Admin/Staff có quyền được phép, Staff thiếu quyền bị từ chối; không chỉ dựa vào ẩn menu.

## 5. Files thay đổi trong task

Source hiện hữu sửa:

- `Frontend/src/app/App.tsx`
- `Frontend/src/app/AppPages.tsx`
- `Frontend/src/app/navigation.ts`
- `Frontend/src/app/useAdminSectionNavigation.ts`
- `Frontend/src/app/components/Settings.tsx`
- `Frontend/src/i18n/locales/vi.ts`
- `Frontend/src/i18n/locales/en.ts`

Source mới:

- `Frontend/src/app/components/AdminMainNavigation.tsx`
- `Frontend/src/app/components/ParentDiseaseVisibilityPage.tsx`

Tests:

- Thêm `Frontend/src/app/App.navigation.test.tsx`.
- Sửa `Frontend/src/app/components/Settings.parentDiseaseVisibility.test.tsx` để xác nhận không còn editor trùng cho mọi quyền.
- Bổ sung `Frontend/src/app/components/ParentDiseaseVisibilitySettings.test.tsx` cho fixture 221 nhóm, bật lại/tải lại/remount phiên bản đã lưu và update bị 403.

Evidence mới: báo cáo này và `safety_closure.json` trong cùng thư mục. Không ghi đè báo cáo cũ.

Repo có nhiều thay đổi chưa commit từ trước; baseline hash đầu task phân biệt chúng với 12 file source/tests trên. Không hoàn tác/chạm vào các thay đổi không thuộc task.

## 6. Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Targeted navigation/page/editor/Settings/hook tests | **30 PASS** |
| Toàn bộ frontend: `npm.cmd test -- --reporter=dot` | **379 PASS / 17 files** |
| `npm.cmd run typecheck` | **PASS** |
| `npm.cmd run build` | **PASS** — Vite production build |
| Backend permission/visibility/ranking regression | **23 PASS**, 11 deprecation warnings hiện có |
| `git diff --check` | **PASS** |
| Browser desktop/mobile, hình ảnh và cuộn thực tế | **NOT VERIFIED**, công cụ trả `apps=[]`, `browsers=[]` |

Frontend tests kiểm tra mở/đóng nhóm, ba mục con và active title, direct URL, remount, history, icon rail ở viewport mobile giả lập, Staff có/không quyền, không mount editor khi bị chặn, page guard độc lập, thu hồi quyền, link anchor cũ, và Settings không còn bản trùng. Editor tests dùng API mocks, gồm 221 rows, tìm kiếm, tạm ẩn/bật lại, version, reload, 403, CAS conflict; không thao tác DB thật. UI mobile trong jsdom không phải bằng chứng bố cục/cuộn browser thực tế.

Backend command chạy không import `app.main`, không lifecycle hoặc HTTP production:

```text
.venv/Scripts/python.exe -B -m pytest -q -p no:cacheprovider tests/test_parent_disease_visibility.py tests/test_weather_ai_parent_eligibility.py tests/test_parent_weather_only_contract.py
```

Tests ghi fixture RAM/tmp ngoài repo, kiểm tra permission API, CAS, persistence và filter-before-K/stable score order/221 models/45 features/H14 bằng runtime hiện có. Không sửa backend source/test Python trong task này.

## 7. Ảnh hưởng và safety closure

| Phạm vi | Kết quả |
| --- | --- |
| Admin | **YES**, chỉ cấu trúc sidebar, page composition/route; Cài đặt còn tồn tại riêng, không redesign |
| Parent, Top K/ranking, stale fixes | **NO change** — source/hash giữ nguyên; regression PASS |
| Visibility business policy/storage | **NO change** — editor/API/backend/bảng thật giữ nguyên |
| Medical Knowledge | **NO change** — chỉ vị trí menu; route/roles/code/nội dung/bảng thật không đổi |
| Models, 221 artifacts, 45 features/H14/SHAP | **NO change**, baseline hashes bằng nhau; không retrain |
| Backend/database migration | **NO change**, không tạo/sửa file Python, không migration/import/lifecycle |
| Graduation | **NO change**, không sửa/truy cập workspace đó |
| `.env`, Nunito/font assets/CSS | **NO change** |
| Network/upload dữ liệu | **NO** — tests mock/offline, không gọi API production hay gửi dữ liệu ra ngoài |
| Git index | **NO change** — cached diff hash bằng baseline |
| Commit/push | **NO**, HEAD vẫn `6a69d26e7b07188f7def6cd7bcf9481f8e2eb649` |
| Reset/stash/clean/restore/checkout | **NO** |

**Real DB:** task không thực hiện câu lệnh/request ghi DB thật; mọi kết nối kiểm tra `mode=ro` + `query_only`, `total_changes=0`. Cả **32 bảng được snapshot** có count và SHA-256 giống baseline, gồm bệnh nhân, guidance, metadata địa lý, Medical Knowledge/jobs, visibility, users/permissions. `login_sessions` bị loại khỏi so sánh từ đầu vì phiên đang chạy cập nhật last_seen. **Hash toàn file DB vẫn đổi trong lúc server đang hoạt động; không chứng nhận toàn DB bất biến hoặc khẳng định đã xác định mọi nguồn ghi.** Không khôi phục hay chỉnh DB để che chênh lệch.

Uvicorn đã chạy sẵn với `--reload`; task không dừng/restart server, không tạo/sửa Python để tránh lặp lại reload lifecycle của task trước. Source backend/model/data/Parent/editor được đối chiếu baseline, không chỉ so `git diff HEAD`.

## 8. Kết luận

**PASS_WITH_FINDINGS:** đã có trang visibility riêng dưới nhóm AI thời tiết, tái sử dụng chức năng hiện có, điều hướng/quyền/tests đạt. Findings: browser chưa xác minh hình ảnh/scroll thực tế và không thể chứng nhận toàn DB đang chạy bất biến. Không có thay đổi ở 32 bảng dữ liệu được kiểm tra.

**DỪNG.** Không mở công việc khác, không deploy hoặc commit/push.
