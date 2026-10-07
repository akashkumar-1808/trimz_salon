from typing import List, Optional
from decimal import Decimal
from pydantic import BaseModel
from app.schemas.billing import SaleOut

class DashboardKPIs(BaseModel):
    gross_revenue: Decimal
    total_transactions: int
    average_bill_value: Decimal
    total_customers_served: int
    new_customers: int
    returning_customers: int

class PaymentMethodShare(BaseModel):
    method: str
    amount: Decimal
    count: int
    percentage: float

class UPIProviderShare(BaseModel):
    provider: str
    amount: Decimal
    count: int

class TopServiceItem(BaseModel):
    service_id: Optional[str] = None
    name: str
    units_sold: int
    total_revenue: Decimal

class DashboardResponse(BaseModel):
    period: str # today, yesterday, this_week, this_month, last_month, this_year, lifetime, custom
    start_date: str
    end_date: str
    kpis: DashboardKPIs
    payment_methods: List[PaymentMethodShare]
    upi_providers: List[UPIProviderShare]
    top_services: List[TopServiceItem]
    recent_sales: List[SaleOut] = []
