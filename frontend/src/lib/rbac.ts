// ==============================================================================
// TRIMZ SALON — CANONICAL RBAC & NAVIGATION SYSTEM
// ==============================================================================

import { User } from './types';
import {
  Home,
  Receipt,
  Users,
  Scissors,
  UserCheck,
  Award,
  BarChart3,
  FileText,
  Shield,
  Settings,
  Calendar,
  Package,
  Layers,
  TrendingDown,
  MessageSquare,
  LucideIcon
} from 'lucide-react';

export interface ModulePermissionDef {
  id: string;
  name: string;
  description: string;
  viewPermission: string;
  requiredPermissions: string[];
  route: string;
  icon: LucideIcon;
  badge?: string;
}

/**
 * The 10 canonical operational modules of Trimz Salon,
 * aligned 1:1 with PostgreSQL permissions table.
 */
export const CANONICAL_MODULES: ModulePermissionDef[] = [
  {
    id: 'dashboard',
    name: 'Dashboard Overview',
    description: 'View salon KPI metrics, revenue charts, and operational summary',
    viewPermission: 'dashboard.view',
    requiredPermissions: ['dashboard.view'],
    route: '/portal/dashboard',
    icon: Home,
  },
  {
    id: 'billing',
    name: 'Billing & POS',
    description: 'Create new tickets, apply discounts, and complete checkout',
    viewPermission: 'billing.view',
    requiredPermissions: ['billing.view', 'billing.create', 'billing.edit', 'billing.cancel'],
    route: '/portal/billing',
    icon: Receipt,
  },
  {
    id: 'customers',
    name: 'Customer Directory',
    description: 'Access customer profiles, appointment history, and contact details',
    viewPermission: 'customers.view',
    requiredPermissions: ['customers.view', 'customers.create', 'customers.edit', 'customers.delete'],
    route: '/portal/customers',
    icon: Users,
  },
  {
    id: 'services',
    name: 'Services & Menu Catalog',
    description: 'View and manage salon services, categories, pricing, and durations',
    viewPermission: 'services.view',
    requiredPermissions: ['services.view', 'services.create', 'services.edit', 'services.delete'],
    route: '/portal/services',
    icon: Scissors,
  },
  {
    id: 'memberships',
    name: 'Membership & VIP Club',
    description: 'Manage membership tiers, customer perks, discount limits, and renewal dates',
    viewPermission: 'memberships.view',
    requiredPermissions: ['memberships.view', 'memberships.manage'],
    route: '/portal/memberships',
    icon: Award,
  },
  {
    id: 'employees',
    name: 'Staff Management',
    description: 'View team members, approve pending registrations, and manage permissions',
    viewPermission: 'employees.view',
    requiredPermissions: ['employees.view', 'employees.create', 'employees.edit', 'employees.delete'],
    route: '/portal/employees',
    icon: UserCheck,
  },
  {
    id: 'reports',
    name: 'Reports & Analytics',
    description: 'Access revenue reports, staff sales analytics, and business insights',
    viewPermission: 'reports.view',
    requiredPermissions: ['reports.view', 'reports.export'],
    route: '/portal/reports',
    icon: BarChart3,
  },
  {
    id: 'invoices',
    name: 'Digital Invoices',
    description: 'Generate, preview, and share WhatsApp public digital invoices',
    viewPermission: 'invoices.view',
    requiredPermissions: ['invoices.view', 'invoices.manage'],
    route: '/portal/invoices',
    icon: FileText,
  },
  {
    id: 'roles',
    name: 'Roles & Permissions',
    description: 'Configure operational role templates and authorization schemes',
    viewPermission: 'roles.view',
    requiredPermissions: ['roles.view', 'roles.manage'],
    route: '/portal/roles',
    icon: Shield,
  },
  {
    id: 'settings',
    name: 'Business Settings',
    description: 'Configure salon profile, receipt branding, currency, and tax parameters',
    viewPermission: 'settings.view',
    requiredPermissions: ['settings.view', 'settings.edit'],
    route: '/portal/settings',
    icon: Settings,
  },
];

/**
 * Secondary navigational shortcuts for salon desk operations.
 * Map to appropriate primary permission.
 */
export const SECONDARY_NAV_ITEMS = [
  {
    name: 'Appointments',
    href: '/portal/appointments',
    icon: Calendar,
    permission: 'billing.view',
  },
  {
    name: 'WhatsApp wishes',
    href: '/portal/whatsapp',
    icon: MessageSquare,
    permission: 'billing.view',
  },
  {
    name: 'Inventory',
    href: '/portal/inventory',
    icon: Package,
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
];

/**
 * Maps each route to its required permission check.
 */
export const ROUTE_PERMISSION_MAP: Record<string, string | string[]> = {
  '/portal/dashboard': 'dashboard.view',
  '/portal/billing': ['billing.create', 'billing.view'],
  '/portal/customers': 'customers.view',
  '/portal/services': 'services.view',
  '/portal/memberships': ['memberships.view', 'memberships.manage', 'billing.view'],
  '/portal/employees': 'employees.view',
  '/portal/reports': 'reports.view',
  '/portal/invoices': ['invoices.view', 'billing.view'],
  '/portal/roles': 'roles.view',
  '/portal/settings': 'settings.view',
  '/portal/appointments': 'billing.view',
  '/portal/whatsapp': 'billing.view',
  '/portal/inventory': 'billing.view',
  '/portal/packages': 'billing.view',
  '/portal/expenses': 'billing.view',
};

/**
 * Determines whether a user has permission to access a specific route.
 */
export function hasRouteAccess(
  pathname: string,
  user: User | null,
  permissions: string[]
): boolean {
  if (!user || user.status?.toUpperCase() !== 'ACTIVE') return false;
  if (user.is_owner || permissions.includes('*')) return true;

  for (const [routePrefix, req] of Object.entries(ROUTE_PERMISSION_MAP)) {
    if (pathname === routePrefix || pathname.startsWith(routePrefix + '/')) {
      const perms = Array.isArray(req) ? req : [req];
      return perms.some((p) => permissions.includes(p));
    }
  }

  // Unknown portal route defaults to deny for staff
  return false;
}

/**
 * Resolves the primary landing route for a user based on their effective permissions.
 */
export function getDefaultPortalRoute(user: User | null, permissions: string[]): string {
  if (!user || user.status?.toUpperCase() !== 'ACTIVE') return '/login';
  if (user.is_owner || permissions.includes('*') || permissions.includes('dashboard.view')) {
    return '/portal/dashboard';
  }

  // Prioritized fallback based on staff operational duties
  if (permissions.includes('billing.create') || permissions.includes('billing.view')) {
    return '/portal/billing';
  }
  if (permissions.includes('customers.view')) {
    return '/portal/customers';
  }
  if (permissions.includes('services.view')) {
    return '/portal/services';
  }
  if (permissions.includes('memberships.view') || permissions.includes('memberships.manage')) {
    return '/portal/memberships';
  }
  if (permissions.includes('invoices.view')) {
    return '/portal/invoices';
  }
  if (permissions.includes('reports.view')) {
    return '/portal/reports';
  }
  if (permissions.includes('employees.view')) {
    return '/portal/employees';
  }
  if (permissions.includes('settings.view')) {
    return '/portal/settings';
  }

  return '/portal/billing';
}
