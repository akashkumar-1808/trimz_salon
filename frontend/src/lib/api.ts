// ==============================================================================
// TRIMZ SALON — CENTRALIZED API CLIENT
// ==============================================================================

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

class ApiClient {
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
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trimz_token');
      localStorage.removeItem('trimz_user');
      localStorage.removeItem('trimz_permissions');
    }
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string> || {}),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
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

  async getMe() {
    return this.request<any>('/auth/me');
  }

  // Employees
  async getEmployees() {
    return this.request<any[]>('/employees/');
  }

  async createEmployee(payload: any) {
    return this.request<any>('/employees/', {
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

  // Roles & Permissions
  async getRoles() {
    return this.request<any[]>('/roles/');
  }

  async getPermissions() {
    return this.request<any[]>('/roles/permissions/catalogue');
  }

  async createRole(payload: any) {
    return this.request<any>('/roles/', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // Customers
  async getCustomers(query: string = '') {
    const q = query ? `?query=${encodeURIComponent(query)}` : '';
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
  async getSalesSummary(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';
    return this.request<any>(`/reports/sales-summary${qs}`);
  }

  async getDailyClosing(date?: string) {
    const qs = date ? `?date=${encodeURIComponent(date)}` : '';
    return this.request<any>(`/reports/daily-closing${qs}`);
  }

  async getCustomerPurchaseHistory(customerId: string) {
    return this.request<any>(`/reports/customer-history/${customerId}`);
  }

  async exportSalesCsv(startDate?: string, endDate?: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE}/reports/export/sales-csv${qs}`, {
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to export CSV');
    }
    return res.blob();
  }

  async exportSalesPdf(startDate?: string, endDate?: string): Promise<Blob> {
    const token = this.getToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const params = new URLSearchParams();
    if (startDate) params.append('start_date', startDate);
    if (endDate) params.append('end_date', endDate);
    const qs = params.toString() ? `?${params.toString()}` : '';

    const res = await fetch(`${API_BASE}/reports/export/sales-pdf${qs}`, {
      headers,
    });
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.detail || 'Failed to export PDF');
    }
    return res.blob();
  }

  // Invoices
  async getInvoices(limit = 50) {
    return this.request<any[]>(`/invoices/?limit=${limit}`);
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
    const token = this.getToken();
    return `${API_BASE}/invoices/${invoiceId}/image`;
  }

  getInvoicePrintUrl(invoiceId: string) {
    return `${API_BASE}/invoices/${invoiceId}/print`;
  }

  // Dashboard Metrics
  async getDashboardMetrics(timeRange: string = 'today') {
    return this.request<any>(`/dashboard/metrics?period=${encodeURIComponent(timeRange)}&time_range=${encodeURIComponent(timeRange)}`);
  }

  // Audit Logs
  async getAuditLogs(limit = 100) {
    return this.request<any[]>(`/audit/?limit=${limit}`);
  }
}

export const api = new ApiClient();
