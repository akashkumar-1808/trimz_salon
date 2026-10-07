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
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Invoices & Financial Ledger" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Search Header */}
        <div className="bg-dark-surface p-4 rounded-2xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by invoice number or client name/phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            Total records: {filteredInvoices.length}
          </span>
        </div>

        {/* Invoices Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <FileText className="w-4 h-4 text-brand-400" />
              <span>Settled Invoices & Receipts</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No invoice records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
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
                <tbody className="divide-y divide-dark-border">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-dark-card/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-brand-300">
                        {inv.invoice_number}
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-gray-200">
                          {inv.customer_name || 'Walk-in Guest'}
                        </div>
                        {inv.customer_phone && (
                          <div className="text-gray-500 font-mono text-[11px]">
                            {inv.customer_phone}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-400">{formatCurrency(inv.subtotal)}</td>
                      <td className="p-4 font-mono text-emerald-400">
                        {inv.discount_amount > 0 ? `-${formatCurrency(inv.discount_amount)}` : '-'}
                      </td>
                      <td className="p-4 font-mono text-gray-400">
                        {inv.tax_amount > 0 ? formatCurrency(inv.tax_amount) : '-'}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-white text-sm">
                        {formatCurrency(inv.total_amount)}
                      </td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">
                          {inv.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{formatDate(inv.created_at)}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => openReceipt(inv.id)}
                          className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border hover:border-brand-500 text-gray-300 hover:text-brand-300 font-semibold text-xs inline-flex items-center gap-1.5 transition-all"
                        >
                          <Printer className="w-3.5 h-3.5" />
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
      </div>

      <ReceiptModal
        receipt={activeReceipt}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
