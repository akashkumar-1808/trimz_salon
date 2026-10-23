import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with engine.connect() as conn:
    fk_query = text("""
        SELECT
            tc.table_name,
            kcu.column_name,
            ccu.table_name AS foreign_table_name,
            ccu.column_name AS foreign_column_name,
            rc.delete_rule
        FROM
            information_schema.table_constraints AS tc
            JOIN information_schema.key_column_usage AS kcu
              ON tc.constraint_name = kcu.constraint_name
              AND tc.table_schema = kcu.table_schema
            JOIN information_schema.constraint_column_usage AS ccu
              ON ccu.constraint_name = tc.constraint_name
              AND ccu.table_schema = tc.table_schema
            JOIN information_schema.referential_constraints AS rc
              ON rc.constraint_name = tc.constraint_name
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND tc.table_name IN (
            'sales', 'sale_items', 'payments', 'invoices',
            'public_invoice_tokens', 'whatsapp_messages', 'membership_usage_ledger',
            'customer_memberships', 'customers', 'profiles', 'user_roles', 'user_permissions', 'audit_logs'
          )
        ORDER BY tc.table_name;
    """)
    fks = conn.execute(fk_query).fetchall()
    for fk in fks:
        print(f"{fk.table_name}.{fk.column_name} -> {fk.foreign_table_name}.{fk.foreign_column_name} (ON DELETE {fk.delete_rule})")
