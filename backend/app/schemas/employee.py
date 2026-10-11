from typing import List, Optional
from uuid import UUID
from datetime import datetime
from pydantic import BaseModel, EmailStr
from app.schemas.auth import RoleOut

class EmployeeCreate(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    role_ids: List[UUID] = []
    permissions: Optional[List[str]] = None
    status: Optional[str] = "ACTIVE"

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None # ACTIVE, INACTIVE, SUSPENDED, PENDING
    role_ids: Optional[List[UUID]] = None
    permissions: Optional[List[str]] = None
    has_custom_permissions: Optional[bool] = None

class EmployeeOut(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    email: str
    phone: Optional[str] = None
    is_owner: bool
    status: str
    roles: List[RoleOut] = []
    has_custom_permissions: bool = False
    permissions: List[str] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class StaffRegisterRequest(BaseModel):
    name: str
    email: EmailStr
    phone: Optional[str] = None
    password: str
    business_id: Optional[UUID] = None

class AssignRoleRequest(BaseModel):
    role_ids: List[UUID]
