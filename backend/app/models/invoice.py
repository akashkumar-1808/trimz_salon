import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, Boolean, Integer
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class Invoice(Base):
    __tablename__ = "invoices"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    sale_id = Column(GUID, ForeignKey("sales.id", ondelete="RESTRICT"), nullable=False, unique=True)
    invoice_number = Column(String(50), nullable=False, index=True)
    status = Column(String(20), nullable=False, default="ISSUED") # ISSUED, VOID, REPLACED
    subtotal = Column(Numeric(12, 2), nullable=False)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False)
    currency = Column(String(5), nullable=False, default="INR")
    pdf_url = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    render_status = Column(String(20), nullable=False, default="PENDING") # PENDING, GENERATED, FAILED
    rendered_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="invoice", lazy="selectin")
    whatsapp_messages = relationship("WhatsAppMessage", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")
    public_tokens = relationship("PublicInvoiceToken", back_populates="invoice", cascade="all, delete-orphan", lazy="selectin")

    @property
    def customer_name(self):
        return self.sale.customer.name if self.sale and self.sale.customer else None

    @property
    def customer_phone(self):
        return self.sale.customer.phone if self.sale and self.sale.customer else None


class PublicInvoiceToken(Base):
    __tablename__ = "public_invoice_tokens"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    invoice_id = Column(GUID, ForeignKey("invoices.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    is_revoked = Column(Boolean, nullable=False, default=False)
    revoked_at = Column(DateTime(timezone=True), nullable=True)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    view_count = Column(Integer, nullable=False, default=0)
    last_viewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    invoice = relationship("Invoice", back_populates="public_tokens", lazy="selectin")

