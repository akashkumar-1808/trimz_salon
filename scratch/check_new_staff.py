import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with open("docs/TRIMZ-backup-2026-11-01.json", "rb") as f:
    data = json.load(f)

bills = data["data"]["bills"]

with engine.connect() as conn:
    biz_id = conn.execute(text("SELECT id FROM businesses LIMIT 1")).scalar()
    existing_sales = conn.execute(text("SELECT sale_number, client_request_id FROM sales WHERE business_id = :b"), {"b": biz_id}).fetchall()
    existing_req_ids = {s.client_request_id for s in existing_sales if s.client_request_id}
    existing_sale_numbers = {s.sale_number for s in existing_sales}
    
    profiles = conn.execute(text("SELECT id, name FROM profiles WHERE business_id = :b"), {"b": biz_id}).fetchall()
    print("Profiles in DB:")
    for p in profiles:
        print(f"  {p.id}: {p.name}")

indexed_bills = list(enumerate(bills))
indexed_bills.sort(key=lambda x: (x[1].get("date", "2026-10-01"), x[0]))

invoice_occ = {}
new_bills = []
for idx, b in indexed_bills:
    raw_no = b.get("no", "").strip()
    invoice_occ[raw_no] = invoice_occ.get(raw_no, 0) + 1
    occ = invoice_occ[raw_no]
    idemp_key = f"legacy-import-{raw_no}-{occ}"
    if idemp_key not in existing_req_ids and raw_no not in existing_sale_numbers:
        new_bills.append(b)

staff_counts = {}
for b in new_bills:
    st = (b.get("staff") or "Unknown").strip()
    staff_counts[st] = staff_counts.get(st, 0) + 1

print("\nStaff attribution in new bills:")
for s, c in staff_counts.items():
    print(f"  '{s}': {c} bills")
