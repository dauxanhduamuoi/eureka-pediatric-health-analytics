import sqlite3

conn = sqlite3.connect("database.db")
cur = conn.cursor()

cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]

print("=== TABLES IN DATABASE ===")
for t in tables:
    cur.execute(f"SELECT COUNT(*) FROM {t}")
    count = cur.fetchone()[0]
    print(f"  {t}: {count} rows")

print("\n=== USERS ===")
cur.execute("SELECT id, username, role, is_active FROM users")
for r in cur.fetchall():
    print(f"  {r}")

print("\n=== MONTHLY_STATISTICS (first 5) ===")
cur.execute("SELECT * FROM monthly_statistics LIMIT 5")
for r in cur.fetchall():
    print(f"  {r}")

conn.close()
