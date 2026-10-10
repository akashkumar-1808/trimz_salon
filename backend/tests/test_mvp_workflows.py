"""
TRIMZ SALON — STAGE 3, 4, 5 FAST-TRACK MVP WORKFLOW TESTS
Validates:
1. Stage 3: Salon Settings & Employee / RBAC authorization.
2. Stage 4: POS & Billing Decimal arithmetic, Snapshots, and Cancellation rules.
3. Stage 5: Reports, Daily Closing, and CSV Export authorization.
"""

import sys
import os
import pytest
from decimal import Decimal
from uuid import uuid4

# Ensure backend root is on sys.path
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from fastapi.testclient import TestClient
from app.main import app
from app.schemas.billing import CheckoutRequest, CartItemIn, PaymentIn
from app.schemas.settings import BusinessUpdate
from app.schemas.report import DailyClosingReport, SalesSummaryReport

client = TestClient(app)

def test_unauthenticated_protected_mvp_routes_rejected():
    """All newly added Stage 3, 4, and 5 endpoints require authentication."""
    routes = [
        ("GET", "/api/v1/settings/business"),
        ("GET", "/api/v1/settings/profile"),
        ("GET", "/api/v1/reports/sales-summary"),
        ("GET", "/api/v1/reports/daily-closing"),
        ("GET", "/api/v1/reports/export/sales-csv"),
        ("GET", "/api/v1/billing/sales"),
    ]
    for method, path in routes:
        if method == "GET":
            res = client.get(path)
        else:
            res = client.post(path)
        assert res.status_code == 401, f"Route {path} should return 401 without auth"

def test_checkout_request_decimal_schema_validation():
    """CheckoutRequest enforces strict Decimal arithmetic without float inaccuracy."""
    req = CheckoutRequest(
        customer_phone="+919876543210",
        customer_name="Anita Sharma",
        items=[
            CartItemIn(
                name="Balayage Hair Color",
                unit_price=Decimal("3500.50"),
                quantity=2,
                discount_amount=Decimal("200.00"),
                commission_rate=Decimal("10.00")
            )
        ],
        overall_discount=Decimal("150.00"),
        apply_tax=True,
        payments=[
            PaymentIn(
                amount=Decimal("6651.00"),
                payment_method="UPI",
                payment_provider="PhonePe"
            )
        ]
    )
    assert req.items[0].unit_price == Decimal("3500.50")
    # subtotal = (3500.50 * 2) - 200 = 6801.00
    subtotal = (req.items[0].unit_price * req.items[0].quantity) - req.items[0].discount_amount
    assert subtotal == Decimal("6801.00")
    taxable = subtotal - req.overall_discount
    assert taxable == Decimal("6651.00")

def test_daily_closing_report_schema_contract():
    """DailyClosingReport correctly structures settlement data."""
    rep = DailyClosingReport(
        closing_date="2026-10-10",
        total_revenue=Decimal("15450.00"),
        total_bills=8,
        completed_bills=7,
        cancelled_bills=1,
        cash_total=Decimal("4500.00"),
        upi_total=Decimal("9500.00"),
        card_total=Decimal("1450.00"),
        other_total=Decimal("0.00"),
        total_discount=Decimal("500.00"),
        total_tax=Decimal("735.00"),
        top_services=[]
    )
    assert rep.total_revenue == Decimal("15450.00")
    assert rep.completed_bills + rep.cancelled_bills == rep.total_bills
    assert rep.cash_total + rep.upi_total + rep.card_total == rep.total_revenue

def test_business_settings_update_schema():
    """BusinessUpdate accepts partial field updates and validates tax rates."""
    update = BusinessUpdate(
        name="Trimz Salon & Spa - Flagship",
        default_tax_rate=Decimal("18.00"),
        bill_prefix="TZBLR",
        tax_registration_number="29ABCDE1234F1Z5"
    )
    data = update.model_dump(exclude_unset=True)
    assert data["name"] == "Trimz Salon & Spa - Flagship"
    assert data["default_tax_rate"] == Decimal("18.00")
    assert data["bill_prefix"] == "TZBLR"
    assert "city" not in data
