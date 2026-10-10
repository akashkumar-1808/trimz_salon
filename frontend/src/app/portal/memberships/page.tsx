'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Award, Plus, Search, Check, Users, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface MembershipTier {
  id: string;
  name: string;
  price: number;
  validityMonths: number;
  discountPercent: number;
  includedCredits: number;
  perks: string[];
}

const INITIAL_TIERS: MembershipTier[] = [
  {
    id: 'silver',
    name: 'Trimz Silver Club',
    price: 2999,
    validityMonths: 6,
    discountPercent: 10,
    includedCredits: 3000,
    perks: ['10% off all haircuts & grooming', 'Priority weekend booking', 'Complimentary hair wash per visit'],
  },
  {
    id: 'gold',
    name: 'Trimz Gold Executive',
    price: 5999,
    validityMonths: 12,
    discountPercent: 15,
    includedCredits: 6500,
    perks: ['15% off all services & retail', '1 free Head Massage session per month', 'Exclusive festive gift hamper'],
  },
  {
    id: 'platinum',
    name: 'Trimz Platinum VIP',
    price: 9999,
    validityMonths: 12,
    discountPercent: 20,
    includedCredits: 12000,
    perks: ['20% off all salon menu items', 'Dedicated Senior Stylist guarantee', 'Unlimited companion express haircuts'],
  },
];

interface MemberSubscriber {
  id: string;
  name: string;
  phone: string;
  tierName: string;
  validUntil: string;
  balanceCredits: number;
}

const SUBSCRIBERS: MemberSubscriber[] = [];

export default function MembershipsPage() {
  const [tiers, setTiers] = useState<MembershipTier[]>(INITIAL_TIERS);
  const [subscribers, setSubscribers] = useState<MemberSubscriber[]>(SUBSCRIBERS);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Tier Form
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [validityMonths, setValidityMonths] = useState('12');
  const [discountPercent, setDiscountPercent] = useState('15');
  const [perk1, setPerk1] = useState('');

  const handleCreateTier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) return;

    const newTier: MembershipTier = {
      id: `tier-${Date.now()}`,
      name,
      price: parseFloat(price) || 0,
      validityMonths: parseInt(validityMonths) || 12,
      discountPercent: parseFloat(discountPercent) || 10,
      includedCredits: parseFloat(price) || 0,
      perks: perk1 ? [perk1] : ['Special member discounts and privileges'],
    };

    setTiers([...tiers, newTier]);
    setIsModalOpen(false);
    setName('');
    setPrice('');
    setPerk1('');
  };

  const filteredSubs = subscribers.filter((s) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return s.name.toLowerCase().includes(q) || s.phone.includes(q) || s.tierName.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Memberships & Subscriptions" />

      <main className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ LOYALTY TIERS</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Memberships & Plans</h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage VIP membership plans, prepaid client balances, tier benefits, and validity.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Membership Plan</span>
          </button>
        </div>

        {/* Membership Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="p-6 rounded-2xl bg-white border border-workspace-border shadow-sm flex flex-col justify-between hover:border-text-primary transition-all"
            >
              <div>
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-xs font-semibold text-text-primary">
                    {tier.validityMonths} Months Validity
                  </span>
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <h3 className="font-bold text-lg text-text-primary mt-3">{tier.name}</h3>
                <div className="mt-2 font-mono">
                  <span className="text-2xl font-bold text-primary">{formatCurrency(tier.price)}</span>
                  <span className="text-xs text-text-muted ml-1">one-time fee</span>
                </div>

                <div className="mt-4 pt-4 border-t border-workspace-border space-y-2 text-xs text-text-secondary">
                  <div className="font-semibold text-text-primary">Key Privileges:</div>
                  {tier.perks.map((perk, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                      <span>{perk}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-workspace-border flex items-center justify-between text-xs font-medium text-text-muted">
                <span>Value Balance:</span>
                <span className="font-mono font-bold text-text-primary">{formatCurrency(tier.includedCredits)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Active Subscribers Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              <span>Active Club Members ({filteredSubs.length})</span>
            </h3>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search member name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-9 pr-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                  <th className="p-4">Member</th>
                  <th className="p-4">Active Plan</th>
                  <th className="p-4">Prepaid Balance</th>
                  <th className="p-4">Valid Until</th>
                  <th className="p-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-border">
                {filteredSubs.map((sub) => (
                  <tr key={sub.id} className="hover:bg-workspace-hover/50 transition-colors">
                    <td className="p-4">
                      <div className="font-semibold text-text-primary">{sub.name}</div>
                      <div className="text-text-muted font-mono text-[11px]">{sub.phone}</div>
                    </td>
                    <td className="p-4 text-xs font-semibold text-text-primary">{sub.tierName}</td>
                    <td className="p-4 font-mono font-bold text-emerald-600 text-sm">
                      {formatCurrency(sub.balanceCredits)}
                    </td>
                    <td className="p-4 text-xs text-text-secondary font-mono">{sub.validUntil}</td>
                    <td className="p-4 text-right">
                      <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Active VIP
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Create Plan Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Create Membership Tier</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateTier} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Plan Title *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Trimz Diamond Club"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Fee (₹) *</label>
                  <input
                    type="number"
                    required
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="4999"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Validity (Months)</label>
                  <input
                    type="number"
                    value={validityMonths}
                    onChange={(e) => setValidityMonths(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Primary Benefit / Description</label>
                <input
                  type="text"
                  value={perk1}
                  onChange={(e) => setPerk1(e.target.value)}
                  placeholder="e.g. 15% discount on all salon services"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm shadow-sm"
                >
                  Save Membership Tier
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
