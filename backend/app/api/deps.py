from typing import Callable, List, Optional
from uuid import UUID
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import decode_access_token
from app.models.auth import User, Role, Permission

security_scheme = HTTPBearer(auto_error=False)

async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security_scheme),
    db: AsyncSession = Depends(get_db)
) -> User:
    if not credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication token is required",
            headers={"WWW-Authenticate": "Bearer"}
        )
    
    payload = decode_access_token(credentials.credentials)
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
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid user identifier")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
        
    if user.status != "ACTIVE":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")
        
    return user

def get_user_permissions(user: User) -> List[str]:
    """Resolves all distinct permission codes assigned to the user."""
    if user.is_owner:
        return ["*"] # Owner has unrestricted access
        
    perms = set()
    for role in user.roles:
        for perm in role.permissions:
            perms.add(perm.code)
    return list(perms)

def require_permission(permission_code: str) -> Callable:
    """Dependency factory that verifies the authenticated user possesses the required permission."""
    async def permission_checker(
        current_user: User = Depends(get_current_user)
    ) -> User:
        if current_user.is_owner:
            return current_user # Owner bypasses all checks
            
        user_perms = get_user_permissions(current_user)
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
