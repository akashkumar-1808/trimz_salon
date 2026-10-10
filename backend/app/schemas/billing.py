from typing import List, Optional
from uuid import UUID
from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class CartItemIn(BaseModel):
    service_id: Optional[UUID] = None
    item_type: str = "service" # service or product
    name: str
    unit_price: Decimal
    quantity: int = 1
    discount_amount: Decimal = Decimal("0.00")
    commission_rate: Decimal = Decimal("0.00")

class PaymentIn(BaseModel):
    amount: Decimal
    payment_method: str = "UPI" # CASH, UPI, CARD, OTHER
    payment_provider: Optional[str] = "PhonePe" # Google Pay, PhonePe, Paytm, etc.
    transaction_reference: Optional[str] = None
    notes: Optional[str] = None

class CheckoutRequest(BaseModel):
    customer_phone: str
    customer_name: Optional[str] = None
    customer_id: Optional[UUID] = None
    items: List[CartItemIn]
    overall_discount: Decimal = Decimal("0.00")
    discount_reason: Optional[str] = None
    apply_tax: bool = True
    payments: List[PaymentIn]
    staff_name: Optional[str] = None
    notes: Optional[str] = None
    send_whatsapp: bool = True
    open_whatsapp: Optional[bool] = None # Open WhatsApp click-to-chat after checkout

class WhatsAppClickToChat(BaseModel):
    enabled: bool
    phone: Optional[str] = None
    url: Optional[str] = None
    message: Optional[str] = None

class SaleItemOut(BaseModel):
    id: UUID
    item_type: str
    service_name_snapshot: str
    unit_price_snapshot: Decimal
    quantity: int
    discount_amount: Decimal
    tax_amount: Decimal
    total_price: Decimal

    class Config:
        from_attributes = True

class PaymentOut(BaseModel):
    id: UUID
    amount: Decimal
    payment_method: str
    payment_provider: Optional[str]
    status: str
    transaction_reference: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True

class InvoiceOut(BaseModel):
    id: UUID
    sale_id: Optional[UUID] = None
    invoice_number: str
    status: str
    subtotal: Decimal
    discount_amount: Decimal
    tax_amount: Decimal
    total_amount: Decimal
    currency: str
    pdf_url: Optional[str] = None
    image_url: Optional[str] = None
    render_status: Optional[str] = "PENDING"
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True

class WhatsAppDeliveryStatus(BaseModel):
    status: str
    recipient_phone: Optional[str] = None
    message_id: Optional[str] = None
    error: Optional[str] = None

class SaleOut(BaseModel):
    id: UUID
    sale_number: str
    status: str
    customer_id: UUID
    customer_name: Optional[str] = None
    customer_phone: Optional[str] = None
    subtotal: Decimal
    discount_amount: Decimal
    discount_reason: Optional[str]
    tax_amount: Decimal
    tax_percentage: Decimal
    total_amount: Decimal
    staff_name: Optional[str]
    notes: Optional[str]
    created_at: datetime
    items: List[SaleItemOut] = []
    payments: List[PaymentOut] = []
    invoice: Optional[InvoiceOut] = None

    class Config:
        from_attributes = True

class CheckoutResponse(BaseModel):
    success: bool
    sale: SaleOut
    invoice: InvoiceOut
    receipt_text: str
    whatsapp_url: Optional[str] = None
    whatsapp_click_to_chat: Optional[WhatsAppClickToChat] = None
    whatsapp_delivery: Optional[WhatsAppDeliveryStatus] = None # Preserved for deferred future features
