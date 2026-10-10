import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id = Column(GUID, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    customer_id = Column(GUID, ForeignKey("customers.id", ondelete="SET NULL"), nullable=True)
    recipient_phone = Column(String(30), nullable=False)
    meta_message_id = Column(String(150), nullable=True, unique=True, index=True)
    media_id = Column(String(150), nullable=True)
    caption = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="PENDING", index=True) # PENDING, SENDING, SENT, DELIVERED, READ, FAILED
    retry_count = Column(Integer, nullable=False, default=0)
    error_message = Column(Text, nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    delivered_at = Column(DateTime(timezone=True), nullable=True)
    read_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    invoice = relationship("Invoice", back_populates="whatsapp_messages")
    customer = relationship("Customer", lazy="selectin")
