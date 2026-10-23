"""
Post-Cleanup Comprehensive Verification Script
"""
import os
import psycopg2
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

def verify():
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()
    
    print("=== POST-CLEANUP DATABASE VALIDATION ===")
    
    # 1. Accounts
    cur.execute("SELECT id, email FROM auth.users;")
    auth_users = cur.fetchall()
    print(f"Auth Users ({len(auth_users)}):")
    for u in auth_users:
        print(f"  - {u[1]} ({u[0]})")
    assert len(auth_users) == 2, f"Expected 2 auth users, got {len(auth_users)}"
    
    cur.execute("SELECT id, email, name, is_owner FROM profiles;")
    profiles = cur.fetchall()
    print(f"\nProfiles ({len(profiles)}):")
    for p in profiles:
        print(f"  - {p[2]} <{p[1]}> (is_owner={p[3]})")
    assert len(profiles) == 2, f"Expected 2 profiles, got {len(profiles)}"
    
    # 2. Reference & Business Config Data
    tables_to_check = {
        "businesses": 1,
        "services": 157,
        "service_categories": 26,
        "membership_plans": 5,
        "roles": 4,
        "permissions": 28,
        "role_permissions": 49,
    }
    print("\nPreserved Reference Data Counts:")
    for tbl, expected in tables_to_check.items():
        cur.execute(f"SELECT count(*) FROM {tbl};")
        cnt = cur.fetchone()[0]
        print(f"  - {tbl}: {cnt} (expected {expected})")
        assert cnt == expected, f"{tbl} count mismatch: got {cnt}, expected {expected}"
        
    # 3. Cleaned Test Transaction Tables
    cleaned_tables = [
        "sales",
        "sale_items",
        "payments",
        "invoices",
        "public_invoice_tokens",
        "customers",
        "customer_memberships",
        "membership_usage_ledger",
        "membership_pause_logs",
        "whatsapp_messages",
    ]
    print("\nCleaned Transactional Tables (Must be 0):")
    for tbl in cleaned_tables:
        cur.execute(f"SELECT count(*) FROM {tbl};")
        cnt = cur.fetchone()[0]
        print(f"  - {tbl}: {cnt}")
        assert cnt == 0, f"Expected 0 for {tbl}, got {cnt}"
        
    cur.close()
    conn.close()
    print("\nALL POST-CLEANUP DATABASE ASSERTIONS PASSED!")

if __name__ == "__main__":
    verify()
