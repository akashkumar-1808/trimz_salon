import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

from app.main import app
from app.models.auth import User
from app.api.deps import get_current_user

@pytest.mark.asyncio
async def test_api_list_plans_and_calculate_preview():
    # Use real Trimz Salon business ID
    business_id = uuid.UUID("11f91464-454f-4574-8155-ed87e1914831")
    mock_owner = User(
        id=uuid.uuid4(),
        business_id=business_id,
        email="trimzunisexsalonspt@gmail.com",
        name="Harshith",
        is_owner=True,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
        roles=[]
    )

    app.dependency_overrides[get_current_user] = lambda: mock_owner

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}

            # 1. Fetch Membership Plans
            res_plans = await client.get("/api/v1/memberships/plans", headers=headers)
            assert res_plans.status_code == 200
            plans = res_plans.json()
            assert len(plans) >= 3
            plan_names = [p["name"] for p in plans]
            assert "Trimz Silver Club" in plan_names
            assert "Trimz Gold Executive" in plan_names
            assert "Trimz Platinum VIP" in plan_names

            # 2. Test POS /billing/calculate with empty cart -> 400
            res_empty = await client.post("/api/v1/billing/calculate", json={"items": []}, headers=headers)
            assert res_empty.status_code == 400

            # 3. Test POS /billing/calculate preview with valid service item
            calc_payload = {
                "customer_phone": "9999999999",
                "items": [
                    {
                        "name": "Haircut Special",
                        "unit_price": 500.0,
                        "quantity": 1
                    }
                ],
                "overall_discount": 50.0,
                "apply_tax": True
            }
            res_calc = await client.post("/api/v1/billing/calculate", json=calc_payload, headers=headers)
            assert res_calc.status_code == 200
            calc_data = res_calc.json()
            assert Decimal(str(calc_data["subtotal"])) == Decimal("500.00")
            assert Decimal(str(calc_data["total_manual_discount"])) == Decimal("50.00")
            assert Decimal(str(calc_data["taxable_amount"])) == Decimal("450.00")
            # GST 5% on 450 = 22.50
            assert Decimal(str(calc_data["grand_total"])) == Decimal("472.50")

            # 4. Test Customer Eligible Membership by Phone
            res_elig = await client.get("/api/v1/memberships/customer/by-phone/9999999999/eligible", headers=headers)
            assert res_elig.status_code == 200
            elig_data = res_elig.json()
            assert "has_membership" in elig_data
    finally:
        app.dependency_overrides.clear()
