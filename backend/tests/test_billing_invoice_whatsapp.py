import pytest
import os
import uuid
import re
from urllib.parse import unquote, quote
from pathlib import Path
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport
from sqlalchemy import select, func
from app.main import app
from app.models.auth import User
from app.models.service import Service
from app.models.whatsapp import WhatsAppMessage
from app.models.sale import Sale
from app.models.invoice import Invoice
from app.core.database import get_db

@pytest.mark.asyncio
async def test_checkout_valid_indian_mobile_and_click_to_chat():
    """
    Test successful checkout with valid Indian mobile number:
    - Normalizes local 10-digit number to international format (91 prefix)
    - Generates authoritative prefilled WhatsApp click-to-chat URL (wa.me)
    - Does not generate automatic PNG image during checkout
    - Does not invoke Cloud API or return misleading delivery statuses
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            # Get active service
            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            assert svc_res.status_code == 200
            services = svc_res.json()
            assert len(services) > 0
            test_svc = services[0]

            checkout_payload = {
                "customer_name": "Rohan Verma",
                "customer_phone": "9876543210", # 10-digit Indian mobile
                "overall_discount": 50.0,
                "apply_tax": False,
                "open_whatsapp": True,
                "staff_name": "Harshith",
                "payments": [
                    {
                        "amount": float(test_svc["price"]) - 50.0,
                        "payment_method": "UPI",
                        "payment_provider": "PhonePe",
                        "transaction_reference": "UPI/TEST/123456"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201, f"Checkout failed: {resp.text}"
            data = resp.json()

            assert data["success"] is True
            assert data["sale"]["status"] == "COMPLETED"
            assert data["invoice"]["status"] == "ISSUED"

            # Check Click-to-Chat URL
            wa_url = data.get("whatsapp_url")
            assert wa_url is not None
            assert wa_url.startswith("https://wa.me/919876543210?text=")

            c2c = data.get("whatsapp_click_to_chat")
            assert c2c is not None
            assert c2c["enabled"] is True
            assert c2c["phone"] == "919876543210"
            assert c2c["url"] == wa_url
            assert "TRIMZ SALON" in c2c["message"]
            assert data["invoice"]["invoice_number"] in c2c["message"]
            assert "Rohan Verma" in c2c["message"]
            assert test_svc["name"] in c2c["message"]
            assert "PAID" in c2c["message"]

            # Verify no misleading automated Cloud API delivery status
            assert data.get("whatsapp_delivery") is None

            # Verify no invoice PNG image was automatically generated during checkout
            assert data["invoice"]["image_url"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_checkout_without_whatsapp_sharing():
    """
    Test checkout with open_whatsapp=False:
    - Sale, payment, invoice created and committed successfully
    - whatsapp_url is None
    - whatsapp_click_to_chat.enabled is False
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "Priya Sharma",
                "customer_phone": "9876543211",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": False,
                "send_whatsapp": False,
                "payments": [
                    {
                        "amount": float(test_svc["price"]),
                        "payment_method": "CASH"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201
            data = resp.json()

            assert data["success"] is True
            assert data["whatsapp_url"] is None
            assert data["whatsapp_click_to_chat"]["enabled"] is False
            # But click_to_chat message and url are available in modal fallback
            assert data["whatsapp_click_to_chat"]["phone"] == "919876543211"
            assert data["whatsapp_click_to_chat"]["url"] is not None
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_checkout_invalid_or_missing_phone():
    """
    Test checkout with invalid phone (e.g., '123'):
    - Financial transaction succeeds 100% (financial isolation)
    - whatsapp_url is None
    - whatsapp_click_to_chat.enabled is False
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "Walkin Guest",
                "customer_phone": "123", # Invalid length
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": True,
                "payments": [
                    {
                        "amount": float(test_svc["price"]),
                        "payment_method": "CASH"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201
            data = resp.json()

            assert data["success"] is True
            assert data["sale"]["status"] == "COMPLETED"
            assert data["whatsapp_url"] is None
            assert data["whatsapp_click_to_chat"]["enabled"] is False
            assert data["whatsapp_click_to_chat"]["phone"] is None
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_phone_normalization_formats():
    """
    Test normalization rules:
    - 10 digits: 9876543210 -> 919876543210
    - Local trunk prefix: 09876543210 -> 919876543210
    - With country code: +91 9876543210 -> 919876543210
    - Already with 91: 919876543210 -> 919876543210 (does not become 9191...)
    - Other international: +14155552671 -> 14155552671 (does not blindly prepend 91)
    """
    from app.api.v1.billing import normalize_whatsapp_phone

    assert normalize_whatsapp_phone("9876543210") == "919876543210"
    assert normalize_whatsapp_phone("09876543210") == "919876543210"
    assert normalize_whatsapp_phone("+91 98765 43210") == "919876543210"
    assert normalize_whatsapp_phone("919876543210") == "919876543210"
    assert normalize_whatsapp_phone("+14155552671") == "14155552671"
    assert normalize_whatsapp_phone("123") is None
    assert normalize_whatsapp_phone("") is None
    assert normalize_whatsapp_phone(None) is None

@pytest.mark.asyncio
async def test_receipt_text_and_url_encoding():
    """
    Test receipt text details and proper URL encoding.
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "Aarav Gupta",
                "customer_phone": "+91 98765 43212",
                "overall_discount": 20.0,
                "apply_tax": False,
                "open_whatsapp": True,
                "payments": [
                    {
                        "amount": float(test_svc["price"]) - 20.0,
                        "payment_method": "UPI",
                        "payment_provider": "Google Pay"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 2,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201
            data = resp.json()

            url = data["whatsapp_url"]
            assert url is not None
            prefix = "https://wa.me/919876543212?text="
            assert url.startswith(prefix)

            # Check decoded message content
            encoded_query = url[len(prefix):]
            decoded_message = unquote(encoded_query)

            assert "TRIMZ SALON" in decoded_message
            assert "Aarav Gupta" in decoded_message
            assert test_svc["name"] in decoded_message
            assert "x2" in decoded_message
            assert "Discount: -₹20.00" in decoded_message
            assert "Payment Mode: UPI (Google Pay) — *PAID*" in decoded_message
            assert "Thank you for visiting Trimz Salon!" in decoded_message
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_failed_checkout_does_not_open_whatsapp():
    """
    Test that invalid request fails validation and does not create sale or return WhatsApp URL.
    """
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

            # Empty items cart
            empty_payload = {
                "customer_name": "Test Guest",
                "customer_phone": "9876543210",
                "open_whatsapp": True,
                "payments": [],
                "items": []
            }
            resp = await client.post("/api/v1/billing/checkout", json=empty_payload, headers=headers)
            assert resp.status_code == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_duplicate_checkout_idempotency_retries():
    """
    Test idempotency:
    - Retrying checkout with same Idempotency-Key returns the existing sale
    - Does not duplicate financial records (Sale, Payment, Invoice)
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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
            idemp_key = f"retry-test-{uuid.uuid4().hex[:8]}"
            headers = {
                "Authorization": "Bearer test-token",
                "Idempotency-Key": idemp_key
            }

            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "Idempotent Guest",
                "customer_phone": "9876543215",
                "overall_discount": 0.0,
                "apply_tax": False,
                "open_whatsapp": True,
                "payments": [
                    {
                        "amount": float(test_svc["price"]),
                        "payment_method": "UPI"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            # 1st attempt
            resp1 = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp1.status_code == 201
            data1 = resp1.json()
            sale_id_1 = data1["sale"]["id"]
            invoice_num_1 = data1["invoice"]["invoice_number"]

            # 2nd attempt with same key
            resp2 = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp2.status_code == 201
            data2 = resp2.json()
            assert data2["sale"]["id"] == sale_id_1
            assert data2["invoice"]["invoice_number"] == invoice_num_1

            # Both return click-to-chat URL
            assert data2["whatsapp_url"] is not None
            assert "919876543215" in data2["whatsapp_url"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_checkout_works_with_all_meta_credentials_absent():
    """
    Test that checkout executes smoothly even when Meta credentials
    (WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID) are completely absent.
    """
    from app.api.deps import get_current_user
    from app.core.config import settings

    # Save original settings
    orig_token = settings.META_WHATSAPP_ACCESS_TOKEN
    orig_phone_id = settings.META_WHATSAPP_PHONE_NUMBER_ID

    # Clear credentials
    settings.META_WHATSAPP_ACCESS_TOKEN = ""
    settings.META_WHATSAPP_PHONE_NUMBER_ID = ""

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "No Meta Creds Guest",
                "customer_phone": "9876543216",
                "open_whatsapp": True,
                "payments": [
                    {
                        "amount": float(test_svc["price"]),
                        "payment_method": "CASH"
                    }
                ],
                "items": [
                    {
                        "service_id": test_svc["id"],
                        "name": test_svc["name"],
                        "unit_price": float(test_svc["price"]),
                        "quantity": 1,
                        "discount_amount": 0.0,
                        "item_type": "service"
                    }
                ]
            }

            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201
            data = resp.json()
            assert data["success"] is True
            assert data["whatsapp_url"] is not None
            assert "919876543216" in data["whatsapp_url"]
    finally:
        settings.META_WHATSAPP_ACCESS_TOKEN = orig_token
        settings.META_WHATSAPP_PHONE_NUMBER_ID = orig_phone_id
        app.dependency_overrides.pop(get_current_user, None)

@pytest.mark.asyncio
async def test_deferred_features_remain_functional_on_demand():
    """
    Verify that image rendering and print endpoints remain functional
    on-demand for deferred future features without being triggered in checkout.
    """
    from app.api.deps import get_current_user

    business_id = uuid.UUID("4f234228-8fc9-4096-b2a6-0ec00f8e9eeb")
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

            # Checkout first
            svc_res = await client.get("/api/v1/services?active_only=true", headers=headers)
            test_svc = svc_res.json()[0]

            checkout_payload = {
                "customer_name": "On Demand Test",
                "customer_phone": "9876543217",
                "open_whatsapp": False,
                "payments": [{"amount": float(test_svc["price"]), "payment_method": "CASH"}],
                "items": [{"service_id": test_svc["id"], "name": test_svc["name"], "unit_price": float(test_svc["price"]), "quantity": 1, "item_type": "service"}]
            }
            resp = await client.post("/api/v1/billing/checkout", json=checkout_payload, headers=headers)
            assert resp.status_code == 201
            inv_id = resp.json()["invoice"]["id"]

            # 1. On-demand image generation
            img_res = await client.get(f"/api/v1/invoices/{inv_id}/image", headers=headers)
            assert img_res.status_code == 200
            assert img_res.headers["content-type"] == "image/png"

            # 2. On-demand print page
            print_res = await client.get(f"/api/v1/invoices/{inv_id}/print", headers=headers)
            assert print_res.status_code == 200
            assert "text/html" in print_res.headers["content-type"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)
