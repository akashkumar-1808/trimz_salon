from typing import List, Optional, Any, Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, Field

# --- Plan Schemas ---

class MembershipBenefitOut(BaseModel):
    id: UUID
    plan_id: UUID
    name: str
    benefit_type: str  # PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, COMPLIMENTARY_SERVICE, CATEGORY_DISCOUNT
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    service_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    usage_limit_type: str = "UNLIMITED"  # UNLIMITED, TOTAL_MEMBERSHIP, PER_VISIT, PER_MONTH
    usage_limit_value: Optional[int] = None
    is_active: bool = True
    created_at: datetime

    class Config:
        from_attributes = True

class MembershipBenefitIn(BaseModel):
    name: str
    benefit_type: str
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    service_id: Optional[UUID] = None
    category_id: Optional[UUID] = None
    usage_limit_type: str = "UNLIMITED"
    usage_limit_value: Optional[int] = None
    is_active: bool = True

class MembershipPlanOut(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    slug: str
    description: Optional[str] = None
    price: Decimal
    validity_months: int
    discount_percent: Decimal
    discount_amount: Decimal
    min_spend: Decimal
    max_discount_cap: Optional[Decimal] = None
    perks_json: Optional[Any] = None
    is_active: bool
    display_order: int
    created_at: datetime
    updated_at: datetime
    benefits: List[MembershipBenefitOut] = []

    class Config:
        from_attributes = True

class MembershipPlanCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: Decimal
    validity_months: int = 12
    discount_percent: Decimal = Decimal("10.00")
    discount_amount: Decimal = Decimal("0.00")
    min_spend: Decimal = Decimal("0.00")
    max_discount_cap: Optional[Decimal] = None
    perks: Optional[List[str]] = []
    display_order: int = 0
    benefits: Optional[List[MembershipBenefitIn]] = []

class MembershipPlanUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    validity_months: Optional[int] = None
    discount_percent: Optional[Decimal] = None
    discount_amount: Optional[Decimal] = None
    min_spend: Optional[Decimal] = None
    max_discount_cap: Optional[Decimal] = None
    perks: Optional[List[str]] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None
    benefits: Optional[List[MembershipBenefitIn]] = None

# --- Customer Membership Schemas ---

class MembershipPauseLogOut(BaseModel):
    id: UUID
    membership_id: UUID
    paused_at: datetime
    resumed_at: Optional[datetime] = None
    paused_by_id: Optional[UUID] = None
    paused_by_name: Optional[str] = None
    resumed_by_id: Optional[UUID] = None
    resumed_by_name: Optional[str] = None
    paused_reason: Optional[str] = None
    resumed_reason: Optional[str] = None
    duration_days_extended: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True

class MembershipUsageLedgerOut(BaseModel):
    id: UUID
    membership_id: UUID
    benefit_id: Optional[UUID] = None
    benefit_name: str
    benefit_type: str
    sale_id: UUID
    sale_item_id: Optional[UUID] = None
    quantity_used: int
    discount_applied: Decimal
    is_reversal: bool
    reversal_for_id: Optional[UUID] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerMembershipOut(BaseModel):
    id: UUID
    business_id: UUID
    customer_id: UUID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    plan_id: UUID
    plan_name: Optional[str] = None
    membership_number: str
    status: str  # ACTIVE, PAUSED, EXPIRED, CANCELLED
    is_effective_active: bool = True
    start_date: datetime
    expiry_date: datetime
    original_duration_months: int
    purchase_price: Decimal
    payment_method: str
    payment_reference: Optional[str] = None
    plan_snapshot: Dict[str, Any]
    notes: Optional[str] = None
    created_by_name: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    pause_logs: List[MembershipPauseLogOut] = []
    usage_entries: List[MembershipUsageLedgerOut] = []

    class Config:
        from_attributes = True

class MembershipRegisterRequest(BaseModel):
    customer_id: Optional[UUID] = None
    customer_name: Optional[str] = None
    customer_phone: str
    plan_id: UUID
    start_date: Optional[datetime] = None  # Admin override
    expiry_date: Optional[datetime] = None  # Admin override
    purchase_price: Optional[Decimal] = None  # Defaults to plan price
    payment_method: str = "UPI"  # CASH, UPI, CARD, COMPLIMENTARY
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class MembershipPauseRequest(BaseModel):
    reason: Optional[str] = "Customer requested temporary pause"

class MembershipResumeRequest(BaseModel):
    reason: Optional[str] = "Customer resumed membership"

class MembershipRenewRequest(BaseModel):
    plan_id: Optional[UUID] = None  # If upgrading or renewing under different plan
    extension_months: Optional[int] = None  # Defaults to plan validity
    purchase_price: Optional[Decimal] = None
    payment_method: str = "UPI"
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class MembershipUpgradeRequest(BaseModel):
    new_plan_id: UUID
    prorated_charge: Optional[Decimal] = Decimal("0.00")
    payment_method: str = "UPI"
    payment_reference: Optional[str] = None
    notes: Optional[str] = None

class MembershipCancelRequest(BaseModel):
    reason: str

# --- Calculation & POS Breakdown Schemas ---

class BillCalculationItemIn(BaseModel):
    service_id: Optional[UUID] = None
    item_type: str = "service"
    name: str
    unit_price: Optional[Decimal] = None  # Optional, server resolves authoritative price
    quantity: int = 1
    commission_rate: Optional[Decimal] = Decimal("0.00")

class BillCalculateRequest(BaseModel):
    customer_phone: Optional[str] = None
    customer_id: Optional[UUID] = None
    items: List[BillCalculationItemIn]
    overall_discount: Decimal = Decimal("0.00")
    discount_reason: Optional[str] = None
    apply_tax: bool = True

class BillCalculationItemOut(BaseModel):
    service_id: Optional[UUID] = None
    item_type: str
    name: str
    catalogue_price: Decimal
    unit_price: Decimal
    quantity: int
    gross_total: Decimal
    membership_discount: Decimal
    manual_discount: Decimal = Decimal("0.00")
    line_total: Decimal
    is_complimentary: bool = False
    benefit_id: Optional[UUID] = None
    benefit_name: Optional[str] = None

class BillCalculationSummary(BaseModel):
    subtotal: Decimal
    total_membership_discount: Decimal
    total_manual_discount: Decimal
    taxable_amount: Decimal
    tax_percentage: Decimal
    tax_amount: Decimal
    grand_total: Decimal
    membership_applied: Optional[Dict[str, Any]] = None
    items: List[BillCalculationItemOut]
