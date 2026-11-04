import json
from decimal import Decimal
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os
import sys
sys.path.insert(0, ".")

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
    
    db_services = conn.execute(text("""
        SELECT s.id, s.name, s.price, s.audience, s.variant_name, sc.name as category_name
        FROM services s
        JOIN service_categories sc ON s.category_id = sc.id
    """)).fetchall()

# Import resolve_catalogue_service logic
from backend.scripts.migrate_legacy_data import resolve_catalogue_service

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

print(f"Total new bills to migrate: {len(new_bills)}")

unmatched_services = []
matched_services = []

for b in new_bills:
    lines = b.get("lines", [])
    if not lines:
        print(f"Bill {b.get('no')} has NO lines! Items string: {b.get('items')}")
    for l in lines:
        l_name = l.get("name", "").strip()
        l_price = Decimal(str(l.get("price", 0)))
        svc, method = resolve_catalogue_service(l_name, l_price, db_services)
        if svc:
            matched_services.append((b.get("no"), l_name, l_price, svc.name, method))
        else:
            unmatched_services.append((b.get("no"), l_name, l_price))

print(f"\nTotal matched line items: {len(matched_services)}")
print(f"Total unmatched line items: {len(unmatched_services)}")

if unmatched_services:
    print("\nUnmatched services details:")
    for b_no, name, price in unmatched_services:
        print(f"  Bill {b_no}: '{name}' @ Rs. {price}")
else:
    print("ALL line items in the 33 new bills matched successfully to catalogue services!")

# Let's inspect matched methods
methods = {}
for _, _, _, _, m in matched_services:
    methods[m] = methods.get(m, 0) + 1
print("\nMatch methods breakdown:")
for m, c in sorted(methods.items(), key=lambda x: -x[1]):
    print(f"  {m}: {c}")
