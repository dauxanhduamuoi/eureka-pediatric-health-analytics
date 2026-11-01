import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DB = ROOT / "database.db"

conn = sqlite3.connect(str(DB))
cur = conn.cursor()

print("===== monthly_statistics by data_type & period =====")
cur.execute("""
SELECT data_type, period, COUNT(*) AS combo_rows, SUM(case_count) AS total_cases
FROM monthly_statistics
GROUP BY data_type, period
ORDER BY data_type, period
""")
for r in cur.fetchall():
    print(r)

print("\n===== combinations (disease_group, age_group) per data_type =====")
cur.execute("""
SELECT data_type, COUNT(DISTINCT disease_group || '||' || age_group) AS combos
FROM monthly_statistics
GROUP BY data_type
""")
for r in cur.fetchall():
    print(r)

print("\n===== periods range per data_type =====")
cur.execute("""
SELECT data_type, MIN(period), MAX(period), COUNT(DISTINCT period) AS n_periods
FROM monthly_statistics
GROUP BY data_type
""")
for r in cur.fetchall():
    print(r)

print("\n===== forecast_results (latest 30) =====")
cur.execute("""
SELECT forecast_period, disease_group, age_group, previous_cases, predicted_cases, change_percent, trend, risk_level
FROM forecast_results
ORDER BY id DESC
LIMIT 30
""")
for r in cur.fetchall():
    print(r)

print("\n===== combinations only in predict_current but NOT in train_history =====")
cur.execute("""
SELECT DISTINCT disease_group, age_group
FROM monthly_statistics
WHERE data_type='predict_current'
  AND (disease_group, age_group) NOT IN (
      SELECT DISTINCT disease_group, age_group FROM monthly_statistics WHERE data_type='train_history'
  )
""")
rows = cur.fetchall()
print("count:", len(rows))
for r in rows[:10]:
    print(r)

conn.close()
