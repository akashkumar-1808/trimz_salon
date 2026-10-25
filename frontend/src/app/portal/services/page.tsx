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
  const [selectedDepartment, setSelectedDepartment] = useState<'all' | 'Women' | 'Men'>('all');

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
      const sorted = (svcs || []).slice().sort((a: any, b: any) => (a.display_order ?? 9999) - (b.display_order ?? 9999));
      setServices(sorted);
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
  }).sort((a, b) => (a.display_order ?? 9999) - (b.display_order ?? 9999));

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Service Catalog & Rates" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker & Action Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ SALON CATALOGUE</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Services & Rates</h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage salon services, pricing, departments, pause status, and active menu categories.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsCatModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-sm transition-all shadow-sm flex items-center gap-1.5"
            >
              <Tag className="w-4 h-4 text-text-secondary" />
              <span>+ Category</span>
            </button>
            <button
              onClick={() => setIsServiceModalOpen(true)}
              className="px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Add Service</span>
            </button>
          </div>
        </div>

        {/* Feedback Alert Banner */}
        {feedbackMessage && (
          <div
            className={`p-4 rounded-xl border flex items-center justify-between gap-3 text-sm font-medium transition-all ${
              feedbackMessage.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-rose-50 border-rose-200 text-rose-800'
            }`}
          >
            <div className="flex items-center gap-2">
              {feedbackMessage.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              )}
              <span>{feedbackMessage.text}</span>
            </div>
            <button
              onClick={() => setFeedbackMessage(null)}
              className="text-text-muted hover:text-text-primary p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Filter Bar & Search */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Department segmented switch */}
          <div className="flex items-center gap-1.5 p-1 bg-workspace-bg rounded-xl border border-workspace-border shrink-0">
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('all');
                setSelectedCat('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDepartment === 'all'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('Men');
                setSelectedCat('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDepartment === 'Men'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Gentlemen&apos;s Lounge
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedDepartment('Women');
                setSelectedCat('all');
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                selectedDepartment === 'Women'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Women&apos;s Lounge
            </button>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search services, variants, combos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
            />
          </div>

          {/* Status Filter Segment */}
          <div className="flex items-center gap-1 p-1 bg-workspace-bg rounded-xl border border-workspace-border shrink-0">
            <span className="text-[11px] text-text-muted font-medium px-2 hidden sm:inline">Status:</span>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-white text-text-primary border border-workspace-border shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All ({totalServicesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'active'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm'
                  : 'text-text-secondary hover:text-emerald-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
              Active ({activeServicesCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('paused')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                statusFilter === 'paused'
                  ? 'bg-amber-50 text-amber-800 border border-amber-200 shadow-sm'
                  : 'text-text-secondary hover:text-amber-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
              Paused ({pausedServicesCount})
            </button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            onClick={() => setSelectedCat('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              selectedCat === 'all'
                ? 'bg-text-primary text-white shadow-sm'
                : 'bg-white text-text-primary border border-workspace-border hover:bg-workspace-hover'
            }`}
          >
            All Categories ({filteredServices.length})
          </button>
          {filteredCategories.map((c) => (
            <button
              key={c.id}
              onClick={() => setSelectedCat(c.id)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                selectedCat === c.id
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'bg-white text-text-primary border border-workspace-border hover:bg-workspace-hover'
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        {/* Services Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Scissors className="w-4 h-4 text-primary" />
              <span>Catalog Services ({filteredServices.length})</span>
            </h3>
            {statusFilter !== 'all' && (
              <span className="text-xs text-text-secondary font-mono">
                Showing {statusFilter.toUpperCase()} services
              </span>
            )}
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading catalogue...</span>
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No services found matching the criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Service</th>
                    <th className="p-4">Category</th>
                    <th className="p-4">Audience</th>
                    <th className="p-4">Duration</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Price</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredServices.map((svc) => (
                    <tr 
                      key={svc.id} 
                      className={`hover:bg-workspace-hover/50 transition-colors ${
                        !svc.is_active ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      <td className="p-4">
                        <div className="font-semibold text-text-primary flex items-center gap-2">
                          <span>{svc.name}</span>
                          {!svc.is_active && (
                            <span className="text-[10px] font-medium text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                              Paused
                            </span>
                          )}
                        </div>
                        {svc.variant_name && (
                          <span className="inline-block mt-0.5 px-2 py-0.5 rounded bg-workspace-bg border border-workspace-border text-text-secondary text-[11px] font-medium">
                            {svc.variant_name}
                          </span>
                        )}
                        {svc.combo_items && (
                          <div className="text-[11px] text-text-muted mt-1">
                            <span className="text-text-secondary font-medium">Includes: </span>
                            {svc.combo_items}
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-text-secondary text-xs">{svc.category_name || '-'}</td>
                      <td className="p-4">
                        <span className="px-2 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-text-secondary text-[11px] uppercase font-mono">
                          {svc.target_gender}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary text-xs">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-text-muted" />
                          <span>{svc.duration_minutes} mins</span>
                        </span>
                      </td>
                      <td className="p-4">
                        {svc.is_active ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-emerald-50 border border-emerald-200 text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-amber-50 border border-amber-200 text-amber-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-600" />
                            Paused
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-primary text-sm">
                        {formatCurrency(svc.price)}
                        {svc.is_variable_price && (
                          <span className="block text-[10px] text-amber-600 font-normal">onwards</span>
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
                            className="px-2.5 py-1 rounded-lg bg-white border border-workspace-border hover:border-text-primary text-text-secondary hover:text-text-primary text-xs font-medium inline-flex items-center gap-1 transition-all shadow-sm"
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
                              className="px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-200 hover:border-amber-300 text-amber-800 text-xs font-medium inline-flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Pause service (hides from billing/POS)"
                            >
                              {actionLoadingId === svc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PauseCircle className="w-3 h-3 text-amber-600" />
                              )}
                              <span>Pause</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleResumeService(svc)}
                              disabled={actionLoadingId === svc.id}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 hover:border-emerald-300 text-emerald-800 text-xs font-medium inline-flex items-center gap-1 transition-all disabled:opacity-50"
                              title="Resume service (makes available in billing/POS)"
                            >
                              {actionLoadingId === svc.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <PlayCircle className="w-3 h-3 text-emerald-600" />
                              )}
                              <span>Resume</span>
                            </button>
                          )}

                          {/* Remove Service Button */}
                          <button
                            type="button"
                            onClick={() => setServiceToDelete(svc)}
                            disabled={actionLoadingId === svc.id}
                            className="p-1.5 rounded-lg bg-white border border-workspace-border hover:border-rose-300 hover:bg-rose-50 text-text-muted hover:text-rose-600 transition-all disabled:opacity-50"
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
      </main>

      {/* Remove Service Confirmation Modal */}
      {serviceToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-text-primary flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-rose-600" />
                <span>Remove Service</span>
              </h3>
              <button
                onClick={() => setServiceToDelete(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-sm text-text-secondary leading-relaxed">
              Are you sure you want to remove <span className="font-semibold text-text-primary">&quot;{serviceToDelete.name}&quot;</span>
              {serviceToDelete.variant_name ? ` (${serviceToDelete.variant_name})` : ''}?
            </p>

            <div className="p-3.5 rounded-xl bg-workspace-bg border border-workspace-border text-xs text-text-secondary leading-relaxed">
              <span className="font-semibold text-text-primary block mb-1">Non-Destructive Archiving:</span>
              This service will be deactivated and removed from the active salon menu. All past sales records, invoices, customer histories, and closing reports referencing this service will remain 100% intact.
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-workspace-border">
              <button
                type="button"
                onClick={() => setServiceToDelete(null)}
                disabled={actionLoadingId === serviceToDelete.id}
                className="px-4 py-2 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary text-xs font-medium transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRemoveService(serviceToDelete)}
                disabled={actionLoadingId === serviceToDelete.id}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-sm transition-all disabled:opacity-50"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Update Service Rate</h3>
              <button onClick={() => setEditingService(null)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-text-secondary mb-4">{editingService.name}</p>
            <form onSubmit={handleUpdatePrice} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">New Price (₹)</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={editPrice}
                  onChange={(e) => setEditPrice(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                />
              </div>
              <p className="text-[11px] text-text-muted">
                Note: Updating the price does not change historical invoices due to the price snapshot guarantee.
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setEditingService(null)}
                  className="flex-1 py-2 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEdit}
                  className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Create New Service</h3>
              <button onClick={() => setIsServiceModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateService} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Service Title *</label>
                <input
                  type="text"
                  required
                  value={svcName}
                  onChange={(e) => setSvcName(e.target.value)}
                  placeholder="e.g. Keratin Therapy"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>
              <div>
                <label className="block text-text-secondary font-medium mb-1">Category *</label>
                <select
                  value={svcCatId}
                  onChange={(e) => setSvcCatId(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                >
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={svcPrice}
                    onChange={(e) => setSvcPrice(e.target.value)}
                    placeholder="500"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Duration (Mins)</label>
                  <input
                    type="number"
                    value={svcDuration}
                    onChange={(e) => setSvcDuration(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>
              <div>
                <label className="block text-text-secondary font-medium mb-1">Target Audience</label>
                <select
                  value={svcGender}
                  onChange={(e) => setSvcGender(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
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
                  className="flex-1 py-2.5 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingService}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm shadow-sm"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-sm p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Add Service Category</h3>
              <button onClick={() => setIsCatModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateCategory} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Category Title *</label>
                <input
                  type="text"
                  required
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Bridal & Make-up"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsCatModalOpen(false)}
                  className="flex-1 py-2 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCat}
                  className="flex-1 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-xs shadow-sm"
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
