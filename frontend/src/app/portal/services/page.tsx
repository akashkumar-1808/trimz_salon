'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Service, ServiceCategory } from '@/lib/types';
import { Scissors, Plus, Search, Edit3, X, Loader2, Clock, Tag } from 'lucide-react';

export default function ServicesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');

  // New Service Modal
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);
  const [svcName, setSvcName] = useState('');
  const [svcCatId, setSvcCatId] = useState('');
  const [svcPrice, setSvcPrice] = useState('');
  const [svcDuration, setSvcDuration] = useState('30');
  const [svcGender, setSvcGender] = useState('all');
  const [savingService, setSavingService] = useState(false);

  // Edit Service Price Modal
  const [editingService, setEditingService] = useState<Service | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  // New Category Modal
  const [isCatModalOpen, setIsCatModalOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [savingCat, setSavingCat] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [cats, svcs] = await Promise.all([
        api.getCategories(),
        api.getServices(),
      ]);
      setCategories(cats);
      setServices(svcs);
      if (cats.length > 0 && !svcCatId) {
        setSvcCatId(cats[0].id);
      }
    } catch (err) {
      console.error('Error loading service catalog:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!svcName || !svcPrice) return;
    setSavingService(true);
    try {
      await api.createService({
        name: svcName,
        category_id: svcCatId || undefined,
        price: parseFloat(svcPrice),
        duration_minutes: parseInt(svcDuration) || 30,
        target_gender: svcGender,
      });
      setIsServiceModalOpen(false);
      setSvcName('');
      setSvcPrice('');
      loadData();
    } catch (err: any) {
      alert(`Failed to create service: ${err.message}`);
    } finally {
      setSavingService(false);
    }
  };

  const handleUpdatePrice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingService || !editPrice) return;
    setSavingEdit(true);
    try {
      await api.updateService(editingService.id, {
        price: parseFloat(editPrice),
      });
      setEditingService(null);
      loadData();
    } catch (err: any) {
      alert(`Failed to update price: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    setSavingCat(true);
    try {
      await api.createCategory({
        name: newCatName,
        display_order: categories.length + 1,
      });
      setIsCatModalOpen(false);
      setNewCatName('');
      loadData();
    } catch (err: any) {
      alert(`Failed to create category: ${err.message}`);
    } finally {
      setSavingCat(false);
    }
  };

  const filteredServices = services.filter((s) => {
    if (selectedCat !== 'all' && s.category_id !== selectedCat) return false;
    if (search.trim()) {
      return s.name.toLowerCase().includes(search.toLowerCase());
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Service Catalog & Rates" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-surface p-4 rounded-2xl border border-dark-border">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="px-3.5 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-gray-600 text-gray-300 font-semibold text-xs transition-all flex items-center gap-1.5"
            >
              <Tag className="w-4 h-4 text-brand-400" />
              <span>+ Category</span>
            </button>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20 flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service</span>
            </button>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedCat === 'all'
                ? 'bg-brand-500 text-dark-bg shadow-sm'
                : 'bg-dark-surface text-gray-400 border border-dark-border hover:text-white'
            }`}
          >
            All Services ({services.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === c.id
                  ? 'bg-brand-500 text-dark-bg shadow-sm'
                  : 'bg-dark-surface text-gray-400 border border-dark-border hover:text-white'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Services Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-brand-400" />
              <span>Catalog Services ({filteredServices.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No services found in this category.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
                    <th className="p-4">Service</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Audience</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {filteredServices.map((svc) => (
                    <tr key={svc.id} className="hover:bg-dark-card/50 transition-colors">
                      <td className="p-4 font-bold text-gray-100">{svc.name}</td>
                      <td className="p-4 text-gray-400">{svc.category_name || '-'}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-dark-card border border-dark-border text-gray-300 text-[10px] uppercase font-mono">
                          {svc.target_gender}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-gray-500" />
                          <span>{svc.duration_minutes} mins</span>
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-brand-300 text-sm">
                        {formatCurrency(svc.price)}
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => {
                            setEditingService(svc);
                            setEditPrice(svc.price.toString());
                          }}
                          className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border hover:border-brand-500 text-gray-300 hover:text-brand-300 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Rate</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Edit Price Modal */}
      {editingService && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-white">Update Service Rate</h3>
              <button onClick={() => setEditingService(null)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-gray-400 mb-4">{editingService.name}</p>
            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">New Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono text-sm"
                />
              </div>
              <p className="text-[10px] text-gray-500">
                Note: Updating the price does not change historical invoices due to the price snapshot guarantee.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="flex-1 py-2 rounded-xl bg-dark-card text-gray-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs"
                >
                  {savingEdit ? 'Updating...' : 'Save New Rate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Service Modal */}
      {isServiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-white">Create New Service</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateService} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  placeholder="e.g. Keratin Therapy"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Category *</label>
                <select
                  value={svcCatId}
                  onChange={(e) => setSvcCatId(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-gray-400 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={svcPrice}
                    onChange={(e) => setSvcPrice(e.target.value)}
                    placeholder="500"
                    className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
                <div>
                  <label className="block text-gray-400 mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(e.target.value)}
                    className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
                  />
                </div>
              </div>
              <div>
                <label className="block text-gray-400 mb-1">Target Audience</label>
                <select
                  value={svcGender}
                  onChange={(e) => setSvcGender(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                >
                  <option value="all">Unisex / All</option>
                  <option value="men">Men Only</option>
                  <option value="women">Women Only</option>
                  <option value="kids">Kids</option>
                </select>
              </div>
              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsServiceModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-card text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold"
                >
                  {savingService ? 'Creating...' : 'Save Service'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Category Modal */}
      {isCatModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-white">Add Service Category</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Category Title *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Bridal & Make-up"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white text-xs"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-dark-card text-gray-300 font-semibold text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="flex-1 py-2 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs"
                >
                  {savingCat ? 'Saving...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
