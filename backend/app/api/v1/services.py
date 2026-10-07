from typing import List, Optional
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models.service import Service, ServiceCategory
from app.models.auth import User
from app.models.audit import AuditLog
from app.schemas.service import (
    ServiceCategoryCreate, ServiceCategoryOut,
    ServiceCreate, ServiceUpdate, ServiceOut
)
from app.api.deps import require_permission

router = APIRouter(prefix="/services", tags=["Service Catalog Management"])

@router.get("/categories", response_model=List[ServiceCategoryOut])
async def list_categories(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.view"))
):
    result = await db.execute(
        select(ServiceCategory)
        .where(ServiceCategory.business_id == current_user.business_id)
        .order_by(ServiceCategory.display_order.asc(), ServiceCategory.name.asc())
    )
    return result.scalars().all()

@router.post("/categories", response_model=ServiceCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ServiceCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.create"))
):
    cat = ServiceCategory(
        business_id=current_user.business_id,
        name=data.name.strip(),
        description=data.description,
        display_order=data.display_order
    )
    db.add(cat)
    await db.commit()
    await db.refresh(cat)
    return cat

@router.get("", response_model=List[ServiceOut])
async def list_services(
    category_id: Optional[UUID] = None,
    audience: Optional[str] = None,
    search: Optional[str] = None,
    active_only: bool = True,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.view"))
):
    stmt = (
        select(Service, ServiceCategory.name.label("category_name"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id)
    )
    if active_only:
        stmt = stmt.where(Service.is_active == True)
    if category_id:
        stmt = stmt.where(Service.category_id == category_id)
    if audience and audience != "All":
        stmt = stmt.where(Service.audience == audience)
    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(Service.name.ilike(s))

    stmt = stmt.order_by(Service.display_order.asc(), Service.name.asc())
    result = await db.execute(stmt)
    
    services_out = []
    for row in result.all():
        svc, cat_name = row[0], row[1]
        svc_dict = {
            "id": svc.id,
            "category_id": svc.category_id,
            "category_name": cat_name,
            "name": svc.name,
            "description": svc.description,
            "price": svc.price,
            "duration_minutes": svc.duration_minutes,
            "audience": svc.audience,
            "commission_rate": svc.commission_rate,
            "is_active": svc.is_active,
            "display_order": svc.display_order,
            "created_at": svc.created_at
        }
        services_out.append(ServiceOut(**svc_dict))
    return services_out

@router.post("", response_model=ServiceOut, status_code=status.HTTP_201_CREATED)
async def create_service(
    data: ServiceCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.create"))
):
    cat_res = await db.execute(
        select(ServiceCategory).where(
            ServiceCategory.business_id == current_user.business_id,
            ServiceCategory.id == data.category_id
        )
    )
    cat = cat_res.scalar_one_or_none()
    if not cat:
        raise HTTPException(status_code=400, detail="Invalid service category")

    new_svc = Service(
        business_id=current_user.business_id,
        category_id=data.category_id,
        name=data.name.strip(),
        description=data.description,
        price=data.price,
        duration_minutes=data.duration_minutes,
        audience=data.audience,
        commission_rate=data.commission_rate,
        display_order=data.display_order
    )
    db.add(new_svc)
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SERVICE_CREATED",
        entity_name="service",
        entity_id=new_svc.id,
        details={"name": new_svc.name, "price": str(new_svc.price)}
    ))
    await db.commit()
    await db.refresh(new_svc)
    return ServiceOut(
        id=new_svc.id,
        category_id=new_svc.category_id,
        category_name=cat.name,
        name=new_svc.name,
        description=new_svc.description,
        price=new_svc.price,
        duration_minutes=new_svc.duration_minutes,
        audience=new_svc.audience,
        commission_rate=new_svc.commission_rate,
        is_active=new_svc.is_active,
        display_order=new_svc.display_order,
        created_at=new_svc.created_at
    )

@router.patch("/{service_id}", response_model=ServiceOut)
async def update_service(
    service_id: UUID,
    data: ServiceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.edit"))
):
    result = await db.execute(
        select(Service, ServiceCategory.name.label("category_name"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id, Service.id == service_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="Service not found")
    svc, cat_name = row[0], row[1]

    old_price = svc.price
    if data.name is not None:
        svc.name = data.name.strip()
    if data.description is not None:
        svc.description = data.description
    if data.price is not None:
        svc.price = data.price
    if data.duration_minutes is not None:
        svc.duration_minutes = data.duration_minutes
    if data.audience is not None:
        svc.audience = data.audience
    if data.commission_rate is not None:
        svc.commission_rate = data.commission_rate
    if data.is_active is not None:
        svc.is_active = data.is_active
    if data.display_order is not None:
        svc.display_order = data.display_order

    if data.price is not None and old_price != data.price:
        db.add(AuditLog(
            business_id=current_user.business_id,
            user_id=current_user.id,
            action="SERVICE_PRICE_CHANGED",
            entity_name="service",
            entity_id=svc.id,
            details={"service": svc.name, "old_price": str(old_price), "new_price": str(svc.price)}
        ))

    await db.commit()
    await db.refresh(svc)
    return ServiceOut(
        id=svc.id,
        category_id=svc.category_id,
        category_name=cat_name,
        name=svc.name,
        description=svc.description,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        audience=svc.audience,
        commission_rate=svc.commission_rate,
        is_active=svc.is_active,
        display_order=svc.display_order,
        created_at=svc.created_at
    )
