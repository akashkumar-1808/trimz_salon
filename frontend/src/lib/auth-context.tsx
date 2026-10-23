'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from './supabase';
import { api } from './api';
import { User } from './types';

interface AuthContextType {
  user: User | null;
  roles: string[];
  permissions: string[];
  loading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  refreshPermissions: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

import { getDefaultPortalRoute } from './rbac';
export { getDefaultPortalRoute };

interface AuthContextType {
  user: User | null;
  roles: string[];
  permissions: string[];
  loading: boolean;
  hasPermission: (permissionCode: string) => boolean;
  refreshPermissions: () => Promise<void>;
  login: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const router = useRouter();

  // Initialize and validate session once on mount
  useEffect(() => {
    let mounted = true;

    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.access_token) {
          api.setToken(session.access_token);
          const freshData = await api.getMe();
          if (mounted) {
            setUser(freshData.user);
            setRoles(freshData.roles || (freshData.user?.roles?.map((r: any) => r.name) || []));
            setPermissions(freshData.permissions || []);
          }
        } else {
          // Check if fallback token exists in local storage
          const localToken = localStorage.getItem('trimz_token');
          if (localToken) {
            try {
              const freshData = await api.getMe();
              if (mounted) {
                setUser(freshData.user);
                setRoles(freshData.roles || (freshData.user?.roles?.map((r: any) => r.name) || []));
                setPermissions(freshData.permissions || []);
              }
            } catch {
              api.clearToken();
            }
          }
        }
      } catch (e) {
        console.warn('Session verification failed:', e);
        api.clearToken();
        if (mounted) {
          setUser(null);
          setRoles([]);
          setPermissions([]);
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initAuth();

    // Re-validate permissions when user switches back to the application window
    const handleFocus = () => {
      if (document.visibilityState === 'visible' && mounted) {
        const token = localStorage.getItem('trimz_token');
        if (token) {
          api.getMe().then((freshData) => {
            if (mounted && freshData?.user) {
              setUser(freshData.user);
              setRoles(freshData.roles || (freshData.user?.roles?.map((r: any) => r.name) || []));
              setPermissions(freshData.permissions || []);
            }
          }).catch(() => {});
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleFocus);

    // Listen to Supabase Auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT' || !session) {
        api.clearToken();
        if (mounted) {
          setUser(null);
          setRoles([]);
          setPermissions([]);
        }
      } else if (session?.access_token) {
        api.setToken(session.access_token);
      }
    });

    return () => {
      mounted = false;
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
      subscription.unsubscribe();
    };
  }, []);

  const hasPermission = (permissionCode: string): boolean => {
    if (!user || user.status?.toUpperCase() !== 'ACTIVE') return false;
    if (user.is_owner) return true;
    if (permissions.includes('*')) return true;
    return permissions.includes(permissionCode);
  };

  const refreshPermissions = async () => {
    try {
      const freshData = await api.getMe();
      if (!freshData?.user) return;
      setUser(freshData.user);
      const resolvedRoles = freshData.roles || (freshData.user?.roles?.map((r: any) => r.name) || []);
      const resolvedPerms = freshData.permissions || [];
      setRoles(resolvedRoles);
      setPermissions(resolvedPerms);
      if (typeof window !== 'undefined') {
        localStorage.setItem('trimz_user', JSON.stringify(freshData.user));
        localStorage.setItem('trimz_roles', JSON.stringify(resolvedRoles));
        localStorage.setItem('trimz_permissions', JSON.stringify(resolvedPerms));
      }
    } catch (e) {
      console.warn('Failed to refresh permissions:', e);
    }
  };

  const login = async (email: string, pass: string) => {
    // 1. Authenticate with Supabase Auth using publishable anon key
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: pass,
    });

    if (error) {
      // Fallback: try FastAPI login endpoint
      try {
        const fallbackRes = await api.login({ email, password: pass });
        api.setToken(fallbackRes.access_token);
        setUser(fallbackRes.user);
        const resolvedRoles = fallbackRes.roles || (fallbackRes.user?.roles?.map((r: any) => r.name) || []);
        const resolvedPerms = fallbackRes.permissions || [];
        setRoles(resolvedRoles);
        setPermissions(resolvedPerms);
        
        router.push(getDefaultPortalRoute(fallbackRes.user, resolvedPerms));
        return;
      } catch {
        throw new Error(error.message || 'Invalid email or password');
      }
    }

    if (!data.session?.access_token) {
      throw new Error('No session returned from Supabase Auth');
    }

    // 2. Set verified token and retrieve application profile & permissions from backend
    api.setToken(data.session.access_token);
    const meData = await api.getMe();

    setUser(meData.user);
    const resolvedRoles = meData.roles || (meData.user?.roles?.map((r: any) => r.name) || []);
    const resolvedPerms = meData.permissions || [];
    setRoles(resolvedRoles);
    setPermissions(resolvedPerms);

    localStorage.setItem('trimz_user', JSON.stringify(meData.user));
    localStorage.setItem('trimz_roles', JSON.stringify(resolvedRoles));
    localStorage.setItem('trimz_permissions', JSON.stringify(resolvedPerms));

    // 3. Smart routing based on verified database permissions
    router.push(getDefaultPortalRoute(meData.user, resolvedPerms));
  };

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch {
      // Ignore network errors during signout
    }
    api.clearToken();
    if (typeof window !== 'undefined') {
      localStorage.removeItem('trimz_token');
      localStorage.removeItem('trimz_user');
      localStorage.removeItem('trimz_roles');
      localStorage.removeItem('trimz_permissions');
    }
    setUser(null);
    setRoles([]);
    setPermissions([]);
    router.replace('/login');
  };

  return (
    <AuthContext.Provider value={{ user, roles, permissions, loading, hasPermission, refreshPermissions, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
