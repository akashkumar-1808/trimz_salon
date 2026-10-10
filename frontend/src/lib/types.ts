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
