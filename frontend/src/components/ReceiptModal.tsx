'use client';

import React, { useState, useEffect } from 'react';
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
  Copy,
  Globe,
  Loader2
} from 'lucide-react';

interface ReceiptModalProps {
  receipt: any;
  isOpen: boolean;
  onClose: () => void;
}

export default function ReceiptModal({ receipt, isOpen, onClose }: ReceiptModalProps) {
  const [activeTab, setActiveTab] = useState<'thermal' | 'digital' | 'invoice_image'>('digital');
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  useEffect(() => {
    if (receipt) {
      const url = receipt.public_invoice_url || (receipt.public_invoice_token ? `/i/${receipt.public_invoice_token}` : null);
      setPublicUrl(url);
    }
  }, [receipt]);

  if (!isOpen || !receipt) return null;

  const invoiceId = receipt.invoice_id || receipt.invoice?.id;
  const imageUrl = invoiceId ? api.getInvoiceImageUrl(invoiceId) : null;
  const printUrl = invoiceId ? api.getInvoicePrintUrl(invoiceId) : null;

  const handlePrint = () => {
    if (activeTab === 'digital' && publicUrl) {
      window.open(publicUrl, '_blank');
    } else if (activeTab === 'invoice_image' && printUrl) {
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

  const handleCopyPublicLink = () => {
    if (publicUrl) {
      const fullUrl = publicUrl.startsWith('http') ? publicUrl : `${window.location.origin}${publicUrl}`;
      navigator.clipboard.writeText(fullUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const handleGenerateDigitalLink = async () => {
    if (!invoiceId) return;
    setGeneratingLink(true);
    try {
      const res = await api.createInvoicePublicLink(invoiceId);
      if (res.public_url) {
        setPublicUrl(res.public_url);
        if (res.whatsapp_url) {
          receipt.whatsapp_url = res.whatsapp_url;
        }
      }
    } catch (err: any) {
      alert(`Could not create digital link: ${err.message || 'Unknown error'}`);
    } finally {
      setGeneratingLink(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-sm">
      <div className="bg-white border border-[#E8E5E3] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="p-4 border-b border-[#E8E5E3] flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-center text-[#171717]">
              <CheckCircle2 className="w-4 h-4 text-[#171717]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-[#171717]">Bill Completed</h3>
                <span className="text-xs font-mono text-[#E60023] font-semibold px-2.5 py-0.5 rounded-full bg-[#F7F6F5] border border-[#E8E5E3]">
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
            <div className="bg-[#F7F6F5] p-1 rounded-xl border border-[#E8E5E3] flex text-xs">
              <button
                type="button"
                onClick={() => setActiveTab('digital')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all font-semibold ${
                  activeTab === 'digital'
                    ? 'bg-white text-[#171717] shadow-sm'
                    : 'text-[#737373] hover:text-[#171717]'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-[#E60023]" />
                <span>Digital Bill</span>
              </button>
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
              {imageUrl && (
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
                  <span>Image</span>
                </button>
              )}
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

        {/* Public Digital Web Invoice Link Banner */}
        <div className="px-4 py-2.5 bg-[#FBEEEE] border-b border-[#E30613]/20 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-[#E30613] text-white flex items-center justify-center font-bold text-[10px]">
              TR
            </div>
            <div>
              <span className="text-[#050505] font-bold">Public Digital Invoice:</span>
              <span className="text-[#5a5a5a] ml-1.5 text-[11px]">
                {publicUrl ? 'Unique customer link ready to share.' : 'Click to generate shareable digital web bill.'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {publicUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleCopyPublicLink}
                  className="text-[#050505] hover:bg-white text-xs flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/90 border border-[#E8E8E8] transition-colors font-medium shadow-xs"
                >
                  <Copy className="w-3 h-3 text-[#5a5a5a]" />
                  <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.open(publicUrl, '_blank')}
                  className="text-white hover:bg-[#c40510] bg-[#E30613] font-semibold text-xs flex items-center gap-1.5 px-3.5 py-1 rounded-lg shadow-sm transition-all"
                >
                  <ExternalLink className="w-3 h-3 text-white" />
                  <span>Open Digital Bill</span>
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={handleGenerateDigitalLink}
                disabled={generatingLink}
                className="text-white hover:bg-[#c40510] bg-[#E30613] font-semibold text-xs flex items-center gap-1.5 px-3.5 py-1 rounded-lg shadow-sm transition-all disabled:opacity-50"
              >
                {generatingLink ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin text-white" />
                    <span>Creating Link...</span>
                  </>
                ) : (
                  <>
                    <ExternalLink className="w-3 h-3 text-white" />
                    <span>Generate Link</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {/* Modal Body Preview */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 bg-[#F7F6F5] flex items-center justify-center">
          {activeTab === 'digital' ? (
            /* Digital Invoice Card Preview */
            <div className="bg-white rounded-2xl shadow-lg border border-[#E8E5E3] max-w-md w-full overflow-hidden">
              <div className="bg-[#050505] text-white p-4 flex items-center justify-between border-b-[2px] border-[#E30613]">
                <div>
                  <h4 className="font-extrabold text-base tracking-tight font-serif">TRiMZ UNISEX SALON</h4>
                  <p className="text-[10px] text-gray-400 tracking-widest uppercase">STYLE • CARE • CONFIDENCE</p>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-[#E30613] text-white font-mono font-bold text-[10px]">
                  {receipt.invoice_number || receipt.sale_number}
                </span>
              </div>

              <div className="p-4 space-y-3 text-xs">
                <div className="flex justify-between pb-2 border-b border-gray-100">
                  <span className="text-gray-500">Customer:</span>
                  <span className="font-bold text-gray-900">{receipt.customer_name || 'Walk-in Guest'}</span>
                </div>
                <div className="flex justify-between pb-2 border-b border-gray-100">
                  <span className="text-gray-500">Date &amp; Time:</span>
                  <span className="font-medium text-gray-800">{formatDate(receipt.created_at)}</span>
                </div>

                <div className="space-y-1.5 pt-1">
                  <div className="text-[11px] font-bold text-gray-700 uppercase tracking-wider">Services Rendered</div>
                  {receipt.items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex justify-between text-xs py-1 px-2 rounded-lg bg-gray-50">
                      <span className="font-medium text-gray-800">{item.service_name} (x{item.quantity})</span>
                      <span className="font-mono font-bold text-gray-900">
                        {formatCurrency(item.quantity * item.unit_price)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t border-gray-200 space-y-1">
                  <div className="flex justify-between text-gray-600">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(receipt.subtotal || 0)}</span>
                  </div>
                  {receipt.discount_amount > 0 && (
                    <div className="flex justify-between text-emerald-600">
                      <span>Discount:</span>
                      <span>-{formatCurrency(receipt.discount_amount)}</span>
                    </div>
                  )}
                  {receipt.tax_amount > 0 && (
                    <div className="flex justify-between text-gray-600">
                      <span>GST:</span>
                      <span>{formatCurrency(receipt.tax_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-gray-200 text-sm font-bold text-gray-900">
                    <span>Total Amount Paid:</span>
                    <span className="text-base text-[#E60023] font-mono">
                      {formatCurrency(receipt.total_amount || 0)}
                    </span>
                  </div>
                </div>

                {publicUrl && (
                  <div className="pt-3">
                    <button
                      type="button"
                      onClick={() => window.open(publicUrl, '_blank')}
                      className="w-full py-2.5 rounded-xl bg-[#050505] hover:bg-[#222222] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ExternalLink className="w-3.5 h-3.5 text-[#E30613]" />
                      <span>Open Customer View in Browser</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === 'invoice_image' && imageUrl ? (
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
                <p className="text-[10px] text-gray-500">{receipt.business?.address || 'Shar Road, Sullurupeta, Erapalem'}</p>
                <p className="text-[10px] text-gray-500">Tel: {receipt.business?.phone || '+91 9966175299'}</p>
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
                  <div className="flex justify-between text-emerald-600 font-semibold">
                    <span>Discount:</span>
                    <span>-{formatCurrency(receipt.discount_amount)}</span>
                  </div>
                )}
                {receipt.tax_amount > 0 ? (
                  <div className="flex justify-between text-gray-600">
                    <span>GST (5%):</span>
                    <span>{formatCurrency(receipt.tax_amount)}</span>
                  </div>
                ) : null}
                <div className="flex justify-between text-sm font-bold text-black pt-1">
                  <span>TOTAL:</span>
                  <span>{formatCurrency(receipt.total_amount || 0)}</span>
                </div>
              </div>

              <div className="text-[10px] space-y-0.5 border-b border-dashed border-gray-400 pb-2 mb-2 text-gray-600">
                <div className="flex justify-between">
                  <span>Payment Mode:</span>
                  <span className="font-bold uppercase">
                    {receipt.payment_method || 'CASH'}{' '}
                    {receipt.payment_provider ? `(${receipt.payment_provider})` : ''}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Status:</span>
                  <span className="text-[#171717] font-bold uppercase">PAID &amp; VERIFIED</span>
                </div>
              </div>

              <div className="text-center pt-2 text-[10px] text-gray-500">
                <p className="font-semibold text-gray-700">Thank you for choosing TRiMZ Salon!</p>
                <p>Shar Road, Sullurupeta, Erapalem</p>
                <p className="pt-1 text-[9px] text-gray-400">Generated by Trimz POS</p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Actions */}
        <div className="p-4 border-t border-[#E8E5E3] bg-white flex items-center justify-between gap-3 flex-wrap sm:flex-nowrap">
          {imageUrl && (
            <button
              type="button"
              onClick={handleDownloadImage}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-white hover:bg-[#F5F4F3] text-[#171717] border border-[#E8E5E3] font-semibold text-xs transition-all shadow-xs"
            >
              <Download className="w-4 h-4 text-[#737373]" />
              <span>Download PNG</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenWhatsApp}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#171717] hover:bg-black text-white font-bold text-xs transition-all shadow-sm"
          >
            <MessageCircle className="w-4 h-4 text-white" />
            <span>Open WhatsApp</span>
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs transition-all shadow-sm"
          >
            <Printer className="w-4 h-4 text-white" />
            <span>Print Receipt</span>
          </button>
        </div>
      </div>
    </div>
  );
}
