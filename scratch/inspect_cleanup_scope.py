import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import json

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL")
if not db_url:
    print("DATABASE_URL not found")
    sys.exit(1)

# Ensure synchronous psycopg2 or sqlalchemy compatible driver
sync_url = db_url.replace("postgresql+asyncpg://", "postgresql://")

engine = create_engine(sync_url)

with engine.connect() as conn:
    print("=== 1. BUSINESSES ===")
    bizs = conn.execute(text("SELECT id, name, email, phone, created_at FROM businesses")).fetchall()
    for b in bizs:
        print(f"Business: ID={b.id}, Name='{b.name}', Email='{b.email}', Phone='{b.phone}'")

    print("\n=== 2. PROFILES / USERS ===")
    users = conn.execute(text("""
        SELECT p.id, p.business_id, p.email, p.name, p.is_owner, p.status, p.created_at,
               COALESCE((SELECT array_agg(r.name) FROM user_roles ur JOIN roles r ON ur.role_id = r.id WHERE ur.user_id = p.id), '{}') as roles
        FROM profiles p
        ORDER BY p.created_at ASC
    """)).fetchall()
    for u in users:
        print(f"User: ID={u.id}, Email='{u.email}', Name='{u.name}', Owner={u.is_owner}, Status='{u.status}', Roles={u.roles}, Created={u.created_at}")

    print("\n=== 3. SUPABASE AUTH USERS (if accessible) ===")
    try:
        auth_users = conn.execute(text("SELECT id, email, created_at, last_sign_in_at FROM auth.users ORDER BY created_at ASC")).fetchall()
        for au in auth_users:
            print(f"AuthUser: ID={au.id}, Email='{au.email}', Created={au.created_at}, LastSignIn={au.last_sign_in_at}")
    except Exception as e:
        print(f"Could not query auth.users: {e}")

    print("\n=== 4. COUNTS SUMMARY ===")
    tables = [
        "businesses", "profiles", "roles", "permissions", "role_permissions", "user_roles", "user_permissions",
        "service_categories", "services", "membership_plans", "membership_benefits",
        "customers", "customer_memberships", "membership_usage_ledger",
        "sales", "sale_items", "payments", "invoices", "public_invoice_tokens", "whatsapp_messages", "audit_logs"
    ]
    for t in tables:
        try:
            cnt = conn.execute(text(f"SELECT COUNT(*) FROM {t}")).scalar()
            print(f"Table {t}: {cnt} rows")
        except Exception as e:
            print(f"Table {t}: Error ({e})")
