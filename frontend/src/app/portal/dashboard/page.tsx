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
  PieChart,
  Clock,
  Check,
  UserCheck
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';

export default function DashboardPage() {
  const { user, hasPermission } = useAuth();
  const [timeRange, setTimeRange] = useState('today');
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingEmployees, setPendingEmployees] = useState<any[]>([]);
  const [approvingId, setApprovingId] = useState<string | null>(null);

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

  const loadPendingStaff = async () => {
    if (user?.is_owner || hasPermission('employees.view')) {
      try {
        const emps = await api.getEmployees();
        const pending = emps.filter((e: any) => e.status?.toUpperCase() === 'PENDING');
        setPendingEmployees(pending);
      } catch (err) {
        console.error('Failed to load pending staff:', err);
      }
    }
  };

  useEffect(() => {
    fetchMetrics(timeRange);
  }, [timeRange]);

  useEffect(() => {
    loadPendingStaff();
  }, [user]);

  const handleQuickApprove = async (empId: string) => {
    setApprovingId(empId);
    try {
      await api.activateEmployee(empId);
      setPendingEmployees((prev) => prev.filter((e) => e.id !== empId));
    } catch (err: any) {
      alert(`Failed to approve staff member: ${err.message}`);
    } finally {
      setApprovingId(null);
    }
  };

  const ranges = [
    { key: 'today', label: 'Today' },
    { key: 'yesterday', label: 'Yesterday' },
    { key: 'this_week', label: 'This Week' },
    { key: 'this_month', label: 'This Month' },
    { key: 'this_year', label: 'This Year' },
    { key: 'all_time', label: 'Lifetime' },
  ];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F6F5]">
      <Topbar title="Overview" breadcrumb="Overview" />

      <div className="p-6 md:p-8 space-y-6 max-w-[1600px] mx-auto w-full">
        {/* Header Title Row */}
        <div>
          <p className="text-[11px] font-semibold tracking-widest text-[#929292] uppercase">
            EXECUTIVE TELEMETRY
          </p>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#171717] tracking-tight mt-1">
            Executive Overview
          </h1>
          <p className="text-sm text-[#737373] mt-1">
            Real-time revenue, guest demographics, and salon transaction telemetry.
          </p>
        </div>

        {/* Pending Staff Approvals Action Card */}
        {pendingEmployees.length > 0 && (
          <div className="bg-amber-50/90 border border-amber-300 rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-amber-950">
                      Staff Registration Awaiting Approval ({pendingEmployees.length})
                    </h3>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-200 text-amber-800 tracking-wider">
                      Action Required
                    </span>
                  </div>
                  <p className="text-xs text-amber-900/80 mt-1">
                    New staff accounts registered online and require owner approval and operational feature permissions before accessing the salon terminal.
                  </p>
                  <div className="flex flex-wrap gap-2 mt-2.5">
                    {pendingEmployees.map((emp) => (
                      <div
                        key={emp.id}
                        className="flex items-center gap-2 bg-white/90 border border-amber-200 px-3 py-1.5 rounded-xl shadow-2xs"
                      >
                        <div className="text-xs">
                          <span className="font-bold text-gray-900">{emp.name}</span>{' '}
                          <span className="text-gray-500 font-mono text-[11px]">({emp.email})</span>
                        </div>
                        <button
                          type="button"
                          disabled={approvingId === emp.id}
                          onClick={() => handleQuickApprove(emp.id)}
                          className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs flex items-center gap-1 transition-all disabled:opacity-50"
                        >
                          {approvingId === emp.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                          <span>Approve</span>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0 self-end md:self-auto">
                <Link
                  href="/portal/employees"
                  className="px-4 py-2.5 rounded-xl text-xs font-bold bg-amber-900 hover:bg-amber-950 text-white shadow-xs flex items-center gap-1.5 transition-all"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Go to Staff & Permissions</span>
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Filter Interval Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-3.5 rounded-2xl border border-[#E8E5E3] shadow-sm">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#737373] px-1">
            <Calendar className="w-4 h-4 text-[#737373]" />
            <span>Reporting Interval:</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {ranges.map((r) => {
              const isActive = timeRange === r.key;
              return (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => setTimeRange(r.key)}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-[#171717] text-white shadow-sm'
                      : 'bg-white text-[#171717] border border-[#E8E5E3] hover:bg-[#F5F4F3]'
                  }`}
                >
                  {r.label}
                </button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div className="h-96 flex flex-col items-center justify-center gap-3 bg-white rounded-2xl border border-[#E8E5E3]">
            <Loader2 className="w-8 h-8 animate-spin text-[#737373]" />
            <span className="text-xs text-[#737373] font-mono">Aggregating live transaction telemetry...</span>
          </div>
        ) : (
          <>
            {/* Primary Metrics Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Gross Revenue */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm hover:border-[#171717]/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Gross Revenue</span>
                  <div className="w-9 h-9 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-[#171717] font-mono tracking-tight">
                    {formatCurrency(metrics?.total_revenue || 0)}
                  </h3>
                  <p className="text-[11px] text-[#737373] mt-1 flex items-center gap-1 font-medium">
                    <ArrowUpRight className="w-3.5 h-3.5 text-[#737373]" />
                    <span>Real-time settled sales</span>
                  </p>
                </div>
              </div>

              {/* Invoiced Sales */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm hover:border-[#171717]/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Transactions</span>
                  <div className="w-9 h-9 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-[#171717] font-mono tracking-tight">
                    {metrics?.transaction_count || 0}
                  </h3>
                  <p className="text-[11px] text-[#737373] mt-1">Completed bills generated</p>
                </div>
              </div>

              {/* Average Bill Value */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm hover:border-[#171717]/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Average Bill</span>
                  <div className="w-9 h-9 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-[#171717] font-mono tracking-tight">
                    {formatCurrency(metrics?.average_bill_value || 0)}
                  </h3>
                  <p className="text-[11px] text-[#737373] mt-1">Average ticket size</p>
                </div>
              </div>

              {/* Total Customers */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm hover:border-[#171717]/30 transition-all">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#737373] uppercase tracking-wider">Clients Served</span>
                  <div className="w-9 h-9 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="mt-3">
                  <h3 className="text-2xl font-black text-[#171717] font-mono tracking-tight">
                    {metrics?.unique_customers || 0}
                  </h3>
                  <p className="text-[11px] text-[#737373] mt-1">Unique customer check-ins</p>
                </div>
              </div>
            </div>

            {/* Customer Composition Bar */}
            <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                  <UserPlus className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-[#737373] uppercase font-semibold">New Guests</p>
                  <p className="text-xl font-bold text-[#171717] font-mono">{metrics?.new_customers || 0}</p>
                  <p className="text-[11px] text-[#929292]">First-time visitors in this period</p>
                </div>
              </div>

              <div className="flex items-center gap-4 p-4 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]">
                <div className="w-10 h-10 rounded-xl bg-white border border-[#E8E5E3] flex items-center justify-center text-[#737373]">
                  <Repeat className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs text-[#737373] uppercase font-semibold">Repeat Guests</p>
                  <p className="text-xl font-bold text-[#171717] font-mono">{metrics?.repeat_customers || 0}</p>
                  <p className="text-[11px] text-[#929292]">Returning loyal salon patrons</p>
                </div>
              </div>
            </div>

            {/* Split Breakdown Section: Payments & Top Services */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Methods & UPI breakdown */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEB]">
                  <div className="flex items-center gap-2">
                    <CreditCard className="w-4 h-4 text-[#737373]" />
                    <h4 className="text-sm font-bold text-[#171717]">Payment Collections</h4>
                  </div>
                  <span className="text-xs text-[#737373]">Settled receipts</span>
                </div>

                <div className="space-y-3">
                  <div className="text-xs font-semibold text-[#737373] uppercase">By Instrument</div>
                  {Object.entries(metrics?.payment_methods_breakdown || {}).length === 0 ? (
                    <p className="text-xs text-[#929292] italic">No payments in this range.</p>
                  ) : (
                    Object.entries(metrics?.payment_methods_breakdown || {}).map(([method, amt]) => (
                      <div key={method} className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]">
                        <span className="text-xs font-bold uppercase tracking-wider text-[#171717]">{method}</span>
                        <span className="text-sm font-bold font-mono text-[#171717]">{formatCurrency(amt)}</span>
                      </div>
                    ))
                  )}

                  <div className="text-xs font-semibold text-[#737373] uppercase pt-2">UPI Provider Breakdown</div>
                  {Object.entries(metrics?.upi_providers_breakdown || {}).length === 0 ? (
                    <p className="text-xs text-[#929292] italic">No UPI transactions logged yet.</p>
                  ) : (
                    Object.entries(metrics?.upi_providers_breakdown || {}).map(([prov, amt]) => (
                      <div key={prov} className="flex items-center justify-between p-2.5 rounded-lg bg-[#F7F6F5] text-xs">
                        <span className="text-[#737373] capitalize">{prov.replace('_', ' ')}</span>
                        <span className="font-mono text-[#171717] font-semibold">{formatCurrency(amt)}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Top Performing Services */}
              <div className="bg-white border border-[#E8E5E3] p-5 rounded-2xl shadow-sm space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#F0EEEB]">
                  <div className="flex items-center gap-2">
                    <PieChart className="w-4 h-4 text-[#737373]" />
                    <h4 className="text-sm font-bold text-[#171717]">Top Performing Services</h4>
                  </div>
                  <span className="text-xs text-[#737373]">Revenue ranking</span>
                </div>

                <div className="space-y-2">
                  {!metrics?.top_services || metrics.top_services.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#929292] italic">
                      No service transactions recorded in this period.
                    </div>
                  ) : (
                    metrics.top_services.map((svc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-3 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] hover:border-[#171717]/30 transition-all"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded-lg bg-[#F7F6F5] border border-[#E8E5E3] text-[#737373] font-mono font-bold text-xs flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <p className="text-xs font-semibold text-[#171717]">{svc.name}</p>
                            <p className="text-[11px] text-[#737373] font-mono">{svc.count} booked</p>
                          </div>
                        </div>
                        <span className="text-xs font-bold font-mono text-[#171717]">
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
