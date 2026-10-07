from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.models.auth import User
from app.schemas.auth import LoginRequest, TokenResponse, MeResponse, UserOut
from app.api.deps import get_current_user, get_user_permissions

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == credentials.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not user.password_hash or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"}
        )

    if user.status != "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your staff account has been deactivated. Contact the salon owner."
        )

    permissions = get_user_permissions(user)
    token = create_access_token(
        subject=str(user.id),
        extra_claims={
            "business_id": str(user.business_id),
            "is_owner": user.is_owner,
            "roles": [r.name for r in user.roles]
        }
    )

    return TokenResponse(
        access_token=token,
        token_type="bearer",
        user=UserOut.model_validate(user),
        permissions=permissions
    )

@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    permissions = get_user_permissions(current_user)
    return MeResponse(
        user=UserOut.model_validate(current_user),
        permissions=permissions,
        is_owner=current_user.is_owner
    )
