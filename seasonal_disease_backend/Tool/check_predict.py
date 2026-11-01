import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

print("=== predict_current ===")
cur.execute("SELECT COUNT(*) FROM monthly_statistics WHERE data_type='predict_current'")
print("Total rows:", cur.fetchone()[0])

cur.execute("SELECT COUNT(DISTINCT disease_group) FROM monthly_statistics WHERE data_type='predict_current'")
print("Distinct disease_group:", cur.fetchone()[0])

cur.execute("SELECT COUNT(DISTINCT age_group) FROM monthly_statistics WHERE data_type='predict_current'")
print("Distinct age_group:", cur.fetchone()[0])

cur.execute("SELECT COUNT(DISTINCT period) FROM monthly_statistics WHERE data_type='predict_current'")
print("Distinct periods:", cur.fetchone()[0])

cur.execute("SELECT MIN(period), MAX(period) FROM monthly_statistics WHERE data_type='predict_current'")
print("Period range:", cur.fetchone())

print()
print("=== disease_group list (predict_current) ===")
cur.execute("SELECT DISTINCT disease_group FROM monthly_statistics WHERE data_type='predict_current' ORDER BY disease_group")
for r in cur.fetchall():
    print(" ", r[0])

print()
print("=== patient_records ===")
cur.execute("SELECT data_type, COUNT(*) FROM patient_records GROUP BY data_type")
rows = cur.fetchall()
if rows:
    for r in rows:
        print(r)
else:
    print("patient_records is EMPTY")

print()
print("=== train_history ===")
cur.execute("SELECT COUNT(DISTINCT disease_group) FROM monthly_statistics WHERE data_type='train_history'")
print("Distinct disease_group (train):", cur.fetchone()[0])

conn.close()
