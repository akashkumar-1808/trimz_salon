from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with engine.connect() as conn:
    biz_id = conn.execute(text("SELECT id FROM businesses LIMIT 1")).scalar()
    
    # 1. Total invoices returned with limit 500
    invs = conn.execute(text("""
        SELECT i.id, i.invoice_number, i.total_amount, i.created_at, s.staff_name, c.name as customer_name
        FROM invoices i
        JOIN sales s ON i.sale_id = s.id
        LEFT JOIN customers c ON s.customer_id = c.id
        WHERE i.business_id = :b
        ORDER BY i.created_at DESC
        LIMIT 500
    """), {"b": biz_id}).fetchall()
    
    print(f"Total Invoices fetched: {len(invs)}")
    print("Latest 5 invoices:")
    for inv in invs[:5]:
        print(f"  {inv.invoice_number}: Rs. {inv.total_amount} | {inv.customer_name} | Stylist: {inv.staff_name} | {inv.created_at}")
        
    # 2. Total customers returned with limit 500
    custs = conn.execute(text("""
        SELECT id, name, phone, total_visits, total_spend, loyalty_points, last_visit_at
        FROM customers
        WHERE business_id = :b
        ORDER BY total_spend DESC, name ASC
        LIMIT 500
    """), {"b": biz_id}).fetchall()
    
    print(f"\nTotal Customers fetched: {len(custs)}")
    print("Top 5 customers by spend:")
    for c in custs[:5]:
        print(f"  {c.name} ({c.phone}): Spend: Rs. {c.total_spend} | Visits: {c.total_visits} | Points: {c.loyalty_points} | Last: {c.last_visit_at}")
