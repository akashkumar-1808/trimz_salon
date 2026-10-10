'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { Role, Permission } from '@/lib/types';
import { ShieldCheck, Plus, X, Loader2, Check, Lock } from 'lucide-react';

export default function RolesRbacPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissionGroups, setPermissionGroups] = useState<Record<string, Permission[]>>({});
  const [loading, setLoading] = useState(true);

  // New Role Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [roleName, setRoleName] = useState('');
  const [roleDesc, setRoleDesc] = useState('');
  const [selectedPermIds, setSelectedPermIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [rls, rawPerms] = await Promise.all([
        api.getRoles(),
        api.getPermissions(),
      ]);
      setRoles(rls);
      
      const groups: Record<string, Permission[]> = {};
      if (Array.isArray(rawPerms)) {
        rawPerms.forEach((item: any) => {
          if (item.module && Array.isArray(item.permissions)) {
            groups[item.module] = item.permissions;
          } else if (item.module) {
            if (!groups[item.module]) groups[item.module] = [];
            groups[item.module].push(item);
          }
        });
      }
      setPermissionGroups(groups);
    } catch (err) {
      console.error('Error loading RBAC settings:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateRole = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roleName) return;
    setSaving(true);
    try {
      await api.createRole({
        name: roleName,
        description: roleDesc || undefined,
        permission_ids: selectedPermIds,
      });
      setIsModalOpen(false);
      setRoleName('');
      setRoleDesc('');
      setSelectedPermIds([]);
      loadData();
    } catch (err: any) {
      alert(`Error creating role: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Role-Based Access Control (RBAC)" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ GOVERNANCE</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Roles & Permissions</h1>
            <p className="text-sm text-text-secondary mt-1">
              Define operational staff boundaries and assign granular functional authorities.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Create Custom Role</span>
          </button>
        </div>

        {/* Roles Cards Grid */}
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-xs text-text-muted">Loading security roles...</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {roles.map((r) => (
              <div
                key={r.id}
                className="p-5 rounded-2xl bg-white border border-workspace-border hover:border-text-primary transition-all flex flex-col justify-between shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-text-primary">{r.name}</h3>
                    {r.is_system && (
                      <span className="px-2 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-primary text-[10px] font-mono flex items-center gap-1 font-medium">
                        <Lock className="w-3 h-3" />
                        <span>System</span>
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-text-secondary mt-2 leading-relaxed">
                    {r.description || 'Custom staff authority template for Trimz Salon.'}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-workspace-border text-[11px] font-mono text-text-muted">
                  Slug: {r.slug}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Permission Catalog Overview Card */}
        <div className="bg-white border border-workspace-border rounded-2xl p-6 shadow-sm space-y-4">
          <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>System Permission Catalog</span>
          </h3>
          <p className="text-xs text-text-secondary">
            All operations across the backend are protected by these granular permission codes:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {Object.entries(permissionGroups).map(([module, perms]) => (
              <div key={module} className="p-4 rounded-xl bg-workspace-bg border border-workspace-border space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-text-primary">
                  {module}
                </span>
                <div className="space-y-1">
                  {perms.map((p) => (
                    <div key={p.id} className="text-[11px] flex items-center gap-1.5 text-text-secondary font-mono">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0" />
                      <span className="text-text-primary">{p.code}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Create Custom Role Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-xl p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Create Custom Role</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateRole} className="space-y-4 text-xs flex-1 overflow-y-auto pr-1">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Role Title *</label>
                <input
                  type="text"
                  required
                  value={roleName}
                  onChange={(e) => setRoleName(e.target.value)}
                  placeholder="e.g. Floor Supervisor"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Description</label>
                <input
                  type="text"
                  value={roleDesc}
                  onChange={(e) => setRoleDesc(e.target.value)}
                  placeholder="Primary duties and responsibilities"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary mb-2 font-bold uppercase tracking-wider text-[11px]">
                  Select Permissions
                </label>
                <div className="space-y-3 max-h-60 overflow-y-auto p-3 bg-workspace-bg rounded-xl border border-workspace-border">
                  {Object.entries(permissionGroups).map(([module, perms]) => (
                    <div key={module} className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-text-primary">{module}</p>
                      <div className="grid grid-cols-2 gap-1.5 pl-2">
                        {perms.map((p) => (
                          <label key={p.id} className="flex items-center gap-1.5 text-text-secondary cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selectedPermIds.includes(p.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedPermIds([...selectedPermIds, p.id]);
                                } else {
                                  setSelectedPermIds(selectedPermIds.filter((id) => id !== p.id));
                                }
                              }}
                              className="rounded border-workspace-border text-primary accent-primary"
                            />
                            <span className="font-mono text-[10px] text-text-primary">{p.code}</span>
                          </label>
                        ))}
                      </div>
                    </div>
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
                  {saving ? 'Creating...' : 'Save Role'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
