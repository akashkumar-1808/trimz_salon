import io
import csv
from datetime import datetime, date, time, timedelta, timezone
from decimal import Decimal
from typing import Optional, List, Dict, Any
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
    StylistSalesBreakdown,
    DailyClosingReport,
    TopServiceReport,
    CustomerPurchaseHistoryReport,
    CustomerSaleHistory,
    CustomerSaleItemHistory,
)
from app.api.deps import require_permission
from app.services.pdf_report_generator import generate_daily_sales_pdf

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

async def compute_stylist_breakdown(
    db: AsyncSession,
    business_id: UUID,
    all_period_sales: List[Sale]
) -> List[StylistSalesBreakdown]:
    """
    Computes exact order count, completed sales total, and payment method
    breakdown for each registered staff member in the authenticated business.
    Excludes cancelled/refunded sales to prevent double-counting.
    """
    users_res = await db.execute(
        select(User).where(User.business_id == business_id).order_by(User.name.asc())
    )
    users = users_res.scalars().all()

    breakdown_map: Dict[UUID, Dict[str, Any]] = {}
    name_to_id: Dict[str, UUID] = {}
    for u in users:
        breakdown_map[u.id] = {
            "stylist_id": u.id,
            "stylist_name": u.name,
            "orders_count": 0,
            "total_revenue": Decimal("0.00"),
            "payment_methods": {
                "CASH": Decimal("0.00"),
                "UPI": Decimal("0.00"),
                "CARD": Decimal("0.00"),
                "OTHER": Decimal("0.00"),
            }
        }
        if u.name:
            name_to_id[u.name.strip().lower()] = u.id

    unattributed = {
        "stylist_id": None,
        "stylist_name": "Unassigned / General Desk",
        "orders_count": 0,
        "total_revenue": Decimal("0.00"),
        "payment_methods": {
            "CASH": Decimal("0.00"),
            "UPI": Decimal("0.00"),
            "CARD": Decimal("0.00"),
            "OTHER": Decimal("0.00"),
        }
    }

    for s in all_period_sales:
        if s.status == "COMPLETED":
            target = None
            if s.staff_id and s.staff_id in breakdown_map:
                target = breakdown_map[s.staff_id]
            elif s.staff_name and s.staff_name.strip().lower() in name_to_id:
                target = breakdown_map[name_to_id[s.staff_name.strip().lower()]]
            elif s.operator_id and s.operator_id in breakdown_map:
                target = breakdown_map[s.operator_id]
            else:
                target = unattributed

            target["orders_count"] += 1
            target["total_revenue"] += s.total_amount

            for p in s.payments:
                if p.status == "SUCCESS":
                    m = (p.payment_method or "OTHER").upper()
                    if m in target["payment_methods"]:
                        target["payment_methods"][m] += p.amount
                    else:
                        target["payment_methods"]["OTHER"] += p.amount

    result = [
        StylistSalesBreakdown(
            stylist_id=v["stylist_id"],
            stylist_name=v["stylist_name"],
            orders_count=v["orders_count"],
            total_revenue=v["total_revenue"],
            payment_methods=v["payment_methods"]
        )
        for v in breakdown_map.values()
    ]
    if unattributed["orders_count"] > 0:
        result.append(StylistSalesBreakdown(
            stylist_id=None,
            stylist_name=unattributed["stylist_name"],
            orders_count=unattributed["orders_count"],
            total_revenue=unattributed["total_revenue"],
            payment_methods=unattributed["payment_methods"]
        ))
    return sorted(result, key=lambda x: (x.orders_count, x.total_revenue), reverse=True)

@router.get("/sales-summary", response_model=SalesSummaryReport)
async def get_sales_summary(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    stylist_id: Optional[UUID] = Query(None, description="Filter by registered stylist ID"),
    staff_id: Optional[UUID] = Query(None, description="Alias for stylist_id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    eff_stylist_id = stylist_id or staff_id
    start_d, end_d, start_dt, end_dt = parse_date_range(start_date, end_date)

    sales_res = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.created_at >= start_dt,
            Sale.created_at <= end_dt
        ).order_by(Sale.created_at.asc())
    )
    all_sales = sales_res.scalars().all()

    # Authoritative stylist-wise breakdown across all completed orders in the period
    stylist_breakdown = await compute_stylist_breakdown(db, current_user.business_id, all_sales)

    # Resolve selected stylist name if filter is requested
    stylist_name: Optional[str] = None
    if eff_stylist_id:
        user_res = await db.execute(
            select(User).where(
                User.id == eff_stylist_id,
                User.business_id == current_user.business_id
            )
        )
        user_obj = user_res.scalar_one_or_none()
        if user_obj:
            stylist_name = user_obj.name

    # Filter sales to active stylist if requested
    if eff_stylist_id:
        active_sales = [
            s for s in all_sales
            if s.staff_id == eff_stylist_id or (stylist_name and s.staff_name and s.staff_name.strip().lower() == stylist_name.strip().lower())
        ]
    else:
        active_sales = all_sales

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

    for s in active_sales:
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
        total_bills=len(active_sales),
        completed_bills=completed_bills,
        cancelled_bills=cancelled_bills,
        total_discount=total_discount,
        total_tax=total_tax,
        net_revenue=total_revenue - total_tax,
        payment_methods=payment_methods,
        daily_trend=daily_trend,
        stylist_id=eff_stylist_id,
        stylist_name=stylist_name,
        stylist_breakdown=stylist_breakdown
    )

@router.get("/daily-closing", response_model=DailyClosingReport)
async def get_daily_closing(
    date_str: Optional[str] = Query(None, alias="date", description="Target date (YYYY-MM-DD), defaults to today"),
    stylist_id: Optional[UUID] = Query(None, description="Filter by registered stylist ID"),
    staff_id: Optional[UUID] = Query(None, description="Alias for stylist_id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.view"))
):
    eff_stylist_id = stylist_id or staff_id
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
    all_sales = sales_res.scalars().all()

    # Stylist-wise breakdown for daily closing
    stylist_breakdown = await compute_stylist_breakdown(db, current_user.business_id, all_sales)

    stylist_name: Optional[str] = None
    if eff_stylist_id:
        user_res = await db.execute(
            select(User).where(
                User.id == eff_stylist_id,
                User.business_id == current_user.business_id
            )
        )
        user_obj = user_res.scalar_one_or_none()
        if user_obj:
            stylist_name = user_obj.name

    if eff_stylist_id:
        active_sales = [
            s for s in all_sales
            if s.staff_id == eff_stylist_id or (stylist_name and s.staff_name and s.staff_name.strip().lower() == stylist_name.strip().lower())
        ]
    else:
        active_sales = all_sales

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

    for s in active_sales:
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
        total_bills=len(active_sales),
        completed_bills=completed_bills,
        cancelled_bills=cancelled_bills,
        cash_total=cash_total,
        upi_total=upi_total,
        card_total=card_total,
        other_total=other_total,
        total_discount=total_discount,
        total_tax=total_tax,
        top_services=top_services,
        stylist_id=eff_stylist_id,
        stylist_name=stylist_name,
        stylist_breakdown=stylist_breakdown
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

async def get_daily_sales_report_data(
    db: AsyncSession,
    business_id: UUID,
    start_d: date,
    end_d: date,
    start_dt: datetime,
    end_dt: datetime,
    stylist_id: Optional[UUID] = None
) -> Dict[str, Any]:
    """
    Authoritative aggregation of daily sales and payments across the applied date range.
    Ensures complete reconciliation between daily table rows and overall period summary totals.
    """
    stmt = select(Sale).where(
        Sale.business_id == business_id,
        Sale.created_at >= start_dt,
        Sale.created_at <= end_dt
    )
    if stylist_id:
        stmt = stmt.where(Sale.staff_id == stylist_id)
    stmt = stmt.order_by(Sale.created_at.asc())

    sales_res = await db.execute(stmt)
    sales = sales_res.scalars().all()

    # Pre-populate all days in the applied filter range
    daily_map: Dict[str, Dict[str, Any]] = {}
    curr = start_d
    while curr <= end_d:
        d_str = curr.strftime("%Y-%m-%d")
        daily_map[d_str] = {
            "date_obj": curr,
            "date_str": d_str,
            "sales_count": 0,
            "total_revenue": Decimal("0.00"),
            "payment_methods": {
                "CASH": Decimal("0.00"),
                "UPI": Decimal("0.00"),
                "CARD": Decimal("0.00"),
                "OTHER": Decimal("0.00"),
            }
        }
        curr += timedelta(days=1)

    total_sales = 0
    total_revenue = Decimal("0.00")
    period_payment_totals: Dict[str, Decimal] = {
        "CASH": Decimal("0.00"),
        "UPI": Decimal("0.00"),
        "CARD": Decimal("0.00"),
        "OTHER": Decimal("0.00"),
    }

    for s in sales:
        if s.status == "COMPLETED":
            total_sales += 1
            total_revenue += s.total_amount
            d_str = s.created_at.strftime("%Y-%m-%d") if s.created_at else start_d.strftime("%Y-%m-%d")

            if d_str in daily_map:
                daily_map[d_str]["sales_count"] += 1
                daily_map[d_str]["total_revenue"] += s.total_amount

            for p in s.payments:
                if p.status == "SUCCESS":
                    method = (p.payment_method or "OTHER").upper()
                    if method not in period_payment_totals:
                        period_payment_totals[method] = Decimal("0.00")
                    period_payment_totals[method] += p.amount

                    if d_str in daily_map:
                        day_pms = daily_map[d_str]["payment_methods"]
                        if method not in day_pms:
                            day_pms[method] = Decimal("0.00")
                        day_pms[method] += p.amount

    # Build chronological daily rows with payment method breakdown strings
    daily_rows: List[Dict[str, Any]] = []
    idx = 1
    curr = start_d
    while curr <= end_d:
        d_str = curr.strftime("%Y-%m-%d")
        item = daily_map[d_str]

        # Format individual daily payment breakdown: e.g. Cash: ₹2,000.00; UPI: ₹6,500.00
        parts = []
        for method_key in ["CASH", "UPI", "CARD", "OTHER"]:
            amt = item["payment_methods"].get(method_key, Decimal("0.00"))
            if amt > 0:
                lbl = "Cash" if method_key == "CASH" else ("UPI" if method_key == "UPI" else ("Card" if method_key == "CARD" else "Other"))
                parts.append(f"{lbl}: ₹{amt:,.2f}")
        breakdown_str = "; ".join(parts) if parts else "-"

        daily_rows.append({
            "s_no": idx,
            "date_obj": item["date_obj"],
            "date_str": d_str,
            "sales_count": item["sales_count"],
            "total_revenue": item["total_revenue"],
            "payment_breakdown": breakdown_str,
            "payment_methods": item["payment_methods"]
        })
        idx += 1
        curr += timedelta(days=1)

    # Summary payment breakdown string
    summary_parts = []
    for m in ["CASH", "UPI", "CARD", "OTHER"]:
        amt = period_payment_totals.get(m, Decimal("0.00"))
        if amt > 0:
            lbl = "Cash" if m == "CASH" else ("UPI" if m == "UPI" else ("Card" if m == "CARD" else "Other"))
            summary_parts.append(f"{lbl}: ₹{amt:,.2f}")
    summary_breakdown_str = "; ".join(summary_parts) if summary_parts else "-"

    return {
        "start_d": start_d,
        "end_d": end_d,
        "total_sales": total_sales,
        "total_revenue": total_revenue,
        "payment_methods": period_payment_totals,
        "summary_payment_breakdown": summary_breakdown_str,
        "daily_rows": daily_rows,
        "has_data": total_sales > 0,
    }

def generate_daily_sales_csv(report_data: Dict[str, Any]) -> str:
    """
    Renders filter-aware Daily Sales CSV report adhering to the required columns:
    1. S. No.
    2. Date
    3. Total Sales
    4. Total Revenue
    5. Payment Method Breakdown
    """
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "S. No.",
        "Date",
        "Total Sales",
        "Total Revenue",
        "Payment Method Breakdown"
    ])

    for r in report_data["daily_rows"]:
        date_formatted = r["date_obj"].strftime("%d %b %Y")
        writer.writerow([
            r["s_no"],
            date_formatted,
            r["sales_count"],
            f"₹{r['total_revenue']:,.2f}",
            r["payment_breakdown"]
        ])

    # Reconciled Summary Total Row
    writer.writerow([
        "Total",
        "-",
        report_data["total_sales"],
        f"₹{report_data['total_revenue']:,.2f}",
        report_data["summary_payment_breakdown"]
    ])

    return output.getvalue()


@router.get("/sales/export")
async def export_sales_report(
    from_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    to_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    start_date: Optional[str] = Query(None, description="Alias for from_date"),
    end_date: Optional[str] = Query(None, description="Alias for to_date"),
    stylist_id: Optional[UUID] = Query(None, description="Filter by registered stylist ID"),
    staff_id: Optional[UUID] = Query(None, description="Alias for stylist_id"),
    format: str = Query("pdf", description="Export format: 'pdf' or 'csv'"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.export"))
):
    """
    Exports the currently applied filter date range as a PDF or CSV report.
    Reconciles daily sales counts, revenue totals, and payment breakdowns.
    """
    eff_stylist_id = stylist_id or staff_id
    eff_start = from_date or start_date
    eff_end = to_date or end_date
    start_d, end_d, start_dt, end_dt = parse_date_range(eff_start, eff_end)

    report_data = await get_daily_sales_report_data(
        db=db,
        business_id=current_user.business_id,
        start_d=start_d,
        end_d=end_d,
        start_dt=start_dt,
        end_dt=end_dt,
        stylist_id=eff_stylist_id
    )

    if not report_data["has_data"]:
        raise HTTPException(
            status_code=400,
            detail="No sales data found for the selected date range. Nothing to export."
        )

    export_fmt = format.lower().strip()
    if export_fmt == "csv":
        csv_data = generate_daily_sales_csv(report_data)
        filename = f"trimz-daily-sales-{start_d}-to-{end_d}.csv"
        return Response(
            content=csv_data,
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    elif export_fmt == "pdf":
        # Fetch business information for header branding
        biz_res = await db.execute(
            select(Business).where(Business.id == current_user.business_id)
        )
        biz = biz_res.scalar_one_or_none()

        pdf_payload = {
            "business_name": biz.name if biz else "Trimz Unisex Salon",
            "business_address": f"{biz.address}, {biz.city}, {biz.state} {biz.postal_code}" if biz and biz.address else None,
            "business_phone": biz.phone if biz else None,
            "from_date": start_d.strftime("%Y-%m-%d"),
            "to_date": end_d.strftime("%Y-%m-%d"),
            "total_sales": report_data["total_sales"],
            "total_revenue": report_data["total_revenue"],
            "payment_methods": report_data["payment_methods"],
            "daily_rows": report_data["daily_rows"],
        }
        pdf_bytes = generate_daily_sales_pdf(pdf_payload)
        filename = f"trimz-daily-sales-{start_d}-to-{end_d}.pdf"
        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'}
        )
    else:
        raise HTTPException(status_code=400, detail="Invalid format. Supported formats are 'pdf' and 'csv'.")


@router.get("/export/sales-csv")
async def export_sales_csv(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    from_date: Optional[str] = Query(None, description="Alias for start_date"),
    to_date: Optional[str] = Query(None, description="Alias for end_date"),
    stylist_id: Optional[UUID] = Query(None, description="Filter by registered stylist ID"),
    staff_id: Optional[UUID] = Query(None, description="Alias for stylist_id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.export"))
):
    """Backwards-compatible convenience route for CSV export."""
    return await export_sales_report(
        from_date=from_date,
        to_date=to_date,
        start_date=start_date,
        end_date=end_date,
        stylist_id=stylist_id,
        staff_id=staff_id,
        format="csv",
        db=db,
        current_user=current_user
    )


@router.get("/export/sales-pdf")
async def export_sales_pdf(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    from_date: Optional[str] = Query(None, description="Alias for start_date"),
    to_date: Optional[str] = Query(None, description="Alias for end_date"),
    stylist_id: Optional[UUID] = Query(None, description="Filter by registered stylist ID"),
    staff_id: Optional[UUID] = Query(None, description="Alias for stylist_id"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("reports.export"))
):
    """Convenience route for PDF export."""
    return await export_sales_report(
        from_date=from_date,
        to_date=to_date,
        start_date=start_date,
        end_date=end_date,
        stylist_id=stylist_id,
        staff_id=staff_id,
        format="pdf",
        db=db,
        current_user=current_user
    )
