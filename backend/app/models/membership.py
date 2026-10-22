import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from sqlalchemy import (
    Column, String, Text, Numeric, Integer, Boolean, DateTime, ForeignKey, Index, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base
from app.models.business import GUID

class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(120), nullable=False)
    slug = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    price = Column(Numeric(12, 2), nullable=False, default=0.00)
    validity_months = Column(Integer, nullable=False, default=12)
    discount_percent = Column(Numeric(5, 2), nullable=False, default=10.00)
    discount_amount = Column(Numeric(12, 2), nullable=False, default=0.00)
    min_spend = Column(Numeric(12, 2), nullable=False, default=0.00)
    max_discount_cap = Column(Numeric(12, 2), nullable=True)
    perks_json = Column(JSON, nullable=True) # List of textual perks for UI/receipts
    is_active = Column(Boolean, nullable=False, default=True)
    display_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    benefits = relationship("MembershipBenefit", back_populates="plan", cascade="all, delete-orphan", lazy="selectin")
    memberships = relationship("CustomerMembership", back_populates="plan", lazy="selectin")

    __table_args__ = (
        Index("idx_biz_plan_slug", "business_id", "slug", unique=True),
    )

class MembershipBenefit(Base):
    __tablename__ = "membership_benefits"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    plan_id = Column(GUID, ForeignKey("membership_plans.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    benefit_type = Column(String(50), nullable=False) # PERCENTAGE_DISCOUNT, FIXED_DISCOUNT, COMPLIMENTARY_SERVICE, CATEGORY_DISCOUNT
    discount_percent = Column(Numeric(5, 2), nullable=True)
    discount_amount = Column(Numeric(12, 2), nullable=True)
    service_id = Column(GUID, ForeignKey("services.id", ondelete="SET NULL"), nullable=True)
    category_id = Column(GUID, ForeignKey("service_categories.id", ondelete="SET NULL"), nullable=True)
    usage_limit_type = Column(String(50), nullable=False, default="UNLIMITED") # UNLIMITED, TOTAL_MEMBERSHIP, PER_VISIT, PER_MONTH
    usage_limit_value = Column(Integer, nullable=True) # e.g. 1 per visit, 12 per year
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    plan = relationship("MembershipPlan", back_populates="benefits")
    service = relationship("Service", lazy="selectin")
    category = relationship("ServiceCategory", lazy="selectin")

class CustomerMembership(Base):
    __tablename__ = "customer_memberships"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    customer_id = Column(GUID, ForeignKey("customers.id", ondelete="RESTRICT"), nullable=False, index=True)
    plan_id = Column(GUID, ForeignKey("membership_plans.id", ondelete="RESTRICT"), nullable=False, index=True)
    membership_number = Column(String(50), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="ACTIVE") # ACTIVE, PAUSED, EXPIRED, CANCELLED
    start_date = Column(DateTime(timezone=True), nullable=False)
    expiry_date = Column(DateTime(timezone=True), nullable=False, index=True)
    original_duration_months = Column(Integer, nullable=False, default=12)
    purchase_price = Column(Numeric(12, 2), nullable=False, default=0.00)
    payment_method = Column(String(50), nullable=False, default="UPI")
    payment_reference = Column(String(100), nullable=True)
    plan_snapshot = Column(JSON, nullable=False) # Snapshot of plan and its benefits at moment of purchase
    notes = Column(Text, nullable=True)
    created_by_id = Column(GUID, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)
    updated_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc))

    customer = relationship("Customer", lazy="selectin")
    plan = relationship("MembershipPlan", back_populates="memberships", lazy="selectin")
    created_by = relationship("Profile", lazy="selectin")
    pause_logs = relationship("MembershipPauseLog", back_populates="membership", cascade="all, delete-orphan", lazy="selectin")
    usage_entries = relationship("MembershipUsageLedger", back_populates="membership", cascade="all, delete-orphan", lazy="selectin")

    __table_args__ = (
        Index("idx_biz_membership_number", "business_id", "membership_number", unique=True),
    )

class MembershipPauseLog(Base):
    __tablename__ = "membership_pause_logs"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    membership_id = Column(GUID, ForeignKey("customer_memberships.id", ondelete="CASCADE"), nullable=False, index=True)
    paused_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    resumed_at = Column(DateTime(timezone=True), nullable=True)
    paused_by_id = Column(GUID, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    resumed_by_id = Column(GUID, ForeignKey("profiles.id", ondelete="SET NULL"), nullable=True)
    paused_reason = Column(String(255), nullable=True)
    resumed_reason = Column(String(255), nullable=True)
    duration_days_extended = Column(Integer, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    membership = relationship("CustomerMembership", back_populates="pause_logs")
    paused_by = relationship("Profile", foreign_keys=[paused_by_id], lazy="selectin")
    resumed_by = relationship("Profile", foreign_keys=[resumed_by_id], lazy="selectin")

class MembershipUsageLedger(Base):
    __tablename__ = "membership_usage_ledger"

    id = Column(GUID, primary_key=True, default=uuid.uuid4)
    business_id = Column(GUID, ForeignKey("businesses.id", ondelete="RESTRICT"), nullable=False, index=True)
    membership_id = Column(GUID, ForeignKey("customer_memberships.id", ondelete="RESTRICT"), nullable=False, index=True)
    benefit_id = Column(GUID, nullable=True) # Reference to benefit if applicable
    benefit_name = Column(String(150), nullable=False)
    benefit_type = Column(String(50), nullable=False)
    sale_id = Column(GUID, ForeignKey("sales.id", ondelete="CASCADE"), nullable=False, index=True)
    sale_item_id = Column(GUID, ForeignKey("sale_items.id", ondelete="SET NULL"), nullable=True)
    quantity_used = Column(Integer, nullable=False, default=1)
    discount_applied = Column(Numeric(12, 2), nullable=False, default=0.00)
    is_reversal = Column(Boolean, nullable=False, default=False)
    reversal_for_id = Column(GUID, nullable=True)
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc), index=True)

    membership = relationship("CustomerMembership", back_populates="usage_entries")
    sale = relationship("Sale", lazy="selectin")
