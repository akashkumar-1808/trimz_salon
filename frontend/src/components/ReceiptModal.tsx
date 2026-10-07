'use client';

import React from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Printer, X, CheckCircle2, MessageCircle } from 'lucide-react';

interface ReceiptModalProps {
  receipt: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
  if (!isOpen || !receipt) return null;

  const handlePrint = () => {
    window.print();
  };

  const handleWhatsApp = () => {
    if (!receipt.customer_phone) {
      alert('No customer phone number available for WhatsApp.');
      return;
    }
    const cleanPhone = receipt.customer_phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Hello ${receipt.customer_name || 'Valued Customer'}! Thank you for visiting Trimz Salon. Your bill ${receipt.invoice_number || receipt.sale_number} for ${formatCurrency(receipt.total_amount)} has been generated. We look forward to serving you again!`;
    const url = `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-4 border-b border-dark-border flex items-center justify-between bg-dark-card/50">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>Transaction Completed</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-dark-card transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Printable Thermal Receipt Card */}
        <div className="p-6 overflow-y-auto flex-1 bg-dark-bg/40">
          <div
            id="printable-receipt"
            className="bg-white text-black p-5 rounded-lg font-mono text-xs shadow-inner leading-relaxed"
          >
            {/* Salon Header */}
            <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
              <h2 className="text-base font-black tracking-wider uppercase">
                {receipt.business?.name || 'TRIMZ SALON'}
              </h2>
              <p className="text-[11px] text-gray-600">Premium Hair & Beauty Lounge</p>
              <p className="text-[10px] text-gray-500">{receipt.business?.address || '123 Elite Boulevard, Jubilee Hills'}</p>
              <p className="text-[10px] text-gray-500">Tel: {receipt.business?.phone || '+91 98765 43210'}</p>
              {receipt.business?.gstin && (
                <p className="text-[10px] text-gray-500 font-semibold">GSTIN: {receipt.business.gstin}</p>
              )}
            </div>

            {/* Bill Details */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2 text-[11px] space-y-0.5">
              <div className="flex justify-between">
                <span className="text-gray-500">Invoice:</span>
                <span className="font-bold">{receipt.invoice_number || receipt.sale_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Date:</span>
                <span>{formatDate(receipt.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Customer:</span>
                <span className="font-semibold">{receipt.customer_name || 'Walk-in Guest'}</span>
              </div>
              {receipt.customer_phone && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Phone:</span>
                  <span>{receipt.customer_phone}</span>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            <div className="border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="flex justify-between font-bold text-[11px] pb-1 border-b border-gray-300">
                <span>ITEM</span>
                <span>QTY x RATE</span>
                <span>AMT</span>
              </div>
              <div className="pt-1 space-y-1">
                {receipt.items?.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-[11px]">
                    <div className="truncate max-w-[140px] font-semibold">{item.service_name}</div>
                    <div className="text-gray-600">
                      {item.quantity} x {item.unit_price}
                    </div>
                    <div className="font-bold">
                      {(item.quantity * item.unit_price).toFixed(2)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Financial Summary */}
            <div className="space-y-1 text-[11px] border-b border-dashed border-gray-400 pb-2 mb-2">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal:</span>
                <span>{formatCurrency(receipt.subtotal || 0)}</span>
              </div>
              {receipt.discount_amount > 0 && (
                <div className="flex justify-between text-emerald-700">
                  <span>Discount:</span>
                  <span>-{formatCurrency(receipt.discount_amount)}</span>
                </div>
              )}
              {receipt.tax_amount > 0 && (
                <div className="flex justify-between text-gray-600">
                  <span>GST / Tax:</span>
                  <span>+{formatCurrency(receipt.tax_amount)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-gray-300">
                <span>TOTAL NET:</span>
                <span>{formatCurrency(receipt.total_amount || 0)}</span>
              </div>
            </div>

            {/* Payment Details */}
            <div className="text-[10px] text-gray-600 pb-2 border-b border-dashed border-gray-400 mb-2">
              <div className="flex justify-between">
                <span>Payment Mode:</span>
                <span className="font-bold uppercase">
                  {receipt.payment_method || 'CASH'}{' '}
                  {receipt.payment_provider ? `(${receipt.payment_provider})` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Status:</span>
                <span className="text-emerald-700 font-bold uppercase">PAID & VERIFIED</span>
              </div>
            </div>

            {/* Footer Thank You */}
            <div className="text-center pt-2 text-[10px] text-gray-500">
              <p className="font-semibold text-gray-700">Thank you for visiting Trimz Salon!</p>
              <p>For appointments: visit trimzsalon.com</p>
              <p className="pt-1 text-[9px] text-gray-400">Generated by Trimz POS</p>
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-dark-border bg-dark-surface flex items-center justify-between gap-3">
          <button
            onClick={handleWhatsApp}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-all"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Send WhatsApp</span>
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-all shadow-lg shadow-brand-500/20"
          >
            <Printer className="w-4 h-4" />
            <span>Print 80mm</span>
          </button>
        </div>
      </div>
    </div>
  );
}
