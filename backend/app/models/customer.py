import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, Text, Numeric, Boolean, Integer, DateTime, Date, ForeignKey
from app.core.database import Base
from app.models.business import GUID

class Customer(Base):
    __tablename__ = "customers"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False, index=True)
    phone = Column(String(20), nullable=False, index=True)
    email = Column(String(120), nullable=True)
    gender = Column(String(20), default="Unspecified")
    date_of_birth = Column(Date, nullable=True)
    notes = Column(Text, nullable=True)
    marketing_opt_in = Column(Boolean, nullable=False, default=True)
    
    # Read-optimized summary cache (reconciled against sales)
    total_visits = Column(Integer, nullable=False, default=0)
    total_spend = Column(Numeric(12, 2), nullable=False, default=0.00)
    loyalty_points = Column(Integer, nullable=False, default=0)
    last_visit_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))
