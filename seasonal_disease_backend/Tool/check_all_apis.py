import re

# Check dashboard.py endpoints
with open('app/routers/dashboard.py', encoding='utf-8') as f:
    content = f.read()

endpoints = re.findall(r'@router\.(get|post)\("([^"]+)"', content)
print("=== dashboard.py endpoints ===")
for method, path in endpoints:
    print(f"  {method.upper()} /api/dashboard{path}")

print()

# Check forecast.py endpoints
with open('app/routers/forecast.py', encoding='utf-8') as f:
    content = f.read()

endpoints = re.findall(r'@router\.(get|post)\("([^"]+)"', content)
print("=== forecast.py endpoints ===")
for method, path in endpoints:
    print(f"  {method.upper()} /api/forecast{path}")

print()

# Check new APIs exist
new_apis = [
    "disease-trend",
    "year-over-year",
    "seasonal-peak",
    "disease-by-gender",
    "disease-season-comparison",
    "periods",
    "disease-groups",
    "summary-card",
    "accuracy",
]

with open('app/routers/dashboard.py', encoding='utf-8') as f:
    dash_content = f.read()
with open('app/routers/forecast.py', encoding='utf-8') as f:
    fore_content = f.read()

all_content = dash_content + fore_content

print("=== 9 NEW APIs CHECK ===")
all_found = True
for api in new_apis:
    found = f'"/{api}"' in all_content
    status = "FOUND" if found else "MISSING"
    if not found:
        all_found = False
    print(f"  {api}: {status}")

print()
if all_found:
    print("ALL 9 APIs PRESENT")
else:
    print("SOME APIs MISSING!")
