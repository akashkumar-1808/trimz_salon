import json
import hashlib
from decimal import Decimal
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with open("docs/TRIMZ-backup-2026-11-01.json", "rb") as f:
    content = f.read()

sha256 = hashlib.sha256(content).hexdigest()
data = json.loads(content.decode("utf-8"))

collections = data.get("data", {})
customers = collections.get("customers", [])
services = collections.get("services", [])
bills = collections.get("bills", [])
staff = collections.get("staff", [])
memberships = collections.get("memberships", [])

total_rev = sum(Decimal(str(b.get("total", 0))) for b in bills)
total_sub = sum(Decimal(str(b.get("subtotal", 0))) for b in bills)
total_disc = sum(Decimal(str(b.get("discount", 0))) for b in bills)
total_tax = sum(Decimal(str(b.get("tax", 0))) for b in bills)

print(f"File SHA-256: {sha256}")
print(f"ExportedAt: {data.get('exportedAt')}")
print(f"Total customers in file: {len(customers)}")
print(f"Total services in file: {len(services)}")
print(f"Total staff in file: {len(staff)}")
print(f"Total memberships in file: {len(memberships)}")
print(f"Total bills in file: {len(bills)}")
print(f"Total revenue in file: Rs. {total_rev}")
print(f"Total subtotal in file: Rs. {total_sub}")
print(f"Total discount in file: Rs. {total_disc}")
print(f"Total tax in file: Rs. {total_tax}")

# Dates
dates = [b.get("date") for b in bills if b.get("date")]
print(f"Earliest bill date: {min(dates)}, Latest bill date: {max(dates)}")

# Check against DB
with engine.connect() as conn:
    biz_id = conn.execute(text("SELECT id FROM businesses LIMIT 1")).scalar()
    existing_sales = conn.execute(text("SELECT sale_number, client_request_id, total_amount FROM sales WHERE business_id = :b"), {"b": biz_id}).fetchall()
    existing_sale_numbers = {s.sale_number for s in existing_sales}
    existing_req_ids = {s.client_request_id for s in existing_sales if s.client_request_id}
    
    existing_custs = conn.execute(text("SELECT id, phone, name FROM customers WHERE business_id = :b"), {"b": biz_id}).fetchall()
    existing_phones = {c.phone for c in existing_custs if c.phone}
    existing_names = {c.name.strip().lower() for c in existing_custs if c.name}
    
    print(f"\nExisting in DB: {len(existing_sales)} sales, {len(existing_custs)} customers")
    
    # Check bills overlap
    new_bills = []
    already_migrated_bills = []
    for idx, b in enumerate(bills):
        raw_no = b.get("no", "").strip()
        # check both candidate number and occurrence key
        if raw_no in existing_sale_numbers or f"legacy-import-{raw_no}-1" in existing_req_ids:
            already_migrated_bills.append(b)
        else:
            new_bills.append(b)
            
    print(f"Already migrated bills: {len(already_migrated_bills)}")
    print(f"New bills to migrate: {len(new_bills)}")
    
    new_rev = sum(Decimal(str(b.get("total", 0))) for b in new_bills)
    new_sub = sum(Decimal(str(b.get("subtotal", 0))) for b in new_bills)
    new_disc = sum(Decimal(str(b.get("discount", 0))) for b in new_bills)
    new_tax = sum(Decimal(str(b.get("tax", 0))) for b in new_bills)
    
    print(f"New bills revenue: Rs. {new_rev}")
    print(f"New bills subtotal: Rs. {new_sub}")
    print(f"New bills discount: Rs. {new_disc}")
    print(f"New bills tax: Rs. {new_tax}")
    
    if new_bills:
        print("\nSample new bills:")
        for b in new_bills[:10]:
            print(f"  {b.get('no')}: {b.get('date')} | {b.get('customer')} ({b.get('phone')}) | Total: Rs. {b.get('total')} | Items: {b.get('items')} | Staff: {b.get('staff')}")
        if len(new_bills) > 10:
            print(f"  ... and {len(new_bills) - 10} more.")
            
    # Check new customers
    new_cust_phones = []
    for c in customers:
        p = (c.get("phone") or "").strip()
        if p and p not in existing_phones:
            new_cust_phones.append((c.get("name"), p))
    print(f"\nNew customers with phone numbers not yet in DB: {len(new_cust_phones)}")
    for name, phone in new_cust_phones:
        print(f"  {name}: {phone}")
