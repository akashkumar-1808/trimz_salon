"""
Test newly implemented DELETE /api/v1/invoices/{invoice_id} endpoint against the real database.
"""
import asyncio
import os
import sys
import uuid
from httpx import AsyncClient, ASGITransport
from dotenv import load_dotenv

load_dotenv("backend/.env")
sys.path.insert(0, os.path.abspath("backend"))

from app.main import app
from app.models.auth import User
from app.api.deps import get_current_user

async def main():
    business_id = uuid.UUID("11f91464-454f-4574-8155-ed87e1914831")
    owner_id = uuid.UUID("6b3b186f-c48f-45ac-ab38-76f98a8931aa")
    
    owner_user = User(
        id=owner_id,
        business_id=business_id,
        email="trimzunisexsalonspt@gmail.com",
        name="Harshith",
        is_owner=True,
        roles=["Owner"]
    )
    
    invoice_id = "de42a7c0-f7d3-4f3c-bf26-3e2e26059cdd"
    
    app.dependency_overrides[get_current_user] = lambda: owner_user
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer test-owner-token"}
        
        # 1. Delete invoice as owner
        res = await client.delete(f"/api/v1/invoices/{invoice_id}", headers=headers)
        print("DELETE /api/v1/invoices response:", res.status_code, res.json())
        assert res.status_code == 200
        assert res.json().get("success") is True
        
        # 2. Check GET /api/v1/invoices (must be 0)
        res_list = await client.get("/api/v1/invoices", headers=headers)
        invs = res_list.json()
        print(f"Remaining invoices count: {len(invs)}")
        assert len(invs) == 0
        
    print("\nSUCCESS: Delete invoice endpoint verified and working perfectly on live database!")

if __name__ == "__main__":
    asyncio.run(main())
