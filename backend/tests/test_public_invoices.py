import pytest
import uuid
from datetime import datetime, timezone, timedelta
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select
from app.main import app
from app.models.auth import User
from app.models.business import Business
from app.models.invoice import Invoice, PublicInvoiceToken
from app.core.database import AsyncSessionLocal
from app.services.public_invoice import (
    hash_token,
    generate_raw_token,
    build_public_invoice_url,
    create_public_invoice_token,
    resolve_public_invoice
)

@pytest.mark.asyncio
async def test_token_generation_and_hashing():
    raw_token = generate_raw_token()
    assert len(raw_token) >= 32
    thash = hash_token(raw_token)
    assert len(thash) == 64
    assert thash != raw_token
    # Deterministic hash
    assert hash_token(raw_token) == thash

@pytest.mark.asyncio
async def test_checkout_generates_public_invoice_link_and_whatsapp():
    from app.api.deps import get_current_user

    async with AsyncSessionLocal() as session:
        biz_res = await session.execute(select(Business).limit(1))
        biz = biz_res.scalar_one()
        business_id = biz.id

    mock_owner = User(
        id=uuid.uuid4(),
        business_id=business_id,
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

            # Get services
            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            assert svc_res.status_code == 200
            services = svc_res.json()
            assert len(services) > 0
            test_svc = services[0]

            checkout_payload = {
                "customer_name": "Kavya Reddy",
                "customer_phone": "9966175299",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": True,
                "staff_name": "Pooja",
                "payments": [
                    {
                        "amount": float(test_svc["price"]),
                        "payment_method": "UPI",
                        "payment_provider": "PhonePe"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "commission_rate": 0.0
                    }
                ]
            }

            res = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert res.status_code == 201
            data = res.json()
            assert data["success"] is True

            # Assert public invoice URL and token are returned
            assert "public_invoice_url" in data and data["public_invoice_url"] is not None
            assert "public_invoice_token" in data and data["public_invoice_token"] is not None
            public_token = data["public_invoice_token"]
            public_url = data["public_invoice_url"]
            assert f"/i/{public_token}" in public_url

            # Assert WhatsApp message includes the public digital invoice link
            wa_c2c = data["whatsapp_click_to_chat"]
            assert wa_c2c is not None
            assert public_url in wa_c2c["message"]
            assert public_token in wa_c2c["url"]

            # Test fetching public invoice via unauthenticated public endpoint
            pub_res = await client.get(f"/api/v1/public/invoices/{public_token}")
            assert pub_res.status_code == 200

            # Privacy and caching headers
            assert "no-store" in pub_res.headers.get("cache-control", "")
            assert "private" in pub_res.headers.get("cache-control", "")
            assert "noindex" in pub_res.headers.get("x-robots-tag", "")

            pub_data = pub_res.json()
            assert pub_data["invoice_number"] == data["invoice"]["invoice_number"]
            assert pub_data["customer_name"] == "Kavya Reddy"
            # Customer phone must be masked for public privacy
            assert "****" in pub_data["customer_phone_masked"]
            assert len(pub_data["items"]) == 1
            assert pub_data["items"][0]["name"] == test_svc["name"]
            assert pub_data["payment"]["status"] == "PAID"
            assert pub_data["business"]["name"] is not None

            # Test creating a public link on an existing invoice (retry / share link)
            invoice_id = data["invoice"]["id"]
            link_res = await client.post(f"/api/v1/invoices/{invoice_id}/public-link", headers=headers)
            assert link_res.status_code == 200
            link_data = link_res.json()
            assert "public_url" in link_data and link_data["public_url"] is not None
            assert "public_token" in link_data and link_data["public_token"] is not None
            assert link_data["invoice_number"] == pub_data["invoice_number"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_public_invoice_invalid_token_returns_404():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        res = await client.get("/api/v1/public/invoices/totally_invalid_nonexistent_token_12345")
        assert res.status_code == 404
        assert "not found" in res.json()["detail"].lower()

@pytest.mark.asyncio
async def test_public_invoice_expired_and_revoked_tokens():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        async with AsyncSessionLocal() as session:
            inv_res = await session.execute(select(Invoice).limit(1))
            inv = inv_res.scalar_one_or_none()
            if not inv:
                pytest.skip("No existing invoices found in test DB")

            # 1. Test revoked token
            revoked_token_rec, raw_revoked = await create_public_invoice_token(session, inv)
            revoked_token_rec.is_revoked = True
            revoked_token_rec.revoked_at = datetime.now(timezone.utc)
            await session.commit()

            res_rev = await client.get(f"/api/v1/public/invoices/{raw_revoked}")
            assert res_rev.status_code == 410
            assert "revoked" in res_rev.json()["detail"].lower()

            # 2. Test expired token
            expired_token_rec, raw_expired = await create_public_invoice_token(session, inv)
            expired_token_rec.expires_at = datetime.now(timezone.utc) - timedelta(days=1)
            await session.commit()

            res_exp = await client.get(f"/api/v1/public/invoices/{raw_expired}")
            assert res_exp.status_code == 410
            assert "expired" in res_exp.json()["detail"].lower()
