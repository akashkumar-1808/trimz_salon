import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.security import create_access_token
from app.models.auth import User, Role, Profile
from app.models.business import Business
from datetime import datetime, timezone, timedelta
import uuid

@pytest.mark.asyncio
async def test_catalogue_and_dashboard_integration():
    """Verify live catalogue queries and dashboard response structure with authenticated owner."""
    from app.api.deps import get_current_user

    mock_owner = User(
        id=uuid.uuid4(),
        business_id=uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb"),
        email="owner@trimz.test",
        name="Main Owner",
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

            # 1. Test Categories endpoint
            cat_resp = await client.get("/api/v1/services/categories", headers=headers)
            assert cat_resp.status_code == 200
            cats = cat_resp.json()
            assert len(cats) >= 20
            # Verify departments exist
            depts = {c.get("department") for c in cats}
            assert "Men" in depts
            assert "Women" in depts

            # 2. Test Services endpoint with all items
            svc_resp = await client.get("/api/v1/services", headers=headers)
            assert svc_resp.status_code == 200
            services = svc_resp.json()
            assert len(services) >= 100
            
            # Verify variants and combos exist in catalogue
            variants = [s for s in services if s.get("variant_name") is not None]
            combos = [s for s in services if s.get("combo_items") is not None]
            variables = [s for s in services if s.get("is_variable_price") is True]
            assert len(variants) > 0
            assert len(combos) > 0
            assert len(variables) > 0

            # 3. Test department filtering
            men_resp = await client.get("/api/v1/services?department=Men", headers=headers)
            assert men_resp.status_code == 200
            men_svcs = men_resp.json()
            assert len(men_svcs) > 0

            women_resp = await client.get("/api/v1/services?department=Women", headers=headers)
            assert women_resp.status_code == 200
            women_svcs = women_resp.json()
            assert len(women_svcs) > 0

            # 4. Test Dashboard overview endpoint
            dash_resp = await client.get("/api/v1/dashboard/overview?period=today", headers=headers)
            assert dash_resp.status_code == 200
            dash_data = dash_resp.json()

            # Check required top-level frontend metrics
            assert "total_revenue" in dash_data
            assert "transaction_count" in dash_data
            assert "average_bill_value" in dash_data
            assert "unique_customers" in dash_data
            assert "new_customers" in dash_data
            assert "repeat_customers" in dash_data
            assert "payment_methods_breakdown" in dash_data
            assert "upi_providers_breakdown" in dash_data
            assert "top_services" in dash_data
            assert "recent_sales" in dash_data
    finally:
        app.dependency_overrides.pop(get_current_user, None)
