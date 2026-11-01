import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 2: year-over-year
print("=== year-over-year: month=6, all diseases ===")
cur.execute("""
    SELECT year, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current' AND month=6
    GROUP BY year
    ORDER BY year
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} ca")

print("\n=== year-over-year: month=6, Viêm phổi ===")
cur.execute("""
    SELECT year, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current' AND month=6
      AND disease_group='Các bệnh viêm phổi - Pneumonia'
    GROUP BY year
    ORDER BY year
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} ca")

conn.close()
