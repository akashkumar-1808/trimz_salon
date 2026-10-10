import json
import logging
from datetime import datetime, timezone
from typing import Optional, Dict, Any
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, Response, status
from fastapi.responses import PlainTextResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.core.database import get_db
from app.models.whatsapp import WhatsAppMessage
from app.models.audit import AuditLog
from app.services.whatsapp import whatsapp_client

logger = logging.getLogger("trimz.webhooks")
router = APIRouter(prefix="/webhooks", tags=["Meta Webhooks"])

@router.get("/whatsapp")
async def verify_whatsapp_webhook(
    hub_mode: Optional[str] = Query(None, alias="hub.mode"),
    hub_challenge: Optional[str] = Query(None, alias="hub.challenge"),
    hub_verify_token: Optional[str] = Query(None, alias="hub.verify_token")
):
    """
    Verification challenge endpoint called by Meta when registering the Webhook in Meta App Dashboard.
    """
    expected_token = settings.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN or "trimz_webhook_verify_token_2026"

    if hub_mode == "subscribe" and hub_verify_token == expected_token:
        logger.info("Meta WhatsApp Webhook subscription challenge verified successfully.")
        return PlainTextResponse(content=str(hub_challenge), status_code=status.HTTP_200_OK)

    logger.warning(
        f"Meta Webhook challenge rejected. Received mode={hub_mode}, "
        f"token mismatch."
    )
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Verification token mismatch")

@router.post("/whatsapp")
async def receive_whatsapp_status(
    request: Request,
    x_hub_signature_256: Optional[str] = Header(None, alias="X-Hub-Signature-256"),
    db: AsyncSession = Depends(get_db)
):
    """
    Ingests real-time message delivery receipts (sent, delivered, read, failed) from Meta.
    Verifies HMAC SHA-256 signature when secret is configured.
    """
    raw_body = await request.body()

    # 1. Signature Verification
    if settings.META_WHATSAPP_APP_SECRET:
        if not whatsapp_client.verify_webhook_signature(raw_body, x_hub_signature_256):
            logger.error("Meta Webhook HMAC signature verification failed.")
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid HMAC signature")

    # 2. Parse Payload
    try:
        payload = json.loads(raw_body.decode("utf-8"))
    except Exception as ex:
        logger.error(f"Invalid JSON payload received on webhook: {ex}")
        return {"status": "ignored", "reason": "invalid_json"}

    entries = payload.get("entry", [])
    now_utc = datetime.now(timezone.utc)
    updated_count = 0

    for entry in entries:
        for change in entry.get("changes", []):
            val = change.get("value", {})
            statuses = val.get("statuses", [])

            for s in statuses:
                meta_id = s.get("id")
                new_status = s.get("status") # delivered, read, failed, sent
                if not meta_id or not new_status:
                    continue

                msg_res = await db.execute(
                    select(WhatsAppMessage).where(WhatsAppMessage.meta_message_id == meta_id)
                )
                msg = msg_res.scalar_one_or_none()
                if not msg:
                    continue

                if new_status == "delivered":
                    msg.status = "DELIVERED"
                    msg.delivered_at = now_utc
                elif new_status == "read":
                    msg.status = "READ"
                    msg.read_at = now_utc
                elif new_status == "failed":
                    msg.status = "FAILED"
                    errors = s.get("errors", [])
                    msg.error_message = json.dumps(errors) if errors else "Delivery failed reported by Meta"
                elif new_status == "sent" and msg.status == "PENDING":
                    msg.status = "SENT"
                    msg.sent_at = now_utc

                updated_count += 1

    if updated_count > 0:
        await db.commit()

    return {"status": "ok", "updated": updated_count}
