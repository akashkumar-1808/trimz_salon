'use client';

import React, { useEffect } from 'react';
import { applyGlobalFont, getInitialFont } from '@/lib/typography';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';

export default function TypographyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  // Instant local application before render/paint to prevent layout shifts
  useEffect(() => {
    const initial = getInitialFont();
    applyGlobalFont(initial);
  }, []);

  // Synchronize authoritative font setting from salon business database
  useEffect(() => {
    if (user) {
      api.getBusinessSettings()
        .then((biz) => {
          if (biz?.font_family) {
            applyGlobalFont(biz.font_family);
          }
        })
        .catch(() => {
          // Fall back gracefully to cached or default font
        });
    }
  }, [user]);

  return <>{children}</>;
}
