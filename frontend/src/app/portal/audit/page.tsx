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
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Security & Operational Audit Trail" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Search Bar */}
        <div className="bg-dark-surface p-4 rounded-2xl border border-dark-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search audit trail by action, staff email, or entity..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {filteredLogs.length} events logged
          </span>
        </div>

        {/* Audit Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <History className="w-4 h-4 text-brand-400" />
              <span>Immutable Activity Log</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
            </div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No audit records matching query.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
                    <th className="p-4">Action</th>
                    <th className="p-4">Staff / User</th>
                    <th className="p-4">Entity</th>
                    <th className="p-4">IP Address</th>
                    <th className="p-4 text-right">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-dark-card/50 transition-colors">
                      <td className="p-4">
                        <span className="font-mono font-bold text-brand-300 bg-brand-500/10 px-2 py-0.5 rounded border border-brand-500/20">
                          {log.action}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-gray-200">{log.user_name || 'System'}</div>
                        <div className="text-gray-500 font-mono text-[11px]">{log.user_email || '-'}</div>
                      </td>
                      <td className="p-4">
                        <span className="font-mono text-gray-300">{log.entity_type}</span>
                        {log.entity_id && (
                          <span className="text-[10px] text-gray-500 block truncate max-w-[120px] font-mono">
                            {log.entity_id}
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-mono text-gray-400">{log.ip_address || '127.0.0.1'}</td>
                      <td className="p-4 text-right text-gray-400 font-mono">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
