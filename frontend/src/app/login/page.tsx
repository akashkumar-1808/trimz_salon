'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-workspace-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-12 h-12 rounded-xl bg-primary items-center justify-center shadow-md shadow-primary/20 mb-3">
            <span className="font-serif font-black text-white text-2xl tracking-tighter">T.</span>
          </div>
          <h1 className="font-serif text-3xl font-bold tracking-tight text-text-primary">
            TRIMZ UNISEX SALON
          </h1>
          <p className="text-sm text-text-secondary mt-1">
            Operations & Salon Management Terminal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white border border-workspace-border rounded-2xl p-7 md:p-8 shadow-sm">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-700 text-xs font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@trimzsalon.com"
                  required
                  className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to Terminal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          {/* Quick Account Fill */}
          <div className="mt-6 pt-5 border-t border-workspace-border">
            <p className="text-[11px] font-semibold tracking-wider text-text-muted uppercase text-center mb-3">
              Quick Select Account
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { setEmail('trimzunisexsalonspt@gmail.com'); setPassword(''); }}
                className="p-2.5 rounded-xl bg-workspace-bg border border-workspace-border hover:border-text-primary text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-text-primary font-semibold text-xs">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span>Salon Owner</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1 font-mono truncate">
                  trimzunisexsalonspt@gmail.com
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setEmail('owner@trimzsalon.com'); setPassword(''); }}
                className="p-2.5 rounded-xl bg-workspace-bg border border-workspace-border hover:border-text-primary text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-text-primary font-semibold text-xs">
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Admin Owner</span>
                </div>
                <div className="text-[10px] text-text-muted mt-1 font-mono truncate">
                  owner@trimzsalon.com
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-text-muted mt-6">
          Protected by Supabase Auth & Multi-Layer RBAC
        </p>
      </div>
    </div>
  );
}
