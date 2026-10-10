'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { DollarSign, Plus, Search, Receipt, Calendar, ArrowDownRight, X } from 'lucide-react';
import { formatCurrency, formatDate } from '@/lib/utils';

interface ExpenseItem {
  id: string;
  category: 'Salon Supplies' | 'Utilities & Rent' | 'Staff Incentive' | 'Maintenance' | 'Petty Cash';
  description: string;
  amount: number;
  paymentMode: 'Cash' | 'UPI' | 'Bank Transfer';
  date: string;
  loggedBy: string;
}

const INITIAL_EXPENSES: ExpenseItem[] = [];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Expense Form
  const [category, setCategory] = useState<ExpenseItem['category']>('Salon Supplies');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState<ExpenseItem['paymentMode']>('Cash');

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const newExp: ExpenseItem = {
      id: `exp-${Date.now()}`,
      category,
      description,
      amount: parseFloat(amount) || 0,
      paymentMode,
      date: new Date().toISOString().split('T')[0],
      loggedBy: 'Front Desk',
    };

    setExpenses([newExp, ...expenses]);
    setIsModalOpen(false);
    setDescription('');
    setAmount('');
  };

  const filteredExpenses = expenses.filter((e) => {
    if (categoryFilter !== 'all' && e.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return e.description.toLowerCase().includes(q) || e.loggedBy.toLowerCase().includes(q);
    }
    return true;
  });

  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Expenses & Petty Cash" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ OPERATIONAL OUTFLOW</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Expenses & Petty Cash</h1>
            <p className="text-sm text-text-secondary mt-1">
              Track salon utility bills, staff incentives, store supplies, and daily register expenses.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Record Outflow</span>
          </button>
        </div>

        {/* Metrics Row */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
            <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Total Outflow This Month</span>
            <h3 className="text-2xl font-bold text-primary font-mono mt-2">
              {formatCurrency(totalExpense)}
            </h3>
            <p className="text-[11px] text-text-secondary mt-1">{expenses.length} expense voucher(s)</p>
          </div>

          <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
            <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Cash Outflows</span>
            <h3 className="text-2xl font-bold text-text-primary font-mono mt-2">
              {formatCurrency(expenses.filter((e) => e.paymentMode === 'Cash').reduce((s, e) => s + e.amount, 0))}
            </h3>
            <p className="text-[11px] text-text-muted mt-1">Disbursed from drawer cash</p>
          </div>

          <div className="bg-white border border-workspace-border p-5 rounded-2xl shadow-sm">
            <span className="text-xs text-text-muted uppercase tracking-wider font-medium">Digital / Bank Transfers</span>
            <h3 className="text-2xl font-bold text-text-primary font-mono mt-2">
              {formatCurrency(expenses.filter((e) => e.paymentMode !== 'Cash').reduce((s, e) => s + e.amount, 0))}
            </h3>
            <p className="text-[11px] text-text-muted mt-1">UPI & direct payments</p>
          </div>
        </div>

        {/* Controls Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by expense description or person..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-workspace-bg/50 border border-workspace-border rounded-xl pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary focus:bg-white"
            />
          </div>

          <div className="flex items-center gap-1 p-1 bg-workspace-bg rounded-xl border border-workspace-border shrink-0">
            <button
              onClick={() => setCategoryFilter('all')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'all'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setCategoryFilter('Salon Supplies')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Salon Supplies'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Supplies
            </button>
            <button
              onClick={() => setCategoryFilter('Utilities & Rent')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Utilities & Rent'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Utilities
            </button>
            <button
              onClick={() => setCategoryFilter('Petty Cash')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Petty Cash'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Petty Cash
            </button>
          </div>
        </div>

        {/* Expenses Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              <span>Expense Vouchers & Outflows ({filteredExpenses.length})</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                  <th className="p-4">Description</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Payment Mode</th>
                  <th className="p-4">Logged By</th>
                  <th className="p-4">Date</th>
                  <th className="p-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-border">
                {filteredExpenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-workspace-hover/50 transition-colors">
                    <td className="p-4 font-semibold text-text-primary">{exp.description}</td>
                    <td className="p-4 text-xs">
                      <span className="px-2.5 py-0.5 rounded-full bg-workspace-bg border border-workspace-border text-text-secondary">
                        {exp.category}
                      </span>
                    </td>
                    <td className="p-4 text-xs font-medium text-text-secondary">{exp.paymentMode}</td>
                    <td className="p-4 text-xs text-text-muted">{exp.loggedBy}</td>
                    <td className="p-4 text-xs text-text-secondary font-mono">{exp.date}</td>
                    <td className="p-4 text-right font-mono font-bold text-primary text-sm">
                      {formatCurrency(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Record Expense Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Record Expense Outflow</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Expense Description *</label>
                <input
                  type="text"
                  required
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g. Laundry bill for salon towels"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                >
                  <option value="Salon Supplies">Salon Supplies</option>
                  <option value="Utilities & Rent">Utilities & Rent</option>
                  <option value="Staff Incentive">Staff Incentive</option>
                  <option value="Maintenance">Maintenance</option>
                  <option value="Petty Cash">Petty Cash</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="500"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Disbursed Via</label>
                  <select
                    value={paymentMode}
                    onChange={(e: any) => setPaymentMode(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                  >
                    <option value="Cash">Cash (Register)</option>
                    <option value="UPI">UPI</option>
                    <option value="Bank Transfer">Bank Transfer</option>
                  </select>
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
                  Save Voucher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
