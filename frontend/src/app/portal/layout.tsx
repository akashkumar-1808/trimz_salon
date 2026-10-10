'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import Sidebar from '@/components/Sidebar';
import { Loader2 } from 'lucide-react';

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

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

  return (
    <div className="min-h-screen bg-workspace-bg flex">
      {/* Dynamic RBAC Sidebar */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto bg-workspace-bg">
        {children}
      </div>
    </div>
  );
}
