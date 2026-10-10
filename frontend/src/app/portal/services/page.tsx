'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Service, ServiceCategory } from '@/lib/types';
import { 
  Scissors, 
  Plus, 
  Search, 
  Edit3, 
  X, 
  Loader2, 
  Clock, 
  Tag, 
  PauseCircle, 
  PlayCircle, 
  Trash2, 
  CheckCircle2, 
  AlertCircle 
} from 'lucide-react';

export default function ServicesPage() {
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCat, setSelectedCat] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'paused'>('all');

  // Async action loading states & feedback
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [serviceToDelete, setServiceToDelete] = useState<Service | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        api.getServices(undefined, undefined, false),
      ]);
      setCategories(cats);
      setServices(svcs);
      if (cats.length > 0 && !svcCatId) {
        setSvcCatId(cats[0].id);
      }
    } catch (err: any) {
      console.error('Error loading service catalog:', err);
      setFeedbackMessage({ type: 'error', text: `Failed to load catalog: ${err.message || 'Error'}` });
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
      setFeedbackMessage({ type: 'success', text: `Service "${svcName}" created successfully.` });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to create service: ${err.message}` });
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
      setFeedbackMessage({ type: 'success', text: `Rate for "${editingService.name}" updated to ₹${editPrice}.` });
      setEditingService(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to update price: ${err.message}` });
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
      setFeedbackMessage({ type: 'success', text: `Category "${newCatName}" created.` });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to create category: ${err.message}` });
    } finally {
      setSavingCat(false);
    }
  };

  const handlePauseService = async (svc: Service) => {
    setActionLoadingId(svc.id);
    setFeedbackMessage(null);
    try {
      await api.pauseService(svc.id);
      setFeedbackMessage({ type: 'success', text: `"${svc.name}" is now Paused and hidden from POS / Billing.` });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to pause service: ${err.message || 'Error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleResumeService = async (svc: Service) => {
    setActionLoadingId(svc.id);
    setFeedbackMessage(null);
    try {
      await api.resumeService(svc.id);
      setFeedbackMessage({ type: 'success', text: `"${svc.name}" is now Active and available for Billing.` });
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to resume service: ${err.message || 'Error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRemoveService = async (svc: Service) => {
    setActionLoadingId(svc.id);
    setFeedbackMessage(null);
    try {
      await api.removeService(svc.id);
      setFeedbackMessage({ type: 'success', text: `"${svc.name}" removed from catalogue. Historical bills remain intact.` });
      setServiceToDelete(null);
      await loadData();
    } catch (err: any) {
      setFeedbackMessage({ type: 'error', text: `Failed to remove service: ${err.message || 'Error'}` });
    } finally {
      setActionLoadingId(null);
    }
  };

  const [selectedDepartment, setSelectedDepartment] = useState<'all' | 'Women' | 'Men'>('all');

  const filteredCategories = categories.filter((c) => {
    if (selectedDepartment === 'all') return true;
    return c.department === selectedDepartment || c.department === 'Unisex' || !c.department;
  });

  const activeServicesCount = services.filter((s) => !s.is_deleted && s.is_active).length;
  const pausedServicesCount = services.filter((s) => !s.is_deleted && !s.is_active).length;
  const totalServicesCount = services.filter((s) => !s.is_deleted).length;

  const filteredServices = services.filter((s) => {
    if (s.is_deleted) return false;

    // Status filtering
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'paused' && s.is_active) return false;

    if (selectedDepartment === 'Women') {
      if (s.audience === 'Male') return false;
      const cat = categories.find((c) => c.id === s.category_id);
      if (cat && cat.department && cat.department === 'Men') return false;
    } else if (selectedDepartment === 'Men') {
      if (s.audience === 'Female') return false;
      const cat = categories.find((c) => c.id === s.category_id);
      if (cat && cat.department && cat.department === 'Women') return false;
    }

    if (selectedCat !== 'all' && s.category_id !== selectedCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        s.name.toLowerCase().includes(q) ||
        (s.variant_name && s.variant_name.toLowerCase().includes(q)) ||
        (s.combo_items && s.combo_items.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Service Catalog & Rates" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-xs font-medium transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-gray-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Actions Bar & Department Selector */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-dark-surface p-4 rounded-2xl border border-dark-border">
          {/* Department segmented switch */}
          <div className="flex items-center gap-1.5 p-1 bg-dark-bg rounded-xl border border-dark-border shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('Women');
                setSelectedCat('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDepartment === 'Women'
                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Women&apos;s Lounge
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('Men');
                setSelectedCat('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                selectedDepartment === 'Men'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Gentlemen&apos;s Lounge
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedCat('all');
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDepartment === 'all'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services, variants, combos..."
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

        {/* Category & Status Filter Pills */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none flex-1">
            <button
              onClick={() => setSelectedCat('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCat === 'all'
                  ? 'bg-brand-500 text-dark-bg shadow-sm'
                  : 'bg-dark-surface text-gray-400 border border-dark-border hover:text-white'
              }`}
            >
              All Categories ({filteredServices.length})
            </button>
            {filteredCategories.map((c) => (
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

          {/* Status Filter Segment */}
          <div className="flex items-center gap-1 p-1 bg-dark-surface rounded-xl border border-dark-border shrink-0 self-start sm:self-auto">
            <span className="text-[11px] text-gray-500 font-medium px-2 hidden md:inline">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-dark-card text-brand-300 border border-dark-border shadow-sm'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({totalServicesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-emerald-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              Active ({activeServicesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'paused'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-amber-300'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Paused ({pausedServicesCount})
            </button>
          </div>
        </div>

        {/* Services Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Scissors className="w-4 h-4 text-brand-400" />
              <span>Catalog Services ({filteredServices.length})</span>
            </h3>
            {statusFilter !== 'all' && (
              <span className="text-xs text-gray-400 font-mono">
                Showing {statusFilter.toUpperCase()} services
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No services found matching the criteria.
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
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {filteredServices.map((svc) => (
                    <tr 
                      key={svc.id} 
                      className={`hover:bg-dark-card/50 transition-colors ${
                        !svc.is_active ? 'bg-amber-950/10 opacity-90' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-100 flex items-center gap-2">
                          <span>{svc.name}</span>
                          {!svc.is_active && (
                            <span className="text-[10px] font-normal text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                              Paused
                            </span>
                          )}
                        </div>
                        {svc.variant_name && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-brand-500/10 border border-brand-500/30 text-brand-300 text-[10px] font-semibold">
                            {svc.variant_name}
                          </span>
                        )}
                        {svc.combo_items && (
                          <div className="text-[10px] text-gray-400 mt-1">
                            <span className="text-brand-400 font-semibold">Includes: </span>
                            {svc.combo_items}
                          </div>
                        )}
                      </td>
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
                      <td className="p-4">
                        {svc.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            Paused
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-brand-300 text-sm">
                        {formatCurrency(svc.price)}
                        {svc.is_variable_price && (
                          <span className="block text-[10px] text-amber-400 font-normal">onwards</span>
                        )}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Edit Rate Button */}
                          <button
                            type="button"
                            onClick={() => {
                              setEditingService(svc);
                              setEditPrice(svc.price.toString());
                            }}
                            className="px-2.5 py-1 rounded-lg bg-dark-card border border-dark-border hover:border-brand-500 text-gray-300 hover:text-brand-300 text-xs font-semibold inline-flex items-center gap-1 transition-all"
                            title="Edit Service Rate"
                          >
                            <Edit3 className="w-3 h-3" />
                            <span>Edit Rate</span>
                          </button>

                          {/* Pause / Resume Button */}
                          {svc.is_active ? (
                            <button
                              type="button"
                              onClick={() => handlePauseService(svc)}
                              disabled={actionLoadingId === svc.id}
                              className="px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/30 hover:border-amber-400 text-amber-300 text-xs font-semibold inline-flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Pause service (hides from billing/POS)"
                            >
                              {actionLoadingId === svc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PauseCircle className="w-3 h-3" />
                              )}
                              <span>Pause</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleResumeService(svc)}
                              disabled={actionLoadingId === svc.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 hover:border-emerald-400 text-emerald-300 text-xs font-semibold inline-flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Resume service (makes available in billing/POS)"
                            >
                              {actionLoadingId === svc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PlayCircle className="w-3 h-3" />
                              )}
                              <span>Resume</span>
                            </button>
                          )}

                          {/* Remove Service Button */}
                          <button
                            type="button"
                            onClick={() => setServiceToDelete(svc)}
                            disabled={actionLoadingId === svc.id}
                            className="p-1 rounded-lg bg-dark-card border border-dark-border hover:border-rose-500/50 text-gray-400 hover:text-rose-400 transition-all disabled:opacity-50"
                            title="Remove service from catalogue"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Remove Service Confirmation Modal */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-400" />
                <span>Remove Service</span>
              </h3>
              <button
                onClick={() => setServiceToDelete(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-xs text-gray-300 leading-relaxed">
              Are you sure you want to remove <span className="font-bold text-white">&quot;{serviceToDelete.name}&quot;</span>
              {serviceToDelete.variant_name ? ` (${serviceToDelete.variant_name})` : ''}?
            </p>

            <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border text-[11px] text-gray-400 leading-relaxed">
              <span className="font-semibold text-gray-300 block mb-1">Non-Destructive Archiving:</span>
              This service will be deactivated and removed from the active salon menu. All past sales records, invoices, customer histories, and closing reports referencing this service will remain 100% intact.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-dark-border">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                disabled={actionLoadingId === serviceToDelete.id}
                className="px-4 py-2 rounded-xl bg-dark-card border border-dark-border hover:border-gray-600 text-gray-300 text-xs font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveService(serviceToDelete)}
                disabled={actionLoadingId === serviceToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all disabled:opacity-50"
              >
                {actionLoadingId === serviceToDelete.id ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Removing...</span>
                  </>
                ) : (
                  <span>Confirm Remove</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

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
