import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

# Test API 4: disease-by-gender
print("=== disease-by-gender: top 10 ===")
cur.execute("""
    SELECT disease_group, gender, COUNT(*) as case_count
    FROM patient_records
    WHERE data_type='predict_current'
    GROUP BY disease_group, gender
""")

rows = cur.fetchall()

grouped = {}
for dg, gender, count in rows:
    if dg not in grouped:
        grouped[dg] = {"male": 0, "female": 0, "other": 0}
    g = (gender or "").strip().lower()
    if g in ("nam", "male", "m"):
        grouped[dg]["male"] += count
    elif g in ("nữ", "nu", "female", "f"):
        grouped[dg]["female"] += count
    else:
        grouped[dg]["other"] += count

output = []
for dg, counts in grouped.items():
    total = counts["male"] + counts["female"] + counts["other"]
    output.append((dg, counts["male"], counts["female"], counts["other"], total))

output.sort(key=lambda x: x[4], reverse=True)

for dg, m, f, o, total in output[:10]:
    m_pct = round(m/total*100, 1) if total > 0 else 0
    f_pct = round(f/total*100, 1) if total > 0 else 0
    print(f"  {dg[:45]:45s} | Nam={m}({m_pct}%) Nữ={f}({f_pct}%) Khác={o} | Total={total}")

conn.close()
