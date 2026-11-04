import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with open("docs/TRIMZ-backup-2026-11-01.json", "rb") as f:
    data = json.load(f)

customers = data["data"]["customers"]
bills = data["data"]["bills"]

print("Search in JSON customers for 'anuj':")
for c in customers:
    if "anuj" in c.get("name", "").lower() or "949198" in c.get("phone", ""):
        print(f"  {c}")

print("\nSearch in JSON bills for 'anuj':")
for b in bills:
    if "anuj" in b.get("customer", "").lower() or "949198" in b.get("phone", ""):
        print(f"  Bill {b.get('no')}: {b.get('customer')} ({b.get('phone')})")

print("\nSearch in DB customers for 'anuj':")
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, name, phone FROM customers WHERE name ILIKE '%anuj%' OR phone ILIKE '%949198%'")).fetchall()
    for r in res:
        print(f"  DB: {r.id} | {r.name} | {r.phone}")

print("\nSearch in JSON customers for 'dhan':")
for c in customers:
    if "dhan" in c.get("name", "").lower():
        print(f"  {c}")

print("\nSearch in DB customers for 'dhan':")
with engine.connect() as conn:
    res = conn.execute(text("SELECT id, name, phone FROM customers WHERE name ILIKE '%dhan%'")).fetchall()
    for r in res:
        print(f"  DB: {r.id} | {r.name} | {r.phone}")
