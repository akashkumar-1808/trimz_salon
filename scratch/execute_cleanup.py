"""
Production Test Data Cleanup Script for Trimz Salon
Executes strictly scoped cleanup in a transaction block.
"""
import os
import sys
import psycopg2
from dotenv import load_dotenv

load_dotenv("backend/.env")
db_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")

PRESERVED_USER_IDS = [
    "a7880a01-a7f2-47af-af66-daaedffdd072",  # owner@trimzsalon.com
    "6b3b186f-c48f-45ac-ab38-76f98a8931aa",  # trimzunisexsalonspt@gmail.com
]

DELETED_PROFILE_IDS = [
    "cc846ba6-e33d-4f8a-b947-53f4eb4c6a39",  # harshithsai.t@gmsil.com (typo owner)
    "5f581ac9-c813-43cc-950f-6b64ae200a94",  # trimzunisexsalo@gmail.com (typo wasim)
    "2878eb3e-c156-4bcf-a0a1-e731fe359a71",  # trimzunisexsalon@gmail.com (wasim)
    "383cfb5f-56c5-47fa-82b9-50b5b3c803fe",  # 245125748002@mvsrec.edu.in (Ramesh)
    "1c8a30cb-8960-4dd5-8268-db05386ea64e",  # akashkumargunturu18@gmail.com (Mahesh)
    "4e3afdd7-e194-4361-b2b9-0a140529fec5",  # saipallavi2901@gmail.com (asd)
    "ef34d648-3cf1-4ed2-b453-022cc3d6bdde",  # nirvaha6@gmail.com (alok)
    "6e318d07-383c-425a-9654-d703915d8b40",  # 245125748030@mvsrec.edu.in (Nani)
]

DELETED_AUTH_USER_IDS = DELETED_PROFILE_IDS + [
    "c8b6542b-e64b-448b-b26e-2d961977915f",  # akashkumardesigner18@gmail.com (orphan auth)
]

def run_cleanup():
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    cur = conn.cursor()
    
    deletion_report = {}
    
    try:
        print("Starting transactional production cleanup...")
        
        # 1. Delete public_invoice_tokens
        cur.execute("DELETE FROM public_invoice_tokens;")
        deletion_report["public_invoice_tokens"] = cur.rowcount
        print(f"Deleted {cur.rowcount} public_invoice_tokens")
        
        # 2. Delete whatsapp_messages (if any)
        cur.execute("DELETE FROM whatsapp_messages;")
        deletion_report["whatsapp_messages"] = cur.rowcount
        print(f"Deleted {cur.rowcount} whatsapp_messages")
        
        # 3. Delete invoices
        cur.execute("DELETE FROM invoices;")
        deletion_report["invoices"] = cur.rowcount
        print(f"Deleted {cur.rowcount} invoices")
        
        # 4. Delete payments
        cur.execute("DELETE FROM payments;")
        deletion_report["payments"] = cur.rowcount
        print(f"Deleted {cur.rowcount} payments")
        
        # 5. Delete membership_usage_ledger
        cur.execute("DELETE FROM membership_usage_ledger;")
        deletion_report["membership_usage_ledger"] = cur.rowcount
        print(f"Deleted {cur.rowcount} membership_usage_ledger")
        
        # 6. Delete sale_items
        cur.execute("DELETE FROM sale_items;")
        deletion_report["sale_items"] = cur.rowcount
        print(f"Deleted {cur.rowcount} sale_items")
        
        # 7. Delete sales
        cur.execute("DELETE FROM sales;")
        deletion_report["sales"] = cur.rowcount
        print(f"Deleted {cur.rowcount} sales")
        
        # 8. Delete membership_pause_logs (if any)
        cur.execute("DELETE FROM membership_pause_logs;")
        deletion_report["membership_pause_logs"] = cur.rowcount
        print(f"Deleted {cur.rowcount} membership_pause_logs")
        
        # 9. Delete customer_memberships
        cur.execute("DELETE FROM customer_memberships;")
        deletion_report["customer_memberships"] = cur.rowcount
        print(f"Deleted {cur.rowcount} customer_memberships")
        
        # 10. Delete customers
        cur.execute("DELETE FROM customers;")
        deletion_report["customers"] = cur.rowcount
        print(f"Deleted {cur.rowcount} customers")
        
        # 11. Delete audit_logs related to sales/customers or test staff
        cur.execute("""
            DELETE FROM audit_logs
            WHERE entity_name IN ('sale', 'sale_item', 'payment', 'invoice', 'customer', 'customer_membership')
               OR user_id = ANY(%s::uuid[]);
        """, (DELETED_PROFILE_IDS,))
        deletion_report["audit_logs"] = cur.rowcount
        print(f"Deleted {cur.rowcount} audit_logs")
        
        # 12. Delete user_permissions for test staff
        cur.execute("""
            DELETE FROM user_permissions
            WHERE user_id = ANY(%s::uuid[]);
        """, (DELETED_PROFILE_IDS,))
        deletion_report["user_permissions"] = cur.rowcount
        print(f"Deleted {cur.rowcount} user_permissions")
        
        # 13. Delete user_roles for test staff
        cur.execute("""
            DELETE FROM user_roles
            WHERE user_id = ANY(%s::uuid[]);
        """, (DELETED_PROFILE_IDS,))
        deletion_report["user_roles"] = cur.rowcount
        print(f"Deleted {cur.rowcount} user_roles")
        
        # 14. Delete profiles for test staff
        cur.execute("""
            DELETE FROM profiles
            WHERE id = ANY(%s::uuid[]);
        """, (DELETED_PROFILE_IDS,))
        deletion_report["profiles"] = cur.rowcount
        print(f"Deleted {cur.rowcount} profiles")
        
        # 15. Delete auth.users for test staff
        cur.execute("""
            DELETE FROM auth.users
            WHERE id = ANY(%s::uuid[]);
        """, (DELETED_AUTH_USER_IDS,))
        deletion_report["auth_users"] = cur.rowcount
        print(f"Deleted {cur.rowcount} auth.users")
        
        # Safety assertions before committing!
        print("\nRunning safety integrity checks before commit...")
        
        # Check preserved auth users
        cur.execute("SELECT id, email FROM auth.users;")
        remaining_auth = cur.fetchall()
        print(f"Remaining auth.users count: {len(remaining_auth)}")
        for uid, email in remaining_auth:
            print(f"  Auth user: {email} ({uid})")
            assert str(uid) in PRESERVED_USER_IDS, f"Unexpected auth user: {email} ({uid})"
            
        assert len(remaining_auth) == 2, f"Expected exactly 2 preserved auth users, got {len(remaining_auth)}"
        
        # Check preserved profiles
        cur.execute("SELECT id, email, is_owner FROM profiles;")
        remaining_profiles = cur.fetchall()
        print(f"Remaining profiles count: {len(remaining_profiles)}")
        for uid, email, is_owner in remaining_profiles:
            print(f"  Profile: {email} ({uid}) - is_owner: {is_owner}")
            assert str(uid) in PRESERVED_USER_IDS, f"Unexpected profile: {email} ({uid})"
            assert is_owner is True, f"Preserved profile must be owner: {email}"
            
        assert len(remaining_profiles) == 2, f"Expected exactly 2 preserved profiles, got {len(remaining_profiles)}"
        
        # Check services & categories intact
        cur.execute("SELECT count(*) FROM services;")
        svc_count = cur.fetchone()[0]
        assert svc_count == 157, f"Expected 157 services, got {svc_count}"
        
        cur.execute("SELECT count(*) FROM service_categories;")
        cat_count = cur.fetchone()[0]
        assert cat_count == 26, f"Expected 26 service categories, got {cat_count}"
        
        # Check membership plans intact
        cur.execute("SELECT count(*) FROM membership_plans;")
        plan_count = cur.fetchone()[0]
        assert plan_count == 5, f"Expected 5 membership plans, got {plan_count}"
        
        # Check business record intact
        cur.execute("SELECT count(*) FROM businesses;")
        biz_count = cur.fetchone()[0]
        assert biz_count == 1, f"Expected 1 business record, got {biz_count}"
        
        # Check roles and permissions intact
        cur.execute("SELECT count(*) FROM roles;")
        role_count = cur.fetchone()[0]
        assert role_count == 4, f"Expected 4 roles, got {role_count}"
        
        # Commit transaction!
        conn.commit()
        print("\nSUCCESS: Transaction committed successfully!")
        
        return deletion_report
        
    except Exception as e:
        conn.rollback()
        print(f"\nERROR: Cleanup failed and was rolled back! {e}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    report = run_cleanup()
    print("\nSummary of deletions:")
    for table, count in report.items():
        print(f"  - {table}: {count}")
