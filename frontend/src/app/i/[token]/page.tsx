'use client';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { PublicInvoiceData } from '@/lib/types';
import { 
  Printer, 
  ShieldCheck, 
  AlertTriangle, 
  Clock, 
  RotateCcw, 
  Phone, 
  Mail, 
  MapPin, 
  Share2,
  CheckCircle2
} from 'lucide-react';

const formatIndianCurrency = (n: number | string | undefined | null): string => {
  if (n === undefined || n === null || n === '') return '0.00';
  const num = Number(n);
  return isNaN(num)
    ? String(n)
    : num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

export default function PublicInvoicePage() {
  const params = useParams();
  const token = typeof params?.token === 'string' ? params.token : Array.isArray(params?.token) ? params.token[0] : '';

  const [invoice, setInvoice] = useState<PublicInvoiceData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [errorType, setErrorType] = useState<'NOT_FOUND' | 'REVOKED' | 'EXPIRED' | 'NETWORK' | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchInvoice = async () => {
    if (!token) {
      setErrorType('NOT_FOUND');
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorType(null);
    try {
      const data = await api.getPublicInvoice(token);
      setInvoice(data);
    } catch (err: any) {
      if (err.message === 'NOT_FOUND') {
        setErrorType('NOT_FOUND');
      } else if (err.message === 'REVOKED') {
        setErrorType('REVOKED');
      } else if (err.message === 'EXPIRED') {
        setErrorType('EXPIRED');
      } else {
        setErrorType('NETWORK');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInvoice();
  }, [token]);

  const handlePrint = () => {
    window.print();
  };

  const handleCopyLink = () => {
    if (typeof window !== 'undefined') {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  // 1. Loading State
  if (loading) {
    return (
      <div className="min-h-screen bg-[#111111] flex flex-col items-center justify-center p-6 text-white font-sans">
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-[#050505] border border-[#333333] flex items-center justify-center shadow-xl">
            <span className="font-extrabold text-2xl tracking-tighter text-white font-serif">
              TR<span className="text-[#E30613]">ı</span>MZ
            </span>
          </div>
          <div className="absolute -inset-1 rounded-2xl border-2 border-[#E30613] animate-ping opacity-25 pointer-events-none" />
        </div>
        <h2 className="text-lg font-bold tracking-wide uppercase">TRiMZ Unisex Salon</h2>
        <p className="text-xs text-[#888888] mt-1">Verifying encrypted digital invoice...</p>
      </div>
    );
  }

  // 2. Error States
  if (errorType || !invoice) {
    return (
      <div className="min-h-screen bg-[#F4F4F4] flex flex-col items-center justify-center p-4 sm:p-6 text-[#111111] font-sans">
        <div className="bg-white border border-[#E8E8E8] rounded-3xl p-6 sm:p-10 max-w-md w-full shadow-xl text-center">
          <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center mb-5 bg-[#FBEEEE] text-[#E30613]">
            {errorType === 'EXPIRED' ? (
              <Clock className="w-7 h-7" />
            ) : errorType === 'REVOKED' ? (
              <AlertTriangle className="w-7 h-7" />
            ) : (
              <AlertTriangle className="w-7 h-7" />
            )}
          </div>

          <h2 className="text-xl font-extrabold text-[#050505] tracking-tight">
            {errorType === 'EXPIRED'
              ? 'Invoice Link Expired'
              : errorType === 'REVOKED'
              ? 'Invoice Link Revoked'
              : errorType === 'NETWORK'
              ? 'Network Connection Issue'
              : 'Invoice Not Found'}
          </h2>

          <p className="text-xs text-[#5a5a5a] mt-2 leading-relaxed">
            {errorType === 'EXPIRED'
              ? 'For security and privacy reasons, this shareable digital bill link is no longer active.'
              : errorType === 'REVOKED'
              ? 'This digital invoice link was invalidated or reissued by salon management.'
              : errorType === 'NETWORK'
              ? 'Could not connect to the salon server. Please check your internet connection.'
              : 'We could not locate this digital invoice. Please verify the URL or contact the salon.'}
          </p>

          <div className="mt-6 pt-5 border-t border-[#E8E8E8] space-y-2 text-xs text-left text-[#333333]">
            <div className="font-semibold text-[#050505] mb-1">Need assistance? Contact TRiMZ Salon:</div>
            <div className="flex items-center gap-2 text-[#5a5a5a]">
              <Phone className="w-3.5 h-3.5 text-[#E30613] shrink-0" />
              <span>+91 9966175299</span>
            </div>
            <div className="flex items-center gap-2 text-[#5a5a5a]">
              <Mail className="w-3.5 h-3.5 text-[#E30613] shrink-0" />
              <span>trimzsalonspt@gmail.com</span>
            </div>
            <div className="flex items-start gap-2 text-[#5a5a5a]">
              <MapPin className="w-3.5 h-3.5 text-[#E30613] shrink-0 mt-0.5" />
              <span>Shar Road, Sullurupeta, Erapalem, Andhra Pradesh – 524121</span>
            </div>
          </div>

          {errorType === 'NETWORK' && (
            <button
              onClick={fetchInvoice}
              className="mt-6 w-full py-2.5 rounded-xl bg-[#050505] hover:bg-[#222222] text-white text-xs font-bold transition-all flex items-center justify-center gap-2 shadow-sm"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          )}
        </div>
      </div>
    );
  }

  // Calculate items with minimum 6 rows for table balance on desktop
  const items = invoice.items || [];
  const minRows = 8;
  const dummyRowsCount = Math.max(0, minRows - items.length);

  return (
    <div className="min-h-screen bg-[#d9d9d9] text-[#111111] py-4 sm:py-8 px-2 sm:px-4 font-sans selection:bg-[#FBEEEE] selection:text-[#E30613]">
      <style jsx global>{`
        @page {
          size: A4 portrait;
          margin: 0;
        }
        @media print {
          html, body {
            background: #ffffff !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          .no-print {
            display: none !important;
          }
          .invoice-sheet {
            width: 210mm !important;
            min-height: 297mm !important;
            height: auto !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            page-break-after: avoid !important;
            break-inside: avoid !important;
          }
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>

      {/* Top Floating Action Bar (Hidden on print) */}
      <header className="no-print max-w-[850px] mx-auto mb-4 bg-white/95 backdrop-blur-md rounded-2xl p-3 sm:px-5 border border-[#E8E8E8] shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#050505] flex items-center justify-center text-white">
            <ShieldCheck className="w-4 h-4 text-[#E30613]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#050505] uppercase tracking-wider font-['Montserrat',sans-serif]">
                Verified Digital Invoice
              </span>
              <span className="px-2 py-0.5 rounded-full bg-[#FBEEEE] text-[#E30613] text-[10px] font-bold">
                {invoice.status}
              </span>
            </div>
            <p className="text-[11px] text-[#5a5a5a]">
              TRiMZ Unisex Salon • {invoice.invoice_number}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[#E8E8E8] hover:bg-[#F4F4F4] text-xs font-semibold text-[#111111] transition-all"
            title="Copy digital invoice link"
          >
            {copiedLink ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied!</span>
              </>
            ) : (
              <>
                <Share2 className="w-3.5 h-3.5 text-[#5a5a5a]" />
                <span>Share Link</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#E30613] hover:bg-[#c40510] text-white text-xs font-bold transition-all shadow-sm"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </header>

      {/* Main A4 Document Sheet */}
      <main className="invoice-sheet bg-white max-w-[850px] w-full mx-auto shadow-2xl flex flex-col md:flex-row overflow-hidden relative border border-[#E8E8E8]">
        
        {/* ============ LEFT SIDEBAR ============ */}
        <aside className="w-full md:w-[28%] bg-[#050505] text-white flex flex-col items-center justify-between p-6 md:p-0 md:border-r-[1.1mm] md:border-[#E30613] relative overflow-hidden shrink-0">
          
          <div className="w-full text-center md:pt-[36mm]">
            {/* Logo */}
            <div className="font-['Montserrat',sans-serif] font-black text-white text-3xl md:text-[27pt] tracking-tight leading-none">
              TR<span className="relative inline-block text-white">ı<span className="absolute left-1/2 top-0 w-[0.16em] h-[0.16em] bg-[#E30613] -translate-x-1/2 rounded-xs" /></span>MZ
            </div>
            
            <div className="font-['Montserrat',sans-serif] font-medium text-white text-[7.5pt] tracking-[3.2pt] mt-2 pl-[3.2pt]">
              UNISEX SALON
            </div>

            {/* Red accent bar */}
            <div className="w-12 h-[0.7mm] bg-[#E30613] mx-auto my-6" />

            {/* Tags */}
            <div className="flex flex-col items-center font-['Montserrat',sans-serif] font-semibold text-white text-[7.2pt] tracking-[3.4pt] space-y-1.5">
              <span>STYLE</span>
              <span className="block w-3 h-[0.6mm] bg-[#E30613]" />
              <span>CARE</span>
              <span className="block w-3 h-[0.6mm] bg-[#E30613]" />
              <span>CONFIDENCE</span>
            </div>
          </div>

          {/* Decorative Hair Art SVG */}
          <div className="w-full mt-6 md:mt-auto">
            <svg className="w-full h-auto block" viewBox="0 0 200 330" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path d="M-5 330 C10 250 30 170 95 95 C70 150 62 205 72 262 C50 236 25 250 -5 300 Z" fill="#3a3a3a" />
              <path d="M12 330 C25 262 50 190 112 118 C90 170 86 222 98 272 C74 256 42 270 12 330 Z" fill="#555" />
              <path d="M-5 275 C8 200 40 135 98 80 C70 130 52 190 56 250 C36 232 14 240 -5 275 Z" fill="#2a2a2a" />
              <path d="M18 290 C20 215 55 150 112 95 C82 150 74 210 90 265 C62 250 36 262 18 290 Z" fill="#E30613" />
              <path d="M6 322 C28 270 70 238 108 232 C84 250 60 280 52 330 Z" fill="#E30613" />
              <path d="M40 330 C48 285 80 262 118 255 C96 275 80 300 78 330 Z" fill="#5c5c5c" />
              <path d="M114 100 C128 118 134 142 130 164 C128 176 136 188 138 194 L130 198 C134 206 133 212 128 216 C126 224 124 232 116 238 C108 244 98 246 92 252"
                    fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M130 198 C124 200 120 203 118 206 M128 216 C122 217 118 220 115 224"
                    fill="none" stroke="#fff" strokeWidth="1.2" strokeLinecap="round" />
              <path d="M98 88 C106 92 111 96 114 100" fill="none" stroke="#fff" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
          </div>
        </aside>

        {/* ============ MAIN INVOICE BODY ============ */}
        <section className="flex-1 p-5 sm:p-7 md:p-8 flex flex-col justify-between bg-white min-w-0">
          
          {/* Header Title + Slogan */}
          <div>
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 relative pb-2">
              <h1 className="font-['Montserrat',sans-serif] font-black text-2xl sm:text-3xl md:text-[28pt] text-[#050505] tracking-tight leading-none">
                BILL<span className="text-[#E30613] font-normal mx-0.5">/</span><span className="text-[#E30613]">INVOICE</span>
              </h1>

              <div className="flex items-start gap-2 font-['Montserrat',sans-serif] font-medium text-[5.8pt] tracking-[1.6pt] text-[#111111] leading-tight self-start sm:self-auto">
                <span className="block w-[0.6mm] h-8 bg-[#E30613] -skew-x-[22deg]" />
                <div>
                  LOOK GOOD<br />
                  FEEL GOOD<br />
                  BE YOU
                </div>
              </div>
            </div>

            {/* Metadata 2-Column Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5 mt-4 pb-4 border-b-[0.4mm] border-[#E30613] text-[8.5pt]">
              {/* Left Column */}
              <div className="space-y-2">
                <div className="flex items-end">
                  <span className="w-24 shrink-0 font-medium text-[#5a5a5a]">Invoice No</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-bold font-mono border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.invoice_number}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="w-24 shrink-0 font-medium text-[#5a5a5a]">Date</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-semibold border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.date}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="w-24 shrink-0 font-medium text-[#5a5a5a]">Time</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-semibold border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.time}
                  </span>
                </div>
              </div>

              {/* Right Column */}
              <div className="space-y-2">
                <div className="flex items-end">
                  <span className="w-28 shrink-0 font-medium text-[#5a5a5a]">Stylist</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-bold border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.stylist || 'Team Member'}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="w-28 shrink-0 font-medium text-[#5a5a5a]">Customer Name</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-bold border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.customer_name || 'Walk-in Guest'}
                  </span>
                </div>
                <div className="flex items-end">
                  <span className="w-28 shrink-0 font-medium text-[#5a5a5a]">Phone No</span>
                  <span className="w-3 shrink-0 text-center">:</span>
                  <span className="flex-1 font-mono font-medium border-b border-[#9a9a9a] pb-0.5 px-1 truncate text-[#050505]">
                    {invoice.customer_phone_masked || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Table of Services / Items */}
            <div className="mt-4 overflow-x-auto">
              <table className="w-full border-collapse table-fixed text-[8pt]">
                <thead>
                  <tr className="bg-[#FBEEEE] text-[#050505] font-['Montserrat',sans-serif] font-bold text-[6.8pt] tracking-tight">
                    <th className="py-2 px-1 text-center w-[7%] rounded-l-sm">#</th>
                    <th className="py-2 px-2 text-left w-[36%] border-l border-[#E30613]/30">SERVICE / DESCRIPTION</th>
                    <th className="py-2 px-1 text-center w-[18%] border-l border-[#E30613]/30">STYLIST</th>
                    <th className="py-2 px-1 text-center w-[8%] border-l border-[#E30613]/30">QTY</th>
                    <th className="py-2 px-2 text-right w-[15%] border-l border-[#E30613]/30">PRICE (₹)</th>
                    <th className="py-2 px-2 text-right w-[16%] border-l border-[#E30613]/30 rounded-r-sm">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-[#FBEEEE]/30 transition-colors">
                      <td className="py-2 px-1 text-center font-mono text-[#5a5a5a] text-[7.5pt]">{idx + 1}</td>
                      <td className="py-2 px-2 text-left font-semibold text-[#050505] break-words leading-tight">{item.name}</td>
                      <td className="py-2 px-1 text-center text-[#5a5a5a] truncate">{item.stylist || invoice.stylist || '—'}</td>
                      <td className="py-2 px-1 text-center font-mono">{item.quantity}</td>
                      <td className="py-2 px-2 text-right font-mono text-[#5a5a5a]">{formatIndianCurrency(item.unit_price)}</td>
                      <td className="py-2 px-2 text-right font-mono font-bold text-[#050505]">{formatIndianCurrency(item.total_price)}</td>
                    </tr>
                  ))}
                  {/* Dummy balanced rows for authentic paper slip structure */}
                  {Array.from({ length: dummyRowsCount }).map((_, idx) => (
                    <tr key={`dummy-${idx}`} className="h-7 border-b border-[#E8E8E8]">
                      <td className="text-center font-mono text-[#E8E8E8] text-[7pt]">{items.length + idx + 1}</td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                      <td></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="border-b border-[#E8E8E8]" />
            </div>

            {/* Bottom Panels: Payment Details & Summary Box */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-[7.8pt]">
              {/* Payment Details Panel */}
              <div className="bg-[#FBEEEE] rounded-xl p-3.5 flex flex-col justify-between">
                <div>
                  <h4 className="font-['Montserrat',sans-serif] font-black text-[#E30613] text-[8.8pt] tracking-wide mb-2 uppercase">
                    PAYMENT DETAILS
                  </h4>
                  <div className="space-y-1.5">
                    <div className="flex items-end">
                      <span className="w-24 text-[#5a5a5a] shrink-0 font-medium">Payment Mode</span>
                      <span className="w-2 text-center">:</span>
                      <span className="flex-1 font-semibold border-b border-[#a8a8a8] px-1 truncate text-[#050505]">
                        {invoice.payment.payment_method}
                        {invoice.payment.payment_provider ? ` (${invoice.payment.payment_provider})` : ''}
                      </span>
                    </div>
                    <div className="flex items-end">
                      <span className="w-24 text-[#5a5a5a] shrink-0 font-medium">Transaction ID</span>
                      <span className="w-2 text-center">:</span>
                      <span className="flex-1 font-mono font-medium border-b border-[#a8a8a8] px-1 truncate text-[#050505]">
                        {invoice.payment.transaction_reference || '—'}
                      </span>
                    </div>
                    <div className="flex items-end">
                      <span className="w-24 text-[#5a5a5a] shrink-0 font-medium">Amount Paid</span>
                      <span className="w-2 text-center">:</span>
                      <span className="flex-1 font-mono font-semibold border-b border-[#a8a8a8] px-1 text-right text-[#050505]">
                        ₹{formatIndianCurrency(invoice.payment.amount_paid)}
                      </span>
                    </div>
                    <div className="flex items-end">
                      <span className="w-24 text-[#5a5a5a] shrink-0 font-medium">Balance Due</span>
                      <span className="w-2 text-center">:</span>
                      <span className="flex-1 font-mono font-semibold border-b border-[#a8a8a8] px-1 text-right text-[#050505]">
                        ₹{formatIndianCurrency(invoice.payment.balance_due)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-2.5 pt-2 border-t border-[#E30613]/20 flex items-center justify-between">
                  <span className="font-semibold text-[#5a5a5a]">Status:</span>
                  <span className="px-2.5 py-0.5 rounded-full bg-[#E30613] text-white font-black text-[7.5pt] uppercase tracking-wider">
                    {invoice.payment.status}
                  </span>
                </div>
              </div>

              {/* Summary & Grand Total Box */}
              <div className="flex flex-col justify-between">
                <div className="bg-[#FBEEEE] rounded-xl p-3.5 space-y-1.5 flex-1">
                  <div className="flex items-end justify-between">
                    <span className="text-[#5a5a5a] font-medium">Subtotal</span>
                    <span className="font-mono font-bold text-[#050505]">
                      ₹{formatIndianCurrency(invoice.subtotal)}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[#5a5a5a] font-medium">Discount</span>
                    <span className="font-mono font-bold text-emerald-600">
                      {invoice.discount_amount > 0 ? `- ₹${formatIndianCurrency(invoice.discount_amount)}` : '₹0.00'}
                    </span>
                  </div>
                  <div className="flex items-end justify-between">
                    <span className="text-[#5a5a5a] font-medium">
                      {invoice.tax_name || 'GST'} ({invoice.tax_percentage}%)
                    </span>
                    <span className="font-mono font-bold text-[#050505]">
                      ₹{formatIndianCurrency(invoice.tax_amount)}
                    </span>
                  </div>
                </div>

                {/* Red Total Banner */}
                <div className="mt-2 bg-[#E30613] text-white rounded-xl p-3 flex items-center justify-between shadow-sm">
                  <span className="font-['Montserrat',sans-serif] font-black text-[8.5pt] tracking-wider uppercase">
                    TOTAL AMOUNT (₹)
                  </span>
                  <span className="font-['Montserrat',sans-serif] font-black text-sm sm:text-base border-b border-white/70 pb-0.5 px-2 text-right">
                    ₹{formatIndianCurrency(invoice.total_amount)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer Thank You & Salon Contact */}
          <footer className="mt-6 pt-3 border-t border-[#E8E8E8] text-center">
            {/* Thank you note with heart */}
            <div className="flex items-center justify-center gap-4 my-2">
              <span className="h-[0.3mm] flex-1 bg-[#E30613]" />
              <div className="flex flex-col items-center">
                <span className="font-['Mrs_Saint_Delafield',cursive] text-3xl sm:text-4xl text-[#050505] leading-none mb-1">
                  Thank you
                </span>
                <div className="flex items-center gap-1.5 font-['Montserrat',sans-serif] font-semibold text-[5.8pt] tracking-[2pt] text-[#050505]">
                  <span>FOR CHOOSING TRiMZ SALON</span>
                  <svg className="w-3.5 h-3.5 text-[#E30613]" viewBox="0 0 24 22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 20.5C5 15 2 11.5 2 7.6 2 4.8 4.1 2.8 6.6 2.8c1.9 0 3.8 1 5.4 3.2 1.6-2.2 3.5-3.2 5.4-3.2 2.5 0 4.6 2 4.6 4.8 0 3.9-3 7.4-10 12.9z" />
                  </svg>
                </div>
              </div>
              <span className="h-[0.3mm] flex-1 bg-[#E30613]" />
            </div>

            {/* Contact Details Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-3 pt-2 text-[6.8pt] text-[#111111] font-medium text-left">
              <div className="flex items-center gap-1.5 truncate">
                <Mail className="w-3 h-3 text-[#E30613] shrink-0" />
                <span className="truncate">{invoice.business.email || 'trimzsalonspt@gmail.com'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Phone className="w-3 h-3 text-[#E30613] shrink-0" />
                <span>{invoice.business.phone || '+91 9966175299'}</span>
              </div>
              <div className="flex items-center gap-1.5 truncate">
                <span className="font-bold text-[#E30613]">@</span>
                <span className="truncate">{invoice.business.instagram || '@trimzunisexsalon'}</span>
              </div>
              <div className="sm:col-span-3 flex items-start gap-1.5 text-[#5a5a5a] pt-1">
                <MapPin className="w-3 h-3 text-[#E30613] shrink-0 mt-0.5" />
                <span>{invoice.business.address || 'Shar Road, Sullurupeta, Erapalem, Andhra Pradesh – 524121, India'}</span>
              </div>
            </div>
          </footer>

        </section>
      </main>
    </div>
  );
}
