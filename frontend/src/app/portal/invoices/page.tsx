'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import ReceiptModal from '@/components/ReceiptModal';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { FileText, Printer, Search, Loader2, Scissors, UserCheck, Trash2 } from 'lucide-react';

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

  const loadInvoices = async (stylistId?: string) => {
    setLoading(true);
    try {
      const data = await api.getInvoices(100, stylistId || undefined);
      setInvoices(data || []);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices(selectedStylist);
  }, [selectedStylist]);

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
      await loadInvoices(selectedStylist);
    } catch (err: any) {
      alert(`Failed to delete invoice: ${err.message || 'Unknown error'}`);
    } finally {
      setDeletingId(null);
    }
  };

  const selectedStylistName = staffList.find((s) => s.id === selectedStylist)?.name;

  const filteredInvoices = invoices.filter((inv) => {
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

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Invoices & Financial Ledger" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ SALON FINANCIALS</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Invoices & Ledger</h1>
            <p className="text-sm text-text-secondary mt-1">
              Review settled invoices, filter by registered stylist, view customer tax slips, and reprint receipts.
            </p>
          </div>
        </div>

        {/* Search & Stylist Filter Header */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1 max-w-2xl">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by invoice #, customer name, mobile, or stylist..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
              />
            </div>

            {/* Stylist Filter Dropdown */}
            <div className="flex items-center gap-2 bg-workspace-bg/60 border border-workspace-border rounded-xl px-3 py-1.5 shrink-0">
              <Scissors className="w-4 h-4 text-primary shrink-0" />
              <span className="text-xs font-semibold text-text-secondary shrink-0">Stylist:</span>
              <select
                value={selectedStylist}
                onChange={(e) => setSelectedStylist(e.target.value)}
                className="bg-transparent text-sm font-semibold text-text-primary focus:outline-none cursor-pointer pr-1"
              >
                <option value="">All Stylists</option>
                {staffList.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.roles?.[0]?.name || 'Stylist'})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="text-xs text-text-secondary font-mono flex items-center gap-2">
            <span>
              Total records: <strong className="text-text-primary font-bold">{filteredInvoices.length}</strong>
            </span>
            {selectedStylistName && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-50 text-rose-700 font-semibold border border-rose-200/60 text-[11px]">
                <UserCheck className="w-3 h-3" />
                {selectedStylistName}
              </span>
            )}
          </div>
        </div>

        {/* Invoices Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Settled Invoices & Receipts</span>
            </h3>
            {selectedStylistName && (
              <span className="text-xs text-text-muted font-medium">
                Showing attributed orders for <strong className="text-text-primary">{selectedStylistName}</strong>
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading financial records...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm space-y-2">
              <p>No invoice records found.</p>
              {selectedStylist && (
                <button
                  type="button"
                  onClick={() => setSelectedStylist('')}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  Clear stylist filter
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Stylist</th>
                    <th className="p-4">Subtotal</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Tax</th>
                    <th className="p-4 text-right">Total Net</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-text-primary">
                        {inv.invoice_number}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-text-primary">
                          {inv.customer_name || 'Walk-in Guest'}
                        </div>
                        {inv.customer_phone && (
                          <div className="text-text-muted font-mono text-[11px]">
                            {inv.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-50 border border-gray-200/80 text-xs font-semibold text-text-primary">
                          <Scissors className="w-3 h-3 text-[#E60023]" />
                          <span>{inv.staff_name || inv.stylist || 'Team Member'}</span>
                        </span>
                      </td>
                      <td className="p-4 font-mono text-text-secondary">{formatCurrency(inv.subtotal)}</td>
                      <td className="p-4 font-mono text-emerald-600">
                        {inv.discount_amount > 0 ? `-${formatCurrency(inv.discount_amount)}` : '-'}
                      </td>
                      <td className="p-4 font-mono text-text-secondary">
                        {inv.tax_amount > 0 ? formatCurrency(inv.tax_amount) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-primary text-sm">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="p-4">
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-semibold uppercase">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary text-xs">{formatDate(inv.created_at)}</td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openReceipt(inv.id)}
                            disabled={loadingReceipt || deletingId === inv.id}
                            className="px-3 py-1.5 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
                            title="Reprint receipt"
                          >
                            <Printer className="w-3.5 h-3.5 text-text-secondary" />
                            <span>Reprint</span>
                          </button>

                          {isAdmin && (
                            <button
                              onClick={() => handleDeleteInvoice(inv)}
                              disabled={deletingId === inv.id}
                              className="px-2.5 py-1.5 rounded-xl bg-white border border-rose-200 hover:bg-rose-50 text-rose-600 hover:text-rose-700 font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
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
