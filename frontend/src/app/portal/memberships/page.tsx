'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { 
  Award, Plus, Search, Check, Users, Sparkles, X, 
  Pause, Play, RefreshCw, AlertTriangle, ShieldCheck, 
  Calendar, Phone, CreditCard, ChevronRight, Eye, UserCheck, 
  Clock, History, CheckCircle2, XCircle, Tag, ArrowUpRight
} from 'lucide-react';
import { formatCurrency, toSafeNumber } from '@/lib/utils';
import { api } from '@/lib/api';
import { MembershipPlan, CustomerMembership, MembershipUsageLedger } from '@/lib/types';

export default function MembershipsPage() {
  const [activeTab, setActiveTab] = useState<'members' | 'plans'>('members');
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [members, setMembers] = useState<CustomerMembership[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filters & Search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'EXPIRED' | 'CANCELLED'>('ALL');
  const [planFilter, setPlanFilter] = useState<string>('ALL');

  // Modals
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isPlanModalOpen, setIsPlanModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<CustomerMembership | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [actionModal, setActionModal] = useState<{
    type: 'pause' | 'resume' | 'renew' | 'cancel' | null;
    member: CustomerMembership | null;
  }>({ type: null, member: null });

  // Registration Form State
  const [regPhone, setRegPhone] = useState('');
  const [regName, setRegName] = useState('');
  const [regPlanId, setRegPlanId] = useState('');
  const [regStartDate, setRegStartDate] = useState('');
  const [regExpiryDate, setRegExpiryDate] = useState('');
  const [regPrice, setRegPrice] = useState('');
  const [regPaymentMethod, setRegPaymentMethod] = useState('UPI');
  const [regPaymentRef, setRegPaymentRef] = useState('');
  const [regNotes, setRegNotes] = useState('');
  const [regSubmitting, setRegSubmitting] = useState(false);

  // Action Form State
  const [actionReason, setActionReason] = useState('');
  const [renewMonths, setRenewMonths] = useState('12');
  const [renewPaymentMethod, setRenewPaymentMethod] = useState('UPI');
  const [actionSubmitting, setActionSubmitting] = useState(false);

  // New Plan Form State
  const [planName, setPlanName] = useState('');
  const [planPrice, setPlanPrice] = useState('');
  const [planValidityMonths, setPlanValidityMonths] = useState('12');
  const [planDiscountPercent, setPlanDiscountPercent] = useState('15');
  const [planDesc, setPlanDesc] = useState('');
  const [planPerks, setPlanPerks] = useState('');
  const [planSubmitting, setPlanSubmitting] = useState(false);

  // Load initial data
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [plansData, membersData] = await Promise.all([
        api.getMembershipPlans(),
        api.getMemberships({ 
          search: search.trim() || undefined,
          status_filter: statusFilter !== 'ALL' ? statusFilter : undefined,
          plan_id: planFilter !== 'ALL' ? planFilter : undefined
        })
      ]);
      setPlans(plansData || []);
      setMembers(membersData || []);
    } catch (err: any) {
      console.error('Failed to load memberships data:', err);
      setError(err?.message || 'Failed to load membership data from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [statusFilter, planFilter]);

  // Handle Search submit / debounce
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  // Auto calculate default dates when plan selected during registration
  const handlePlanSelect = (planId: string) => {
    setRegPlanId(planId);
    const p = plans.find(x => x.id === planId);
    if (p) {
      setRegPrice(String(p.price));
      const today = new Date();
      setRegStartDate(today.toISOString().split('T')[0]);
      const expiry = new Date();
      expiry.setDate(expiry.getDate() + Math.round(p.validity_months * 30.5));
      setRegExpiryDate(expiry.toISOString().split('T')[0]);
    }
  };

  // Submit Member Registration
  const handleRegisterMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPhone || !regPlanId) return;

    try {
      setRegSubmitting(true);
      setError(null);
      await api.registerMembership({
        customer_phone: regPhone.trim(),
        customer_name: regName.trim() || undefined,
        plan_id: regPlanId,
        start_date: regStartDate ? new Date(regStartDate).toISOString() : undefined,
        expiry_date: regExpiryDate ? new Date(regExpiryDate).toISOString() : undefined,
        purchase_price: regPrice ? parseFloat(regPrice) : undefined,
        payment_method: regPaymentMethod,
        payment_reference: regPaymentRef.trim() || undefined,
        notes: regNotes.trim() || undefined
      });

      setSuccessMsg('Membership registered and activated successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsRegisterOpen(false);
      resetRegForm();
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to register membership.');
    } finally {
      setRegSubmitting(false);
    }
  };

  const resetRegForm = () => {
    setRegPhone('');
    setRegName('');
    setRegPlanId('');
    setRegStartDate('');
    setRegExpiryDate('');
    setRegPrice('');
    setRegPaymentRef('');
    setRegNotes('');
  };

  // Submit Action (Pause, Resume, Renew, Cancel)
  const handleExecuteAction = async () => {
    if (!actionModal.member || !actionModal.type) return;
    const m = actionModal.member;

    try {
      setActionSubmitting(true);
      setError(null);

      if (actionModal.type === 'pause') {
        await api.pauseMembership(m.id, actionReason || 'Customer requested temporary pause');
        setSuccessMsg(`Membership ${m.membership_number} paused.`);
      } else if (actionModal.type === 'resume') {
        await api.resumeMembership(m.id, actionReason || 'Customer resumed');
        setSuccessMsg(`Membership ${m.membership_number} resumed. Expiry date extended.`);
      } else if (actionModal.type === 'renew') {
        await api.renewMembership(m.id, {
          extension_months: parseInt(renewMonths) || 12,
          payment_method: renewPaymentMethod,
          notes: actionReason || 'Membership renewed'
        });
        setSuccessMsg(`Membership ${m.membership_number} renewed for ${renewMonths} months.`);
      } else if (actionModal.type === 'cancel') {
        await api.cancelMembership(m.id, actionReason || 'Cancelled by admin');
        setSuccessMsg(`Membership ${m.membership_number} cancelled.`);
      }

      setTimeout(() => setSuccessMsg(null), 4000);
      setActionModal({ type: null, member: null });
      setActionReason('');
      fetchData();
    } catch (err: any) {
      setError(err?.message || `Failed to ${actionModal.type} membership.`);
    } finally {
      setActionSubmitting(false);
    }
  };

  // Create Plan
  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planName || !planPrice) return;

    try {
      setPlanSubmitting(true);
      setError(null);
      const perksArr = planPerks.split('\n').map(p => p.trim()).filter(Boolean);
      await api.createMembershipPlan({
        name: planName.trim(),
        price: parseFloat(planPrice) || 0,
        validity_months: parseInt(planValidityMonths) || 12,
        discount_percent: parseFloat(planDiscountPercent) || 10,
        description: planDesc.trim() || undefined,
        perks: perksArr.length > 0 ? perksArr : ['Exclusive discounts on all salon services']
      });

      setSuccessMsg('New membership plan created successfully!');
      setTimeout(() => setSuccessMsg(null), 4000);
      setIsPlanModalOpen(false);
      setPlanName('');
      setPlanPrice('');
      setPlanDesc('');
      setPlanPerks('');
      fetchData();
    } catch (err: any) {
      setError(err?.message || 'Failed to create plan.');
    } finally {
      setPlanSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Active</span>;
      case 'PAUSED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Pause className="w-3.5 h-3.5 text-amber-600" /> Paused</span>;
      case 'EXPIRED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="w-3.5 h-3.5 text-rose-600" /> Expired</span>;
      case 'CANCELLED':
        return <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">Cancelled</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-700">{status}</span>;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-50/50">
      <Topbar title="Membership & VIP Club" />

      <main className="flex-1 p-6 max-w-7xl w-full mx-auto space-y-6">
        {/* Banner Alert Messages */}
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center justify-between text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-500 hover:text-red-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-between text-sm animate-in fade-in">
            <div className="flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
            <button onClick={() => setSuccessMsg(null)} className="text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Top Header & Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-xs">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">Trimz VIP Memberships</h1>
                <p className="text-xs text-slate-500">Manage member privileges, server-side benefits engine, and plan configurations</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-all shadow-sm hover:shadow-md cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Register Member
            </button>
            <button
              onClick={() => setIsPlanModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm transition-all shadow-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              Add Plan
            </button>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Members Directory ({members.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
              activeTab === 'plans'
                ? 'bg-red-600 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Award className="w-4 h-4" />
            Plans & Benefits ({plans.length})
          </button>
        </div>

        {/* TAB 1: MEMBERS DIRECTORY */}
        {activeTab === 'members' && (
          <div className="space-y-4">
            {/* Search and Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
              <form onSubmit={handleSearch} className="relative flex-1 w-full">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by customer name, phone number, or TZ-M number..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20 focus:border-red-500 transition-all"
                />
              </form>

              <div className="flex items-center gap-2 w-full md:w-auto">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-slate-700"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="PAUSED">Paused Only</option>
                  <option value="EXPIRED">Expired</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>

                <select
                  value={planFilter}
                  onChange={(e) => setPlanFilter(e.target.value)}
                  className="px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20 text-slate-700"
                >
                  <option value="ALL">All Plans</option>
                  {plans.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={fetchData}
                  className="p-2 border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">Member / Number</th>
                      <th className="py-3.5 px-4">Plan & Discount</th>
                      <th className="py-3.5 px-4">Validity Range</th>
                      <th className="py-3.5 px-4">Status</th>
                      <th className="py-3.5 px-4">Purchase Price</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {loading ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-red-500" />
                          Loading membership records...
                        </td>
                      </tr>
                    ) : members.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-12 text-slate-400">
                          <Users className="w-8 h-8 mx-auto mb-2 opacity-40" />
                          No member records found matching the filters.
                        </td>
                      </tr>
                    ) : (
                      members.map((m) => (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{m.customer_name || 'Member'}</div>
                            <div className="text-xs text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-mono text-red-600 bg-red-50 px-1.5 py-0.2 rounded font-medium">{m.membership_number}</span>
                              <span>•</span>
                              <span>{m.customer_phone}</span>
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-medium text-slate-900">{m.plan_name || 'Membership'}</div>
                            <div className="text-xs text-emerald-600 font-semibold mt-0.5">
                              {m.plan_snapshot?.discount_percent ? `${m.plan_snapshot.discount_percent}% VIP Discount` : 'VIP Benefits'}
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="text-xs font-medium text-slate-700">
                              {new Date(m.start_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                              {' → '}
                              {new Date(m.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-0.5">
                              {m.original_duration_months} months duration
                            </div>
                          </td>
                          <td className="py-3.5 px-4">
                            {getStatusBadge(m.status)}
                          </td>
                          <td className="py-3.5 px-4">
                            <div className="font-semibold text-slate-900">{formatCurrency(m.purchase_price)}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5">{m.payment_method}</div>
                          </td>
                          <td className="py-3.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => {
                                  setSelectedMember(m);
                                  setIsDetailOpen(true);
                                }}
                                className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-600 hover:text-slate-900 transition-colors"
                                title="View Details & Usage"
                              >
                                <Eye className="w-4 h-4" />
                              </button>

                              {m.status === 'ACTIVE' && (
                                <button
                                  onClick={() => setActionModal({ type: 'pause', member: m })}
                                  className="p-1.5 hover:bg-amber-50 rounded-lg text-amber-600 hover:text-amber-700 transition-colors"
                                  title="Pause Membership"
                                >
                                  <Pause className="w-4 h-4" />
                                </button>
                              )}

                              {m.status === 'PAUSED' && (
                                <button
                                  onClick={() => setActionModal({ type: 'resume', member: m })}
                                  className="p-1.5 hover:bg-emerald-50 rounded-lg text-emerald-600 hover:text-emerald-700 transition-colors"
                                  title="Resume Membership"
                                >
                                  <Play className="w-4 h-4" />
                                </button>
                              )}

                              <button
                                onClick={() => setActionModal({ type: 'renew', member: m })}
                                className="p-1.5 hover:bg-blue-50 rounded-lg text-blue-600 hover:text-blue-700 transition-colors"
                                title="Renew Membership"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>

                              {m.status !== 'CANCELLED' && (
                                <button
                                  onClick={() => setActionModal({ type: 'cancel', member: m })}
                                  className="p-1.5 hover:bg-rose-50 rounded-lg text-rose-500 hover:text-rose-700 transition-colors"
                                  title="Cancel/Deactivate"
                                >
                                  <XCircle className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: PLANS & BENEFITS */}
        {activeTab === 'plans' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((p, idx) => (
              <div 
                key={p.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between hover:border-slate-300 transition-all shadow-xs relative overflow-hidden group"
              >
                {idx === 1 && (
                  <div className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-bl-xl">
                    Most Popular
                  </div>
                )}
                <div>
                  <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center font-bold mb-4">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900">{p.name}</h3>
                  <p className="text-xs text-slate-500 mt-1 line-clamp-2">{p.description || 'VIP membership tier with salon perks'}</p>

                  <div className="mt-4 pb-4 border-b border-slate-100">
                    <span className="text-3xl font-extrabold text-slate-900">{formatCurrency(p.price)}</span>
                    <span className="text-xs text-slate-400 ml-1">/ {p.validity_months} months</span>
                  </div>

                  <div className="mt-4 space-y-2">
                    <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider">Configured Perks:</div>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                        <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{p.discount_percent}% off all salon menu items</span>
                      </li>
                      {(p.perks_json || []).map((perk, i) => (
                        <li key={i} className="flex items-center gap-2 text-xs text-slate-600">
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{perk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>Status: <span className="font-semibold text-emerald-600">Active</span></span>
                  <span>Order: #{p.display_order}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* MODAL 1: REGISTER MEMBER */}
        {isRegisterOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 overflow-y-auto">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95">
              <button 
                onClick={() => setIsRegisterOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <UserCheck className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Register New Member</h3>
              </div>

              <form onSubmit={handleRegisterMember} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Phone Number *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. 9876543210"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Customer Name</label>
                    <input
                      type="text"
                      placeholder="Guest Name"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Select Membership Plan *</label>
                  <select
                    required
                    value={regPlanId}
                    onChange={(e) => handlePlanSelect(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  >
                    <option value="">-- Choose Plan --</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} — {formatCurrency(p.price)} ({p.validity_months} months, {p.discount_percent}% off)
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date (Admin Override)</label>
                    <input
                      type="date"
                      value={regStartDate}
                      onChange={(e) => setRegStartDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Expiry Date (Admin Override)</label>
                    <input
                      type="date"
                      value={regExpiryDate}
                      onChange={(e) => setRegExpiryDate(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Purchase Price (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={regPrice}
                      onChange={(e) => setRegPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={regPaymentMethod}
                      onChange={(e) => setRegPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                    >
                      <option value="UPI">UPI / QR Code</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Debit / Credit Card</option>
                      <option value="COMPLIMENTARY">Complimentary / VIP Gift</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Transaction Ref / Notes</label>
                  <input
                    type="text"
                    placeholder="e.g. UPI Ref / special notes"
                    value={regPaymentRef}
                    onChange={(e) => setRegPaymentRef(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRegisterOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={regSubmitting}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50"
                  >
                    {regSubmitting ? 'Registering...' : 'Register & Activate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 2: ACTION MODAL (PAUSE, RESUME, RENEW, CANCEL) */}
        {actionModal.type && actionModal.member && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95">
              <button 
                onClick={() => setActionModal({ type: null, member: null })}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <h3 className="text-lg font-bold text-slate-900 capitalize mb-1">
                {actionModal.type === 'pause' && 'Pause Membership'}
                {actionModal.type === 'resume' && 'Resume Membership'}
                {actionModal.type === 'renew' && 'Renew Membership'}
                {actionModal.type === 'cancel' && 'Deactivate / Cancel Membership'}
              </h3>
              <p className="text-xs text-slate-500 mb-4">
                Member: <span className="font-semibold text-slate-800">{actionModal.member.customer_name}</span> ({actionModal.member.membership_number})
              </p>

              {actionModal.type === 'pause' && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 mb-4">
                  Pausing suspends VIP privileges immediately. When resumed, the expiry date will be automatically extended by the paused duration.
                </div>
              )}

              {actionModal.type === 'resume' && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 mb-4">
                  Resuming will calculate the total paused days and automatically extend the member's expiry date.
                </div>
              )}

              {actionModal.type === 'renew' && (
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Extension Duration (Months)</label>
                    <input
                      type="number"
                      value={renewMonths}
                      onChange={(e) => setRenewMonths(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Method</label>
                    <select
                      value={renewPaymentMethod}
                      onChange={(e) => setRenewPaymentMethod(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    >
                      <option value="UPI">UPI</option>
                      <option value="CASH">Cash</option>
                      <option value="CARD">Card</option>
                    </select>
                  </div>
                </div>
              )}

              {actionModal.type === 'cancel' && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 mb-4">
                  Cancelling revokes all privileges. Historical billing, sales, and invoices will be safely preserved.
                </div>
              )}

              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {actionModal.type === 'cancel' ? 'Cancellation Reason *' : 'Reason / Note'}
                </label>
                <input
                  type="text"
                  placeholder="Enter reason..."
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                />
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setActionModal({ type: null, member: null })}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleExecuteAction}
                  disabled={actionSubmitting || (actionModal.type === 'cancel' && !actionReason.trim())}
                  className={`px-4 py-2 rounded-xl text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 ${
                    actionModal.type === 'cancel' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-red-600 hover:bg-red-700'
                  }`}
                >
                  {actionSubmitting ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* MODAL 3: ADD PLAN */}
        {isPlanModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6 shadow-xl relative animate-in fade-in zoom-in-95">
              <button 
                onClick={() => setIsPlanModalOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
                  <Sparkles className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Add Membership Plan</h3>
              </div>

              <form onSubmit={handleCreatePlan} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Plan Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Trimz Diamond Elite"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500/20"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Price (₹) *</label>
                    <input
                      type="number"
                      required
                      placeholder="4999"
                      value={planPrice}
                      onChange={(e) => setPlanPrice(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Months *</label>
                    <input
                      type="number"
                      required
                      value={planValidityMonths}
                      onChange={(e) => setPlanValidityMonths(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Discount % *</label>
                    <input
                      type="number"
                      required
                      value={planDiscountPercent}
                      onChange={(e) => setPlanDiscountPercent(e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
                  <textarea
                    rows={2}
                    placeholder="Brief description of the tier..."
                    value={planDesc}
                    onChange={(e) => setPlanDesc(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Perks (One per line)</label>
                  <textarea
                    rows={3}
                    placeholder="Priority weekend slots&#10;Complimentary beverage&#10;Stylist preference"
                    value={planPerks}
                    onChange={(e) => setPlanPerks(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-slate-50 border border-slate-200 rounded-xl focus:outline-none"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPlanModalOpen(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-sm font-medium"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={planSubmitting}
                    className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50"
                  >
                    {planSubmitting ? 'Creating...' : 'Create Plan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* MODAL 4: MEMBER DETAIL & USAGE DRAWER */}
        {isDetailOpen && selectedMember && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
            <div className="bg-white rounded-2xl border border-slate-200 max-w-xl w-full p-6 shadow-xl relative max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95">
              <button 
                onClick={() => setIsDetailOpen(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
                <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center font-bold">
                  <Award className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedMember.customer_name}</h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="font-mono text-xs font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded">
                      {selectedMember.membership_number}
                    </span>
                    {getStatusBadge(selectedMember.status)}
                  </div>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Plan Name</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">{selectedMember.plan_name}</div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">VIP Discount</div>
                  <div className="text-sm font-semibold text-emerald-600 mt-0.5">
                    {selectedMember.plan_snapshot?.discount_percent || 0}% Off
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Validity Range</div>
                  <div className="text-xs font-medium text-slate-700 mt-0.5">
                    {new Date(selectedMember.start_date).toLocaleDateString()} → {new Date(selectedMember.expiry_date).toLocaleDateString()}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 rounded-xl">
                  <div className="text-[11px] font-semibold text-slate-400 uppercase">Purchase Price & Mode</div>
                  <div className="text-sm font-semibold text-slate-800 mt-0.5">
                    {formatCurrency(selectedMember.purchase_price)} ({selectedMember.payment_method})
                  </div>
                </div>
              </div>

              {/* Pause History */}
              {selectedMember.pause_logs && selectedMember.pause_logs.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    Pause & Extension History
                  </h4>
                  <div className="space-y-2">
                    {selectedMember.pause_logs.map((p) => (
                      <div key={p.id} className="p-2.5 bg-amber-50/50 border border-amber-100 rounded-xl text-xs text-slate-700 flex justify-between items-center">
                        <div>
                          <div>Paused on: {new Date(p.paused_at).toLocaleDateString()}</div>
                          <div className="text-[11px] text-slate-500">Reason: {p.paused_reason || 'N/A'}</div>
                        </div>
                        <div className="text-right">
                          {p.resumed_at ? (
                            <span className="text-emerald-700 font-semibold">Resumed (+{p.duration_days_extended || 0} days)</span>
                          ) : (
                            <span className="text-amber-700 font-semibold">Currently Paused</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Benefit Usage Ledger */}
              <div>
                <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-blue-500" />
                  Benefit Usage Ledger ({selectedMember.usage_entries?.length || 0})
                </h4>
                {selectedMember.usage_entries && selectedMember.usage_entries.length > 0 ? (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {selectedMember.usage_entries.map((u) => (
                      <div key={u.id} className="p-2.5 bg-slate-50 rounded-xl text-xs flex justify-between items-center">
                        <div>
                          <div className="font-semibold text-slate-800">{u.benefit_name}</div>
                          <div className="text-[11px] text-slate-400">{new Date(u.created_at).toLocaleString()}</div>
                        </div>
                        <div className="text-right font-semibold text-emerald-600">
                          -₹{toSafeNumber(u.discount_applied, 0).toFixed(2)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-xs text-slate-400 text-center">
                    No benefit usages recorded yet. Benefits will appear here as POS sales occur.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
