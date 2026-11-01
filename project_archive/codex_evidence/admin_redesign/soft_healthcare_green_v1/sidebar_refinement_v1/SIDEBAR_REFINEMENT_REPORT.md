# Báo cáo tinh chỉnh sidebar Admin/Staff

Kết luận: **PASS_WITH_FINDINGS**.

Phạm vi: sidebar Admin/Staff của **Theo dõi sức khỏe trẻ em**. Không sửa các trang nội dung, Parent hoặc backend. Hoàn thành và dừng tại đây.

## Audit và thay đổi trước/sau

| Hạng mục | Trước | Sau |
| --- | --- | --- |
| Sidebar mở rộng | Nền theo theme chung, phần thương hiệu tương đối lớn | Nền trắng mint rất nhạt, màu chữ riêng có tương phản rõ; header gọn hơn, giữ hai từ “trẻ em” cùng nhau |
| Sidebar thu gọn | Nền chưa phân biệt với mở rộng, không thấy mũi tên submenu | Nền pastel `#e9f8ee`, icon căn giữa, hàng tối thiểu 44px, mũi tên nhỏ ở nhóm AI thời tiết |
| Menu dài | Chủ yếu dựa vào flex mặc định | `min-width: 0`, cho phép xuống dòng, line-height 1.5 |
| Phân nhóm/active | Đã có nhóm và active | Giữ cấu trúc, cân lại khoảng cách và đường phân nhóm trong rail; giữ nền mint/vạch xanh 3px cho mục đang chọn |
| Cài đặt/Đăng xuất | Có cả sidebar và dropdown tài khoản | Bỏ hoàn toàn khỏi sidebar; chỉ còn dropdown tài khoản hiện có |
| Scrollbar | Mặc định | WebKit 5px bo tròn, track mint/thumb xanh dịu, hover đậm nhẹ, bỏ nút mũi tên; fallback `scrollbar-width: thin` và `scrollbar-color` |
| Desktop thu gọn → mobile | Thuộc tính CSS vẫn có thể giữ trạng thái collapsed trong khi đã hiện nhãn | Drawer mobile luôn dùng kiểu expanded; trở lại desktop vẫn giữ lựa chọn thu gọn trước đó |

Giữ chiều rộng desktop 264px/80px và breakpoint drawer dưới 1024px. Một cây menu dùng chung cho desktop, rail và mobile. Vùng navigation vẫn là `overflow-y: auto`, không dùng cơ chế kéo cuộn riêng; có thể focus để dùng bàn phím. CSS chỉ áp dụng cho lớp Admin, màu riêng của sidebar không thay màu các trang nội dung.

## Cấu trúc và nhãn tiếng Việt

Giữ bốn nhóm hiện có: Tổng quan; Phân tích dữ liệu; Mô hình & kiến thức; Vận hành. Giữ nhóm AI thời tiết mở/thu gọn với ba mục con và cùng route cũ:

- AI thời tiết — `/?section=weather-risk`.
- Nhóm bệnh hiển thị cho phụ huynh — `/?section=parent-disease-visibility`.
- Kho kiến thức y khoa — `/?section=medical-knowledge`.

Chỉ chuẩn hóa hai giá trị trong bản dịch tiếng Việt:

- `sidebar.dataImport`: “Import dữ liệu” → “Nhập dữ liệu”.
- `sidebar.parentDiseaseVisibility`: “Nhóm bệnh hiển thị trên Parent” → “Nhóm bệnh hiển thị cho phụ huynh”.

Nhãn accessibility của navigation dùng khóa `admin.navigation`. Không đổi identifier, API key hoặc bản dịch ngôn ngữ khác. Giữ font Nunito và tên thương hiệu, không thêm Eureka/Lightning Fox SD lên giao diện.

## Icon và thao tác

Dùng Lucide hiện có; icon menu 19px, stroke 1.75. Điều chỉnh: Nhập dữ liệu → FileUp; theo mùa → CalendarDays; độ tuổi → UsersRound; theo tháng → ChartColumn; giới tính → VenusAndMars; xu hướng → ChartLine; dự báo → ChartNoAxesCombined; khu vực → MapPinned. Giữ các icon dashboard, weather, visibility, sách, báo cáo và phân quyền phù hợp sẵn có. Mũi tên disclosure nhỏ hơn để biểu thị thao tác phụ.

Rail giữ tên đầy đủ trong `aria-label` và tooltip native `title`; nhóm AI thời tiết vẫn mở/đóng được và truy cập từng mục con. Khi vào trực tiếp một route con hoặc chuyển qua history, menu cha tự mở như trước.

Dropdown tài khoản giữ nguyên ba thao tác: Tài khoản của tôi, Cài đặt, Đăng xuất. Cài đặt dùng route `/?section=settings`, có trạng thái đang chọn. Đăng xuất vẫn qua xác nhận sẵn có của App rồi mới gọi `logout`; hủy xác nhận không đăng xuất. Giữ đóng dropdown khi chọn mục, bấm ngoài hoặc Escape, trả focus về nút tài khoản khi Escape.

## File đã sửa trong task này

Sáu file sản phẩm:

- `Frontend/src/app/App.tsx`: bỏ cấu hình menu đáy truyền vào layout; giữ tiêu đề route Cài đặt.
- `Frontend/src/app/navigation.ts`: đổi icon, bỏ helper menu đáy không còn sử dụng; giữ nguyên permission/role guards.
- `Frontend/src/app/components/AdminMainNavigation.tsx`: nhãn navigation qua i18n, icon đồng nhất, submenu/scroll region dùng lớp CSS riêng.
- `Frontend/src/app/components/admin/AdminLayout.tsx`: bỏ Cài đặt/Đăng xuất khỏi aside, gọn thương hiệu, sửa trạng thái drawer sau resize, giữ dropdown tài khoản.
- `Frontend/src/app/components/admin/admin.css`: chỉ các quy tắc liên quan sidebar.
- `Frontend/src/i18n/locales/vi.ts`: hai nhãn menu tiếng Việt.

Ba file tests:

- `Frontend/src/app/App.navigation.test.tsx`.
- `Frontend/src/app/components/admin/AdminLayout.test.tsx`.
- `Frontend/src/app/components/admin/BrandingVietnamese.test.tsx`.

`source_before/`, `baseline.json` và `sidebar-source.diff` lưu bản đối chiếu của task. Không dùng diff toàn working tree để hoàn tác các thay đổi có trước.

## Navigation và quyền

Không đổi `TAB_PERMISSIONS`, `TAB_ROLES`, `canUse`, `canAccessTab`, `useAdminSectionNavigation`, guard tại trang chức năng, API hoặc AuthContext. App vẫn lọc các mục theo quyền trước khi truyền cho sidebar. Staff có quyền visibility vẫn vào trang đó độc lập với quyền weather overview; Staff thiếu quyền không thấy mục và không mount editor qua URL trực tiếp. Phân quyền vẫn chỉ Admin, kể cả Staff có chuỗi permission giả lập trong test.

Giữ query route, legacy anchors, direct URL, remount, history/popstate và mobile close-on-navigation. Xóa mục đáy không xóa route Cài đặt hoặc chức năng đăng xuất. Không sửa cơ chế lưu visibility, CAS/version hoặc dữ liệu đã lưu.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Targeted layout/branding/navigation, 3 file | **42 PASS, 0 FAIL** — `targeted-tests.log` |
| Full frontend, 27 file | **508 PASS, 0 FAIL** — `frontend-tests.log` |
| Nunito offline, dấu tiếng Việt và weights | **3 PASS, 0 FAIL** — `font-tests.log` |
| `npm.cmd run typecheck` | **PASS** — `typecheck.log` |
| `npm.cmd run build` | **PASS** — `build.log` |
| `git diff --check` | **PASS**, chỉ còn cảnh báo LF/CRLF — `diff-check.log` |

Targeted tests kiểm tra desktop 1440/1280/1024, drawer 768/390, các mục rail có tooltip, điều hướng active, mở/đóng submenu, direct URL/remount/history, Admin/Staff và guard trang, Cài đặt/Đăng xuất không còn ở sidebar, dropdown trên desktop/mobile, xác nhận đăng xuất đồng ý/hủy, Escape/bấm ngoài, focus trap/inert, và resize rail → mobile → desktop. Các kích thước này là trạng thái `window.innerWidth` trong JSDOM, **không phải xác minh ảnh responsive**.

Full suite bao gồm Parent, Medical Knowledge, visibility filters/CAS và các workflow Admin dùng mock API. Không bật/tắt nhóm bệnh hoặc đăng xuất tài khoản thật để thử.

### Browser/visual verification: NOT VERIFIED

Đã gọi inventory browser; công cụ trả **“The browser access host is unavailable”**. Không chạy được Chrome/Edge E2E, không có ảnh thực tế. Chưa xác minh trực quan màu sắc, độ cân đối thương hiệu, tooltip native, cuộn thực tế bằng chuột/touch/bàn phím, hay horizontal overflow ở desktop/mobile. Không suy ra UI PASS từ unit tests/build. Chỉ xác nhận source có giới hạn kích thước, wrapping và quy tắc overflow phù hợp.

## Safety closure

Evidence: `safety_closure.json`, đối chiếu 526 file baseline.

- Chỉ 9 file frontend liệt kê ở trên thay đổi so với lúc bắt đầu task. Các thay đổi chưa commit trước task được giữ nguyên.
- Backend, Parent, nội dung trang Admin, API, AuthContext, font/assets, models, feature schema/H14, SHAP, Medical Knowledge, Excel và `.env` trong baseline không thay đổi.
- Không truy cập/sửa Graduation. Không retrain, migration, import dữ liệu, restart server hoặc thêm dependency.
- Không gọi HTTP ứng dụng, không dùng external network; chỉ thử inventory công cụ browser. Tests dùng mock, production build chạy local.
- Chỉ đọc DB bằng SQLite `mode=ro` + `query_only=ON` khi lấy fingerprint; `read_only_total_changes = 0`. Không thực hiện ghi DB trong task.
- **Cả 32 bảng dữ liệu được theo dõi giữ nguyên fingerprint và số hàng.** Bảng `login_sessions` được helper hiện có loại khỏi fingerprint vì có thể được server đang chạy cập nhật.
- **Hash toàn file DB thật thay đổi trong khoảng kiểm tra.** Không kết luận toàn file DB bất biến hoặc khẳng định nguyên nhân thay đổi; đối chiếu chỉ chứng minh 32 bảng theo dõi không đổi và các kết nối audit không ghi dữ liệu.
- HEAD và Git index giữ nguyên. Không stage/commit/push/reset/stash/clean/restore/checkout.

**PASS_WITH_FINDINGS** do chưa xác minh browser/visual thực tế và giới hạn đối chiếu toàn file DB nêu trên. Mã nguồn, regression tests, typecheck và build đạt. Không mở thêm công việc thiết kế hoặc backend.
