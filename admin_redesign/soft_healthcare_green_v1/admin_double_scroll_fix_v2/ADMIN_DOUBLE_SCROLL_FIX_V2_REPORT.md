# Eureka — Admin Double Scroll & Gray Empty Space V2

**Kết luận: PASS_WITH_FINDINGS.** Đã triển khai khóa document theo phạm vi Admin, giữ main/sidebar cuộn độc lập. Chrome thật đã xác minh bằng fixture cô lập. Chưa nghiệm thu session ứng dụng với API/dữ liệu thật; chưa xác định được node cụ thể gây overflow trong session người dùng.

## Nguyên nhân và mức độ chứng minh

Tái sử dụng audit `../admin_scroll_root_cause_fix_v1/ADMIN_SCROLL_ROOT_CAUSE_FIX_V1_REPORT.md`, đối chiếu source hiện tại:

- `index.html` đặt `html/body/#root` cao 100%.
- `.eureka-admin` cao `100dvh`, `overflow:hidden`; `.admin-workspace` là flex column với `min-height:0`.
- `.admin-content` sở hữu scroll nội dung (`flex:1; min-height:0; overflow:auto`). `.admin-navigation` có scroll riêng có chủ đích.
- Document vẫn có overflow mặc định `visible`. Khóa overflow của shell không tự khóa viewport document. Chưa tìm thấy override đáng tin cậy chứng minh shell cao vượt viewport; không sửa hàng loạt chiều cao của các trang.

**Đã chứng minh cơ chế bằng Chrome:** fixture dùng AdminLayout/CSS thật và một sibling overflow có chủ đích bên ngoài shell. Trước sửa, wheel trên vùng topbar làm `window.scrollY=500`, `shell.top=-500`, tạo hai vùng cuộn và khoảng ngoài shell. Sau sửa, cùng probe/wheel cho `window.scrollY=0`, `shell.top=0`.

Probe là dữ liệu kiểm thử nhân tạo, **không phải bằng chứng rằng chính sibling này tồn tại trong ứng dụng thật**. Không khẳng định đã xác định node gây khoảng xám trong ảnh người dùng. Bản sửa xử lý lỗ hổng sở hữu scroll đúng theo kiến trúc fullscreen đã xác nhận và giải pháp được yêu cầu.

Hai trường hợp bổ sung cũng được Chrome chứng minh trước khi sửa:

- Chỉ thêm `overflow:hidden` vẫn giữ offset 500px khi vào Admin từ public page đang cuộn.
- Anchor skip-link mặc định có thể làm document cuộn 82px dù overflow đã hidden.

Evidence: `browser-before.json`, `candidate-css-scroll-entry.json`, `candidate-css-clip.json`, `candidate-skip-link.json`.

## Bản sửa tối thiểu

| File source | Thay đổi |
|---|---|
| `Frontend/src/app/components/admin/admin.css` | Khóa overflow trên html/body chỉ khi có `.eureka-admin > .admin-workspace`, bằng `:has()`. Login/AuthGate có `.eureka-admin` nhưng không có workspace nên không bị áp dụng. Rule tự ngừng khớp khi Admin unmount. |
| `Frontend/src/app/components/admin/AdminLayout.tsx` | Reset document offset khác 0 khi mount, trước paint; skip-link chuyển focus tới main bằng `preventScroll:true`, giữ href/target phục vụ accessibility. |
| `Frontend/src/app/components/admin/AdminLayout.test.tsx` | Thêm 3 tests: scope/mount/unmount và offset; StrictMode/remount/public scope; skip-link focus. |

Không sửa inline overflow của html/body, không thêm class tồn dư, không dùng `position:fixed` hay chiều cao mới. Không thay kích thước, font, màu, padding, main/sidebar overflow hoặc page wrapper. Không sửa Area/Monthly/Trend/Seasonal, controller, cache, pagination, ranking, biểu đồ hoặc khuyến nghị.

Baseline là **working tree thực tế**, không lấy Git HEAD: `baseline.json` có 626 hash. Bản sao ba file được đối chiếu hash/bytes trước khi ghi nằm trong `source_before/`. `authorized_source_files.json` bổ sung AdminLayout.tsx vào phạm vi ba file; baseline gốc được giữ nguyên. `task-only.patch` chỉ thể hiện delta của task này, không trộn các thay đổi từ task trước.

## Kiểm thử cuối

| Kiểm tra | Kết quả / evidence |
|---|---|
| Targeted frontend, 9 files | **159/159 PASS**, `targeted-tests-final.log` |
| Parent / Login | 66 + 9 tests PASS trong lượt trên; không sửa source nghiệp vụ |
| Area / Advanced Analytics / Dashboard | 20 + 12 + 11 tests PASS |
| AdminLayout / App navigation / navigation / AdminContent | 14 + 22 + 2 + 3 tests PASS |
| Typecheck | **PASS**, `typecheck-final.log` |
| Production build | **PASS**, `build.log` |
| Rule có trong CSS production | **PASS**, `production-css-verification.json` |
| `git diff --check` | **PASS**, exit 0, `git-diff-check-final.log` |
| Whitespace trong delta task, gồm source chưa tracked nếu có | **PASS**, `task-patch-whitespace.json` |

Lượt đầu có hai test mới thất bại vì Vitest stub CSS import `?raw`; phần harness sau đó được sửa để đọc stylesheet thật qua Node builtin của Vitest. Các lỗi type của harness đã sửa, không thêm dependency hoặc đổi config. Các log thử trung gian được giữ để minh bạch; kết quả cuối là log `*-final` nêu trên. Không chạy full frontend suite, backend hoặc model suite.

## Browser verification

**BROWSER VERIFIED — ISOLATED FIXTURE**, Chrome `156.0.8078.74` đã cài sẵn. `CSS.supports(...)` xác nhận hỗ trợ selector trong `chrome-capability.json`. Profile Chrome mới, server static localhost riêng, không session/tài khoản/API thật, không proxy backend.

Đã đo và xem ảnh ở **1440×900, 1280×800, 768×1024, 390×844**:

- Wheel ngoài main không dịch document/topbar; main nhận wheel và tới footer cuối bảng 120 dòng. Khi thêm lên 180 dòng vẫn tới nội dung cuối.
- Main giữ `overflow:auto`; cuối nội dung chỉ còn padding sẵn có khoảng 40/32/28px, không thêm block rỗng.
- Sidebar giữ overflow riêng; tại 1280px thực sự cuộn được 70px. Mobile drawer mở/đóng được.
- Danh sách tỉnh giới hạn 300px, vùng biểu đồ dài giới hạn 420px và horizontal table scroll vẫn hoạt động trong fixture.
- Chuyển 8 section của shell, dropdown tài khoản thật, portal dialog kiểm thử và skip-link hoạt động.
- Sáu lần chuyển Admin/public: rule hết khớp khi unmount. Login giữ scroller `.admin-auth` sẵn có; Parent document cuộn lại. Vào Admin từ offset public 500px trở về origin.
- Không có request `/api`; font Nunito được phục vụ từ tài nguyên frontend offline hiện có.

Ảnh đã kiểm tra trực quan:

- [Trước sửa — probe overflow](chrome-before-external-overflow-1440.png).
- Sau sửa: [1440px](chrome-after-main-end-1440.png), [1280px](chrome-after-main-end-1280.png), [768px](chrome-after-main-end-768.png), [390px](chrome-after-main-end-390.png).
- [Portal dialog kiểm thử](chrome-after-portal-dialog-1440.png).

Chi tiết đo/assert: `browser-after.json`. Harness tái lập: `browser-fixture/`, `build-browser-fixture.cjs`, `verify-browser.cjs`, `chrome-session.cjs`.

**NOT VERIFIED:** browser E2E của các trang nghiệp vụ với session/API thật; node overflow gốc trong session người dùng; thiết bị di động vật lý. Nội dung dài và public screens trong fixture là nhân tạo, không được coi là nghiệm thu toàn bộ trang Area/Monthly/Trend/Login/Parent bằng Chrome. Regression nghiệp vụ trong bảng trên là tests mock, không phải live E2E.

## Protected hashes và safety closure

`protected-file-verification.json`: **623/623 file được bảo vệ không đổi**, chỉ ba source file được phép thay đổi; không có source frontend mới ngoài baseline. Trong đó **221 model giữ nguyên**, các file Forecast/Weather AI/SHAP, API/backend, Login/Parent/Medical Knowledge và các cải tiến trước không bị task ghi đè. Git index giữ nguyên hash.

- Không mở/ghi DB thật; DB không nằm trong inventory hash của task này.
- Không sửa backend/Python source, quyền, model, Excel, Graduation hoặc `.env`.
- Không migration, import, retrain, backend tests, kill/restart backend.
- Không cài dependency/browser, không dùng tài khoản thật hoặc đưa dữ liệu nghiệp vụ ra ngoài. Chỉ phục vụ fixture synthetic trên localhost; các tiến trình fixture do task tạo được đóng sau kiểm thử.
- Không stage/commit/push/reset/stash/clean/restore/checkout. Git chỉ đọc status/diff với `--no-optional-locks`.
- Bảo toàn source có trước qua baseline/hash; `git-status-before.txt`, `git-status-after.txt` lưu trạng thái để đối chiếu. Git có warning LF/CRLF của working tree hiện có, không có lỗi whitespace; không chỉnh file ngoài scope để dọn warning.

**Dừng tại đây.** Không redesign hoặc mở thêm phase.
