from typing import Optional
from uuid import UUID
from datetime import datetime, date
from decimal import Decimal
from pydantic import BaseModel

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    gender: Optional[str] = "Unspecified"
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    marketing_opt_in: bool = True

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    marketing_opt_in: Optional[bool] = None

class CustomerOut(BaseModel):
    id: UUID
    business_id: UUID
    name: str
    phone: str
    email: Optional[str] = None
    gender: Optional[str] = None
    date_of_birth: Optional[date] = None
    notes: Optional[str] = None
    marketing_opt_in: bool
    total_visits: int
    total_spend: Decimal
    loyalty_points: int
    last_visit_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True

class CustomerSearchOut(BaseModel):
    id: UUID
    name: str
    phone: str
    total_visits: int
    total_spend: Decimal
    loyalty_points: int
    last_visit_at: Optional[datetime] = None

    class Config:
        from_attributes = True
