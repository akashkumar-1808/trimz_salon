'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatDate } from '@/lib/utils';
import { History, Search, ShieldAlert, Loader2 } from 'lucide-react';

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const loadLogs = async () => {
    setLoading(true);
    try {
      const data = await api.getAuditLogs(100);
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const filteredLogs = logs.filter((l) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        l.action.toLowerCase().includes(q) ||
        (l.user_email && l.user_email.toLowerCase().includes(q)) ||
        (l.entity_type && l.entity_type.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Security & Operational Audit Trail" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ COMPLIANCE</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Audit Trail</h1>
            <p className="text-sm text-text-secondary mt-1">
              Immutable activity log recording authorization, checkouts, and system events.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by action, staff email, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white transition-all"
            />
          </div>
          <span className="text-xs text-text-secondary font-mono">
            {filteredLogs.length} events logged
          </span>
        </div>

        {/* Audit Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span>Immutable Activity Log</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="text-xs text-text-muted">Loading audit entries...</span>
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No audit records matching query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Action</th>
                    <th className="p-4">Staff / User</th>
                    <th className="p-4">Entity</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20 text-xs">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-text-primary">{log.user_name || 'System'}</div>
                        <div className="text-text-muted font-mono text-[11px]">{log.user_email || '-'}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-text-secondary">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-[11px] text-text-muted block truncate max-w-[140px] font-mono">
                            {log.entity_id}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-text-secondary text-xs">{log.ip_address || '127.0.0.1'}</td>
                      <td className="p-4 text-right text-text-secondary font-mono text-xs">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
