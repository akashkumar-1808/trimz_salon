'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Layers, Plus, Search, Scissors, Check, Sparkles, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface ServicePackage {
  id: string;
  name: string;
  targetGender: 'Men' | 'Women' | 'Unisex';
  bundlePrice: number;
  originalPrice: number;
  includedServices: string[];
  durationMinutes: number;
}

const INITIAL_PACKAGES: ServicePackage[] = [
  {
    id: 'pkg-1',
    name: 'Essential Grooming Combo',
    targetGender: 'Men',
    bundlePrice: 449,
    originalPrice: 567,
    includedServices: ['Hair Cut', 'Beard Trim / Shaving', 'D-Tan Face Cleanup'],
    durationMinutes: 45,
  },
  {
    id: 'pkg-2',
    name: 'Executive Head Massage Combo',
    targetGender: 'Men',
    bundlePrice: 549,
    originalPrice: 698,
    includedServices: ['Hair Cut', 'Beard Styling', 'Head Massage (20 min)'],
    durationMinutes: 50,
  },
  {
    id: 'pkg-3',
    name: 'Glow & Rejuvenate Facial Combo',
    targetGender: 'Men',
    bundlePrice: 649,
    originalPrice: 847,
    includedServices: ['Hair Cut', 'Beard Trim / Shave', 'Fruit / Gold Facial (40 min)'],
    durationMinutes: 65,
  },
  {
    id: 'pkg-4',
    name: 'Bridal Glow Radiance Package',
    targetGender: 'Women',
    bundlePrice: 3499,
    originalPrice: 4800,
    includedServices: ['O3+ Bridal Facial', 'Full Arms & Legs Waxing', 'Spa Pedicure & Manicure', 'Hair Spa'],
    durationMinutes: 150,
  },
  {
    id: 'pkg-5',
    name: 'Silk Touch Keratin Package',
    targetGender: 'Women',
    bundlePrice: 4999,
    originalPrice: 6500,
    includedServices: ['Keratin Treatment', 'Hair Botox Infusion', 'Precision Layer Cut', 'Post-Care Serum'],
    durationMinutes: 180,
  },
];

export default function PackagesPage() {
  const [packages, setPackages] = useState<ServicePackage[]>(INITIAL_PACKAGES);
  const [genderFilter, setGenderFilter] = useState<'all' | 'Men' | 'Women'>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Package Form
  const [name, setName] = useState('');
  const [targetGender, setTargetGender] = useState<ServicePackage['targetGender']>('Men');
  const [bundlePrice, setBundlePrice] = useState('');
  const [originalPrice, setOriginalPrice] = useState('');
  const [servicesInput, setServicesInput] = useState('');
  const [durationMinutes, setDurationMinutes] = useState('60');

  const handleCreatePackage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !bundlePrice) return;

    const newPkg: ServicePackage = {
      id: `pkg-${Date.now()}`,
      name,
      targetGender,
      bundlePrice: parseFloat(bundlePrice) || 0,
      originalPrice: parseFloat(originalPrice) || parseFloat(bundlePrice),
      includedServices: servicesInput.split(',').map((s) => s.trim()).filter(Boolean),
      durationMinutes: parseInt(durationMinutes) || 60,
    };

    setPackages([...packages, newPkg]);
    setIsModalOpen(false);
    setName('');
    setBundlePrice('');
    setOriginalPrice('');
    setServicesInput('');
  };

  const filteredPackages = packages.filter((p) => {
    if (genderFilter !== 'all' && p.targetGender !== genderFilter && p.targetGender !== 'Unisex') return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.includedServices.some((s) => s.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Packages & Bundles" />

      <main className="p-6 md:p-8 space-y-8 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ COMBO OFFERS</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Packages & Bundles</h1>
            <p className="text-sm text-text-secondary mt-1">
              Curate multi-service combo packages, grooming bundles, and seasonal bridal packages.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Package</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search packages by name or included services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-workspace-bg rounded-xl border border-workspace-border shrink-0">
            <button
              onClick={() => setGenderFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'all'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All Combos
            </button>
            <button
              onClick={() => setGenderFilter('Men')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'Men'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Men
            </button>
            <button
              onClick={() => setGenderFilter('Women')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                genderFilter === 'Women'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Women
            </button>
          </div>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => {
            const savings = pkg.originalPrice > pkg.bundlePrice ? pkg.originalPrice - pkg.bundlePrice : 0;
            return (
              <div
                key={pkg.id}
                className="p-6 rounded-2xl bg-white border border-workspace-border shadow-sm flex flex-col justify-between hover:border-text-primary transition-all"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-xs font-semibold text-text-primary">
                      {pkg.targetGender} • {pkg.durationMinutes} mins
                    </span>
                    {savings > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-semibold">
                        Save {formatCurrency(savings)}
                      </span>
                    )}
                  </div>

                  <h3 className="font-bold text-base text-text-primary mt-3">{pkg.name}</h3>

                  <div className="mt-3 flex items-baseline gap-2">
                    <span className="font-mono text-2xl font-bold text-primary">{formatCurrency(pkg.bundlePrice)}</span>
                    {pkg.originalPrice > pkg.bundlePrice && (
                      <span className="font-mono text-xs text-text-muted line-through">
                        {formatCurrency(pkg.originalPrice)}
                      </span>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-workspace-border space-y-2 text-xs text-text-secondary">
                    <div className="font-semibold text-text-primary">Package Inclusions:</div>
                    {pkg.includedServices.map((svc, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span>{svc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-workspace-border flex items-center justify-between text-xs text-text-muted">
                  <span>Available for immediate billing</span>
                  <span className="font-semibold text-text-primary">Active</span>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Create Package Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Create Service Package</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreatePackage} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Package Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Total Festive Makeover"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Target Gender</label>
                  <select
                    value={targetGender}
                    onChange={(e: any) => setTargetGender(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                  >
                    <option value="Men">Men Only</option>
                    <option value="Women">Women Only</option>
                    <option value="Unisex">Unisex</option>
                  </select>
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Bundle Price (₹) *</label>
                  <input
                    type="number"
                    required
                    value={bundlePrice}
                    onChange={(e) => setBundlePrice(e.target.value)}
                    placeholder="999"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Original Price (₹)</label>
                  <input
                    type="number"
                    value={originalPrice}
                    onChange={(e) => setOriginalPrice(e.target.value)}
                    placeholder="1299"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Included Services (comma separated) *</label>
                <input
                  type="text"
                  required
                  value={servicesInput}
                  onChange={(e) => setServicesInput(e.target.value)}
                  placeholder="Hair Cut, Beard Trim, D-Tan Facial"
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
                  Create Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
