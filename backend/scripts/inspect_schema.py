import asyncio
import sys
sys.path.insert(0, ".")
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def inspect():
    async with AsyncSessionLocal() as session:
        # Check user_status enum
        res = await session.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_status';"))
        print("user_status enum:", [r[0] for r in res.fetchall()])

        # Check existing roles
        res = await session.execute(text("SELECT id, name, slug FROM roles;"))
        print("roles:", [dict(r._mapping) for r in res.fetchall()])

        # Check existing permissions
        res = await session.execute(text("SELECT id, code, name, module FROM permissions;"))
        print("permissions count:", len(res.fetchall()))

        # Check all tables
        res = await session.execute(text("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"))
        print("all tables in public schema:", [r[0] for r in res.fetchall()])

        # Check existing users/profiles
        res = await session.execute(text("SELECT id, email, name, is_owner, status FROM profiles;"))
        print("profiles:", [dict(r._mapping) for r in res.fetchall()])

asyncio.run(inspect())
