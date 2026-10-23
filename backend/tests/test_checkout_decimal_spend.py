"""
TRIMZ SALON — CHECKOUT DECIMAL & MONETARY ARITHMETIC REGRESSION TESTS
Tests covering:
1. Customer total_spend update with zero initial spend.
2. Customer total_spend update with existing initial spend.
3. Customer total_spend update with None initial spend.
4. Loyalty points computation using Decimal division.
5. BillCalculationSummary and BillCalculationItemOut Decimal integrity in Python and float serialization in JSON.
6. Verification that customer.total_spend = current_spend + grand_total never raises TypeError between Decimal and float.
"""

import sys
import os
import pytest
import uuid
import json
from decimal import Decimal
from datetime import datetime, timezone

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.models.customer import Customer
from app.models.sale import Sale
from app.models.invoice import Invoice
from app.schemas.membership import BillCalculationSummary, BillCalculationItemOut


def test_customer_total_spend_zero_initial():
    """Verify customer with 0 or Decimal('0.00') initial spend increments accurately without TypeError."""
    customer = Customer(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        name="Ananya Rao",
        phone="9876543210",
        total_visits=0,
        total_spend=Decimal("0.00"),
        loyalty_points=0
    )

    grand_total = Decimal("750.50")
    current_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = current_spend + grand_total
    customer.loyalty_points = (customer.loyalty_points or 0) + int(grand_total // Decimal("100.00"))

    assert customer.total_spend == Decimal("750.50")
    assert customer.loyalty_points == 7
    assert isinstance(customer.total_spend, Decimal)


def test_customer_total_spend_existing_initial():
    """Verify customer with existing cumulative spend accumulates correctly with Decimal precision."""
    customer = Customer(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        name="Rohit Sharma",
        phone="9876543211",
        total_visits=4,
        total_spend=Decimal("2350.25"),
        loyalty_points=23
    )

    grand_total = Decimal("1149.75")
    current_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = current_spend + grand_total
    customer.loyalty_points = (customer.loyalty_points or 0) + int(grand_total // Decimal("100.00"))

    assert customer.total_spend == Decimal("3500.00")
    assert customer.loyalty_points == 34
    assert isinstance(customer.total_spend, Decimal)


def test_customer_total_spend_none_initial():
    """Verify customer with None/uninitialized total_spend defaults safely to 0.00."""
    customer = Customer(
        id=uuid.uuid4(),
        business_id=uuid.uuid4(),
        name="Pooja Hegde",
        phone="9876543212",
        total_visits=None,
        total_spend=None,
        loyalty_points=None
    )

    grand_total = Decimal("500.00")
    customer.total_visits = (customer.total_visits or 0) + 1
    current_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = current_spend + grand_total
    customer.loyalty_points = (customer.loyalty_points or 0) + int(grand_total // Decimal("100.00"))

    assert customer.total_visits == 1
    assert customer.total_spend == Decimal("500.00")
    assert customer.loyalty_points == 5


def test_bill_calculation_summary_precision_and_json_serialization():
    """Verify BillCalculationSummary holds Decimal in Python memory but serializes to numeric float in JSON."""
    item = BillCalculationItemOut(
        item_type="service",
        name="Keratin Hair Treatment",
        catalogue_price=Decimal("4500.00"),
        unit_price=Decimal("4500.00"),
        quantity=1,
        gross_total=Decimal("4500.00"),
        membership_discount=Decimal("500.00"),
        manual_discount=Decimal("200.00"),
        line_total=Decimal("3800.00"),
        is_complimentary=False
    )

    summary = BillCalculationSummary(
        subtotal=Decimal("4500.00"),
        total_membership_discount=Decimal("500.00"),
        total_manual_discount=Decimal("200.00"),
        taxable_amount=Decimal("3800.00"),
        tax_percentage=Decimal("5.00"),
        tax_amount=Decimal("190.00"),
        grand_total=Decimal("3990.00"),
        items=[item]
    )

    # 1. Python in-memory verification
    assert isinstance(summary.grand_total, Decimal)
    assert isinstance(summary.subtotal, Decimal)
    assert isinstance(summary.items[0].membership_discount, Decimal)

    # 2. Arithmetic with customer spend
    cust_spend = Decimal("1000.00")
    new_spend = cust_spend + summary.grand_total
    assert new_spend == Decimal("4990.00")

    # 3. JSON serialization verification for frontend API consumer
    json_bytes = summary.model_dump_json()
    payload = json.loads(json_bytes)

    assert isinstance(payload["grand_total"], float)
    assert payload["grand_total"] == 3990.0
    assert isinstance(payload["subtotal"], float)
    assert payload["subtotal"] == 4500.0
    assert isinstance(payload["items"][0]["membership_discount"], float)
    assert payload["items"][0]["membership_discount"] == 500.0
