import re
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

def slugify(text: str) -> str:
    cleaned = re.sub(r'[^a-zA-Z0-9]+', '-', text).strip('-').lower()
    return cleaned or "item"

@router.get("/categories", response_model=List[ServiceCategoryOut])
async def list_categories(
    department: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.view"))
):
    stmt = select(ServiceCategory).where(ServiceCategory.business_id == current_user.business_id)
    if department and department.lower() != "all":
        stmt = stmt.where(ServiceCategory.department.ilike(department))
    stmt = stmt.order_by(ServiceCategory.display_order.asc(), ServiceCategory.name.asc())
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("/categories", response_model=ServiceCategoryOut, status_code=status.HTTP_201_CREATED)
async def create_category(
    data: ServiceCategoryCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.create"))
):
    dept = data.department or "Unisex"
    slug_val = data.slug or slugify(f"{dept}-{data.name}")
    cat = ServiceCategory(
        business_id=current_user.business_id,
        name=data.name.strip(),
        slug=slug_val,
        department=dept,
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
    target_gender: Optional[str] = None,
    department: Optional[str] = None,
    status: Optional[str] = None,
    search: Optional[str] = None,
    active_only: Optional[bool] = None,
    include_deleted: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.view"))
):
    stmt = (
        select(Service, ServiceCategory.name.label("category_name"), ServiceCategory.department.label("cat_dept"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id)
    )
    if not include_deleted:
        stmt = stmt.where(Service.is_deleted == False)

    # Status / active_only filtering
    if status and status.lower() != "all":
        st = status.strip().lower()
        if st == "active":
            stmt = stmt.where(Service.is_active == True)
        elif st in ("paused", "inactive"):
            stmt = stmt.where(Service.is_active == False)
    elif active_only is not None:
        if active_only:
            stmt = stmt.where(Service.is_active == True)
        else:
            # Explicitly false: return all non-deleted (both active and paused)
            pass

    if category_id:
        stmt = stmt.where(Service.category_id == category_id)
    
    # Audience / target_gender filtering
    aud = audience or target_gender
    if aud and aud.lower() != "all":
        aud_val = aud.strip().lower()
        if aud_val in ("men", "male"):
            stmt = stmt.where(Service.audience.in_(["Male", "Unisex"]))
        elif aud_val in ("women", "female"):
            stmt = stmt.where(Service.audience.in_(["Female", "Unisex"]))
        elif aud_val == "kids":
            stmt = stmt.where(Service.audience.in_(["Kids", "Unisex"]))
        else:
            stmt = stmt.where(Service.audience.ilike(aud))

    if department and department.lower() != "all":
        stmt = stmt.where(ServiceCategory.department.ilike(department))

    if search:
        s = f"%{search.strip()}%"
        stmt = stmt.where(Service.name.ilike(s))

    stmt = stmt.order_by(Service.display_order.asc(), Service.name.asc())
    result = await db.execute(stmt)
    
    services_out = []
    for row in result.all():
        svc, cat_name = row[0], row[1]
        tg = "men" if svc.audience == "Male" else "women" if svc.audience == "Female" else "all"
        svc_dict = {
            "id": svc.id,
            "category_id": svc.category_id,
            "category_name": cat_name,
            "name": svc.name,
            "slug": svc.slug,
            "variant_name": svc.variant_name,
            "description": svc.description,
            "price": svc.price,
            "duration_minutes": svc.duration_minutes,
            "audience": svc.audience,
            "target_gender": tg,
            "commission_rate": svc.commission_rate,
            "is_variable_price": svc.is_variable_price if svc.is_variable_price is not None else False,
            "combo_items": svc.combo_items,
            "is_active": svc.is_active,
            "is_deleted": svc.is_deleted if svc.is_deleted is not None else False,
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

    name_clean = data.name.strip()
    variant = data.variant_name.strip() if data.variant_name else None
    slug_text = f"{cat.name}-{name_clean}-{variant}" if variant else f"{cat.name}-{name_clean}"
    slug_val = data.slug or slugify(slug_text)

    new_svc = Service(
        business_id=current_user.business_id,
        category_id=data.category_id,
        name=name_clean,
        slug=slug_val,
        variant_name=variant,
        description=data.description,
        price=data.price,
        duration_minutes=data.duration_minutes,
        audience=data.audience,
        commission_rate=data.commission_rate,
        is_variable_price=data.is_variable_price,
        combo_items=data.combo_items,
        is_active=True,
        is_deleted=False,
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
    tg = "men" if new_svc.audience == "Male" else "women" if new_svc.audience == "Female" else "all"
    return ServiceOut(
        id=new_svc.id,
        category_id=new_svc.category_id,
        category_name=cat.name,
        name=new_svc.name,
        slug=new_svc.slug,
        variant_name=new_svc.variant_name,
        description=new_svc.description,
        price=new_svc.price,
        duration_minutes=new_svc.duration_minutes,
        audience=new_svc.audience,
        target_gender=tg,
        commission_rate=new_svc.commission_rate,
        is_variable_price=new_svc.is_variable_price,
        combo_items=new_svc.combo_items,
        is_active=new_svc.is_active,
        is_deleted=new_svc.is_deleted,
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
    if not row or (row[0].is_deleted and data.is_deleted is not False):
        raise HTTPException(status_code=404, detail="Service not found")
    svc, cat_name = row[0], row[1]

    old_price = svc.price
    old_active = svc.is_active

    if data.name is not None:
        svc.name = data.name.strip()
    if data.slug is not None:
        svc.slug = data.slug
    if data.variant_name is not None:
        svc.variant_name = data.variant_name.strip()
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
    if data.is_variable_price is not None:
        svc.is_variable_price = data.is_variable_price
    if data.combo_items is not None:
        svc.combo_items = data.combo_items
    if data.is_active is not None:
        svc.is_active = data.is_active
    if data.is_deleted is not None:
        svc.is_deleted = data.is_deleted
        if data.is_deleted:
            svc.is_active = False
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

    if data.is_active is not None and old_active != data.is_active:
        action_name = "SERVICE_RESUMED" if data.is_active else "SERVICE_PAUSED"
        db.add(AuditLog(
            business_id=current_user.business_id,
            user_id=current_user.id,
            action=action_name,
            entity_name="service",
            entity_id=svc.id,
            details={"service": svc.name, "is_active": data.is_active}
        ))

    await db.commit()
    await db.refresh(svc)
    tg = "men" if svc.audience == "Male" else "women" if svc.audience == "Female" else "all"
    return ServiceOut(
        id=svc.id,
        category_id=svc.category_id,
        category_name=cat_name,
        name=svc.name,
        slug=svc.slug,
        variant_name=svc.variant_name,
        description=svc.description,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        audience=svc.audience,
        target_gender=tg,
        commission_rate=svc.commission_rate,
        is_variable_price=svc.is_variable_price,
        combo_items=svc.combo_items,
        is_active=svc.is_active,
        is_deleted=svc.is_deleted,
        display_order=svc.display_order,
        created_at=svc.created_at
    )

@router.post("/{service_id}/pause", response_model=ServiceOut)
async def pause_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.edit"))
):
    result = await db.execute(
        select(Service, ServiceCategory.name.label("category_name"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id, Service.id == service_id)
    )
    row = result.first()
    if not row or row[0].is_deleted:
        raise HTTPException(status_code=404, detail="Service not found")
    svc, cat_name = row[0], row[1]

    svc.is_active = False
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SERVICE_PAUSED",
        entity_name="service",
        entity_id=svc.id,
        details={"service": svc.name, "is_active": False}
    ))
    await db.commit()
    await db.refresh(svc)

    tg = "men" if svc.audience == "Male" else "women" if svc.audience == "Female" else "all"
    return ServiceOut(
        id=svc.id,
        category_id=svc.category_id,
        category_name=cat_name,
        name=svc.name,
        slug=svc.slug,
        variant_name=svc.variant_name,
        description=svc.description,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        audience=svc.audience,
        target_gender=tg,
        commission_rate=svc.commission_rate,
        is_variable_price=svc.is_variable_price,
        combo_items=svc.combo_items,
        is_active=svc.is_active,
        is_deleted=svc.is_deleted,
        display_order=svc.display_order,
        created_at=svc.created_at
    )

@router.post("/{service_id}/resume", response_model=ServiceOut)
async def resume_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.edit"))
):
    result = await db.execute(
        select(Service, ServiceCategory.name.label("category_name"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id, Service.id == service_id)
    )
    row = result.first()
    if not row or row[0].is_deleted:
        raise HTTPException(status_code=404, detail="Service not found")
    svc, cat_name = row[0], row[1]

    svc.is_active = True
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SERVICE_RESUMED",
        entity_name="service",
        entity_id=svc.id,
        details={"service": svc.name, "is_active": True}
    ))
    await db.commit()
    await db.refresh(svc)

    tg = "men" if svc.audience == "Male" else "women" if svc.audience == "Female" else "all"
    return ServiceOut(
        id=svc.id,
        category_id=svc.category_id,
        category_name=cat_name,
        name=svc.name,
        slug=svc.slug,
        variant_name=svc.variant_name,
        description=svc.description,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        audience=svc.audience,
        target_gender=tg,
        commission_rate=svc.commission_rate,
        is_variable_price=svc.is_variable_price,
        combo_items=svc.combo_items,
        is_active=svc.is_active,
        is_deleted=svc.is_deleted,
        display_order=svc.display_order,
        created_at=svc.created_at
    )

@router.delete("/{service_id}", response_model=ServiceOut)
async def remove_service(
    service_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("services.delete"))
):
    result = await db.execute(
        select(Service, ServiceCategory.name.label("category_name"))
        .join(ServiceCategory, Service.category_id == ServiceCategory.id)
        .where(Service.business_id == current_user.business_id, Service.id == service_id)
    )
    row = result.first()
    if not row or row[0].is_deleted:
        raise HTTPException(status_code=404, detail="Service not found")
    svc, cat_name = row[0], row[1]

    # Soft delete so historical bills, invoices and sales records remain 100% intact
    svc.is_deleted = True
    svc.is_active = False
    db.add(AuditLog(
        business_id=current_user.business_id,
        user_id=current_user.id,
        action="SERVICE_DELETED",
        entity_name="service",
        entity_id=svc.id,
        details={"service": svc.name, "soft_deleted": True}
    ))
    await db.commit()
    await db.refresh(svc)

    tg = "men" if svc.audience == "Male" else "women" if svc.audience == "Female" else "all"
    return ServiceOut(
        id=svc.id,
        category_id=svc.category_id,
        category_name=cat_name,
        name=svc.name,
        slug=svc.slug,
        variant_name=svc.variant_name,
        description=svc.description,
        price=svc.price,
        duration_minutes=svc.duration_minutes,
        audience=svc.audience,
        target_gender=tg,
        commission_rate=svc.commission_rate,
        is_variable_price=svc.is_variable_price,
        combo_items=svc.combo_items,
        is_active=svc.is_active,
        is_deleted=svc.is_deleted,
        display_order=svc.display_order,
        created_at=svc.created_at
    )
