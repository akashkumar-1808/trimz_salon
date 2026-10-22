import pytest
import uuid
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from unittest.mock import MagicMock, AsyncMock

from app.models.membership import (
    MembershipPlan,
    MembershipBenefit,
    CustomerMembership,
    MembershipPauseLog,
    MembershipUsageLedger
)
from app.services.membership import (
    get_effective_status,
    is_eligible_for_benefits,
    round_curr,
    calculate_membership_benefits
)
from app.schemas.membership import BillCalculationItemIn

def test_effective_status_lifecycle():
    now_utc = datetime.now(timezone.utc)
    
    # 1. Active membership within validity
    m_active = CustomerMembership(
        id=uuid.uuid4(),
        status="ACTIVE",
        start_date=now_utc - timedelta(days=10),
        expiry_date=now_utc + timedelta(days=100)
    )
    assert get_effective_status(m_active) == "ACTIVE"
    assert is_eligible_for_benefits(m_active) is True

    # 2. Expired membership (expiry in past)
    m_expired = CustomerMembership(
        id=uuid.uuid4(),
        status="ACTIVE",
        start_date=now_utc - timedelta(days=200),
        expiry_date=now_utc - timedelta(days=1)
    )
    assert get_effective_status(m_expired) == "EXPIRED"
    assert is_eligible_for_benefits(m_expired) is False

    # 3. Future membership (start in future)
    m_future = CustomerMembership(
        id=uuid.uuid4(),
        status="ACTIVE",
        start_date=now_utc + timedelta(days=5),
        expiry_date=now_utc + timedelta(days=365)
    )
    assert get_effective_status(m_future) == "PENDING"
    assert is_eligible_for_benefits(m_future) is False

    # 4. Paused membership
    m_paused = CustomerMembership(
        id=uuid.uuid4(),
        status="PAUSED",
        start_date=now_utc - timedelta(days=30),
        expiry_date=now_utc + timedelta(days=90)
    )
    assert get_effective_status(m_paused) == "PAUSED"
    assert is_eligible_for_benefits(m_paused) is False

    # 5. Cancelled membership
    m_cancelled = CustomerMembership(
        id=uuid.uuid4(),
        status="CANCELLED",
        start_date=now_utc - timedelta(days=30),
        expiry_date=now_utc + timedelta(days=90)
    )
    assert get_effective_status(m_cancelled) == "CANCELLED"
    assert is_eligible_for_benefits(m_cancelled) is False

def test_currency_rounding():
    assert round_curr(Decimal("100.456")) == Decimal("100.46")
    assert round_curr(Decimal("100.454")) == Decimal("100.45")
    assert round_curr(Decimal("0.00")) == Decimal("0.00")

@pytest.mark.asyncio
async def test_calculate_membership_benefits_standard():
    # Mock database session
    db = AsyncMock()
    biz_id = uuid.uuid4()
    cust_id = uuid.uuid4()
    svc_id = uuid.uuid4()

    # Mock business
    mock_biz = MagicMock()
    biz_result = MagicMock()
    biz_result.scalar_one_or_none.return_value = mock_biz
    mock_biz.default_tax_rate = Decimal("5.00")

    # Mock customer
    mock_cust = MagicMock()
    mock_cust.id = cust_id
    mock_cust.name = "Test Member"
    mock_cust.phone = "9876543210"

    # Mock active membership with 15% discount
    now_utc = datetime.now(timezone.utc)
    mock_m = CustomerMembership(
        id=uuid.uuid4(),
        business_id=biz_id,
        customer_id=cust_id,
        membership_number="TZ-M-2026-0001",
        status="ACTIVE",
        start_date=now_utc - timedelta(days=10),
        expiry_date=now_utc + timedelta(days=100),
        plan_snapshot={
            "name": "Gold Executive",
            "discount_percent": 15.00,
            "benefits": []
        }
    )

    # Mock service catalogue price
    mock_svc = MagicMock()
    mock_svc.id = svc_id
    mock_svc.name = "Classic Haircut & Beard Grooming"
    mock_svc.price = Decimal("1000.00")
    mock_svc.category_id = None

    async def execute_side_effect(stmt):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "from businesses" in stmt_str:
            res.scalar_one_or_none.return_value = mock_biz
        elif "from customer_memberships" in stmt_str:
            mock_scalar = MagicMock()
            mock_scalar.first.return_value = mock_m
            res.scalars.return_value = mock_scalar
            res.scalar_one_or_none.return_value = mock_m
        elif "from services" in stmt_str:
            res.scalar_one_or_none.return_value = mock_svc
        elif "from membership_usage_ledger" in stmt_str:
            res.all.return_value = []
        elif "from customers" in stmt_str:
            res.scalar_one_or_none.return_value = mock_cust
        return res

    db.execute.side_effect = execute_side_effect

    items_in = [
        BillCalculationItemIn(
            service_id=svc_id,
            name="Classic Haircut & Beard Grooming",
            quantity=2
        )
    ]

    summary = await calculate_membership_benefits(
        db=db,
        business_id=biz_id,
        customer_phone="9876543210",
        customer_id=cust_id,
        items_in=items_in,
        overall_discount=Decimal("100.00"),
        discount_reason="Festive Promo",
        apply_tax=True
    )

    # Subtotal: 2 * 1000 = 2000.00
    assert summary.subtotal == Decimal("2000.00")
    # Membership discount: 15% of 2000.00 = 300.00
    assert summary.total_membership_discount == Decimal("300.00")
    # Remaining after member discount: 1700.00
    # Manual discount: 100.00
    assert summary.total_manual_discount == Decimal("100.00")
    # Taxable amount: 1600.00
    assert summary.taxable_amount == Decimal("1600.00")
    # GST (5%): 80.00
    assert summary.tax_amount == Decimal("80.00")
    # Grand Total: 1680.00
    assert summary.grand_total == Decimal("1680.00")
    # Non-negative check
    assert summary.grand_total > Decimal("0.00")
    # VIP badge metadata verified
    assert summary.membership_applied["membership_number"] == "TZ-M-2026-0001"
    assert summary.membership_applied["is_effective_active"] is True

@pytest.mark.asyncio
async def test_complimentary_service_benefit():
    db = AsyncMock()
    biz_id = uuid.uuid4()
    cust_id = uuid.uuid4()
    svc_id = uuid.uuid4()
    benefit_id = uuid.uuid4()

    mock_biz = MagicMock()
    mock_biz.default_tax_rate = Decimal("0.00")

    mock_cust = MagicMock()
    mock_cust.id = cust_id
    mock_cust.name = "VIP Guest"
    mock_cust.phone = "9876543210"

    now_utc = datetime.now(timezone.utc)
    mock_m = CustomerMembership(
        id=uuid.uuid4(),
        business_id=biz_id,
        customer_id=cust_id,
        membership_number="TZ-M-2026-0002",
        status="ACTIVE",
        start_date=now_utc - timedelta(days=1),
        expiry_date=now_utc + timedelta(days=364),
        plan_snapshot={
            "name": "Platinum VIP",
            "discount_percent": 20.00,
            "benefits": [
                {
                    "id": str(benefit_id),
                    "name": "Free Monthly Hair Spa",
                    "benefit_type": "COMPLIMENTARY_SERVICE",
                    "service_id": str(svc_id),
                    "usage_limit_type": "TOTAL_MEMBERSHIP",
                    "usage_limit_value": 1
                }
            ]
        }
    )

    mock_svc = MagicMock()
    mock_svc.id = svc_id
    mock_svc.name = "Luxury Hair Spa"
    mock_svc.price = Decimal("1500.00")
    mock_svc.category_id = None

    async def execute_side_effect(stmt):
        stmt_str = str(stmt).lower()
        res = MagicMock()
        if "from businesses" in stmt_str:
            res.scalar_one_or_none.return_value = mock_biz
        elif "from customer_memberships" in stmt_str:
            mock_scalar = MagicMock()
            mock_scalar.first.return_value = mock_m
            res.scalars.return_value = mock_scalar
            res.scalar_one_or_none.return_value = mock_m
        elif "from services" in stmt_str:
            res.scalar_one_or_none.return_value = mock_svc
        elif "from membership_usage_ledger" in stmt_str:
            res.all.return_value = []
        elif "from customers" in stmt_str:
            res.scalar_one_or_none.return_value = mock_cust
        return res

    db.execute.side_effect = execute_side_effect

    items_in = [
        BillCalculationItemIn(
            service_id=svc_id,
            name="Luxury Hair Spa",
            quantity=1
        )
    ]

    summary = await calculate_membership_benefits(
        db=db,
        business_id=biz_id,
        customer_phone="9876543210",
        customer_id=cust_id,
        items_in=items_in,
        overall_discount=Decimal("0.00"),
        discount_reason=None,
        apply_tax=False
    )

    # Subtotal: 1500.00
    assert summary.subtotal == Decimal("1500.00")
    # Line item is complimentary
    assert summary.items[0].is_complimentary is True
    assert summary.items[0].membership_discount == Decimal("1500.00")
    assert summary.items[0].line_total == Decimal("0.00")
    # Grand total is 0.00
    assert summary.grand_total == Decimal("0.00")

