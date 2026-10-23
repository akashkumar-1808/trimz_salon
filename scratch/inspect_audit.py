import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv("backend/.env")
sync_url = os.getenv("DATABASE_URL").replace("postgresql+asyncpg://", "postgresql://")
engine = create_engine(sync_url)

with engine.connect() as conn:
    logs = conn.execute(text("SELECT id, action, entity_name, entity_id, user_id, created_at FROM audit_logs ORDER BY created_at ASC")).fetchall()
    print(f"Total audit logs: {len(logs)}")
    actions = {}
    for l in logs:
        actions[l.action] = actions.get(l.action, 0) + 1
    print("Action counts:", actions)
