from typing import List
from uuid import UUID
from datetime import datetime, timezone
import uuid
import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete
from app.core.config import settings
from app.core.database import get_db
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
    clean_email = data.email.lower().strip()
    
    # Check duplicate email in current business
    existing = await db.execute(
        select(User).where(
            User.business_id == current_user.business_id,
            User.email == clean_email
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="An employee with this email already exists in this salon")

    auth_user_id = uuid.uuid4()

    # 1. Provision user in Supabase Auth via Admin API
    if settings.SUPABASE_URL and settings.SUPABASE_SERVICE_ROLE_KEY:
        headers = {
            "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
            "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
            "Content-Type": "application/json"
        }
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                auth_res = await client.post(
                    f"{settings.SUPABASE_URL}/auth/v1/admin/users",
                    headers=headers,
                    json={
                        "email": clean_email,
                        "password": data.password,
                        "email_confirm": True,
                        "user_metadata": {
                            "name": data.name.strip(),
                            "role": "employee",
                            "business_id": str(current_user.business_id)
                        }
                    }
                )
                if auth_res.status_code in [200, 201]:
                    auth_user_id = UUID(auth_res.json()["id"])
                elif auth_res.status_code == 422 and "already registered" in auth_res.text:
                    raise HTTPException(status_code=400, detail="User email already registered in Supabase Auth")
                else:
                    raise HTTPException(
                        status_code=500,
                        detail=f"Failed to create user in Supabase Auth ({auth_res.status_code})"
                    )
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(status_code=503, detail="Supabase Auth service unavailable")

    # 2. Create application profile
    new_user = User(
        id=auth_user_id,
        business_id=current_user.business_id,
        name=data.name.strip(),
        email=clean_email,
        phone=data.phone.strip() if data.phone else None,
        is_owner=False,
        status="ACTIVE",
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(new_user)
    await db.flush()

    # 3. Assign roles
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

    # 4. Record audit log
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
        if settings.SUPABASE_SERVICE_ROLE_KEY and settings.SUPABASE_URL:
            try:
                headers = {
                    "apikey": settings.SUPABASE_SERVICE_ROLE_KEY,
                    "Authorization": f"Bearer {settings.SUPABASE_SERVICE_ROLE_KEY}",
                    "Content-Type": "application/json",
                }
                async with httpx.AsyncClient(timeout=10.0) as client:
                    resp = await client.put(
                        f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/admin/users/{emp.id}",
                        json={"password": data.password},
                        headers=headers,
                    )
                    if resp.status_code >= 400:
                        raise HTTPException(status_code=400, detail="Failed to update employee password in Auth service")
            except HTTPException:
                raise
            except Exception:
                raise HTTPException(status_code=503, detail="Supabase Auth service unavailable")
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
