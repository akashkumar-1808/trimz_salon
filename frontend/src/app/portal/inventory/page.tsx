'use client';

import React, { useState } from 'react';
import Topbar from '@/components/Topbar';
import { Package, Plus, Search, AlertTriangle, CheckCircle2, ArrowUpDown, X } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: 'Retail Product' | 'Backbar Supply' | 'Color & Chemical' | 'Styling Tool';
  stockQuantity: number;
  minThreshold: number;
  unitPrice: number;
  unit: string;
}

const INITIAL_INVENTORY: InventoryItem[] = [];

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>(INITIAL_INVENTORY);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // New Item Form
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [category, setCategory] = useState<InventoryItem['category']>('Retail Product');
  const [stockQuantity, setStockQuantity] = useState('10');
  const [minThreshold, setMinThreshold] = useState('5');
  const [unitPrice, setUnitPrice] = useState('500');
  const [unit, setUnit] = useState('Units');

  const handleCreateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !sku) return;

    const newItem: InventoryItem = {
      id: `inv-${Date.now()}`,
      name,
      sku,
      category,
      stockQuantity: parseInt(stockQuantity) || 0,
      minThreshold: parseInt(minThreshold) || 1,
      unitPrice: parseFloat(unitPrice) || 0,
      unit,
    };

    setItems([newItem, ...items]);
    setIsModalOpen(false);
    setName('');
    setSku('');
  };

  const handleAdjustStock = (id: string, delta: number) => {
    setItems(items.map((i) => i.id === id ? { ...i, stockQuantity: Math.max(0, i.stockQuantity + delta) } : i));
  };

  const filteredItems = items.filter((i) => {
    if (categoryFilter !== 'all' && i.category !== categoryFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q);
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-workspace-bg">
      <Topbar title="Inventory & Product Stock" />

      <main className="p-6 md:p-8 space-y-6 max-w-7xl mx-auto w-full">
        {/* Header Kicker */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <div className="text-[11px] font-bold uppercase tracking-widest text-text-muted">TRIMZ SALON STOCK</div>
            <h1 className="font-serif text-3xl font-bold text-text-primary tracking-tight mt-0.5">Inventory & Supplies</h1>
            <p className="text-sm text-text-secondary mt-1">
              Track retail products, backbar salon supplies, minimum thresholds, and stock replenishment.
            </p>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary hover:bg-primary-hover text-white font-medium text-sm transition-all shadow-sm self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>Add Stock Item</span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-workspace-border shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-text-muted absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search product name or SKU..."
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
              All Categories
            </button>
            <button
              onClick={() => setCategoryFilter('Retail Product')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Retail Product'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Retail
            </button>
            <button
              onClick={() => setCategoryFilter('Backbar Supply')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Backbar Supply'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Backbar
            </button>
            <button
              onClick={() => setCategoryFilter('Color & Chemical')}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                categoryFilter === 'Color & Chemical'
                  ? 'bg-text-primary text-white shadow-sm'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              Colors & Chems
            </button>
          </div>
        </div>

        {/* Inventory Table Card */}
        <div className="bg-white border border-workspace-border rounded-2xl overflow-hidden shadow-sm">
          <div className="p-4 border-b border-workspace-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-2">
              <Package className="w-4 h-4 text-primary" />
              <span>Current Stock Inventory ({filteredItems.length})</span>
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-workspace-border bg-workspace-bg/40 text-text-muted font-medium uppercase text-[11px] tracking-wider">
                  <th className="p-4">Product & SKU</th>
                  <th className="p-4">Category</th>
                  <th className="p-4">Stock Level</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Unit Price</th>
                  <th className="p-4 text-right">Quick Stock Update</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-workspace-border">
                {filteredItems.map((item) => {
                  const isLow = item.stockQuantity <= item.minThreshold;
                  return (
                    <tr key={item.id} className="hover:bg-workspace-hover/50 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-text-primary">{item.name}</div>
                        <div className="text-text-muted font-mono text-[11px]">{item.sku}</div>
                      </td>
                      <td className="p-4 text-text-secondary text-xs">{item.category}</td>
                      <td className="p-4 font-mono">
                        <span className="font-bold text-text-primary">{item.stockQuantity}</span>
                        <span className="text-text-muted text-xs ml-1">{item.unit}</span>
                      </td>
                      <td className="p-4">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Low Stock (Min {item.minThreshold})</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Optimal</span>
                          </span>
                        )}
                      </td>
                      <td className="p-4 text-right font-mono font-bold text-primary text-sm">
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleAdjustStock(item.id, -1)}
                            className="w-7 h-7 rounded-lg bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-bold text-xs"
                            title="Decrement stock"
                          >
                            -
                          </button>
                          <button
                            onClick={() => handleAdjustStock(item.id, 1)}
                            className="w-7 h-7 rounded-lg bg-white border border-workspace-border hover:bg-workspace-hover text-text-primary font-bold text-xs"
                            title="Increment stock"
                          >
                            +
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Add Stock Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white border border-workspace-border rounded-2xl w-full max-w-md p-6 shadow-xl">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-base text-text-primary">Add Inventory Item</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text-primary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateItem} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-text-secondary font-medium mb-1">Product Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Keratin Serum 100ml"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">SKU / Barcode *</label>
                <input
                  type="text"
                  required
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="e.g. KER-SER-100"
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                />
              </div>

              <div>
                <label className="block text-text-secondary font-medium mb-1">Category</label>
                <select
                  value={category}
                  onChange={(e: any) => setCategory(e.target.value)}
                  className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
                >
                  <option value="Retail Product">Retail Product</option>
                  <option value="Backbar Supply">Backbar Supply</option>
                  <option value="Color & Chemical">Color & Chemical</option>
                  <option value="Styling Tool">Styling Tool</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    value={stockQuantity}
                    onChange={(e) => setStockQuantity(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Min Alert Threshold</label>
                  <input
                    type="number"
                    value={minThreshold}
                    onChange={(e) => setMinThreshold(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Unit Price (₹)</label>
                  <input
                    type="number"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary font-mono text-sm focus:outline-none focus:border-text-primary"
                  />
                </div>
                <div>
                  <label className="block text-text-secondary font-medium mb-1">Packaging Unit</label>
                  <input
                    type="text"
                    value={unit}
                    onChange={(e) => setUnit(e.target.value)}
                    placeholder="e.g. Bottles / Tubes"
                    className="w-full bg-white border border-workspace-border rounded-xl px-3 py-2 text-text-primary text-sm focus:outline-none focus:border-text-primary"
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
                  Add to Inventory
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
