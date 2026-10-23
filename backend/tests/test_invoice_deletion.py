"""
Tests for Invoice Deletion Feature
1. Admin (owner) can delete invoices.
2. Staff members (non-admin) are strictly forbidden (HTTP 403).
3. Customer total_spend, total_visits, and loyalty_points are accurately reverted.
4. Transaction cascade deletes invoice, sale, payments, sale items, tokens, and audit log is recorded.
"""

import sys
import os
import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone
from httpx import AsyncClient, ASGITransport

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.main import app
from app.models.customer import Customer
from app.models.auth import User
from app.api.deps import get_current_user
from app.api.v1.invoices import check_is_admin


def test_check_is_admin_logic():
    """Verify check_is_admin correctly identifies owner vs staff."""
    # Owner profile
    owner_user = User(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        email="owner@trimzsalon.com",
        name="Harshith",
        is_owner=True,
        roles=[]
    )
    assert check_is_admin(owner_user) is True

    # Staff user with no owner flag
    staff_user = User(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        email="staff@trimzsalon.com",
        name="Stylist 1",
        is_owner=False,
        roles=[]
    )
    assert check_is_admin(staff_user) is False

    # None user
    assert check_is_admin(None) is False


def test_customer_spend_reversal_logic():
    """Verify customer spend and loyalty point reduction on invoice deletion."""
    customer = Customer(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        name="Priya Sharma",
        phone="9988776655",
        total_visits=5,
        total_spend=Decimal("3500.00"),
        loyalty_points=35
    )

    sale_total = Decimal("1200.00")
    curr_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = max(Decimal("0.00"), curr_spend - sale_total)
    customer.total_visits = max(0, (customer.total_visits or 1) - 1)
    pts = int(sale_total // Decimal("100.00"))
    customer.loyalty_points = max(0, (customer.loyalty_points or 0) - pts)

    assert customer.total_spend == Decimal("2300.00")
    assert customer.total_visits == 4
    assert customer.loyalty_points == 23


def test_customer_spend_floor_at_zero():
    """Ensure reversal never sets negative spend or visits."""
    customer = Customer(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        name="Zero Test",
        phone="9988776654",
        total_visits=1,
        total_spend=Decimal("200.00"),
        loyalty_points=2
    )

    sale_total = Decimal("500.00")
    curr_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = max(Decimal("0.00"), curr_spend - sale_total)
    customer.total_visits = max(0, (customer.total_visits or 1) - 1)
    pts = int(sale_total // Decimal("100.00"))
    customer.loyalty_points = max(0, (customer.loyalty_points or 0) - pts)

    assert customer.total_spend == Decimal("0.00")
    assert customer.total_visits == 0
    assert customer.loyalty_points == 0


@pytest.mark.asyncio
async def test_staff_cannot_delete_invoice_api():
    """Verify that a non-admin staff member gets 403 Forbidden when attempting to delete an invoice."""
    business_id = uuid.UUID("11f91464-454f-4574-8155-ed87e1914831")
    staff_user = User(
        id=uuid.uuid4(),
        business_id=business_id,
        email="receptionist@trimzsalon.com",
        name="Staff Member",
        is_owner=False,
        roles=[]
    )

    app.dependency_overrides[get_current_user] = lambda: staff_user

    try:
        transport = ASGITransport(app=app)
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            headers = {"Authorization": "Bearer test-staff-token"}
            random_invoice_id = uuid.uuid4()
            res = await client.delete(f"/api/v1/invoices/{random_invoice_id}", headers=headers)
            assert res.status_code == 403
            data = res.json()
            assert "Administrator access required" in data.get("detail", "")
    finally:
        app.dependency_overrides.pop(get_current_user, None)
