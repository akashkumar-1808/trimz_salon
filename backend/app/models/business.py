import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, Boolean, DateTime
from sqlalchemy.dialects.postgresql import UUID as PG_UUID
from sqlalchemy.types import TypeDecorator, CHAR
from app.core.database import Base

class GUID(TypeDecorator):
    """Platform-independent GUID type that uses PostgreSQL UUID or CHAR(36) on SQLite."""
    impl = CHAR
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PG_UUID())
        else:
            return dialect.type_descriptor(CHAR(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if not isinstance(value, uuid.UUID):
                return str(uuid.UUID(str(value)))
            else:
                return str(value)

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if not isinstance(value, uuid.UUID):
                return uuid.UUID(str(value))
            return value

class Business(Base):
    __tablename__ = "businesses"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    name = Column(String(150), nullable=False, default="Trimz Salon")
    legal_name = Column(String(200), default="Trimz Unisex Salon Private Limited")
    phone = Column(String(20), nullable=False, default="+919800011223")
    email = Column(String(100), default="contact@trimzsalon.com")
    address = Column(Text, nullable=False, default="100 Feet Road, Indiranagar, Bengaluru")
    city = Column(String(100), nullable=False, default="Bengaluru")
    state = Column(String(100), nullable=False, default="Karnataka")
    postal_code = Column(String(20), nullable=False, default="560038")
    country = Column(String(10), nullable=False, default="IN")
    tax_name = Column(String(50), default="GST")
    default_tax_rate = Column(Numeric(5, 2), default=5.00)
    tax_registration_number = Column(String(50), default="29AAAAA0000A1Z5")
    currency = Column(String(5), nullable=False, default="INR")
    currency_symbol = Column(String(5), nullable=False, default="₹")
    timezone = Column(String(50), nullable=False, default="Asia/Kolkata")
    bill_prefix = Column(String(10), nullable=False, default="TZ")
    logo_url = Column(Text, nullable=True)
    font_family = Column(String(100), nullable=True, default="Inter")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
