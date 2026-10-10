import os
import hmac
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional, Dict, Any, Tuple
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.config import settings
from app.models.whatsapp import WhatsAppMessage
from app.models.invoice import Invoice
from app.models.sale import Sale
from app.models.customer import Customer

logger = logging.getLogger("trimz.whatsapp")

def normalize_phone_number(phone_raw: str) -> str:
    """
    Normalizes a phone number to international WhatsApp standard digits.
    Converts 10-digit Indian numbers to E.164 without leading plus (e.g. 919876543210).
    """
    if not phone_raw:
        return ""
    digits = re.sub(r"\D", "", phone_raw.strip())
    if len(digits) == 10:
        return f"91{digits}"
    return digits

class WhatsAppCloudAPIClient:
    """
    Adapter for the official Meta WhatsApp Cloud API (Graph API v20.0).
    Handles media uploads, direct image dispatches, and webhook verification.
    """

    def __init__(self):
        self.phone_number_id = settings.META_WHATSAPP_PHONE_NUMBER_ID
        self.access_token = settings.META_WHATSAPP_ACCESS_TOKEN
        self.api_version = settings.META_WHATSAPP_API_VERSION or "v20.0"
        self.app_secret = settings.META_WHATSAPP_APP_SECRET
        self.base_url = f"https://graph.facebook.com/{self.api_version}"

    @property
    def is_configured(self) -> bool:
        return bool(self.phone_number_id and self.access_token)

    def verify_webhook_signature(self, raw_body: bytes, signature_header: Optional[str]) -> bool:
        """
        Validates the HMAC SHA-256 signature from Meta webhook requests.
        """
        if not self.app_secret:
            # If no secret configured in development, allow for testing
            return True
        if not signature_header:
            return False
        
        parts = signature_header.split("=")
        if len(parts) != 2 or parts[0] != "sha256":
            return False

        expected_sig = hmac.new(
            self.app_secret.encode("utf-8"),
            raw_body,
            hashlib.sha256
        ).hexdigest()

        return hmac.compare_digest(expected_sig, parts[1])

    async def upload_media(self, file_path: str) -> Tuple[Optional[str], Optional[str]]:
        """
        Uploads local invoice image to Meta Media API.
        Returns (media_id, error_message).
        """
        if not self.is_configured:
            # Simulated media upload in development mode
            mock_media_id = f"mock_media_{int(datetime.now(timezone.utc).timestamp())}"
            return mock_media_id, None

        path = Path(file_path)
        if not path.exists():
            return None, f"Invoice file not found: {file_path}"

        url = f"{self.base_url}/{self.phone_number_id}/media"
        headers = {
            "Authorization": f"Bearer {self.access_token}"
        }

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                with open(path, "rb") as f:
                    files = {
                        "file": (path.name, f, "image/png"),
                        "messaging_product": (None, "whatsapp"),
                        "type": (None, "image/png")
                    }
                    resp = await client.post(url, headers=headers, files=files)
                
                if resp.status_code == 200:
                    data = resp.json()
                    return data.get("id"), None
                else:
                    err_msg = f"Meta Media Upload failed ({resp.status_code}): {resp.text}"
                    logger.error(err_msg)
                    return None, err_msg
        except Exception as ex:
            err_msg = f"Meta Media Upload network exception: {str(ex)}"
            logger.error(err_msg)
            return None, err_msg

    async def send_invoice_image(
        self,
        recipient_phone: str,
        image_path: str,
        caption: str,
        image_url: Optional[str] = None
    ) -> Tuple[bool, Optional[str], Optional[str], Optional[str]]:
        """
        Sends invoice image to customer.
        Returns: (success, meta_message_id, media_id, error_message)
        """
        clean_phone = normalize_phone_number(recipient_phone)
        if not clean_phone or len(clean_phone) < 10:
            return False, None, None, f"Invalid recipient phone number: '{recipient_phone}'"

        if not self.is_configured:
            # Development Mode simulation
            import uuid
            mock_id = f"wamid.simulated_{uuid.uuid4().hex[:16]}"
            mock_media = f"mock_media_{uuid.uuid4().hex[:8]}"
            logger.info(
                f"[DEV MODE] Meta WhatsApp Cloud API credentials not configured. "
                f"Simulating delivery to {clean_phone} with mock message ID: {mock_id}"
            )
            return True, mock_id, mock_media, None

        # 1. Upload Media
        media_id, err = await self.upload_media(image_path)
        if not media_id:
            return False, None, None, err or "Failed to upload media to Meta"

        # 2. Dispatch Message
        url = f"{self.base_url}/{self.phone_number_id}/messages"
        headers = {
            "Authorization": f"Bearer {self.access_token}",
            "Content-Type": "application/json"
        }
        payload = {
            "messaging_product": "whatsapp",
            "recipient_type": "individual",
            "to": clean_phone,
            "type": "image",
            "image": {
                "id": media_id,
                "caption": caption
            }
        }

        try:
            async with httpx.AsyncClient(timeout=25.0) as client:
                resp = await client.post(url, headers=headers, json=payload)
                if resp.status_code in (200, 201):
                    data = resp.json()
                    messages = data.get("messages", [])
                    msg_id = messages[0].get("id") if messages else None
                    return True, msg_id, media_id, None
                else:
                    err_msg = f"Meta WhatsApp Send error ({resp.status_code}): {resp.text}"
                    logger.error(err_msg)
                    return False, None, media_id, err_msg
        except Exception as ex:
            err_msg = f"Meta WhatsApp Send network exception: {str(ex)}"
            logger.error(err_msg)
            return False, None, media_id, err_msg

whatsapp_client = WhatsAppCloudAPIClient()
