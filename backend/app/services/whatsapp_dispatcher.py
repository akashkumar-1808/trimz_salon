import logging
from uuid import UUID
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.invoice import Invoice
from app.models.sale import Sale
from app.models.customer import Customer
from app.models.business import Business
from app.models.whatsapp import WhatsAppMessage
from app.models.audit import AuditLog
from app.services.invoice_generator import generate_invoice_png
from app.services.whatsapp import whatsapp_client, normalize_phone_number

logger = logging.getLogger("trimz.whatsapp_dispatcher")

async def get_or_generate_invoice_image(invoice: Invoice, db: AsyncSession) -> str:
    """
    Ensures the high-resolution PNG for the invoice is generated and saved.
    Returns the absolute file path on disk.
    """
    storage_dir = Path("storage/invoices")
    storage_dir.mkdir(parents=True, exist_ok=True)
    safe_number = invoice.invoice_number.replace("/", "_").replace("\\", "_")
    image_file = storage_dir / f"{safe_number}.png"

    if image_file.exists() and invoice.render_status == "GENERATED":
        return str(image_file.resolve())

    # Load sale, customer, and business details
    sale_res = await db.execute(select(Sale).where(Sale.id == invoice.sale_id))
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise ValueError(f"Sale not found for invoice {invoice.id}")

    customer = sale.customer
    customer_name = customer.name if customer else "Valued Guest"
    customer_phone = customer.phone if customer else ""

    items_payload = [
        {
            "service_name": it.service_name_snapshot,
            "stylist_name": sale.staff_name,
            "quantity": it.quantity,
            "unit_price": float(it.unit_price_snapshot),
            "total_price": float(it.total_price)
        }
        for it in sale.items
    ]

    pm = sale.payments[0] if sale.payments else None
    payment_method = pm.payment_method if pm else "UPI"
    payment_provider = pm.payment_provider if pm else None
    tx_ref = pm.transaction_reference if pm else None

    # Render image
    abs_path = generate_invoice_png(
        invoice_number=invoice.invoice_number,
        created_at=invoice.created_at,
        customer_name=customer_name,
        customer_phone=customer_phone,
        items=items_payload,
        subtotal=float(invoice.subtotal),
        discount_amount=float(invoice.discount_amount),
        tax_amount=float(invoice.tax_amount),
        total_amount=float(invoice.total_amount),
        payment_method=payment_method,
        payment_provider=payment_provider,
        transaction_reference=tx_ref,
        stylist_name=sale.staff_name,
        output_path=str(image_file)
    )

    invoice.image_url = f"/api/v1/invoices/{invoice.id}/image"
    invoice.render_status = "GENERATED"
    invoice.rendered_at = datetime.now(timezone.utc)
    await db.flush()

    return abs_path

async def dispatch_invoice_whatsapp(
    invoice_id: UUID,
    db: AsyncSession,
    force_resend: bool = False
) -> Dict[str, Any]:
    """
    Idempotent dispatch of invoice image to customer's WhatsApp number.
    Ensures existing payments/sales remain intact regardless of messaging outcome.
    """
    inv_res = await db.execute(select(Invoice).where(Invoice.id == invoice_id))
    invoice = inv_res.scalar_one_or_none()
    if not invoice:
        raise ValueError(f"Invoice {invoice_id} not found")

    sale_res = await db.execute(select(Sale).where(Sale.id == invoice.sale_id))
    sale = sale_res.scalar_one_or_none()
    if not sale:
        raise ValueError(f"Sale not found for invoice {invoice_id}")

    customer = sale.customer
    recipient_phone = customer.phone if customer else None
    if not recipient_phone:
        return {
            "success": False,
            "status": "SKIPPED",
            "message": "No phone number available for customer"
        }

    clean_phone = normalize_phone_number(recipient_phone)

    # 1. Idempotency Check
    existing_res = await db.execute(
        select(WhatsAppMessage)
        .where(
            WhatsAppMessage.invoice_id == invoice.id,
            WhatsAppMessage.business_id == invoice.business_id
        )
        .order_by(WhatsAppMessage.created_at.desc())
    )
    existing_msg = existing_res.scalars().first()

    if existing_msg and not force_resend:
        if existing_msg.status in ("SENT", "DELIVERED", "READ"):
            return {
                "success": True,
                "status": existing_msg.status,
                "message_id": existing_msg.meta_message_id,
                "note": "Invoice was already dispatched to customer WhatsApp"
            }

    # 2. Ensure Invoice Image is rendered
    try:
        image_path = await get_or_generate_invoice_image(invoice, db)
    except Exception as ex:
        logger.error(f"Failed to generate invoice image: {ex}")
        return {
            "success": False,
            "status": "FAILED",
            "message": f"Could not render invoice image: {str(ex)}"
        }

    # 3. Create or update message tracking record
    now_utc = datetime.now(timezone.utc)
    if not existing_msg:
        message_record = WhatsAppMessage(
            business_id=invoice.business_id,
            invoice_id=invoice.id,
            customer_id=customer.id if customer else None,
            recipient_phone=clean_phone,
            status="SENDING",
            retry_count=0
        )
        db.add(message_record)
        await db.flush()
    else:
        message_record = existing_msg
        message_record.status = "SENDING"
        message_record.retry_count += 1
        await db.flush()

    # 4. Prepare caption
    caption = (
        f"Hello {customer.name if customer else 'Valued Guest'}! ✨\n"
        f"Thank you for choosing TRIMZ Unisex Salon.\n"
        f"Here is your official invoice ({invoice.invoice_number}) for ₹{float(invoice.total_amount):,.2f}.\n"
        f"We look forward to seeing you again!"
    )
    message_record.caption = caption

    # 5. Dispatch via WhatsApp Cloud API Client
    success, meta_id, media_id, err_msg = await whatsapp_client.send_invoice_image(
        recipient_phone=clean_phone,
        image_path=image_path,
        caption=caption
    )

    if success:
        message_record.status = "SENT"
        message_record.meta_message_id = meta_id
        message_record.media_id = media_id
        message_record.sent_at = now_utc
        message_record.error_message = None

        db.add(AuditLog(
            business_id=invoice.business_id,
            user_id=sale.operator_id,
            action="WHATSAPP_INVOICE_SENT",
            entity_name="whatsapp_message",
            entity_id=message_record.id,
            details={
                "invoice_number": invoice.invoice_number,
                "recipient_phone": clean_phone,
                "meta_message_id": meta_id
            }
        ))
    else:
        message_record.status = "FAILED"
        message_record.error_message = err_msg

        db.add(AuditLog(
            business_id=invoice.business_id,
            user_id=sale.operator_id,
            action="WHATSAPP_INVOICE_FAILED",
            entity_name="whatsapp_message",
            entity_id=message_record.id,
            details={
                "invoice_number": invoice.invoice_number,
                "recipient_phone": clean_phone,
                "error": err_msg
            }
        ))

    await db.commit()
    await db.refresh(message_record)

    return {
        "success": success,
        "status": message_record.status,
        "message_id": message_record.meta_message_id,
        "error": message_record.error_message,
        "recipient_phone": clean_phone
    }
