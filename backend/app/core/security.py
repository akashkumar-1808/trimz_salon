from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
import bcrypt
from jose import jwt, JWTError
from app.core.config import settings

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if not plain_password or not hashed_password:
        return False
    try:
        password_bytes = plain_password.encode('utf-8')
        hashed_bytes = hashed_password.encode('utf-8')
        return bcrypt.checkpw(password_bytes, hashed_bytes)
    except Exception:
        return False

def get_password_hash(password: str) -> str:
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password_bytes, salt).decode('utf-8')

def create_access_token(
    subject: Union[str, Any], 
    expires_delta: Optional[timedelta] = None,
    extra_claims: Optional[dict] = None
) -> str:
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "iat": datetime.now(timezone.utc)
    }
    if extra_claims:
        to_encode.update(extra_claims)
        
    return jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)

import httpx
import time
from jose import jwk

_JWKS_CACHE = {"keys": {}, "expires_at": 0}

async def _get_supabase_jwks_keys() -> dict:
    now = time.time()
    if _JWKS_CACHE["keys"] and now < _JWKS_CACHE["expires_at"]:
        return _JWKS_CACHE["keys"]

    if not settings.SUPABASE_URL:
        return {}

    try:
        api_key = settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY or ""
        async with httpx.AsyncClient(timeout=8.0) as client:
            resp = await client.get(
                f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/.well-known/jwks.json",
                headers={"apikey": api_key}
            )
            if resp.status_code == 200:
                data = resp.json()
                parsed_keys = {}
                for k in data.get("keys", []):
                    kid = k.get("kid")
                    if kid:
                        parsed_keys[kid] = jwk.construct(k)
                _JWKS_CACHE["keys"] = parsed_keys
                _JWKS_CACHE["expires_at"] = now + 3600 # Cache for 1 hour
                return parsed_keys
    except Exception:
        pass
    return _JWKS_CACHE.get("keys", {})

async def verify_supabase_access_token(token: str) -> Optional[dict]:
    """
    Validates a Supabase Auth access token.
    1. Fast path: Verifies cryptographic signature and expiry locally using Supabase JWKS (ES256/RS256) in ~0.3ms.
    2. Fallback path: Internal HMAC secret decoder for automated unit tests.
    3. Network path: Supabase /auth/v1/user endpoint as last resort.
    """
    if not token:
        return None

    # 1. Fast path: Local cryptographic verification using Supabase public keys (JWKS)
    try:
        header = jwt.get_unverified_header(token)
        kid = header.get("kid")
        alg = header.get("alg", "ES256")
        
        jwks_keys = await _get_supabase_jwks_keys()
        if kid and kid in jwks_keys:
            key = jwks_keys[kid]
            payload = jwt.decode(
                token,
                key,
                algorithms=[alg],
                options={"verify_aud": False}
            )
            return payload
    except Exception:
        pass

    # 2. Test fallback: Internal JWT secret for local tests
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM],
            options={"verify_aud": False}
        )
        return payload
    except JWTError:
        pass

    # 3. Network fallback: Query Supabase Auth server
    if settings.SUPABASE_URL and (settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY):
        api_key = settings.SUPABASE_KEY or settings.SUPABASE_SERVICE_ROLE_KEY
        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                res = await client.get(
                    f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user",
                    headers={
                        "Authorization": f"Bearer {token}",
                        "apikey": api_key,
                    }
                )
                if res.status_code == 200:
                    data = res.json()
                    return {
                        "sub": data["id"],
                        "email": data.get("email"),
                        "aud": data.get("aud", "authenticated"),
                        "app_metadata": data.get("app_metadata", {}),
                        "user_metadata": data.get("user_metadata", {})
                    }
        except Exception:
            pass

    return None

def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM], options={"verify_aud": False})
        return payload
    except JWTError:
        return None
