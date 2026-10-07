'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { PlusCircle, Clock, ShieldCheck, Activity } from 'lucide-react';

export default function Topbar({ title }: { title: string }) {
  const { user, roles, hasPermission } = useAuth();
  const [time, setTime] = useState<string>('');

  useEffect(() => {
    const updateTime = () => {
      setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }));
    };
    updateTime();
    const timer = setInterval(updateTime, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <header className="h-16 bg-dark-surface/80 backdrop-blur border-b border-dark-border px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Title & Live Status */}
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-bold tracking-tight text-white">{title}</h1>
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[11px] font-medium text-emerald-400">
          <Activity className="w-3 h-3 animate-pulse" />
          <span>Live POS</span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-4">
        {/* Real-time Clock */}
        <div className="hidden md:flex items-center gap-2 text-xs font-mono text-gray-400 bg-dark-card px-3 py-1.5 rounded-lg border border-dark-border">
          <Clock className="w-3.5 h-3.5 text-brand-400" />
          <span>{time || '--:--:--'}</span>
        </div>

        {/* Quick New Bill Action */}
        {hasPermission('billing.create') && (
          <Link
            href="/portal/billing"
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-semibold text-xs transition-all shadow-md shadow-brand-500/20"
          >
            <PlusCircle className="w-4 h-4 text-dark-bg" />
            <span>New Bill</span>
          </Link>
        )}

        {/* Role Pill */}
        <div className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-dark-card border border-dark-border text-xs text-gray-300">
          <ShieldCheck className="w-3.5 h-3.5 text-brand-400" />
          <span className="font-semibold capitalize text-brand-200">
            {user?.is_owner ? 'Owner' : roles[0] || 'Staff'}
          </span>
        </div>
      </div>
    </header>
  );
}
