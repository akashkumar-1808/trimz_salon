from uuid import UUID
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.config import settings
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.business import Business
from app.models.auth import User
from app.schemas.auth import LoginRequest, TokenResponse, MeResponse, UserOut
from app.api.deps import get_current_user, get_user_permissions

import logging
from sqlalchemy.exc import DBAPIError, OperationalError, InterfaceError

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/login", response_model=TokenResponse)
async def login(credentials: LoginRequest, db: AsyncSession = Depends(get_db)):
    email_clean = credentials.email.lower().strip()
    
    # Authenticate exclusively using Supabase Auth
    if not settings.SUPABASE_URL or not settings.SUPABASE_KEY:
        logger.error("Login attempt failed: Supabase Auth credentials not configured")
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service configuration unavailable"
        )

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                auth_resp = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/token?grant_type=password",
                    headers={"apikey": settings.SUPABASE_KEY, "Content-Type": "application/json"},
                    json={"email": email_clean, "password": credentials.password}
                )
            except (httpx.ConnectError, httpx.TimeoutException, httpx.NetworkError) as net_err:
                logger.error("Supabase Auth service unreachable during login: %s", type(net_err).__name__)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service temporarily unavailable"
                )

            if auth_resp.status_code == 200:
                auth_data = auth_resp.json()
                access_token = auth_data["access_token"]
                user_id = UUID(auth_data["user"]["id"])
                
                # Resolve application profile from Supabase PostgreSQL database
                try:
                    result = await db.execute(select(User).where(User.id == user_id))
                    user = result.scalar_one_or_none()
                except (OperationalError, InterfaceError, DBAPIError, OSError) as db_err:
                    logger.error("Database error while loading user profile: %s", type(db_err).__name__)
                    raise HTTPException(
                        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                        detail="Database service temporarily unavailable"
                    )
                
                # If profile missing from local session, fetch from Supabase REST profiles
                if not user and settings.SUPABASE_SERVICE_ROLE_KEY:
                    try:
                        prof_res = await client.get(
                            f"{settings.SUPABASE_URL}/rest/v1/profiles?id=eq.{user_id}&select=*",
                            headers={
                                "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                                "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}"
                            }
                        )
                        if prof_res.status_code == 200 and prof_res.json():
                            p = prof_res.json()[0]
                            biz_id = UUID(p["business_id"])
                            user = User(
                                id=user_id,
                                business_id=biz_id,
                                email=p["email"],
                                name=p.get("name", "Salon Staff"),
                                phone=p.get("phone"),
                                avatar_url=p.get("avatar_url"),
                                is_owner=p.get("is_owner", False),
                                status=p.get("status", "ACTIVE")
                            )
                            db.add(user)
                            await db.commit()
                            result = await db.execute(select(User).where(User.id == user_id))
                            user = result.scalar_one_or_none()
                    except (OperationalError, InterfaceError, DBAPIError, OSError) as db_err:
                        logger.error("Database error while syncing user profile: %s", type(db_err).__name__)
                        raise HTTPException(
                            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                            detail="Database service temporarily unavailable"
                        )
                    except Exception as sync_err:
                        logger.error("Profile sync exception: %s", type(sync_err).__name__)

                if not user:
                    logger.warning("Authenticated user without application profile: %s", user_id)
                    raise HTTPException(
                        status_code=status.HTTP_401_UNAUTHORIZED,
                        detail="User profile not registered for this business"
                    )

                if user.status != "ACTIVE":
                    logger.warning("Inactive account login attempt: %s (status=%s)", user_id, user.status)
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Your staff account has been deactivated. Contact the salon owner."
                    )

                permissions = get_user_permissions(user)
                return TokenResponse(
                    access_token=access_token,
                    token_type="bearer",
                    user=UserOut.model_validate(user),
                    permissions=permissions
                )
            elif auth_resp.status_code in (400, 401):
                # Supabase Auth returns 400 with invalid_grant on incorrect password
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"}
                )
            elif auth_resp.status_code >= 500:
                logger.error("Supabase Auth server error: HTTP %d", auth_resp.status_code)
                raise HTTPException(
                    status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                    detail="Authentication service temporarily unavailable"
                )
            else:
                logger.error("Supabase Auth unexpected response: HTTP %d", auth_resp.status_code)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Incorrect email or password",
                    headers={"WWW-Authenticate": "Bearer"}
                )
    except HTTPException:
        raise
    except (OperationalError, InterfaceError, DBAPIError, OSError) as db_err:
        logger.error("Database connection failure during login: %s", type(db_err).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database service temporarily unavailable"
        )
    except Exception as e:
        logger.error("Unexpected exception during login: %s", type(e).__name__)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Authentication service temporarily unavailable"
        )

@router.get("/me", response_model=MeResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    permissions = get_user_permissions(current_user)
    return MeResponse(
        user=UserOut.model_validate(current_user),
        permissions=permissions,
        is_owner=current_user.is_owner
    )

@router.post("/logout")
async def logout():
    return {"message": "Logged out successfully"}
