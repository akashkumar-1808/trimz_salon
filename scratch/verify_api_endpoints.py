"""
Verify Backend API endpoints against live database with an authenticated owner user.
"""
import asyncio
import os
import uuid
from httpx import AsyncClient, ASGITransport
from dotenv import load_dotenv

load_dotenv("backend/.env")

import sys
sys.path.insert(0, os.path.abspath("backend"))

from app.main import app
from app.models.auth import User
from app.api.deps import get_current_user

async def main():
    # Use real Trimz Salon business ID and owner profile
    business_id = uuid.UUID("11f91464-454f-4574-8155-ed87e1914831")
    owner_id = uuid.UUID("6b3b186f-c48f-45ac-ab38-76f98a8931aa")
    
    mock_owner = User(
        id=owner_id,
        business_id=business_id,
        email="trimzunisexsalonspt@gmail.com",
        name="Harshith",
        is_owner=True,
        status="ACTIVE",
        roles=["Owner"]
    )
    
    app.dependency_overrides[get_current_user] = lambda: mock_owner
    
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        headers = {"Authorization": "Bearer test-token"}
        
        # 1. Services / Catalog
        r_svc = await client.get("/api/v1/services", headers=headers)
        print(f"GET /api/v1/services -> status {r_svc.status_code}, count: {len(r_svc.json()) if r_svc.status_code == 200 else r_svc.text}")
        assert r_svc.status_code == 200
        assert len(r_svc.json()) == 157
        
        # 2. Membership Plans
        r_plans = await client.get("/api/v1/memberships/plans", headers=headers)
        print(f"GET /api/v1/memberships/plans -> status {r_plans.status_code}, count: {len(r_plans.json()) if r_plans.status_code == 200 else r_plans.text}")
        assert r_plans.status_code == 200
        assert len(r_plans.json()) == 5
        
        # 3. Invoices (should be clean / empty)
        r_inv = await client.get("/api/v1/invoices", headers=headers)
        print(f"GET /api/v1/invoices -> status {r_inv.status_code}, count: {len(r_inv.json()) if r_inv.status_code == 200 else r_inv.text}")
        assert r_inv.status_code == 200
        inv_items = r_inv.json().get("items", r_inv.json()) if isinstance(r_inv.json(), dict) else r_inv.json()
        assert len(inv_items) == 0, f"Expected 0 invoices, got {len(inv_items)}"
        
        # 4. Reports / Dashboard
        r_rep = await client.get("/api/v1/reports/sales-summary", headers=headers)
        print(f"GET /api/v1/reports/sales-summary -> status {r_rep.status_code}, data: {r_rep.json() if r_rep.status_code == 200 else r_rep.text}")
        assert r_rep.status_code == 200
        
        # 5. Employees / Staff
        r_staff = await client.get("/api/v1/employees", headers=headers)
        print(f"GET /api/v1/employees -> status {r_staff.status_code}, count: {len(r_staff.json()) if r_staff.status_code == 200 else r_staff.text}")
        assert r_staff.status_code == 200
        staff_list = r_staff.json()
        for s in staff_list:
            print(f"  - Staff: {s.get('name')} <{s.get('email')}> (is_owner={s.get('is_owner')})")
        assert len(staff_list) == 2, f"Expected 2 owners only, got {len(staff_list)}"
        
    print("\nALL API ENDPOINTS TESTED & VERIFIED WORKING PROPERLY!")

if __name__ == "__main__":
    asyncio.run(main())
