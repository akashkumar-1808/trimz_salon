# ==============================================================================
# TRIMZ SALON — PUBLIC SECURE INVOICE API
# ==============================================================================

from fastapi import APIRouter, Depends, Response, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.services.public_invoice import resolve_public_invoice, format_public_invoice_response
from app.schemas.billing import PublicInvoiceResponse

router = APIRouter(tags=["Public Customer Invoices"])

@router.get("/invoices/{token}", response_model=PublicInvoiceResponse)
async def get_public_invoice(
    token: str,
    response: Response,
    db: AsyncSession = Depends(get_db)
):
    """
    Public customer endpoint to fetch a single verified digital invoice by token.
    - Opaque token validated via SHA-256 hash.
    - No client-supplied invoice ID or business ID accepted for authorization.
    - Expiry and revocation strictly enforced.
    - Cache headers set to private, no-store.
    - Robot search engine index disabled via X-Robots-Tag.
    """
    invoice, business, token_rec = await resolve_public_invoice(db, token)

    # Privacy & caching headers
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, private"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    response.headers["X-Robots-Tag"] = "noindex, nofollow"

    return format_public_invoice_response(invoice, business, token_rec)
