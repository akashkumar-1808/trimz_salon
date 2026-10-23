import os
import sys
import json
from datetime import datetime, date
from decimal import Decimal
from uuid import UUID
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

def custom_serializer(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    if isinstance(obj, Decimal):
        return str(obj)
    if isinstance(obj, UUID):
        return str(obj)
    if isinstance(obj, bytes):
        return obj.hex()
    raise TypeError(f"Type {type(obj)} not serializable")

backup_data = {}
tables = [
    "businesses", "profiles", "roles", "permissions", "role_permissions", "user_roles", "user_permissions",
    "service_categories", "services", "membership_plans", "membership_benefits",
    "customers", "customer_memberships", "membership_usage_ledger",
    "sales", "sale_items", "payments", "invoices", "public_invoice_tokens", "whatsapp_messages", "audit_logs"
]

with engine.connect() as conn:
    for t in tables:
        rows = conn.execute(text(f"SELECT * FROM {t}")).mappings().all()
        backup_data[t] = [dict(r) for r in rows]
        print(f"Backed up {t}: {len(rows)} records")

    try:
        auth_rows = conn.execute(text("SELECT id, email, raw_user_meta_data, created_at FROM auth.users")).mappings().all()
        backup_data["auth_users"] = [dict(r) for r in auth_rows]
        print(f"Backed up auth.users: {len(auth_rows)} records")
    except Exception as e:
        print(f"Could not back up auth.users: {e}")

backup_path = "scratch/backup_production_pre_cleanup.json"
os.makedirs("scratch", exist_ok=True)
with open(backup_path, "w", encoding="utf-8") as f:
    json.dump(backup_data, f, default=custom_serializer, indent=2)

print(f"\nFull database recovery point created successfully at {backup_path}")
print(f"File size: {os.path.getsize(backup_path)} bytes")
