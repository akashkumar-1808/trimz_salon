'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { Role } from '@/lib/types';
import { UserCheck, Plus, Search, Shield, X, Loader2, CheckCircle2, UserX } from 'lucide-react';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<any[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add Employee Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
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
    } catch (err) {
      console.error('Failed to load team data:', err);
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
    setSaving(true);
    try {
      await api.createEmployee({
        name,
        email,
        password,
        phone: phone || undefined,
        role_ids: selectedRoleIds,
      });
      setIsModalOpen(false);
      setName('');
      setEmail('');
      setPassword('');
      setPhone('');
      loadData();
    } catch (err: any) {
      alert(`Error creating employee: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (emp: any) => {
    const isCurrentlyActive = emp.status?.toUpperCase() === 'ACTIVE';
    const newStatus = isCurrentlyActive ? 'INACTIVE' : 'ACTIVE';
    const confirmMsg = `Are you sure you want to ${isCurrentlyActive ? 'deactivate' : 'reactivate'} ${emp.name}'s account?`;
    if (!confirm(confirmMsg)) return;

    try {
      await api.updateEmployee(emp.id, { status: newStatus });
      loadData();
    } catch (err: any) {
      alert(`Status update failed: ${err.message}`);
    }
  };

  const filteredEmployees = employees.filter((e) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Staff & Access Control" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ TEAM MANAGEMENT</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Staff & Access Control</h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage salon staff members, assign operational roles, credentials, and access status.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </div>

        {/* Actions Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team member by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
            />
          </div>
          <span className="text-xs text-text-secondary font-mono">
            Total staff: {filteredEmployees.length}
          </span>
        </div>

        {/* Employees Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-primary" />
              <span>Employees & Credentials ({filteredEmployees.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading team roster...</span>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No staff members found matching query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Name & Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Assigned Roles</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Onboarded</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-text-primary flex items-center gap-2">
                          <span>{emp.name}</span>
                          {emp.is_owner && (
                            <span className="px-2 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-primary text-[10px] font-mono font-bold">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-text-muted font-mono text-xs">{emp.email}</div>
                      </td>
                      <td className="p-4 font-mono text-text-secondary text-xs">{emp.phone || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.roles && emp.roles.length > 0 ? (
                            emp.roles.map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2.5 py-0.5 rounded-md bg-workspace-bg border border-workspace-border text-text-secondary text-[11px] font-medium"
                              >
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-text-muted italic text-xs">No role</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            emp.status?.toUpperCase() === 'ACTIVE'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary text-xs">{formatDate(emp.created_at)}</td>
                      <td className="p-4 text-right">
                        {!emp.is_owner && (
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all ${
                              emp.status?.toUpperCase() === 'ACTIVE'
                                ? 'bg-white border-rose-200 text-rose-700 hover:bg-rose-50'
                                : 'bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-50'
                            }`}
                          >
                            {emp.status?.toUpperCase() === 'ACTIVE' ? 'Disable Access' : 'Re-activate'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Add Staff Member</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@trimzsalon.com"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Assign Operational Role *</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2.5 bg-workspace-bg rounded-xl border border-workspace-border">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-text-primary cursor-pointer text-xs">
                      <input
                        type="checkbox"
                        checked={selectedRoleIds.includes(r.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRoleIds([...selectedRoleIds, r.id]);
                          } else {
                            setSelectedRoleIds(selectedRoleIds.filter((id) => id !== r.id));
                          }
                        }}
                        className="rounded border-workspace-border text-primary accent-primary"
                      />
                      <span>{r.name}</span>
                    </label>
                  ))}
                </div>
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
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm shadow-sm"
                >
                  {saving ? 'Creating...' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
