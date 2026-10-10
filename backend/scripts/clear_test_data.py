import asyncio
from sqlalchemy import text
from app.core.database import AsyncSessionLocal

async def clear_test_data():
    async with AsyncSessionLocal() as session:
        print("Checking counts before clearing...")
        tables = [
            "whatsapp_messages",
            "invoices",
            "payments",
            "sale_items",
            "sales",
            "customers",
            "audit_logs"
        ]
        
        for table in tables:
            res = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = res.scalar()
            print(f"  {table}: {count} records")

        print("\nDeleting test transaction and customer data...")
        # Delete in order of foreign key dependency
        await session.execute(text("DELETE FROM whatsapp_messages"))
        await session.execute(text("DELETE FROM invoices"))
        await session.execute(text("DELETE FROM payments"))
        await session.execute(text("DELETE FROM sale_items"))
        await session.execute(text("DELETE FROM sales"))
        await session.execute(text("DELETE FROM customers"))
        await session.execute(text("DELETE FROM audit_logs"))
        
        await session.commit()
        print("\nVerification after clearing:")
        for table in tables:
            res = await session.execute(text(f"SELECT COUNT(*) FROM {table}"))
            count = res.scalar()
            print(f"  {table}: {count} records")
            
        print("\nPreserved tables verification:")
        for preserved in ["businesses", "profiles", "service_categories", "services"]:
            res = await session.execute(text(f"SELECT COUNT(*) FROM {preserved}"))
            count = res.scalar()
            print(f"  {preserved}: {count} records")

        print("\nDatabase cleared successfully!")

if __name__ == "__main__":
    asyncio.run(clear_test_data())
