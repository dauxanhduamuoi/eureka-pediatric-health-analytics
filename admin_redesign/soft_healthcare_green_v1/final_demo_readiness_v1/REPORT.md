# Eureka — Final demo readiness audit & test

Ngày: **31/10/2026**, múi giờ Asia/Bangkok. Workspace Eureka `ThucTap-main`.

## 1. Kết luận

**PASS_WITH_FINDINGS — có thể chuẩn bị demo có kiểm soát; chưa đủ bằng chứng để chốt DEMO READY toàn hệ thống vì browser/E2E chưa nghiệm thu.**

Không còn CRITICAL/MAJOR đã tái hiện mà chưa xử lý trong phạm vi kiểm tra này. Đã sửa hai lỗi MAJOR frontend Forecast, giữ nguyên backend và AI. Lượt cuối: **642 frontend tests + 275 backend tests PASS**, thêm **26 kiểm tra API cô lập** và **3 tests font offline PASS**. Typecheck, production build, kiểm tra dependencies và `git diff --check` PASS.

Các finding còn lại:

- **BROWSER NOT VERIFIED:** browser access host không khả dụng; chưa có ảnh/live desktop/mobile, browser GPS hoặc login/UI E2E. Không dùng JSDOM/HTML GET để tuyên bố E2E PASS.
- **DB thật không giữ nguyên hash trong thời gian backend đang chạy.** Đã audit chỉ đọc: `login_sessions.last_seen_at` gần trùng mtime file. Không có row-level baseline hay writer trace để quy toàn bộ thay đổi cho một tác nhân. Không khôi phục DB. Các phép thử có ghi dữ liệu được khóa vào DB cô lập, không login/request có token trên server thật.
- Còn cần checklist Chrome cho kịch bản demo. Một lượt Open-Meteo thật PASS không bảo đảm provider/mạng luôn sẵn sàng.

## 2. Trạng thái trước kiểm thử và ranh giới an toàn

- Working tree có nhiều thay đổi chưa commit từ các task trước; đã lưu `git-status-before.txt` và baseline hash của **579 files**, gồm source, cấu hình, assets, model Weather/Forecast, tài nguyên Excel đi kèm và Git index. Không lấy HEAD để ghi đè hoặc hoàn tác.
- Backend có Uvicorn **PID 27640**, child **48008**, `--reload`, listener `127.0.0.1:8000`. Frontend Vite **PID 24564**, listener `::1:5173`. Các PID giữ nguyên khi chốt; không start/kill/restart server.
- Không sửa Python vì backend đang reload. Không import `app.main` hay chạy production lifespan trong test. Lifespan có create_all/migration/seed/worker, vì vậy tests dựng FastAPI riêng với routers và dependency override.
- `npm ls --depth=0` và backend `pip check` PASS; không cài/update dependency. Vite proxy `/api` trỏ backend 8000 đúng cấu hình.
- DB thật chỉ được hash/đọc bằng URI `mode=ro&immutable=1` và `PRAGMA query_only`; không đọc/xuất dòng bệnh nhân, tên tài khoản, mật khẩu hay token. Chỉ kiểm tra bảng có dữ liệu và khoảng kỳ. Có dữ liệu hiện tại đến **2025-04**, Forecast **2025-05**; đây là kỳ demo theo dataset, không phải dự báo tháng hiện tại 10/2026. File train_history đi kèm model có mặt; việc DB không chứa train_history là phù hợp source Forecast đọc Excel riêng.

## 3. Các luồng đã kiểm tra và giới hạn

| Luồng | Bằng chứng thực hiện | Giới hạn |
|---|---|---|
| Login/quyền | Frontend form/error/navigation tests; API cô lập dùng bcrypt thật, admin/staff/inactive/sai mật khẩu, session revoke và token bị từ chối; tests quyền/backend policy hiện có | Không login hoặc đổi quyền tài khoản thật |
| 17 section | App/navigation/page-title regressions, TAB_PERMISSIONS/TAB_ROLES và backend policy tests; snapshot khai báo tại `route-permission-declarations.json` | Utility sections dùng auth/role hiện có, không tự thêm permission. Không tuyên bố đã thao tác mọi endpoint live |
| Dashboard | Biểu đồ và tổng UI từ mocks; API cô lập kiểm tra tổng theo predict_current, loại train_history, tháng 0 có ghi nhận, năm thiếu tháng, top totals | Không so khớp toàn bộ từng dòng DB thật |
| Phân tích | Regression tuổi, mùa, giới, trend, chart/labels/filters hiện có; API tuổi/chuỗi tháng với dữ liệu tổng hợp | Chưa xem layout/touch browser thực |
| Forecast | API cô lập kiểm tra mặc định tháng kế tiếp, loại kỳ cũ, kỳ explicit, lỗi runtime/horizon; model pkl hiện có load + predict 1 mẫu tổng hợp hữu hạn; test mới lỗi đọc/race/retry | Không gọi `/forecast/run` trên DB thật; chưa chạy toàn bộ run_forecast với Excel/bản sao DB qua UI |
| Weather AI | W01/W02, 45-feature baseline/order, H14/221 model, ranking/SHAP, eligibility/API; 4 metrics/zero/missing/cache/race; compact/pagination | Provider thật được kiểm tra đầu vào riêng, chưa E2E login → model → UI live |
| Parent | 66 regression tests hiện có: input/GPS/error/race/ranking/Trước-Tiếp/giải thích; renderer và source giữ nguyên | GPS browser thật và responsive chưa xác minh |
| Medical Knowledge | Frontend Reviewed/Auto/nguồn/lỗi/phân quyền và backend published/general factors với DB test; không đụng nội dung thật | Không tạo job, import, duyệt hay gọi nguồn nghiên cứu thật để kiểm thử |
| Reports | Frontend preview/export/history/error tests; backend snapshots/owner/quyền, PDF/CSV, thiếu khác 0, observed khác forecast; xuất lại 7 mẫu cô lập | Không tạo lịch sử báo cáo thật trên DB/server thật |
| Import/visibility | Frontend upload payload/lỗi; quyền API và chặn extension/missing disease codes; tests visibility bật/tắt/CAS bằng DB test | Chưa nghiệm thu import Excel hợp lệ end-to-end qua browser; không import bệnh nhân thật |

## 4. Lỗi thật đã phát hiện và sửa

### MAJOR F01 — Forecast nuốt lỗi đọc và có thể báo hoàn tất sai

`Forecast.load` và phần đọc kết quả sau `runForecast` dùng `.catch(() => [])` trên hai API. Lỗi 401/403/502/503 có thể thành dữ liệu rỗng; sau POST thành công nhưng GET lỗi, UI vẫn đi tiếp sang thông báo thành công và cache danh sách rỗng. Test trước sửa không tìm được lỗi 503/502 mong đợi và xác nhận thông báo hoàn tất không đúng điều kiện.

**Sửa:** bỏ catch chuyển lỗi thành []; chỉ cập nhật summary/details/cache sau khi cả hai GET thành công. Giữ dữ liệu trước khi lỗi, hiển thị lỗi, nhãn dữ liệu trước đó và retry. Không phát thông báo hoàn tất khi chưa lấy được kết quả. Lỗi chạy được trình bày tại một vùng lỗi bền vững, tránh trùng toast với nội dung lỗi.

### MAJOR F02 — Response tải ban đầu có thể ghi đè lượt Forecast mới

`load` chạy lúc mount và `handleRun` cập nhật chung state nhưng thiếu generation guard. Test giữ GET ban đầu, hoàn tất lượt chạy mới rồi trả response ban đầu: nhóm cũ ghi đè nhóm mới.

**Sửa:** generation ref dùng chung, kiểm tra trước mọi cập nhật/catch/finally; invalidate khi unmount. Refresh tạm khóa khi đang chạy. Cache/lượt đang tải hoặc lỗi có nhãn kết quả trước đó. Không đổi horizon 1, filters, số liệu, công thức/model, API hoặc cơ chế lưu kết quả backend.

**Source thay đổi đúng hai file:**

1. `Frontend/src/app/components/Forecast.tsx` — sửa lifecycle/error presentation nhỏ nêu trên.
2. `Frontend/src/app/components/Forecast.test.tsx` — thêm 5 tests tái hiện/kiểm tra lỗi đọc, đọc sau chạy thất bại, giữ cache khi refresh lỗi, response cũ và retry/empty thành công.

`source_before/Forecast.tsx`, `forecast-before.log` (5 FAIL có chủ đích trước sửa), `forecast-fix.diff` và `forecast-after.log` lưu bằng chứng. Không sửa test cũ để né regression hoặc sửa dữ liệu đầu vào để ép PASS.

## 5. Kết quả tests

| Kiểm tra | Kết quả / evidence |
|---|---|
| Frontend toàn bộ lần cuối | **642 PASS, 37 files**, `frontend-final.log` |
| Backend targeted 11 files | **275 PASS**, `backend-regression.log` |
| API bổ sung cô lập | **26 PASS**, `isolated-api-checks.json` / `isolated-api.log` |
| Nunito offline/local fonts | **3 PASS**, `nunito-offline.log` |
| Forecast mới + regression Admin liên quan | **14 PASS**, `forecast-after.log` |
| Typecheck | **PASS**, `typecheck.log` |
| Production build | **PASS**, `build.log` |
| Dependencies | **PASS**, `frontend-dependencies.log`, `backend-dependencies.log` |
| `git diff --check` | **PASS**, `diff-check.log` |
| Live HTTP chỉ đọc | **12/12 đạt status dự kiến**, `live-read-only-checks.json` |
| Model Forecast load/predict tổng hợp | **PASS**, `forecast-model-smoke.json` |
| Open-Meteo thật → features | **LIVE_PROVIDER_INPUT_PASS**, `live-weather-provider.json` |

Lần frontend đầu: **636 PASS, 1 FAIL** do test Dashboard lazy-load không nhận DOM trong timeout. Không sửa source Dashboard/test để né lỗi. File page-title chạy riêng **19 PASS**; lượt full cuối một worker **642 PASS**. Ghi nhận finding độ nhạy timing của test, không khẳng định đã chứng minh nguyên nhân hệ điều hành hay lỗi sản phẩm chỉ từ timeout. Backend có deprecation warnings datetime.utcnow/TestClient/PyMuPDF; frontend có warning act/đo kích thước chart trong JSDOM. Không bỏ tests hoặc update dependency ngoài task.

Backend tests được chốt SQLite chỉ memory hoặc đường dẫn `isolated-pytest/`, socket external bị chặn; riêng socket loopback nội bộ Windows TestClient được phép. API supplement cũng chỉ SQLite memory, CWD riêng cho uploads, không production lifespan. Không retrain.

## 6. Live provider và live HTTP

Open-Meteo đã được gọi thật bằng tọa độ **công khai trung tâm TP.HCM**, không GPS người dùng hoặc dữ liệu bệnh nhân. Contract `Asia/Ho_Chi_Minh`, D−6 đến D giữ nguyên. Kết quả ngày **2026-10-31**, vector **45 features hữu hạn**; nhiệt độ TB 27.0375°C, độ ẩm TB 87.625%, mưa 1.6 mm, gió lớn nhất 14.3 km/h. Đây là dữ liệu thực tại thời điểm gọi; không thay mock rồi gắn nhãn live.

Phép gọi này không chạy model hoặc DB. Ranking/SHAP với input chuẩn được kiểm tra riêng trong regression model thật/provider giả lập. Không suy rộng thành một lượt prediction từ browser thật.

Live HTTP: backend root/OpenAPI 200; frontend root/Parent/deep-link Weather AI trả HTML 200; bảy endpoint có bảo vệ trả 401 khi không có token. Không dùng cookie/token hoặc POST đến server thật. HTML 200 không chứng minh React render thành công hoặc chức năng browser hoạt động.

## 7. PDF/CSV evidence và kiểm tra hình ảnh

Tái sử dụng fixture tổng hợp của module Reports; gọi renderer hiện tại, không renderer cũ và không DB thật. File [PDF kiểm thử](pdf-validation/eureka-final-demo-readiness.pdf): **8 trang / 7 mẫu**, cùng 7 CSV trong `pdf-validation/`.

- Mọi trang đã render PNG và được xem trực quan qua hai contact sheets gồm đủ 8 trang: tiêu đề/dấu tiếng Việt, xanh lá/Nunito, chart/table/ghi chú không chồng hoặc bị cắt trong fixture; mùa khô/mùa mưa ghi nhãn trực tiếp. Trang tiếp nối bảng tuổi lặp tiêu đề, phần khuyến nghị custom cùng trang nội dung.
- Kiểm tra A4, text trong lề ngang, trang có nội dung, snapshot không bị renderer sửa, CSV có UTF-8 BOM. Các tests PDF riêng kiểm tra bảng 120 dòng, tên rất dài, không mất dòng, header lặp và nhãn ngắn/dài.
- `manifest.json`, extracted text, các PNG và CSV được lưu. Fixture có timestamp cố định 30/10/2026 để so sánh; không trình bày timestamp đó thành giờ xuất dữ liệu thật.
- Không thay layout PDF hoặc frontend Reports trong audit.

## 8. DB hash thay đổi: audit và giới hạn quy kết

`database.db` giữ size **189222912 bytes**, nhưng SHA-256 thay đổi so với baseline. Mtime baseline **31/10/2026 01:11:22** giờ địa phương; quan sát **01:19:22**. Query chỉ đọc cho thấy `login_sessions.last_seen_at` mới nhất **01:19:22.879952**, gần mtime **01:19:22.886468**.

`security.get_current_user` cập nhật last_seen_at rồi commit cho token có sid ngay cả khi endpoint là GET. Đây là **giải thích phù hợp với timestamp** khi hệ thống/session thật đang hoạt động. Timestamp Medical Knowledge/jobs/provider settings được quan sát không chỉ ra hoạt động mới cùng thời gian đó. Tuy nhiên không có snapshot từng dòng lúc đầu, SQL writer trace hoặc access log đủ để kết luận tất cả bytes thay đổi là từ session hay tác nhân nào. Không khẳng định DB không đổi; cũng không tự đổ lỗi cho background worker hoặc người dùng.

Không có request có token do audit gửi đến server thật. Các phép thử ghi DB dùng SQLite guard và DB cô lập. Không sửa/khôi phục DB, schema, migration, tài khoản hoặc quyền. Finding về tính bất biến DB được giữ trong kết luận, không che bằng hash mới.

## 9. Safety closure

- 579 files được bảo vệ: chỉ `Forecast.tsx` thay đổi, thêm đúng `Forecast.test.tsx`. Các thay đổi cũ được bảo toàn; `safety-final.json` ghi rõ ranh giới và finding DB.
- Backend/Python, `.env`, model Forecast và **221 model Weather**, schema/features/H14, Parent, SHAP, Medical Knowledge, Forecast backend, Excel và Graduation không bị sửa. Không training hoặc thay model.
- Không import bệnh nhân, migration, chỉnh quyền/tài khoản thật, tạo job y khoa thật hoặc export report ghi lịch sử thật. Readiness DB thật chỉ kiểm tra sự có mặt/khoảng kỳ và aggregate timestamps qua kết nối read-only.
- Không start/stop/restart/kill backend; các PID trước/sau giữ nguyên. Không production lifespan trong test. Frontend đang chạy có thể nhận HMR cho source sửa; không tự điều khiển phiên đăng nhập/browser thật.
- Không reset/stash/clean/restore/checkout/stage/commit/push; Git index giữ nguyên hash. Không xóa working tree hoặc dữ liệu cũ. Basetemp là thư mục bằng chứng mới riêng cho lần test này.
- External network chỉ một Open-Meteo GET với tọa độ thành phố công khai; còn lại HTTP localhost không auth và test offline. Không đưa dữ liệu bệnh nhân/credential ra ngoài.

## 10. Những gì chưa được chứng minh và bước nghiệm thu cuối

Chưa chứng minh: UI/browser desktop/mobile thật; browser GPS; live login/Staff API với tài khoản thật; toàn bộ Forecast run với Excel qua UI; import Excel hợp lệ end-to-end; scientific accuracy trên dữ liệu ngoài phân phối; toàn bộ record DB thật bất biến trong khi backend/session hoạt động. Các mục này không được gắn PASS dựa trên mocks.

Checklist ngắn tại [MANUAL_CHROME_CHECKLIST.md](MANUAL_CHROME_CHECKLIST.md). Những thao tác có ghi dữ liệu chỉ nghiệm thu trong môi trường test/bản sao DB được phép ghi. Không cần mở phase redesign hoặc tối ưu AI để hoàn thành audit này.

**Chốt:** hai MAJOR đã tái hiện được sửa và regression đạt; không phát hiện CRITICAL trong phạm vi đã kiểm tra. Có thể chuẩn bị demo với điều kiện nghiệm thu Chrome và chấp nhận các giới hạn nêu trên. Dừng đúng phạm vi.

## 11. Phân loại cuối cùng

| Mức độ | Phát hiện | Trạng thái |
|---|---|---|
| CRITICAL | Không phát hiện trong phạm vi đã kiểm tra | Không suy rộng thành chứng nhận toàn hệ thống không có lỗi |
| MAJOR F01 | Forecast nuốt lỗi đọc, có thể báo hoàn tất khi chưa tải được kết quả | **Đã sửa và lưu; regression PASS** |
| MAJOR F02 | Response tải ban đầu ghi đè kết quả Forecast mới | **Đã sửa và lưu; regression PASS** |
| MINOR / test infrastructure | Timeout lazy-load Dashboard ở lượt đầu; deprecation/act/chart warnings | Giữ evidence; file test riêng và full suite cuối PASS, không chỉnh timeout/dependency để né lỗi |
| FINDING / nguyên nhân chưa xác định đầy đủ | DB thật đổi hash khi backend/session đang hoạt động | Giữ nguyên finding; không kết luận tác nhân, không sửa hoặc khôi phục DB |
| NOT VERIFIED | Browser desktop/mobile, GPS và UI E2E; các phạm vi nêu tại mục 10 | Checklist Chrome đã lưu; chưa gắn nhãn DEMO READY toàn hệ thống |

## 12. Xác minh tiếp tục sau gián đoạn

- Đã đọc lại file thực tế trong workspace và đối chiếu baseline 579 files: vẫn chỉ sửa `Forecast.tsx`, thêm `Forecast.test.tsx`; Git index không đổi. Không ghi đè các thay đổi có trước.
- Source Forecast hiện tại khớp hoàn toàn `forecast-fix.diff` đã lưu; source và file test có thời điểm sửa trước log frontend cuối. Đã ghi hash source/evidence hiện tại vào `resume-verification.json` để đối chiếu tiếp về sau.
- Đã xác nhận log cuối chứa 642 frontend PASS, 275 backend PASS, 14 targeted regression PASS; 26 API checks đều PASS. Typecheck/build/diff-check evidence còn đầy đủ.
- Manifest PDF giữ 8 trang, đủ 8 ảnh render và 2 contact sheets; cả 7 CSV khớp SHA-256 trong manifest. Không tạo lại hoặc ghi đè PDF/CSV.
- Backend PID 27640 vẫn có `--reload`, child 48008 còn hiện diện. Không sửa Python, restart/kill hoặc thực hiện request DB mới trong bước tiếp tục này.
- Không chạy lại toàn bộ test suite, không mở rộng audit, không sửa thêm code sản phẩm. Báo cáo và checklist Chrome đã hoàn chỉnh; kết luận giữ **PASS_WITH_FINDINGS**. Dừng.
