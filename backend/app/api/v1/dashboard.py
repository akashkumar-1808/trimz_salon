from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.models.sale import Sale, SaleItem, Payment
from app.models.customer import Customer
from app.models.auth import User
from app.schemas.dashboard import (
    DashboardResponse, DashboardKPIs, PaymentMethodShare, UPIProviderShare, TopServiceItem
)
from app.schemas.billing import SaleOut
from app.api.deps import require_permission

router = APIRouter(prefix="/dashboard", tags=["Dashboard Analytics"])

def get_date_bounds(period: str, now: datetime) -> tuple[datetime, datetime]:
    today_start = datetime(now.year, now.month, now.day, 0, 0, 0, tzinfo=timezone.utc)
    today_end = datetime(now.year, now.month, now.day, 23, 59, 59, tzinfo=timezone.utc)

    if period == "today":
        return today_start, today_end
    elif period == "yesterday":
        y_start = today_start - timedelta(days=1)
        y_end = today_end - timedelta(days=1)
        return y_start, y_end
    elif period == "this_week":
        start_week = today_start - timedelta(days=now.weekday())
        return start_week, today_end
    elif period == "this_month":
        start_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start_month, today_end
    elif period == "last_month":
        first_this_month = datetime(now.year, now.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        last_day_prev = first_this_month - timedelta(days=1)
        start_prev = datetime(last_day_prev.year, last_day_prev.month, 1, 0, 0, 0, tzinfo=timezone.utc)
        end_prev = datetime(last_day_prev.year, last_day_prev.month, last_day_prev.day, 23, 59, 59, tzinfo=timezone.utc)
        return start_prev, end_prev
    elif period == "this_year":
        start_year = datetime(now.year, 1, 1, 0, 0, 0, tzinfo=timezone.utc)
        return start_year, today_end
    else: # lifetime
        return datetime(2020, 1, 1, tzinfo=timezone.utc), today_end

@router.get("/metrics", response_model=DashboardResponse)
async def get_dashboard_metrics(
    period: str = Query("today", description="today, yesterday, this_week, this_month, last_month, this_year, lifetime"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("dashboard.view"))
):
    now = datetime.now(timezone.utc)
    start_date, end_date = get_date_bounds(period, now)

    biz_id = current_user.business_id

    # 1. Total sales and gross revenue
    sales_q = await db.execute(
        select(
            func.count(Sale.id).label("tx_count"),
            func.coalesce(func.sum(Sale.total_amount), Decimal("0.00")).label("revenue"),
            func.count(func.distinct(Sale.customer_id)).label("unique_customers")
        )
        .where(
            Sale.business_id == biz_id,
            Sale.status == "COMPLETED",
            Sale.created_at >= start_date,
            Sale.created_at <= end_date
        )
    )
    sales_row = sales_q.first()
    tx_count = sales_row.tx_count or 0
    revenue = sales_row.revenue or Decimal("0.00")
    unique_custs = sales_row.unique_customers or 0

    abv = round(revenue / tx_count, 2) if tx_count > 0 else Decimal("0.00")

    # 2. New customers in this period
    new_custs_q = await db.execute(
        select(func.count(Customer.id))
        .where(
            Customer.business_id == biz_id,
            Customer.created_at >= start_date,
            Customer.created_at <= end_date
        )
    )
    new_customers = new_custs_q.scalar() or 0
    returning_customers = max(0, unique_custs - new_customers)

    # 3. Payment Breakdown by Method
    pay_methods_q = await db.execute(
        select(
            Payment.payment_method,
            func.coalesce(func.sum(Payment.amount), Decimal("0.00")).label("amount"),
            func.count(Payment.id).label("count")
        )
        .join(Sale, Payment.sale_id == Sale.id)
        .where(
            Payment.business_id == biz_id,
            Payment.status == "SUCCESS",
            Sale.created_at >= start_date,
            Sale.created_at <= end_date
        )
        .group_by(Payment.payment_method)
    )
    pay_methods = []
    total_payments_amt = Decimal("0.00")
    for r in pay_methods_q.all():
        amt = r.amount or Decimal("0.00")
        total_payments_amt += amt
        pay_methods.append({
            "method": r.payment_method,
            "amount": amt,
            "count": r.count
        })

    payment_shares = []
    for pm in pay_methods:
        pct = float(pm["amount"] / total_payments_amt * 100) if total_payments_amt > 0 else 0.0
        payment_shares.append(PaymentMethodShare(
            method=pm["method"],
            amount=pm["amount"],
            count=pm["count"],
            percentage=round(pct, 1)
        ))

    # 4. UPI Provider Breakdown
    upi_q = await db.execute(
        select(
            func.coalesce(Payment.payment_provider, "Other UPI").label("provider"),
            func.coalesce(func.sum(Payment.amount), Decimal("0.00")).label("amount"),
            func.count(Payment.id).label("count")
        )
        .join(Sale, Payment.sale_id == Sale.id)
        .where(
            Payment.business_id == biz_id,
            Payment.payment_method == "UPI",
            Payment.status == "SUCCESS",
            Sale.created_at >= start_date,
            Sale.created_at <= end_date
        )
        .group_by(Payment.payment_provider)
    )
    upi_providers = [
        UPIProviderShare(provider=r.provider, amount=r.amount or Decimal("0.00"), count=r.count)
        for r in upi_q.all()
    ]

    # 5. Top Services
    top_srv_q = await db.execute(
        select(
            SaleItem.service_name_snapshot.label("name"),
            func.sum(SaleItem.quantity).label("units_sold"),
            func.coalesce(func.sum(SaleItem.total_price), Decimal("0.00")).label("revenue")
        )
        .join(Sale, SaleItem.sale_id == Sale.id)
        .where(
            Sale.business_id == biz_id,
            Sale.status == "COMPLETED",
            Sale.created_at >= start_date,
            Sale.created_at <= end_date
        )
        .group_by(SaleItem.service_name_snapshot)
        .order_by(func.sum(SaleItem.total_price).desc())
        .limit(5)
    )
    top_services = [
        TopServiceItem(name=r.name, units_sold=r.units_sold or 0, total_revenue=r.revenue)
        for r in top_srv_q.all()
    ]

    # 6. Recent Sales
    recent_q = await db.execute(
        select(Sale)
        .where(
            Sale.business_id == biz_id,
            Sale.status == "COMPLETED",
            Sale.created_at >= start_date,
            Sale.created_at <= end_date
        )
        .order_by(Sale.created_at.desc())
        .limit(5)
    )
    recent_sales = [SaleOut.model_validate(s) for s in recent_q.scalars().all()]

    return DashboardResponse(
        period=period,
        start_date=start_date.strftime("%Y-%m-%d"),
        end_date=end_date.strftime("%Y-%m-%d"),
        kpis=DashboardKPIs(
            gross_revenue=revenue,
            total_transactions=tx_count,
            average_bill_value=abv,
            total_customers_served=unique_custs,
            new_customers=new_customers,
            returning_customers=returning_customers
        ),
        payment_methods=payment_shares,
        upi_providers=upi_providers,
        top_services=top_services,
        recent_sales=recent_sales
    )
