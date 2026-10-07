from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class PermissionOut(BaseModel):
    id: UUID
    code: str
    name: str
    module: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class RoleOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_system: bool = False
    permissions: List[PermissionOut] = []

    class Config:
        from_attributes = True

class UserOut(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    is_owner: bool
    status: str
    roles: List[RoleOut] = []
    created_at: datetime

    class Config:
        from_attributes = True

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    permissions: List[str]

class MeResponse(BaseModel):
    user: UserOut
    permissions: List[str]
    is_owner: bool
