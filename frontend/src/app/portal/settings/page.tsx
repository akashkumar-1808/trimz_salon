'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { 
  Settings, 
  Building2, 
  User, 
  Lock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  ShieldCheck,
  Receipt
} from 'lucide-react';

export default function SettingsPage() {
  const { user, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'business' | 'profile'>('business');

  // Business settings state
  const [business, setBusiness] = useState<any>({
    name: '',
    legal_name: '',
    phone: '',
    email: '',
    address: '',
    city: '',
    state: '',
    postal_code: '',
    country: 'IN',
    tax_name: 'GST',
    default_tax_rate: 5.0,
    tax_registration_number: '',
    currency: 'INR',
    currency_symbol: '₹',
    bill_prefix: 'TZ',
  });
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessMsg, setBusinessMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Profile settings state
  const [profile, setProfile] = useState<any>({
    name: '',
    phone: '',
    email: '',
  });
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Fetch initial business & profile data
  useEffect(() => {
    const loadData = async () => {
      try {
        if (hasPermission('settings.view')) {
          const biz = await api.getBusinessSettings();
          setBusiness(biz);
        }
      } catch (err) {
        console.error('Failed to load business settings:', err);
      } finally {
        setLoadingBusiness(false);
      }

      try {
        const prof = await api.getMyProfile();
        setProfile({
          name: prof.name || '',
          phone: prof.phone || '',
          email: prof.email || '',
        });
      } catch (err) {
        console.error('Failed to load profile:', err);
      } finally {
        setLoadingProfile(false);
      }
    };

    loadData();
  }, []);

  // Save Business Settings
  const handleSaveBusiness = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingBusiness(true);
    setBusinessMsg(null);
    try {
      const payload = {
        name: business.name,
        legal_name: business.legal_name,
        phone: business.phone,
        email: business.email,
        address: business.address,
        city: business.city,
        state: business.state,
        postal_code: business.postal_code,
        country: business.country,
        tax_name: business.tax_name,
        default_tax_rate: Number(business.default_tax_rate),
        tax_registration_number: business.tax_registration_number,
        currency: business.currency,
        currency_symbol: business.currency_symbol,
        bill_prefix: business.bill_prefix,
      };
      const updated = await api.updateBusinessSettings(payload);
      setBusiness(updated);
      setBusinessMsg({ type: 'success', text: 'Salon profile updated successfully.' });
    } catch (err: any) {
      setBusinessMsg({ type: 'error', text: err.message || 'Failed to update settings.' });
    } finally {
      setSavingBusiness(false);
    }
  };

  // Save Profile Settings
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    if (newPassword && newPassword !== confirmPassword) {
      setProfileMsg({ type: 'error', text: 'Passwords do not match.' });
      setSavingProfile(false);
      return;
    }

    try {
      const payload: any = {
        name: profile.name,
        phone: profile.phone,
      };
      if (newPassword) {
        payload.password = newPassword;
      }
      const updated = await api.updateMyProfile(payload);
      setProfile({
        name: updated.name || '',
        phone: updated.phone || '',
        email: updated.email || '',
      });
      setNewPassword('');
      setConfirmPassword('');
      setProfileMsg({ type: 'success', text: 'User profile updated successfully.' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Failed to update profile.' });
    } finally {
      setSavingProfile(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Salon & Profile Configuration" />

      <div className="p-6 space-y-6 max-w-5xl mx-auto w-full">
        {/* Navigation Tabs */}
        <div className="flex gap-2 bg-dark-surface p-2 rounded-2xl border border-dark-border w-fit">
          <button
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'business'
                ? 'bg-brand-500 text-dark-bg shadow-md shadow-brand-500/20'
                : 'text-gray-400 hover:text-white hover:bg-dark-card'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Salon Profile & Tax</span>
          </button>
          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
              activeTab === 'profile'
                ? 'bg-brand-500 text-dark-bg shadow-md shadow-brand-500/20'
                : 'text-gray-400 hover:text-white hover:bg-dark-card'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Account & Security</span>
          </button>
        </div>

        {/* BUSINESS SETTINGS */}
        {activeTab === 'business' && (
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-dark-border pb-4">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-400" />
                <span>Salon Identity & Billing Settings</span>
              </h3>
              <p className="text-xs text-gray-400 mt-1">
                Configure your business particulars, invoice numbering prefixes, and tax details.
              </p>
            </div>

            {businessMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                  businessMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {businessMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{businessMsg.text}</span>
              </div>
            )}

            {loadingBusiness ? (
              <div className="p-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              </div>
            ) : (
              <form onSubmit={handleSaveBusiness} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Salon Display Name
                    </label>
                    <input
                      type="text"
                      value={business.name}
                      onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Legal Registered Entity Name
                    </label>
                    <input
                      type="text"
                      value={business.legal_name || ''}
                      onChange={(e) => setBusiness({ ...business, legal_name: e.target.value })}
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Contact Phone
                    </label>
                    <input
                      type="text"
                      value={business.phone}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Contact Email
                    </label>
                    <input
                      type="email"
                      value={business.email || ''}
                      onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Street Address
                    </label>
                    <input
                      type="text"
                      value={business.address}
                      onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">City</label>
                    <input
                      type="text"
                      value={business.city}
                      onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">State</label>
                    <input
                      type="text"
                      value={business.state}
                      onChange={(e) => setBusiness({ ...business, state: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Postal Code</label>
                    <input
                      type="text"
                      value={business.postal_code}
                      onChange={(e) => setBusiness({ ...business, postal_code: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">Country</label>
                    <input
                      type="text"
                      value={business.country}
                      onChange={(e) => setBusiness({ ...business, country: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="border-t border-dark-border pt-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-brand-400" />
                    <span>Invoicing & Tax Credentials</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Tax Name (e.g. GST)
                      </label>
                      <input
                        type="text"
                        value={business.tax_name}
                        onChange={(e) => setBusiness({ ...business, tax_name: e.target.value })}
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Default Tax Rate (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={business.default_tax_rate}
                        onChange={(e) => setBusiness({ ...business, default_tax_rate: e.target.value })}
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        GSTIN / Tax Registration
                      </label>
                      <input
                        type="text"
                        value={business.tax_registration_number || ''}
                        onChange={(e) => setBusiness({ ...business, tax_registration_number: e.target.value })}
                        placeholder="29AAAAA0000A1Z5"
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Bill / Sale Prefix
                      </label>
                      <input
                        type="text"
                        value={business.bill_prefix}
                        onChange={(e) => setBusiness({ ...business, bill_prefix: e.target.value })}
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Currency Code
                      </label>
                      <input
                        type="text"
                        value={business.currency}
                        onChange={(e) => setBusiness({ ...business, currency: e.target.value })}
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Currency Symbol
                      </label>
                      <input
                        type="text"
                        value={business.currency_symbol}
                        onChange={(e) => setBusiness({ ...business, currency_symbol: e.target.value })}
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {hasPermission('settings.edit') && (
                  <div className="flex justify-end pt-2">
                    <button
                      type="submit"
                      disabled={savingBusiness}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
                    >
                      {savingBusiness ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      <span>Save Business Profile</span>
                    </button>
                  </div>
                )}
              </form>
            )}
          </div>
        )}

        {/* PROFILE SETTINGS */}
        {activeTab === 'profile' && (
          <div className="bg-dark-surface border border-dark-border rounded-2xl p-6 shadow-xl space-y-6">
            <div className="border-b border-dark-border pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <User className="w-5 h-5 text-brand-400" />
                  <span>My Account Profile</span>
                </h3>
                <p className="text-xs text-gray-400 mt-1">
                  Manage your personal user details and Supabase Auth credentials.
                </p>
              </div>
              <span className="px-3 py-1 rounded-full bg-brand-500/10 border border-brand-500/20 text-brand-400 font-mono text-xs font-bold">
                {user?.is_owner ? 'Main Owner' : 'Team Member'}
              </span>
            </div>

            {profileMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-xs ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}
              >
                {profileMsg.type === 'success' ? (
                  <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            {loadingProfile ? (
              <div className="p-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Full Name
                    </label>
                    <input
                      type="text"
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      required
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Email Address (Supabase Auth ID)
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full bg-dark-card/50 border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-gray-400 cursor-not-allowed font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-300 block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                    />
                  </div>
                </div>

                <div className="border-t border-dark-border pt-4">
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-brand-400" />
                    <span>Change Account Password</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-gray-300 block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full bg-dark-card border border-dark-border rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-brand-500"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20 disabled:opacity-50"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Update Profile</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
