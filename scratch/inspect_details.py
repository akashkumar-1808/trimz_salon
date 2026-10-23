import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with engine.connect() as conn:
    print("=== CUSTOMERS ===")
    customers = conn.execute(text("SELECT id, name, phone, email, total_visits, total_spend, loyalty_points, created_at FROM customers ORDER BY created_at ASC")).fetchall()
    for c in customers:
        print(f"Customer: ID={c.id}, Name='{c.name}', Phone='{c.phone}', Email='{c.email}', Visits={c.total_visits}, Spend={c.total_spend}, Points={c.loyalty_points}, Created={c.created_at}")

    print("\n=== SALES & INVOICES ===")
    sales = conn.execute(text("""
        SELECT s.id, s.sale_number, s.total_amount, s.status, s.created_at,
               c.name as customer_name, c.phone as customer_phone,
               s.staff_name, p.name as operator_name,
               i.invoice_number
        FROM sales s
        LEFT JOIN customers c ON s.customer_id = c.id
        LEFT JOIN profiles p ON s.operator_id = p.id
        LEFT JOIN invoices i ON i.sale_id = s.id
        ORDER BY s.created_at ASC
    """)).fetchall()
    for s in sales:
        print(f"Sale: Number='{s.sale_number}', Inv='{s.invoice_number}', Total={s.total_amount}, Status={s.status}, Customer='{s.customer_name}' ({s.customer_phone}), Staff='{s.staff_name}', Operator='{s.operator_name}', Created={s.created_at}")

    print("\n=== CUSTOMER MEMBERSHIPS ===")
    mems = conn.execute(text("""
        SELECT cm.id, cm.customer_id, cm.membership_number, cm.status, cm.start_date, cm.expiry_date, cm.created_at,
               c.name as customer_name, c.phone as customer_phone,
               mp.name as plan_name
        FROM customer_memberships cm
        LEFT JOIN customers c ON cm.customer_id = c.id
        LEFT JOIN membership_plans mp ON cm.plan_id = mp.id
    """)).fetchall()
    for m in mems:
        print(f"Membership: Num='{m.membership_number}', Plan='{m.plan_name}', Customer='{m.customer_name}' ({m.customer_phone}), Status={m.status}, Created={m.created_at}")

    print("\n=== MEMBERSHIP USAGE LEDGER ===")
    usages = conn.execute(text("""
        SELECT id, membership_id, benefit_name, discount_applied, sale_id, created_at
        FROM membership_usage_ledger
    """)).fetchall()
    for u in usages:
        print(f"Usage: ID={u.id}, MemID={u.membership_id}, Benefit='{u.benefit_name}', Discount={u.discount_applied}, SaleID={u.sale_id}, Created={u.created_at}")

    print("\n=== AUTH USERS NOT IN PROFILES ===")
    orphans = conn.execute(text("""
        SELECT au.id, au.email, au.created_at
        FROM auth.users au
        LEFT JOIN profiles p ON au.id = p.id
        WHERE p.id IS NULL
    """)).fetchall()
    for o in orphans:
        print(f"Auth orphan: ID={o.id}, Email='{o.email}', Created={o.created_at}")
