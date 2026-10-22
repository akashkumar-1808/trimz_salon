'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import { 
  Home, 
  Receipt, 
  Calendar,
  Users, 
  MessageSquare,
  Scissors, 
  UserCheck, 
  Package,
  Award,
  Layers,
  TrendingDown,
  BarChart3,
  FileText, 
  Settings,
  LogOut
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, roles, hasPermission, logout } = useAuth();
  const [pendingStaffCount, setPendingStaffCount] = useState(0);

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
  }, [user, pathname]);

  const navigation = [
    {
      name: 'Overview',
      href: '/portal/dashboard',
      icon: Home,
      permission: 'dashboard.view',
    },
    {
      name: 'Billing & POS',
      href: '/portal/billing',
      icon: Receipt,
      permission: ['billing.create', 'billing.view'],
    },
    {
      name: 'Appointments',
      href: '/portal/appointments',
      icon: Calendar,
      permission: 'billing.view',
    },
    {
      name: 'Customers',
      href: '/portal/customers',
      icon: Users,
      permission: 'customers.view',
    },
    {
      name: 'WhatsApp wishes',
      href: '/portal/whatsapp',
      icon: MessageSquare,
      permission: 'billing.view',
    },
    {
      name: 'Services',
      href: '/portal/services',
      icon: Scissors,
      permission: 'services.view',
    },
    {
      name: 'Staff',
      href: '/portal/employees',
      icon: UserCheck,
      permission: 'employees.view',
    },
    {
      name: 'Inventory',
      href: '/portal/inventory',
      icon: Package,
      permission: 'billing.view',
    },
    {
      name: 'Memberships',
      href: '/portal/memberships',
      icon: Award,
      permission: 'billing.view',
    },
    {
      name: 'Packages',
      href: '/portal/packages',
      icon: Layers,
      permission: 'billing.view',
    },
    {
      name: 'Expenses',
      href: '/portal/expenses',
      icon: TrendingDown,
      permission: 'billing.view',
    },
    {
      name: 'Reports',
      href: '/portal/reports',
      icon: BarChart3,
      permission: 'reports.view',
    },
    {
      name: 'Invoices',
      href: '/portal/invoices',
      icon: FileText,
      permission: ['invoices.view', 'billing.view'],
    },
    {
      name: 'Settings',
      href: '/portal/settings',
      icon: Settings,
      permission: 'settings.view',
    },
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
