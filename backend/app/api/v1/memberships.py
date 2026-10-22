import re
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, or_, desc

from app.core.database import get_db
from app.models.auth import User, Profile
from app.models.customer import Customer
from app.models.membership import (
    MembershipPlan,
    MembershipBenefit,
    CustomerMembership,
    MembershipPauseLog,
    MembershipUsageLedger
)
from app.api.deps import require_permission, get_current_user
from app.schemas.membership import (
    MembershipPlanOut,
    MembershipPlanCreate,
    MembershipPlanUpdate,
    MembershipBenefitOut,
    CustomerMembershipOut,
    MembershipRegisterRequest,
    MembershipPauseRequest,
    MembershipResumeRequest,
    MembershipRenewRequest,
    MembershipUpgradeRequest,
    MembershipCancelRequest,
    MembershipPauseLogOut,
    MembershipUsageLedgerOut
)
from app.services.membership import (
    register_membership,
    pause_membership,
    resume_membership,
    renew_membership,
    cancel_membership,
    get_effective_status,
    is_eligible_for_benefits,
    get_active_customer_membership
)

router = APIRouter(prefix="/memberships", tags=["Membership Management"])

# --- Membership Plans ---

@router.get("/plans", response_model=List[MembershipPlanOut])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lists all active and configured membership plans for the business."""
    stmt = (
        select(MembershipPlan)
        .where(MembershipPlan.business_id == current_user.business_id)
        .order_by(MembershipPlan.display_order.asc(), MembershipPlan.created_at.asc())
    )
    res = await db.execute(stmt)
    plans = res.scalars().all()
    return plans

@router.post("/plans", response_model=MembershipPlanOut, status_code=status.HTTP_201_CREATED)
async def create_plan(
    data: MembershipPlanCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Creates a new membership plan with benefits."""
    slug = re.sub(r"[^a-z0-9]+", "-", data.name.lower()).strip("-")
    
    # Check slug uniqueness
    slug_check = await db.execute(
        select(MembershipPlan).where(
            MembershipPlan.business_id == current_user.business_id,
            MembershipPlan.slug == slug
        )
    )
    if slug_check.scalar_one_or_none():
        slug = f"{slug}-{int(datetime.now(timezone.utc).timestamp())}"

    plan = MembershipPlan(
        business_id=current_user.business_id,
        name=data.name.strip(),
        slug=slug,
        description=data.description,
        price=data.price,
        validity_months=data.validity_months,
        discount_percent=data.discount_percent,
        discount_amount=data.discount_amount,
        min_spend=data.min_spend,
        max_discount_cap=data.max_discount_cap,
        perks_json=data.perks or [],
        display_order=data.display_order,
        is_active=True
    )
    db.add(plan)
    await db.flush()

    if data.benefits:
        for b_in in data.benefits:
            b = MembershipBenefit(
                plan_id=plan.id,
                name=b_in.name,
                benefit_type=b_in.benefit_type,
                discount_percent=b_in.discount_percent,
                discount_amount=b_in.discount_amount,
                service_id=b_in.service_id,
                category_id=b_in.category_id,
                usage_limit_type=b_in.usage_limit_type,
                usage_limit_value=b_in.usage_limit_value,
                is_active=b_in.is_active
            )
            db.add(b)
        await db.flush()

    await db.commit()
    await db.refresh(plan)
    return plan

@router.put("/plans/{plan_id}", response_model=MembershipPlanOut)
async def update_plan(
    plan_id: UUID,
    data: MembershipPlanUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Updates an existing membership plan without altering historical purchased memberships."""
    res = await db.execute(
        select(MembershipPlan).where(
            MembershipPlan.id == plan_id,
            MembershipPlan.business_id == current_user.business_id
        )
    )
    plan = res.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found.")

    if data.name is not None:
        plan.name = data.name.strip()
    if data.description is not None:
        plan.description = data.description
    if data.price is not None:
        plan.price = data.price
    if data.validity_months is not None:
        plan.validity_months = data.validity_months
    if data.discount_percent is not None:
        plan.discount_percent = data.discount_percent
    if data.discount_amount is not None:
        plan.discount_amount = data.discount_amount
    if data.min_spend is not None:
        plan.min_spend = data.min_spend
    if data.max_discount_cap is not None:
        plan.max_discount_cap = data.max_discount_cap
    if data.perks is not None:
        plan.perks_json = data.perks
    if data.is_active is not None:
        plan.is_active = data.is_active
    if data.display_order is not None:
        plan.display_order = data.display_order

    if data.benefits is not None:
        # Replace benefits
        for old_b in plan.benefits:
            await db.delete(old_b)
        for b_in in data.benefits:
            b = MembershipBenefit(
                plan_id=plan.id,
                name=b_in.name,
                benefit_type=b_in.benefit_type,
                discount_percent=b_in.discount_percent,
                discount_amount=b_in.discount_amount,
                service_id=b_in.service_id,
                category_id=b_in.category_id,
                usage_limit_type=b_in.usage_limit_type,
                usage_limit_value=b_in.usage_limit_value,
                is_active=b_in.is_active
            )
            db.add(b)

    await db.commit()
    await db.refresh(plan)
    return plan

# --- Customer Memberships Registration & Management ---

@router.post("/register", response_model=CustomerMembershipOut, status_code=status.HTTP_201_CREATED)
async def register_customer_membership(
    data: MembershipRegisterRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """
    Registers a customer for a membership plan.
    Supports existing customer reuse or new customer creation, admin date overrides, and payment method recording.
    """
    membership = await register_membership(
        db=db,
        business_id=current_user.business_id,
        staff_id=current_user.id,
        data=data
    )
    await db.commit()
    await db.refresh(membership)
    return format_membership_out(membership)

@router.get("", response_model=List[CustomerMembershipOut])
async def list_memberships(
    search: Optional[str] = Query(None, description="Search by customer name, phone, or membership number"),
    status_filter: Optional[str] = Query("ALL", description="ALL, ACTIVE, PAUSED, EXPIRED, CANCELLED"),
    plan_id: Optional[UUID] = None,
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.view"))
):
    """Lists customer memberships with real database records, search, and status filters."""
    stmt = (
        select(CustomerMembership)
        .join(Customer, CustomerMembership.customer_id == Customer.id)
        .where(CustomerMembership.business_id == current_user.business_id)
        .order_by(desc(CustomerMembership.created_at))
    )

    if plan_id:
        stmt = stmt.where(CustomerMembership.plan_id == plan_id)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        stmt = stmt.where(
            or_(
                func.lower(CustomerMembership.membership_number).like(term),
                func.lower(Customer.name).like(term),
                Customer.phone.like(term)
            )
        )

    res = await db.execute(stmt.offset(offset).limit(limit))
    memberships = res.scalars().all()

    # Apply authoritative status check and filtering
    output = []
    now_utc = datetime.now(timezone.utc)
    for m in memberships:
        eff_status = get_effective_status(m)
        if status_filter and status_filter != "ALL":
            if status_filter == "ACTIVE" and eff_status != "ACTIVE":
                continue
            elif status_filter == "PAUSED" and eff_status != "PAUSED":
                continue
            elif status_filter == "EXPIRED" and eff_status != "EXPIRED":
                continue
            elif status_filter in ("CANCELLED", "DEACTIVATED") and eff_status != "CANCELLED":
                continue
        output.append(format_membership_out(m, eff_status))

    return output

@router.get("/{membership_id}", response_model=CustomerMembershipOut)
async def get_membership_detail(
    membership_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.view"))
):
    """Fetches complete membership detail including pause logs and benefit usage ledger."""
    res = await db.execute(
        select(CustomerMembership).where(
            CustomerMembership.id == membership_id,
            CustomerMembership.business_id == current_user.business_id
        )
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found.")

    return format_membership_out(membership)

@router.post("/{membership_id}/pause", response_model=CustomerMembershipOut)
async def pause_customer_membership(
    membership_id: UUID,
    data: MembershipPauseRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Pauses an active membership and records suspension log."""
    membership = await pause_membership(
        db=db,
        business_id=current_user.business_id,
        staff_id=current_user.id,
        membership_id=membership_id,
        reason=data.reason
    )
    await db.commit()
    await db.refresh(membership)
    return format_membership_out(membership)

@router.post("/{membership_id}/resume", response_model=CustomerMembershipOut)
async def resume_customer_membership(
    membership_id: UUID,
    data: MembershipResumeRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Resumes a paused membership and extends expiry date by the paused duration."""
    membership = await resume_membership(
        db=db,
        business_id=current_user.business_id,
        staff_id=current_user.id,
        membership_id=membership_id,
        reason=data.reason
    )
    await db.commit()
    await db.refresh(membership)
    return format_membership_out(membership)

@router.post("/{membership_id}/renew", response_model=CustomerMembershipOut)
async def renew_customer_membership(
    membership_id: UUID,
    data: MembershipRenewRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Renews a customer membership extending validity."""
    membership = await renew_membership(
        db=db,
        business_id=current_user.business_id,
        staff_id=current_user.id,
        membership_id=membership_id,
        data=data
    )
    await db.commit()
    await db.refresh(membership)
    return format_membership_out(membership)

@router.post("/{membership_id}/cancel", response_model=CustomerMembershipOut)
async def cancel_customer_membership(
    membership_id: UUID,
    data: MembershipCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("memberships.manage"))
):
    """Deactivates/cancels a membership safely while retaining all historical billing data."""
    membership = await cancel_membership(
        db=db,
        business_id=current_user.business_id,
        staff_id=current_user.id,
        membership_id=membership_id,
        reason=data.reason
    )
    await db.commit()
    await db.refresh(membership)
    return format_membership_out(membership)

@router.get("/customer/{customer_id}/eligible")
async def get_customer_eligible_membership(
    customer_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.create"))
):
    """POS endpoint to detect active membership and benefits when customer is selected."""
    active_m = await get_active_customer_membership(db, current_user.business_id, customer_id)
    if not active_m:
        return {"has_membership": False, "membership": None}

    eff_status = get_effective_status(active_m)
    return {
        "has_membership": True,
        "is_eligible": eff_status == "ACTIVE",
        "membership": format_membership_out(active_m, eff_status)
    }

@router.get("/customer/by-phone/{phone}/eligible")
async def get_customer_eligible_membership_by_phone(
    phone: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permission("billing.create"))
):
    """POS endpoint to detect active membership when entering customer phone number."""
    clean_phone = phone.strip()
    cust_res = await db.execute(
        select(Customer).where(
            Customer.phone == clean_phone,
            Customer.business_id == current_user.business_id
        )
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        return {"has_membership": False, "customer": None, "membership": None}

    active_m = await get_active_customer_membership(db, current_user.business_id, customer.id)
    if not active_m:
        return {
            "has_membership": False,
            "customer": {"id": str(customer.id), "name": customer.name, "phone": customer.phone},
            "membership": None
        }

    eff_status = get_effective_status(active_m)
    return {
        "has_membership": True,
        "is_eligible": eff_status == "ACTIVE",
        "customer": {"id": str(customer.id), "name": customer.name, "phone": customer.phone},
        "membership": format_membership_out(active_m, eff_status)
    }

def format_membership_out(m: CustomerMembership, eff_status: Optional[str] = None) -> CustomerMembershipOut:
    status_str = eff_status or get_effective_status(m)
    return CustomerMembershipOut(
        id=m.id,
        business_id=m.business_id,
        customer_id=m.customer_id,
        customer_name=m.customer.name if m.customer else None,
        customer_phone=m.customer.phone if m.customer else None,
        plan_id=m.plan_id,
        plan_name=m.plan_snapshot.get("name") if m.plan_snapshot else (m.plan.name if m.plan else "Plan"),
        membership_number=m.membership_number,
        status=status_str,
        is_effective_active=(status_str == "ACTIVE"),
        start_date=m.start_date,
        expiry_date=m.expiry_date,
        original_duration_months=m.original_duration_months,
        purchase_price=m.purchase_price,
        payment_method=m.payment_method,
        payment_reference=m.payment_reference,
        plan_snapshot=m.plan_snapshot or {},
        notes=m.notes,
        created_by_name=m.created_by.name if m.created_by else None,
        created_at=m.created_at,
        updated_at=m.updated_at,
        pause_logs=[
            MembershipPauseLogOut(
                id=p.id,
                membership_id=p.membership_id,
                paused_at=p.paused_at,
                resumed_at=p.resumed_at,
                paused_by_id=p.paused_by_id,
                paused_by_name=p.paused_by.name if p.paused_by else None,
                resumed_by_id=p.resumed_by_id,
                resumed_by_name=p.resumed_by.name if p.resumed_by else None,
                paused_reason=p.paused_reason,
                resumed_reason=p.resumed_reason,
                duration_days_extended=p.duration_days_extended,
                created_at=p.created_at
            ) for p in m.pause_logs
        ] if m.pause_logs else [],
        usage_entries=[
            MembershipUsageLedgerOut(
                id=u.id,
                membership_id=u.membership_id,
                benefit_id=u.benefit_id,
                benefit_name=u.benefit_name,
                benefit_type=u.benefit_type,
                sale_id=u.sale_id,
                sale_item_id=u.sale_item_id,
                quantity_used=u.quantity_used,
                discount_applied=u.discount_applied,
                is_reversal=u.is_reversal,
                reversal_for_id=u.reversal_for_id,
                created_at=u.created_at
            ) for u in m.usage_entries
        ] if m.usage_entries else []
    )
