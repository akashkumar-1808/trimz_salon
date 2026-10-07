'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { 
  LayoutDashboard, 
  Receipt, 
  Users, 
  Scissors, 
  FileText, 
  ShieldCheck, 
  UserCheck, 
  History,
  LogOut,
  Sparkles,
  ExternalLink
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, roles, hasPermission, logout } = useAuth();

  const navigation = [
    {
      name: 'Dashboard',
      href: '/portal/dashboard',
      icon: LayoutDashboard,
      permission: 'dashboard.view',
    },
    {
      name: 'POS Billing',
      href: '/portal/billing',
      icon: Receipt,
      permission: 'billing.create',
    },
    {
      name: 'Customers',
      href: '/portal/customers',
      icon: Users,
      permission: 'customers.view',
    },
    {
      name: 'Services Catalog',
      href: '/portal/services',
      icon: Scissors,
      permission: 'services.view',
    },
    {
      name: 'Invoices',
      href: '/portal/invoices',
      icon: FileText,
      permission: 'billing.view',
    },
    {
      name: 'Staff & Team',
      href: '/portal/employees',
      icon: UserCheck,
      permission: 'employees.view',
    },
    {
      name: 'Roles & RBAC',
      href: '/portal/roles',
      icon: ShieldCheck,
      permission: 'roles.view',
    },
    {
      name: 'Audit Logs',
      href: '/portal/audit',
      icon: History,
      permission: 'audit.view',
    },
  ];

  return (
    <aside className="w-64 bg-dark-surface border-r border-dark-border flex flex-col h-screen sticky top-0 select-none z-30">
      {/* Brand Header */}
      <div className="p-5 border-b border-dark-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 flex items-center justify-center text-dark-bg font-black text-xl shadow-lg shadow-brand-500/20">
            T
          </div>
          <div>
            <span className="font-extrabold tracking-wider text-lg bg-gradient-to-r from-brand-300 via-brand-400 to-amber-200 bg-clip-text text-transparent">
              TRIMZ SALON
            </span>
            <p className="text-[10px] tracking-widest uppercase font-semibold text-dark-muted">
              {user?.is_owner ? 'Owner Terminal' : 'Operations Desk'}
            </p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          Menu
        </div>
        {navigation.map((item) => {
          if (!hasPermission(item.permission)) return null;

          const isActive = pathname === item.href;
          const Icon = item.icon;

          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-brand-500/10 text-brand-400 border border-brand-500/30 shadow-sm'
                  : 'text-gray-400 hover:text-gray-100 hover:bg-dark-card/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-brand-400' : 'text-gray-400'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        <div className="pt-4 px-3 pb-2 text-[11px] font-semibold tracking-wider text-gray-500 uppercase">
          External
        </div>
        <Link
          href="/"
          target="_blank"
          className="flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium text-gray-400 hover:text-gray-100 hover:bg-dark-card/60 transition-all"
        >
          <span className="flex items-center gap-3">
            <Sparkles className="w-4 h-4 text-brand-400" />
            <span>Public Website</span>
          </span>
          <ExternalLink className="w-3.5 h-3.5 text-gray-500" />
        </Link>
      </nav>

      {/* User Footer Profile */}
      <div className="p-4 border-t border-dark-border bg-dark-bg/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-dark-card border border-dark-border flex items-center justify-center font-bold text-sm text-brand-300">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-gray-200 truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-brand-400 truncate font-mono">
                {user?.is_owner ? 'Owner / Admin' : roles[0] || 'Staff'}
              </p>
            </div>
          </div>
          <button
            onClick={logout}
            title="Log out"
            className="p-2 text-gray-400 hover:text-red-400 hover:bg-dark-card rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
