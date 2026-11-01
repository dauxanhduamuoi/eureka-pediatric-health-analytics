import pandas as pd
from dateutil.relativedelta import relativedelta

# Đọc file gốc
df = pd.read_csv(r'C:\Users\LENOVO\Desktop\Bài học trên trường\Thuc tap\predict_current_2.csv')

# Parse ngày tháng
df['check_in_date'] = pd.to_datetime(df['check_in_date'], format='%m/%d/%Y %H:%M')
df['date_of_birth'] = pd.to_datetime(df['date_of_birth'], format='%m/%d/%Y %H:%M')

# Tính tháng tuổi (từ ngày sinh đến ngày nhập viện)
def calc_age_months(row):
    rd = relativedelta(row['check_in_date'], row['date_of_birth'])
    return rd.years * 12 + rd.months

df['month'] = df.apply(calc_age_months, axis=1)

# Format lại ngày về dạng cũ (Windows dùng %#m, %#d)
df['check_in_date'] = df['check_in_date'].dt.strftime('%#m/%#d/%Y %H:%M')
df['date_of_birth'] = df['date_of_birth'].dt.strftime('%#m/%#d/%Y %H:%M')

# Lưu file mới với encoding utf-8-sig để Excel đọc đúng tiếng Việt
output_path = r'C:\Users\LENOVO\Desktop\Bài học trên trường\Thuc tap\predict_current_2_fixed.csv'
df.to_csv(output_path, index=False, encoding='utf-8-sig')

print(f"Hoàn tất! Đã lưu tại: {output_path}")
print(f"Tổng: {len(df)} dòng")
print(f"Tháng tuổi: min={df['month'].min()}, max={df['month'].max()}")
