import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, Boolean, Integer, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class ServiceCategory(Base):
    __tablename__ = "service_categories"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(100), nullable=False)
    slug = Column(String(100), nullable=True)
    department = Column(String(50), nullable=False, default="Unisex") # Men, Women, Unisex
    description = Column(Text, nullable=True)
    display_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    services = relationship("Service", back_populates="category", lazy="selectin")

class Service(Base):
    __tablename__ = "services"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    category_id = Column(GUID, ForeignKey("service_categories.id", ondelete="RESTRICT"), nullable=False, index=True)
    name = Column(String(150), nullable=False, index=True)
    slug = Column(String(150), nullable=True)
    variant_name = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=False)
    duration_minutes = Column(Integer, nullable=False, default=30)
    audience = Column(String(20), nullable=False, default="Unisex") # Male, Female, Unisex
    commission_rate = Column(Numeric(5, 2), default=0.00)
    is_variable_price = Column(Boolean, nullable=False, default=False)
    combo_items = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    is_deleted = Column(Boolean, nullable=False, default=False)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    category = relationship("ServiceCategory", back_populates="services")
