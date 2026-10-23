'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { CANONICAL_MODULES, SECONDARY_NAV_ITEMS } from '@/lib/rbac';
import { LogOut } from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, roles, hasPermission, logout } = useAuth();
  const [pendingStaffCount, setPendingStaffCount] = useState(0);

  // Fetch pending staff count once per session / user change, not on every route transition
  useEffect(() => {
    if (user?.is_owner || hasPermission('employees.view')) {
      api
        .getEmployees()
        .then((emps) => {
          const p = emps.filter((e) => e.status?.toUpperCase() === 'PENDING').length;
          setPendingStaffCount(p);
        })
        .catch(() => {});
    }
  }, [user?.id]);

  // Unified canonical navigation
  const navigation = [
    ...CANONICAL_MODULES.map((m) => ({
      name: m.id === 'dashboard' ? 'Overview' : m.id === 'employees' ? 'Staff' : m.name,
      href: m.route,
      icon: m.icon,
      permission: m.viewPermission,
    })),
    ...SECONDARY_NAV_ITEMS,
  ];

  return (
    <aside 
      style={{ background: 'linear-gradient(180deg, #191919 0%, #111111 100%)' }}
      className="w-60 border-r border-[#262626] flex flex-col h-screen sticky top-0 select-none z-30 shrink-0"
    >
      {/* Brand Header */}
      <div className="px-4 pt-7 pb-5 border-b border-[#252525] flex items-center justify-center">
        <Link href="/portal/dashboard" className="flex items-center justify-center w-full">
          <img 
            src="/trimz.png" 
            alt="Trimz Unisex Salon" 
            className="h-9 w-auto max-w-[160px] object-contain mx-auto"
          />
        </Link>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <div className="px-3 pt-2 pb-1.5 text-[10px] font-semibold tracking-widest text-[#737373] uppercase">
          WORKSPACE
        </div>
        
        {navigation.map((item) => {
          // If user doesn't have permission and isn't owner, skip
          if (!user?.is_owner && item.permission) {
            const perms = Array.isArray(item.permission) ? item.permission : [item.permission];
            const hasAny = perms.some((p) => hasPermission(p));
            if (!hasAny) return null;
          }

          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`relative flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition-all ${
                isActive
                  ? 'bg-[#242424] text-white shadow-sm font-semibold'
                  : 'text-[#A3A3A3] hover:text-white hover:bg-[#1C1C1C]'
              }`}
            >
              {/* Left active red accent bar */}
              {isActive && (
                <span className="absolute left-0 top-1.5 bottom-1.5 w-1 bg-[#E60023] rounded-r" />
              )}
              <Icon 
                className={`w-4 h-4 transition-colors ${
                  isActive ? 'text-white' : 'text-[#8A8A8A] group-hover:text-white'
                }`} 
              />
              <span className="truncate flex-1">{item.name}</span>
              {item.name === 'Staff' && pendingStaffCount > 0 && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500 text-black shadow-2xs animate-pulse">
                  {pendingStaffCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Footer Profile */}
      <div className="p-3 border-t border-[#252525] bg-[#141414]/80">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#242424] border border-[#333333] flex items-center justify-center font-bold text-xs text-white">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'T'}
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">
                {user?.name || 'Trimz Staff'}
              </p>
              <p className="text-[10px] text-[#8A8A8A] truncate">
                {user?.is_owner ? 'Salon Owner' : roles[0] || 'Operations'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-1.5 text-[#8A8A8A] hover:text-[#E60023] hover:bg-[#222222] rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
