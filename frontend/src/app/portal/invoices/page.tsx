'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import ReceiptModal from '@/components/ReceiptModal';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { FileText, Printer, Search, Loader2 } from 'lucide-react';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Receipt Modal
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);
  const [loadingReceipt, setLoadingReceipt] = useState(false);

  const loadInvoices = async () => {
    setLoading(true);
    try {
      const data = await api.getInvoices(100);
      setInvoices(data);
    } catch (err) {
      console.error('Failed to load invoices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvoices();
  }, []);

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

  const filteredInvoices = invoices.filter((inv) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        inv.invoice_number.toLowerCase().includes(q) ||
        (inv.customer_name && inv.customer_name.toLowerCase().includes(q)) ||
        (inv.customer_phone && inv.customer_phone.includes(q))
      );
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
              Review settled invoices, view customer tax slips, and reprint receipts.
            </p>
          </div>
        </div>

        {/* Search Header */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number or client name/phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
            />
          </div>
          <span className="text-xs text-text-secondary font-mono">
            Total records: {filteredInvoices.length}
          </span>
        </div>

        {/* Invoices Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>Settled Invoices & Receipts</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading financial records...</span>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No invoice records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Invoice #</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Subtotal</th>
                    <th className="p-4">Discount</th>
                    <th className="p-4">Tax</th>
                    <th className="p-4 text-right">Total Net</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Date</th>
                    <th className="p-4 text-right">Receipt</th>
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
                        <button
                          onClick={() => openReceipt(inv.id)}
                          disabled={loadingReceipt}
                          className="px-3 py-1.5 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-xs inline-flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Printer className="w-3.5 h-3.5 text-text-secondary" />
                          <span>Reprint</span>
                        </button>
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
