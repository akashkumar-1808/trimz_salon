'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Role } from '@/lib/types';
import {
  UserCheck,
  Plus,
  Search,
  Shield,
  X,
  Loader2,
  CheckCircle2,
  UserX,
  Clock,
  KeyRound,
  Sliders,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import { CANONICAL_MODULES, ModulePermissionDef } from '@/lib/rbac';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PENDING' | 'INACTIVE'>('ALL');

  // Add Employee Modal
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [savingAdd, setSavingAdd] = useState(false);

  // Edit / Permissions Modal
  const [editEmp, setEditEmp] = useState<any | null>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStatus, setEditStatus] = useState<string>('ACTIVE');
  const [savingEdit, setSavingEdit] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [emps, rls] = await Promise.all([
        api.getEmployees(),
        api.getRoles(),
      ]);
      setEmployees(emps);
      setRoles(rls);
      if (rls.length > 0 && selectedRoleIds.length === 0) {
        const rec = rls.find((r) => r.slug === 'receptionist') || rls[0];
        setSelectedRoleIds([rec.id]);
      }
    } catch (err: any) {
      console.error('Failed to load team data:', err);
      setError(err?.message || 'Failed to load staff roster from server.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !email || !password) return;
    setSavingAdd(true);
    try {
      await api.createEmployee({
        name,
        email,
        password,
        phone: phone || undefined,
        role_ids: selectedRoleIds,
        status: 'ACTIVE',
      });
      setIsAddModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      await loadData();
    } catch (err: any) {
      alert(`Error creating employee: ${err.message}`);
    } finally {
      setSavingAdd(false);
    }
  };

  const handleActivate = async (emp: any) => {
    try {
      await api.activateEmployee(emp.id);
      await loadData();
      if (editEmp && editEmp.id === emp.id) {
        setEditEmp({ ...editEmp, status: 'ACTIVE' });
        setEditStatus('ACTIVE');
      }
    } catch (err: any) {
      alert(`Failed to activate staff member: ${err.message}`);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    const isCurrentlyActive = emp.status?.toUpperCase() === 'ACTIVE';
    const newStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg = `Are you sure you want to ${isCurrentlyActive ? 'deactivate' : 'reactivate'} ${emp.name}'s account?`;
    if (!confirm(confirmMsg)) return;

    try {
      await api.updateEmployee(emp.id, { status: newStatus });
      await loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const openEditModal = (emp: any) => {
    setEditEmp(emp);
    setEditName(emp.name || '');
    setEditPhone(emp.phone || '');
    setEditStatus(emp.status || 'ACTIVE');
    setEditPermissions(emp.permissions || []);
  };

  const isFeatureEnabled = (feat: ModulePermissionDef): boolean => {
    if (editEmp?.is_owner) return true;
    return feat.requiredPermissions.some((p) => editPermissions.includes(p));
  };

  const toggleFeature = (feat: ModulePermissionDef) => {
    if (editEmp?.is_owner) return;
    const currentlyOn = isFeatureEnabled(feat);
    let updated: string[];
    if (currentlyOn) {
      // Remove all permissions belonging to this module
      const removeSet = new Set(feat.requiredPermissions);
      updated = editPermissions.filter((p) => !removeSet.has(p));
    } else {
      // Add all permissions belonging to this module
      const newPerms = new Set([...editPermissions, ...feat.requiredPermissions]);
      updated = Array.from(newPerms);
    }
    setEditPermissions(updated);
  };

  const handleSavePermissions = async () => {
    if (!editEmp) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateEmployee(editEmp.id, {
        name: editName,
        phone: editPhone || undefined,
        status: editStatus,
        permissions: editPermissions,
        has_custom_permissions: true,
      });
      if (updated && updated.id) {
        setEmployees((prev) => prev.map((e) => (e.id === editEmp.id ? updated : e)));
      }
      setEditEmp(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to save permissions: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleResetToRoleDefaults = async () => {
    if (!editEmp) return;
    if (!confirm(`Reset ${editEmp.name}'s permissions to inherit default role permissions?`)) return;
    setSavingEdit(true);
    try {
      const updated = await api.updateEmployee(editEmp.id, {
        has_custom_permissions: false,
      });
      if (updated && updated.id) {
        setEmployees((prev) => prev.map((e) => (e.id === editEmp.id ? updated : e)));
      }
      setEditEmp(null);
      await loadData();
    } catch (err: any) {
      alert(`Failed to reset permissions: ${err?.message || 'Unknown error'}`);
    } finally {
      setSavingEdit(false);
    }
  };

  // Metrics
  const activeCount = useMemo(() => employees.filter((e) => e.status?.toUpperCase() === 'ACTIVE').length, [employees]);
  const pendingCount = useMemo(() => employees.filter((e) => e.status?.toUpperCase() === 'PENDING').length, [employees]);
  const inactiveCount = useMemo(() => employees.filter((e) => e.status?.toUpperCase() === 'INACTIVE').length, [employees]);

  const filteredEmployees = employees.filter((e) => {
    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && e.status?.toUpperCase() === 'ACTIVE') ||
      (statusFilter === 'PENDING' && e.status?.toUpperCase() === 'PENDING') ||
      (statusFilter === 'INACTIVE' && e.status?.toUpperCase() === 'INACTIVE');

    if (!matchesStatus) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        e.name?.toLowerCase().includes(q) ||
        e.email?.toLowerCase().includes(q) ||
        (e.phone && e.phone.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Staff Management & Feature Access" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ TEAM MANAGEMENT</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Staff & Access Control</h1>
            <p className="text-sm text-text-secondary mt-1">
              Owner-controlled team roster, pending registration approvals, and granular feature toggles.
            </p>
          </div>
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Staff Member</span>
          </button>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white border border-workspace-border rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-text-muted tracking-wider">Total Staff</span>
            <div className="text-2xl font-bold text-text-primary mt-1">{employees.length}</div>
            <span className="text-xs text-text-secondary mt-0.5 block">Registered accounts</span>
          </div>

          <div className="bg-white border border-workspace-border rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-emerald-600 tracking-wider">Active</span>
            <div className="text-2xl font-bold text-emerald-700 mt-1">{activeCount}</div>
            <span className="text-xs text-text-secondary mt-0.5 block">Operational accounts</span>
          </div>

          <div
            onClick={() => setStatusFilter('PENDING')}
            className={`border rounded-2xl p-4 shadow-xs cursor-pointer transition-all ${
              pendingCount > 0
                ? 'bg-amber-50/60 border-amber-200 hover:bg-amber-50'
                : 'bg-white border-workspace-border'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] uppercase font-bold text-amber-700 tracking-wider">Pending Approval</span>
              {pendingCount > 0 && <Clock className="w-4 h-4 text-amber-600 animate-pulse" />}
            </div>
            <div className="text-2xl font-bold text-amber-800 mt-1">{pendingCount}</div>
            <span className="text-xs text-amber-700/80 mt-0.5 block">Awaiting owner review</span>
          </div>

          <div className="bg-white border border-workspace-border rounded-2xl p-4 shadow-xs">
            <span className="text-[11px] uppercase font-bold text-rose-600 tracking-wider">Deactivated</span>
            <div className="text-2xl font-bold text-rose-700 mt-1">{inactiveCount}</div>
            <span className="text-xs text-text-secondary mt-0.5 block">Disabled logins</span>
          </div>
        </div>

        {/* Actions & Filters Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search staff by name, email, or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
            {(['ALL', 'ACTIVE', 'PENDING', 'INACTIVE'] as const).map((st) => (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  statusFilter === st
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-workspace-bg text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
                }`}
              >
                {st === 'ALL'
                  ? `All (${employees.length})`
                  : st === 'PENDING'
                  ? `Pending (${pendingCount})`
                  : st === 'ACTIVE'
                  ? `Active (${activeCount})`
                  : `Inactive (${inactiveCount})`}
              </button>
            ))}
          </div>
        </div>

        {/* Employees Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <span>Staff Members ({filteredEmployees.length})</span>
            </h3>
          </div>

          {error && (
            <div className="p-4 mx-4 mt-4 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-between text-xs text-rose-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span><strong>API Error:</strong> {error}</span>
              </div>
              <button
                type="button"
                onClick={() => loadData()}
                className="px-3 py-1 rounded-lg bg-white border border-rose-300 font-medium hover:bg-rose-100 transition-colors flex items-center gap-1"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          )}

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading team roster...</span>
            </div>
          ) : error && employees.length === 0 ? (
            <div className="p-16 text-center text-rose-600 text-sm flex flex-col items-center gap-3">
              <AlertTriangle className="w-8 h-8 text-rose-500" />
              <p className="font-medium">Could not load staff records</p>
              <p className="text-xs text-text-muted max-w-sm">{error}</p>
              <button
                type="button"
                onClick={() => loadData()}
                className="mt-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-all flex items-center gap-1.5 shadow-sm"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reload Team Data</span>
              </button>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No staff members found matching criteria.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Staff Member</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Role & Permissions</th>
                    <th className="p-4">Account Status</th>
                    <th className="p-4">Registered</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredEmployees.map((emp) => {
                    const isPending = emp.status?.toUpperCase() === 'PENDING';
                    const isActive = emp.status?.toUpperCase() === 'ACTIVE';

                    return (
                      <tr key={emp.id} className="hover:bg-workspace-hover/50 transition-colors">
                        <td className="p-4">
                          <div className="font-semibold text-text-primary flex items-center gap-2">
                            <span>{emp.name}</span>
                            {emp.is_owner && (
                              <span className="px-2 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-primary text-[10px] font-mono font-bold">
                                Salon Owner
                              </span>
                            )}
                          </div>
                          <div className="text-text-muted font-mono text-xs">{emp.email}</div>
                        </td>
                        <td className="p-4 font-mono text-text-secondary text-xs">{emp.phone || '—'}</td>
                        <td className="p-4">
                          <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                              {emp.roles && emp.roles.length > 0 ? (
                                emp.roles.map((r: any, idx: number) => {
                                  const roleName = typeof r === 'string' ? r : r.name || r.slug;
                                  return (
                                    <span
                                      key={idx}
                                      className="px-2.5 py-0.5 rounded-md bg-workspace-bg border border-workspace-border text-text-secondary text-[11px] font-medium"
                                    >
                                      {roleName}
                                    </span>
                                  );
                                })
                              ) : (
                                <span className="text-text-muted italic text-xs">Standard Staff</span>
                              )}
                            </div>

                            {emp.is_owner ? (
                              <span className="text-[11px] text-emerald-600 font-medium">All 10 Features Enabled</span>
                            ) : emp.has_custom_permissions ? (
                              <span className="text-[10px] font-mono bg-purple-50 text-purple-700 px-2 py-0.5 rounded border border-purple-200 inline-block">
                                Custom ({emp.permissions?.length || 0} perms)
                              </span>
                            ) : (
                              <span className="text-[10px] font-mono text-text-muted inline-block">
                                Default Role Access
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-4">
                          {isPending ? (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Pending Approval</span>
                            </span>
                          ) : isActive ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200">
                              <UserX className="w-3 h-3 text-rose-600" />
                              <span>Deactivated</span>
                            </span>
                          )}
                        </td>
                        <td className="p-4 text-text-secondary text-xs">{formatDate(emp.created_at)}</td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Approve button if pending */}
                            {isPending && !emp.is_owner && (
                              <button
                                onClick={() => handleActivate(emp)}
                                className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all flex items-center gap-1.5"
                              >
                                <Check className="w-3.5 h-3.5" />
                                <span>Approve Access</span>
                              </button>
                            )}

                            {/* Feature Toggles & Edit */}
                            {!emp.is_owner && (
                              <button
                                onClick={() => openEditModal(emp)}
                                className="px-3 py-1.5 rounded-xl text-xs font-medium border border-workspace-border hover:border-primary text-text-primary hover:text-primary transition-all flex items-center gap-1.5 bg-white"
                              >
                                <Sliders className="w-3.5 h-3.5" />
                                <span>Permissions</span>
                              </button>
                            )}

                            {/* Deactivate/Re-activate */}
                            {!emp.is_owner && !isPending && (
                              <button
                                onClick={() => handleToggleStatus(emp)}
                                className={`px-2.5 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                                  isActive
                                    ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                                    : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                                }`}
                              >
                                {isActive ? 'Disable' : 'Enable'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Employee Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Add Staff Member</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Full Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Ramesh Kumar"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Work Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="ramesh@trimzsalon.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  placeholder="9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Initial Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                  Assign Role
                </label>
                <select
                  value={selectedRoleIds[0] || ''}
                  onChange={(e) => setSelectedRoleIds(e.target.value ? [e.target.value] : [])}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                >
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary border border-workspace-border hover:bg-workspace-bg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingAdd}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingAdd ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Add Staff Member</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Feature Permissions & Edit Modal */}
      {editEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-2xl p-6 shadow-2xl my-8">
            <div className="flex justify-between items-start pb-4 border-b border-workspace-border">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg text-text-primary">{editEmp.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                      editEmp.status?.toUpperCase() === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : editEmp.status?.toUpperCase() === 'PENDING'
                        ? 'bg-amber-50 text-amber-800 border border-amber-300'
                        : 'bg-rose-50 text-rose-700 border border-rose-200'
                    }`}
                  >
                    {editEmp.status}
                  </span>
                </div>
                <p className="text-xs text-text-secondary font-mono mt-0.5">{editEmp.email}</p>
              </div>
              <button
                onClick={() => setEditEmp(null)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Pending Approval Action */}
            {editEmp.status?.toUpperCase() === 'PENDING' && (
              <div className="my-4 p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 text-xs text-amber-800">
                  <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>This staff member registered online and is waiting for account approval.</span>
                </div>
                <button
                  onClick={() => handleActivate(editEmp)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shrink-0 shadow-xs flex items-center gap-1.5"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Approve Now</span>
                </button>
              </div>
            )}

            <div className="py-4 space-y-6">
              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Display Name
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              {/* 10 Owner Feature Switches */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h4 className="text-sm font-bold text-text-primary flex items-center gap-1.5">
                      <Sliders className="w-4 h-4 text-primary" />
                      <span>Owner-Controlled Feature Permissions</span>
                    </h4>
                    <p className="text-xs text-text-secondary mt-0.5">
                      Turn specific features ON or OFF for this staff member. Changes apply instantly.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetToRoleDefaults}
                    className="text-xs text-text-secondary hover:text-text-primary flex items-center gap-1 px-2.5 py-1 rounded-lg border border-workspace-border hover:bg-workspace-bg"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Role Defaults</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {CANONICAL_MODULES.map((feat) => {
                    const enabled = isFeatureEnabled(feat);

                    return (
                      <div
                        key={feat.id}
                        onClick={() => toggleFeature(feat)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-start justify-between gap-3 ${
                          enabled
                            ? 'bg-emerald-50/40 border-emerald-300 shadow-xs'
                            : 'bg-workspace-bg/40 border-workspace-border hover:border-gray-300 opacity-75'
                        }`}
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-text-primary">{feat.name}</span>
                          </div>
                          <p className="text-[11px] text-text-secondary leading-snug">{feat.description}</p>
                        </div>

                        {/* Modern Switch UI */}
                        <div
                          className={`w-10 h-5.5 rounded-full transition-colors flex items-center p-0.5 shrink-0 ${
                            enabled ? 'bg-emerald-600' : 'bg-gray-300'
                          }`}
                        >
                          <div
                            className={`w-4.5 h-4.5 rounded-full bg-white shadow-xs transform transition-transform ${
                              enabled ? 'translate-x-4.5' : 'translate-x-0'
                            }`}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-workspace-border flex items-center justify-between gap-3">
              <span className="text-xs text-text-muted">
                {editPermissions.length} granular permission keys assigned
              </span>

              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditEmp(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-text-secondary border border-workspace-border hover:bg-workspace-bg"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSavePermissions}
                  disabled={savingEdit}
                  className="px-5 py-2 rounded-xl text-xs font-semibold bg-primary hover:bg-primary-hover text-white shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                >
                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  <span>Save Permissions</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
