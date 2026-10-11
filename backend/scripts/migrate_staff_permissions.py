import asyncio
import sys
sys.path.insert(0, ".")
from app.core.database import AsyncSessionLocal
from sqlalchemy import text

async def migrate():
    async with AsyncSessionLocal() as session:
        # 1. Add PENDING to user_status enum if not present
        print("[*] Adding PENDING to user_status enum if needed...")
        try:
            await session.execute(text("ALTER TYPE user_status ADD VALUE IF NOT EXISTS 'PENDING';"))
            await session.commit()
            print("[OK] user_status enum updated with PENDING.")
        except Exception as e:
            print(f"[!] Enum update note: {e}")
            await session.rollback()

        # 2. Create user_permissions table
        print("[*] Ensuring user_permissions table exists...")
        await session.execute(text("""
            CREATE TABLE IF NOT EXISTS user_permissions (
                user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
                permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
                created_at TIMESTAMPTZ DEFAULT NOW(),
                PRIMARY KEY (user_id, permission_id)
            );
        """))
        await session.commit()
        print("[OK] user_permissions table ready.")

        # 3. Add invoices.view & invoices.manage permissions if not present
        print("[*] Checking invoice permissions...")
        await session.execute(text("""
            INSERT INTO permissions (id, code, name, module, description)
            VALUES 
                (gen_random_uuid(), 'invoices.view', 'View Invoices', 'invoices', 'View salon invoices and receipts'),
                (gen_random_uuid(), 'invoices.manage', 'Manage Invoices', 'invoices', 'Generate, share and print invoices')
            ON CONFLICT (code) DO NOTHING;
        """))
        await session.commit()
        print("[OK] Invoice permissions confirmed.")

        # 4. Verify user_status enum values now
        res = await session.execute(text("SELECT enumlabel FROM pg_enum JOIN pg_type ON pg_enum.enumtypid = pg_type.oid WHERE pg_type.typname = 'user_status';"))
        print("Updated user_status enum values:", [r[0] for r in res.fetchall()])

asyncio.run(migrate())
