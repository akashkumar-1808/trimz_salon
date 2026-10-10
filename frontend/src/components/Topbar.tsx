'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { Plus, Bell } from 'lucide-react';

interface TopbarProps {
  title: string;
  breadcrumb?: string;
}

export default function Topbar({ title, breadcrumb }: TopbarProps) {
  const { user, hasPermission } = useAuth();
  const [formattedDate, setFormattedDate] = useState<string>('');

  useEffect(() => {
    // Format date like 'Sat, 10 Oct, 2026' matching screenshot
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    };
    setFormattedDate(now.toLocaleDateString('en-GB', options));
  }, []);

  return (
    <header className="h-14 bg-white border-b border-[#E8E5E3] px-8 flex items-center justify-between sticky top-0 z-20 shrink-0">
      {/* Breadcrumbs on Left */}
      <div className="flex items-center text-xs">
        <span className="font-semibold tracking-wider uppercase text-[#929292]">
          TRIMZ
        </span>
        <span className="mx-2 text-[#D5D2CF]">/</span>
        <span className="font-semibold text-[#171717] text-sm">
          {breadcrumb || title}
        </span>
      </div>

      {/* Right Controls */}
      <div className="flex items-center gap-3">
        {/* Date string */}
        <span className="text-xs font-medium text-[#737373] hidden sm:inline mr-1">
          {formattedDate || 'Sat, 10 Oct, 2026'}
        </span>

        {/* Notifications Bell */}
        <button
          type="button"
          aria-label="Notifications"
          className="w-8 h-8 rounded-lg border border-[#E8E5E3] bg-white hover:bg-[#F5F4F3] flex items-center justify-center text-[#737373] hover:text-[#171717] transition-colors relative"
        >
          <Bell className="w-4 h-4" />
        </button>

        {/* + New bill Primary Button */}
        {hasPermission('billing.create') && (
          <Link
            href="/portal/billing"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs tracking-wide transition-all shadow-sm"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New bill</span>
          </Link>
        )}
      </div>
    </header>
  );
}
