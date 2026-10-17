import csv

input_file = "raw_users.csv"
output_file = "bulk_users_converted.csv"

# Read raw users
with open(input_file, "r", encoding="utf-8") as f:
    reader = csv.reader(f)
    rows = list(reader)

header = ['employeeId', 'firstName', 'department name', 'department raiser name', 'desginations', 'BRANCH', 'STATE', 'MOBILE NO', 'Mail Id']

output_rows = [header]
for r in rows[1:]:
    if not r or len(r) < 8:
        continue
    code = r[0].strip()
    name = r[1].strip()
    desig = r[2].strip()
    dept = r[3].strip()
    branch = r[4].strip()
    state = r[5].strip()
    mobile = r[6].strip()
    mail = r[7].strip() if len(r) > 7 else ''
    output_rows.append([code, name, dept, dept, desig, branch, state, mobile, mail])

with open(output_file, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerows(output_rows)

print(f"Successfully converted {len(output_rows) - 1} users to {output_file}")
