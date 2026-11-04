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
customers = data["data"]["customers"]

with engine.connect() as conn:
    biz_id = conn.execute(text("SELECT id FROM businesses LIMIT 1")).scalar()
    existing_sales = conn.execute(text("SELECT sale_number, client_request_id FROM sales WHERE business_id = :b"), {"b": biz_id}).fetchall()
    existing_req_ids = {s.client_request_id for s in existing_sales if s.client_request_id}
    existing_sale_numbers = {s.sale_number for s in existing_sales}
    
    existing_custs = conn.execute(text("SELECT id, name, phone FROM customers WHERE business_id = :b"), {"b": biz_id}).fetchall()
    phone_map = {c.phone.strip(): c for c in existing_custs if c.phone}
    name_map = {c.name.strip().lower(): c for c in existing_custs if c.name}

# Customer map from json
cust_phone_map = {c.get("phone", "").strip(): c for c in customers if c.get("phone")}

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

print(f"Total new bills: {len(new_bills)}")

for b in new_bills:
    b_no = b.get("no")
    p = (b.get("phone") or "").strip()
    n = (b.get("customer") or "").strip()
    
    matched_cust = None
    if p and p in phone_map:
        matched_cust = f"DB Phone ({phone_map[p].name})"
    elif p and p in cust_phone_map:
        matched_cust = f"JSON Phone ({cust_phone_map[p].get('name')})"
    elif n.lower() in name_map:
        matched_cust = f"DB Name ({name_map[n.lower()].name})"
    elif "walk-in" in n.lower():
        matched_cust = "Walk-in Guest"
    else:
        matched_cust = "NEW NAMED CUST WITHOUT MATCH"
        
    print(f"  Bill {b_no}: cust='{n}', phone='{p}' -> Matched: {matched_cust}")
