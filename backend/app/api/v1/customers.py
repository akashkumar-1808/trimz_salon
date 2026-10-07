from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from app.core.database import get_db
from app.models.customer import Customer
from app.models.auth import User
from app.models.audit import AuditLog
from app.schemas.customer import CustomerCreate, CustomerUpdate, CustomerOut, CustomerSearchOut
from app.api.deps import require_permission

router = APIRouter(prefix="/customers", tags=["Customer Management"])

@router.get("/search", response_model=List[CustomerSearchOut])
async def search_customers(
    query: str = Query(..., min_length=1),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.view"))
):
    q = f"%{query.strip()}%"
    result = await db.execute(
        select(Customer)
        .where(
            Customer.business_id == current_user.business_id,
            or_(
                Customer.phone.ilike(q),
                Customer.name.ilike(q)
            )
        )
        .order_by(Customer.total_visits.desc())
        .limit(10)
    )
    return result.scalars().all()

@router.get("", response_model=List[CustomerOut])
async def list_customers(
    search: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.view"))
):
    stmt = select(Customer).where(Customer.business_id == current_user.business_id)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(or_(Customer.name.ilike(s), Customer.phone.ilike(s)))
    stmt = stmt.order_by(Customer.created_at.desc()).limit(limit).offset(offset)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=CustomerOut, status_code=status.HTTP_201_CREATED)
async def create_customer(
    data: CustomerCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.create"))
):
    clean_phone = data.phone.strip()
    # Check existing phone
    existing = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.phone == clean_phone
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="A customer with this mobile number already exists")

    new_cust = Customer(
        business_id=current_user.business_id,
        name=data.name.strip(),
        phone=clean_phone,
        email=data.email.strip() if data.email else None,
        gender=data.gender or "Unspecified",
        date_of_birth=data.date_of_birth,
        notes=data.notes,
        marketing_opt_in=data.marketing_opt_in
    )
    db.add(new_cust)
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="CUSTOMER_CREATED",
        entity_name="customer",
        entity_id=new_cust.id,
        details={"name": new_cust.name, "phone": new_cust.phone}
    ))
    await db.commit()
    await db.refresh(new_cust)
    return new_cust

@router.get("/{customer_id}", response_model=CustomerOut)
async def get_customer(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.view"))
):
    result = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.id == customer_id
        )
    )
    cust = result.scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")
    return cust

@router.patch("/{customer_id}", response_model=CustomerOut)
async def update_customer(
    customer_id: UUID,
    data: CustomerUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("customers.edit"))
):
    result = await db.execute(
        select(Customer).where(
            Customer.business_id == current_user.business_id,
            Customer.id == customer_id
        )
    )
    cust = result.scalar_one_or_none()
    if not cust:
        raise HTTPException(status_code=404, detail="Customer not found")

    if data.name is not None:
        cust.name = data.name.strip()
    if data.phone is not None:
        cust.phone = data.phone.strip()
    if data.email is not None:
        cust.email = data.email.strip()
    if data.gender is not None:
        cust.gender = data.gender
    if data.date_of_birth is not None:
        cust.date_of_birth = data.date_of_birth
    if data.notes is not None:
        cust.notes = data.notes
    if data.marketing_opt_in is not None:
        cust.marketing_opt_in = data.marketing_opt_in

    await db.commit()
    await db.refresh(cust)
    return cust
