from typing import Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr

class BusinessOut(BaseModel):
    id: UUID
    name: str
    legal_name: Optional[str] = None
    phone: str
    email: Optional[str] = None
    address: str
    city: str
    state: str
    postal_code: str
    country: str
    tax_name: str
    default_tax_rate: Decimal
    tax_registration_number: Optional[str] = None
    currency: str
    currency_symbol: str
    timezone: str
    bill_prefix: str
    logo_url: Optional[str] = None
    font_family: Optional[str] = "Inter"
    is_active: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True

class BusinessUpdate(BaseModel):
    name: Optional[str] = None
    legal_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    country: Optional[str] = None
    tax_name: Optional[str] = None
    default_tax_rate: Optional[Decimal] = None
    tax_registration_number: Optional[str] = None
    currency: Optional[str] = None
    currency_symbol: Optional[str] = None
    bill_prefix: Optional[str] = None
    logo_url: Optional[str] = None
    font_family: Optional[str] = None

class ProfileUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    password: Optional[str] = None
