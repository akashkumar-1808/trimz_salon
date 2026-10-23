from typing import List, Dict, Optional
from datetime import date, datetime
from decimal import Decimal
from uuid import UUID
from pydantic import BaseModel

class DailySalesBreakdown(BaseModel):
    date: str
    sales_count: int
    total_amount: float
    cash_amount: float
    upi_amount: float
    card_amount: float
    payment_breakdown: Optional[str] = None

class StylistSalesBreakdown(BaseModel):
    stylist_id: Optional[UUID] = None
    stylist_name: str
    orders_count: int
    total_revenue: float
    payment_methods: Dict[str, float] = {}

class SalesSummaryReport(BaseModel):
    start_date: str
    end_date: str
    total_revenue: float
    total_bills: int
    completed_bills: int
    cancelled_bills: int
    total_discount: float
    total_tax: float
    net_revenue: float
    payment_methods: Dict[str, float]
    daily_trend: List[DailySalesBreakdown]
    stylist_id: Optional[UUID] = None
    stylist_name: Optional[str] = None
    stylist_breakdown: List[StylistSalesBreakdown] = []

class TopServiceReport(BaseModel):
    name: str
    quantity: int
    revenue: float

class DailyClosingReport(BaseModel):
    closing_date: str
    total_revenue: float
    total_bills: int
    completed_bills: int
    cancelled_bills: int
    cash_total: float
    upi_total: float
    card_total: float
    other_total: float
    total_discount: float
    total_tax: float
    top_services: List[TopServiceReport]
    closing_notes: Optional[str] = None
    stylist_id: Optional[UUID] = None
    stylist_name: Optional[str] = None
    stylist_breakdown: List[StylistSalesBreakdown] = []


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
