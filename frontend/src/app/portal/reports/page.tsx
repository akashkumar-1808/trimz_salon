'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { 
  BarChart3, 
  Calendar, 
  Download, 
  TrendingUp, 
  CreditCard, 
  Banknote, 
  Smartphone, 
  Scissors, 
  Users, 
  FileText, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Search,
  ArrowDownToLine,
  Layers
} from 'lucide-react';

export default function ReportsPage() {
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'daily' | 'summary' | 'customer'>('daily');

  // Daily Closing State
  const [dailyDate, setDailyDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dailyData, setDailyData] = useState<any>(null);
  const [loadingDaily, setLoadingDaily] = useState(false);

  // Sales Summary State (unapplied datepicker values)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  // CRITICAL: Applied filter date range (Single Source of Truth for report data and both exports)
  const [appliedStartDate, setAppliedStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [appliedEndDate, setAppliedEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  // Customer History State
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [customerHistory, setCustomerHistory] = useState<any>(null);
  const [loadingCustomerHistory, setLoadingCustomerHistory] = useState(false);

  // Fetch Daily Closing
  const fetchDailyClosing = async (date: string) => {
    setLoadingDaily(true);
    try {
      const data = await api.getDailyClosing(date);
      setDailyData(data);
    } catch (err: any) {
      console.error('Failed to load daily closing:', err);
    } finally {
      setLoadingDaily(false);
    }
  };

  // Fetch Sales Summary (updates applied range state)
  const fetchSalesSummary = async (s: string, e: string) => {
    setLoadingSummary(true);
    setExportNotice(null);
    try {
      const data = await api.getSalesSummary(s, e);
      setSummaryData(data);
      setAppliedStartDate(s);
      setAppliedEndDate(e);
    } catch (err: any) {
      console.error('Failed to load summary report:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleApplyFilter = () => {
    if (startDate > endDate) {
      alert('From Date cannot be later than To Date');
      return;
    }
    fetchSalesSummary(startDate, endDate);
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyClosing(dailyDate);
    } else if (activeTab === 'summary') {
      fetchSalesSummary(appliedStartDate, appliedEndDate);
    }
  }, [activeTab]);

  // Handle CSV Export (Strictly uses applied filter date range)
  const handleExportCsv = async () => {
    if (!summaryData || summaryData.completed_bills === 0 || summaryData.total_bills === 0) {
      alert('No sales data found for the applied date range. Nothing to export.');
      return;
    }
    setExportingCsv(true);
    setExportNotice(null);
    try {
      const blob = await api.exportSalesCsv(appliedStartDate, appliedEndDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimz-daily-sales-${appliedStartDate}-to-${appliedEndDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error downloading CSV'}`);
    } finally {
      setExportingCsv(false);
    }
  };

  // Handle PDF Export (Strictly uses applied filter date range)
  const handleExportPdf = async () => {
    if (!summaryData || summaryData.completed_bills === 0 || summaryData.total_bills === 0) {
      alert('No sales data found for the applied date range. Nothing to export.');
      return;
    }
    setExportingPdf(true);
    setExportNotice(null);
    try {
      const blob = await api.exportSalesPdf(appliedStartDate, appliedEndDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimz-daily-sales-${appliedStartDate}-to-${appliedEndDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err: any) {
      alert(`Export failed: ${err.message || 'Error downloading PDF'}`);
    } finally {
      setExportingPdf(false);
    }
  };

  // Search Customers
  useEffect(() => {
    if (!customerSearch.trim()) {
      setCustomerSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getCustomers(customerSearch);
        setCustomerSearchResults(res);
      } catch (err) {
        console.error('Customer search error:', err);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  const loadCustomerHistory = async (cid: string) => {
    setSelectedCustomerId(cid);
    setLoadingCustomerHistory(true);
    try {
      const res = await api.getCustomerPurchaseHistory(cid);
      setCustomerHistory(res);
    } catch (err: any) {
      alert(`Failed to load history: ${err.message}`);
    } finally {
      setLoadingCustomerHistory(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Financial Reports & Daily Closing" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ SALON ANALYTICS</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Reports & Daily Closing</h1>
            <p className="text-sm text-text-secondary mt-1">
              End-of-day register balancing, historical revenue trends, CSV exports, and customer purchase logs.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3 rounded-2xl border border-workspace-border shadow-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'daily'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Daily Closing (EOD)</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'summary'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Sales Range Summary</span>
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'customer'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customer History</span>
            </button>
          </div>

          {activeTab === 'summary' && hasPermission('reports.export') && (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                disabled={exportingCsv || exportingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-xs transition-all shadow-sm disabled:opacity-50"
                title={`Export CSV for applied range (${appliedStartDate} to ${appliedEndDate})`}
              >
                {exportingCsv ? (
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                ) : (
                  <ArrowDownToLine className="w-4 h-4 text-emerald-600" />
                )}
                <span>Export CSV</span>
              </button>

              <button
                type="button"
                onClick={handleExportPdf}
                disabled={exportingCsv || exportingPdf}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-all shadow-sm disabled:opacity-50"
                title={`Export PDF for applied range (${appliedStartDate} to ${appliedEndDate})`}
              >
                {exportingPdf ? (
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                ) : (
                  <FileText className="w-4 h-4 text-white" />
                )}
                <span>Export PDF</span>
              </button>
            </div>
          )}
        </div>

        {/* TAB 1: DAILY CLOSING (EOD) */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Date Picker Bar */}
            <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-text-primary">Select Business Day:</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => {
                    setDailyDate(e.target.value);
                    fetchDailyClosing(e.target.value);
                  }}
                  className="bg-workspace-bg border border-workspace-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-text-primary focus:bg-white"
                />
              </div>
              <span className="text-xs text-text-muted font-mono">
                Real-time transaction settlement for {dailyDate}
              </span>
            </div>

            {loadingDaily ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs text-text-muted font-mono">Calculating daily settlement totals...</span>
              </div>
            ) : dailyData ? (
              <>
                {/* Daily Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Total Revenue</span>
                    <h3 className="text-2xl font-bold text-primary font-mono mt-2">
                      {formatCurrency(dailyData.total_revenue || 0)}
                    </h3>
                    <p className="text-[11px] text-emerald-600 font-medium mt-1">
                      {dailyData.completed_bills} completed bill(s)
                    </p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Cash Collected</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2 flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-emerald-600" />
                      {formatCurrency(dailyData.cash_total || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">Cash in register drawer</p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">UPI / QR Settlements</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2 flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-blue-600" />
                      {formatCurrency(dailyData.upi_total || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">PhonePe, GPay, Paytm</p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Card POS Swipes</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-600" />
                      {formatCurrency(dailyData.card_total || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">Debit & Credit Cards</p>
                  </div>
                </div>

                {/* Additional Stats & Top Services */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ledger Breakdown */}
                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Layers className="w-4 h-4 text-primary" />
                      <span>Ledger Balance Breakdown</span>
                    </h4>
                    <div className="space-y-2 text-xs divide-y divide-workspace-border">
                      <div className="flex justify-between py-2 text-text-secondary">
                        <span>Total Bills Issued:</span>
                        <span className="font-mono font-bold text-text-primary">{dailyData.total_bills}</span>
                      </div>
                      <div className="flex justify-between py-2 text-text-secondary">
                        <span>Cancelled / Voided Bills:</span>
                        <span className="font-mono font-bold text-rose-600">{dailyData.cancelled_bills}</span>
                      </div>
                      <div className="flex justify-between py-2 text-text-secondary">
                        <span>Discounts Conceded:</span>
                        <span className="font-mono font-bold text-emerald-600">-{formatCurrency(dailyData.total_discount || 0)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-text-secondary">
                        <span>GST / Taxes Collected:</span>
                        <span className="font-mono font-bold text-text-secondary">+{formatCurrency(dailyData.total_tax || 0)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm font-bold text-text-primary pt-3">
                        <span>Net Daily Revenue:</span>
                        <span className="font-mono text-primary font-bold">
                          {formatCurrency((dailyData.total_revenue || 0) - (dailyData.total_tax || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Services of the Day */}
                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm space-y-4">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-primary" />
                      <span>Top Performing Services Today</span>
                    </h4>
                    {dailyData.top_services?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-text-muted">
                        No service sales recorded for this date.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dailyData.top_services?.map((svc: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-workspace-bg border border-workspace-border text-xs"
                          >
                            <div>
                              <p className="font-semibold text-text-primary">{svc.name}</p>
                              <p className="text-[11px] text-text-muted font-mono">Count: {svc.quantity} session(s)</p>
                            </div>
                            <span className="font-mono font-bold text-primary text-sm">
                              {formatCurrency(svc.revenue)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* TAB 2: SALES RANGE SUMMARY */}
        {activeTab === 'summary' && (
          <div className="space-y-6">
            {/* Date Range Picker */}
            <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-text-primary">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-workspace-bg border border-workspace-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-text-primary focus:bg-white"
                />
                <span className="text-xs font-semibold text-text-primary">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-workspace-bg border border-workspace-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-text-primary focus:bg-white"
                />
                <button
                  type="button"
                  onClick={handleApplyFilter}
                  disabled={loadingSummary}
                  className="px-4 py-1.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-xs transition-all shadow-sm disabled:opacity-50"
                >
                  {loadingSummary ? 'Applying...' : 'Apply Filter'}
                </button>
              </div>
              <div className="text-xs text-text-muted font-mono flex items-center gap-2">
                <span>Applied: <strong className="text-text-primary font-semibold">{appliedStartDate} &ndash; {appliedEndDate}</strong></span>
                <span>&bull;</span>
                <span>{summaryData?.completed_bills || 0} completed bill(s)</span>
              </div>
            </div>

            {loadingSummary ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs text-text-muted font-mono">Aggregating date range revenue...</span>
              </div>
            ) : summaryData && (summaryData.completed_bills === 0 || summaryData.total_bills === 0) ? (
              <div className="p-12 text-center bg-white rounded-2xl border border-workspace-border shadow-sm space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-workspace-bg border border-workspace-border flex items-center justify-center mx-auto text-text-muted">
                  <Calendar className="w-6 h-6 text-text-muted" />
                </div>
                <h3 className="font-bold text-sm text-text-primary">No Sales Recorded for Selected Period</h3>
                <p className="text-xs text-text-muted max-w-md mx-auto">
                  No completed transactions were found between <span className="font-mono font-semibold text-text-secondary">{appliedStartDate}</span> and <span className="font-mono font-semibold text-text-secondary">{appliedEndDate}</span>. Select a different date range or record sales at POS to generate reports.
                </p>
              </div>
            ) : summaryData ? (
              <>
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Period Gross Sales</span>
                    <h3 className="text-2xl font-bold text-primary font-mono mt-2">
                      {formatCurrency(summaryData.total_revenue || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">
                      {summaryData.completed_bills} completed sale(s)
                    </p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">UPI Total</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.UPI || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">Digital payments</p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Cash Total</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.CASH || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">Physical currency</p>
                  </div>

                  <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
                    <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Card Total</span>
                    <h3 className="text-2xl font-bold text-text-primary font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.CARD || 0)}
                    </h3>
                    <p className="text-[11px] text-text-muted mt-1">Terminal swipes</p>
                  </div>
                </div>

                {/* Daily Trend Table */}
                <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-workspace-border">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      <span>Daily Performance Ledger</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                          <th className="p-4">Date</th>
                          <th className="p-4">Bills</th>
                          <th className="p-4">Cash (₹)</th>
                          <th className="p-4">UPI (₹)</th>
                          <th className="p-4">Card (₹)</th>
                          <th className="p-4 text-right">Total Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-workspace-border">
                        {summaryData.daily_trend?.map((row: any) => (
                          <tr key={row.date} className="hover:bg-workspace-hover/50 transition-colors">
                            <td className="p-4 font-mono font-medium text-text-primary">{row.date}</td>
                            <td className="p-4 font-mono text-text-secondary">{row.sales_count}</td>
                            <td className="p-4 font-mono text-emerald-600">{formatCurrency(row.cash_amount)}</td>
                            <td className="p-4 font-mono text-blue-600">{formatCurrency(row.upi_amount)}</td>
                            <td className="p-4 font-mono text-amber-600">{formatCurrency(row.card_amount)}</td>
                            <td className="p-4 text-right font-mono font-bold text-primary text-sm">
                              {formatCurrency(row.total_amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* TAB 3: CUSTOMER PURCHASE HISTORY */}
        {activeTab === 'customer' && (
          <div className="space-y-6">
            {/* Customer Search Bar */}
            <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm">
              <label className="text-xs font-semibold text-text-primary block mb-2">Search Customer:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by customer name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
                />
              </div>

              {customerSearchResults.length > 0 && (
                <div className="mt-3 divide-y divide-workspace-border border border-workspace-border rounded-xl bg-white overflow-hidden shadow-sm">
                  {customerSearchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setCustomerSearch(cust.name);
                        setCustomerSearchResults([]);
                        loadCustomerHistory(cust.id);
                      }}
                      className="p-3 hover:bg-workspace-hover cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="text-xs font-semibold text-text-primary">{cust.name}</p>
                        <p className="text-[11px] text-text-muted font-mono">{cust.phone}</p>
                      </div>
                      <span className="text-[11px] font-mono text-primary font-semibold">
                        {cust.total_visits} visits | {formatCurrency(cust.total_spend || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loadingCustomerHistory ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                <span className="text-xs text-text-muted font-mono">Loading purchase history...</span>
              </div>
            ) : customerHistory ? (
              <div className="space-y-6">
                {/* Customer Profile Banner */}
                <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-bold text-text-primary">{customerHistory.customer_name}</h3>
                    <p className="text-xs text-text-muted font-mono">{customerHistory.customer_phone}</p>
                  </div>
                  <div className="flex gap-6 text-xs font-mono">
                    <div>
                      <span className="text-text-muted block uppercase text-[10px]">Visits</span>
                      <span className="text-text-primary font-bold text-sm">{customerHistory.total_visits}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block uppercase text-[10px]">Lifetime Spend</span>
                      <span className="text-primary font-bold text-sm">{formatCurrency(customerHistory.total_spend)}</span>
                    </div>
                    <div>
                      <span className="text-text-muted block uppercase text-[10px]">Loyalty Points</span>
                      <span className="text-amber-600 font-bold text-sm">{customerHistory.loyalty_points}</span>
                    </div>
                  </div>
                </div>

                {/* Sales Ledger */}
                <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
                  <div className="p-4 border-b border-workspace-border">
                    <h4 className="text-sm font-semibold text-text-primary flex items-center gap-2">
                      <FileText className="w-4 h-4 text-primary" />
                      <span>Past Transactions & Services Availed</span>
                    </h4>
                  </div>
                  {customerHistory.sales?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-text-muted">
                      No purchase records found for this customer.
                    </div>
                  ) : (
                    <div className="divide-y divide-workspace-border">
                      {customerHistory.sales?.map((sale: any) => (
                        <div key={sale.sale_id} className="p-4 space-y-2 hover:bg-workspace-hover/40 transition-colors">
                          <div className="flex flex-wrap items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-text-primary">{sale.sale_number}</span>
                              {sale.invoice_number && (
                                <span className="text-text-muted font-mono">({sale.invoice_number})</span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                                sale.status === 'COMPLETED'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}>
                                {sale.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 font-mono">
                              <span className="text-text-muted">{new Date(sale.created_at).toLocaleDateString()}</span>
                              <span className="font-bold text-primary text-sm">{formatCurrency(sale.total_amount)}</span>
                            </div>
                          </div>
                          {/* Availed items list */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {sale.items?.map((item: any, i: number) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-workspace-bg border border-workspace-border text-[11px] text-text-secondary font-medium"
                              >
                                {item.service_name} {item.quantity > 1 ? `x${item.quantity}` : ''} ({formatCurrency(item.total_price)})
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-16 text-center text-text-muted text-sm bg-white rounded-2xl border border-workspace-border">
                Search and select a customer above to view their purchase history.
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
