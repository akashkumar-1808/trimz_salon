import json
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import os

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with open("docs/TRIMZ-backup-2026-11-01.json", "rb") as f:
    data = json.load(f)

bills = data["data"]["bills"]
new_bill_nos = {b.get("no").strip() for b in bills if b.get("no")}

with engine.connect() as conn:
    biz_id = conn.execute(text("SELECT id FROM businesses LIMIT 1")).scalar()
    sales = conn.execute(text("SELECT sale_number, client_request_id, total_amount, date(created_at) as d FROM sales WHERE business_id = :b"), {"b": biz_id}).fetchall()
    
    missing_in_file = []
    for s in sales:
        raw_key = s.sale_number
        base_no = raw_key.split("-DUP")[0]
        if base_no not in new_bill_nos:
            missing_in_file.append(s)

print(f"Sales in DB not found in new file: {len(missing_in_file)}")
for s in missing_in_file:
    print(f"  Sale #{s.sale_number} (req {s.client_request_id}): total={s.total_amount} date={s.d}")
