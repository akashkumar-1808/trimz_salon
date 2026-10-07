from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class ServiceCategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None
    display_order: int = 0

class ServiceCategoryOut(BaseModel):
    id: UUID
    name: str
    description: Optional[str] = None
    display_order: int
    is_active: bool

    class Config:
        from_attributes = True

class ServiceCreate(BaseModel):
    category_id: UUID
    name: str
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int = 30
    audience: str = "Unisex" # Male, Female, Unisex
    commission_rate: Decimal = Decimal("0.00")
    display_order: int = 0

class ServiceUpdate(BaseModel):
    category_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[Decimal] = None
    duration_minutes: Optional[int] = None
    audience: Optional[str] = None
    commission_rate: Optional[Decimal] = None
    is_active: Optional[bool] = None
    display_order: Optional[int] = None

class ServiceOut(BaseModel):
    id: UUID
    category_id: UUID
    category_name: Optional[str] = None
    name: str
    description: Optional[str] = None
    price: Decimal
    duration_minutes: int
    audience: str
    commission_rate: Decimal
    is_active: bool
    display_order: int
    created_at: datetime

    class Config:
        from_attributes = True
