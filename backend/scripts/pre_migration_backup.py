"""
Pre-Migration Production Database Backup Snapshot Generator
Creates a verifiable snapshot of all live data prior to migration.
"""
import os
import sys
import io
import json
import hashlib
from datetime import datetime, timezone
from decimal import Decimal
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

def json_serial(obj):
    if isinstance(obj, (datetime,)):
        return obj.isoformat()
    if isinstance(obj, (Decimal,)):
        return str(obj)
    if hasattr(obj, 'hex'):
        return str(obj)
    raise TypeError(f"Type {type(obj)} not serializable")

def backup_live_database():
    load_dotenv('backend/.env')
    raw_url = os.getenv("DATABASE_URL")
    sync_url = raw_url.replace("postgresql+asyncpg://", "postgresql://")
    engine = create_engine(sync_url)

    tables_to_backup = [
        "businesses",
        "profiles",
        "roles",
        "permissions",
        "user_roles",
        "user_permissions",
        "service_categories",
        "services",
        "customers",
        "sales",
        "sale_items",
        "invoices",
        "payments",
        "public_invoice_tokens",
        "membership_plans",
        "customer_memberships",
        "membership_benefits",
        "membership_usage_ledger",
        "audit_logs"
    ]

    snapshot = {
        "metadata": {
            "snapshot_timestamp": datetime.now(timezone.utc).isoformat(),
            "environment": "production",
            "host": "aws-0-ap-southeast-1.pooler.supabase.com"
        },
        "tables": {}
    }

    with engine.connect() as conn:
        for t in tables_to_backup:
            rows = conn.execute(text(f'SELECT * FROM "{t}"')).mappings().fetchall()
            snapshot["tables"][t] = [dict(r) for r in rows]
            print(f"  Backed up table '{t}': {len(rows)} rows")

    os.makedirs("docs", exist_ok=True)
    out_path = "docs/production_snapshot_pre_migration_20261025.json"
    json_bytes = json.dumps(snapshot, default=json_serial, indent=2).encode('utf-8')
    with open(out_path, "wb") as f:
        f.write(json_bytes)

    sha256 = hashlib.sha256(json_bytes).hexdigest()
    print(f"\n[BACKUP SUCCESS] Production snapshot written to: {out_path}")
    print(f"[BACKUP SHA-256]: {sha256}")
    print(f"[BACKUP SIZE]: {len(json_bytes)} bytes")

if __name__ == "__main__":
    backup_live_database()
