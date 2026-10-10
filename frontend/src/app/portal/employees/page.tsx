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
        // default to receptionist or first role
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
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Staff & Access Control" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Actions Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-surface p-4 rounded-2xl border border-dark-border">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search team member by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>

          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20"
          >
            <Plus className="w-4 h-4" />
            <span>Add Team Member</span>
          </button>
        </div>

        {/* Employees Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <UserCheck className="w-4 h-4 text-brand-400" />
              <span>Employees & Credentials ({filteredEmployees.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No staff members found matching query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
                    <th className="p-4">Name & Email</th>
                    <th className="p-4">Phone</th>
                    <th className="p-4">Assigned Roles</th>
                    <th className="p-4">Status</th>
                    <th className="p-4">Onboarded</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="hover:bg-dark-card/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-100 flex items-center gap-2">
                          <span>{emp.name}</span>
                          {emp.is_owner && (
                            <span className="px-2 py-0.5 rounded-full bg-brand-500/20 border border-brand-500/40 text-brand-300 text-[10px] font-mono font-bold">
                              Owner
                            </span>
                          )}
                        </div>
                        <div className="text-gray-400 font-mono text-[11px]">{emp.email}</div>
                      </td>
                      <td className="p-4 font-mono text-gray-300">{emp.phone || '-'}</td>
                      <td className="p-4">
                        <div className="flex flex-wrap gap-1">
                          {emp.roles && emp.roles.length > 0 ? (
                            emp.roles.map((r: string, idx: number) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-dark-card border border-dark-border text-gray-300 text-[10px] font-medium"
                              >
                                {r}
                              </span>
                            ))
                          ) : (
                            <span className="text-gray-500 italic text-[11px]">No role</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            emp.status?.toUpperCase() === 'ACTIVE'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : 'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}
                        >
                          {emp.status}
                        </span>
                      </td>
                      <td className="p-4 text-gray-400">{formatDate(emp.created_at)}</td>
                      <td className="p-4 text-right">
                        {!emp.is_owner && (
                          <button
                            onClick={() => handleToggleStatus(emp)}
                            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                              emp.status?.toUpperCase() === 'ACTIVE'
                                ? 'border-red-500/30 text-red-400 hover:bg-red-500/10'
                                : 'border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10'
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
      </div>

      {/* Add Employee Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-white">Add Staff Member</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateEmployee} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Work Email *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="staff@trimzsalon.com"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Temporary Password *</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="10-digit mobile"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Assign Operational Role *</label>
                <div className="space-y-1.5 max-h-36 overflow-y-auto p-2 bg-dark-card rounded-xl border border-dark-border">
                  {roles.map((r) => (
                    <label key={r.id} className="flex items-center gap-2 text-gray-300 cursor-pointer">
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
                        className="rounded bg-dark-bg border-dark-border text-brand-500"
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
                  className="flex-1 py-2.5 rounded-xl bg-dark-card text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold"
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
