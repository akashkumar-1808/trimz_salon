import pytest
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from app.main import app
from app.services.pdf_report_generator import generate_daily_sales_pdf

client = TestClient(app)

def test_unauthenticated_export_endpoints_rejected():
    """Export endpoints must require authentication with reports.export permission."""
    endpoints = [
        "/api/v1/reports/sales/export?format=pdf",
        "/api/v1/reports/sales/export?format=csv",
        "/api/v1/reports/export/sales-pdf",
        "/api/v1/reports/export/sales-csv",
    ]
    for url in endpoints:
        res = client.get(url)
        assert res.status_code == 401, f"Expected 401 for unauthenticated request to {url}, got {res.status_code}"

def test_pdf_report_generator_direct():
    """Verify PDF generator produces valid PDF bytes with proper structure."""
    report_data = {
        "business_name": "Trimz Unisex Salon",
        "business_address": "100 Feet Road, Indiranagar, Bengaluru, Karnataka 560038",
        "from_date": "2026-10-01",
        "to_date": "2026-10-07",
        "total_sales": 21,
        "total_revenue": Decimal("14700.00"),
        "payment_methods": {
            "CASH": Decimal("4200.00"),
            "UPI": Decimal("9500.00"),
            "CARD": Decimal("1000.00"),
        },
        "daily_rows": [
            {
                "s_no": 1,
                "date_obj": date(2026, 10, 1),
                "date_str": "2026-10-01",
                "sales_count": 12,
                "total_revenue": Decimal("8500.00"),
                "payment_breakdown": "Cash: ₹2,000.00; UPI: ₹6,500.00"
            },
            {
                "s_no": 2,
                "date_obj": date(2026, 10, 2),
                "date_str": "2026-10-02",
                "sales_count": 9,
                "total_revenue": Decimal("6200.00"),
                "payment_breakdown": "Cash: ₹1,200.00; UPI: ₹5,000.00"
            }
        ]
    }

    pdf_bytes = generate_daily_sales_pdf(report_data)
    assert isinstance(pdf_bytes, bytes)
    assert len(pdf_bytes) > 1000
    assert pdf_bytes.startswith(b"%PDF-"), "Generated file must be a valid PDF beginning with %PDF-"
