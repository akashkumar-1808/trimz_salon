'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Calendar, Clock, Plus, Search, User, Scissors, CheckCircle2, X } from 'lucide-react';

interface Appointment {
  id: string;
  clientName: string;
  clientPhone: string;
  serviceName: string;
  stylistName: string;
  timeSlot: string;
  status: 'SCHEDULED' | 'IN_SERVICE' | 'COMPLETED' | 'CANCELLED';
}

const INITIAL_APPOINTMENTS: Appointment[] = [];

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>(INITIAL_APPOINTMENTS);
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [statusFilter, setStatusFilter] = useState<'all' | 'SCHEDULED' | 'IN_SERVICE' | 'COMPLETED'>('all');
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Appointment Form
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [stylistName, setStylistName] = useState('');
  const [timeSlot, setTimeSlot] = useState('');

  const handleCreateAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !clientPhone || !serviceName || !timeSlot) return;

    const newApt: Appointment = {
      id: `apt-${Date.now()}`,
      clientName,
      clientPhone,
      serviceName,
      stylistName: stylistName || 'Unassigned',
      timeSlot,
      status: 'SCHEDULED',
    };

    setAppointments([newApt, ...appointments]);
    setIsModalOpen(false);
    setClientName('');
    setClientPhone('');
    setServiceName('');
    setStylistName('');
    setTimeSlot('');
  };

  const handleUpdateStatus = (id: string, newStatus: Appointment['status']) => {
    setAppointments(appointments.map((a) => a.id === id ? { ...a, status: newStatus } : a));
  };

  const filteredAppointments = appointments.filter((a) => {
    if (statusFilter !== 'all' && a.status !== statusFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        a.clientName.toLowerCase().includes(q) ||
        a.clientPhone.includes(q) ||
        a.serviceName.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Appointments & Salon Schedule" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ BOOKING DESK</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Appointments & Schedule</h1>
            <p className="text-sm text-text-secondary mt-1">
              Manage client appointments, stylist allocation, and daily floor reservations.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Book Appointment</span>
          </button>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Calendar className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-text-primary">Date:</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-workspace-bg border border-workspace-border rounded-xl px-3 py-1.5 text-xs text-text-primary focus:outline-none focus:border-text-primary focus:bg-white"
            />
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by client name, mobile, or service..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-workspace-bg rounded-xl border border-workspace-border shrink-0">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'all'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('SCHEDULED')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'SCHEDULED'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Scheduled
            </button>
            <button
              onClick={() => setStatusFilter('IN_SERVICE')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'IN_SERVICE'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              In Service
            </button>
            <button
              onClick={() => setStatusFilter('COMPLETED')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === 'COMPLETED'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Completed
            </button>
          </div>
        </div>

        {/* Appointments Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              <span>Floor Appointments ({filteredAppointments.length})</span>
            </h3>
          </div>

          {filteredAppointments.length === 0 ? (
            <div className="p-16 text-center text-text-muted text-sm">
              No appointments found for this selection.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                    <th className="p-4">Time</th>
                    <th className="p-4">Client</th>
                    <th className="p-4">Service</th>
                    <th className="p-4">Stylist</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-workspace-border">
                  {filteredAppointments.map((apt) => (
                    <tr key={apt.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4 font-mono font-bold text-primary flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                        <span>{apt.timeSlot}</span>
                      </td>
                      <td className="p-4">
                        <div className="font-semibold text-text-primary">{apt.clientName}</div>
                        <div className="text-text-muted font-mono text-[11px]">{apt.clientPhone}</div>
                      </td>
                      <td className="p-4 text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <Scissors className="w-3.5 h-3.5 text-text-muted" />
                          <span>{apt.serviceName}</span>
                        </span>
                      </td>
                      <td className="p-4 text-text-secondary">
                        <span className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-text-muted" />
                          <span>{apt.stylistName}</span>
                        </span>
                      </td>
                      <td className="p-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold uppercase tracking-wider ${
                            apt.status === 'COMPLETED'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : apt.status === 'IN_SERVICE'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : apt.status === 'CANCELLED'
                              ? 'bg-rose-50 text-rose-700 border border-rose-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          {apt.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {apt.status === 'SCHEDULED' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'IN_SERVICE')}
                              className="px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-200 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-all"
                            >
                              Start
                            </button>
                          )}
                          {apt.status === 'IN_SERVICE' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'COMPLETED')}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-all"
                            >
                              Complete
                            </button>
                          )}
                          {apt.status !== 'COMPLETED' && apt.status !== 'CANCELLED' && (
                            <button
                              onClick={() => handleUpdateStatus(apt.id, 'CANCELLED')}
                              className="px-2.5 py-1 rounded-lg bg-white border border-workspace-border text-rose-600 text-xs font-medium hover:bg-rose-50 transition-all"
                            >
                              Cancel
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Book Appointment Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Book New Appointment</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAppointment} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Client Full Name *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  placeholder="e.g. Ananya Sen"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Mobile Number *</label>
                <input
                  type="tel"
                  required
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Requested Service *</label>
                <input
                  type="text"
                  required
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  placeholder="e.g. Hair Cut & Beard Grooming"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Preferred Stylist</label>
                  <input
                    type="text"
                    value={stylistName}
                    onChange={(e) => setStylistName(e.target.value)}
                    placeholder="e.g. Vikram"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Time Slot *</label>
                  <input
                    type="text"
                    required
                    value={timeSlot}
                    onChange={(e) => setTimeSlot(e.target.value)}
                    placeholder="e.g. 02:30 PM"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm shadow-sm"
                >
                  Confirm Booking
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
