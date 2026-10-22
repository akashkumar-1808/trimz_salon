from typing import List, Optional, Any, Dict
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
    is_complimentary: bool = False
    membership_benefit_id: Optional[UUID] = None
    membership_discount_amount: Decimal = Decimal("0.00")

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
    public_invoice_url: Optional[str] = None
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
    customer_membership_id: Optional[UUID] = None
    membership_discount_amount: Optional[Decimal] = Decimal("0.00")
    membership_snapshot: Optional[Any] = None
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
    public_invoice_url: Optional[str] = None
    public_invoice_token: Optional[str] = None
    whatsapp_delivery: Optional[WhatsAppDeliveryStatus] = None # Preserved for deferred future features

class PublicInvoiceItem(BaseModel):
    name: str
    stylist: Optional[str] = None
    quantity: int
    unit_price: float
    total_price: float

class PublicInvoiceBusiness(BaseModel):
    name: str
    legal_name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    postal_code: Optional[str] = None
    slogan: Optional[str] = "LOOK GOOD / FEEL GOOD / BE YOU"
    instagram: Optional[str] = "@trimzunisexsalon"

class PublicInvoicePayment(BaseModel):
    payment_method: str
    payment_provider: Optional[str] = None
    status: str
    amount_paid: float
    balance_due: float = 0.0
    transaction_reference: Optional[str] = None

class PublicInvoiceResponse(BaseModel):
    invoice_number: str
    sale_number: Optional[str] = None
    date: str
    time: str
    created_at_iso: str
    stylist: Optional[str] = None
    customer_name: Optional[str] = None
    customer_phone_masked: Optional[str] = None
    items: List[PublicInvoiceItem] = []
    subtotal: float
    discount_amount: float
    tax_amount: float
    tax_name: str = "GST"
    tax_percentage: float = 0.0
    total_amount: float
    currency: str = "INR"
    status: str
    payment: PublicInvoicePayment
    business: PublicInvoiceBusiness
