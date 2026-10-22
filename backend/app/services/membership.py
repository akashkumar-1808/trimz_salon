import math
from datetime import datetime, timezone, timedelta
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_, desc
from fastapi import HTTPException, status

from app.models.business import Business
from app.models.customer import Customer
from app.models.service import Service
from app.models.sale import Sale, SaleItem
from app.models.auth import Profile
from app.models.membership import (
    MembershipPlan,
    MembershipBenefit,
    CustomerMembership,
    MembershipPauseLog,
    MembershipUsageLedger
)
from app.schemas.membership import (
    MembershipRegisterRequest,
    MembershipPauseRequest,
    MembershipResumeRequest,
    MembershipRenewRequest,
    MembershipUpgradeRequest,
    MembershipCancelRequest,
    BillCalculateRequest,
    BillCalculationItemOut,
    BillCalculationSummary
)

def round_curr(val: Decimal) -> Decimal:
    """Helper to round currency to 2 decimal places with standard half-up rounding."""
    return Decimal(str(val)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)

async def generate_membership_number(db: AsyncSession, business_id: UUID) -> str:
    """Generates a sequential human-readable membership number like TZ-M-2026-0001."""
    year_str = datetime.now(timezone.utc).strftime("%Y")
    count_res = await db.execute(
        select(func.count(CustomerMembership.id)).where(
            CustomerMembership.business_id == business_id
        )
    )
    total_count = (count_res.scalar() or 0) + 1
    return f"TZ-M-{year_str}-{total_count:04d}"

def get_effective_status(membership: CustomerMembership) -> str:
    """Computes authoritative real-time membership status using server UTC time."""
    if membership.status in ("CANCELLED", "DEACTIVATED"):
        return "CANCELLED"
    if membership.status == "PAUSED":
        return "PAUSED"
    
    now_utc = datetime.now(timezone.utc)
    if membership.expiry_date and membership.expiry_date < now_utc:
        return "EXPIRED"
    if membership.start_date and membership.start_date > now_utc:
        return "PENDING"
    
    return "ACTIVE"

def is_eligible_for_benefits(membership: CustomerMembership) -> bool:
    """Returns True if membership can currently receive benefit discounts."""
    return get_effective_status(membership) == "ACTIVE"

async def get_active_customer_membership(
    db: AsyncSession,
    business_id: UUID,
    customer_id: UUID,
    for_update: bool = False
) -> Optional[CustomerMembership]:
    """Retrieves current customer membership for the business with authoritative status."""
    stmt = (
        select(CustomerMembership)
        .where(
            CustomerMembership.business_id == business_id,
            CustomerMembership.customer_id == customer_id,
            CustomerMembership.status.in_(["ACTIVE", "PAUSED"])
        )
        .order_by(desc(CustomerMembership.created_at))
    )
    if for_update:
        stmt = stmt.with_for_update()
    
    res = await db.execute(stmt)
    membership = res.scalars().first()
    return membership

async def register_membership(
    db: AsyncSession,
    business_id: UUID,
    staff_id: Optional[UUID],
    data: MembershipRegisterRequest
) -> CustomerMembership:
    """Registers a new membership for an existing or newly created customer."""
    now_utc = datetime.now(timezone.utc)
    clean_phone = data.customer_phone.strip()

    # 1. Resolve or create customer
    cust_res = await db.execute(
        select(Customer).where(
            Customer.business_id == business_id,
            Customer.phone == clean_phone
        )
    )
    customer = cust_res.scalar_one_or_none()
    if not customer:
        customer = Customer(
            business_id=business_id,
            name=data.customer_name.strip() if data.customer_name else "Valued Member",
            phone=clean_phone
        )
        db.add(customer)
        await db.flush()
    elif data.customer_name and data.customer_name.strip() and customer.name != data.customer_name.strip():
        customer.name = data.customer_name.strip()

    # 2. Check for existing active membership
    existing_active = await get_active_customer_membership(db, business_id, customer.id)
    if existing_active and get_effective_status(existing_active) == "ACTIVE":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Customer already has an active membership ({existing_active.membership_number}). Use renew or upgrade."
        )

    # 3. Load Plan
    plan_res = await db.execute(
        select(MembershipPlan).where(
            MembershipPlan.id == data.plan_id,
            MembershipPlan.business_id == business_id
        )
    )
    plan = plan_res.scalar_one_or_none()
    if not plan or not plan.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Membership plan not found or inactive."
        )

    # 4. Compute dates with Admin override support
    start_dt = data.start_date if data.start_date else now_utc
    if start_dt.tzinfo is None:
        start_dt = start_dt.replace(tzinfo=timezone.utc)
        
    if data.expiry_date:
        expiry_dt = data.expiry_date
        if expiry_dt.tzinfo is None:
            expiry_dt = expiry_dt.replace(tzinfo=timezone.utc)
    else:
        # Approximate months as 30.5 days per month
        duration_days = int(plan.validity_months * 30.5)
        expiry_dt = start_dt + timedelta(days=duration_days)

    purchase_price = data.purchase_price if data.purchase_price is not None else plan.price

    # 5. Snapshot plan and perks at time of purchase
    benefits_data = []
    for b in plan.benefits:
        if b.is_active:
            benefits_data.append({
                "id": str(b.id),
                "name": b.name,
                "benefit_type": b.benefit_type,
                "discount_percent": float(b.discount_percent) if b.discount_percent is not None else None,
                "discount_amount": float(b.discount_amount) if b.discount_amount is not None else None,
                "service_id": str(b.service_id) if b.service_id else None,
                "category_id": str(b.category_id) if b.category_id else None,
                "usage_limit_type": b.usage_limit_type,
                "usage_limit_value": b.usage_limit_value,
            })

    plan_snapshot = {
        "plan_id": str(plan.id),
        "name": plan.name,
        "slug": plan.slug,
        "price": float(plan.price),
        "validity_months": plan.validity_months,
        "discount_percent": float(plan.discount_percent),
        "discount_amount": float(plan.discount_amount),
        "min_spend": float(plan.min_spend),
        "max_discount_cap": float(plan.max_discount_cap) if plan.max_discount_cap else None,
        "perks": plan.perks_json or [],
        "benefits": benefits_data
    }

    membership_num = await generate_membership_number(db, business_id)

    membership = CustomerMembership(
        business_id=business_id,
        customer_id=customer.id,
        plan_id=plan.id,
        membership_number=membership_num,
        status="ACTIVE",
        start_date=start_dt,
        expiry_date=expiry_dt,
        original_duration_months=plan.validity_months,
        purchase_price=Decimal(str(purchase_price)),
        payment_method=data.payment_method,
        payment_reference=data.payment_reference,
        plan_snapshot=plan_snapshot,
        notes=data.notes,
        created_by_id=staff_id
    )
    db.add(membership)
    await db.flush()
    return membership

async def pause_membership(
    db: AsyncSession,
    business_id: UUID,
    staff_id: Optional[UUID],
    membership_id: UUID,
    reason: Optional[str]
) -> CustomerMembership:
    """Pauses an active membership and logs the suspension."""
    res = await db.execute(
        select(CustomerMembership).where(
            CustomerMembership.id == membership_id,
            CustomerMembership.business_id == business_id
        ).with_for_update()
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found.")

    eff_status = get_effective_status(membership)
    if eff_status != "ACTIVE":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot pause membership in status {eff_status}."
        )

    now_utc = datetime.now(timezone.utc)
    pause_log = MembershipPauseLog(
        membership_id=membership.id,
        paused_at=now_utc,
        paused_by_id=staff_id,
        paused_reason=reason or "Customer request"
    )
    db.add(pause_log)
    membership.status = "PAUSED"
    await db.flush()
    return membership

async def resume_membership(
    db: AsyncSession,
    business_id: UUID,
    staff_id: Optional[UUID],
    membership_id: UUID,
    reason: Optional[str]
) -> CustomerMembership:
    """Resumes a paused membership and extends the expiry by the paused duration."""
    res = await db.execute(
        select(CustomerMembership).where(
            CustomerMembership.id == membership_id,
            CustomerMembership.business_id == business_id
        ).with_for_update()
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found.")

    if membership.status != "PAUSED":
        raise HTTPException(
            status_code=400,
            detail="Membership is not currently paused."
        )

    now_utc = datetime.now(timezone.utc)
    # Find latest unclosed pause log
    log_res = await db.execute(
        select(MembershipPauseLog).where(
            MembershipPauseLog.membership_id == membership.id,
            MembershipPauseLog.resumed_at.is_(None)
        ).order_by(desc(MembershipPauseLog.paused_at))
    )
    pause_log = log_res.scalars().first()

    days_extended = 0
    if pause_log:
        elapsed_seconds = (now_utc - pause_log.paused_at).total_seconds()
        days_extended = max(1, math.ceil(elapsed_seconds / 86400))
        pause_log.resumed_at = now_utc
        pause_log.resumed_by_id = staff_id
        pause_log.resumed_reason = reason or "Customer resumed"
        pause_log.duration_days_extended = days_extended

    # Extend expiry
    membership.expiry_date = membership.expiry_date + timedelta(days=days_extended)
    membership.status = "ACTIVE"
    await db.flush()
    return membership

async def renew_membership(
    db: AsyncSession,
    business_id: UUID,
    staff_id: Optional[UUID],
    membership_id: UUID,
    data: MembershipRenewRequest
) -> CustomerMembership:
    """Renews a membership by extending duration from current expiry or now."""
    res = await db.execute(
        select(CustomerMembership).where(
            CustomerMembership.id == membership_id,
            CustomerMembership.business_id == business_id
        ).with_for_update()
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found.")

    now_utc = datetime.now(timezone.utc)
    base_date = membership.expiry_date if membership.expiry_date > now_utc else now_utc

    months = data.extension_months or membership.original_duration_months or 12
    days_to_add = int(months * 30.5)
    membership.expiry_date = base_date + timedelta(days=days_to_add)
    membership.status = "ACTIVE"
    if data.notes:
        membership.notes = f"{membership.notes or ''}\n[Renewed on {now_utc.strftime('%Y-%m-%d')}]: {data.notes}".strip()
    
    await db.flush()
    return membership

async def cancel_membership(
    db: AsyncSession,
    business_id: UUID,
    staff_id: Optional[UUID],
    membership_id: UUID,
    reason: str
) -> CustomerMembership:
    """Safely cancels a membership without deleting any historical financial records."""
    res = await db.execute(
        select(CustomerMembership).where(
            CustomerMembership.id == membership_id,
            CustomerMembership.business_id == business_id
        ).with_for_update()
    )
    membership = res.scalar_one_or_none()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found.")

    now_utc = datetime.now(timezone.utc)
    membership.status = "CANCELLED"
    membership.notes = f"{membership.notes or ''}\n[Cancelled on {now_utc.strftime('%Y-%m-%d')} by {staff_id}]: {reason}".strip()
    await db.flush()
    return membership

async def calculate_membership_benefits(
    db: AsyncSession,
    business_id: UUID,
    customer_phone: Optional[str],
    customer_id: Optional[UUID],
    items_in: List[Any],
    overall_discount: Decimal,
    discount_reason: Optional[str],
    apply_tax: bool,
    for_checkout: bool = False
) -> BillCalculationSummary:
    """
    Authoritative server-side calculation of services, catalogue prices,
    eligible membership benefits, complimentary services, discount stacking, and tax.
    """
    # 1. Fetch Business Profile for tax configuration
    biz_res = await db.execute(select(Business).where(Business.id == business_id))
    business = biz_res.scalar_one_or_none()
    if not business:
        raise HTTPException(status_code=500, detail="Business configuration missing.")

    # 2. Resolve Customer if provided
    customer = None
    if customer_id:
        cust_res = await db.execute(
            select(Customer).where(
                Customer.id == customer_id,
                Customer.business_id == business_id
            )
        )
        customer = cust_res.scalar_one_or_none()
    elif customer_phone and customer_phone.strip():
        clean_phone = customer_phone.strip()
        cust_res = await db.execute(
            select(Customer).where(
                Customer.phone == clean_phone,
                Customer.business_id == business_id
            )
        )
        customer = cust_res.scalar_one_or_none()

    # 3. Check for eligible customer membership
    active_membership = None
    if customer:
        active_membership = await get_active_customer_membership(
            db, business_id, customer.id, for_update=for_checkout
        )

    membership_eligible = False
    membership_snapshot = None
    membership_benefits_list = []
    plan_discount_pct = Decimal("0.00")
    max_discount_cap = None

    if active_membership and is_eligible_for_benefits(active_membership):
        membership_eligible = True
        membership_snapshot = active_membership.plan_snapshot or {}
        plan_discount_pct = Decimal(str(membership_snapshot.get("discount_percent", 0.00)))
        if membership_snapshot.get("max_discount_cap"):
            max_discount_cap = Decimal(str(membership_snapshot.get("max_discount_cap")))
        membership_benefits_list = membership_snapshot.get("benefits", [])

    # 4. Preload past usage for this membership if limit types apply
    usage_counts = {}
    if membership_eligible and active_membership:
        ledger_res = await db.execute(
            select(
                MembershipUsageLedger.benefit_id,
                func.sum(MembershipUsageLedger.quantity_used)
            )
            .where(
                MembershipUsageLedger.membership_id == active_membership.id,
                MembershipUsageLedger.is_reversal == False
            )
            .group_by(MembershipUsageLedger.benefit_id)
        )
        for row in ledger_res.all():
            if row[0]:
                usage_counts[str(row[0])] = int(row[1] or 0)

    # 5. Authoritatively resolve line items from Catalogue
    calculated_items: List[BillCalculationItemOut] = []
    total_membership_discount = Decimal("0.00")
    subtotal = Decimal("0.00")

    # Track usage consumed within this current calculation session
    session_usage_counts = {}

    for item in items_in:
        catalogue_price = Decimal("0.00")
        item_name = item.name
        svc_category_id = None
        service_record = None

        if getattr(item, "service_id", None):
            svc_res = await db.execute(
                select(Service).where(
                    Service.id == item.service_id,
                    Service.business_id == business_id
                )
            )
            service_record = svc_res.scalar_one_or_none()
            if service_record:
                catalogue_price = Decimal(str(service_record.price))
                item_name = service_record.name
                svc_category_id = str(service_record.category_id) if service_record.category_id else None
            else:
                # If product or manual item
                catalogue_price = Decimal(str(getattr(item, "unit_price", 0.00) or 0.00))
        else:
            catalogue_price = Decimal(str(getattr(item, "unit_price", 0.00) or 0.00))

        qty = int(getattr(item, "quantity", 1))
        gross_line = round_curr(catalogue_price * Decimal(str(qty)))
        subtotal += gross_line

        # Evaluate Membership Benefit for this line item
        line_membership_disc = Decimal("0.00")
        is_complimentary = False
        applied_benefit_id = None
        applied_benefit_name = None

        if membership_eligible:
            # Check for specific benefit match
            matched_benefit = None
            for b in membership_benefits_list:
                b_id = str(b.get("id"))
                b_svc_id = b.get("service_id")
                b_cat_id = b.get("category_id")
                b_type = b.get("benefit_type")
                limit_type = b.get("usage_limit_type", "UNLIMITED")
                limit_val = b.get("usage_limit_value")

                # Check service or category match
                is_match = False
                if b_svc_id and getattr(item, "service_id", None) and str(item.service_id) == str(b_svc_id):
                    is_match = True
                elif b_cat_id and svc_category_id and str(svc_category_id) == str(b_cat_id):
                    is_match = True
                elif not b_svc_id and not b_cat_id and b_type in ("PERCENTAGE_DISCOUNT", "FIXED_DISCOUNT"):
                    # General benefit
                    is_match = True

                if is_match:
                    # Check limit
                    current_used = usage_counts.get(b_id, 0) + session_usage_counts.get(b_id, 0)
                    if limit_type == "TOTAL_MEMBERSHIP" and limit_val is not None:
                        if current_used + qty > limit_val:
                            continue  # Limit reached, skip this benefit
                    matched_benefit = b
                    break

            if matched_benefit:
                b_id = str(matched_benefit.get("id"))
                b_type = matched_benefit.get("benefit_type")
                applied_benefit_id = UUID(b_id) if b_id else None
                applied_benefit_name = matched_benefit.get("name")

                if b_type == "COMPLIMENTARY_SERVICE":
                    is_complimentary = True
                    line_membership_disc = gross_line
                    session_usage_counts[b_id] = session_usage_counts.get(b_id, 0) + qty
                elif b_type == "PERCENTAGE_DISCOUNT":
                    disc_pct = Decimal(str(matched_benefit.get("discount_percent", plan_discount_pct)))
                    line_membership_disc = round_curr(gross_line * (disc_pct / Decimal("100.00")))
                elif b_type == "FIXED_DISCOUNT":
                    disc_fixed = Decimal(str(matched_benefit.get("discount_amount", 0.00))) * Decimal(str(qty))
                    line_membership_disc = min(gross_line, round_curr(disc_fixed))
            elif plan_discount_pct > Decimal("0.00"):
                # Default plan discount percentage
                line_membership_disc = round_curr(gross_line * (plan_discount_pct / Decimal("100.00")))
                applied_benefit_name = f"{membership_snapshot.get('name', 'Membership')} {plan_discount_pct}% Discount"

        # Cap item discount to gross line
        line_membership_disc = min(gross_line, line_membership_disc)
        total_membership_discount += line_membership_disc
        line_total = max(Decimal("0.00"), gross_line - line_membership_disc)

        calculated_items.append(
            BillCalculationItemOut(
                service_id=getattr(item, "service_id", None),
                item_type=getattr(item, "item_type", "service"),
                name=item_name,
                catalogue_price=round_curr(catalogue_price),
                unit_price=round_curr(catalogue_price),
                quantity=qty,
                gross_total=gross_line,
                membership_discount=line_membership_disc,
                manual_discount=Decimal("0.00"),
                line_total=line_total,
                is_complimentary=is_complimentary,
                benefit_id=applied_benefit_id,
                benefit_name=applied_benefit_name
            )
        )

    # Apply max discount cap if configured on plan
    if max_discount_cap is not None and total_membership_discount > max_discount_cap:
        # Scale down proportional item discounts
        scale = max_discount_cap / total_membership_discount
        total_membership_discount = max_discount_cap
        for it in calculated_items:
            it.membership_discount = round_curr(it.membership_discount * scale)
            it.line_total = max(Decimal("0.00"), it.gross_total - it.membership_discount)

    # 6. Apply Stacking Policy with Manual Promotional Discount
    remaining_after_member = max(Decimal("0.00"), subtotal - total_membership_discount)
    manual_disc = min(remaining_after_member, Decimal(str(overall_discount)))
    manual_disc = round_curr(manual_disc)

    taxable_amount = max(Decimal("0.00"), remaining_after_member - manual_disc)
    
    # 7. Authoritative Tax/GST calculation
    tax_percentage = Decimal(str(business.default_tax_rate)) if apply_tax else Decimal("0.00")
    tax_amount = round_curr(taxable_amount * (tax_percentage / Decimal("100.00")))
    grand_total = taxable_amount + tax_amount

    # Membership summary payload for UI
    member_summary = None
    if active_membership:
        member_summary = {
            "id": str(active_membership.id),
            "membership_number": active_membership.membership_number,
            "status": get_effective_status(active_membership),
            "plan_name": active_membership.plan_snapshot.get("name") if active_membership.plan_snapshot else "Membership",
            "discount_percent": float(plan_discount_pct),
            "expiry_date": active_membership.expiry_date.isoformat() if active_membership.expiry_date else None,
            "is_effective_active": membership_eligible
        }

    return BillCalculationSummary(
        subtotal=round_curr(subtotal),
        total_membership_discount=round_curr(total_membership_discount),
        total_manual_discount=manual_disc,
        taxable_amount=round_curr(taxable_amount),
        tax_percentage=tax_percentage,
        tax_amount=tax_amount,
        grand_total=round_curr(grand_total),
        membership_applied=member_summary,
        items=calculated_items
    )
