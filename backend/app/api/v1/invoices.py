from decimal import Decimal
from pathlib import Path
from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import FileResponse, HTMLResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, delete
from app.core.database import get_db
from app.models.invoice import Invoice, PublicInvoiceToken
from app.models.sale import Sale, SaleItem, Payment
from app.models.customer import Customer
from app.models.auth import User
from app.models.business import Business
from app.models.whatsapp import WhatsAppMessage
from app.models.membership import MembershipUsageLedger
from app.models.audit import AuditLog
from app.api.v1.billing import generate_thermal_receipt_text, generate_whatsapp_receipt_text, build_whatsapp_click_to_chat
from app.services.public_invoice import create_public_invoice_token, build_public_invoice_url
from app.schemas.billing import InvoiceOut, SaleOut
from app.api.deps import require_permission, get_current_user
from app.services.whatsapp_dispatcher import get_or_generate_invoice_image, dispatch_invoice_whatsapp

router = APIRouter(prefix="/invoices", tags=["Invoicing"])

from sqlalchemy.orm import selectinload

@router.get("", response_model=List[InvoiceOut])
@router.get("/", response_model=List[InvoiceOut], include_in_schema=False)
async def list_invoices(
    search: Optional[str] = None,
    stylist_id: Optional[UUID] = None,
    staff_id: Optional[UUID] = None,
    staff_name: Optional[str] = None,
    limit: int = 500,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    eff_stylist_id = stylist_id or staff_id
    stmt = (
        select(Invoice)
        .join(Sale, Invoice.sale_id == Sale.id)
        .options(
            selectinload(Invoice.sale).selectinload(Sale.customer),
            selectinload(Invoice.sale).selectinload(Sale.operator),
            selectinload(Invoice.sale).selectinload(Sale.staff)
        )
        .where(Invoice.business_id == current_user.business_id)
        .order_by(Invoice.created_at.desc())
    )
    if eff_stylist_id:
        stmt = stmt.where(Sale.staff_id == eff_stylist_id)
    if staff_name:
        stmt = stmt.where(Sale.staff_name.ilike(f"%{staff_name.strip()}%"))
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.join(Customer, Sale.customer_id == Customer.id, isouter=True).where(
            or_(
                Invoice.invoice_number.ilike(s),
                Sale.sale_number.ilike(s),
                Customer.name.ilike(s),
                Customer.phone.ilike(s),
                Sale.staff_name.ilike(s)
            )
        )
    stmt = stmt.limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.get("/{invoice_id}", response_model=InvoiceOut)
async def get_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.business_id == current_user.business_id,
            Invoice.id == invoice_id
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv

@router.get("/by-sale/{sale_id}", response_model=InvoiceOut)
async def get_invoice_by_sale(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.business_id == current_user.business_id,
            Invoice.sale_id == sale_id
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found for this sale")
    return inv

@router.get("/{invoice_id}/receipt")
async def get_invoice_receipt(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    result = await db.execute(
        select(Invoice).where(
            Invoice.business_id == current_user.business_id,
            Invoice.id == invoice_id
        )
    )
    inv = result.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    sale_res = await db.execute(
        select(Sale).where(Sale.id == inv.sale_id)
    )
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Sale not found for invoice")

    biz_res = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = biz_res.scalar_one_or_none()

    customer = sale.customer
    stylist_name = sale.staff_name or (sale.operator.name if sale.operator else "Team Member")
    receipt_text = generate_thermal_receipt_text(business, sale, inv, customer)

    items = [
        {
            "service_name": it.service_name_snapshot,
            "stylist": stylist_name,
            "quantity": it.quantity,
            "unit_price": float(it.unit_price_snapshot)
        }
        for it in sale.items
    ]

    payment_method = sale.payments[0].payment_method if sale.payments else "UPI"
    payment_provider = sale.payments[0].payment_provider if sale.payments else None

    return {
        "business": {
            "name": business.name if business else "Trimz Salon",
            "address": business.address if business else "",
            "phone": business.phone if business else "",
            "gstin": business.tax_registration_number if business else None
        },
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "sale_number": sale.sale_number,
        "created_at": inv.created_at,
        "customer_name": customer.name if customer else "Walk-in Guest",
        "customer_phone": customer.phone if customer else "",
        "stylist": stylist_name,
        "staff_name": stylist_name,
        "staff_id": sale.staff_id,
        "items": items,
        "subtotal": float(inv.subtotal),
        "discount_amount": float(inv.discount_amount),
        "tax_amount": float(inv.tax_amount),
        "total_amount": float(inv.total_amount),
        "payment_method": payment_method,
        "payment_provider": payment_provider,
        "receipt_text": receipt_text
    }

@router.get("/{invoice_id}/image")
async def get_invoice_image(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        image_path = await get_or_generate_invoice_image(inv, db)
        await db.commit()
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to generate invoice image: {str(ex)}")

    safe_name = inv.invoice_number.replace("/", "_") + ".png"
    return FileResponse(
        path=image_path,
        media_type="image/png",
        filename=safe_name,
        headers={"Cache-Control": "public, max-age=86400"}
    )

@router.get("/{invoice_id}/print", response_class=HTMLResponse)
async def get_invoice_print_page(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    try:
        await get_or_generate_invoice_image(inv, db)
        await db.commit()
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to render invoice image: {str(ex)}")

    img_src = f"/api/v1/invoices/{inv.id}/image"

    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Invoice {inv.invoice_number} — TRIMZ Unisex Salon</title>
  <style>
    @page {{
      size: A4 portrait;
      margin: 0;
    }}
    body {{
      margin: 0;
      padding: 0;
      background: #121212;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }}
    .print-bar {{
      position: fixed;
      top: 16px;
      display: flex;
      gap: 12px;
      z-index: 100;
      background: rgba(24, 24, 27, 0.9);
      padding: 8px 16px;
      border-radius: 999px;
      border: 1px solid rgba(255, 255, 255, 0.1);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }}
    .btn {{
      padding: 8px 18px;
      border-radius: 999px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }}
    .btn-print {{
      background: #c20018;
      color: #fff;
    }}
    .btn-print:hover {{
      background: #e1001e;
    }}
    .btn-close {{
      background: #27272a;
      color: #a1a1aa;
    }}
    .btn-close:hover {{
      color: #fff;
    }}
    .invoice-card {{
      background: #fff;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      margin: 60px auto 20px;
      max-width: 800px;
      width: 100%;
    }}
    .invoice-img {{
      width: 100%;
      height: auto;
      display: block;
    }}
    @media print {{
      body {{
        background: transparent !important;
      }}
      .print-bar {{
        display: none !important;
      }}
      .invoice-card {{
        margin: 0 !important;
        box-shadow: none !important;
        max-width: 100% !important;
        width: 100% !important;
      }}
    }}
  </style>
</head>
<body>
  <div class="print-bar">
    <button class="btn btn-print" onclick="window.print()">🖨️ Print Invoice</button>
    <button class="btn btn-close" onclick="window.close()">Close</button>
  </div>
  <div class="invoice-card">
    <img src="{img_src}" alt="Invoice {inv.invoice_number}" class="invoice-img" />
  </div>
</body>
</html>"""
    return HTMLResponse(content=html_content)

@router.post("/{invoice_id}/whatsapp/send")
async def send_invoice_whatsapp(
    invoice_id: UUID,
    force_resend: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.create"))
):
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    result = await dispatch_invoice_whatsapp(
        invoice_id=invoice_id,
        db=db,
        force_resend=force_resend
    )
    return result

@router.get("/{invoice_id}/whatsapp/status")
async def get_invoice_whatsapp_status(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    msg_res = await db.execute(
        select(WhatsAppMessage)
        .where(
            WhatsAppMessage.invoice_id == invoice_id,
            WhatsAppMessage.business_id == current_user.business_id
        )
        .order_by(WhatsAppMessage.created_at.desc())
    )
    msg = msg_res.scalars().first()

    if not msg:
        return {
            "status": "NOT_QUEUED",
            "recipient_phone": inv.customer_phone or "",
            "message_id": None,
            "retry_count": 0,
            "error": None
        }

    return {
        "id": msg.id,
        "status": msg.status,
        "recipient_phone": msg.recipient_phone,
        "message_id": msg.meta_message_id,
        "retry_count": msg.retry_count,
        "sent_at": msg.sent_at,
        "delivered_at": msg.delivered_at,
        "read_at": msg.read_at,
        "error": msg.error_message,
        "created_at": msg.created_at
    }

@router.post("/{invoice_id}/public-link")
async def create_or_get_public_invoice_link(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    """
    Safely generates or retrieves a shareable digital invoice web link
    for an existing invoice without charging or modifying sale/payment data.
    """
    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    inv = inv_res.scalar_one_or_none()
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")

    token_rec, raw_token = await create_public_invoice_token(db, inv)
    await db.commit()
    public_url = build_public_invoice_url(raw_token)

    sale_res = await db.execute(select(Sale).where(Sale.id == inv.sale_id))
    sale = sale_res.scalar_one_or_none()
    customer = sale.customer if sale else None

    biz_res = await db.execute(select(Business).where(Business.id == current_user.business_id))
    business = biz_res.scalar_one_or_none()

    wa_url = None
    if customer and business and sale:
        wa_receipt_text = generate_whatsapp_receipt_text(business, sale, inv, customer, public_invoice_url=public_url)
        wa_url, _ = build_whatsapp_click_to_chat(customer.phone, wa_receipt_text, requested=True)

    return {
        "invoice_id": inv.id,
        "invoice_number": inv.invoice_number,
        "public_token": raw_token,
        "public_url": public_url,
        "whatsapp_url": wa_url
    }

def check_is_admin(user: User) -> bool:
    """Verifies that the user has genuine administrator / salon owner privileges."""
    if not user:
        return False
    if getattr(user, "is_owner", False):
        return True
    user_roles = [getattr(r, "name", "").lower() for r in getattr(user, "roles", []) if hasattr(r, "name")]
    return "owner" in user_roles or "admin" in user_roles

async def perform_delete_invoice(db: AsyncSession, invoice: Invoice, current_user: User) -> dict:
    """
    Performs clean transactional cascade deletion of an invoice and its related records:
    - Public invoice tokens
    - WhatsApp messages
    - Invoice record
    - Membership usage ledger entries
    - Payments
    - Sale items
    - Sale record
    - Reverts customer lifetime spend, visit count, and loyalty points
    - Records AuditLog entry
    """
    sale_id = invoice.sale_id
    invoice_number = invoice.invoice_number
    invoice_id = invoice.id
    total_amount = float(invoice.total_amount or 0.0)

    # 1. Fetch associated Sale
    sale_res = await db.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.business_id == current_user.business_id
        )
    )
    sale = sale_res.scalar_one_or_none()
    sale_number = sale.sale_number if sale else None

    # 2. Adjust Customer Statistics if sale was associated with a customer
    if sale and sale.customer_id:
        cust_res = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
        customer = cust_res.scalar_one_or_none()
        if customer:
            sale_total = Decimal(str(sale.total_amount or "0.00"))
            curr_spend = Decimal(str(customer.total_spend or "0.00"))
            customer.total_spend = max(Decimal("0.00"), curr_spend - sale_total)
            customer.total_visits = max(0, (customer.total_visits or 1) - 1)
            pts = int(sale_total // Decimal("100.00"))
            customer.loyalty_points = max(0, (customer.loyalty_points or 0) - pts)

    # 3. Delete Public Invoice Tokens
    await db.execute(
        delete(PublicInvoiceToken).where(PublicInvoiceToken.invoice_id == invoice_id)
    )

    # 4. Delete WhatsApp Messages linked to Invoice
    await db.execute(
        delete(WhatsAppMessage).where(WhatsAppMessage.invoice_id == invoice_id)
    )

    # 5. Delete Invoice record
    await db.execute(
        delete(Invoice).where(Invoice.id == invoice_id)
    )

    if sale:
        # 6. Delete Membership Usage Ledger entries linked to this Sale
        await db.execute(
            delete(MembershipUsageLedger).where(MembershipUsageLedger.sale_id == sale.id)
        )

        # 7. Delete Payments linked to this Sale
        await db.execute(
            delete(Payment).where(Payment.sale_id == sale.id)
        )

        # 8. Delete Sale Items linked to this Sale
        await db.execute(
            delete(SaleItem).where(SaleItem.sale_id == sale.id)
        )

        # 9. Delete Sale record
        await db.execute(
            delete(Sale).where(Sale.id == sale.id)
        )

    # 10. Audit Log Entry
    audit = AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="DELETE",
        entity_name="invoice",
        entity_id=invoice_id,
        details={
            "invoice_number": invoice_number,
            "sale_number": sale_number,
            "deleted_total_amount": total_amount,
            "deleted_by": current_user.email,
            "deleted_by_name": current_user.name
        }
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "message": f"Invoice {invoice_number} and all associated transaction records successfully deleted.",
        "deleted_invoice_id": str(invoice_id),
        "invoice_number": invoice_number
    }

@router.delete("/{invoice_id}")
async def delete_invoice(
    invoice_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an invoice and all its underlying transaction data.
    STRICTLY RESTRICTED TO ADMIN / OWNER ONLY.
    Staff members are never allowed to delete invoices.
    """
    if not check_is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required. Only salon administrators/owners can delete invoices."
        )

    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.id == invoice_id,
            Invoice.business_id == current_user.business_id
        )
    )
    invoice = inv_res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")

    return await perform_delete_invoice(db, invoice, current_user)

@router.delete("/by-sale/{sale_id}")
async def delete_invoice_by_sale(
    sale_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Deletes an invoice/transaction by its associated sale_id.
    STRICTLY RESTRICTED TO ADMIN / OWNER ONLY.
    """
    if not check_is_admin(current_user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required. Only salon administrators/owners can delete invoices."
        )

    inv_res = await db.execute(
        select(Invoice).where(
            Invoice.sale_id == sale_id,
            Invoice.business_id == current_user.business_id
        )
    )
    invoice = inv_res.scalar_one_or_none()
    if invoice:
        return await perform_delete_invoice(db, invoice, current_user)

    # If invoice doesn't exist but sale exists:
    sale_res = await db.execute(
        select(Sale).where(
            Sale.id == sale_id,
            Sale.business_id == current_user.business_id
        )
    )
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise HTTPException(status_code=404, detail="Transaction not found")

    # Clean up standalone sale
    if sale.customer_id:
        cust_res = await db.execute(select(Customer).where(Customer.id == sale.customer_id))
        customer = cust_res.scalar_one_or_none()
        if customer:
            sale_total = Decimal(str(sale.total_amount or "0.00"))
            curr_spend = Decimal(str(customer.total_spend or "0.00"))
            customer.total_spend = max(Decimal("0.00"), curr_spend - sale_total)
            customer.total_visits = max(0, (customer.total_visits or 1) - 1)
            pts = int(sale_total // Decimal("100.00"))
            customer.loyalty_points = max(0, (customer.loyalty_points or 0) - pts)

    await db.execute(delete(MembershipUsageLedger).where(MembershipUsageLedger.sale_id == sale.id))
    await db.execute(delete(Payment).where(Payment.sale_id == sale.id))
    await db.execute(delete(SaleItem).where(SaleItem.sale_id == sale.id))
    await db.execute(delete(Sale).where(Sale.id == sale.id))

    audit = AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="DELETE",
        entity_name="sale",
        entity_id=sale.id,
        details={
            "sale_number": sale.sale_number,
            "deleted_total_amount": float(sale.total_amount),
            "deleted_by": current_user.email,
        }
    )
    db.add(audit)
    await db.commit()

    return {
        "success": True,
        "message": f"Sale {sale.sale_number} successfully deleted.",
        "deleted_sale_id": str(sale.id)
    }


