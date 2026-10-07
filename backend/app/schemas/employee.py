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

class EmployeeUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    password: Optional[str] = None
    status: Optional[str] = None # ACTIVE, INACTIVE, SUSPENDED
    role_ids: Optional[List[UUID]] = None

class EmployeeOut(BaseModel):
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

class AssignRoleRequest(BaseModel):
    role_ids: List[UUID]
