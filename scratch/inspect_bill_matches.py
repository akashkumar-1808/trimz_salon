import json
from decimal import Decimal
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
    existing_sales = conn.execute(text("SELECT sale_number, client_request_id, total_amount, date(created_at) as d FROM sales WHERE business_id = :b"), {"b": biz_id}).fetchall()
    existing_sale_numbers = {s.sale_number: s for s in existing_sales}
    existing_req_ids = {s.client_request_id: s for s in existing_sales if s.client_request_id}

indexed_bills = list(enumerate(bills))
indexed_bills.sort(key=lambda x: (x[1].get("date", "2026-10-01"), x[0]))

invoice_occ = {}
matched = []
unmatched = []

for idx, b in indexed_bills:
    raw_no = b.get("no", "").strip()
    invoice_occ[raw_no] = invoice_occ.get(raw_no, 0) + 1
    occ = invoice_occ[raw_no]
    idemp_key = f"legacy-import-{raw_no}-{occ}"
    
    # check if this idemp_key exists
    if idemp_key in existing_req_ids:
        matched.append((raw_no, occ, idemp_key, b))
    elif raw_no in existing_sale_numbers and occ == 1:
        matched.append((raw_no, occ, "by_sale_no", b))
    else:
        unmatched.append((raw_no, occ, idemp_key, b))

print(f"Total bills: {len(bills)}")
print(f"Matched existing: {len(matched)}")
print(f"Unmatched (new): {len(unmatched)}")

print("\nList of unmatched bills:")
for no, occ, k, b in unmatched:
    print(f"  {no} (occ {occ}): date={b.get('date')} total={b.get('total')} cust={b.get('customer')} ({b.get('phone')}) items={b.get('items')} staff={b.get('staff')}")
