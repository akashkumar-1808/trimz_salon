from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel
from app.schemas.auth import PermissionOut

class RoleCreate(BaseModel):
    name: str
    description: Optional[str] = None
    permission_ids: List[UUID] = []

class RoleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    permission_ids: Optional[List[UUID]] = None

class RoleDetailOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    is_system: bool
    permissions: List[PermissionOut] = []

    class Config:
        from_attributes = True

class PermissionGroup(BaseModel):
    module: str
    permissions: List[PermissionOut]
