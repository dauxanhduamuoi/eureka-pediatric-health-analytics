import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 5: disease-season-comparison
print("=== disease-season-comparison: top 10 ===")
cur.execute("""
    SELECT disease_group, season, SUM(case_count) as case_count
    FROM monthly_statistics
    WHERE data_type='predict_current'
    GROUP BY disease_group, season
""")

rows = cur.fetchall()

grouped = {}
for dg, season, count in rows:
    if dg not in grouped:
        grouped[dg] = {"dry": 0, "rainy": 0}
    if season == "Mùa khô":
        grouped[dg]["dry"] += count
    elif season == "Mùa mưa":
        grouped[dg]["rainy"] += count

output = []
for dg, counts in grouped.items():
    total = counts["dry"] + counts["rainy"]
    if counts["dry"] > counts["rainy"]:
        dominant = "Mùa khô"
    elif counts["rainy"] > counts["dry"]:
        dominant = "Mùa mưa"
    else:
        dominant = "Ngang nhau"
    output.append((dg, counts["dry"], counts["rainy"], total, dominant))

output.sort(key=lambda x: x[3], reverse=True)

for dg, dry, rainy, total, dominant in output[:10]:
    dry_pct = round(dry/total*100, 1) if total > 0 else 0
    rainy_pct = round(rainy/total*100, 1) if total > 0 else 0
    print(f"  {dg[:45]:45s} | Khô={dry}({dry_pct}%) Mưa={rainy}({rainy_pct}%) | {dominant}")

conn.close()
