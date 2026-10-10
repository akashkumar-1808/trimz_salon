import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings as app_settings
from app.core.database import get_db
from app.models.business import Business
from app.models.auth import User
from app.models.audit import AuditLog
from app.schemas.settings import BusinessOut, BusinessUpdate, ProfileUpdate
from app.schemas.auth import UserOut
from app.api.deps import get_current_user, require_permission

router = APIRouter(prefix="/settings", tags=["Business Settings & Profile"])

@router.get("/business", response_model=BusinessOut)
async def get_business_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings.view"))
):
    result = await db.execute(
        select(Business).where(Business.id == current_user.business_id)
    )
    biz = result.scalar_one_or_none()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")
    return biz

@router.patch("/business", response_model=BusinessOut)
async def update_business_settings(
    data: BusinessUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("settings.edit"))
):
    result = await db.execute(
        select(Business).where(Business.id == current_user.business_id)
    )
    biz = result.scalar_one_or_none()
    if not biz:
        raise HTTPException(status_code=404, detail="Business not found")

    update_fields = data.model_dump(exclude_unset=True)
    for field, val in update_fields.items():
        if val is not None:
            if isinstance(val, str):
                setattr(biz, field, val.strip())
            else:
                setattr(biz, field, val)

    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="BUSINESS_SETTINGS_UPDATED",
        entity_name="business",
        entity_id=biz.id,
        details={"updated_fields": list(update_fields.keys())}
    ))

    await db.commit()
    await db.refresh(biz)
    return biz

@router.get("/profile", response_model=UserOut)
async def get_my_profile(
    current_user: User = Depends(get_current_user)
):
    return current_user

@router.patch("/profile", response_model=UserOut)
async def update_my_profile(
    data: ProfileUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if data.name is not None:
        current_user.name = data.name.strip()
    if data.phone is not None:
        current_user.phone = data.phone.strip()
    if data.avatar_url is not None:
        current_user.avatar_url = data.avatar_url.strip()

    if data.password:
        if app_settings.SUPABASE_SERVICE_ROLE_KEY and app_settings.SUPABASE_URL:
            try:
                headers = {
                    "apikey": app_settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {app_settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json"
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.put(
                        f"{app_settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{current_user.id}",
                        json={"password": data.password},
                        headers=headers
                    )
                    if resp.status_code >= 400:
                        raise HTTPException(status_code=400, detail="Failed to update password in Auth service")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=503, detail="Supabase Auth service unavailable")

    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="PROFILE_UPDATED",
        entity_name="user",
        entity_id=current_user.id,
        details={"name": current_user.name}
    ))

    await db.commit()
    await db.refresh(current_user)
    return current_user
