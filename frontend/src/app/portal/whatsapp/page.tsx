'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { MessageSquare, Heart, Gift, Send, Search, CheckCircle2 } from 'lucide-react';

interface OccasionGuest {
  id: string;
  name: string;
  phone: string;
  occasionType: 'Birthday' | 'Anniversary' | 'Loyalty Milestone';
  message: string;
  lastVisit: string;
}

const UPCOMING_OCCASIONS: OccasionGuest[] = [];

export default function WhatsAppWishesPage() {
  const [guests, setGuests] = useState<OccasionGuest[]>(UPCOMING_OCCASIONS);
  const [sentIds, setSentIds] = useState<string[]>([]);
  const [search, setSearch] = useState('');

  const handleSendWish = (guest: OccasionGuest) => {
    const cleanPhone = guest.phone.replace(/[^0-9]/g, '');
    const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
    const encoded = encodeURIComponent(guest.message);
    const waUrl = `https://wa.me/${phoneWithCountry}?text=${encoded}`;
    window.open(waUrl, '_blank');
    if (!sentIds.includes(guest.id)) {
      setSentIds([...sentIds, guest.id]);
    }
  };

  const filteredGuests = guests.filter((g) => {
    if (search.trim()) {
      const q = search.toLowerCase();
      return g.name.toLowerCase().includes(q) || g.phone.includes(q) || g.occasionType.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="WhatsApp Greetings & Wishes" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ GUEST ENGAGEMENT</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">WhatsApp Greetings & Wishes</h1>
            <p className="text-sm text-text-secondary mt-1">
              Send personalized birthday greetings, anniversary wishes, and loyalty rewards directly via WhatsApp.
            </p>
          </div>
        </div>

        {/* Search & Info Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by client name, mobile, or occasion..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
            />
          </div>
          <span className="text-xs text-text-secondary font-mono">
            {filteredGuests.length} client occasions pending
          </span>
        </div>

        {/* Wishes Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Gift className="w-4 h-4 text-primary" />
              <span>Client Celebrations</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                  <th className="p-4">Client</th>
                  <th className="p-4">Occasion</th>
                  <th className="p-4">Prefilled WhatsApp Wish</th>
                  <th className="p-4">Last Visit</th>
                  <th className="p-4 text-right">Send Wish</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-border">
                {filteredGuests.map((guest) => {
                  const isSent = sentIds.includes(guest.id);
                  return (
                    <tr key={guest.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-text-primary">{guest.name}</div>
                        <div className="text-text-muted font-mono text-[11px]">{guest.phone}</div>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            guest.occasionType === 'Birthday'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : guest.occasionType === 'Anniversary'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-blue-50 text-blue-700 border border-blue-200'
                          }`}
                        >
                          {guest.occasionType}
                        </span>
                      </td>
                      <td className="p-4 text-xs text-text-secondary max-w-md">
                        <div className="p-2.5 rounded-xl bg-workspace-bg border border-workspace-border italic">
                          &quot;{guest.message}&quot;
                        </div>
                      </td>
                      <td className="p-4 text-xs text-text-secondary font-mono">{guest.lastVisit}</td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => handleSendWish(guest)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium inline-flex items-center gap-1.5 transition-all shadow-sm ${
                            isSent
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
                              : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                          }`}
                        >
                          {isSent ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Sent</span>
                            </>
                          ) : (
                            <>
                              <Send className="w-3.5 h-3.5" />
                              <span>Open WhatsApp</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
