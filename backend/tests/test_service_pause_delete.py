import pytest
from httpx import AsyncClient, ASGITransport
from app.main import app
from app.models.auth import User
from datetime import datetime, timezone
import uuid

@pytest.mark.asyncio
async def test_service_pause_resume_soft_delete_and_checkout_guard():
    """Verify pause/resume/soft-delete lifecycle and checkout validation for paused services."""
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
    owner_user = User(
        id=uuid.uuid4(),
        business_id=business_id,
        email="owner@trimz.test",
        name="Main Owner",
        is_owner=True,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
        roles=[]
    )

    app.dependency_overrides[get_current_user] = lambda: owner_user
    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-token"}

            # 1. Fetch available services
            resp = await client.get("/api/v1/services?active_only=false", headers=headers)
            assert resp.status_code == 200
            services = resp.json()
            assert len(services) > 0

            # Pick the first active service for our test
            target_svc = next((s for s in services if s.get("is_active") and not s.get("is_deleted")), None)
            assert target_svc is not None, "Need at least one active non-deleted service"
            svc_id = target_svc["id"]

            # 2. Test Pause Service
            pause_resp = await client.post(f"/api/v1/services/{svc_id}/pause", headers=headers)
            assert pause_resp.status_code == 200
            paused_data = pause_resp.json()
            assert paused_data["id"] == svc_id
            assert paused_data["is_active"] is False
            assert paused_data.get("is_deleted") is False

            # 3. Verify it shows up under status=paused and status=all, but NOT under status=active or default POS active_only=true
            paused_list_resp = await client.get("/api/v1/services?status=paused", headers=headers)
            assert paused_list_resp.status_code == 200
            paused_ids = [s["id"] for s in paused_list_resp.json()]
            assert svc_id in paused_ids

            active_list_resp = await client.get("/api/v1/services?status=active", headers=headers)
            assert active_list_resp.status_code == 200
            active_ids = [s["id"] for s in active_list_resp.json()]
            assert svc_id not in active_ids

            pos_list_resp = await client.get("/api/v1/services?active_only=true", headers=headers)
            assert pos_list_resp.status_code == 200
            pos_ids = [s["id"] for s in pos_list_resp.json()]
            assert svc_id not in pos_ids

            # 4. Verify checkout rejects paused service
            checkout_payload = {
                "customer_phone": "9876543210",
                "customer_name": "Test Client",
                "items": [
                    {
                        "service_id": svc_id,
                        "name": target_svc.get("name", "Test Service"),
                        "unit_price": 500.0,
                        "quantity": 1,
                        "discount_amount": 0.0,
                    }
                ],
                "payments": [
                    {
                        "payment_method": "CASH",
                        "amount": 500.0,
                    }
                ],
            }
            checkout_resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert checkout_resp.status_code == 400
            err_msg = checkout_resp.json().get("detail", "")
            assert "is currently paused" in err_msg or "cannot be added to new bills" in err_msg

            # 5. Test Resume Service
            resume_resp = await client.post(f"/api/v1/services/{svc_id}/resume", headers=headers)
            assert resume_resp.status_code == 200
            resumed_data = resume_resp.json()
            assert resumed_data["id"] == svc_id
            assert resumed_data["is_active"] is True

            # Verify it is back in active list
            active_list_resp2 = await client.get("/api/v1/services?status=active", headers=headers)
            assert active_list_resp2.status_code == 200
            active_ids2 = [s["id"] for s in active_list_resp2.json()]
            assert svc_id in active_ids2

            # 6. Test Soft Delete (Remove Service)
            del_resp = await client.delete(f"/api/v1/services/{svc_id}", headers=headers)
            assert del_resp.status_code == 200
            del_data = del_resp.json()
            assert del_data["is_deleted"] is True
            assert del_data["is_active"] is False

            # Verify it does NOT appear in normal listing (status=all or default)
            all_list_resp = await client.get("/api/v1/services?active_only=false", headers=headers)
            assert all_list_resp.status_code == 200
            all_ids = [s["id"] for s in all_list_resp.json()]
            assert svc_id not in all_ids

            # Verify checkout rejects deleted service
            checkout_del_resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert checkout_del_resp.status_code == 400
            assert "is currently removed" in checkout_del_resp.json().get("detail", "")

            # 7. Restore the service for test idempotency
            restore_patch = await client.patch(f"/api/v1/services/{svc_id}", json={"is_deleted": False, "is_active": True}, headers=headers)
            assert restore_patch.status_code == 200
            assert restore_patch.json()["is_active"] is True
            assert restore_patch.json()["is_deleted"] is False

    finally:
        app.dependency_overrides.pop(get_current_user, None)
