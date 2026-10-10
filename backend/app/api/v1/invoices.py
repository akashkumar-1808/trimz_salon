from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.models.invoice import Invoice
from app.models.sale import Sale
from app.models.customer import Customer
from app.models.auth import User
from app.models.business import Business
from app.api.v1.billing import generate_thermal_receipt_text
from app.schemas.billing import InvoiceOut, SaleOut
from app.api.deps import require_permission

router = APIRouter(prefix="/invoices", tags=["Invoicing"])

@router.get("", response_model=List[InvoiceOut])
async def list_invoices(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.view"))
):
    stmt = (
        select(Invoice)
        .where(Invoice.business_id == current_user.business_id)
        .order_by(Invoice.created_at.desc())
    )
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(Invoice.invoice_number.ilike(s))
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
    receipt_text = generate_thermal_receipt_text(business, sale, inv, customer)

    items = [
        {
            "service_name": it.service_name_snapshot,
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
        "invoice_number": inv.invoice_number,
        "sale_number": sale.sale_number,
        "created_at": inv.created_at,
        "customer_name": customer.name if customer else "Walk-in Guest",
        "customer_phone": customer.phone if customer else "",
        "items": items,
        "subtotal": float(inv.subtotal),
        "discount_amount": float(inv.discount_amount),
        "tax_amount": float(inv.tax_amount),
        "total_amount": float(inv.total_amount),
        "payment_method": payment_method,
        "payment_provider": payment_provider,
        "receipt_text": receipt_text
    }
