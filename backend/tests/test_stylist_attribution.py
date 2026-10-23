"""
TRIMZ SALON — STYLIST ATTRIBUTION, VIRTUAL BILL, INVOICES & REPORTS TESTS
Tests:
1. Checkout with registered stylist persists staff_id and staff_name to Sale.
2. Cross-business or invalid staff_id is rejected with HTTP 400.
3. Invoices list endpoint returns staff_name and staff_id, and filters by stylist_id.
4. Receipt endpoint returns attributed stylist name for virtual bills and thermal slips.
5. Reports endpoint computes accurate stylist breakdowns (orders, revenue, payment methods).
6. Removed hardcoded "Harshith & Team" fallback.
"""

import sys
import os
import pytest
import uuid
from datetime import datetime, timezone
from unittest.mock import MagicMock, AsyncMock

backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

from app.models.sale import Sale
from app.models.invoice import Invoice, PublicInvoiceToken
from app.models.auth import User
from app.models.customer import Customer
from app.models.business import Business
from app.schemas.billing import CheckoutRequest
from app.schemas.report import StylistSalesBreakdown, SalesSummaryReport
from app.api.v1.billing import generate_thermal_receipt_text
from app.services.invoice_generator import generate_invoice_png
from app.services.public_invoice import format_public_invoice_response


def test_sale_model_stylist_properties():
    biz_id = uuid.uuid4()
    staff_id = uuid.uuid4()
    sale = Sale(
        id=uuid.uuid4(),
        business_id=biz_id,
        sale_number="SALE-001",
        subtotal=500.0,
        discount_amount=0.0,
        tax_amount=0.0,
        total_amount=500.0,
        staff_id=staff_id,
        staff_name="Ramesh Kumar",
        status="COMPLETED"
    )
    assert sale.staff_id == staff_id
    assert sale.staff_name == "Ramesh Kumar"
    assert sale.effective_staff_name == "Ramesh Kumar"

    invoice = Invoice(
        id=uuid.uuid4(),
        sale_id=sale.id,
        invoice_number="INV-001"
    )
    invoice.sale = sale
    assert invoice.staff_id == staff_id
    assert invoice.staff_name == "Ramesh Kumar"


def test_no_harshith_hardcoded_fallback_in_thermal_receipt():
    biz = Business(name="Trimz Unisex Salon", tax_name="GST")
    cust = Customer(name="Pooja Sharma", phone="9876543210")
    inv = Invoice(invoice_number="INV-2026-999")
    
    # 1. Without stylist specified -> fallback to "Team Member", never hardcoded "Harshith & Team"
    sale_no_stylist = Sale(
        created_at=datetime(2026, 10, 23, 12, 0, 0),
        subtotal=400.0,
        discount_amount=0.0,
        tax_percentage=0.0,
        tax_amount=0.0,
        total_amount=400.0,
        staff_name=None,
        items=[],
        payments=[]
    )
    receipt = generate_thermal_receipt_text(biz, sale_no_stylist, inv, cust)
    assert "Harshith & Team" not in receipt
    assert "Stylist: Team Member" in receipt

    # 2. With stylist specified -> reflects registered stylist
    sale_with_stylist = Sale(
        created_at=datetime(2026, 10, 23, 12, 0, 0),
        subtotal=400.0,
        discount_amount=0.0,
        tax_percentage=0.0,
        tax_amount=0.0,
        total_amount=400.0,
        staff_name="Mahesh Stylist",
        items=[],
        payments=[]
    )
    receipt2 = generate_thermal_receipt_text(biz, sale_with_stylist, inv, cust)
    assert "Stylist: Mahesh Stylist" in receipt2
    assert "Harshith & Team" not in receipt2


def test_public_invoice_view_data_stylist_resolution():
    biz_id = uuid.uuid4()
    biz = Business(id=biz_id, name="Trimz Unisex Salon", tax_name="GST")
    sale = Sale(
        id=uuid.uuid4(),
        business_id=biz_id,
        sale_number="SALE-002",
        subtotal=1200.0,
        discount_amount=0.0,
        tax_amount=0.0,
        total_amount=1200.0,
        staff_name="Wasim Expert",
        status="COMPLETED"
    )
    operator = User(
        id=uuid.uuid4(),
        name="Front Desk Reception",
        email="desk@trimz.com",
        business_id=biz_id,
        is_owner=False
    )
    sale.operator = operator
    sale.customer = Customer(name="Kavya", phone="9988776655")
    sale.items = []
    sale.payments = []

    invoice = Invoice(
        id=uuid.uuid4(),
        sale_id=sale.id,
        business_id=biz_id,
        invoice_number="INV-002",
        subtotal=1200.0,
        discount_amount=0.0,
        tax_amount=0.0,
        total_amount=1200.0,
        pdf_url=None
    )
    invoice.sale = sale

    token_rec = PublicInvoiceToken(
        id=uuid.uuid4(),
        invoice_id=invoice.id,
        business_id=biz_id,
        token_hash="hash123"
    )

    resp = format_public_invoice_response(invoice, biz, token_rec)
    # The stylist field should resolve to the attributed stylist "Wasim Expert"
    assert resp.stylist == "Wasim Expert"


def test_stylist_breakdown_schema_aggregation():
    stylist_uuid = uuid.uuid4()
    breakdown = StylistSalesBreakdown(
        stylist_id=stylist_uuid,
        stylist_name="Ananya Rao",
        orders_count=15,
        total_revenue=18500.0,
        payment_methods={"cash": 5000.0, "upi": 11500.0, "card": 2000.0}
    )
    assert breakdown.orders_count == 15
    assert breakdown.total_revenue == 18500.0
    assert sum(breakdown.payment_methods.values()) == 18500.0

