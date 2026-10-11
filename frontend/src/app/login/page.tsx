'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { api } from '@/lib/api';
import {
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  UserCheck,
  AlertCircle,
  Loader2,
  UserPlus,
  Phone,
  User,
  Clock,
  CheckCircle2,
} from 'lucide-react';

export default function LoginPage() {
  const { user, loading, hasPermission, login } = useAuth();
  const router = useRouter();

  // Tab: 'owner' | 'staff'
  const [activeTab, setActiveTab] = useState<'owner' | 'staff'>('owner');
  // Staff mode: 'signin' | 'register'
  const [staffMode, setStaffMode] = useState<'signin' | 'register'>('signin');

  // Sign in state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regSuccess, setRegSuccess] = useState(false);

  // Authenticated users visiting /login are redirected to portal
  useEffect(() => {
    if (!loading && user) {
      if (user.is_owner || hasPermission('dashboard.view') || hasPermission('*')) {
        router.replace('/portal/dashboard');
      } else if (hasPermission('billing.view') || hasPermission('billing.create')) {
        router.replace('/portal/billing');
      } else {
        router.replace('/portal/dashboard');
      }
    }
  }, [user, loading, router, hasPermission]);

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regName || !regEmail || !regPassword) {
      setError('Please provide your name, email, and password.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setError(null);
    setSubmitting(true);

    try {
      await api.registerStaff({
        name: regName,
        email: regEmail,
        phone: regPhone || undefined,
        password: regPassword,
      });
      setRegSuccess(true);
      setRegName('');
      setRegEmail('');
      setRegPhone('');
      setRegPassword('');
      setRegConfirmPassword('');
    } catch (err: any) {
      setError(err.message || 'Staff registration failed. Please check your details.');
    } finally {
      setSubmitting(false);
    }
  };

  // Wait for authentication initialization before showing form or redirecting
  if (loading || user) {
    return (
      <div className="min-h-screen bg-workspace-bg flex flex-col items-center justify-center">
        <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white font-serif font-black text-2xl mb-4 shadow-md shadow-primary/20 animate-pulse">
          T.
        </div>
        <div className="flex items-center gap-2 text-text-secondary text-sm font-medium">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span>{loading ? 'Verifying session...' : 'Redirecting to portal...'}</span>
        </div>
      </div>
    );
  }

  const isPendingError = error && error.toLowerCase().includes('pending');

  return (
    <div className="min-h-screen bg-workspace-bg flex flex-col items-center justify-center p-4 relative overflow-hidden">
      {/* Main Container */}
      <div className="w-full max-w-md z-10">
        {/* Brand Header */}
        <div className="text-center mb-6">
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

        {/* Account Type Selector Tabs */}
        <div className="bg-white/80 p-1.5 rounded-2xl border border-workspace-border mb-4 flex gap-1.5 shadow-xs backdrop-blur-xs">
          <button
            type="button"
            onClick={() => {
              setActiveTab('owner');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'owner'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-workspace-bg'
            }`}
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Owner Login</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('staff');
              setError(null);
            }}
            className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
              activeTab === 'staff'
                ? 'bg-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-workspace-bg'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Staff Login</span>
          </button>
        </div>

        {/* Card */}
        <div className="bg-white border border-workspace-border rounded-2xl p-7 md:p-8 shadow-sm">
          {/* Error Alert */}
          {error && (
            <div
              className={`mb-5 p-3.5 rounded-xl border flex items-start gap-3 text-xs font-medium ${
                isPendingError
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-rose-50 border-rose-200 text-rose-700'
              }`}
            >
              {isPendingError ? (
                <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              )}
              <div className="space-y-0.5">
                <span className="font-semibold block">
                  {isPendingError ? 'Approval Pending' : 'Authentication Notice'}
                </span>
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Registration Success Screen */}
          {activeTab === 'staff' && regSuccess ? (
            <div className="text-center py-4 space-y-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-base text-text-primary">Staff Account Registered!</h3>
                <p className="text-xs text-text-secondary mt-1.5 leading-relaxed">
                  Your registration request has been submitted. For salon security, all staff accounts must be approved and granted operational permissions by the salon owner before accessing the system.
                </p>
              </div>
              <div className="p-3 bg-workspace-bg rounded-xl border border-workspace-border text-[11px] text-text-muted">
                Please notify your salon administrator to activate your account in their Staff Management portal.
              </div>
              <button
                type="button"
                onClick={() => {
                  setRegSuccess(false);
                  setStaffMode('signin');
                  setError(null);
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary-hover transition-all"
              >
                Back to Staff Sign In
              </button>
            </div>
          ) : activeTab === 'staff' && staffMode === 'register' ? (
            /* Staff Registration Form */
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-text-primary">Create Staff Account</h2>
                  <p className="text-xs text-text-secondary">Register for team access at Trimz Salon</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setStaffMode('signin');
                    setError(null);
                  }}
                  className="text-xs text-primary font-semibold hover:underline"
                >
                  Sign In Instead
                </button>
              </div>

              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Full Name *
                  </label>
                  <div className="relative">
                    <User className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rahul Sharma"
                      required
                      className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={regEmail}
                      onChange={(e) => setRegEmail(e.target.value)}
                      placeholder="rahul@trimzsalon.com"
                      required
                      className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="tel"
                      value={regPhone}
                      onChange={(e) => setRegPhone(e.target.value)}
                      placeholder="9876543210"
                      className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="At least 6 characters"
                      required
                      className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-text-secondary uppercase tracking-wider mb-1">
                    Confirm Password *
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      value={regConfirmPassword}
                      onChange={(e) => setRegConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      required
                      className="w-full bg-white border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary transition-all"
                    />
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin text-white" />
                        <span>Submitting Request...</span>
                      </>
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4" />
                        <span>Request Staff Account</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          ) : (
            /* Standard Login Form (Owner or Staff) */
            <div>
              <div className="mb-5 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-base text-text-primary">
                    {activeTab === 'owner' ? 'Owner Portal Login' : 'Staff Member Login'}
                  </h2>
                  <p className="text-xs text-text-secondary">
                    {activeTab === 'owner'
                      ? 'Access full management and owner controls'
                      : 'Sign in with your assigned staff credentials'}
                  </p>
                </div>

                {activeTab === 'staff' && (
                  <button
                    type="button"
                    onClick={() => {
                      setStaffMode('register');
                      setError(null);
                    }}
                    className="text-xs text-primary font-semibold hover:underline"
                  >
                    Register
                  </button>
                )}
              </div>

              <form onSubmit={handleLoginSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-text-secondary uppercase tracking-wider mb-1.5">
                    {activeTab === 'owner' ? 'Owner Email' : 'Staff Email'}
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder={
                        activeTab === 'owner'
                          ? 'owner@trimzsalon.com'
                          : 'staff@trimzsalon.com'
                      }
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
                  disabled={submitting}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Authenticating...</span>
                    </>
                  ) : (
                    <>
                      <span>{activeTab === 'owner' ? 'Sign In as Owner' : 'Sign In as Staff'}</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>

              {/* Staff registration prompt if on Staff tab */}
              {activeTab === 'staff' && (
                <div className="mt-4 text-center">
                  <p className="text-xs text-text-secondary">
                    New staff member?{' '}
                    <button
                      type="button"
                      onClick={() => {
                        setStaffMode('register');
                        setError(null);
                      }}
                      className="text-primary font-semibold hover:underline"
                    >
                      Create Staff Account
                    </button>
                  </p>
                </div>
              )}

              {/* Owner Quick Select Accounts */}
              {activeTab === 'owner' && (
                <div className="mt-6 pt-5 border-t border-workspace-border">
                  <p className="text-[11px] font-semibold tracking-wider text-text-muted uppercase text-center mb-3">
                    Owner Quick Select
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        setEmail('trimzunisexsalonspt@gmail.com');
                        setPassword('');
                      }}
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
                      onClick={() => {
                        setEmail('owner@trimzsalon.com');
                        setPassword('');
                      }}
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
              )}
            </div>
          )}
        </div>

        {/* Security Notice */}
        <p className="text-center text-xs text-text-muted mt-6">
          Protected by Supabase Auth & Multi-Layer RBAC
        </p>
      </div>
    </div>
  );
}
