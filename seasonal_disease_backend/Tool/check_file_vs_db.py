import openpyxl
import sqlite3

# Doc file predict_current_2_fixed.xlsx
file_path = "uploads/predict_current_2_fixed.xlsx"
wb = openpyxl.load_workbook(file_path, read_only=True)

print("Sheets:", wb.sheetnames)

# Doc sheet benh nhan
patient_sheet = None
for name in ["DS-BenhNhan", "DS_BenhNhan", "BenhNhan", "Sheet1"]:
    if name in wb.sheetnames:
        patient_sheet = wb[name]
        print(f"\n=== Sheet benh nhan: {name} ===")
        break

if patient_sheet:
    rows = list(patient_sheet.iter_rows(values_only=True))
    headers = rows[0]
    data = rows[1:]
    print("Headers:", headers)
    print("So dong benh nhan:", len(data))

# Doc sheet ma benh
disease_sheet = None
for name in ["DS-MaBenh", "DS_MaBenh", "MaBenh"]:
    if name in wb.sheetnames:
        disease_sheet = wb[name]
        print(f"\n=== Sheet ma benh: {name} ===")
        break

if disease_sheet:
    d_rows = list(disease_sheet.iter_rows(values_only=True))
    d_headers = d_rows[0]
    d_data = d_rows[1:]
    print("Headers:", d_headers)
    print("So dong ma benh:", len(d_data))

    # Tim cot TENNHOMICD
    if "TENNHOMICD" in d_headers:
        idx = d_headers.index("TENNHOMICD")
        groups_in_file = set()
        for row in d_data:
            val = row[idx]
            if val is not None:
                groups_in_file.add(str(val).strip())
        print("Distinct nhom benh trong file:", len(groups_in_file))

wb.close()

# So sanh voi DB
print("\n\n=== SO SANH VOI DB ===")
conn = sqlite3.connect("database.db")
cur = conn.cursor()

cur.execute("SELECT COUNT(*) FROM patient_records WHERE data_type='predict_current'")
print("DB patient_records (predict_current):", cur.fetchone()[0], "dong")

cur.execute("SELECT DISTINCT disease_group FROM monthly_statistics WHERE data_type='predict_current' ORDER BY disease_group")
db_groups = [r[0] for r in cur.fetchall()]
print("DB monthly_statistics nhom benh:", len(db_groups))

cur.execute("SELECT source_file, total_rows, created_at FROM import_logs WHERE data_type='predict_current' ORDER BY id DESC LIMIT 5")
print("\nImport logs gan nhat:")
for r in cur.fetchall():
    print(" ", r)

# So dong file vs DB
if patient_sheet:
    print(f"\nFile predict_current_2_fixed.xlsx: {len(data)} dong benh nhan")
    print(f"DB patient_records (predict_current): xem o tren")
    if len(data) != 16332:
        print("=> FILE KHAC VOI DU LIEU TRONG DB (DB co 16332 dong)")
    else:
        print("=> SO DONG KHOP")

conn.close()
