'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Customer } from '@/lib/types';
import { 
  Users, 
  Search, 
  UserPlus, 
  X, 
  Loader2, 
  MessageCircle, 
  Eye,
  RotateCcw,
  TrendingUp,
  Sparkles,
  Repeat,
  ChevronLeft,
  ChevronRight,
  UserCheck
} from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);

  // Profile Drawer
  const [selectedProfile, setSelectedProfile] = useState<any | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // New Customer Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState('all');
  const [newNotes, setNewNotes] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const fetchCustomers = async (q: string = '') => {
    setLoading(true);
    try {
      // Query up to 500 customers live from database
      const data = await api.getCustomers(q, 500);
      setCustomers(data || []);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Reset page when search or pageSize changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, pageSize]);

  // Summary Metrics
  const metrics = useMemo(() => {
    const totalCount = customers.length;
    const totalSpend = customers.reduce((acc, c) => acc + (Number(c.total_spend) || 0), 0);
    const repeatCount = customers.filter((c) => (c.total_visits || 0) > 1).length;
    const avgSpend = totalCount > 0 ? totalSpend / totalCount : 0;
    return { totalCount, totalSpend, repeatCount, avgSpend };
  }, [customers]);

  // Pagination calculations
  const totalItems = customers.length;
  const effectivePageSize = pageSize === 'ALL' ? totalItems || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / effectivePageSize));
  const startIndex = (currentPage - 1) * (pageSize === 'ALL' ? totalItems : pageSize);
  const endIndex = pageSize === 'ALL' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedCustomers = customers.slice(startIndex, endIndex);

  const viewCustomerProfile = async (id: string) => {
    setLoadingProfile(true);
    try {
      const profile = await api.getCustomer(id);
      setSelectedProfile(profile);
    } catch (err) {
      alert('Failed to load customer profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      alert('Name and phone are required.');
      return;
    }
    setSavingCustomer(true);
    try {
      await api.createCustomer({
        name: newName,
        phone: newPhone,
        email: newEmail || undefined,
        gender: newGender,
        notes: newNotes || undefined,
      });
      setIsNewModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
      fetchCustomers(search);
    } catch (err: any) {
      alert(`Error creating customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    if (!phone || phone.startsWith('LEGACY-')) {
      alert('No valid mobile phone number available for this customer.');
      return;
    }
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Hello ${name}! Greeting from Trimz Salon. We look forward to seeing you soon!`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F6F5]">
      <Topbar title="Customers" breadcrumb="Customers" />

      <main className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-[#929292] uppercase">
              CLIENT DIRECTORY &amp; LOYALTY
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#171717] tracking-tight mt-1">
              Guest Profiles &amp; Loyalty
            </h1>
            <p className="text-sm text-[#737373] mt-1">
              Live customer accounts, lifetime spending, visit tracking, and WhatsApp communication.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fetchCustomers(search)}
              disabled={loading}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-xs font-semibold text-[#171717] transition-all shadow-xs disabled:opacity-50"
              title="Refresh Customers from Database"
            >
              <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E60023]' : 'text-[#737373]'}`} />
              <span>Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsNewModalOpen(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs shadow-xs transition-all"
            >
              <UserPlus className="w-4 h-4" />
              <span>Add New Client</span>
            </button>
          </div>
        </div>

        {/* Customer Metrics Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Total Guests</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#E60023] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {metrics.totalCount}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">Live active client records</p>
            </div>
          </div>

          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Lifetime Spend</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {formatCurrency(metrics.totalSpend)}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">Total revenue across all clients</p>
            </div>
          </div>

          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Repeat Guests</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {metrics.repeatCount}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">Guests with multiple visits</p>
            </div>
          </div>

          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Average Spend</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {formatCurrency(metrics.avgSpend)}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">Average lifetime value per client</p>
            </div>
          </div>
        </div>

        {/* Search & Page Size Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8E5E3] shadow-xs flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md w-full">
            <Search className="w-4 h-4 text-[#929292] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone, name or client ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#F7F6F5] border border-[#E8E5E3] rounded-xl pl-10 pr-4 py-2 text-xs text-[#171717] placeholder-[#929292] focus:outline-none focus:border-[#171717] focus:bg-white transition-all"
            />
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#737373] w-full sm:w-auto">
            <div className="flex items-center gap-1.5 font-medium">
              <span>Show:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  const val = e.target.value;
                  setPageSize(val === 'ALL' ? 'ALL' : Number(val));
                }}
                className="bg-[#F7F6F5] border border-[#E8E5E3] rounded-lg px-2 py-1 text-xs font-semibold text-[#171717] focus:outline-none cursor-pointer"
              >
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
                <option value="ALL">All ({totalItems})</option>
              </select>
            </div>

            <div className="font-mono text-xs font-medium text-[#171717]">
              Showing <strong className="text-[#E60023] font-bold">{totalItems === 0 ? 0 : startIndex + 1}–{endIndex}</strong> of <strong className="font-bold">{totalItems}</strong>
            </div>
          </div>
        </div>

        {/* Customer Directory Table Card */}
        <div className="bg-white border border-[#E8E5E3] rounded-2xl overflow-hidden shadow-xs">
          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#E60023]" />
              <span className="text-xs text-[#737373]">Querying salon database...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-16 text-center text-[#737373] text-xs space-y-2">
              <p>No customer records found matching your search.</p>
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-xs font-bold text-[#E60023] hover:underline"
                >
                  Clear search
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E5E3] bg-[#F7F6F5] text-[#737373] font-semibold uppercase text-[11px] tracking-wider">
                    <th className="p-4">Customer</th>
                    <th className="p-4">Phone &amp; Gender</th>
                    <th className="p-4 text-center">Visits</th>
                    <th className="p-4 text-right">Lifetime Spend</th>
                    <th className="p-4">Last Visit</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEB]">
                  {paginatedCustomers.map((c) => {
                    const isSyntheticPhone = c.phone && c.phone.startsWith('LEGACY-');
                    return (
                      <tr key={c.id} className="hover:bg-[#F5F4F3] transition-colors">
                        <td className="p-4">
                          <div className="font-bold text-[#171717]">{c.name}</div>
                          {c.email && <div className="text-[#737373] text-[11px]">{c.email}</div>}
                        </td>
                        <td className="p-4">
                          {isSyntheticPhone ? (
                            <span className="inline-block px-2 py-0.5 rounded-md bg-gray-100 text-[#737373] text-[11px] italic font-sans" title={c.phone}>
                              No Mobile on File
                            </span>
                          ) : (
                            <div className="font-mono text-[#171717] font-medium">{c.phone}</div>
                          )}
                          <div className="text-[10px] uppercase text-[#929292] mt-0.5">{c.gender || 'Unspecified'}</div>
                        </td>
                        <td className="p-4 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-[#F5F4F3] border border-[#E8E5E3] text-[#171717] font-mono font-bold">
                            {c.total_visits}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-[#E60023]">
                          {formatCurrency(c.total_spend)}
                        </td>
                        <td className="p-4 text-[#737373]">
                          {formatDate(c.last_visited_at || c.created_at)}
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {!isSyntheticPhone && (
                              <button
                                type="button"
                                onClick={() => openWhatsApp(c.phone, c.name)}
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 transition-all cursor-pointer"
                                title="Chat on WhatsApp"
                              >
                                <MessageCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => viewCustomerProfile(c.id)}
                              className="p-1.5 rounded-lg bg-rose-50 text-[#E60023] hover:bg-rose-100 border border-rose-200 transition-all cursor-pointer"
                              title="View Customer Profile"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && customers.length > 0 && pageSize !== 'ALL' && totalPages > 1 && (
            <div className="p-4 border-t border-[#F0EEEB] bg-[#F7F6F5]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[#737373] font-mono">
                Page {currentPage} of {totalPages} • Showing {startIndex + 1}–{endIndex} of {totalItems} clients
              </span>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-[#171717] font-semibold flex items-center gap-1 disabled:opacity-40 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Previous</span>
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((pg) => {
                    if (pg === 1 || pg === totalPages || (pg >= currentPage - 1 && pg <= currentPage + 1)) {
                      return (
                        <button
                          key={pg}
                          type="button"
                          onClick={() => setCurrentPage(pg)}
                          className={`w-7 h-7 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                            pg === currentPage
                              ? 'bg-[#E60023] text-white shadow-xs'
                              : 'bg-white border border-[#E8E5E3] text-[#737373] hover:bg-[#F5F4F3]'
                          }`}
                        >
                          {pg}
                        </button>
                      );
                    } else if (pg === currentPage - 2 || pg === currentPage + 2) {
                      return <span key={pg} className="px-1 text-[#929292]">...</span>;
                    }
                    return null;
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-[#171717] font-semibold flex items-center gap-1 disabled:opacity-40 transition-all shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  <span>Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Customer Profile Modal */}
      {selectedProfile && (() => {
        const cust = selectedProfile.customer || selectedProfile;
        const salesList = selectedProfile.sales || selectedProfile.recent_sales || [];
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
            <div className="bg-white border border-[#E8E5E3] rounded-2xl w-full max-w-lg p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEB]">
                <div>
                  <h3 className="text-base font-bold text-[#171717]">{cust.name}</h3>
                  <p className="text-xs text-[#737373] font-mono">
                    {cust.phone && cust.phone.startsWith('LEGACY-') ? 'No Phone on File' : cust.phone}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedProfile(null)}
                  className="text-[#737373] hover:text-[#171717] p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]">
                  <p className="text-[#737373]">Total Visits</p>
                  <p className="text-base font-bold text-[#171717] mt-0.5">{cust.total_visits || 0}</p>
                </div>
                <div className="p-3 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]">
                  <p className="text-[#737373]">Lifetime Spend</p>
                  <p className="text-base font-bold text-[#E60023] mt-0.5">{formatCurrency(cust.total_spend || 0)}</p>
                </div>
              </div>

              {salesList && salesList.length > 0 && (
                <div>
                  <p className="text-xs font-bold text-[#171717] uppercase tracking-wider mb-2">Visit History</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {salesList.map((s: any) => (
                      <div key={s.id} className="p-2.5 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex justify-between text-xs">
                        <div>
                          <p className="font-mono font-semibold text-[#171717]">{s.sale_number}</p>
                          <p className="text-[10px] text-[#737373]">{formatDate(s.created_at)}</p>
                        </div>
                        <p className="font-bold font-mono text-[#E60023]">{formatCurrency(s.total_amount)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Add New Customer Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-[#E8E5E3] rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEB] mb-4">
              <h3 className="text-base font-bold text-[#171717]">Add New Client</h3>
              <button
                type="button"
                onClick={() => setIsNewModalOpen(false)}
                className="text-[#737373] hover:text-[#171717] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[#737373] mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Priya Sharma"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5E3] focus:outline-none focus:border-[#171717]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#737373] mb-1">10-Digit Mobile *</label>
                <input
                  type="tel"
                  required
                  placeholder="e.g. 9876543210"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-[#E8E5E3] focus:outline-none focus:border-[#171717]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#737373] mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  placeholder="client@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5E3] focus:outline-none focus:border-[#171717]"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#737373] mb-1">Gender</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5E3] focus:outline-none focus:border-[#171717] bg-white cursor-pointer"
                >
                  <option value="all">Unspecified / All</option>
                  <option value="Female">Female</option>
                  <option value="Male">Male</option>
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-[#E8E5E3] text-xs font-semibold hover:bg-[#F5F4F3] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="px-4 py-2 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                >
                  {savingCustomer ? 'Saving...' : 'Register Client'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
