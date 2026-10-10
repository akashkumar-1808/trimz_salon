'use client';

import React, { useState } from 'react';
import { formatCurrency, formatDate } from '@/lib/utils';
import { api } from '@/lib/api';
import { 
  Printer, 
  X, 
  CheckCircle2, 
  MessageCircle, 
  Download, 
  FileText, 
  Image as ImageIcon,
  ExternalLink,
  Copy
} from 'lucide-react';

interface ReceiptModalProps {
  receipt: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<'thermal' | 'invoice_image'>('thermal');
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  if (!isOpen || !receipt) return null;

  const invoiceId = receipt.invoice_id || receipt.invoice?.id;
  const imageUrl = invoiceId ? api.getInvoiceImageUrl(invoiceId) : null;
  const printUrl = invoiceId ? api.getInvoicePrintUrl(invoiceId) : null;

  const handlePrint = () => {
    if (activeTab === 'invoice_image' && printUrl) {
      window.open(printUrl, '_blank', 'width=850,height=1100');
    } else {
      window.print();
    }
  };

  const handleDownloadImage = () => {
    if (!imageUrl) return;
    const a = document.createElement('a');
    a.href = imageUrl;
    a.download = `Invoice_${receipt.invoice_number || receipt.sale_number}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleOpenWhatsApp = () => {
    const url = receipt.whatsapp_url || receipt.whatsapp_click_to_chat?.url;
    if (url) {
      window.open(url, '_blank');
      return;
    }
    if (!receipt.customer_phone) {
      alert('No customer phone number available for WhatsApp.');
      return;
    }
    const cleanPhone = receipt.customer_phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const text = encodeURIComponent(receipt.receipt_text || 'Receipt from Trimz Salon');
    const fallbackUrl = `https://wa.me/${phoneWithCountry}?text=${text}`;
    window.open(fallbackUrl, '_blank');
  };

  const handleCopyReceipt = () => {
    if (receipt.receipt_text) {
      navigator.clipboard.writeText(receipt.receipt_text);
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-[#E8E5E3] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E8E5E3] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#171717]">Bill Completed</h3>
                <span className="text-xs font-mono text-[#E60023] font-semibold px-2 py-0.5 rounded-full bg-rose-50 border border-rose-200">
                  {receipt.invoice_number || receipt.sale_number}
                </span>
              </div>
              <p className="text-[11px] text-[#737373]">
                {receipt.customer_name} • {receipt.customer_phone || 'Walk-in'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="bg-[#F5F4F3] p-1 rounded-xl border border-[#E8E5E3] flex text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('thermal')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                  activeTab === 'thermal'
                    ? 'bg-white text-[#171717] shadow-sm'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>80mm Slip</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('invoice_image')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                  activeTab === 'invoice_image'
                    ? 'bg-white text-[#171717] shadow-sm'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <ImageIcon className="w-3.5 h-3.5" />
                <span>Invoice Bill</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#737373] hover:text-[#171717] hover:bg-[#F5F4F3] transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* WhatsApp Click-to-Chat Action Banner */}
        <div className="px-4 py-2.5 bg-[#F0FDF4] border-b border-[#DCFCE7] flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-emerald-300 flex items-center justify-center text-emerald-700">
              <MessageCircle className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-emerald-950 font-bold">WhatsApp Receipt:</span>
              <span className="text-emerald-800 ml-1.5 text-[11px]">
                Prefilled text receipt ready. Review and tap Send in WhatsApp.
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="text-[#171717] hover:bg-white text-xs flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white/80 border border-emerald-300 transition-colors font-medium shadow-2xs"
              title="Copy formatted receipt text to clipboard"
            >
              <Copy className="w-3 h-3 text-emerald-700" />
              <span>{copiedReceipt ? 'Copied!' : 'Copy Text'}</span>
            </button>
            <button
              type="button"
              onClick={handleOpenWhatsApp}
              className="text-white hover:bg-emerald-700 bg-emerald-600 font-bold text-xs flex items-center gap-1.5 px-3 py-1 rounded-lg shadow-sm transition-all"
            >
              <ExternalLink className="w-3 h-3" />
              <span>Open WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Modal Body Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F7F6F5] flex items-center justify-center">
          {activeTab === 'invoice_image' && imageUrl ? (
            /* Rendered Official Invoice PNG Image */
            <div className="bg-white rounded-xl shadow-lg overflow-hidden border border-[#E8E5E3] max-w-md w-full">
              <img
                src={imageUrl}
                alt={`Invoice ${receipt.invoice_number || receipt.sale_number}`}
                className="w-full h-auto block"
              />
            </div>
          ) : (
            /* 80mm Printable Thermal Receipt Slip */
            <div
              id="printable-receipt"
              className="bg-white text-black p-5 rounded-xl font-mono text-xs shadow-sm border border-[#E8E5E3] leading-relaxed max-w-sm w-full"
            >
              <div className="text-center border-b border-dashed border-gray-400 pb-3 mb-3">
                <h2 className="text-base font-black tracking-wider uppercase font-sans">
                  {receipt.business?.name || 'TRIMZ SALON'}
                </h2>
                <p className="text-[11px] text-gray-600">Premium Hair &amp; Beauty Lounge</p>
                <p className="text-[10px] text-gray-500">{receipt.business?.address || '123 Elite Boulevard, Jubilee Hills'}</p>
                <p className="text-[10px] text-gray-500">Tel: {receipt.business?.phone || '+91 98765 43210'}</p>
                {receipt.business?.gstin && (
                  <p className="text-[10px] text-gray-500 font-semibold">GSTIN: {receipt.business.gstin}</p>
                )}
              </div>

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
                  <span className="text-emerald-700 font-bold uppercase">PAID &amp; VERIFIED</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500">
                <p className="font-semibold text-gray-700">Thank you for visiting Trimz Salon!</p>
                <p>For appointments: visit trimzsalon.com</p>
                <p className="pt-1 text-[9px] text-gray-400">Generated by Trimz POS</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-[#E8E5E3] bg-white flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          <button
            type="button"
            onClick={handleDownloadImage}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-[#F5F4F3] text-[#171717] border border-[#E8E5E3] font-semibold text-xs transition-all shadow-xs"
          >
            <Download className="w-4 h-4 text-[#737373]" />
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4" />
            <span>Open WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs transition-all shadow-sm"
          >
            <Printer className="w-4 h-4" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
