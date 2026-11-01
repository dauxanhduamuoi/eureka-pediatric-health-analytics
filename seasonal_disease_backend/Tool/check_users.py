import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

for db_path in [ROOT / "database.db", ROOT / "scripts" / "database.db"]:
    print("=" * 70)
    print("DB:", db_path, "exists:", db_path.exists())
    if not db_path.exists():
        continue
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
    print("Tables:", [r[0] for r in cur.fetchall()])
    try:
        cur.execute("SELECT id, username, password_hash, role, is_active FROM users")
        rows = cur.fetchall()
        print("Users count:", len(rows))
        for r in rows:
            print(" id=", r[0], "username=", r[1], "role=", r[3], "is_active=", r[4])
            print("   hash_len=", len(r[2]) if r[2] else 0, "hash_prefix=", (r[2] or "")[:10])
            print("   hash_full=", r[2])
    except Exception as e:
        print("Error reading users:", e)
    conn.close()
