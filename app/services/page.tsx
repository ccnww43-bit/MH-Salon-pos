"use client";

import React, { useState } from 'react';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Navbar } from '@/components/navbar';
import { Pagination } from '@/components/pagination';
import { PermissionGuard } from '@/components/permissionguard';
import { logAction } from '@/lib/logger';
import { Plus, Trash2, Scissors, Power, DollarSign, Clock, X, AlertCircle, Check } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

// FIXED: Defined the missing 'cn' utility function to resolve the build error
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const DEFAULT_CATEGORIES = ['Hair', 'Massage', 'Nails', 'Skin', 'Clinic'];

// Special sentinel value for the "+ Add new category..." option in the dropdown.
const ADD_NEW_CATEGORY = '__add_new_category__';

// Same deterministic color-per-category palette used on the POS catalog, so
// a service's category badge here matches the color it shows up as at
// checkout. Purely presentational — does not affect price, category value,
// or any add/toggle/delete logic below.
const CATEGORY_PALETTE = [
  { bg: "bg-blue-50", text: "text-blue-600", ring: "ring-blue-100" },
  { bg: "bg-emerald-50", text: "text-emerald-600", ring: "ring-emerald-100" },
  { bg: "bg-violet-50", text: "text-violet-600", ring: "ring-violet-100" },
  { bg: "bg-amber-50", text: "text-amber-600", ring: "ring-amber-100" },
  { bg: "bg-rose-50", text: "text-rose-600", ring: "ring-rose-100" },
  { bg: "bg-cyan-50", text: "text-cyan-600", ring: "ring-cyan-100" },
];

const categoryStyle = (category?: string) => {
  const key = category || "General";
  let hash = 0;
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) >>> 0;
  return CATEGORY_PALETTE[hash % CATEGORY_PALETTE.length];
};

export default function ServicesPage() {
  const [page, setPage] = useState(1);
  const size = 8;

  const [form, setForm] = useState({ name: '', price: '', category: 'Hair', duration: '30' });
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryText, setNewCategoryText] = useState('');

  const services = useLiveQuery(() => 
    db.services.offset((page - 1) * size).limit(size).toArray(), 
    [page]
  );
  const count = useLiveQuery(() => db.services.count()) || 0;

  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const currency = settings?.[0]?.currency || "KSh";

  // Custom categories saved from this page, on top of the 5 built-in defaults —
  // so "Add new category" persists and shows up for every service afterwards.
  const categories = Array.from(new Set([...DEFAULT_CATEGORIES, ...((settings?.[0]?.serviceCategories) || [])]));

  const saveNewCategory = async () => {
    const value = newCategoryText.trim();
    if (!value) { setAddingCategory(false); return; }
    if (!categories.includes(value)) {
      const existing = await db.settings.toArray();
      const updatedList = Array.from(new Set([...(existing[0]?.serviceCategories || []), value]));
      if (existing.length > 0) {
        await db.settings.update(existing[0].id!, { serviceCategories: updatedList, updatedAt: new Date() });
      } else {
        await db.settings.add({ serviceCategories: updatedList, updatedAt: new Date() } as any);
      }
      await logAction('Service Management', `Added new service category: ${value}`);
    }
    setForm(f => ({ ...f, category: value }));
    setNewCategoryText('');
    setAddingCategory(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.price) return;

    const now = new Date();
    await db.services.add({
      name: form.name,
      price: parseFloat(form.price),
      category: form.category,
      duration: parseInt(form.duration),
      isActive: true,
      createdAt: now,
      updatedAt: now
    });

    await logAction('Service Management', `Created service: ${form.name}`);
    setForm({ name: '', price: '', category: 'Hair', duration: '30' });
    setAddingCategory(false);
    setNewCategoryText('');
  };

  const toggle = async (id: number, current: boolean, name: string) => {
    await db.services.update(id, { isActive: !current, updatedAt: new Date() });
    await logAction('Service Management', `Toggled ${name} to ${!current ? 'Active' : 'Inactive'}`);
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Strict Authorization: Delete ${name} from menu?`)) {
      await db.services.delete(id);
      await logAction('Service Management', `Deleted: ${name}`);
    }
  };

  const handleLoadStarterCatalog = async () => {
    const { seedStarterCatalog } = await import('@/lib/starter-catalog');
    await seedStarterCatalog();
    await logAction('Service Management', 'Loaded starter service & product catalog');
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />

      <div className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 shadow-premium">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/10 rounded-xl text-primary"><Scissors size={20} /></div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 leading-tight">Service Menu</h1>
              <p className="text-xs text-slate-400 font-medium">Manage price list &amp; offerings</p>
            </div>
          </div>

          <PermissionGuard permission="manage_services">
            <form onSubmit={handleAdd} className="flex flex-wrap items-center gap-2">
              <input
                placeholder="Service name" required
                className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
              />
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                <input
                  type="number" placeholder="Price" required
                  className="pl-8 pr-3 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 w-28 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                  value={form.price} onChange={e => setForm({ ...form, price: e.target.value })}
                />
              </div>
              {addingCategory ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    placeholder="New category..."
                    className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 w-32 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none transition-all"
                    value={newCategoryText}
                    onChange={e => setNewCategoryText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewCategory(); } if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryText(''); } }}
                  />
                  <button type="button" onClick={saveNewCategory} className="p-2 rounded-xl bg-primary text-white shrink-0"><Check size={14}/></button>
                  <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryText(''); }} className="p-2 rounded-xl bg-slate-100 text-slate-500 shrink-0"><X size={14}/></button>
                </div>
              ) : (
                <select
                  className="px-3.5 py-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary focus:bg-white outline-none appearance-none cursor-pointer transition-all"
                  value={form.category} onChange={e => {
                    if (e.target.value === ADD_NEW_CATEGORY) { setAddingCategory(true); } else { setForm({ ...form, category: e.target.value }); }
                  }}
                >
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                  <option value={ADD_NEW_CATEGORY}>+ Add new category...</option>
                </select>
              )}
              <button type="submit" className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-glow-primary hover:opacity-90 active:scale-95 transition-all">
                <Plus size={15} /> Add
              </button>
            </form>
          </PermissionGuard>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 animate-in fade-in duration-500 selection:bg-primary">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {services?.map((s) => {
            const style = categoryStyle(s.category);
            return (
              <div key={s.id} className={cn("bg-white p-4 rounded-2xl border border-slate-200 shadow-premium hover:shadow-high hover:border-primary/30 hover:-translate-y-0.5 relative group transition-all", !s.isActive && "grayscale opacity-50")}>
                <div className="flex justify-between items-start mb-3">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${style.bg} ${style.text} ring-4 ${style.ring} shrink-0`}>
                    <Scissors size={14} />
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">{s.category}</span>
                    <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                      <button onClick={() => toggle(s.id!, s.isActive, s.name)} className="p-1.5 rounded-lg bg-slate-100 text-slate-400 hover:text-primary transition-colors"><Power size={14} /></button>
                      <button onClick={() => handleDelete(s.id!, s.name)} className="p-1.5 rounded-lg bg-red-50 text-red-300 hover:text-red-500 transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
                <h3 className="font-bold text-slate-900 text-sm leading-snug mb-3 min-h-[2.5em]">{s.name}</h3>
                <div className="flex items-end justify-between border-t border-slate-100 pt-3">
                  <div className="flex items-center gap-1 text-slate-400 font-semibold text-[10px] uppercase tracking-wide">
                    <Clock size={12} /> {s.duration || 30} min
                  </div>
                  <div className="text-lg font-black text-primary leading-none">{currency} {s.price.toLocaleString()}</div>
                </div>
                {!s.isActive && <div className="absolute inset-0 flex items-center justify-center bg-white/70 rounded-2xl font-bold text-red-500 text-[11px] uppercase tracking-[0.2em] rotate-6 pointer-events-none">Inactive</div>}
              </div>
            );
          })}
        </div>

        {services?.length === 0 && (
          <div className="py-24 text-center bg-white rounded-2xl border border-slate-200 shadow-premium">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-300 mx-auto mb-4">
              <AlertCircle size={24} />
            </div>
            <h3 className="text-sm font-bold text-slate-400">No services defined</h3>
            <PermissionGuard permission="manage_services">
              <button
                onClick={handleLoadStarterCatalog}
                className="mt-6 bg-primary text-white px-6 py-2.5 rounded-xl font-semibold text-sm shadow-glow-primary hover:opacity-90 active:scale-95 transition-all"
              >
                Load starter catalog
              </button>
            </PermissionGuard>
          </div>
        )}

        <div className="mt-6">
          <Pagination totalItems={count} itemsPerPage={size} currentPage={page} onPageChange={setPage} />
        </div>
      </div>
    </div>
  );
}
