import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Simulate API 1: disease-trend
disease_group = "Các bệnh viêm phổi - Pneumonia"
cur.execute("""
    SELECT period, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current' AND disease_group=?
    GROUP BY period
    ORDER BY period
""", (disease_group,))

rows = cur.fetchall()
print(f"=== disease-trend for '{disease_group}' ===")
print(f"Total periods: {len(rows)}")
for r in rows[:5]:
    print(f"  {r[0]}: {r[1]} ca")
print("  ...")
for r in rows[-3:]:
    print(f"  {r[0]}: {r[1]} ca")

# Test with start/end period
cur.execute("""
    SELECT period, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current' AND disease_group=?
      AND period >= '2025-01' AND period <= '2025-06'
    GROUP BY period
    ORDER BY period
""", (disease_group,))
rows2 = cur.fetchall()
print(f"\nWith filter 2025-01 to 2025-06: {len(rows2)} rows")
for r in rows2:
    print(f"  {r[0]}: {r[1]} ca")

conn.close()
