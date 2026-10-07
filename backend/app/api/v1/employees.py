from typing import List
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.database import get_db
from app.core.security import get_password_hash
from app.models.auth import User, Role, UserRole
from app.models.audit import AuditLog
from app.schemas.employee import EmployeeCreate, EmployeeUpdate, EmployeeOut, AssignRoleRequest
from app.api.deps import get_current_user, require_permission

router = APIRouter(prefix="/employees", tags=["Employee Management"])

@router.get("", response_model=List[EmployeeOut])
async def list_employees(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employees.view"))
):
    result = await db.execute(
        select(User)
        .where(User.business_id == current_user.business_id)
        .order_by(User.is_owner.desc(), User.created_at.desc())
    )
    return result.scalars().all()

@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    data: EmployeeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employees.create"))
):
    # Check duplicate email
    existing = await db.execute(
        select(User).where(
            User.business_id == current_user.business_id,
            User.email == data.email.lower()
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An employee with this email already exists")

    new_user = User(
        business_id=current_user.business_id,
        name=data.name.strip(),
        email=data.email.lower().strip(),
        phone=data.phone.strip() if data.phone else None,
        password_hash=get_password_hash(data.password),
        is_owner=False,
        status="ACTIVE"
    )
    db.add(new_user)
    await db.flush()

    # Assign roles
    if data.role_ids:
        roles_res = await db.execute(
            select(Role).where(
                Role.business_id == current_user.business_id,
                Role.id.in_(data.role_ids)
            )
        )
        matched_roles = roles_res.scalars().all()
        for role in matched_roles:
            db.add(UserRole(user_id=new_user.id, role_id=role.id))

    # Audit log
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="EMPLOYEE_CREATED",
        entity_name="user",
        entity_id=new_user.id,
        details={"email": new_user.email, "name": new_user.name}
    ))

    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.get("/{employee_id}", response_model=EmployeeOut)
async def get_employee(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employees.view"))
):
    result = await db.execute(
        select(User).where(User.business_id == current_user.business_id, User.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")
    return emp

@router.patch("/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: UUID,
    data: EmployeeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employees.edit"))
):
    result = await db.execute(
        select(User).where(User.business_id == current_user.business_id, User.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.is_owner and not current_user.is_owner:
        raise HTTPException(status_code=403, detail="Cannot modify the primary owner account")

    if data.name is not None:
        emp.name = data.name.strip()
    if data.email is not None:
        emp.email = data.email.lower().strip()
    if data.phone is not None:
        emp.phone = data.phone.strip()
    if data.password:
        emp.password_hash = get_password_hash(data.password)
    if data.status and not emp.is_owner:
        emp.status = data.status

    if data.role_ids is not None and not emp.is_owner:
        # Re-assign roles
        await db.execute(delete(UserRole).where(UserRole.user_id == emp.id))
        roles_res = await db.execute(
            select(Role).where(
                Role.business_id == current_user.business_id,
                Role.id.in_(data.role_ids)
            )
        )
        for role in roles_res.scalars().all():
            db.add(UserRole(user_id=emp.id, role_id=role.id))

    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="EMPLOYEE_UPDATED",
        entity_name="user",
        entity_id=emp.id,
        details={"name": emp.name, "status": emp.status}
    ))

    await db.commit()
    await db.refresh(emp)
    return emp

@router.delete("/{employee_id}", status_code=status.HTTP_204_NO_CONTENT)
async def deactivate_employee(
    employee_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("employees.delete"))
):
    result = await db.execute(
        select(User).where(User.business_id == current_user.business_id, User.id == employee_id)
    )
    emp = result.scalar_one_or_none()
    if not emp:
        raise HTTPException(status_code=404, detail="Employee not found")

    if emp.is_owner:
        raise HTTPException(status_code=400, detail="Cannot deactivate the owner account")

    emp.status = "INACTIVE"
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="EMPLOYEE_DEACTIVATED",
        entity_name="user",
        entity_id=emp.id
    ))
    await db.commit()
