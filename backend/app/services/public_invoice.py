# ==============================================================================
# TRIMZ SALON — PUBLIC SHAREABLE DIGITAL INVOICE SERVICE
# ==============================================================================

import secrets
import hashlib
from datetime import datetime, timezone, timedelta
from typing import Optional, Tuple
from uuid import UUID
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from sqlalchemy.orm import selectinload

from app.models.invoice import Invoice, PublicInvoiceToken
from app.models.business import Business
from app.models.sale import Sale, SaleItem, Payment
from app.models.customer import Customer
from app.core.config import settings
from app.schemas.billing import (
    PublicInvoiceResponse,
    PublicInvoiceItem,
    PublicInvoicePayment,
    PublicInvoiceBusiness
)

def hash_token(raw_token: str) -> str:
    """Computes SHA-256 hash of the raw token."""
    return hashlib.sha256(raw_token.strip().encode("utf-8")).hexdigest()

def generate_raw_token() -> str:
    """Generates a cryptographically secure, unpredictable token."""
    return secrets.token_urlsafe(32)

def build_public_invoice_url(raw_token: str) -> str:
    """Constructs the canonical public web invoice URL for customer access."""
    base_url = settings.FRONTEND_URL.rstrip("/")
    return f"{base_url}/i/{raw_token}"

def mask_phone_number(phone: Optional[str]) -> Optional[str]:
    """
    Masks customer phone number for public privacy.
    E.g. '+919966175299' -> '+91 99****5299'
         '9966175299' -> '99****5299'
    """
    if not phone:
        return None
    raw = phone.strip()
    digits = "".join(filter(str.isdigit, raw))
    if len(digits) >= 10:
        last4 = digits[-4:]
        first2 = digits[-10:-8]
        prefix = "+91 " if raw.startswith("+91") or digits.startswith("91") and len(digits) > 10 else ""
        return f"{prefix}{first2}****{last4}"
    return "****"

async def create_public_invoice_token(
    db: AsyncSession,
    invoice: Invoice,
    expires_in_days: Optional[int] = 90
) -> Tuple[PublicInvoiceToken, str]:
    """
    Generates a cryptographically secure public invoice token,
    stores its SHA-256 hash in PostgreSQL, and returns (token_record, raw_token).
    Never logs or persists the raw token in plaintext in the database.
    """
    raw_token = generate_raw_token()
    thash = hash_token(raw_token)

    expires_at = None
    if expires_in_days is not None and expires_in_days > 0:
        expires_at = datetime.now(timezone.utc) + timedelta(days=expires_in_days)

    token_record = PublicInvoiceToken(
        business_id=invoice.business_id,
        invoice_id=invoice.id,
        token_hash=thash,
        is_revoked=False,
        expires_at=expires_at,
        view_count=0
    )
    db.add(token_record)
    await db.flush()
    return token_record, raw_token

async def revoke_public_invoice_tokens(db: AsyncSession, invoice_id: UUID) -> None:
    """Revokes all active public tokens for an invoice."""
    stmt = (
        update(PublicInvoiceToken)
        .where(
            PublicInvoiceToken.invoice_id == invoice_id,
            PublicInvoiceToken.is_revoked == False
        )
        .values(
            is_revoked=True,
            revoked_at=datetime.now(timezone.utc)
        )
    )
    await db.execute(stmt)

async def resolve_public_invoice(
    db: AsyncSession,
    raw_token: str
) -> Tuple[Invoice, Business, PublicInvoiceToken]:
    """
    Validates the opaque token securely using its stored SHA-256 hash.
    Checks revocation and expiration.
    Increments view count.
    Returns (invoice, business, token_record).
    """
    if not raw_token or len(raw_token.strip()) < 10:
        raise HTTPException(status_code=404, detail="Invoice link is invalid or not found")

    thash = hash_token(raw_token)
    stmt = select(PublicInvoiceToken).where(PublicInvoiceToken.token_hash == thash)
    res = await db.execute(stmt)
    token_rec = res.scalar_one_or_none()

    if not token_rec:
        raise HTTPException(status_code=404, detail="Invoice link is invalid or not found")

    if token_rec.is_revoked:
        raise HTTPException(status_code=410, detail="This invoice link has been revoked")

    now = datetime.now(timezone.utc)
    if token_rec.expires_at:
        exp = token_rec.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp < now:
            raise HTTPException(status_code=410, detail="This invoice link has expired")


    # Record access metadata (view_count, last_viewed_at)
    token_rec.view_count = (token_rec.view_count or 0) + 1
    token_rec.last_viewed_at = now
    await db.flush()

    # Query invoice with authoritative relationships
    inv_stmt = (
        select(Invoice)
        .options(
            selectinload(Invoice.sale).selectinload(Sale.items),
            selectinload(Invoice.sale).selectinload(Sale.payments),
            selectinload(Invoice.sale).selectinload(Sale.customer)
        )
        .where(Invoice.id == token_rec.invoice_id)
    )
    inv_res = await db.execute(inv_stmt)
    invoice = inv_res.scalar_one_or_none()
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice record not found")

    # Query business
    biz_stmt = select(Business).where(Business.id == token_rec.business_id)
    biz_res = await db.execute(biz_stmt)
    business = biz_res.scalar_one_or_none()
    if not business:
        business = Business(
            name="TRiMZ Unisex Salon",
            email="trimzsalonspt@gmail.com",
            phone="+91 9966175299",
            address="Shar Road, Sullurupeta, Erapalem, Andhra Pradesh – 524121",
            city="Sullurupeta",
            state="Andhra Pradesh",
            postal_code="524121"
        )

    return invoice, business, token_rec

def format_public_invoice_response(
    invoice: Invoice,
    business: Business,
    token_rec: PublicInvoiceToken
) -> PublicInvoiceResponse:
    """
    Transforms the database invoice and historical snapshots into
    a safe, sanitized, read-only PublicInvoiceResponse without exposing
    internal UUIDs, internal notes, or staff permissions.
    """
    sale = invoice.sale
    customer = sale.customer if sale else None
    payments = sale.payments if sale else []

    # Format Date & Time
    created_dt = invoice.created_at or datetime.now(timezone.utc)
    date_str = created_dt.strftime("%d %b %Y")
    time_str = created_dt.strftime("%I:%M %p")

    # Historical Item Snapshots
    items_out = []
    if sale and sale.items:
        for it in sale.items:
            items_out.append(
                PublicInvoiceItem(
                    name=it.service_name_snapshot,
                    stylist=sale.staff_name or "Stylist",
                    quantity=it.quantity,
                    unit_price=float(it.unit_price_snapshot),
                    total_price=float(it.total_price)
                )
            )

    # Payment info
    amount_paid = 0.0
    primary_pm = "UPI"
    primary_prov = None
    tx_ref = None
    for p in payments:
        if p.status == "SUCCESS":
            amount_paid += float(p.amount)
            primary_pm = p.payment_method
            primary_prov = p.payment_provider
            if p.transaction_reference:
                tx_ref = p.transaction_reference

    total_amount = float(invoice.total_amount)
    if not payments:
        amount_paid = total_amount

    balance_due = max(0.0, round(total_amount - amount_paid, 2))
    payment_status = "PAID" if balance_due <= 0.01 else "PARTIAL"

    payment_out = PublicInvoicePayment(
        payment_method=primary_pm,
        payment_provider=primary_prov,
        status=payment_status,
        amount_paid=round(amount_paid, 2),
        balance_due=balance_due,
        transaction_reference=tx_ref
    )

    business_out = PublicInvoiceBusiness(
        name=business.name or "TRiMZ Unisex Salon",
        legal_name=business.legal_name or "Trimz Unisex Salon Private Limited",
        email=business.email or "trimzsalonspt@gmail.com",
        phone=business.phone or "+91 9966175299",
        address=business.address or "Shar Road, Sullurupeta, Erapalem, Andhra Pradesh – 524121",
        city=business.city or "Sullurupeta",
        state=business.state or "Andhra Pradesh",
        postal_code=business.postal_code or "524121",
        slogan="LOOK GOOD / FEEL GOOD / BE YOU",
        instagram="@trimzunisexsalon"
    )

    stylist_display = (sale.staff_name if sale and sale.staff_name else None) or (sale.operator.name if sale and sale.operator else "Team Member")

    return PublicInvoiceResponse(
        invoice_number=invoice.invoice_number,
        sale_number=sale.sale_number if sale else None,
        date=date_str,
        time=time_str,
        created_at_iso=created_dt.isoformat(),
        stylist=stylist_display,
        customer_name=customer.name if customer and customer.name else "Valued Guest",
        customer_phone_masked=mask_phone_number(customer.phone) if customer else None,
        items=items_out,
        subtotal=float(invoice.subtotal),
        discount_amount=float(invoice.discount_amount),
        tax_amount=float(invoice.tax_amount),
        tax_name=business.tax_name or "GST",
        tax_percentage=float(sale.tax_percentage or 0.0) if sale else 0.0,
        total_amount=total_amount,
        currency=invoice.currency or "INR",
        status=invoice.status or "ISSUED",
        payment=payment_out,
        business=business_out
    )
