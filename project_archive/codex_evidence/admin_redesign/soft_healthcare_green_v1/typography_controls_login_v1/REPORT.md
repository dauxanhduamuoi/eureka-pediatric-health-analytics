# Typography/control Admin và Login Eureka

Kết luận: **PASS_WITH_FINDINGS**. Đã hoàn thành phần frontend trong phạm vi; tests/typecheck/build đạt. **Chưa xác minh visual/E2E bằng trình duyệt thật**, nên không khẳng định giao diện đẹp/không vỡ chỉ từ tests.

## Audit và quyết định

Audit trước code được lưu tại [AUDIT.md](AUDIT.md). Font thực tế là **Nunito variable**, local normal/italic 400–700, hỗ trợ tiếng Việt; Segoe UI/Arial là fallback. Không thấy component Admin/Login dùng family khác. Giữ nguyên font và tài nguyên cũ, không thêm dependency hoặc font mạng ngoài.

Vấn đề nằm ở cascade giữa `admin.css`, `content.css`, `permissions.css`, global Nunito và Tailwind: nhiều cỡ 10/11/12/13/14/15px, topbar title 21px/650, section title JSX/CSS không khớp; control min-height 30/34/36px, select/pagination có padding riêng. Bảng user dùng header 11px/cell 12px. Login là card đơn, còn lời dẫn nội bộ và địa chỉ backend.

## Typography/control sau chỉnh

Tạo `admin/typography-controls.css`, import từ `admin.css`, làm nơi tập trung token và adapter cho các page cũ. Selector giới hạn trong `.eureka-admin`; không sửa global Nunito/Parent stylesheet, không thay semantic màu đỏ/vàng của cảnh báo.

| Vai trò | Quy tắc mới |
| --- | --- |
| Page title topbar/content | 24px, mobile 20px; heading line-height 1.35 |
| Card/section title | 16px/600 |
| Body/table cell | 14px, line-height 1.6 |
| Form label/button/support | 13px, weight 500–600 |
| Meta/table header/badge/caption | 12px, line-height 1.5 |
| Nội dung / nhấn mạnh | 400 / 600; heading/active tối đa 700 |
| Text input/select/button | control height tối thiểu 40px; Login 46px |

Các metric lớn vẫn giữ vai trò số liệu nổi bật. Brand và heading visual Login có scale riêng theo vai trò, không biến mọi nội dung thành cùng một cỡ.

Chuẩn hóa table padding, label, support, sidebar/submenu/topbar baseline, caption, badge user, action dropdown và permission editor. Input giữ padding trái của search icon. Select đơn có caret SVG inline và khoảng trống dành riêng, hỗ trợ dark palette; multiple/list select giữ native; forced-colors dùng caret native. Focus bàn phím rõ, checkbox/radio/range/toggle không bị áp chiều cao text input.

Các page-size/pagination hiện có ở Dashboard, Forecast, Khu vực và Phân quyền dùng chung các class `admin-page-size`, `admin-page-controls`, `admin-pagination`. “Hiển thị 10” có label, select cao đều/caret rõ, số dùng tabular numerals và wrap cả nhóm khi hẹp. Bổ sung liên kết label/select tại Dashboard và Forecast. Giữ nguyên option values, handlers, custom page-size, tìm kiếm, filter và page calculations; không tạo state/API mới.

Tính tương phản từ token trên nền sáng (không thay cho visual/accessibility audit): ink/white **14.95:1**, secondary/white **5.12:1**, secondary/subtle **4.82:1**, white/primary **5.02:1**.

## Login

- Desktop: hai cột khoảng 51/49, trái nhận diện hệ thống và visual phân tích sức khỏe; phải form đăng nhập rộng tối đa 360px. Khung tổng tối đa 1180px.
- Visual SVG/CSS tĩnh nằm trong source, không có số liệu thực, không tải ảnh hoặc gọi network; không slideshow/autoplay/layout shift do tải ảnh.
- Dưới 768px chuyển một cột; chỉ giữ brand ở phần visual để ưu tiên form. Chiều cao nội dung tự nhiên, trang cho phép cuộn; không đặt chiều cao cố định cho form.
- Bỏ lời dẫn “Dùng tài khoản nội bộ…” và “Backend: FastAPI · http://127.0.0.1:8000”. Giữ nguyên tên “Theo dõi sức khỏe trẻ em” và link `/phu-huynh`.
- Giữ `handleSubmit`, cách truyền username/password, required/autocomplete, state loading/submitting/error và gọi `login` hiện có. Thêm ngữ nghĩa `aria-busy`/`role=alert`, không thêm luồng auth/reset mật khẩu hoặc thay AuthContext.

## File sửa

Sáu file có sẵn:

1. `Frontend/src/app/components/LoginPage.tsx` — cấu trúc/visual và class Login.
2. `Frontend/src/app/components/admin/admin.css` — import hệ thống chữ/control; chuyển hai token font cũ sang file tập trung.
3. `Frontend/src/app/components/admin/permissions/UserTable.tsx` — class hàng phân trang/page-size, nhãn “mỗi trang”.
4. `Frontend/src/app/components/DashboardOverview.tsx` — class pagination và label/select.
5. `Frontend/src/app/components/Forecast.tsx` — class pagination và label/select.
6. `Frontend/src/app/components/AreaInsights.tsx` — class page-size/pagination.

Ba file mới:

1. `Frontend/src/app/components/admin/typography-controls.css` — token và style dùng chung.
2. `Frontend/src/app/components/login.css` — layout Login desktop/mobile.
3. `Frontend/src/app/components/LoginPage.test.tsx` — credential contract, loading, error/retry, labels/Parent link và bỏ nội dung thừa.

Diff chỉ của task: [scoped.diff](scoped.diff). Các file đã có thay đổi trước task được lưu/đối chiếu theo bản đang có trong workspace, không lấy HEAD đè lên.

## Kiểm thử

| Kiểm tra | Kết quả |
| --- | --- |
| Targeted Admin/Login/navigation/Dashboard/permissions, 13 files | **118 PASS** |
| Nunito offline: cmap tiếng Việt NFC/NFD, glyphs và weight 400–700, local URLs | **3 PASS** |
| Typecheck | **PASS** |
| Production build sau thay đổi CSS cuối | **PASS** |
| `git diff --check` | **PASS**; có cảnh báo LF/CRLF của working tree |
| Browser thực, ảnh desktop/mobile | **NOT VERIFIED** |

Lệnh frontend: `npm.cmd test -- src/app/components/admin src/app/components/LoginPage.test.tsx src/app/components/PermissionsPage.test.tsx src/app/components/DashboardOverview.test.tsx src/app/App.navigation.test.tsx src/app/navigation.test.ts --maxWorkers=1`. Font: `node --test src/styles/nunito.test.mjs`. Logs đặt cùng thư mục báo cáo.

Các suite thực thi bằng mock/fixture cô lập: Dashboard, Phân tích mùa, Độ tuổi, AI thời tiết, Phân quyền và Login; kiểm tra dữ liệu/payload, search/filter/pagination, action và permissions regression. Test page composition bao gồm 17 section. Đây là kiểm tra hành vi/component, không phải bằng chứng CSS render đẹp ở từng viewport.

Lần đầu có hai test Login mới dùng `...` thay cho ký tự `…` sẵn có trong bản dịch; sửa assertion lấy đúng bản dịch, không đổi product text. Đồng thời test lazy Dashboard vượt thời gian chờ khi chạy chung build/typecheck. Sau khi các tiến trình đó xong, chạy lại toàn nhóm một worker đạt 118/118, không sửa test Dashboard để che lỗi. Log đầu giữ tại `frontend-tests-initial.log`. Có warning `act` từ suite animation hiện có; không mở refactor ngoài phạm vi.

Đã thử computer-use: native pipe không kết nối được và browser access host unavailable. Không có screenshot hoặc xác nhận hình ảnh thực tế tại desktop/mobile; dấu tiếng Việt được xác minh ở font cmap và nội dung DOM, chưa ở raster render. Contrast ở trên là phép tính token.

## Safety closure

- **Không sửa backend**, auth logic/API/JWT/session/permissions; không start/restart/kill server.
- **Không mở/ghi DB thật qua SQL**, không tạo tài khoản/thay quyền thật, migration hoặc import Excel. Hai DB file giữ nguyên hash.
- **Không đổi font family**; giữ Nunito và toàn bộ asset thường/nghiêng/license/fallback.
- **Không dùng slideshow**, asset ngoài hoặc dependency mới; task không có request mạng ngoài/gửi dữ liệu.
- **Không verify browser thật** do công cụ không khả dụng; không tuyên bố visual/E2E PASS.
- Baseline **492 file**: chỉ sáu file có sẵn nêu trên đổi hash. Backend, model deployment, `.env`, font assets và toàn bộ source Parent trong baseline giữ nguyên; không sửa Graduation/AI/SHAP/Medical Knowledge business/Excel.
- HEAD và Git index giữ nguyên hash; không stage/commit/push/reset/stash/clean/restore/checkout, staged diff rỗng. Các thay đổi có trước được giữ nguyên.

Kết luận **PASS_WITH_FINDINGS** vì phần triển khai/test hoàn tất nhưng visual/browser còn **NOT VERIFIED**. Dừng tại đây, không mở rộng redesign.
