from typing import List, Dict, Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel

class DailySalesBreakdown(BaseModel):
    date: str
    sales_count: int
    total_amount: Decimal
    cash_amount: Decimal
    upi_amount: Decimal
    card_amount: Decimal

class SalesSummaryReport(BaseModel):
    start_date: str
    end_date: str
    total_revenue: Decimal
    total_bills: int
    completed_bills: int
    cancelled_bills: int
    total_discount: Decimal
    total_tax: Decimal
    net_revenue: Decimal
    payment_methods: Dict[str, Decimal]
    daily_trend: List[DailySalesBreakdown]

class TopServiceReport(BaseModel):
    name: str
    quantity: int
    revenue: Decimal

class DailyClosingReport(BaseModel):
    closing_date: str
    total_revenue: Decimal
    total_bills: int
    completed_bills: int
    cancelled_bills: int
    cash_total: Decimal
    upi_total: Decimal
    card_total: Decimal
    other_total: Decimal
    total_discount: Decimal
    total_tax: Decimal
    top_services: List[TopServiceReport]
    closing_notes: Optional[str] = None

class CustomerSaleItemHistory(BaseModel):
    service_name: str
    quantity: int
    total_price: Decimal

class CustomerSaleHistory(BaseModel):
    sale_id: UUID
    sale_number: str
    invoice_number: Optional[str] = None
    created_at: datetime
    status: str
    total_amount: Decimal
    payment_methods: List[str]
    items: List[CustomerSaleItemHistory]

class CustomerPurchaseHistoryReport(BaseModel):
    customer_id: UUID
    customer_name: str
    customer_phone: str
    total_visits: int
    total_spend: Decimal
    loyalty_points: int
    sales: List[CustomerSaleHistory]
