import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 6: periods
print("=== periods (first 5 and last 5) ===")
cur.execute("""
    SELECT period, year, month, season
    FROM monthly_statistics
    WHERE data_type='predict_current'
    GROUP BY period, year, month, season
    ORDER BY period
""")
rows = cur.fetchall()
print(f"Total periods: {len(rows)}")
for r in rows[:5]:
    print(f"  {r}")
print("  ...")
for r in rows[-5:]:
    print(f"  {r}")

# Test API 7: disease-groups
print("\n=== disease-groups ===")
cur.execute("""
    SELECT disease_group, SUM(case_count) as total_cases
    FROM monthly_statistics
    WHERE data_type='predict_current'
    GROUP BY disease_group
    ORDER BY total_cases DESC
""")
rows = cur.fetchall()
print(f"Total groups: {len(rows)}")
for r in rows:
    print(f"  {r[0][:50]:50s} | {r[1]} ca")

conn.close()
