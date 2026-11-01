import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 3: seasonal-peak
print("=== seasonal-peak: top 10 disease groups by peak month ===")
cur.execute("""
    SELECT disease_group, month, AVG(case_count) as avg_cases
    FROM monthly_statistics
    WHERE data_type='predict_current'
    GROUP BY disease_group, month
""")

rows = cur.fetchall()

# Find peak month per disease_group
best = {}
for r in rows:
    disease_group, month, avg_cases = r
    if disease_group not in best or avg_cases > best[disease_group][1]:
        best[disease_group] = (month, avg_cases)

# Sort by avg_cases desc
output = sorted(best.items(), key=lambda x: x[1][1], reverse=True)

for disease_group, (peak_month, avg_cases) in output[:10]:
    season = "Mùa khô" if peak_month in [12,1,2,3,4] else "Mùa mưa"
    print(f"  {disease_group[:50]:50s} | tháng {peak_month:2d} ({season}) | avg={avg_cases:.1f}")

conn.close()
