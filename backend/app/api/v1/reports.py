import io
import csv
from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.core.database import get_db
from app.models.sale import Sale, SaleItem, Payment
from app.models.invoice import Invoice
from app.models.customer import Customer
from app.models.business import Business
from app.models.auth import User
from app.schemas.report import (
    SalesSummaryReport,
    DailySalesBreakdown,
    DailyClosingReport,
    TopServiceReport,
    CustomerPurchaseHistoryReport,
    CustomerSaleHistory,
    CustomerSaleItemHistory,
)
from app.api.deps import require_permission

router = APIRouter(prefix="/reports", tags=["Reports & Analytics"])

def parse_date_range(start_date_str: Optional[str], end_date_str: Optional[str]):
    today = datetime.now(timezone.utc).date()
    if start_date_str:
        try:
            start_d = datetime.strptime(start_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_date format, use YYYY-MM-DD")
    else:
        start_d = today - timedelta(days=29)

    if end_date_str:
        try:
            end_d = datetime.strptime(end_date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_date format, use YYYY-MM-DD")
    else:
        end_d = today

    if start_d > end_d:
        raise HTTPException(status_code=400, detail="start_date cannot be after end_date")

    start_dt = datetime.combine(start_d, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(end_d, time.max, tzinfo=timezone.utc)
    return start_d, end_d, start_dt, end_dt

@router.get("/sales-summary", response_model=SalesSummaryReport)
async def get_sales_summary(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    start_d, end_d, start_dt, end_dt = parse_date_range(start_date, end_date)

    sales_res = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt
        ).order_by(Sale.created_at.asc())
    )
    sales = sales_res.scalars().all()

    total_revenue = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")
    completed_bills = 0
    cancelled_bills = 0

    payment_methods: Dict[str, Decimal] = {"CASH": Decimal("0.00"), "UPI": Decimal("0.00"), "CARD": Decimal("0.00"), "OTHER": Decimal("0.00")}
    daily_map: Dict[str, Dict] = {}

    curr = start_d
    while curr <= end_d:
        d_str = curr.strftime("%Y-%m-%d")
        daily_map[d_str] = {
            "sales_count": 0,
            "total_amount": Decimal("0.00"),
            "cash_amount": Decimal("0.00"),
            "upi_amount": Decimal("0.00"),
            "card_amount": Decimal("0.00"),
        }
        curr += timedelta(days=1)

    for s in sales:
        d_str = s.created_at.strftime("%Y-%m-%d") if s.created_at else start_d.strftime("%Y-%m-%d")
        if s.status == "COMPLETED":
            completed_bills += 1
            total_revenue += s.total_amount
            total_discount += s.discount_amount
            total_tax += s.tax_amount

            if d_str in daily_map:
                daily_map[d_str]["sales_count"] += 1
                daily_map[d_str]["total_amount"] += s.total_amount

            for p in s.payments:
                if p.status == "SUCCESS":
                    method = p.payment_method.upper()
                    if method in payment_methods:
                        payment_methods[method] += p.amount
                    else:
                        payment_methods["OTHER"] += p.amount

                    if d_str in daily_map:
                        if method == "CASH":
                            daily_map[d_str]["cash_amount"] += p.amount
                        elif method == "UPI":
                            daily_map[d_str]["upi_amount"] += p.amount
                        elif method == "CARD":
                            daily_map[d_str]["card_amount"] += p.amount
        elif s.status == "CANCELLED":
            cancelled_bills += 1

    daily_trend = [
        DailySalesBreakdown(
            date=k,
            sales_count=v["sales_count"],
            total_amount=v["total_amount"],
            cash_amount=v["cash_amount"],
            upi_amount=v["upi_amount"],
            card_amount=v["card_amount"]
        )
        for k, v in sorted(daily_map.items())
    ]

    return SalesSummaryReport(
        start_date=start_d.strftime("%Y-%m-%d"),
        end_date=end_d.strftime("%Y-%m-%d"),
        total_revenue=total_revenue,
        total_bills=len(sales),
        completed_bills=completed_bills,
        cancelled_bills=cancelled_bills,
        total_discount=total_discount,
        total_tax=total_tax,
        net_revenue=total_revenue - total_tax,
        payment_methods=payment_methods,
        daily_trend=daily_trend
    )

@router.get("/daily-closing", response_model=DailyClosingReport)
async def get_daily_closing(
    date_str: Optional[str] = Query(None, alias="date", description="Target date (YYYY-MM-DD), defaults to today"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    if date_str:
        try:
            target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid date format, use YYYY-MM-DD")
    else:
        target_date = datetime.now(timezone.utc).date()

    start_dt = datetime.combine(target_date, time.min, tzinfo=timezone.utc)
    end_dt = datetime.combine(target_date, time.max, tzinfo=timezone.utc)

    sales_res = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt
        ).order_by(Sale.created_at.asc())
    )
    sales = sales_res.scalars().all()

    total_revenue = Decimal("0.00")
    total_discount = Decimal("0.00")
    total_tax = Decimal("0.00")
    completed_bills = 0
    cancelled_bills = 0
    cash_total = Decimal("0.00")
    upi_total = Decimal("0.00")
    card_total = Decimal("0.00")
    other_total = Decimal("0.00")

    service_counts: Dict[str, Dict] = {}

    for s in sales:
        if s.status == "COMPLETED":
            completed_bills += 1
            total_revenue += s.total_amount
            total_discount += s.discount_amount
            total_tax += s.tax_amount

            for p in s.payments:
                if p.status == "SUCCESS":
                    m = p.payment_method.upper()
                    if m == "CASH":
                        cash_total += p.amount
                    elif m == "UPI":
                        upi_total += p.amount
                    elif m == "CARD":
                        card_total += p.amount
                    else:
                        other_total += p.amount

            for item in s.items:
                s_name = item.service_name_snapshot
                if s_name not in service_counts:
                    service_counts[s_name] = {"quantity": 0, "revenue": Decimal("0.00")}
                service_counts[s_name]["quantity"] += item.quantity
                service_counts[s_name]["revenue"] += item.total_price
        elif s.status == "CANCELLED":
            cancelled_bills += 1

    sorted_services = sorted(
        service_counts.items(),
        key=lambda x: x[1]["revenue"],
        reverse=True
    )[:5]

    top_services = [
        TopServiceReport(name=name, quantity=d["quantity"], revenue=d["revenue"])
        for name, d in sorted_services
    ]

    return DailyClosingReport(
        closing_date=target_date.strftime("%Y-%m-%d"),
        total_revenue=total_revenue,
        total_bills=len(sales),
        completed_bills=completed_bills,
        cancelled_bills=cancelled_bills,
        cash_total=cash_total,
        upi_total=upi_total,
        card_total=card_total,
        other_total=other_total,
        total_discount=total_discount,
        total_tax=total_tax,
        top_services=top_services
    )

@router.get("/customer-history/{customer_id}", response_model=CustomerPurchaseHistoryReport)
async def get_customer_purchase_history(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.view"))
):
    cust_res = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.id == customer_id
        )
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    sales_res = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.customer_id == customer_id
        ).order_by(Sale.created_at.desc())
    )
    sales = sales_res.scalars().all()

    sales_history = []
    for s in sales:
        pay_methods = list({p.payment_method for p in s.payments})
        items_history = [
            CustomerSaleItemHistory(
                service_name=it.service_name_snapshot,
                quantity=it.quantity,
                total_price=it.total_price
            )
            for it in s.items
        ]
        inv_num = s.invoice.invoice_number if s.invoice else None
        sales_history.append(CustomerSaleHistory(
            sale_id=s.id,
            sale_number=s.sale_number,
            invoice_number=inv_num,
            created_at=s.created_at,
            status=s.status,
            total_amount=s.total_amount,
            payment_methods=pay_methods,
            items=items_history
        ))

    return CustomerPurchaseHistoryReport(
        customer_id=customer.id,
        customer_name=customer.name,
        customer_phone=customer.phone,
        total_visits=customer.total_visits,
        total_spend=customer.total_spend,
        loyalty_points=customer.loyalty_points,
        sales=sales_history
    )

@router.get("/export/sales-csv")
async def export_sales_csv(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.export"))
):
    start_d, end_d, start_dt, end_dt = parse_date_range(start_date, end_date)

    sales_res = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt
        ).order_by(Sale.created_at.desc())
    )
    sales = sales_res.scalars().all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Sale Number",
        "Invoice Number",
        "Date",
        "Customer Name",
        "Customer Phone",
        "Stylist",
        "Status",
        "Subtotal",
        "Discount",
        "Tax",
        "Total Amount",
        "Payment Modes"
    ])

    for s in sales:
        cust_name = s.customer.name if s.customer else ""
        cust_phone = s.customer.phone if s.customer else ""
        inv_num = s.invoice.invoice_number if s.invoice else ""
        date_str = s.created_at.strftime("%Y-%m-%d %H:%M") if s.created_at else ""
        modes = "/".join({p.payment_method for p in s.payments}) if s.payments else "UPI"

        writer.writerow([
            s.sale_number,
            inv_num,
            date_str,
            cust_name,
            cust_phone,
            s.staff_name or "",
            s.status,
            str(s.subtotal),
            str(s.discount_amount),
            str(s.tax_amount),
            str(s.total_amount),
            modes
        ])

    csv_data = output.getvalue()
    filename = f"sales_export_{start_d}_{end_d}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
