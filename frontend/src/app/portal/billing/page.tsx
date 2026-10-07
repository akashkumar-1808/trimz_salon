'use client';

import React, { useState, useEffect } from 'react';
import Topbar from '@/components/Topbar';
import ReceiptModal from '@/components/ReceiptModal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Service, ServiceCategory, Customer, CartItem, PaymentItem } from '@/lib/types';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  UserPlus, 
  CreditCard, 
  Smartphone, 
  Banknote, 
  Clock, 
  Scissors, 
  CheckCircle, 
  X, 
  Loader2,
  Sparkles,
  Percent
} from 'lucide-react';

export default function BillingPosPage() {
  // Service selection state
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedGender, setSelectedGender] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingServices, setLoadingServices] = useState(true);

  // Cart & checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [taxRate, setTaxRate] = useState<number>(0); // 0% or 18% GST
  const [notes, setNotes] = useState('');

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerGender, setNewCustomerGender] = useState('all');

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi' | 'card'>('upi');
  const [upiProvider, setUpiProvider] = useState<'google_pay' | 'phonepe' | 'paytm' | 'other'>('google_pay');

  // Checkout process & modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Load initial categories and services
  useEffect(() => {
    const loadCatalog = async () => {
      setLoadingServices(true);
      try {
        const [cats, svcs] = await Promise.all([
          api.getCategories(),
          api.getServices(),
        ]);
        setCategories(cats);
        setServices(svcs);
      } catch (err) {
        console.error('Catalog load failure:', err);
      } finally {
        setLoadingServices(false);
      }
    };
    loadCatalog();
  }, []);

  // Customer live lookup
  useEffect(() => {
    if (!customerSearch.trim() || selectedCustomer) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getCustomers(customerSearch);
        setCustomerResults(res);
      } catch (err) {
        console.error('Customer lookup error:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerSearch, selectedCustomer]);

  // Filtered services
  const filteredServices = services.filter((svc) => {
    if (selectedCategory !== 'all' && svc.category_id !== selectedCategory) return false;
    if (selectedGender !== 'all' && svc.target_gender !== 'all' && svc.target_gender !== selectedGender) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return svc.name.toLowerCase().includes(q) || (svc.category_name && svc.category_name.toLowerCase().includes(q));
    }
    return true;
  });

  // Cart operations
  const addToCart = (svc: Service) => {
    setCart((prev) => {
      const existing = prev.find((item) => item.service.id === svc.id);
      if (existing) {
        return prev.map((item) =>
          item.service.id === svc.id ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { service: svc, quantity: 1, unit_price: svc.price, discount_amount: 0 }];
    });
  };

  const updateQuantity = (svcId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.service.id === svcId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (svcId: string) => {
    setCart((prev) => prev.filter((item) => item.service.id !== svcId));
  };

  const clearCart = () => {
    setCart([]);
    setSelectedCustomer(null);
    setCustomerSearch('');
    setIsCreatingCustomer(false);
    setNewCustomerName('');
    setNewCustomerPhone('');
    setDiscountAmount(0);
    setNotes('');
  };

  // Calculations
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = (taxableAmount * taxRate) / 100;
  const grandTotal = Math.round(taxableAmount + taxAmount);

  // Complete Checkout
  const handleCheckout = async () => {
    if (cart.length === 0) {
      alert('Please add at least one service to the cart.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payments: PaymentItem[] = [
        {
          method: paymentMethod,
          provider: paymentMethod === 'upi' ? upiProvider : undefined,
          amount: grandTotal,
        },
      ];

      const payload = {
        customer_id: selectedCustomer?.id || undefined,
        new_customer: isCreatingCustomer && newCustomerName && newCustomerPhone ? {
          name: newCustomerName,
          phone: newCustomerPhone,
          gender: newCustomerGender,
        } : undefined,
        discount_amount: discountAmount,
        tax_rate_percent: taxRate,
        payments,
        items: cart.map((item) => ({
          service_id: item.service.id,
          quantity: item.quantity,
          unit_price: item.unit_price,
          discount_amount: item.discount_amount,
        })),
        notes: notes || undefined,
      };

      const result = await api.createSale(payload);
      
      // Load full receipt for printing
      if (result.invoice_id) {
        const receipt = await api.getInvoiceReceipt(result.invoice_id);
        setCompletedReceipt(receipt);
        setIsReceiptOpen(true);
      }

      clearCart();
    } catch (err: any) {
      alert(`Checkout failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <Topbar title="POS Terminal & Billing" />

      {/* Main 2-Pane Terminal */}
      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Left Pane: Service Catalog Selector */}
        <div className="flex-1 flex flex-col border-r border-dark-border bg-dark-bg/60 p-5 space-y-4 overflow-y-auto">
          {/* Search & Gender filter bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-gray-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search services or haircuts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-dark-surface border border-dark-border rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-brand-500 transition-all"
              />
            </div>

            {/* Gender Audience Pills */}
            <div className="flex bg-dark-surface p-1 rounded-xl border border-dark-border">
              {['all', 'men', 'women', 'kids'].map((g) => (
                <button
                  key={g}
                  onClick={() => setSelectedGender(g)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                    selectedGender === g
                      ? 'bg-brand-500 text-dark-bg shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              onClick={() => setSelectedCategory('all')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                selectedCategory === 'all'
                  ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                  : 'bg-dark-surface text-gray-400 border border-dark-border hover:text-white'
              }`}
            >
              All Services ({services.length})
            </button>
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === c.id
                    ? 'bg-brand-500/20 text-brand-300 border border-brand-500/40'
                    : 'bg-dark-surface text-gray-400 border border-dark-border hover:text-white'
                }`}
              >
                {c.name}
              </button>
            ))}
          </div>

          {/* Service Cards Grid */}
          {loadingServices ? (
            <div className="h-64 flex items-center justify-center">
              <Loader2 className="w-8 h-8 animate-spin text-brand-400" />
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="p-12 text-center text-gray-500 text-xs">
              No services found matching the criteria.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredServices.map((svc) => (
                <div
                  key={svc.id}
                  onClick={() => addToCart(svc)}
                  className="p-4 rounded-xl bg-dark-surface border border-dark-border hover:border-brand-500/50 hover:bg-dark-card/60 transition-all cursor-pointer group flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2">
                      <h4 className="font-semibold text-sm text-gray-100 group-hover:text-brand-300 transition-colors">
                        {svc.name}
                      </h4>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-dark-bg border border-dark-border text-gray-400 uppercase">
                        {svc.target_gender}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-1">
                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                      <span>{svc.duration_minutes} mins</span>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-dark-border flex items-center justify-between">
                    <span className="text-sm font-bold font-mono text-white">
                      {formatCurrency(svc.price)}
                    </span>
                    <button
                      type="button"
                      className="px-2.5 py-1 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/30 text-xs font-semibold group-hover:bg-brand-500 group-hover:text-dark-bg transition-all flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right Pane: Cart & Checkout Bill */}
        <div className="w-full lg:w-96 xl:w-[420px] bg-dark-surface border-l border-dark-border flex flex-col h-full overflow-hidden">
          {/* Customer Selection Header */}
          <div className="p-4 border-b border-dark-border bg-dark-card/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                Customer Details
              </span>
              {!isCreatingCustomer && !selectedCustomer && (
                <button
                  onClick={() => setIsCreatingCustomer(true)}
                  className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center gap-1"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>+ New Guest</span>
                </button>
              )}
            </div>

            {selectedCustomer ? (
              <div className="p-2.5 rounded-xl bg-dark-bg border border-brand-500/40 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-brand-300">{selectedCustomer.name}</p>
                  <p className="text-[11px] font-mono text-gray-400">{selectedCustomer.phone}</p>
                </div>
                <button
                  onClick={() => setSelectedCustomer(null)}
                  className="text-gray-500 hover:text-red-400 p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : isCreatingCustomer ? (
              <div className="space-y-2 p-2.5 bg-dark-bg rounded-xl border border-dark-border">
                <div className="flex justify-between items-center">
                  <span className="text-[11px] font-semibold text-gray-400 uppercase">Walk-in Profile</span>
                  <button onClick={() => setIsCreatingCustomer(false)} className="text-gray-500 hover:text-gray-300 text-xs">
                    Cancel
                  </button>
                </div>
                <input
                  type="text"
                  placeholder="Full Name"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-white"
                />
                <input
                  type="tel"
                  placeholder="10-digit Phone"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  className="w-full bg-dark-surface border border-dark-border rounded-lg px-2.5 py-1.5 text-xs text-white font-mono"
                />
              </div>
            ) : (
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search existing customer by phone or name..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-dark-bg border border-dark-border rounded-xl px-3 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-brand-500"
                />
                {customerResults.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-dark-surface border border-dark-border rounded-xl shadow-2xl max-h-48 overflow-y-auto z-30 divide-y divide-dark-border">
                    {customerResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerSearch('');
                          setCustomerResults([]);
                        }}
                        className="p-2.5 hover:bg-dark-card cursor-pointer transition-colors"
                      >
                        <p className="text-xs font-semibold text-gray-200">{c.name}</p>
                        <p className="text-[11px] font-mono text-gray-400">{c.phone} • {c.total_visits} visits</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Cart Items List */}
          <div className="flex-1 p-4 overflow-y-auto space-y-2.5">
            {cart.length === 0 ? (
              <div className="h-48 flex flex-col items-center justify-center text-center text-gray-500 text-xs">
                <Scissors className="w-8 h-8 text-gray-600 mb-2" />
                <span>Cart is empty</span>
                <span className="text-[10px] text-gray-600 mt-1">Tap any service to begin building the bill</span>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={item.service.id}
                  className="p-3 rounded-xl bg-dark-card border border-dark-border flex items-center justify-between gap-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-gray-200 truncate">{item.service.name}</p>
                    <p className="text-[11px] font-mono text-brand-300">
                      {formatCurrency(item.unit_price)} each
                    </p>
                  </div>

                  {/* Quantity Stepper */}
                  <div className="flex items-center gap-2 bg-dark-bg px-2 py-1 rounded-lg border border-dark-border">
                    <button
                      onClick={() => updateQuantity(item.service.id, -1)}
                      className="text-gray-400 hover:text-white p-0.5"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-xs font-bold font-mono text-white px-1">
                      {item.quantity}
                    </span>
                    <button
                      onClick={() => updateQuantity(item.service.id, 1)}
                      className="text-gray-400 hover:text-white p-0.5"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  </div>

                  <span className="text-xs font-bold font-mono text-white min-w-[60px] text-right">
                    {formatCurrency(item.unit_price * item.quantity)}
                  </span>

                  <button
                    onClick={() => removeFromCart(item.service.id)}
                    className="text-gray-500 hover:text-red-400 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Pricing Calculation Summary */}
          <div className="p-4 border-t border-dark-border bg-dark-card/30 space-y-3">
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal</span>
                <span className="font-mono text-gray-200">{formatCurrency(subtotal)}</span>
              </div>

              {/* Discount Input */}
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-400 flex items-center gap-1">
                  <Percent className="w-3 h-3 text-brand-400" />
                  <span>Discount (₹)</span>
                </span>
                <input
                  type="number"
                  min="0"
                  max={subtotal}
                  value={discountAmount || ''}
                  onChange={(e) => setDiscountAmount(Math.max(0, Number(e.target.value)))}
                  placeholder="0"
                  className="w-20 bg-dark-bg border border-dark-border rounded-lg px-2 py-1 text-right text-xs font-mono text-emerald-400 focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* GST Toggle */}
              <div className="flex items-center justify-between text-gray-400">
                <span className="flex items-center gap-2">
                  <span>GST (18%)</span>
                  <input
                    type="checkbox"
                    checked={taxRate === 18}
                    onChange={(e) => setTaxRate(e.target.checked ? 18 : 0)}
                    className="rounded bg-dark-bg border-dark-border text-brand-500"
                  />
                </span>
                <span className="font-mono text-gray-200">{formatCurrency(taxAmount)}</span>
              </div>

              <div className="flex justify-between text-base font-extrabold text-white pt-2 border-t border-dark-border">
                <span>Net Payable</span>
                <span className="font-mono text-brand-300">{formatCurrency(grandTotal)}</span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2 pt-2 border-t border-dark-border">
              <div className="text-[11px] font-semibold text-gray-400 uppercase">Payment Instrument</div>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod('upi')}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold border transition-all ${
                    paymentMethod === 'upi'
                      ? 'bg-brand-500/20 border-brand-500/50 text-brand-300'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                  <span>UPI</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('cash')}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold border transition-all ${
                    paymentMethod === 'cash'
                      ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white'
                  }`}
                >
                  <Banknote className="w-4 h-4" />
                  <span>Cash</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod('card')}
                  className={`p-2 rounded-xl flex flex-col items-center gap-1 text-xs font-semibold border transition-all ${
                    paymentMethod === 'card'
                      ? 'bg-sky-500/20 border-sky-500/50 text-sky-300'
                      : 'bg-dark-bg border-dark-border text-gray-400 hover:text-white'
                  }`}
                >
                  <CreditCard className="w-4 h-4" />
                  <span>Card</span>
                </button>
              </div>

              {/* UPI Sub-providers */}
              {paymentMethod === 'upi' && (
                <div className="flex gap-1.5 pt-1">
                  {[
                    { id: 'google_pay', label: 'GPay' },
                    { id: 'phonepe', label: 'PhonePe' },
                    { id: 'paytm', label: 'Paytm' },
                    { id: 'other', label: 'Other UPI' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setUpiProvider(p.id as any)}
                      className={`flex-1 py-1 rounded-lg text-[10px] font-bold uppercase transition-all ${
                        upiProvider === p.id
                          ? 'bg-dark-card border border-brand-400 text-brand-300'
                          : 'bg-dark-bg text-gray-500 hover:text-gray-300'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Complete Sale Button */}
            <button
              onClick={handleCheckout}
              disabled={isSubmitting || cart.length === 0}
              className="w-full py-3.5 px-4 rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 hover:from-brand-400 hover:to-brand-500 text-dark-bg font-extrabold text-sm tracking-wide transition-all shadow-xl shadow-brand-500/25 flex items-center justify-center gap-2 disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-dark-bg" />
                  <span>Settling Transaction...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Collect {formatCurrency(grandTotal)} & Generate Bill</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 80mm Printable Receipt Modal */}
      <ReceiptModal
        receipt={completedReceipt}
        isOpen={isReceiptOpen}
        onClose={() => setIsReceiptOpen(false)}
      />
    </div>
  );
}
