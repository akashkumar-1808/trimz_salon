from typing import Callable, List, Optional
from uuid import UUID
from datetime import datetime, timezone
import httpx
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_supabase_access_token
from app.models.business import Business
from app.models.auth import User, Role, Permission

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = await verify_supabase_access_token(credentials.credentials)
    if not payload or "sub" not in payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    user_id_str = payload["sub"]
    try:
        user_id = UUID(user_id_str)
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identifier in token")

    # Query application profile from database
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    # If not in local session database, resolve directly from Supabase profiles
    if not user and settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                prof_res = await client.get(
                    f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=*,user_roles(roles(*,role_permissions(permissions(*))))",
                    headers={
                        "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                        "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
                    }
                )
                if prof_res.status_code == 200 and prof_res.json():
                    p = prof_res.json()[0]
                    biz_id = UUID(p["business_id"])
                    
                    # Ensure business exists in local session
                    biz_res = await db.execute(select(Business).where(Business.id == biz_id))
                    if not biz_res.scalar_one_or_none():
                        db.add(Business(id=biz_id, name="Trimz Salon", phone="+919800011223"))
                        await db.flush()

                    # Parse created_at from Supabase profile or auth token payload
                    created_at_dt = None
                    raw_created_at = p.get("created_at") or payload.get("created_at")
                    if raw_created_at:
                        if isinstance(raw_created_at, datetime):
                            created_at_dt = raw_created_at
                        elif isinstance(raw_created_at, str):
                            try:
                                created_at_dt = datetime.fromisoformat(raw_created_at.replace("Z", "+00:00"))
                            except Exception:
                                created_at_dt = None
                    if not created_at_dt:
                        created_at_dt = datetime.now(timezone.utc)

                    user = User(
                        id=user_id,
                        business_id=biz_id,
                        email=p.get("email", payload.get("email", "")),
                        name=p.get("name", "Salon Staff"),
                        phone=p.get("phone"),
                        avatar_url=p.get("avatar_url"),
                        is_owner=p.get("is_owner", False),
                        status=p.get("status", "ACTIVE"),
                        created_at=created_at_dt,
                        updated_at=created_at_dt
                    )
                    db.add(user)
                    await db.commit()
                    
                    # Reload with relationships
                    result = await db.execute(select(User).where(User.id == user_id))
                    user = result.scalar_one_or_none()
        except Exception:
            pass

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="User profile not registered in this salon business"
        )

    # Ensure created_at is populated if legacy record lacked it
    if user.created_at is None:
        user.created_at = datetime.now(timezone.utc)
        await db.commit()
        await db.refresh(user)
        
    if user.status != "ACTIVE":
        detail = (
            "Your staff account is pending owner approval. Please contact the salon owner."
            if user.status == "PENDING"
            else "Your staff account has been deactivated. Contact the salon owner."
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, 
            detail=detail
        )
        
    return user

def get_user_permissions(user: User) -> List[str]:
    """
    Synchronous fallback to read permissions from preloaded user relationships.
    For authoritative and cache-free evaluation, use resolve_user_permissions(db, user).
    """
    if not user or getattr(user, "status", "ACTIVE") != "ACTIVE":
        return []
    if user.is_owner:
        return ["*"] # Owner has unrestricted access
        
    perms = set()
    if getattr(user, "has_custom_permissions", False):
        for perm in getattr(user, "direct_permissions", []):
            perms.add(perm.code)
    else:
        for role in getattr(user, "roles", []):
            for perm in getattr(role, "permissions", []):
                perms.add(perm.code)
    return sorted(list(perms))

async def resolve_user_permissions(db: AsyncSession, user: User) -> List[str]:
    """
    Authoritatively queries the database for all effective permission codes for the user.
    Bypasses any stale in-memory relationship caches.
    - Owner: returns ['*']
    - Inactive / Suspended / Pending: returns []
    - Custom permissions enabled: queries user_permissions
    - Role-based permissions: queries user_roles -> role_permissions -> permissions
    """
    if not user or getattr(user, "status", "ACTIVE") != "ACTIVE":
        return []
    if user.is_owner:
        return ["*"]

    from app.models.auth import Permission, UserPermission, UserRole, RolePermission

    perms = set()
    if getattr(user, "has_custom_permissions", False):
        res = await db.execute(
            select(Permission.code)
            .join(UserPermission, UserPermission.permission_id == Permission.id)
            .where(UserPermission.user_id == user.id)
        )
        for code in res.scalars().all():
            perms.add(code)
    else:
        res = await db.execute(
            select(Permission.code)
            .join(RolePermission, RolePermission.permission_id == Permission.id)
            .join(UserRole, UserRole.role_id == RolePermission.role_id)
            .where(UserRole.user_id == user.id)
        )
        for code in res.scalars().all():
            perms.add(code)

    return sorted(list(perms))

def require_permission(permission_code: str) -> Callable:
    """Dependency factory that verifies the authenticated user possesses the required permission."""
    async def permission_checker(
        current_user: User = Depends(get_current_user),
        db: AsyncSession = Depends(get_db)
    ) -> User:
        if getattr(current_user, "status", "ACTIVE") != "ACTIVE":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Account is inactive"
            )
        if current_user.is_owner:
            return current_user # Owner bypasses all checks
            
        user_perms = await resolve_user_permissions(db, current_user)
        if permission_code not in user_perms and "*" not in user_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Missing required permission '{permission_code}'"
            )
        return current_user
        
    return permission_checker

async def get_current_owner(current_user: User = Depends(get_current_user)) -> User:
    """Ensures the authenticated user is an Owner."""
    if not current_user.is_owner:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Administrator access required. Only the salon owner can perform this action."
        )
    return current_user
