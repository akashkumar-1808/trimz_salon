from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_
from app.core.database import get_db
from app.models.business import Business
from app.models.customer import Customer
from app.models.sale import Sale, SaleItem, Payment
from app.models.invoice import Invoice
from app.models.auth import User
from app.models.audit import AuditLog
from app.schemas.billing import CheckoutRequest, CheckoutResponse, SaleOut, InvoiceOut
from app.api.deps import require_permission

router = APIRouter(prefix="/billing", tags=["Billing & POS Checkout"])

def generate_thermal_receipt_text(business: Business, sale: Sale, invoice: Invoice, customer: Customer) -> str:
    lines = [
        "================================",
        f"        {business.name.upper()}        ",
        "        UNISEX SALON        ",
        "================================",
        f"Invoice: {invoice.invoice_number}",
        f"Date:    {sale.created_at.strftime('%Y-%m-%d %I:%M %p')}",
        f"Customer:{customer.name} ({customer.phone})",
        f"Stylist: {sale.staff_name or 'Team Member'}",
        "--------------------------------",
        "Item                 Qty  Amount",
        "--------------------------------"
    ]
    for item in sale.items:
        name = item.service_name_snapshot[:18].ljust(18)
        qty = str(item.quantity).rjust(3)
        amt = f"₹{item.total_price:,.2f}".rjust(8)
        lines.append(f"{name} {qty} {amt}")

    lines.extend([
        "--------------------------------",
        f"Subtotal:             ₹{sale.subtotal:,.2f}",
        f"Discount:            -₹{sale.discount_amount:,.2f}",
        f"{business.tax_name} ({sale.tax_percentage}%):       ₹{sale.tax_amount:,.2f}" if sale.tax_amount > 0 else f"{business.tax_name}:               Not applied",
        "================================",
        f"TOTAL PAID:           ₹{sale.total_amount:,.2f}",
        "================================"
    ])
    for p in sale.payments:
        provider = f" ({p.payment_provider})" if p.payment_provider else ""
        lines.append(f"Payment Mode: {p.payment_method}{provider}")
    
    lines.extend([
        "",
        "      Thank you for visiting!   ",
        "    We look forward to seeing   ",
        "        you again soon.         ",
        "================================"
    ])
    return "\n".join(lines)

@router.post("/checkout", response_model=CheckoutResponse, status_code=status.HTTP_201_CREATED)
async def checkout(
    data: CheckoutRequest,
    idempotency_key: Optional[str] = Header(None, alias="Idempotency-Key"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.create"))
):
    if not data.items:
        raise HTTPException(status_code=400, detail="Cannot checkout an empty cart")

    # Fetch Business Profile
    biz_res = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = biz_res.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=500, detail="Business profile not found")

    # 1. Check Idempotency Key
    if idempotency_key:
        existing_sale = await db.execute(
            select(Sale).where(
                Sale.business_id == current_user.business_id,
                Sale.client_request_id == idempotency_key
            )
        )
        existing = existing_sale.scalar_one_or_none()
        if existing:
            # Return existing sale
            inv_res = await db.execute(select(Invoice).where(Invoice.sale_id == existing.id))
            inv = inv_res.scalar_one()
            cust_res = await db.execute(select(Customer).where(Customer.id == existing.customer_id))
            cust = cust_res.scalar_one()
            receipt = generate_thermal_receipt_text(business, existing, inv, cust)
            return CheckoutResponse(
                success=True,
                sale=SaleOut.model_validate(existing),
                invoice=InvoiceOut.model_validate(inv),
                receipt_text=receipt
            )

    # 2. Customer Lookup or Upsert
    clean_phone = data.customer_phone.strip()
    cust_res = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.phone == clean_phone
        )
    )
    customer = cust_res.scalar_one_or_none()
    
    if not customer:
        customer = Customer(
            business_id=current_user.business_id,
            name=data.customer_name.strip() if data.customer_name else "Walk-in Guest",
            phone=clean_phone
        )
        db.add(customer)
        await db.flush()
    elif data.customer_name and data.customer_name.strip() and customer.name != data.customer_name.strip():
        customer.name = data.customer_name.strip()

    # 3. Cart & Historical Snapshots Calculation
    subtotal = Decimal("0.00")
    items_to_create = []

    for item_in in data.items:
        line_sub = Decimal(str(item_in.unit_price)) * Decimal(str(item_in.quantity))
        line_disc = Decimal(str(item_in.discount_amount))
        line_total = max(Decimal("0.00"), line_sub - line_disc)
        subtotal += line_total

        sale_item = SaleItem(
            service_id=item_in.service_id,
            item_type=item_in.item_type,
            service_name_snapshot=item_in.name.strip(),
            unit_price_snapshot=Decimal(str(item_in.unit_price)),
            quantity=item_in.quantity,
            discount_amount=line_disc,
            tax_amount=Decimal("0.00"),
            total_price=line_total,
            commission_rate_snapshot=Decimal(str(item_in.commission_rate))
        )
        items_to_create.append(sale_item)

    overall_disc = Decimal(str(data.overall_discount))
    taxable_amount = max(Decimal("0.00"), subtotal - overall_disc)
    
    tax_percentage = Decimal(str(business.default_tax_rate)) if data.apply_tax else Decimal("0.00")
    tax_amount = round(taxable_amount * tax_percentage / Decimal("100.00"), 2)
    grand_total = taxable_amount + tax_amount

    # 4. Generate Sequential Numbers
    now_utc = datetime.now(timezone.utc)
    date_str = now_utc.strftime("%Y%m%d")
    month_str = now_utc.strftime("%Y%m")

    # Count today's sales for sequence
    count_res = await db.execute(
        select(func.count(Sale.id)).where(Sale.business_id == current_user.business_id)
    )
    total_sales_count = (count_res.scalar() or 0) + 1

    sale_number = f"{business.bill_prefix}-{date_str}-{total_sales_count:04d}"
    invoice_number = f"TRIMZ-{month_str}-{total_sales_count:04d}"

    # 5. Create Sale
    new_sale = Sale(
        business_id=current_user.business_id,
        customer_id=customer.id,
        operator_id=current_user.id,
        sale_number=sale_number,
        client_request_id=idempotency_key,
        status="COMPLETED",
        subtotal=subtotal,
        discount_amount=overall_disc,
        discount_reason=data.discount_reason,
        tax_amount=tax_amount,
        tax_percentage=tax_percentage,
        total_amount=grand_total,
        staff_name=data.staff_name,
        notes=data.notes
    )
    db.add(new_sale)
    await db.flush()

    for item in items_to_create:
        item.sale_id = new_sale.id
        db.add(item)

    # 6. Record Payments
    payments_to_create = []
    if data.payments:
        for p in data.payments:
            pm = Payment(
                business_id=current_user.business_id,
                sale_id=new_sale.id,
                amount=Decimal(str(p.amount)),
                payment_method=p.payment_method,
                payment_provider=p.payment_provider,
                status="SUCCESS",
                transaction_reference=p.transaction_reference,
                notes=p.notes
            )
            db.add(pm)
            payments_to_create.append(pm)
    else:
        # Default single payment
        pm = Payment(
            business_id=current_user.business_id,
            sale_id=new_sale.id,
            amount=grand_total,
            payment_method="UPI",
            payment_provider="PhonePe",
            status="SUCCESS"
        )
        db.add(pm)
        payments_to_create.append(pm)

    # 7. Create Invoice
    new_invoice = Invoice(
        business_id=current_user.business_id,
        sale_id=new_sale.id,
        invoice_number=invoice_number,
        status="ISSUED",
        subtotal=subtotal,
        discount_amount=overall_disc,
        tax_amount=tax_amount,
        total_amount=grand_total,
        currency=business.currency
    )
    db.add(new_invoice)

    # 8. Update Customer Cache
    customer.total_visits += 1
    customer.total_spend += grand_total
    customer.loyalty_points += int(grand_total // 100)
    customer.last_visit_at = now_utc

    # 9. Audit Log
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SALE_COMPLETED",
        entity_name="sale",
        entity_id=new_sale.id,
        details={
            "sale_number": sale_number,
            "invoice_number": invoice_number,
            "amount": str(grand_total),
            "customer": customer.name
        }
    ))

    await db.commit()
    await db.refresh(new_sale)
    await db.refresh(new_invoice)

    receipt = generate_thermal_receipt_text(business, new_sale, new_invoice, customer)

    return CheckoutResponse(
        success=True,
        sale=SaleOut.model_validate(new_sale),
        invoice=InvoiceOut.model_validate(new_invoice),
        receipt_text=receipt
    )

@router.get("/sales", response_model=List[SaleOut])
async def list_sales(
    search: Optional[str] = None,
    status: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    stmt = (
        select(Sale)
        .where(Sale.business_id == current_user.business_id)
        .order_by(Sale.created_at.desc())
    )
    if status:
        stmt = stmt.where(Sale.status == status)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.join(Customer, Sale.customer_id == Customer.id, isouter=True).where(
            or_(
                Sale.sale_number.ilike(s),
                Customer.name.ilike(s),
                Customer.phone.ilike(s)
            )
        )
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/sales/{sale_id}", response_model=SaleOut)
async def get_sale(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    result = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.id == sale_id
        )
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    return sale

@router.get("/sales/{sale_id}/receipt")
async def get_sale_receipt(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    result = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.id == sale_id
        )
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    biz_res = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = biz_res.scalar_one_or_none()
    
    cust_res = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
    customer = cust_res.scalar_one_or_none()
    
    inv_res = await db.execute(select(Invoice).where(Invoice.sale_id == sale.id))
    invoice = inv_res.scalar_one_or_none()

    receipt_text = generate_thermal_receipt_text(business, sale, invoice, customer)
    return {"receipt_text": receipt_text}

@router.post("/sales/{sale_id}/cancel", response_model=SaleOut)
async def cancel_sale(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.cancel"))
):
    result = await db.execute(
        select(Sale).where(
            Sale.business_id == current_user.business_id,
            Sale.id == sale_id
        )
    )
    sale = result.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    if sale.status == "CANCELLED":
        raise HTTPException(status_code=400, detail="Sale has already been cancelled")

    sale.status = "CANCELLED"

    # Void associated invoice
    inv_res = await db.execute(select(Invoice).where(Invoice.sale_id == sale.id))
    invoice = inv_res.scalar_one_or_none()
    if invoice:
        invoice.status = "VOID"

    # Mark payments as refunded
    pm_res = await db.execute(select(Payment).where(Payment.sale_id == sale.id))
    payments = pm_res.scalars().all()
    for p in payments:
        p.status = "REFUNDED"

    # Revert customer metrics
    cust_res = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
    customer = cust_res.scalar_one_or_none()
    if customer:
        customer.total_visits = max(0, customer.total_visits - 1)
        customer.total_spend = max(Decimal("0.00"), customer.total_spend - sale.total_amount)
        points_to_revert = int(sale.total_amount // 100)
        customer.loyalty_points = max(0, customer.loyalty_points - points_to_revert)

    # Audit log
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SALE_CANCELLED",
        entity_name="sale",
        entity_id=sale.id,
        details={
            "sale_number": sale.sale_number,
            "refunded_amount": str(sale.total_amount)
        }
    ))

    await db.commit()
    await db.refresh(sale)
    return sale
