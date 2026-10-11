'use client';

import React, { useState, useEffect, useRef } from 'react';
import Topbar from '@/components/Topbar';
import ReceiptModal from '@/components/ReceiptModal';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { Service, ServiceCategory, Customer, CartItem } from '@/lib/types';
import { 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  CheckCircle, 
  X, 
  Loader2,
  MessageCircle,
  RotateCcw,
  Sparkles
} from 'lucide-react';

export default function BillingPosPage() {
  // Service catalogue state
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [staffMembers, setStaffMembers] = useState<any[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [selectedGender, setSelectedGender] = useState<'All' | 'Men' | 'Women'>('All');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingServices, setLoadingServices] = useState(true);

  // Cart & checkout state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [applyGst, setApplyGst] = useState<boolean>(true);
  const [gstRate, setGstRate] = useState<number>(5); // 5% GST standard for salons
  const [notes, setNotes] = useState('');

  // Customer state
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerResults, setCustomerResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [isCustomerDropdownOpen, setIsCustomerDropdownOpen] = useState(false);
  const [activeSearchField, setActiveSearchField] = useState<'name' | 'phone'>('name');
  const customerDropdownRef = useRef<HTMLDivElement>(null);

  // Payment state
  const [paymentMethod, setPaymentMethod] = useState<'UPI' | 'CASH' | 'CARD'>('UPI');
  const [upiProvider, setUpiProvider] = useState<'PhonePe' | 'Google Pay' | 'Paytm' | 'Other'>('PhonePe');

  // Checkout process & modal
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<any>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // Load initial catalogue and staff
  useEffect(() => {
    const loadData = async () => {
      setLoadingServices(true);
      try {
        const [cats, svcs, emps] = await Promise.all([
          api.getCategories(),
          api.getServices(),
          api.getEmployees().catch(() => []),
        ]);
        setCategories(cats || []);
        setServices(svcs || []);
        setStaffMembers(emps || []);
      } catch (err) {
        console.error('Failed to load catalogue data:', err);
      } finally {
        setLoadingServices(false);
      }
    };
    loadData();
  }, []);

  // Close customer dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        customerDropdownRef.current &&
        !customerDropdownRef.current.contains(event.target as Node)
      ) {
        setIsCustomerDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, []);

  // Customer live lookup by name or phone
  useEffect(() => {
    if (selectedCustomer) {
      setCustomerResults([]);
      setIsCustomerDropdownOpen(false);
      return;
    }
    const query = activeSearchField === 'name' ? customerName.trim() : customerPhone.trim();
    if (!query || query.length < 1) {
      setCustomerResults([]);
      setIsCustomerDropdownOpen(false);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await api.getCustomers(query);
        const results = res || [];
        setCustomerResults(results);
        setIsCustomerDropdownOpen(results.length > 0);
      } catch (err) {
        console.error('Customer lookup error:', err);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [customerPhone, customerName, activeSearchField, selectedCustomer]);

  // Filtered services matching search, gender, and category
  const filteredServices = services.filter((svc) => {
    // Gender filter
    if (selectedGender === 'Men') {
      if (svc.audience === 'Female') return false;
      if (svc.target_gender && svc.target_gender.toLowerCase() === 'female') return false;
    } else if (selectedGender === 'Women') {
      if (svc.audience === 'Male') return false;
      if (svc.target_gender && svc.target_gender.toLowerCase() === 'male') return false;
    }

    // Category filter
    if (selectedCategory !== 'All') {
      const catObj = categories.find((c) => c.id === svc.category_id || c.name === selectedCategory);
      if (catObj) {
        if (catObj.name !== selectedCategory && svc.category_id !== selectedCategory) return false;
      } else if (svc.category_name !== selectedCategory) {
        return false;
      }
    }

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = svc.name.toLowerCase().includes(q);
      const matchCat = svc.category_name ? svc.category_name.toLowerCase().includes(q) : false;
      const matchVariant = svc.variant_name ? svc.variant_name.toLowerCase().includes(q) : false;
      const matchCombo = svc.combo_items ? svc.combo_items.toLowerCase().includes(q) : false;
      return matchName || matchCat || matchVariant || matchCombo;
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

  const clearBill = () => {
    setCart([]);
    setDiscountPercent(0);
    setNotes('');
    setSelectedCustomer(null);
    setCustomerName('');
    setCustomerPhone('');
    setSelectedStaff('');
    setIsCustomerDropdownOpen(false);
    setCustomerResults([]);
  };

  // Financial calculations: services total + percentage discount
  const subtotal = cart.reduce((sum, item) => sum + item.unit_price * item.quantity, 0);
  const discountRate = Math.min(100, Math.max(0, Number(discountPercent) || 0));
  const discountAmount = Math.round((subtotal * discountRate) / 100);
  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = applyGst ? Math.round((taxableAmount * gstRate) / 100) : 0;
  const grandTotal = taxableAmount + taxAmount;

  // Complete Checkout
  const handleCheckout = async (openWhatsApp: boolean = false) => {
    if (cart.length === 0) {
      alert('Please add at least one service to the cart before checking out.');
      return;
    }

    let phone = customerPhone.trim();
    if (!phone && selectedCustomer?.phone) {
      phone = selectedCustomer.phone;
    }

    const name = customerName.trim() || selectedCustomer?.name || 'Walk-in Guest';

    if (openWhatsApp && (!phone || phone.replace(/\D/g, '').length < 10)) {
      const proceed = confirm(
        'A valid 10-digit mobile number was not entered. WhatsApp receipt cannot be prepared automatically. Do you still want to save the bill?'
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customer_phone: phone || '9999999999',
        customer_name: name,
        customer_id: selectedCustomer?.id || undefined,
        overall_discount: discountAmount,
        discount_reason: discountRate > 0 ? `${discountRate}% salon discount` : undefined,
        apply_tax: applyGst,
        open_whatsapp: openWhatsApp,
        send_whatsapp: openWhatsApp,
        staff_name: selectedStaff || undefined,
        payments: [
          {
            payment_method: paymentMethod,
            payment_provider: paymentMethod === 'UPI' ? upiProvider : undefined,
            amount: grandTotal,
          }
        ],
        items: cart.map((item) => ({
          service_id: item.service.id,
          name: item.service.variant_name
            ? `${item.service.name} (${item.service.variant_name})`
            : item.service.name,
          unit_price: item.unit_price,
          quantity: item.quantity,
          discount_amount: item.discount_amount || 0,
          item_type: 'service',
        })),
        notes: notes || undefined,
      };

      const result = await api.createSale(payload);

      if (result && result.sale) {
        const sale = result.sale;
        const inv = result.invoice;
        const receiptData = {
          invoice_id: inv?.id,
          invoice_number: inv?.invoice_number || sale.sale_number,
          sale_number: sale.sale_number,
          customer_name: sale.customer_name || name,
          customer_phone: sale.customer_phone || phone,
          created_at: sale.created_at,
          image_url: inv?.image_url,
          whatsapp_url: result.whatsapp_url || result.whatsapp_click_to_chat?.url,
          whatsapp_click_to_chat: result.whatsapp_click_to_chat,
          whatsapp_delivery: result.whatsapp_delivery,
          public_invoice_url: result.public_invoice_url,
          public_invoice_token: result.public_invoice_token,
          items: (sale.items || []).map((it: any) => ({
            service_name: it.service_name_snapshot,
            quantity: it.quantity,
            unit_price: Number(it.unit_price_snapshot),
          })),
          subtotal: Number(sale.subtotal),
          discount_amount: Number(sale.discount_amount),
          tax_amount: Number(sale.tax_amount),
          total_amount: Number(sale.total_amount),
          payment_method: sale.payments?.[0]?.payment_method || paymentMethod,
          payment_provider: sale.payments?.[0]?.payment_provider || '',
          receipt_text: result.receipt_text,
        };
        setCompletedReceipt(receiptData);
        setIsReceiptOpen(true);

        if (openWhatsApp && result.whatsapp_url) {
          try {
            const waWindow = window.open(result.whatsapp_url, '_blank');
            if (!waWindow) {
              console.warn('Browser pop-up blocked. Open WhatsApp button available in receipt modal.');
            }
          } catch (popupErr) {
            console.warn('Failed to open WhatsApp window:', popupErr);
          }
        }
      }

      clearBill();
    } catch (err: any) {
      alert(`Checkout failed: ${err.message || 'Unknown error'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Category pill list from backend
  const categoryNames = ['All', ...categories.map((c) => c.name)];

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F7F6F5]">
      {/* Topbar Navigation */}
      <Topbar title="Billing & POS" breadcrumb="Billing & POS" />

      {/* Main Workspace Body */}
      <div className="p-6 md:p-8 max-w-[1600px] w-full mx-auto">
        {/* Page Title & Header Row */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[11px] font-semibold tracking-widest text-[#929292] uppercase">
              TRIMZ SALON DESK
            </p>
            <h1 className="text-3xl md:text-4xl font-serif font-bold text-[#171717] tracking-tight mt-1">
              Billing &amp; POS
            </h1>
            <p className="text-sm text-[#737373] mt-1 font-normal">
              Build a bill, identify returning guests by mobile and share the receipt.
            </p>
          </div>

          <button
            type="button"
            onClick={clearBill}
            className="self-start sm:self-auto flex items-center gap-1.5 px-4 py-2 rounded-xl bg-white border border-[#E8E5E3] hover:bg-[#F5F4F3] text-[#171717] text-xs font-semibold shadow-sm transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5 text-[#737373]" />
            <span>Clear bill</span>
          </button>
        </div>

        {/* 2-Column Responsive Workspace */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* LEFT COLUMN: Service Catalogue */}
          <div className="flex-1 w-full bg-white rounded-2xl border border-[#E8E5E3] p-5 sm:p-6 shadow-sm">
            {/* Choose Services Header + Find Service Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#F0EEEB]">
              <div>
                <h2 className="text-base font-bold text-[#171717]">
                  Choose services
                </h2>
                <p className="text-xs text-[#737373] mt-0.5">
                  Tap a service to add it to this bill
                </p>
              </div>

              {/* Search Field */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-[#929292] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Find service..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-[#E8E5E3] bg-white text-[#171717] placeholder-[#929292] focus:outline-none focus:border-[#171717] transition-colors"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Filter Pills: Gender Row */}
            <div className="flex flex-wrap items-center gap-2 pt-4">
              {(['All', 'Men', 'Women'] as const).map((gender) => {
                const isSelected = selectedGender === gender;
                return (
                  <button
                    key={gender}
                    type="button"
                    onClick={() => setSelectedGender(gender)}
                    className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                      isSelected
                        ? 'bg-[#171717] text-white shadow-sm'
                        : 'bg-white text-[#171717] border border-[#E8E5E3] hover:bg-[#F5F4F3]'
                    }`}
                  >
                    {gender}
                  </button>
                );
              })}
            </div>

            {/* Filter Pills: Category Row */}
            <div className="flex flex-wrap items-center gap-2 pt-2.5 pb-2">
              {categoryNames.map((catName) => {
                const isSelected = selectedCategory === catName;
                return (
                  <button
                    key={catName}
                    type="button"
                    onClick={() => setSelectedCategory(catName)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-[#171717] text-white shadow-sm'
                        : 'bg-white text-[#171717] border border-[#E8E5E3] hover:bg-[#F5F4F3]'
                    }`}
                  >
                    {catName}
                  </button>
                );
              })}
            </div>

            {/* Service Cards Grid */}
            {loadingServices ? (
              <div className="py-20 flex flex-col items-center justify-center text-[#737373]">
                <Loader2 className="w-6 h-6 animate-spin text-[#E60023] mb-2" />
                <p className="text-xs font-medium">Loading salon service catalogue...</p>
              </div>
            ) : filteredServices.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-center text-[#737373]">
                <p className="text-sm font-semibold text-[#171717]">No services match this filter</p>
                <p className="text-xs text-[#929292] mt-1">Try switching category or search keywords</p>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedGender('All');
                    setSelectedCategory('All');
                    setSearchQuery('');
                  }}
                  className="mt-3 text-xs font-semibold text-[#E60023] hover:underline"
                >
                  Reset filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3.5 mt-4">
                {filteredServices.map((svc) => (
                  <div
                    key={svc.id}
                    onClick={() => addToCart(svc)}
                    className="group bg-white border border-[#E8E5E3] hover:border-[#171717]/40 hover:shadow-md transition-all rounded-xl p-4 cursor-pointer text-left flex flex-col justify-between min-h-[115px]"
                  >
                    <div>
                      <h3 className="font-semibold text-sm text-[#171717] leading-snug group-hover:text-[#E60023] transition-colors">
                        {svc.name}
                        {svc.variant_name && (
                          <span className="text-xs font-normal text-[#737373] ml-1">
                            ({svc.variant_name})
                          </span>
                        )}
                      </h3>
                      <p className="text-xs text-[#737373] mt-1 font-normal">
                        {svc.category_name || 'Service'} · {svc.audience || 'Unisex'} · {svc.duration_minutes ? `${svc.duration_minutes} min` : 'Duration not set'}
                      </p>
                    </div>

                    <div className="flex items-center justify-between mt-3 pt-2">
                      <span className="text-base font-bold text-[#E60023] tracking-tight">
                        {formatCurrency(svc.price)}
                      </span>
                      <span className="opacity-0 group-hover:opacity-100 transition-opacity text-[11px] font-bold text-[#171717] bg-[#F5F4F3] px-2 py-0.5 rounded-lg border border-[#E8E5E3]">
                        + Add
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Current Bill Card */}
          <div className="w-full lg:w-[380px] xl:w-[420px] bg-white rounded-2xl border border-[#E8E5E3] p-5 shadow-sm sticky top-20">
            {/* Header with Draft badge */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#F0EEEB]">
              <div>
                <h2 className="text-base font-bold text-[#171717] leading-tight">
                  Current bill
                </h2>
                <p className="text-xs font-mono text-[#737373] mt-0.5">
                  Bill no. TZ-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-0004
                </p>
              </div>
              <span className="bg-rose-50 text-[#E60023] border border-rose-200 text-[11px] font-bold px-2.5 py-0.5 rounded-full">
                Draft
              </span>
            </div>

            {/* Customer & Staff Form Inputs */}
            <div className="space-y-3 pt-3.5">
              {/* Customer Search & Details Container */}
              <div ref={customerDropdownRef} className="space-y-3 relative">
                {/* Selected Customer Banner */}
                {selectedCustomer && (
                  <div className="flex items-center justify-between px-3 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900 text-xs">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      <span className="truncate">
                        Returning guest: <strong>{selectedCustomer.name}</strong> ({selectedCustomer.phone})
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomer(null);
                        setIsCustomerDropdownOpen(false);
                      }}
                      className="text-emerald-700 hover:text-emerald-950 font-semibold text-[11px] ml-2 underline flex-shrink-0"
                    >
                      Change
                    </button>
                  </div>
                )}

                {/* Customer Name */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#737373] mb-1">
                    Customer name
                  </label>
                  <input
                    type="text"
                    placeholder="Enter customer name"
                    value={customerName}
                    onChange={(e) => {
                      setCustomerName(e.target.value);
                      setActiveSearchField('name');
                      if (selectedCustomer) setSelectedCustomer(null);
                    }}
                    onFocus={() => {
                      setActiveSearchField('name');
                      if (customerResults.length > 0 && !selectedCustomer) {
                        setIsCustomerDropdownOpen(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsCustomerDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5E3] bg-white text-[#171717] placeholder-[#929292] focus:outline-none focus:border-[#171717] transition-colors"
                  />
                </div>

                {/* Customer Mobile Number */}
                <div className="relative">
                  <label className="block text-xs font-medium text-[#737373] mb-1">
                    Customer mobile number
                  </label>
                  <input
                    type="tel"
                    placeholder="Enter mobile to check visit history"
                    value={customerPhone}
                    onChange={(e) => {
                      setCustomerPhone(e.target.value);
                      setActiveSearchField('phone');
                      if (selectedCustomer) setSelectedCustomer(null);
                    }}
                    onFocus={() => {
                      setActiveSearchField('phone');
                      if (customerResults.length > 0 && !selectedCustomer) {
                        setIsCustomerDropdownOpen(true);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Escape') setIsCustomerDropdownOpen(false);
                    }}
                    className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-[#E8E5E3] bg-white text-[#171717] placeholder-[#929292] focus:outline-none focus:border-[#171717] transition-colors"
                  />
                </div>

                {/* Suggestions Dropdown (anchored to container, closes when clicking outside or pressing Escape) */}
                {isCustomerDropdownOpen && customerResults.length > 0 && !selectedCustomer && (
                  <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-white border border-[#E8E5E3] rounded-xl shadow-2xl max-h-56 overflow-y-auto z-40 divide-y divide-[#F0EEEB]">
                    <div className="p-2 bg-[#F9F8F7] text-[11px] font-semibold text-[#737373] flex items-center justify-between sticky top-0 border-b border-[#E8E5E3]">
                      <span>Found {customerResults.length} registered {customerResults.length === 1 ? 'guest' : 'guests'}</span>
                      <button
                        type="button"
                        onClick={() => setIsCustomerDropdownOpen(false)}
                        className="text-[#929292] hover:text-[#171717]"
                        title="Close suggestions"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {customerResults.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => {
                          setSelectedCustomer(c);
                          setCustomerName(c.name);
                          setCustomerPhone(c.phone);
                          setIsCustomerDropdownOpen(false);
                          setCustomerResults([]);
                        }}
                        className="p-2.5 hover:bg-[#F5F4F3] cursor-pointer transition-colors flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#171717] truncate">{c.name}</p>
                          <p className="text-[11px] font-mono text-[#737373]">{c.phone}</p>
                        </div>
                        <span className="text-[10px] font-semibold text-[#E60023] bg-rose-50 px-2 py-0.5 rounded-full flex-shrink-0">
                          {c.total_visits} {c.total_visits === 1 ? 'visit' : 'visits'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Staff Member Selection */}
              <div>
                <label className="block text-xs font-medium text-[#737373] mb-1">
                  Service performed by
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-[#E8E5E3] bg-white text-[#171717] focus:outline-none focus:border-[#171717] transition-colors"
                >
                  <option value="">Select staff member</option>
                  {staffMembers.map((emp) => (
                    <option key={emp.id} value={emp.name}>
                      {emp.name} ({emp.roles?.[0]?.name || 'Stylist'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Cart Items Area */}
            <div className="mt-4 pt-3 border-t border-[#F0EEEB] min-h-[100px] max-h-56 overflow-y-auto">
              {cart.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#929292] font-normal">
                  Add a service or product to begin
                </div>
              ) : (
                <div className="space-y-2.5">
                  {cart.map((item) => (
                    <div
                      key={item.service.id}
                      className="p-2.5 rounded-xl bg-[#F7F6F5] border border-[#E8E5E3] flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-[#171717] truncate">
                          {item.service.name}
                        </p>
                        <p className="text-[11px] font-mono text-[#E60023] font-bold">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded-lg border border-[#E8E5E3]">
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.service.id, -1)}
                          className="text-[#737373] hover:text-[#171717] p-0.5"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold text-[#171717] px-1 font-mono">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(item.service.id, 1)}
                          className="text-[#737373] hover:text-[#171717] p-0.5"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFromCart(item.service.id)}
                        className="text-[#929292] hover:text-[#E60023] p-1 transition-colors"
                        title="Remove item"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Financial Controls: Discount & Payment Mode */}
            <div className="grid grid-cols-2 gap-3 mt-4 pt-3.5 border-t border-[#F0EEEB]">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-medium text-[#737373]">
                    Discount (%)
                  </label>
                  {discountAmount > 0 && (
                    <span className="text-[11px] font-mono font-bold text-[#E60023]">
                      -₹{discountAmount}
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="any"
                    value={discountPercent === 0 ? '' : discountPercent}
                    placeholder="0"
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === '') {
                        setDiscountPercent(0);
                      } else {
                        const parsed = Math.min(100, Math.max(0, parseFloat(val)));
                        setDiscountPercent(isNaN(parsed) ? 0 : parsed);
                      }
                    }}
                    className="w-full pl-3 pr-7 py-1.5 text-xs font-mono rounded-xl border border-[#E8E5E3] bg-white text-[#171717] focus:outline-none focus:border-[#171717]"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#737373] pointer-events-none">
                    %
                  </span>
                </div>
                {/* Quick percentage pills */}
                <div className="flex items-center gap-1 mt-1.5">
                  {[0, 5, 10, 15, 20].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setDiscountPercent(pct)}
                      className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium transition-colors ${
                        discountPercent === pct
                          ? 'bg-[#171717] text-white'
                          : 'bg-[#F0EEEB] text-[#737373] hover:bg-[#E8E5E3] hover:text-[#171717]'
                      }`}
                    >
                      {pct}%
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-[#737373] mb-1">
                  Payment mode
                </label>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as any)}
                  className="w-full px-3 py-1.5 text-xs rounded-xl border border-[#E8E5E3] bg-white text-[#171717] focus:outline-none focus:border-[#171717]"
                >
                  <option value="UPI">UPI</option>
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                </select>
              </div>
            </div>

            {/* GST Inclusion / Exclusion Radio Toggle */}
            <div className="flex items-center gap-4 mt-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#171717]">
                <input
                  type="radio"
                  name="gst_toggle"
                  checked={applyGst}
                  onChange={() => setApplyGst(true)}
                  className="w-3.5 h-3.5 text-[#E60023] focus:ring-[#E60023]"
                />
                <span>With GST (5%)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-[#171717]">
                <input
                  type="radio"
                  name="gst_toggle"
                  checked={!applyGst}
                  onChange={() => setApplyGst(false)}
                  className="w-3.5 h-3.5 text-[#E60023] focus:ring-[#E60023]"
                />
                <span>Without GST</span>
              </label>
            </div>

            {/* Bill Summary Breakdown */}
            <div className="mt-4 pt-3 border-t border-[#F0EEEB] space-y-1.5 text-xs text-[#737373]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="font-mono text-[#171717] font-medium">₹{subtotal.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount {discountRate > 0 ? `(${discountRate}%)` : ''}</span>
                <span className="font-mono text-[#171717] font-medium">- ₹{discountAmount.toFixed(0)}</span>
              </div>
              <div className="flex justify-between">
                <span>GST (5%)</span>
                <span className="font-mono text-[#171717] font-medium">₹{taxAmount.toFixed(0)}</span>
              </div>
              <div className="flex justify-between items-center pt-2 border-t border-[#E8E5E3] text-sm font-bold text-[#171717]">
                <span>Total amount</span>
                <span className="text-base font-bold text-[#171717] font-mono">
                  {formatCurrency(grandTotal)}
                </span>
              </div>
            </div>

            {/* Action Buttons: Save & Open WhatsApp + Save Bill Only */}
            <div className="space-y-2 mt-5">
              <button
                type="button"
                onClick={() => handleCheckout(true)}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-3 px-4 rounded-xl bg-[#E60023] hover:bg-[#C9001F] text-white font-bold text-xs tracking-wide transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-white" />
                    <span>Saving Bill &amp; Preparing WhatsApp...</span>
                  </>
                ) : (
                  <>
                    <MessageCircle className="w-4 h-4 text-white" />
                    <span>Save Bill &amp; Open WhatsApp ({formatCurrency(grandTotal)})</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleCheckout(false)}
                disabled={isSubmitting || cart.length === 0}
                className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-[#F5F4F3] text-[#171717] border border-[#E8E5E3] font-semibold text-xs transition-all flex items-center justify-center gap-2 disabled:opacity-40"
              >
                <CheckCircle className="w-3.5 h-3.5 text-[#737373]" />
                <span>Save Bill Only</span>
              </button>
            </div>
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
