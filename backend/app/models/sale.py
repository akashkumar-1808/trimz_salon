import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, Integer, DateTime, ForeignKey
from sqlalchemy.dialects.postgresql import ENUM
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class Sale(Base):
    __tablename__ = "sales"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = Column(GUID, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    operator_id = Column(GUID, ForeignKey("profiles.id", ondelete="RESTRICT"), nullable=False, index=True)
    sale_number = Column(String(50), nullable=False, index=True)
    client_request_id = Column(String(100), nullable=True, index=True)
    status = Column(
        ENUM("DRAFT", "COMPLETED", "CANCELLED", "REFUNDED", name="sale_status", create_type=False),
        nullable=False,
        default="COMPLETED"
    )
    subtotal = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    discount_reason = Column(String(150), nullable=True)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_percentage = Column(Numeric(5, 2), nullable=False, default=0.00)
    total_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer", lazy="selectin")
    operator = relationship("Profile", lazy="selectin")
    items = relationship("SaleItem", back_populates="sale", cascade="all, delete-orphan", lazy="selectin")
    payments = relationship("Payment", back_populates="sale", cascade="all, delete-orphan", lazy="selectin")
    invoice = relationship("Invoice", back_populates="sale", uselist=False, lazy="selectin")

    @property
    def customer_name(self):
        return self.customer.name if self.customer else None

    @property
    def customer_phone(self):
        return self.customer.phone if self.customer else None

    @property
    def staff_name(self):
        return getattr(self, "_staff_name", None) or (self.operator.name if self.operator else None)

    @staff_name.setter
    def staff_name(self, value):
        self._staff_name = value

class SaleItem(Base):
    __tablename__ = "sale_items"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    sale_id = Column(GUID, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    service_id = Column(GUID, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    item_type = Column(String(20), nullable=False, default="service") # service or product
    
    # Historical Snapshots
    service_name_snapshot = Column(String(150), nullable=False)
    unit_price_snapshot = Column(Numeric(12, 2), nullable=False)
    quantity = Column(Integer, nullable=False, default=1)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    tax_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    total_price = Column(Numeric(12, 2), nullable=False)
    commission_rate_snapshot = Column(Numeric(5, 2), default=0.00)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="items")
    service = relationship("Service", lazy="selectin")

class Payment(Base):
    __tablename__ = "payments"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    sale_id = Column(GUID, ForeignKey("sales.id", ondelete="RESTRICT"), nullable=False, index=True)
    amount = Column(Numeric(12, 2), nullable=False)
    payment_method = Column(
        ENUM("CASH", "UPI", "CARD", "OTHER", name="payment_method_enum", create_type=False),
        nullable=False,
        default="UPI"
    ) # CASH, UPI, CARD, OTHER
    payment_provider = Column(String(50), nullable=True) # Google Pay, PhonePe, Paytm, etc.
    status = Column(
        ENUM("PENDING", "SUCCESS", "FAILED", "REFUNDED", name="payment_status", create_type=False),
        nullable=False,
        default="SUCCESS"
    ) # PENDING, SUCCESS, FAILED, REFUNDED
    transaction_reference = Column(String(100), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    sale = relationship("Sale", back_populates="payments")
