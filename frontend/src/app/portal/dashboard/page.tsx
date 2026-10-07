'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { DashboardMetrics } from '@/lib/types';
import { 
  TrendingUp, 
  ShoppingBag, 
  CreditCard, 
  Users, 
  UserPlus, 
  Repeat, 
  DollarSign, 
  ArrowUpRight,
  Calendar,
  Loader2,
  PieChart
} from 'lucide-react';

export default function DashboardPage() {
  const [timeRange, setTimeRange] = useState('today');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchMetrics = async (range: string) => {
    setLoading(true);
    try {
      const data = await api.getDashboardMetrics(range);
      setMetrics(data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics(timeRange);
  }, [timeRange]);

  const ranges = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'this_year', label: 'This Year' },
    { key: 'all_time', label: 'Lifetime' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Executive Overview" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-surface p-3.5 rounded-xl border border-dark-border">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-400">
            <Calendar className="w-4 h-4 text-brand-400" />
            <span>Reporting Interval:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ranges.map((r) => (
              <button
                key={r.key}
                onClick={() => setTimeRange(r.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  timeRange === r.key
                    ? 'bg-brand-500 text-dark-bg font-bold shadow-md shadow-brand-500/20'
                    : 'text-gray-400 hover:text-white hover:bg-dark-card'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            <span className="text-xs text-gray-500 font-mono">Aggregating live transaction telemetry...</span>
          </div>
        ) : (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Revenue */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl relative overflow-hidden group hover:border-brand-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Gross Revenue</span>
                  <div className="w-9 h-9 rounded-xl bg-brand-500/10 border border-brand-500/20 flex items-center justify-center text-brand-400">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white font-mono tracking-tight">
                    {formatCurrency(metrics?.total_revenue || 0)}
                  </h3>
                  <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>Real-time settled sales</span>
                  </p>
                </div>
              </div>

              {/* Invoiced Sales */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl relative overflow-hidden group hover:border-brand-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Transactions</span>
                  <div className="w-9 h-9 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white font-mono tracking-tight">
                    {metrics?.transaction_count || 0}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">Completed bills generated</p>
                </div>
              </div>

              {/* Average Bill Value */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl relative overflow-hidden group hover:border-brand-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Average Bill</span>
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white font-mono tracking-tight">
                    {formatCurrency(metrics?.average_bill_value || 0)}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">Average ticket size</p>
                </div>
              </div>

              {/* Total Customers */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl relative overflow-hidden group hover:border-brand-500/40 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">Clients Served</span>
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-white font-mono tracking-tight">
                    {metrics?.unique_customers || 0}
                  </h3>
                  <p className="text-[11px] text-gray-400 mt-1">Unique customer check-ins</p>
                </div>
              </div>
            </div>

            {/* Customer Composition Bar */}
            <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-card border border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">New Guests</p>
                  <p className="text-xl font-bold text-white font-mono">{metrics?.new_customers || 0}</p>
                  <p className="text-[11px] text-gray-500">First-time visitors in this period</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-dark-card border border-dark-border">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-semibold">Repeat Guests</p>
                  <p className="text-xl font-bold text-white font-mono">{metrics?.repeat_customers || 0}</p>
                  <p className="text-[11px] text-gray-500">Returning loyal salon patrons</p>
                </div>
              </div>
            </div>

            {/* Split Breakdown Section: Payments & Top Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods & UPI breakdown */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-dark-border">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-brand-400" />
                    <h4 className="text-sm font-bold text-white">Payment Collections</h4>
                  </div>
                  <span className="text-xs text-gray-500">Settled receipts</span>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-gray-400 uppercase">By Instrument</div>
                  {Object.entries(metrics?.payment_methods_breakdown || {}).length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No payments in this range.</p>
                  ) : (
                    Object.entries(metrics?.payment_methods_breakdown || {}).map(([method, amt]) => (
                      <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-dark-card border border-dark-border">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-300">{method}</span>
                        <span className="text-sm font-bold font-mono text-white">{formatCurrency(amt)}</span>
                      </div>
                    ))
                  )}

                  <div className="text-xs font-semibold text-gray-400 uppercase pt-2">UPI Provider Breakdown</div>
                  {Object.entries(metrics?.upi_providers_breakdown || {}).length === 0 ? (
                    <p className="text-xs text-gray-500 italic">No UPI transactions logged yet.</p>
                  ) : (
                    Object.entries(metrics?.upi_providers_breakdown || {}).map(([prov, amt]) => (
                      <div key={prov} className="flex items-center justify-between p-2.5 rounded-lg bg-dark-card/50 text-xs">
                        <span className="text-gray-400 capitalize">{prov.replace('_', ' ')}</span>
                        <span className="font-mono text-gray-200">{formatCurrency(amt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Performing Services */}
              <div className="bg-dark-surface border border-dark-border p-5 rounded-2xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-dark-border">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-brand-400" />
                    <h4 className="text-sm font-bold text-white">Top Performing Services</h4>
                  </div>
                  <span className="text-xs text-gray-500">Revenue ranking</span>
                </div>

                <div className="space-y-2">
                  {!metrics?.top_services || metrics.top_services.length === 0 ? (
                    <div className="p-8 text-center text-xs text-gray-500 italic">
                      No service transactions recorded in this period.
                    </div>
                  ) : (
                    metrics.top_services.map((svc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-brand-500/10 text-brand-400 font-mono font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-gray-200">{svc.name}</p>
                            <p className="text-[11px] text-gray-500 font-mono">{svc.count} booked</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-mono text-brand-300">
                          {formatCurrency(svc.revenue)}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
