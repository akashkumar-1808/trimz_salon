import re
from urllib.parse import quote
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
from app.models.service import Service
from app.models.invoice import Invoice
from app.models.whatsapp import WhatsAppMessage
from app.models.auth import User
from app.models.audit import AuditLog
from app.schemas.billing import (
    CheckoutRequest,
    CheckoutResponse,
    SaleOut,
    InvoiceOut,
    WhatsAppDeliveryStatus,
    WhatsAppClickToChat
)
from app.schemas.membership import (
    BillCalculateRequest,
    BillCalculationSummary
)
from app.models.membership import MembershipUsageLedger
from app.services.membership import calculate_membership_benefits
from app.api.deps import require_permission
from app.services.public_invoice import create_public_invoice_token, build_public_invoice_url
# Deferred future feature imports (preserved for on-demand/future releases)
from app.services.whatsapp_dispatcher import get_or_generate_invoice_image, dispatch_invoice_whatsapp

router = APIRouter(prefix="/billing", tags=["Billing & POS Checkout"])

def normalize_whatsapp_phone(phone: Optional[str]) -> Optional[str]:
    """
    Normalizes a phone number to standard international format (digits only, no '+' or spaces).
    For Indian numbers:
    - 10 digits (e.g. 9876543210) -> '919876543210'
    - 11 digits starting with 0 (e.g. 09876543210) -> '919876543210'
    - 12 digits starting with 91 (e.g. 919876543210) -> '919876543210'
    - +91 9876543210 -> '919876543210'
    For other international numbers:
    - 10 to 15 digits not matching Indian 10-digit format -> kept as is (no leading +)
    Invalid length or non-digits -> None
    """
    if not phone:
        return None
    cleaned = re.sub(r"[^\d+]", "", str(phone).strip())
    if cleaned.startswith("+"):
        cleaned = cleaned[1:]
    if not cleaned.isdigit():
        return None

    if len(cleaned) == 10:
        return f"91{cleaned}"
    if len(cleaned) == 11 and cleaned.startswith("0"):
        return f"91{cleaned[1:]}"
    if len(cleaned) == 12 and cleaned.startswith("91"):
        return cleaned
    if 10 <= len(cleaned) <= 15:
        return cleaned
    return None

def generate_whatsapp_receipt_text(
    business: Business,
    sale: Sale,
    invoice: Invoice,
    customer: Customer,
    public_invoice_url: Optional[str] = None
) -> str:
    """
    Builds authoritative, formatted receipt text for WhatsApp click-to-chat.
    """
    biz_name = (business.name or "TRiMZ Unisex Salon").strip()
    cust_name = (customer.name or "Valued Guest").strip()
    created_time = sale.created_at.strftime("%d %b %Y, %I:%M %p") if sale.created_at else ""

    lines = [
        f"✨ *{biz_name.upper()}* ✨",
        "━━━━━━━━━━━━━━━━━━━━",
        f"📄 *Invoice #:* {invoice.invoice_number}",
    ]
    if created_time:
        lines.append(f"📅 *Date:* {created_time}")
    lines.append(f"👤 *Customer:* {cust_name}")
    if sale.staff_name:
        lines.append(f"✂️ *Stylist:* {sale.staff_name.strip()}")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("*Services & Products:*")
    for item in sale.items:
        qty_str = f" x{item.quantity}" if item.quantity > 1 else ""
        comp_str = " (FREE VIP Perk)" if getattr(item, "is_complimentary", False) else ""
        lines.append(f"• {item.service_name_snapshot}{qty_str}{comp_str} — ₹{item.total_price:,.2f}")

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append(f"Subtotal: ₹{sale.subtotal:,.2f}")
    if getattr(sale, "membership_snapshot", None):
        plan_title = sale.membership_snapshot.get("name", "VIP Membership")
        lines.append(f"⭐ VIP Member: {plan_title}")
    if getattr(sale, "membership_discount_amount", None) and sale.membership_discount_amount > 0:
        lines.append(f"VIP Member Savings: -₹{sale.membership_discount_amount:,.2f}")
    if sale.discount_amount and sale.discount_amount > 0:
        disc_reason = f" ({sale.discount_reason})" if sale.discount_reason else ""
        lines.append(f"Discount{disc_reason}: -₹{sale.discount_amount:,.2f}")
    if sale.tax_amount and sale.tax_amount > 0:
        tax_label = f"{business.tax_name or 'GST'} ({sale.tax_percentage}%)"
        lines.append(f"{tax_label}: ₹{sale.tax_amount:,.2f}")

    lines.append(f"*Final Total:* ₹{sale.total_amount:,.2f}")

    if sale.payments:
        pm_parts = []
        for p in sale.payments:
            provider = f" ({p.payment_provider})" if p.payment_provider else ""
            pm_parts.append(f"{p.payment_method}{provider}")
        pm_str = ", ".join(pm_parts)
        lines.append(f"Payment Mode: {pm_str} — *PAID*")
    else:
        lines.append("Payment Status: *PAID*")

    if public_invoice_url:
        lines.append("━━━━━━━━━━━━━━━━━━━━")
        lines.append("🔗 *View Digital Invoice:*")
        lines.append(public_invoice_url)

    lines.append("━━━━━━━━━━━━━━━━━━━━")
    lines.append("Thank you for choosing Trimz Salon! See you again soon.")

    return "\n".join(lines)

def build_whatsapp_click_to_chat(
    phone: Optional[str],
    receipt_text: str,
    requested: bool
) -> tuple[Optional[str], WhatsAppClickToChat]:
    normalized = normalize_whatsapp_phone(phone)
    if not normalized:
        return None, WhatsAppClickToChat(
            enabled=False,
            phone=None,
            url=None,
            message=None
        )

    encoded_text = quote(receipt_text)
    wa_url = f"https://wa.me/{normalized}?text={encoded_text}"

    return (wa_url if requested else None), WhatsAppClickToChat(
        enabled=requested,
        phone=normalized,
        url=wa_url,
        message=receipt_text
    )

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

@router.post("/calculate", response_model=BillCalculationSummary)
async def calculate_bill(
    data: BillCalculateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.create"))
):
    """
    Authoritative server-side calculation for POS bill preview.
    Evaluates catalogue prices, eligible customer membership benefits,
    complimentary services, usage limits, manual discounts, and tax.
    """
    if not data.items:
        raise HTTPException(status_code=400, detail="Cannot calculate bill for empty cart")
    
    summary = await calculate_membership_benefits(
        db=db,
        business_id=current_user.business_id,
        customer_phone=data.customer_phone,
        customer_id=data.customer_id,
        items_in=data.items,
        overall_discount=data.overall_discount,
        discount_reason=data.discount_reason,
        apply_tax=data.apply_tax,
        for_checkout=False
    )
    return summary

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
            # Safely create or get public invoice token
            token_rec, raw_token = await create_public_invoice_token(db, inv)
            await db.commit()
            public_url = build_public_invoice_url(raw_token)

            # Determine if WhatsApp opening was requested
            should_open_wa = data.open_whatsapp if data.open_whatsapp is not None else data.send_whatsapp
            wa_receipt_text = generate_whatsapp_receipt_text(business, existing, inv, cust, public_invoice_url=public_url)
            wa_url, wa_c2c = build_whatsapp_click_to_chat(cust.phone, wa_receipt_text, should_open_wa)

            receipt = generate_thermal_receipt_text(business, existing, inv, cust)
            return CheckoutResponse(
                success=True,
                sale=SaleOut.model_validate(existing),
                invoice=InvoiceOut.model_validate(inv),
                receipt_text=receipt,
                whatsapp_url=wa_url,
                whatsapp_click_to_chat=wa_c2c,
                public_invoice_url=public_url,
                public_invoice_token=raw_token,
                whatsapp_delivery=None
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

    # 3. Authoritative Server-Side Calculation (Concurrency-Safe with Membership Row Lock)
    calc_summary = await calculate_membership_benefits(
        db=db,
        business_id=current_user.business_id,
        customer_phone=customer.phone,
        customer_id=customer.id,
        items_in=data.items,
        overall_discount=data.overall_discount,
        discount_reason=data.discount_reason,
        apply_tax=data.apply_tax,
        for_checkout=True
    )

    subtotal = calc_summary.subtotal
    membership_discount = calc_summary.total_membership_discount
    manual_discount = calc_summary.total_manual_discount
    taxable_amount = calc_summary.taxable_amount
    tax_percentage = calc_summary.tax_percentage
    tax_amount = calc_summary.tax_amount
    grand_total = calc_summary.grand_total
    membership_applied = calc_summary.membership_applied

    customer_membership_id = UUID(membership_applied["id"]) if membership_applied and membership_applied.get("id") else None

    # 4. Stylist / Staff Lookup and Validation against Business
    stylist_user = None
    if data.staff_id:
        st_res = await db.execute(
            select(User).where(
                User.id == data.staff_id,
                User.business_id == current_user.business_id
            )
        )
        stylist_user = st_res.scalar_one_or_none()
        if not stylist_user:
            raise HTTPException(status_code=400, detail="Selected stylist does not belong to this business")
    elif data.staff_name and data.staff_name.strip():
        st_res = await db.execute(
            select(User).where(
                User.business_id == current_user.business_id,
                func.lower(User.name) == data.staff_name.strip().lower()
            )
        )
        stylist_user = st_res.scalars().first()

    final_staff_id = stylist_user.id if stylist_user else None
    final_staff_name = stylist_user.name if stylist_user else (data.staff_name.strip() if data.staff_name else None)

    # 5. Generate Sequential Numbers
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

    # 6. Create Authoritative Sale with Membership Snapshot
    new_sale = Sale(
        business_id=current_user.business_id,
        customer_id=customer.id,
        customer_membership_id=customer_membership_id,
        operator_id=current_user.id,
        staff_id=final_staff_id,
        staff_name=final_staff_name,
        sale_number=sale_number,
        client_request_id=idempotency_key,
        status="COMPLETED",
        subtotal=subtotal,
        discount_amount=manual_discount,
        discount_reason=data.discount_reason,
        membership_discount_amount=membership_discount,
        membership_snapshot=membership_applied,
        tax_amount=tax_amount,
        tax_percentage=tax_percentage,
        total_amount=grand_total,
        notes=data.notes
    )
    db.add(new_sale)
    await db.flush()

    # 6. Create Sale Items and Durable Membership Usage Ledger
    for item_calc in calc_summary.items:
        sale_item = SaleItem(
            sale_id=new_sale.id,
            service_id=item_calc.service_id,
            item_type=item_calc.item_type,
            service_name_snapshot=item_calc.name,
            unit_price_snapshot=item_calc.catalogue_price,
            quantity=item_calc.quantity,
            discount_amount=item_calc.membership_discount + item_calc.manual_discount,
            membership_discount_amount=item_calc.membership_discount,
            membership_benefit_id=item_calc.benefit_id,
            is_complimentary=item_calc.is_complimentary,
            tax_amount=Decimal("0.00"),
            total_price=item_calc.line_total,
            commission_rate_snapshot=Decimal("0.00")
        )
        db.add(sale_item)
        await db.flush()

        # Record usage ledger if benefit consumed
        if customer_membership_id and (item_calc.benefit_id or item_calc.is_complimentary or item_calc.membership_discount > Decimal("0.00")):
            ledger_entry = MembershipUsageLedger(
                business_id=current_user.business_id,
                membership_id=customer_membership_id,
                benefit_id=item_calc.benefit_id,
                benefit_name=item_calc.benefit_name or "VIP Membership Perk",
                benefit_type="COMPLIMENTARY_SERVICE" if item_calc.is_complimentary else "DISCOUNT",
                sale_id=new_sale.id,
                sale_item_id=sale_item.id,
                quantity_used=item_calc.quantity,
                discount_applied=item_calc.membership_discount,
                is_reversal=False
            )
            db.add(ledger_entry)

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
        discount_amount=manual_discount + membership_discount,
        tax_amount=tax_amount,
        total_amount=grand_total,
        currency=business.currency
    )
    db.add(new_invoice)
    await db.flush()

    # Generate public invoice token and hash
    token_rec, raw_token = await create_public_invoice_token(db, new_invoice)
    public_url = build_public_invoice_url(raw_token)

    # 8. Update Customer Cache
    customer.total_visits = (customer.total_visits or 0) + 1
    current_spend = Decimal(str(customer.total_spend or "0.00"))
    customer.total_spend = current_spend + grand_total
    customer.loyalty_points = (customer.loyalty_points or 0) + int(grand_total // 100)
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

    # 10. Prepare WhatsApp Click-to-Chat with Digital Web Invoice Link
    should_open_wa = data.open_whatsapp if data.open_whatsapp is not None else data.send_whatsapp
    wa_receipt_text = generate_whatsapp_receipt_text(business, new_sale, new_invoice, customer, public_invoice_url=public_url)
    wa_url, wa_c2c = build_whatsapp_click_to_chat(customer.phone, wa_receipt_text, should_open_wa)

    receipt = generate_thermal_receipt_text(business, new_sale, new_invoice, customer)

    return CheckoutResponse(
        success=True,
        sale=SaleOut.model_validate(new_sale),
        invoice=InvoiceOut.model_validate(new_invoice),
        receipt_text=receipt,
        whatsapp_url=wa_url,
        whatsapp_click_to_chat=wa_c2c,
        public_invoice_url=public_url,
        public_invoice_token=raw_token,
        whatsapp_delivery=None
    )

@router.get("/sales", response_model=List[SaleOut])
async def list_sales(
    search: Optional[str] = None,
    status: Optional[str] = None,
    stylist_id: Optional[UUID] = None,
    staff_id: Optional[UUID] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    eff_stylist_id = stylist_id or staff_id
    stmt = (
        select(Sale)
        .where(Sale.business_id == current_user.business_id)
        .order_by(Sale.created_at.desc())
    )
    if eff_stylist_id:
        stmt = stmt.where(Sale.staff_id == eff_stylist_id)
    if status:
        stmt = stmt.where(Sale.status == status)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.join(Customer, Sale.customer_id == Customer.id, isouter=True).where(
            or_(
                Sale.sale_number.ilike(s),
                Customer.name.ilike(s),
                Customer.phone.ilike(s),
                Sale.staff_name.ilike(s)
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
