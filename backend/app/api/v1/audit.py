from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.audit import AuditLog
from app.models.auth import User
from app.api.deps import require_permission
from pydantic import BaseModel
from datetime import datetime
from uuid import UUID

class AuditLogOut(BaseModel):
    id: UUID
    action: str
    entity_name: str
    entity_id: Optional[UUID] = None
    details: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("", response_model=List[AuditLogOut])
async def list_audit_logs(
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("audit.view"))
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.business_id == current_user.business_id)
        .order_by(AuditLog.created_at.desc())
        .limit(limit)
    )
    return result.scalars().all()
