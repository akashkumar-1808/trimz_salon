import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with engine.connect() as conn:
    print("=== MEMBERSHIP PLANS ===")
    plans = conn.execute(text("SELECT id, name, price, validity_months, discount_percent, is_active, created_at FROM membership_plans ORDER BY created_at ASC")).fetchall()
    for p in plans:
        print(f"Plan: ID={p.id}, Name='{p.name}', Price={p.price}, Validity={p.validity_months}m, Disc={p.discount_percent}%, Active={p.is_active}, Created={p.created_at}")

    print("\n=== SERVICE CATEGORIES ===")
    cats = conn.execute(text("SELECT id, name, is_active FROM service_categories ORDER BY name ASC")).fetchall()
    print(f"Total categories: {len(cats)}")

    print("\n=== SERVICES SAMPLE ===")
    svcs = conn.execute(text("SELECT id, name, price, is_active FROM services LIMIT 5")).fetchall()
    for s in svcs:
        print(f"Service: Name='{s.name}', Price={s.price}, Active={s.is_active}")
