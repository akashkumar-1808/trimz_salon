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

  // Sales Summary State
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [summaryData, setSummaryData] = useState<any>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);

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

  // Fetch Sales Summary
  const fetchSalesSummary = async (s: string, e: string) => {
    setLoadingSummary(true);
    try {
      const data = await api.getSalesSummary(s, e);
      setSummaryData(data);
    } catch (err: any) {
      console.error('Failed to load summary report:', err);
    } finally {
      setLoadingSummary(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'daily') {
      fetchDailyClosing(dailyDate);
    } else if (activeTab === 'summary') {
      fetchSalesSummary(startDate, endDate);
    }
  }, [activeTab]);

  // Handle CSV Export
  const handleExportCsv = async () => {
    setExportingCsv(true);
    try {
      const blob = await api.exportSalesCsv(startDate, endDate);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trimz_sales_export_${startDate}_to_${endDate}.csv`;
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
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Financial Reports & Daily Closing" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-surface p-3 rounded-2xl border border-dark-border">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('daily')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'daily'
                  ? 'bg-brand-500 text-dark-bg shadow-md shadow-brand-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Daily Closing (EOD)</span>
            </button>
            <button
              onClick={() => setActiveTab('summary')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'summary'
                  ? 'bg-brand-500 text-dark-bg shadow-md shadow-brand-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              <span>Sales Range Summary</span>
            </button>
            <button
              onClick={() => setActiveTab('customer')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                activeTab === 'customer'
                  ? 'bg-brand-500 text-dark-bg shadow-md shadow-brand-500/20'
                  : 'text-gray-400 hover:text-white hover:bg-dark-card'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Customer History</span>
            </button>
          </div>

          {activeTab === 'summary' && hasPermission('reports.export') && (
            <button
              onClick={handleExportCsv}
              disabled={exportingCsv}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 font-semibold text-xs transition-all disabled:opacity-50"
            >
              {exportingCsv ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowDownToLine className="w-4 h-4" />
              )}
              <span>Export CSV</span>
            </button>
          )}
        </div>

        {/* TAB 1: DAILY CLOSING (EOD) */}
        {activeTab === 'daily' && (
          <div className="space-y-6">
            {/* Date Picker Bar */}
            <div className="bg-dark-surface p-4 rounded-2xl border border-dark-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <Calendar className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-bold text-gray-300">Select Business Day:</span>
                <input
                  type="date"
                  value={dailyDate}
                  onChange={(e) => {
                    setDailyDate(e.target.value);
                    fetchDailyClosing(e.target.value);
                  }}
                  className="bg-dark-card border border-dark-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
              </div>
              <span className="text-xs text-gray-500 font-mono">
                Real-time transaction settlement for {dailyDate}
              </span>
            </div>

            {loadingDaily ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                <span className="text-xs text-gray-500 font-mono">Calculating daily settlement totals...</span>
              </div>
            ) : dailyData ? (
              <>
                {/* Daily Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Revenue</span>
                    <h3 className="text-2xl font-black text-white font-mono mt-2">
                      {formatCurrency(dailyData.total_revenue || 0)}
                    </h3>
                    <p className="text-[11px] text-emerald-400 mt-1">
                      {dailyData.completed_bills} completed bill(s)
                    </p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cash Collected</span>
                    <h3 className="text-2xl font-black text-emerald-400 font-mono mt-2 flex items-center gap-2">
                      <Banknote className="w-5 h-5 text-emerald-400" />
                      {formatCurrency(dailyData.cash_total || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">Cash in register drawer</p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">UPI / QR Settlements</span>
                    <h3 className="text-2xl font-black text-blue-400 font-mono mt-2 flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-blue-400" />
                      {formatCurrency(dailyData.upi_total || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">PhonePe, GPay, Paytm</p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Card POS Swipes</span>
                    <h3 className="text-2xl font-black text-amber-400 font-mono mt-2 flex items-center gap-2">
                      <CreditCard className="w-5 h-5 text-amber-400" />
                      {formatCurrency(dailyData.card_total || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">Debit & Credit Cards</p>
                  </div>
                </div>

                {/* Additional Stats & Top Services */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Ledger Breakdown */}
                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Layers className="w-4 h-4 text-brand-400" />
                      <span>Ledger Balance Breakdown</span>
                    </h4>
                    <div className="space-y-2 text-xs divide-y divide-dark-border">
                      <div className="flex justify-between py-2 text-gray-300">
                        <span>Total Bills Issued:</span>
                        <span className="font-mono font-bold text-white">{dailyData.total_bills}</span>
                      </div>
                      <div className="flex justify-between py-2 text-gray-300">
                        <span>Cancelled / Voided Bills:</span>
                        <span className="font-mono font-bold text-rose-400">{dailyData.cancelled_bills}</span>
                      </div>
                      <div className="flex justify-between py-2 text-gray-300">
                        <span>Discounts Conceded:</span>
                        <span className="font-mono font-bold text-emerald-400">-{formatCurrency(dailyData.total_discount || 0)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-gray-300">
                        <span>GST / Taxes Collected:</span>
                        <span className="font-mono font-bold text-amber-400">+{formatCurrency(dailyData.total_tax || 0)}</span>
                      </div>
                      <div className="flex justify-between py-2 text-sm font-bold text-white pt-3">
                        <span>Net Daily Revenue:</span>
                        <span className="font-mono text-brand-400">
                          {formatCurrency((dailyData.total_revenue || 0) - (dailyData.total_tax || 0))}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Top Services of the Day */}
                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl space-y-4">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Scissors className="w-4 h-4 text-brand-400" />
                      <span>Top Performing Services Today</span>
                    </h4>
                    {dailyData.top_services?.length === 0 ? (
                      <div className="p-8 text-center text-xs text-gray-500">
                        No service sales recorded for this date.
                      </div>
                    ) : (
                      <div className="space-y-2.5">
                        {dailyData.top_services?.map((svc: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-dark-card border border-dark-border text-xs"
                          >
                            <div>
                              <p className="font-bold text-gray-200">{svc.name}</p>
                              <p className="text-[11px] text-gray-500 font-mono">Count: {svc.quantity} session(s)</p>
                            </div>
                            <span className="font-mono font-bold text-brand-400 text-sm">
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
            <div className="bg-dark-surface p-4 rounded-2xl border border-dark-border flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <Calendar className="w-4 h-4 text-brand-400" />
                <span className="text-xs font-bold text-gray-300">From:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-dark-card border border-dark-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                <span className="text-xs font-bold text-gray-300">To:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-dark-card border border-dark-border rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-brand-500"
                />
                <button
                  onClick={() => fetchSalesSummary(startDate, endDate)}
                  className="px-4 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20"
                >
                  Apply Filter
                </button>
              </div>
              <span className="text-xs text-gray-500 font-mono">
                {summaryData?.total_bills || 0} total transactions in period
              </span>
            </div>

            {loadingSummary ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                <span className="text-xs text-gray-500 font-mono">Aggregating date range revenue...</span>
              </div>
            ) : summaryData ? (
              <>
                {/* Metric Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Period Gross Sales</span>
                    <h3 className="text-2xl font-black text-white font-mono mt-2">
                      {formatCurrency(summaryData.total_revenue || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">
                      {summaryData.completed_bills} completed sale(s)
                    </p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">UPI Total</span>
                    <h3 className="text-2xl font-black text-blue-400 font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.UPI || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">Digital payments</p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Cash Total</span>
                    <h3 className="text-2xl font-black text-emerald-400 font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.CASH || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">Physical currency</p>
                  </div>

                  <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">Card Total</span>
                    <h3 className="text-2xl font-black text-amber-400 font-mono mt-2">
                      {formatCurrency(summaryData.payment_methods?.CARD || 0)}
                    </h3>
                    <p className="text-[11px] text-gray-500 mt-1">Terminal swipes</p>
                  </div>
                </div>

                {/* Daily Trend Table */}
                <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-dark-border">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-brand-400" />
                      <span>Daily Performance Ledger</span>
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
                          <th className="p-4">Date</th>
                          <th className="p-4">Bills</th>
                          <th className="p-4">Cash (₹)</th>
                          <th className="p-4">UPI (₹)</th>
                          <th className="p-4">Card (₹)</th>
                          <th className="p-4 text-right">Total Amount (₹)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-dark-border">
                        {summaryData.daily_trend?.map((row: any) => (
                          <tr key={row.date} className="hover:bg-dark-card/50 transition-colors">
                            <td className="p-4 font-mono font-bold text-gray-300">{row.date}</td>
                            <td className="p-4 font-mono text-gray-400">{row.sales_count}</td>
                            <td className="p-4 font-mono text-emerald-400">{formatCurrency(row.cash_amount)}</td>
                            <td className="p-4 font-mono text-blue-400">{formatCurrency(row.upi_amount)}</td>
                            <td className="p-4 font-mono text-amber-400">{formatCurrency(row.card_amount)}</td>
                            <td className="p-4 text-right font-mono font-bold text-white text-sm">
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
            <div className="bg-dark-surface p-4 rounded-2xl border border-dark-border">
              <label className="text-xs font-bold text-gray-300 block mb-2">Search Customer:</label>
              <div className="relative">
                <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search by customer name or phone..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
              </div>

              {customerSearchResults.length > 0 && (
                <div className="mt-3 divide-y divide-dark-border border border-dark-border rounded-xl bg-dark-card overflow-hidden">
                  {customerSearchResults.map((cust) => (
                    <div
                      key={cust.id}
                      onClick={() => {
                        setCustomerSearch(cust.name);
                        setCustomerSearchResults([]);
                        loadCustomerHistory(cust.id);
                      }}
                      className="p-3 hover:bg-dark-surface/60 cursor-pointer flex items-center justify-between transition-colors"
                    >
                      <div>
                        <p className="text-xs font-bold text-white">{cust.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{cust.phone}</p>
                      </div>
                      <span className="text-[11px] font-mono text-brand-400 font-semibold">
                        {cust.total_visits} visits | {formatCurrency(cust.total_spend || 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {loadingCustomerHistory ? (
              <div className="h-64 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
                <span className="text-xs text-gray-500 font-mono">Loading purchase history...</span>
              </div>
            ) : customerHistory ? (
              <div className="space-y-6">
                {/* Customer Profile Banner */}
                <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-black text-white">{customerHistory.customer_name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{customerHistory.customer_phone}</p>
                  </div>
                  <div className="flex gap-6 text-xs font-mono">
                    <div>
                      <span className="text-gray-500 block uppercase text-[10px]">Visits</span>
                      <span className="text-white font-bold text-sm">{customerHistory.total_visits}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase text-[10px]">Lifetime Spend</span>
                      <span className="text-brand-400 font-bold text-sm">{formatCurrency(customerHistory.total_spend)}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 block uppercase text-[10px]">Loyalty Points</span>
                      <span className="text-amber-400 font-bold text-sm">{customerHistory.loyalty_points}</span>
                    </div>
                  </div>
                </div>

                {/* Sales Ledger */}
                <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
                  <div className="p-4 border-b border-dark-border">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <FileText className="w-4 h-4 text-brand-400" />
                      <span>Past Transactions & Services Availed</span>
                    </h4>
                  </div>
                  {customerHistory.sales?.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500">
                      No purchase records found for this customer.
                    </div>
                  ) : (
                    <div className="divide-y divide-dark-border">
                      {customerHistory.sales?.map((sale: any) => (
                        <div key={sale.sale_id} className="p-4 space-y-2 hover:bg-dark-card/30 transition-colors">
                          <div className="flex flex-wrap items-center justify-between text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-bold text-brand-300">{sale.sale_number}</span>
                              {sale.invoice_number && (
                                <span className="text-gray-500 font-mono">({sale.invoice_number})</span>
                              )}
                              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                sale.status === 'COMPLETED'
                                  ? 'bg-emerald-500/10 text-emerald-400'
                                  : 'bg-rose-500/10 text-rose-400'
                              }`}>
                                {sale.status}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 font-mono">
                              <span className="text-gray-400">{new Date(sale.created_at).toLocaleDateString()}</span>
                              <span className="font-bold text-white text-sm">{formatCurrency(sale.total_amount)}</span>
                            </div>
                          </div>
                          {/* Availed items list */}
                          <div className="flex flex-wrap gap-2 pt-1">
                            {sale.items?.map((item: any, i: number) => (
                              <span
                                key={i}
                                className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border text-[11px] text-gray-300 font-medium"
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
              <div className="p-16 text-center text-gray-500 text-xs">
                Search and select a customer above to view their purchase history.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
