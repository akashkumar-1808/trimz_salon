// ==============================================================================
// TRIMZ SALON — CENTRALIZED API CLIENT
// ==============================================================================

import { PublicInvoiceData, MembershipPlan, CustomerMembership, BillCalculationSummary } from '@/lib/types';

function resolveApiBaseUrl(): string {
  const envUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
  const cleanUrl = envUrl.trim().replace(/\/+$/, '');
  
  if (cleanUrl.endsWith('/api/v1')) {
    return cleanUrl;
  }
  if (cleanUrl.endsWith('/api')) {
    return `${cleanUrl}/v1`;
  }
  return `${cleanUrl}/api/v1`;
}

const API_BASE = resolveApiBaseUrl();

class ApiClient {
  private inFlightRequests: Map<string, Promise<any>> = new Map();

  private buildUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/api/v1/')) {
      return `${API_BASE}${cleanEndpoint.slice('/api/v1'.length)}`;
    }
    return `${API_BASE}${cleanEndpoint}`;
  }

  private getToken(): string | null {
    if (typeof window === 'undefined') return null;
    return localStorage.getItem('trimz_token');
  }

  public setToken(token: string) {
    if (typeof window !== 'undefined') {
      localStorage.setItem('trimz_token', token);
    }
  }

  public clearToken() {
    this.inFlightRequests.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trimz_token');
      localStorage.removeItem('trimz_user');
      localStorage.removeItem('trimz_permissions');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const method = (options.method || 'GET').toUpperCase();
    const token = this.getToken();
    const targetUrl = this.buildUrl(endpoint);

    // In-flight deduplication for concurrent identical GET requests
    if (method === 'GET') {
      const dedupKey = `${targetUrl}::${token || ''}`;
      if (this.inFlightRequests.has(dedupKey)) {
        return this.inFlightRequests.get(dedupKey) as Promise<T>;
      }

      const promise = this.executeFetch<T>(targetUrl, options, token).finally(() => {
        this.inFlightRequests.delete(dedupKey);
      });
      this.inFlightRequests.set(dedupKey, promise);
      return promise;
    }

    return this.executeFetch<T>(targetUrl, options, token);
  }

  private async executeFetch<T>(targetUrl: string, options: RequestInit, token: string | null): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(targetUrl, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      this.clearToken();
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/login')) {
        window.location.href = '/login';
      }
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const message = errorData.detail || `Request failed with status ${response.status}`;
      throw new Error(message);
    }

    return response.json();
  }

  // Auth
  async login(payload: { email: string; password: string }) {
    return this.request<any>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async registerStaff(payload: { name: string; email: string; password: string; phone?: string; business_id?: string }) {
    return this.request<any>('/auth/register-staff', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Employees
  async getEmployees() {
    return this.request<any[]>('/employees');
  }

  async createEmployee(payload: any) {
    return this.request<any>('/employees', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateEmployee(id: string, payload: any) {
    return this.request<any>(`/employees/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async activateEmployee(id: string) {
    return this.request<any>(`/employees/${id}/activate`, {
      method: 'POST',
    });
  }

  // Roles & Permissions
  async getRoles() {
    return this.request<any[]>('/roles');
  }

  async getPermissions() {
    return this.request<any[]>('/roles/permissions/catalogue');
  }

  async createRole(payload: any) {
    return this.request<any>('/roles', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Customers
  async getCustomers(query: string = '') {
    const q = query ? `?query=${encodeURIComponent(query)}&search=${encodeURIComponent(query)}` : '';
    return this.request<any[]>(`/customers/${q}`);
  }

  async getCustomer(id: string) {
    return this.request<any>(`/customers/${id}`);
  }

  async createCustomer(payload: any) {
    return this.request<any>('/customers/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateCustomer(id: string, payload: any) {
    return this.request<any>(`/customers/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Services & Categories
  async getCategories() {
    return this.request<any[]>('/services/categories');
  }

  async createCategory(payload: any) {
    return this.request<any>('/services/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getServices(categoryId?: string, gender?: string, activeOnly?: boolean, status?: string) {
    const params = new URLSearchParams();
    if (categoryId) params.append('category_id', categoryId);
    if (gender && gender !== 'all') params.append('target_gender', gender);
    if (activeOnly !== undefined) params.append('active_only', String(activeOnly));
    if (status && status !== 'all') params.append('status', status);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<any[]>(`/services/${qs}`);
  }

  async createService(payload: any) {
    return this.request<any>('/services/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async updateService(id: string, payload: any) {
    return this.request<any>(`/services/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async pauseService(id: string) {
    return this.request<any>(`/services/${id}/pause`, {
      method: 'POST',
    });
  }

  async resumeService(id: string) {
    return this.request<any>(`/services/${id}/resume`, {
      method: 'POST',
    });
  }

  async removeService(id: string) {
    return this.request<any>(`/services/${id}`, {
      method: 'DELETE',
    });
  }

  // Billing & Sales
  async createSale(payload: any) {
    return this.request<any>('/billing/checkout', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getSales(limit = 50) {
    return this.request<any[]>(`/billing/sales?limit=${limit}`);
  }

  async getSaleReceipt(saleId: string) {
    return this.request<{ receipt_text: string }>(`/billing/sales/${saleId}/receipt`);
  }

  async cancelSale(saleId: string) {
    return this.request<any>(`/billing/sales/${saleId}/cancel`, {
      method: 'POST',
    });
  }

  // Settings & Profile
  async getBusinessSettings() {
    return this.request<any>('/settings/business');
  }

  async updateBusinessSettings(payload: any) {
    return this.request<any>('/settings/business', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  async getMyProfile() {
    return this.request<any>('/settings/profile');
  }

  async updateMyProfile(payload: any) {
    return this.request<any>('/settings/profile', {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  }

  // Reports
  async getSalesSummary(startDate?: string, endDate?: string, stylistId?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (stylistId) params.append('stylist_id', stylistId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/reports/sales-summary${qs}`);
  }

  async getDailyClosing(date?: string, stylistId?: string) {
    const params = new URLSearchParams();
    if (date) params.append('date', date);
    if (stylistId) params.append('stylist_id', stylistId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/reports/daily-closing${qs}`);
  }

  async getCustomerPurchaseHistory(customerId: string) {
    return this.request<any>(`/reports/customer-history/${customerId}`);
  }

  async exportSalesCsv(startDate?: string, endDate?: string, stylistId?: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (stylistId) params.append('stylist_id', stylistId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(this.buildUrl(`/reports/export/sales-csv${qs}`), {
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to export CSV');
    }
    return res.blob();
  }

  async exportSalesPdf(startDate?: string, endDate?: string, stylistId?: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    if (stylistId) params.append('stylist_id', stylistId);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(this.buildUrl(`/reports/export/sales-pdf${qs}`), {
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to export PDF');
    }
    return res.blob();
  }

  // Invoices
  async getInvoices(limit = 100, stylistId?: string, search?: string) {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    if (stylistId) params.append('stylist_id', stylistId);
    if (search) params.append('search', search);
    return this.request<any[]>(`/invoices?${params.toString()}`);
  }

  async getInvoiceReceipt(invoiceId: string) {
    return this.request<any>(`/invoices/${invoiceId}/receipt`);
  }

  async sendInvoiceWhatsApp(invoiceId: string, forceResend = true) {
    return this.request<any>(`/invoices/${invoiceId}/whatsapp/send?force_resend=${forceResend}`, {
      method: 'POST',
    });
  }

  async getInvoiceWhatsAppStatus(invoiceId: string) {
    return this.request<any>(`/invoices/${invoiceId}/whatsapp/status`);
  }

  getInvoiceImageUrl(invoiceId: string) {
    return this.buildUrl(`/invoices/${invoiceId}/image`);
  }

  getInvoicePrintUrl(invoiceId: string) {
    return this.buildUrl(`/invoices/${invoiceId}/print`);
  }

  async getPublicInvoice(token: string): Promise<PublicInvoiceData> {
    const res = await fetch(this.buildUrl(`/public/invoices/${encodeURIComponent(token)}`), {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      cache: 'no-store',
    });

    if (res.status === 404) {
      throw new Error('NOT_FOUND');
    }
    if (res.status === 410) {
      const err = await res.json().catch(() => ({}));
      if (err.detail && err.detail.toLowerCase().includes('revoked')) {
        throw new Error('REVOKED');
      }
      throw new Error('EXPIRED');
    }
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || `Request failed with status ${res.status}`);
    }
    return res.json();
  }

  async createInvoicePublicLink(invoiceId: string) {
    return this.request<{
      invoice_id: string;
      invoice_number: string;
      public_token: string;
      public_url: string;
      whatsapp_url?: string;
    }>(`/invoices/${invoiceId}/public-link`, {
      method: 'POST',
    });
  }

  // Dashboard Metrics
  async getDashboardMetrics(timeRange: string = 'today') {
    return this.request<any>(`/dashboard/metrics?period=${encodeURIComponent(timeRange)}&time_range=${encodeURIComponent(timeRange)}`);
  }

  // Membership Plans
  async getMembershipPlans(): Promise<MembershipPlan[]> {
    return this.request<MembershipPlan[]>('/memberships/plans');
  }

  async createMembershipPlan(data: any): Promise<MembershipPlan> {
    return this.request<MembershipPlan>('/memberships/plans', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMembershipPlan(planId: string, data: any): Promise<MembershipPlan> {
    return this.request<MembershipPlan>(`/memberships/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Customer Memberships
  async getMemberships(params?: { search?: string; status_filter?: string; plan_id?: string }): Promise<CustomerMembership[]> {
    const q = new URLSearchParams();
    if (params?.search) q.append('search', params.search);
    if (params?.status_filter) q.append('status_filter', params.status_filter);
    if (params?.plan_id) q.append('plan_id', params.plan_id);
    const qs = q.toString();
    return this.request<CustomerMembership[]>(`/memberships${qs ? `?${qs}` : ''}`);
  }

  async getMembershipDetail(membershipId: string): Promise<CustomerMembership> {
    return this.request<CustomerMembership>(`/memberships/${membershipId}`);
  }

  async registerMembership(data: any): Promise<CustomerMembership> {
    return this.request<CustomerMembership>('/memberships/register', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async pauseMembership(membershipId: string, reason?: string): Promise<CustomerMembership> {
    return this.request<CustomerMembership>(`/memberships/${membershipId}/pause`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async resumeMembership(membershipId: string, reason?: string): Promise<CustomerMembership> {
    return this.request<CustomerMembership>(`/memberships/${membershipId}/resume`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async renewMembership(membershipId: string, data: any): Promise<CustomerMembership> {
    return this.request<CustomerMembership>(`/memberships/${membershipId}/renew`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async cancelMembership(membershipId: string, reason: string): Promise<CustomerMembership> {
    return this.request<CustomerMembership>(`/memberships/${membershipId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  // POS Eligibility & Authoritative Calculation
  async getCustomerEligibleMembership(customerId: string): Promise<{ has_membership: boolean; is_eligible: boolean; membership?: CustomerMembership }> {
    return this.request<{ has_membership: boolean; is_eligible: boolean; membership?: CustomerMembership }>(`/memberships/customer/${customerId}/eligible`);
  }

  async getCustomerEligibleMembershipByPhone(phone: string): Promise<{ has_membership: boolean; is_eligible: boolean; customer?: any; membership?: CustomerMembership }> {
    return this.request<{ has_membership: boolean; is_eligible: boolean; customer?: any; membership?: CustomerMembership }>(`/memberships/customer/by-phone/${encodeURIComponent(phone)}/eligible`);
  }

  async calculateBill(data: {
    customer_phone?: string;
    customer_id?: string;
    items: any[];
    overall_discount?: number;
    discount_reason?: string;
    apply_tax?: boolean;
  }): Promise<BillCalculationSummary> {
    return this.request<BillCalculationSummary>('/billing/calculate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Audit Logs
  async getAuditLogs(limit = 100) {
    return this.request<any[]>(`/audit/?limit=${limit}`);
  }
}

export const api = new ApiClient();
