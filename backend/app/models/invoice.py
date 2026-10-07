import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text
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
    subtotal = Column(Numeric(10, 2), nullable=False)
    discount_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(10, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(5), nullable=False, default="INR")
    pdf_url = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="invoice")
