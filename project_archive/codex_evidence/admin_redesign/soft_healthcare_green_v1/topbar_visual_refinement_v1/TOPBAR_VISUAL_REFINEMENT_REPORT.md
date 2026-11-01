# Tinh chỉnh thị giác Topbar Admin/Staff

**Kết luận: PASS_WITH_FINDINGS.** Targeted tests, typecheck, build và diff check đạt; chưa xác minh hình ảnh trong browser thật.

## Trước/sau

Trước: topbar chỉ có dòng nhóm và title, thiếu điểm nhận diện trang; khoảng cách cụm trái khá rộng, title đậm 700.

Sau:

- Thêm icon trang trong ô mint **42×42px**, bo góc 12px, viền nhẹ; icon Lucide 22px/stroke 1.75, xanh tương phản theo token `--admin-accent-ink`.
- Dòng nhóm 11px, weight 600, dùng màu muted hiện có; title **21px/650** màu chữ tối, font Nunito giữ nguyên. Giữ `h1`, title và nhãn nhóm hiện có.
- Gap cụm trái 18 → 12px. Giữ topbar min-height 76px, padding 14px 32px và nền/viền theo theme sáng hiện tại; không thêm shadow/gradient hoặc badge thông tin.
- Giữ toàn bộ notifications/badge/avatar/tên/vai trò/account dropdown/Settings/Logout. Chỉ thêm bo góc và hover nhẹ cho nút tài khoản, không đổi markup hoặc handlers của cụm thao tác.
- Mobile dưới 640px: icon 34px, SVG 20px, title 18px; ẩn dòng nhóm phụ để ưu tiên title. Giữ wrapping, `min-width: 0`, cụm thao tác không co mất và mobile drawer hiện có. Không khóa chiều cao khi tên dài xuống dòng.

## Dùng chung metadata/icon

`getAdminPageIcon` lấy icon của 14 mục chính từ `getMainNavItems` hiện có. Chỉ bổ sung ba icon utility đã dùng trong topbar/dropdown: Bell, Settings, User. Không tạo bộ mapping độc lập cho 14 mục menu, không đổi title, group, route hoặc guards.

Icon chỉ trang trí, container có `aria-hidden="true"`, không tạo heading hoặc tên truy cập lặp. Kiến trúc một h1 ở topbar và không có page header lặp trong main được giữ nguyên trên cả 17 section. Không sửa 17 component trang.

## File sửa

1. `Frontend/src/app/navigation.ts` — helper tái sử dụng icon menu và fallback cho ba utility.
2. `Frontend/src/app/components/admin/AdminLayout.tsx` — render icon trong cụm title.
3. `Frontend/src/app/components/admin/admin.css` — chỉ các selector topbar/title/account button và responsive liên quan.
4. `Frontend/src/app/components/admin/AdminPageTitles.test.tsx` — kiểm tra icon render thực tế của cả 17 section so với sidebar hoặc utility action tương ứng.

Không thêm source file, component/helper ngoài nhu cầu, dependency, font hoặc i18n key.

## Kiểm thử

| Kiểm tra | Kết quả | Evidence |
| --- | --- | --- |
| Targeted page/layout/navigation, 4 file | **54 PASS, 0 FAIL** | `targeted-tests.log` |
| TypeScript typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Tests giữ coverage title/nhóm/icon của 17 section, một h1 và không có header lặp trong main, các mô tả/actions/heading chức năng; notifications/account dropdown/Settings/Logout; xác nhận đăng xuất; Admin/Staff guards, direct URL/history và submenu; collapse/drawer/focus/Escape/resize.

Layout tests có trạng thái viewport 1440/1280/1024/768/390px trong JSDOM. Không chạy backend/model tests hoặc audit toàn dự án.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser, công cụ trả “The browser access host is unavailable”. Không có ảnh/Chrome E2E. Chưa xác minh trực quan độ cân đối, tên dài không chồng thao tác hoặc horizontal overflow ở kích thước thực tế; CSS đã có wrapping/giới hạn phù hợp nhưng không coi tests/build là visual PASS.

## Safety closure

- Đối chiếu **486 file baseline**: chỉ 4 file kể trên thay đổi; không thêm source file. Evidence `baseline.json`, `source_before/`, `topbar_visual.diff`, `safety_closure.json`.
- Markup và handlers cụm thao tác topbar, route/permission guards đối chiếu trước/sau giữ nguyên.
- Sidebar/style collapsed, nội dung các trang Admin, Parent, backend, DB, model/AI/SHAP/Medical Knowledge, Nunito, dependency/lockfile và `.env` không sửa. Không truy cập/sửa Graduation.
- Không mở/ghi DB thật, gọi HTTP ứng dụng/external network, restart backend, migration/import/retrain. Tests dùng mock; chỉ thử inventory công cụ browser.
- HEAD và Git index giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout. Giữ toàn bộ thay đổi có trước.

Hoàn thành đúng phạm vi và dừng.
