import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 9: summary-card for 2025-04
period = "2025-04"

# Previous period
year, month = period.split("-")
year, month = int(year), int(month)
if month == 1:
    prev_period = f"{year-1}-12"
else:
    prev_period = f"{year}-{month-1:02d}"

print(f"=== summary-card for {period} ===")

# Total cases this month
cur.execute("""
    SELECT SUM(case_count) FROM monthly_statistics
    WHERE data_type='predict_current' AND period=?
""", (period,))
total = cur.fetchone()[0] or 0
print(f"Total cases: {total}")

# Total cases previous month
cur.execute("""
    SELECT SUM(case_count) FROM monthly_statistics
    WHERE data_type='predict_current' AND period=?
""", (prev_period,))
prev = cur.fetchone()[0] or 0
print(f"Previous month ({prev_period}): {prev}")

# Change
if prev > 0:
    change = round((total - prev) / prev * 100, 2)
else:
    change = None
print(f"Change: {change}%")

# Top 3
cur.execute("""
    SELECT disease_group, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current' AND period=?
    GROUP BY disease_group
    ORDER BY case_count DESC
    LIMIT 3
""", (period,))
print("Top 3:")
for r in cur.fetchall():
    print(f"  {r[0][:50]}: {r[1]} ca")

# Season
m = int(period.split("-")[1])
season = "Mùa khô" if m in [12,1,2,3,4] else "Mùa mưa"
print(f"Season: {season}")

conn.close()
