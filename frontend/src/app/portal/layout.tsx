'use client';

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth, getDefaultPortalRoute } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import { Loader2, ShieldAlert, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

const ROUTE_PERMISSIONS: Record<string, string | string[]> = {
  '/portal/dashboard': 'dashboard.view',
  '/portal/billing': ['billing.create', 'billing.view'],
  '/portal/customers': 'customers.view',
  '/portal/services': 'services.view',
  '/portal/employees': 'employees.view',
  '/portal/reports': 'reports.view',
  '/portal/invoices': ['invoices.view', 'billing.view'],
  '/portal/settings': 'settings.view',
  '/portal/roles': 'roles.view',
};

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, permissions, hasPermission, refreshPermissions } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // Refresh permissions on route changes to ensure instant permission propagation
  useEffect(() => {
    if (user && !user.is_owner) {
      refreshPermissions();
    }
  }, [pathname]);

  if (loading) {
    return (
      <div className="min-h-screen bg-workspace-bg flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-serif font-black text-2xl mb-4 shadow-md shadow-primary/20 animate-pulse">
          T.
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>Loading Trimz Portal...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Check route-level permission for non-owner accounts
  let hasRouteAccess = true;
  if (!user.is_owner) {
    for (const [routePrefix, reqPerms] of Object.entries(ROUTE_PERMISSIONS)) {
      if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
        const perms = Array.isArray(reqPerms) ? reqPerms : [reqPerms];
        const allowed = perms.some((p) => hasPermission(p));
        if (!allowed) {
          hasRouteAccess = false;
        }
        break;
      }
    }
  }

  return (
    <div className="min-h-screen bg-workspace-bg flex">
      {/* Dynamic RBAC Sidebar */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-workspace-bg">
        {hasRouteAccess ? (
          children
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 flex items-center justify-center mb-4 shadow-xs">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="font-serif text-2xl font-bold text-text-primary">
              Access Restricted
            </h2>
            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
              You do not have active owner permission to access this feature. Please contact your salon owner to enable this operational feature in Staff Management.
            </p>
            <div className="mt-6 flex gap-3">
              <Link
                href={getDefaultPortalRoute(user, permissions)}
                className="px-4 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white text-xs font-semibold shadow-xs flex items-center gap-2 transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to Allowed Workspace</span>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
