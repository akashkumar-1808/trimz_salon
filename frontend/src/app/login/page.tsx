'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/auth-context';
import { Scissors, Lock, Mail, ArrowRight, ShieldCheck, UserCheck, AlertCircle, Loader2 } from 'lucide-react';

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

  const fillCredentials = (userEmail: string, userPass: string) => {
    setEmail(userEmail);
    setPassword(userPass);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-dark-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-brand-400/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl bg-gradient-to-br from-brand-400 via-brand-500 to-brand-600 items-center justify-center shadow-xl shadow-brand-500/20 mb-3">
            <Scissors className="w-7 h-7 text-dark-bg rotate-45" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-brand-200 via-brand-400 to-amber-200 bg-clip-text text-transparent">
            TRIMZ SALON
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Operations & Business Management Terminal
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-dark-surface/90 border border-dark-border rounded-2xl p-7 shadow-2xl backdrop-blur-md">
          {error && (
            <div className="mb-5 p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Work Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@trimzsalon.com"
                  required
                  className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                  className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-sm tracking-wide transition-all shadow-lg shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-dark-bg" />
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
          <div className="mt-6 pt-5 border-t border-dark-border">
            <p className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase text-center mb-3">
              Quick Select Account
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => { setEmail('trimzunisexsalonspt@gmail.com'); setPassword(''); }}
                className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-brand-400 font-semibold text-xs group-hover:text-brand-300">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Salon Owner</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-mono truncate">
                  trimzunisexsalonspt@gmail.com
                </div>
              </button>

              <button
                type="button"
                onClick={() => { setEmail('owner@trimzsalon.com'); setPassword(''); }}
                className="p-2.5 rounded-xl bg-dark-card border border-dark-border hover:border-brand-500/40 text-left transition-all group"
              >
                <div className="flex items-center gap-1.5 text-emerald-400 font-semibold text-xs group-hover:text-emerald-300">
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>Admin Owner</span>
                </div>
                <div className="text-[10px] text-gray-500 mt-1 font-mono truncate">
                  owner@trimzsalon.com
                </div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-gray-500 mt-6">
          Protected by Supabase Auth & Multi-Layer RBAC
        </p>
      </div>
    </div>
  );
}
