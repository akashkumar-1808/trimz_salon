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
