import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 8: forecast/accuracy
# Check if we have forecast_results and actual data for the same period
print("=== forecast_results periods ===")
cur.execute("""
    SELECT forecast_period, COUNT(*) as rows
    FROM forecast_results
    GROUP BY forecast_period
""")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(f"  {r[0]}: {r[1]} rows")
else:
    print("  (no forecast results yet)")

print("\n=== predict_current periods with actual data ===")
cur.execute("""
    SELECT period, SUM(case_count) as total
    FROM monthly_statistics
    WHERE data_type='predict_current'
    ORDER BY period DESC
    LIMIT 5
""")
for r in cur.fetchall():
    print(f"  {r[0]}: {r[1]} ca")

# Simulate accuracy check for a period that has both forecast and actual
# Let's check if 2026-05 has both
print("\n=== Simulating accuracy for 2026-05 ===")
cur.execute("""
    SELECT disease_group, SUM(predicted_cases) as predicted
    FROM forecast_results
    WHERE forecast_period='2026-05' AND trend != 'Không thể dự đoán'
    GROUP BY disease_group
""")
predicted = cur.fetchall()

cur.execute("""
    SELECT disease_group, SUM(case_count) as actual
    FROM monthly_statistics
    WHERE data_type='predict_current' AND period='2026-05'
    GROUP BY disease_group
""")
actual = cur.fetchall()

if predicted and actual:
    pred_map = {r[0]: r[1] for r in predicted}
    act_map = {r[0]: r[1] for r in actual}
    print(f"Predicted groups: {len(pred_map)}, Actual groups: {len(act_map)}")
    total_p = sum(pred_map.values())
    total_a = sum(act_map.values())
    total_err = sum(abs(pred_map.get(dg, 0) - act_map.get(dg, 0)) for dg in set(pred_map) | set(act_map))
    acc = round((1 - total_err/total_a)*100, 1) if total_a > 0 else None
    print(f"Total predicted: {total_p}, Total actual: {total_a}")
    print(f"Total error: {total_err}, Overall accuracy: {acc}%")
else:
    print("No overlapping data for 2026-05 (forecast_results might be empty)")
    print("This API will work once forecast is run and actual data exists for same period")

conn.close()
