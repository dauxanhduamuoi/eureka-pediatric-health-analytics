import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

for db_path in [ROOT / "database.db", ROOT / "scripts" / "database.db"]:
    print("=" * 70)
    print("DB:", db_path)
    if not db_path.exists():
        continue
    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    for tbl in ["users", "patient_records", "monthly_statistics", "forecast_results",
                "disease_codes", "disease_knowledge", "import_logs"]:
        try:
            cur.execute(f"SELECT COUNT(*) FROM {tbl}")
            print(f"  {tbl}: {cur.fetchone()[0]}")
        except Exception as e:
            print(f"  {tbl}: ERROR {e}")
    conn.close()
