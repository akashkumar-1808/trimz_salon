'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { APP_FONTS, DEFAULT_FONT_ID, applyGlobalFont, getFontDefinition } from '@/lib/typography';
import { 
  Building2, 
  User, 
  Lock, 
  Save, 
  CheckCircle2, 
  AlertCircle, 
  Loader2,
  Type,
  RotateCcw,
  Sparkles,
  Check,
  Eye,
  ShieldAlert
} from 'lucide-react';

export default function SettingsPage() {
  const { user, roles, hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<'business' | 'typography' | 'profile'>('business');

  const isAdminOrOwner = Boolean(
    user?.is_owner || 
    roles?.some((r: any) => ['owner', 'admin'].includes(String(r).toLowerCase())) ||
    hasPermission('settings.edit')
  );

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
    font_family: DEFAULT_FONT_ID,
  });
  const [loadingBusiness, setLoadingBusiness] = useState(true);
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessMsg, setBusinessMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Typography state
  const [savedFont, setSavedFont] = useState<string>(DEFAULT_FONT_ID);
  const [selectedFont, setSelectedFont] = useState<string>(DEFAULT_FONT_ID);
  const [savingFont, setSavingFont] = useState(false);
  const [fontMsg, setFontMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
          const activeFont = biz.font_family || DEFAULT_FONT_ID;
          setSavedFont(activeFont);
          setSelectedFont(activeFont);
          applyGlobalFont(activeFont);
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

  // Font Selection & Live Preview
  const handleSelectFont = (fontId: string) => {
    setSelectedFont(fontId);
    applyGlobalFont(fontId);
    setFontMsg(null);
  };

  // Save / Apply Font to Salon Database
  const handleApplyFont = async () => {
    if (!isAdminOrOwner) {
      alert('Only salon administrators and owners can update global typography.');
      return;
    }

    setSavingFont(true);
    setFontMsg(null);
    try {
      await api.updateBusinessSettings({ font_family: selectedFont });
      setSavedFont(selectedFont);
      setBusiness((prev: any) => ({ ...prev, font_family: selectedFont }));
      applyGlobalFont(selectedFont);
      setFontMsg({ 
        type: 'success', 
        text: `Global typography successfully set to "${selectedFont}". The change is active across all portal screens and devices.` 
      });
    } catch (err: any) {
      setFontMsg({ type: 'error', text: err.message || 'Failed to save font setting.' });
    } finally {
      setSavingFont(false);
    }
  };

  // Reset to Default Font
  const handleResetFont = async () => {
    handleSelectFont(DEFAULT_FONT_ID);
    if (isAdminOrOwner && savedFont !== DEFAULT_FONT_ID) {
      setSavingFont(true);
      setFontMsg(null);
      try {
        await api.updateBusinessSettings({ font_family: DEFAULT_FONT_ID });
        setSavedFont(DEFAULT_FONT_ID);
        setBusiness((prev: any) => ({ ...prev, font_family: DEFAULT_FONT_ID }));
        setFontMsg({ type: 'success', text: 'Global typography reset to default typeface (Inter).' });
      } catch (err: any) {
        setFontMsg({ type: 'error', text: err.message || 'Failed to reset font.' });
      } finally {
        setSavingFont(false);
      }
    }
  };

  // Cancel Preview
  const handleCancelPreview = () => {
    setSelectedFont(savedFont);
    applyGlobalFont(savedFont);
    setFontMsg(null);
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

  const isFontSaved = selectedFont === savedFont;
  const currentFontDef = getFontDefinition(selectedFont);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Salon & Profile Configuration" />

      <main className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ SYSTEM SETTINGS</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Settings &amp; Configuration</h1>
            <p className="text-sm text-text-secondary mt-1">
              Configure salon identity, master website typography, fiscal parameters, and operator accounts.
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-2xl border border-workspace-border shadow-xs w-fit">
          <button
            onClick={() => setActiveTab('business')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'business'
                ? 'bg-text-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
            }`}
          >
            <Building2 className="w-4 h-4" />
            <span>Salon Profile &amp; Tax</span>
          </button>

          <button
            onClick={() => setActiveTab('typography')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'typography'
                ? 'bg-[#E60023] text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
            }`}
          >
            <Type className="w-4 h-4" />
            <span>Appearance &amp; Typography</span>
          </button>

          <button
            onClick={() => setActiveTab('profile')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
              activeTab === 'profile'
                ? 'bg-text-primary text-white shadow-xs'
                : 'text-text-secondary hover:text-text-primary hover:bg-workspace-hover'
            }`}
          >
            <User className="w-4 h-4" />
            <span>My Account &amp; Security</span>
          </button>
        </div>

        {/* TAB 1: BUSINESS SETTINGS */}
        {activeTab === 'business' && (
          <div className="bg-white border border-workspace-border rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
            <div className="border-b border-workspace-border pb-4">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>Salon Identity &amp; Billing Settings</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Configure your business particulars, invoice numbering prefixes, and tax details.
              </p>
            </div>

            {businessMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm font-medium ${
                  businessMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {businessMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{businessMsg.text}</span>
              </div>
            )}

            {loadingBusiness ? (
              <div className="p-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-text-muted">Loading salon business details...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveBusiness} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Salon Trading Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.name}
                      onChange={(e) => setBusiness({ ...business, name: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Legal Entity Name
                    </label>
                    <input
                      type="text"
                      value={business.legal_name || ''}
                      onChange={(e) => setBusiness({ ...business, legal_name: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Contact Mobile / Phone *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.phone}
                      onChange={(e) => setBusiness({ ...business, phone: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Official Email Address
                    </label>
                    <input
                      type="email"
                      value={business.email || ''}
                      onChange={(e) => setBusiness({ ...business, email: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Salon Physical Address *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.address}
                      onChange={(e) => setBusiness({ ...business, address: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      City *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.city}
                      onChange={(e) => setBusiness({ ...business, city: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      State *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.state}
                      onChange={(e) => setBusiness({ ...business, state: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Postal Code / PIN *
                    </label>
                    <input
                      type="text"
                      required
                      value={business.postal_code}
                      onChange={(e) => setBusiness({ ...business, postal_code: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Tax Label Name (e.g. GST)
                    </label>
                    <input
                      type="text"
                      value={business.tax_name || 'GST'}
                      onChange={(e) => setBusiness({ ...business, tax_name: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Default GST Rate (%)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      value={business.default_tax_rate}
                      onChange={(e) => setBusiness({ ...business, default_tax_rate: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      GSTIN / Tax Registration Number
                    </label>
                    <input
                      type="text"
                      value={business.tax_registration_number || ''}
                      onChange={(e) => setBusiness({ ...business, tax_registration_number: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Invoice Prefix Code
                    </label>
                    <input
                      type="text"
                      value={business.bill_prefix || 'TZ'}
                      onChange={(e) => setBusiness({ ...business, bill_prefix: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingBusiness || !isAdminOrOwner}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingBusiness ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Save Salon Profile</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* TAB 2: APPEARANCE & TYPOGRAPHY */}
        {activeTab === 'typography' && (
          <div className="bg-white border border-workspace-border rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
            {/* Header & Description */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-workspace-border pb-5">
              <div>
                <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                  <Type className="w-5 h-5 text-[#E60023]" />
                  <span>Appearance &amp; Master Typography</span>
                </h3>
                <p className="text-xs text-text-secondary mt-1">
                  Select from 15 curated, professional typefaces to customize the entire salon application in real time.
                </p>
              </div>

              {/* Action Controls */}
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleResetFont}
                  disabled={savingFont || !isAdminOrOwner}
                  className="px-3.5 py-2 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-xs font-semibold text-[#171717] transition-all shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Restore default typeface (Inter)"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#737373]" />
                  <span>Reset to Default</span>
                </button>

                {!isFontSaved && (
                  <button
                    type="button"
                    onClick={handleCancelPreview}
                    disabled={savingFont}
                    className="px-3.5 py-2 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-xs font-semibold text-[#737373] transition-all cursor-pointer"
                  >
                    Cancel Preview
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleApplyFont}
                  disabled={savingFont || isFontSaved || !isAdminOrOwner}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs shadow-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {savingFont ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  <span>{isFontSaved ? 'Font Saved' : 'Apply & Save Font'}</span>
                </button>
              </div>
            </div>

            {/* Read-Only Notice for non-admin */}
            {!isAdminOrOwner && (
              <div className="p-3.5 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-medium flex items-center gap-2.5">
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <span>You are viewing in read-only mode. Global website typography can only be updated by the Salon Owner or Administrators.</span>
              </div>
            )}

            {/* Feedback Alerts */}
            {fontMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm font-medium ${
                  fontMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {fontMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{fontMsg.text}</span>
              </div>
            )}

            {/* Active Preview Banner */}
            <div className="p-4 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white border border-[#E8E5E3] flex items-center justify-center font-bold text-[#171717]">
                  Aa
                </div>
                <div>
                  <span className="text-[#737373]">Live Selected Typography: </span>
                  <strong className="text-[#171717] font-bold">{currentFontDef.name}</strong>
                  <span className="text-[#929292] ml-1.5 font-mono">({currentFontDef.category})</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isFontSaved ? (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-[11px] font-bold">
                    <Check className="w-3 h-3" />
                    Saved to Salon Cloud
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 text-amber-700 text-[11px] font-bold">
                    <Sparkles className="w-3 h-3 text-amber-600" />
                    Previewing (Unsaved Changes)
                  </span>
                )}
              </div>
            </div>

            {/* 15 Professional Font Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {APP_FONTS.map((font) => {
                const isSelected = selectedFont.toLowerCase() === font.id.toLowerCase();
                const isCurrentActive = savedFont.toLowerCase() === font.id.toLowerCase();

                return (
                  <div
                    key={font.id}
                    onClick={() => handleSelectFont(font.id)}
                    className={`rounded-2xl p-5 transition-all cursor-pointer relative flex flex-col justify-between text-left ${
                      isSelected
                        ? 'border-2 border-[#E60023] bg-rose-50/20 shadow-sm ring-2 ring-[#E60023]/10'
                        : 'border border-[#E8E5E3] hover:border-[#171717]/40 bg-white hover:bg-[#FDFDFD]'
                    }`}
                  >
                    <div>
                      {/* Font Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-[#F0EEEB]">
                        <div className="flex items-center gap-2">
                          <h4 
                            className="text-base font-bold text-[#171717] tracking-tight"
                            style={{ fontFamily: font.stack }}
                          >
                            {font.name}
                          </h4>
                          <span className="text-[10px] uppercase font-semibold text-[#737373] bg-[#F7F6F5] px-2 py-0.5 rounded-md border border-[#E8E5E3]">
                            {font.category}
                          </span>
                        </div>

                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#E60023] text-white flex items-center justify-center">
                            <Check className="w-3 h-3 stroke-[3]" />
                          </div>
                        )}
                      </div>

                      {/* Font Description */}
                      <p className="text-[11px] text-[#737373] mt-2 line-clamp-1">
                        {font.description}
                      </p>

                      {/* Live Sentence Preview Rendered Directly in Target Font */}
                      <div className="mt-4 p-3 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3]/80 space-y-2">
                        <p 
                          className="text-xs text-[#171717] font-medium leading-relaxed"
                          style={{ fontFamily: font.stack }}
                        >
                          {font.previewSentence}
                        </p>
                        <p 
                          className="text-[11px] text-[#737373] font-normal tracking-wide"
                          style={{ fontFamily: font.stack }}
                        >
                          Aa Bb Gg Hh • 0123456789 • ₹999
                        </p>
                      </div>
                    </div>

                    {/* Card Footer Status Indicators */}
                    <div className="mt-4 pt-2.5 border-t border-[#F0EEEB] flex items-center justify-between text-[11px]">
                      {isCurrentActive ? (
                        <span className="inline-flex items-center gap-1 font-bold text-emerald-700">
                          <Check className="w-3 h-3" />
                          <span>Active Master Font</span>
                        </span>
                      ) : isSelected ? (
                        <span className="font-bold text-[#E60023] flex items-center gap-1">
                          <Eye className="w-3 h-3" />
                          <span>Previewing Live</span>
                        </span>
                      ) : (
                        <span className="text-[#929292]">Click to preview</span>
                      )}

                      <span 
                        className="font-bold text-xs text-[#171717]"
                        style={{ fontFamily: font.stack }}
                      >
                        Sample
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: USER PROFILE */}
        {activeTab === 'profile' && (
          <div className="bg-white border border-workspace-border rounded-2xl p-6 md:p-8 shadow-xs space-y-6">
            <div className="border-b border-workspace-border pb-4">
              <h3 className="text-base font-semibold text-text-primary flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                <span>Operator Account Credentials</span>
              </h3>
              <p className="text-xs text-text-secondary mt-1">
                Update your login details, display name, and password for your authenticated account.
              </p>
            </div>

            {profileMsg && (
              <div
                className={`p-3.5 rounded-xl border flex items-center gap-3 text-sm font-medium ${
                  profileMsg.type === 'success'
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border-rose-200 text-rose-800'
                }`}
              >
                {profileMsg.type === 'success' ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                ) : (
                  <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                )}
                <span>{profileMsg.text}</span>
              </div>
            )}

            {loadingProfile ? (
              <div className="p-16 flex flex-col items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                <span className="text-xs text-text-muted">Loading account data...</span>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Full Display Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={profile.name}
                      onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Email Address (Supabase Auth ID)
                    </label>
                    <input
                      type="email"
                      value={profile.email}
                      disabled
                      className="w-full bg-workspace-bg border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-muted cursor-not-allowed font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-medium text-text-secondary block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary font-mono"
                    />
                  </div>
                </div>

                <div className="border-t border-workspace-border pt-4">
                  <h4 className="text-xs font-bold text-text-primary uppercase tracking-wider mb-4 flex items-center gap-2">
                    <Lock className="w-4 h-4 text-primary" />
                    <span>Change Account Password</span>
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-xs font-medium text-text-secondary block mb-1">
                        New Password
                      </label>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Leave blank to keep current password"
                        className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-medium text-text-secondary block mb-1">
                        Confirm New Password
                      </label>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Repeat new password"
                        className="w-full bg-white border border-workspace-border rounded-xl px-3.5 py-2.5 text-sm text-text-primary focus:outline-none focus:border-text-primary"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={savingProfile}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-xs disabled:opacity-50 cursor-pointer"
                  >
                    {savingProfile ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    <span>Update Profile</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
