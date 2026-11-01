# Topbar và loại bỏ tiêu đề trang trùng

**Kết luận: PASS_WITH_FINDINGS.** Mã nguồn, targeted tests, typecheck, build và diff check đạt; chưa xác minh trực quan trong browser thật.

## Audit và kết quả

Tên trang topbar vẫn được App lấy từ `getMainNavItems` và các nhãn utility hiện có. Trước đây topbar dùng `h2`, lặp tên sản phẩm ở dòng nhỏ; main có thêm header cấp trang, thường kèm icon và mô tả chung. Hai trang visibility và Medical Knowledge có header riêng; Account vốn không có tiêu đề trang lặp, chỉ có tên người dùng và các phần hồ sơ.

Sau sửa:

- Topbar hiển thị nhóm chức năng ngắn ở dòng nhỏ và **một `h1`** có `id="admin-page-title"`. Dùng chung `ADMIN_NAV_SECTIONS` với sidebar; không tạo nguồn cấu hình tên trang khác.
- Tổng quan dùng dòng nhóm “Không gian quản trị” để tránh lặp “Tổng quan” hai lần. Notifications/Settings/Account dùng “Tiện ích hệ thống”. Các nhóm khác giữ nhãn hiện có.
- Bỏ tên sản phẩm trang trí khỏi topbar; giữ **Theo dõi sức khỏe trẻ em** trong sidebar/document title/login.
- Tiêu đề desktop 22px, mobile 18px; font Nunito giữ nguyên. Topbar desktop giảm min-height 90 → 76px, padding dọc 18 → 14px; padding trên main 30 → 20px. Không khóa chiều cao khi tiêu đề dài xuống dòng.
- Notifications, avatar, tên/vai trò, account dropdown, Settings, Logout và mobile drawer giữ nguyên logic. Cụm thao tác không co mất; vùng tiêu đề có `min-width: 0` và wrapping. Màu nền trắng/mint theo theme hiện có, viền nhẹ; không thêm gradient/shadow.

`AdminPageHeading` nhận context từ AdminLayout để không render lại title/icon trong main. Header chung không cần thiết trả `null`, không để wrapper trống. Mô tả cần thiết được giữ bằng `keepDescription`; children/actions vẫn được render. Ngoài Admin shell, component giữ header như trước, không áp dụng thay đổi sang Parent/login hoặc standalone views.

`AdminSection` không sửa: tiêu đề chức năng, subtitle, actions và nội dung con giữ nguyên.

## Đối chiếu 17 section

| Section | Cách xử lý main |
| --- | --- |
| Tổng quan | Bỏ header lặp; giữ toolbar, KPI, ba chart, toggle và chi tiết |
| Nhập dữ liệu | Bỏ title/icon; giữ phạm vi các loại file và lưu ý tránh ghi đè, mọi nút import |
| Phân tích theo mùa | Bỏ header chung; giữ bộ lọc, scope notes, cảnh báo và headings biểu đồ |
| Phân tích độ tuổi | Bỏ title/icon; giữ mô tả tháng tuổi/phạm vi dữ liệu, nút Cập nhật và bộ lọc |
| Nhóm bệnh theo tháng | Bỏ title/icon; giữ giải thích tháng/năm, tỷ trọng/so sánh và Cập nhật |
| Phân tích giới tính | Bỏ title/icon; giữ giải thích phạm vi nam/nữ/tháng/năm và Cập nhật |
| Xu hướng nhóm bệnh | Bỏ title/icon; giữ hướng dẫn chọn nhóm/đối chiếu nhiều năm và Cập nhật |
| Khu vực | Bỏ title/icon; giữ nguồn `full_address`, điều kiện lọc miền và các bộ lọc |
| Dự báo số ca bệnh | Bỏ header chung; giữ form, model/range notes, chạy dự báo và kết quả |
| AI thời tiết | Bỏ title/icon; giữ mô tả input/realtime ranking và cảnh báo không phải xác suất/chẩn đoán |
| Nhóm bệnh hiển thị cho phụ huynh | Bỏ heading/icon riêng trong shell; giữ mô tả tạm ẩn, Tải lại, tabs/counters/search/CAS. Region tham chiếu `admin-page-title` thay heading đã bỏ |
| Kho kiến thức y khoa | Chỉ bỏ h1/decorative header trùng trong shell; giữ giải thích Reviewed/Auto, metrics, tabs, mọi nguồn/cảnh báo và headings chức năng |
| Báo cáo | Bỏ header chung; giữ mẫu, tạo/tải báo cáo, bộ lọc, preview/lịch sử |
| Phân quyền | Bỏ header chung; giữ quản lý tài khoản/quyền, guard, form và actions |
| Thông báo | Bỏ header chung; giữ KPI, bộ lọc và thao tác thông báo |
| Cài đặt | Bỏ header chung; giữ cấu hình, mô tả từng vùng, lưu/reset |
| Tài khoản | Vốn không có header trang trùng; giữ tên người dùng, hồ sơ, bảo mật/session và actions |

Các heading con như Tổng ca bệnh theo kỳ, Top nhóm bệnh, Kết quả dự báo, Nguồn tài liệu, Cấu hình dịch vụ và tên người dùng không bị loại bỏ. Không sửa nội dung y khoa hoặc cơ chế kiểm duyệt.

## File thay đổi

Sản phẩm:

- `Frontend/src/app/navigation.ts`: đưa bốn nhóm menu hiện có thành export dùng chung và thêm helper nhãn nhóm topbar; guards không đổi.
- `Frontend/src/app/components/AdminMainNavigation.tsx`: dùng export thay bản cấu hình nhóm local giống hệt; hành vi/sidebar style không đổi.
- `Frontend/src/app/components/admin/AdminLayout.tsx`: h1/nhãn nhóm và provider trong main.
- `Frontend/src/app/components/admin/AdminPageHeading.tsx`: bỏ chrome lặp có kiểm soát, giữ mô tả/actions cần thiết.
- `Frontend/src/app/components/admin/admin.css`: chỉ phần topbar và padding main.
- `Frontend/src/app/components/admin/content.css`: hàng mô tả/actions gọn trong main.
- `Frontend/src/app/components/AgeAnalysis.tsx`, `AdvancedAnalytics.tsx`, `AreaInsights.tsx`, `DataImport.tsx`, `WeatherRisk.tsx`: bật giữ mô tả cần thiết, không đổi handlers/data.
- `Frontend/src/app/components/ParentDiseaseVisibilitySettings.tsx`: chỉ điều kiện hiển thị header/accessible label trong shell.
- `Frontend/src/app/components/medical-knowledge/MedicalKnowledgeResearchPage.tsx`: chỉ điều kiện hiển thị header, giữ toàn bộ nghiệp vụ Medical Knowledge.
- `Frontend/src/i18n/locales/vi.ts`, `en.ts`: thêm nhãn nhóm utility; tái sử dụng khóa workspace đã có.

Tests:

- Thêm `Frontend/src/app/components/admin/AdminPageTitles.test.tsx`.
- Cập nhật `Frontend/src/app/App.navigation.test.tsx`, `Frontend/src/app/components/admin/BrandingVietnamese.test.tsx`, `AdminContent.regression.test.tsx`, `AdminPages.regression.test.tsx` để phản ánh h1/branding mới và kiểm tra loaded workflows với context thật.

Không sửa `AppPages`, routes, App/auth, API, `AdminSection`, Account, Dashboard/chart components hoặc stylesheet font.

## Kiểm thử theo phạm vi

| Nhóm | Kết quả | Evidence |
| --- | --- | --- |
| Layout/navigation/branding/page composition và workflow regressions, 6 file | **70 PASS, 0 FAIL** | `targeted-tests.log` |
| Dashboard, visibility, Weather AI/report workflows, navigation policy, 4 file | **33 PASS, 0 FAIL** | `related-regression-tests.log` |
| Medical Knowledge: URL Reviewed/Auto, quyền, nhãn/catalog/header fallback | **4 PASS, 121 không chạy do lọc tên test** | `medical-header-regression-tests.log` |
| Typecheck | **PASS** | `typecheck.log` |
| Production build | **PASS** | `build.log` |
| `git diff --check` | **PASS**, chỉ cảnh báo LF/CRLF | `diff-check.log` |

Tổng **107 tests PASS**. Không chạy toàn bộ frontend/backend/model audits.

Test mới render composition thật của cả 17 section dưới AdminLayout với API reads cô lập ở trạng thái chờ: kiểm tra mỗi trang có đúng một h1, không có page heading trùng trong main, tên/nhãn nhóm đúng, mô tả/cảnh báo/actions cần thiết còn hiển thị. Tests fixture/workflow riêng kiểm tra dữ liệu đã tải, thao tác Cập nhật, form, report/download, dự báo, Top K/toggle, visibility/CAS và guard Admin/Staff. Có regression cho standalone header và giữ header actions/subtitle/heading chức năng.

Layout tests hiện có kiểm tra trạng thái shell ở 1440/1280/1024/768/390px, focus trap/inert/Escape, resize, notifications/account dropdown desktop/mobile, Settings/Logout và xác nhận đăng xuất. Đây là trạng thái JSDOM, không phải ảnh responsive.

**Browser/visual: NOT VERIFIED.** Đã thử inventory browser; công cụ trả “The browser access host is unavailable”. Chưa có Chrome/Edge E2E/ảnh đại diện; chưa xác minh thực tế wrapping, overflow, chiều cao và khoảng cách ở 1440/1280/768/390px. Không coi unit tests/build là visual PASS.

## Safety closure

- Baseline **485 file**, thay đổi 19 file có trước và thêm 1 file test; danh sách/hash và diff riêng task trong `safety_closure.json`, `topbar_headers.diff`, `source_before/`.
- Các thay đổi chưa commit có trước được giữ nguyên. Không chỉnh layout Sidebar hoặc quyền; chỉ dùng chung cấu hình nhóm giống bản local trước đó.
- Đối chiếu code trước render xác nhận logic dữ liệu/handlers của Age, AdvancedAnalytics, Area, DataImport và WeatherRisk không đổi. Hai header visibility/Medical Knowledge chỉ thêm context hook, toàn bộ logic state/API trước render vẫn nguyên vẹn.
- Không sửa backend, DB thật, model/AI/SHAP, nội dung hoặc nghiệp vụ Medical Knowledge, Parent, font, dependency/lockfile hoặc `.env`. Không truy cập/sửa Graduation.
- Không mở/ghi DB, migration/import/retrain/restart backend. Tests mock/cô lập API; không có request tới ứng dụng hoặc external network. Chỉ thử inventory công cụ browser.
- HEAD và Git index giữ nguyên; không stage/commit/push/reset/stash/clean/restore/checkout.

Hoàn tất phạm vi và dừng, không redesign thêm.
