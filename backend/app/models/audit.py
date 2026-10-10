import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, ForeignKey, JSON
from app.core.database import Base
from app.models.business import GUID

class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(GUID, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    action = Column(String(80), nullable=False) # e.g. SALE_CREATED, ROLE_UPDATED, EMPLOYEE_CREATED
    entity_name = Column(String(50), nullable=False)
    entity_id = Column(GUID, nullable=True)
    details = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
