'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Customer, CustomerProfile } from '@/lib/types';
import { 
  Users, 
  Search, 
  UserPlus, 
  Phone, 
  Mail, 
  Calendar, 
  CreditCard, 
  X, 
  Loader2, 
  MessageCircle, 
  Eye,
  Check
} from 'lucide-react';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // Profile Drawer
  const [selectedProfile, setSelectedProfile] = useState<CustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  // New Customer Modal
  const [isNewModalOpen, setIsNewModalOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newGender, setNewGender] = useState('all');
  const [newNotes, setNewNotes] = useState('');
  const [savingCustomer, setSavingCustomer] = useState(false);

  const fetchCustomers = async (q: string = '') => {
    setLoading(true);
    try {
      const data = await api.getCustomers(q);
      setCustomers(data);
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchCustomers(search);
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const viewCustomerProfile = async (id: string) => {
    setLoadingProfile(true);
    try {
      const profile = await api.getCustomer(id);
      setSelectedProfile(profile);
    } catch (err) {
      alert('Failed to load customer profile');
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !newPhone) {
      alert('Name and phone are required.');
      return;
    }
    setSavingCustomer(true);
    try {
      await api.createCustomer({
        name: newName,
        phone: newPhone,
        email: newEmail || undefined,
        gender: newGender,
        notes: newNotes || undefined,
      });
      setIsNewModalOpen(false);
      setNewName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
      fetchCustomers(search);
    } catch (err: any) {
      alert(`Error creating customer: ${err.message}`);
    } finally {
      setSavingCustomer(false);
    }
  };

  const openWhatsApp = (phone: string, name: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const phoneWithCountry = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const msg = `Hello ${name}! Greeting from Trimz Salon. We hope to see you again soon!`;
    window.open(`https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(msg)}`, '_blank');
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="Customer Management" />

      <div className="p-6 space-y-6 max-w-7xl mx-auto w-full">
        {/* Action Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-dark-surface p-4 rounded-2xl border border-dark-border">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by phone, name or client ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-dark-card border border-dark-border rounded-xl pl-10 pr-4 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
            />
          </div>

          <button
            onClick={() => setIsNewModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-bold text-xs transition-all shadow-md shadow-brand-500/20"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add New Client</span>
          </button>
        </div>

        {/* Customer Directory Table */}
        <div className="bg-dark-surface border border-dark-border rounded-2xl overflow-hidden shadow-xl">
          <div className="p-4 border-b border-dark-border flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Users className="w-4 h-4 text-brand-400" />
              <span>Registered Clients ({customers.length})</span>
            </h3>
          </div>

          {loading ? (
            <div className="p-16 flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-brand-400" />
              <span className="text-xs text-gray-500">Querying database...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="p-16 text-center text-gray-500 text-xs">
              No customer records found.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-dark-border bg-dark-card/40 text-gray-400 font-semibold uppercase text-[11px]">
                    <th className="p-4">Customer</th>
                    <th className="p-4">Phone & Gender</th>
                    <th className="p-4 text-center">Visits</th>
                    <th className="p-4 text-right">Lifetime Spend</th>
                    <th className="p-4">Last Visit</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-border">
                  {customers.map((c) => (
                    <tr key={c.id} className="hover:bg-dark-card/50 transition-colors">
                      <td className="p-4">
                        <div className="font-bold text-gray-100">{c.name}</div>
                        {c.email && <div className="text-gray-500 text-[11px]">{c.email}</div>}
                      </td>
                      <td className="p-4">
                        <div className="font-mono text-gray-300">{c.phone}</div>
                        <div className="text-[10px] uppercase text-gray-500">{c.gender || 'Unspecified'}</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className="px-2.5 py-1 rounded-full bg-dark-card border border-dark-border text-brand-300 font-mono font-bold">
                          {c.total_visits}
                        </span>
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-gray-200">
                        {formatCurrency(c.total_spend)}
                      </td>
                      <td className="p-4 text-gray-400">
                        {formatDate(c.last_visited_at || c.created_at)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => openWhatsApp(c.phone, c.name)}
                            className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all"
                            title="Chat on WhatsApp"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => viewCustomerProfile(c.id)}
                            className="p-1.5 rounded-lg bg-brand-500/10 text-brand-400 hover:bg-brand-500/20 transition-all"
                            title="View Customer 360"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Customer 360° Profile Drawer */}
      {selectedProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md bg-dark-surface border-l border-dark-border h-full flex flex-col shadow-2xl overflow-y-auto">
            <div className="p-5 border-b border-dark-border flex items-center justify-between bg-dark-card/50">
              <div>
                <h3 className="font-bold text-base text-white">{selectedProfile.name}</h3>
                <p className="text-xs text-brand-400 font-mono">{selectedProfile.phone}</p>
              </div>
              <button
                onClick={() => setSelectedProfile(null)}
                className="p-1 text-gray-400 hover:text-white rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-5 flex-1">
              {/* Quick Metrics */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-[10px] font-semibold uppercase text-gray-500">Lifetime Visits</span>
                  <p className="text-xl font-bold font-mono text-white mt-1">{selectedProfile.total_visits}</p>
                </div>
                <div className="p-3.5 rounded-xl bg-dark-card border border-dark-border">
                  <span className="text-[10px] font-semibold uppercase text-gray-500">Total Spend</span>
                  <p className="text-xl font-bold font-mono text-brand-300 mt-1">
                    {formatCurrency(selectedProfile.total_spend)}
                  </p>
                </div>
              </div>

              {/* Profile Details */}
              <div className="space-y-2 text-xs bg-dark-card/40 p-4 rounded-xl border border-dark-border">
                <div className="flex justify-between py-1 border-b border-dark-border/50">
                  <span className="text-gray-400">Gender</span>
                  <span className="font-semibold capitalize text-gray-200">{selectedProfile.gender || 'Not specified'}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-dark-border/50">
                  <span className="text-gray-400">Email</span>
                  <span className="text-gray-200">{selectedProfile.email || '-'}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-400">Notes / Preferences</span>
                  <span className="text-gray-300 italic">{selectedProfile.notes || 'None'}</span>
                </div>
              </div>

              {/* Recent Sales Ledger */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-300 mb-2">
                  Transaction History
                </h4>
                {selectedProfile.recent_sales.length === 0 ? (
                  <p className="text-xs text-gray-500 italic p-4 text-center">No transactions logged yet.</p>
                ) : (
                  <div className="space-y-2">
                    {selectedProfile.recent_sales.map((sale) => (
                      <div key={sale.id} className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-gray-200 font-mono">{sale.sale_number}</p>
                          <p className="text-[10px] text-gray-500">{formatDate(sale.created_at)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold font-mono text-white">{formatCurrency(sale.total_amount)}</p>
                          <span className="text-[10px] text-emerald-400 uppercase font-semibold">{sale.status}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* New Customer Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-dark-surface border border-dark-border rounded-2xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-white">Create Client Profile</h3>
              <button onClick={() => setIsNewModalOpen(false)} className="text-gray-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block text-gray-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Priya Sharma"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  required
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white font-mono"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="client@example.com"
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Gender</label>
                <select
                  value={newGender}
                  onChange={(e) => setNewGender(e.target.value)}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                >
                  <option value="all">Unspecified</option>
                  <option value="women">Women</option>
                  <option value="men">Men</option>
                  <option value="kids">Kids</option>
                </select>
              </div>

              <div>
                <label className="block text-gray-400 mb-1">Special Preferences / Notes</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Allergies, preferred hair stylist, etc."
                  rows={2}
                  className="w-full bg-dark-card border border-dark-border rounded-xl px-3 py-2 text-white"
                />
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsNewModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-dark-card text-gray-300 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCustomer}
                  className="flex-1 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-400 text-dark-bg font-bold"
                >
                  {savingCustomer ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
