# ID 6 — fixture thay thế, 2026-08-07

Không phải prediction trong ảnh gốc. “Có” nghĩa feature được gửi và tham gia nhóm UI; UI không in mọi tên/value/SHAP riêng.

| Feature gốc | Giá trị đầu vào | SHAP (raw) | Chiều | Nhóm giải thích | Feature vào payload/UI? | Lý do |
| --- | --- | --- | --- | --- | --- | --- |
| age_group | 1-5 tuổi | 3.47015917910 | UP | Độ tuổi | Có (UP) | Top 5 cùng dấu |
| gender | Nam | 0.0818645043363 | UP | Giới tính | Có (UP) | Top 5 cùng dấu |
| month | 8 | -0.00327029738470 | DOWN | Thời điểm trong năm | Không | Ngoài Top 5 cùng dấu |
| season | Mùa mưa | 0.00000000000 | ZERO_OR_THRESHOLD | Thời điểm trong năm | Không | Zero hoặc |SHAP| ≤ 1e-12 |
| day_of_year_sin | -0.5856957398073508 | 0.108784861728 | UP | Thời điểm trong năm | Có (MIXED) | Top 5 cùng dấu |
| day_of_year_cos | -0.8105309990194823 | -0.604980698101 | DOWN | Thời điểm trong năm | Có (MIXED) | Top 5 cùng dấu |
| weather_code_current | 2 | -0.219836982830 | DOWN | Tình trạng thời tiết hiện tại | Có (DOWN) | Top 5 cùng dấu |
| temperature_mean_current | 26.875 | -0.0129431340561 | DOWN | Nhiệt độ hiện tại | Không | Ngoài Top 5 cùng dấu |
| temperature_max_current | 29.75 | -0.0603766265926 | DOWN | Nhiệt độ hiện tại | Không | Ngoài Top 5 cùng dấu |
| temperature_min_current | 24 | -0.00739418198823 | DOWN | Nhiệt độ hiện tại | Không | Ngoài Top 5 cùng dấu |
| humidity_mean_current | 68.833333 | 0.00338379065811 | UP | Độ ẩm hiện tại | Không | Ngoài Top 5 cùng dấu |
| humidity_max_current | 79 | 0.00307269428508 | UP | Độ ẩm hiện tại | Không | Ngoài Top 5 cùng dấu |
| humidity_min_current | 60 | 0.000659948336734 | UP | Độ ẩm hiện tại | Không | Ngoài Top 5 cùng dấu |
| wind_speed_mean_current | 6.5 | 0.000489898822620 | UP | Gió hiện tại | Không | Ngoài Top 5 cùng dấu |
| wind_speed_max_current | 9 | -0.0473108696076 | DOWN | Gió hiện tại | Không | Ngoài Top 5 cùng dấu |
| precipitation_sum_current | 24 | 0.00000000000 | ZERO_OR_THRESHOLD | Mưa hiện tại | Không | Zero hoặc |SHAP| ≤ 1e-12 |
| rain_sum_current | 12 | 0.00000000000 | ZERO_OR_THRESHOLD | Mưa hiện tại | Không | Zero hoặc |SHAP| ≤ 1e-12 |
| wind_gust_max_current | 16 | -0.00796435407708 | DOWN | Gió hiện tại | Không | Ngoài Top 5 cùng dấu |
| rain_day_current | 1 | 0.00000000000 | ZERO_OR_THRESHOLD | Mưa hiện tại | Không | Zero hoặc |SHAP| ≤ 1e-12 |
| temperature_mean_3d | 26.875 | -0.0135383397274 | DOWN | Nhiệt độ trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| temperature_max_3d | 29.75 | -0.0178046941714 | DOWN | Nhiệt độ trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| temperature_min_3d | 24 | -0.00133495887429 | DOWN | Nhiệt độ trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| humidity_mean_3d | 69.277778 | 0.0114186555829 | UP | Độ ẩm trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| humidity_max_3d | 79 | -0.0414585815286 | DOWN | Độ ẩm trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| humidity_min_3d | 60 | 0.000386401685667 | UP | Độ ẩm trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| wind_speed_mean_3d | 6.5 | -0.179403521281 | DOWN | Gió trong 3 ngày gần đây | Có (DOWN) | Top 5 cùng dấu |
| wind_speed_max_3d | 9 | -0.263498411914 | DOWN | Gió trong 3 ngày gần đây | Có (DOWN) | Top 5 cùng dấu |
| precipitation_sum_3d | 72 | 0.00780681873611 | UP | Mưa trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| rain_sum_3d | 36 | 0.00000000000 | ZERO_OR_THRESHOLD | Mưa trong 3 ngày gần đây | Không | Zero hoặc |SHAP| ≤ 1e-12 |
| rain_days_3d | 3 | -0.000883605863782 | DOWN | Mưa trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| rain_max_daily_3d | 12 | -0.0223106670217 | DOWN | Mưa trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| wind_gust_max_3d | 16 | -0.0487955513867 | DOWN | Gió trong 3 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| temperature_mean_7d | 26.875 | -0.0317740179729 | DOWN | Nhiệt độ trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| temperature_max_7d | 29.75 | -0.0582886177027 | DOWN | Nhiệt độ trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| temperature_min_7d | 24 | 0.131695700928 | UP | Nhiệt độ trong 7 ngày gần đây | Có (UP) | Top 5 cùng dấu |
| humidity_mean_7d | 69.214286 | 0.0352588421437 | UP | Độ ẩm trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| humidity_max_7d | 79 | -0.364019548423 | DOWN | Độ ẩm trong 7 ngày gần đây | Có (DOWN) | Top 5 cùng dấu |
| humidity_min_7d | 60 | 0.00568588633626 | UP | Độ ẩm trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| wind_speed_mean_7d | 6.5 | 0.138080164914 | UP | Gió trong 7 ngày gần đây | Có (UP) | Top 5 cùng dấu |
| wind_speed_max_7d | 9 | -0.171751057995 | DOWN | Gió trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| precipitation_sum_7d | 168 | -0.0581386650571 | DOWN | Mưa trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| rain_sum_7d | 84 | -0.00548546182612 | DOWN | Mưa trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| rain_days_7d | 7 | -0.0246873973131 | DOWN | Mưa trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| rain_max_daily_7d | 12 | -0.109844183419 | DOWN | Mưa trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
| wind_gust_max_7d | 16 | 0.0301808712525 | UP | Gió trong 7 ngày gần đây | Không | Ngoài Top 5 cùng dấu |
