// ==============================================================================
// TRIMZ SALON — CANONICAL FRONTEND TYPES
// ==============================================================================

export interface User {
  id: string;
  business_id: string;
  email: string;
  name: string;
  phone?: string;
  is_owner: boolean;
  status: string;
  created_at: string;
}

export interface Role {
  id: string;
  name: string;
  slug: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface Permission {
  id: string;
  module: string;
  action: string;
  code: string;
  description?: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  gender?: string;
  notes?: string;
  total_spend: number;
  total_visits: number;
  last_visited_at?: string;
  created_at: string;
}

export interface CustomerProfile extends Customer {
  recent_sales: any[];
}

export interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
  department?: string; // 'Men' | 'Women' | 'Unisex'
  display_order: number;
  is_active: boolean;
  service_count?: number;
}

export interface Service {
  id: string;
  category_id?: string;
  category_name?: string;
  name: string;
  slug: string;
  variant_name?: string;
  description?: string;
  duration_minutes: number;
  price: number;
  audience?: string;
  target_gender: string; // 'all' | 'men' | 'women' | 'kids'
  is_variable_price?: boolean;
  combo_items?: string;
  is_active: boolean;
  is_deleted?: boolean;
  created_at: string;
}

export interface CartItem {
  service: Service;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  notes?: string;
}

export interface PaymentItem {
  method: 'cash' | 'upi' | 'card' | 'other';
  provider?: string; // 'google_pay' | 'phonepe' | 'paytm' | 'other'
  amount: number;
  transaction_ref?: string;
}

export interface CreateSaleRequest {
  customer_id?: string;
  new_customer?: {
    name: string;
    phone: string;
    gender?: string;
  };
  discount_amount: number;
  tax_rate_percent: number;
  payments: PaymentItem[];
  items: {
    service_id: string;
    quantity: number;
    unit_price: number;
    discount_amount?: number;
  }[];
  idempotency_key?: string;
  notes?: string;
}

export interface SaleSummary {
  id: string;
  sale_number: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  created_at: string;
  invoice_number?: string;
}

export interface InvoiceDetail {
  id: string;
  sale_id: string;
  invoice_number: string;
  sale_number: string;
  customer_name?: string;
  customer_phone?: string;
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  total_amount: number;
  payment_method?: string;
  payment_provider?: string;
  status: string;
  created_at: string;
  image_url?: string;
  render_status?: string;
  items: {
    service_name: string;
    quantity: number;
    unit_price: number;
    total: number;
  }[];
  business: {
    name: string;
    phone?: string;
    email?: string;
    address?: string;
    gstin?: string;
  };
}

export interface WhatsAppClickToChat {
  enabled: boolean;
  phone?: string | null;
  url?: string | null;
  message?: string | null;
}

export interface WhatsAppDeliveryStatus {
  id?: string;
  status: 'PENDING' | 'SENDING' | 'SENT' | 'DELIVERED' | 'READ' | 'FAILED' | 'SKIPPED' | 'NOT_QUEUED' | string;
  recipient_phone?: string;
  message_id?: string;
  retry_count?: number;
  error?: string;
  sent_at?: string;
  delivered_at?: string;
  read_at?: string;
}

export interface DashboardMetrics {
  total_revenue: number;
  transaction_count: number;
  average_bill_value: number;
  unique_customers: number;
  new_customers: number;
  repeat_customers: number;
  payment_methods_breakdown: Record<string, number>;
  upi_providers_breakdown: Record<string, number>;
  top_services: {
    name: string;
    count: number;
    revenue: number;
  }[];
}

export interface PublicInvoiceItem {
  name: string;
  stylist?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface PublicInvoiceBusiness {
  name: string;
  legal_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  slogan?: string;
  instagram?: string;
}

export interface PublicInvoicePayment {
  payment_method: string;
  payment_provider?: string;
  status: string;
  amount_paid: number;
  balance_due: number;
  transaction_reference?: string;
}

export interface PublicInvoiceData {
  invoice_number: string;
  sale_number?: string;
  date: string;
  time: string;
  created_at_iso: string;
  stylist?: string;
  customer_name?: string;
  customer_phone_masked?: string;
  items: PublicInvoiceItem[];
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  tax_name: string;
  tax_percentage: number;
  total_amount: number;
  currency: string;
  status: string;
  payment: PublicInvoicePayment;
  business: PublicInvoiceBusiness;
}

// ==============================================================================
// MEMBERSHIP SYSTEM INTERFACES
// ==============================================================================

export interface MembershipBenefit {
  id: string;
  plan_id: string;
  name: string;
  benefit_type: 'PERCENTAGE_DISCOUNT' | 'FIXED_DISCOUNT' | 'COMPLIMENTARY_SERVICE' | 'CATEGORY_DISCOUNT';
  discount_percent?: number;
  discount_amount?: number;
  service_id?: string;
  category_id?: string;
  usage_limit_type: 'UNLIMITED' | 'TOTAL_MEMBERSHIP' | 'PER_VISIT' | 'PER_MONTH';
  usage_limit_value?: number;
  is_active: boolean;
  created_at: string;
}

export interface MembershipPlan {
  id: string;
  business_id: string;
  name: string;
  slug: string;
  description?: string;
  price: number;
  validity_months: number;
  discount_percent: number;
  discount_amount: number;
  min_spend: number;
  max_discount_cap?: number;
  perks_json?: string[];
  is_active: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
  benefits: MembershipBenefit[];
}

export interface MembershipPauseLog {
  id: string;
  membership_id: string;
  paused_at: string;
  resumed_at?: string;
  paused_by_id?: string;
  paused_by_name?: string;
  resumed_by_id?: string;
  resumed_by_name?: string;
  paused_reason?: string;
  resumed_reason?: string;
  duration_days_extended?: number;
  created_at: string;
}

export interface MembershipUsageLedger {
  id: string;
  membership_id: string;
  benefit_id?: string;
  benefit_name: string;
  benefit_type: string;
  sale_id: string;
  sale_item_id?: string;
  quantity_used: number;
  discount_applied: number;
  is_reversal: boolean;
  reversal_for_id?: string;
  created_at: string;
}

export interface CustomerMembership {
  id: string;
  business_id: string;
  customer_id: string;
  customer_name?: string;
  customer_phone?: string;
  plan_id: string;
  plan_name?: string;
  membership_number: string;
  status: 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED';
  is_effective_active: boolean;
  start_date: string;
  expiry_date: string;
  original_duration_months: number;
  purchase_price: number;
  payment_method: string;
  payment_reference?: string;
  plan_snapshot: Record<string, any>;
  notes?: string;
  created_by_name?: string;
  created_at: string;
  updated_at: string;
  pause_logs?: MembershipPauseLog[];
  usage_entries?: MembershipUsageLedger[];
}

export interface BillCalculationItem {
  service_id?: string;
  item_type: string;
  name: string;
  catalogue_price: number;
  unit_price: number;
  quantity: number;
  gross_total: number;
  membership_discount: number;
  manual_discount: number;
  line_total: number;
  is_complimentary: boolean;
  benefit_id?: string;
  benefit_name?: string;
}

export interface BillCalculationSummary {
  subtotal: number;
  total_membership_discount: number;
  total_manual_discount: number;
  taxable_amount: number;
  tax_percentage: number;
  tax_amount: number;
  grand_total: number;
  membership_applied?: {
    id: string;
    membership_number: string;
    status: string;
    plan_name: string;
    discount_percent: number;
    expiry_date?: string;
    is_effective_active: boolean;
  };
  items: BillCalculationItem[];
}


