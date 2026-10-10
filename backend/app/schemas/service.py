from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class ServiceCategoryCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    department: str = "Unisex"
    description: Optional[str] = None
    display_order: int = 0

class ServiceCategoryOut(BaseModel):
    id: UUID
    name: str
    slug: Optional[str] = None
    department: Optional[str] = "Unisex"
    description: Optional[str] = None
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True

class ServiceCreate(BaseModel):
    category_id: UUID
    name: str
    slug: Optional[str] = None
    variant_name: Optional[str] = None
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int = 30
    audience: str = "Unisex" # Male, Female, Unisex
    commission_rate: Decimal = Decimal("0.00")
    is_variable_price: bool = False
    combo_items: Optional[str] = None
    display_order: int = 0

class ServiceUpdate(BaseModel):
    category_id: Optional[UUID] = None
    name: Optional[str] = None
    slug: Optional[str] = None
    variant_name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    duration_minutes: Optional[int] = None
    audience: Optional[str] = None
    commission_rate: Optional[Decimal] = None
    is_variable_price: Optional[bool] = None
    combo_items: Optional[str] = None
    is_active: Optional[bool] = None
    is_deleted: Optional[bool] = None
    display_order: Optional[int] = None

class ServiceOut(BaseModel):
    id: UUID
    category_id: UUID
    category_name: Optional[str] = None
    name: str
    slug: Optional[str] = None
    variant_name: Optional[str] = None
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int
    audience: str
    target_gender: Optional[str] = None
    commission_rate: Decimal
    is_variable_price: bool = False
    combo_items: Optional[str] = None
    is_active: bool
    is_deleted: bool = False
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True
