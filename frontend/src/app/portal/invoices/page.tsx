'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import ReceiptModal from '@/components/ReceiptModal';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { 
  FileText, 
  Printer, 
  Search, 
  Loader2, 
  Scissors, 
  UserCheck, 
  Trash2,
  TrendingUp,
  CreditCard,
  Tag,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
  Receipt
} from 'lucide-react';

export default function InvoicesPage() {
  const { user, roles } = useAuth();
  const isAdmin = Boolean(
    user?.is_owner || 
    roles?.some((r: any) => ['owner', 'admin'].includes(String(r).toLowerCase()))
  );

  const [invoices, setInvoices] = useState<any[]>([]);
  const [staffList, setStaffList] = useState<any[]>([]);
  const [selectedStylist, setSelectedStylist] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState<number | 'ALL'>(50);

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  // Load registered staff for filter
  useEffect(() => {
    const loadStaff = async () => {
      try {
        const emps = await api.getEmployees();
        setStaffList(emps || []);
      } catch (err) {
        console.error('Failed to load employees for invoice filter:', err);
      }
    };
    loadStaff();
  }, []);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      // Fetch up to 500 invoices live from the database
      const data = await api.getInvoices(500);
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

  // Dynamically extract all unique stylists across registered staff AND live invoices
  const availableStylists = useMemo(() => {
    const names = new Set<string>();
    staffList.forEach((s) => {
      if (s.name && s.name.trim()) names.add(s.name.trim());
    });
    invoices.forEach((inv) => {
      const name = inv.staff_name || inv.stylist;
      if (name && name.trim()) names.add(name.trim());
    });
    return Array.from(names).sort();
  }, [staffList, invoices]);

  const openReceipt = async (invId: string) => {
    setLoadingReceipt(true);
    try {
      const receipt = await api.getInvoiceReceipt(invId);
      setActiveReceipt(receipt);
      setIsReceiptOpen(true);
    } catch (err: any) {
      alert(`Could not load receipt: ${err.message}`);
    } finally {
      setLoadingReceipt(false);
    }
  };

  const handleDeleteInvoice = async (inv: any) => {
    if (!isAdmin) {
      alert('Only salon administrators and owners are authorized to delete invoices.');
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete invoice ${inv.invoice_number}?\n\nThis will permanently delete this invoice and its underlying transaction records, and recalculate customer spending, visits, and ledger totals everywhere.`
    );
    if (!confirmed) return;

    setDeletingId(inv.id);
    try {
      await api.deleteInvoice(inv.id);
      await loadInvoices();
    } catch (err: any) {
      alert(`Failed to delete invoice: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  // Filter invoices based on search and selected stylist
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      // Stylist filter matching
      if (selectedStylist) {
        const invStylist = (inv.staff_name || inv.stylist || '').trim().toLowerCase();
        const selStylist = selectedStylist.trim().toLowerCase();
        const matchesStaffId = inv.staff_id === selectedStylist;
        const matchesStaffName = invStylist === selStylist;
        if (!matchesStaffId && !matchesStaffName) return false;
      }

      // Search matching
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchInv = inv.invoice_number && inv.invoice_number.toLowerCase().includes(q);
        const matchName = inv.customer_name && inv.customer_name.toLowerCase().includes(q);
        const matchPhone = inv.customer_phone && inv.customer_phone.includes(q);
        const matchStaff = (inv.staff_name && inv.staff_name.toLowerCase().includes(q)) || 
                           (inv.stylist && inv.stylist.toLowerCase().includes(q));
        return matchInv || matchName || matchPhone || matchStaff;
      }
      return true;
    });
  }, [invoices, selectedStylist, search]);

  // Reset to page 1 whenever search or filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [search, selectedStylist, pageSize]);

  // Aggregate Metrics for filtered invoices
  const metrics = useMemo(() => {
    const totalCount = filteredInvoices.length;
    const totalGross = filteredInvoices.reduce((sum, i) => sum + (Number(i.subtotal) || 0), 0);
    const totalDiscounts = filteredInvoices.reduce((sum, i) => sum + (Number(i.discount_amount) || 0), 0);
    const totalNet = filteredInvoices.reduce((sum, i) => sum + (Number(i.total_amount) || 0), 0);
    const avgTicket = totalCount > 0 ? totalNet / totalCount : 0;

    return { totalCount, totalGross, totalDiscounts, totalNet, avgTicket };
  }, [filteredInvoices]);

  // Pagination calculation
  const totalItems = filteredInvoices.length;
  const effectivePageSize = pageSize === 'ALL' ? totalItems || 1 : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / (pageSize === 'ALL' ? totalItems || 1 : pageSize)));
  const startIndex = (currentPage - 1) * (pageSize === 'ALL' ? totalItems : pageSize);
  const endIndex = pageSize === 'ALL' ? totalItems : Math.min(startIndex + pageSize, totalItems);
  const paginatedInvoices = filteredInvoices.slice(startIndex, endIndex);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F6F5]">
      <Topbar title="Invoices & Financial Ledger" />

      <main className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-[#929292]">TRIMZ SALON FINANCIALS</div>
            <h1 className="font-serif text-3xl md:text-4xl font-bold text-[#171717] tracking-tight mt-0.5">Invoices &amp; Ledger</h1>
            <p className="text-sm text-[#737373] mt-1">
              Live audit of settled tax receipts, stylist attribution, and customer sales from the salon database.
            </p>
          </div>

          <button
            type="button"
            onClick={() => loadInvoices()}
            disabled={loading}
            className="self-start sm:self-auto flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-xs font-semibold text-[#171717] transition-all shadow-xs disabled:opacity-50"
            title="Refresh Invoices from Database"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#E60023]' : 'text-[#737373]'}`} />
            <span>Refresh Live Data</span>
          </button>
        </div>

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Total Settled Net */}
          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Settled Revenue</span>
              <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {formatCurrency(metrics.totalNet)}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">
                Net received across {metrics.totalCount} invoices
              </p>
            </div>
          </div>

          {/* Card 2: Total Records */}
          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Total Invoices</span>
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-[#E60023] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {metrics.totalCount}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">
                {selectedStylist ? `Attributed to ${selectedStylist}` : 'All salon transactions'}
              </p>
            </div>
          </div>

          {/* Card 3: Total Discounts */}
          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Discounts Given</span>
              <div className="w-8 h-8 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Tag className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-amber-700 font-mono tracking-tight">
                {formatCurrency(metrics.totalDiscounts)}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">
                Promotional &amp; VIP savings passed to guests
              </p>
            </div>
          </div>

          {/* Card 4: Avg Ticket */}
          <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Avg Ticket Size</span>
              <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <h3 className="text-2xl font-bold text-[#171717] font-mono tracking-tight">
                {formatCurrency(metrics.avgTicket)}
              </h3>
              <p className="text-[11px] text-[#737373] mt-1">
                Average transaction spend per bill
              </p>
            </div>
          </div>
        </div>

        {/* Search, Stylist Filter & Page Size Bar */}
        <div className="bg-white p-4 rounded-2xl border border-[#E8E5E3] shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-[#929292] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by invoice #, client name, mobile, or stylist..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-[#F7F6F5] border border-[#E8E5E3] rounded-xl pl-10 pr-4 py-2 text-xs text-[#171717] placeholder-[#929292] focus:outline-none focus:border-[#171717] focus:bg-white transition-all"
              />
            </div>

            {/* Stylist Filter Dropdown */}
            <div className="flex items-center gap-2 bg-[#F7F6F5] border border-[#E8E5E3] rounded-xl px-3 py-1.5 shrink-0">
              <Scissors className="w-3.5 h-3.5 text-[#E60023] shrink-0" />
              <span className="text-xs font-semibold text-[#737373] shrink-0">Stylist:</span>
              <select
                value={selectedStylist}
                onChange={(e) => setSelectedStylist(e.target.value)}
                className="bg-transparent text-xs font-semibold text-[#171717] focus:outline-none cursor-pointer pr-1"
              >
                <option value="">All Stylists ({invoices.length})</option>
                {availableStylists.map((stName) => (
                  <option key={stName} value={stName}>
                    {stName}
                  </option>
                ))}
              </select>
            </div>

            {/* Clear Filter Button if applied */}
            {(selectedStylist || search) && (
              <button
                type="button"
                onClick={() => {
                  setSelectedStylist('');
                  setSearch('');
                }}
                className="text-xs font-semibold text-[#E60023] hover:underline px-2 py-1"
              >
                Reset filters
              </button>
            )}
          </div>

          {/* Page Size & Record Counts */}
          <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-[#737373]">
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

        {/* Invoices Table Card */}
        <div className="bg-white border border-[#E8E5E3] rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 border-b border-[#F0EEEB] flex items-center justify-between">
            <h3 className="text-xs font-bold text-[#171717] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#E60023]" />
              <span>Settled Invoices &amp; Fiscal Receipts</span>
            </h3>
            {selectedStylist && (
              <span className="text-xs text-[#737373] font-medium flex items-center gap-1">
                Filtered by <strong className="text-[#171717] font-bold">{selectedStylist}</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-[#E60023]" />
              <span className="text-xs text-[#737373]">Querying live invoices from database...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center text-[#737373] text-xs space-y-2">
              <p>No invoice records found matching the active criteria.</p>
              {(selectedStylist || search) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStylist('');
                    setSearch('');
                  }}
                  className="text-xs font-bold text-[#E60023] hover:underline"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-[#E8E5E3] bg-[#F7F6F5] text-[#737373] font-semibold uppercase text-[11px] tracking-wider">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Stylist</th>
                    <th className="p-4">Subtotal</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Tax</th>
                    <th className="p-4 text-right">Net Amount</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EEEB]">
                  {paginatedInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F5F4F3] transition-colors">
                      <td className="p-4 font-mono font-bold text-[#171717]">
                        {inv.invoice_number}
                      </td>
                      <td className="p-4">
                        <div className="font-bold text-[#171717]">
                          {inv.customer_name || 'Walk-in Guest'}
                        </div>
                        {inv.customer_phone && (
                          <div className="text-[#737373] font-mono text-[11px]">
                            {inv.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#F7F6F5] border border-[#E8E5E3] text-xs font-semibold text-[#171717]">
                          <Scissors className="w-3 h-3 text-[#E60023]" />
                          <span>{inv.staff_name || inv.stylist || 'Team Member'}</span>
                        </span>
                      </td>
                      <td className="p-4 font-mono text-[#737373]">{formatCurrency(inv.subtotal)}</td>
                      <td className="p-4 font-mono text-emerald-600 font-medium">
                        {inv.discount_amount > 0 ? `-${formatCurrency(inv.discount_amount)}` : '-'}
                      </td>
                      <td className="p-4 font-mono text-[#737373]">
                        {inv.tax_amount > 0 ? formatCurrency(inv.tax_amount) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-[#E60023] text-xs">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[10px] font-bold uppercase tracking-wider">
                          {inv.status || 'ISSUED'}
                        </span>
                      </td>
                      <td className="p-4 text-[#737373] text-[11px] font-medium">{formatDate(inv.created_at)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openReceipt(inv.id)}
                            disabled={loadingReceipt || deletingId === inv.id}
                            className="px-3 py-1.5 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-[#171717] font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-xs"
                            title="Reprint receipt"
                          >
                            <Printer className="w-3.5 h-3.5 text-[#737373]" />
                            <span>Reprint</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteInvoice(inv)}
                              disabled={deletingId === inv.id}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-xs disabled:opacity-50"
                              title="Delete invoice (Admin only)"
                            >
                              {deletingId === inv.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination Footer */}
          {!loading && filteredInvoices.length > 0 && pageSize !== 'ALL' && totalPages > 1 && (
            <div className="p-4 border-t border-[#F0EEEB] bg-[#F7F6F5]/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
              <span className="text-[#737373] font-mono">
                Page {currentPage} of {totalPages} • Showing {startIndex + 1}–{endIndex} of {totalItems} invoices
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
                    // Show first, last, and current +/- 1
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

      <ReceiptModal
        receipt={activeReceipt}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
