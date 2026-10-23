from typing import List, Dict
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.models.auth import Role, Permission, RolePermission, User
from app.models.audit import AuditLog
from app.schemas.role import RoleCreate, RoleUpdate, RoleDetailOut, PermissionGroup
from app.schemas.auth import PermissionOut
from app.api.deps import require_permission, get_current_user

router = APIRouter(prefix="/roles", tags=["Role & Permission Management"])

@router.get("", response_model=List[RoleDetailOut])
async def list_roles(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles.view"))
):
    result = await db.execute(
        select(Role)
        .where(Role.business_id == current_user.business_id)
        .order_by(Role.is_system.desc(), Role.name.asc())
    )
    return result.scalars().all()

@router.get("/permissions/catalogue", response_model=List[PermissionGroup])
async def get_permissions_catalogue(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Permission).order_by(Permission.module.asc(), Permission.code.asc()))
    all_perms = result.scalars().all()

    grouped: Dict[str, List[PermissionOut]] = {}
    for p in all_perms:
        grouped.setdefault(p.module, []).append(PermissionOut.model_validate(p))

    return [PermissionGroup(module=mod, permissions=perms) for mod, perms in grouped.items()]

@router.post("", response_model=RoleDetailOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    data: RoleCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage"))
):
    existing = await db.execute(
        select(Role).where(
            Role.business_id == current_user.business_id,
            Role.name == data.name.strip()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A role with this name already exists")

    new_role = Role(
        business_id=current_user.business_id,
        name=data.name.strip(),
        description=data.description,
        is_system=False
    )
    db.add(new_role)
    await db.flush()

    if data.permission_ids:
        for pid in data.permission_ids:
            db.add(RolePermission(role_id=new_role.id, permission_id=pid))

    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="ROLE_CREATED",
        entity_name="role",
        entity_id=new_role.id,
        details={"name": new_role.name, "permission_count": len(data.permission_ids)}
    ))

    await db.commit()
    await db.refresh(new_role)
    return new_role

@router.patch("/{role_id}", response_model=RoleDetailOut)
async def update_role(
    role_id: UUID,
    data: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("roles.manage"))
):
    result = await db.execute(
        select(Role).where(Role.business_id == current_user.business_id, Role.id == role_id)
    )
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role.is_system and role.name == "Owner":
        raise HTTPException(status_code=400, detail="The Owner role permissions cannot be modified")

    if data.name:
        role.name = data.name.strip()
    if data.description is not None:
        role.description = data.description

    if data.permission_ids is not None:
        await db.execute(delete(RolePermission).where(RolePermission.role_id == role.id))
        for pid in data.permission_ids:
            db.add(RolePermission(role_id=role.id, permission_id=pid))

    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="ROLE_UPDATED",
        entity_name="role",
        entity_id=role.id,
        details={"name": role.name}
    ))

    await db.commit()
    await db.refresh(role)
    return role
