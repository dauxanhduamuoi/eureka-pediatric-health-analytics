"""
Migrate admin user (and any other users) from the orphan scripts/database.db
to the real database.db at project root.

Safe to re-run: uses INSERT OR IGNORE on (username).
"""
import sqlite3
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "scripts" / "database.db"
DST = ROOT / "database.db"

print("Source:", SRC, "exists:", SRC.exists())
print("Dest  :", DST, "exists:", DST.exists())

if not SRC.exists():
    raise SystemExit("No source DB. Nothing to migrate.")
if not DST.exists():
    raise SystemExit("Dest DB missing. Start the backend at least once first.")

src = sqlite3.connect(str(SRC))
dst = sqlite3.connect(str(DST))

try:
    rows = src.execute(
        "SELECT username, password_hash, full_name, role, is_active, created_at "
        "FROM users"
    ).fetchall()
    print(f"Found {len(rows)} user(s) in source.")

    cur = dst.cursor()
    inserted = 0
    skipped = 0
    for r in rows:
        username = r[0]
        existing = cur.execute(
            "SELECT id FROM users WHERE username = ?", (username,)
        ).fetchone()
        if existing:
            print(f"  - SKIP (already exists in dest): {username}")
            skipped += 1
            continue
        cur.execute(
            "INSERT INTO users (username, password_hash, full_name, role, is_active, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            r,
        )
        print(f"  - COPIED: {username}")
        inserted += 1

    dst.commit()
    print(f"Done. Inserted={inserted}, Skipped={skipped}")

    print("\nFinal users in dest DB:")
    for u in dst.execute(
        "SELECT id, username, role, is_active FROM users ORDER BY id"
    ).fetchall():
        print(" ", u)
finally:
    src.close()
    dst.close()
