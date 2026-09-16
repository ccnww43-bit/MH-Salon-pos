"use client";

import React, { useState, useMemo } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { logAction } from "@/lib/logger";
import { Wallet, Plus, Search, DollarSign, Calendar, AlertCircle, CheckCircle2, Trash2, X, Lock, Check } from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";
import { DEFAULT_EXPENSE_CATEGORIES } from "@/lib/expense-categories";

// Special sentinel value for the "+ Add new category..." option in the dropdown.
const ADD_NEW_EXPENSE_CATEGORY = '__add_new_expense_category__';

export default function ExpensesPage() {
  const [page, setPage] = useState(1);
  const size = 10;
  const [form, setForm] = useState({ category: 'Rent', description: '', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0] });
  const [addingCategory, setAddingCategory] = useState(false);
  const [newCategoryText, setNewCategoryText] = useState('');

  const expenses = useLiveQuery(() => db.moduleRecords.where('module').equals('expense').reverse().offset((page - 1) * size).limit(size).toArray(), [page]);
  const allExpenses = useLiveQuery(() => db.moduleRecords.where('module').equals('expense').toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const count = useLiveQuery(() => db.moduleRecords.where('module').equals('expense').count()) || 0;

  const currentSettings = settings?.[0];
  const currency = currentSettings?.currency || "KSh";

  // Custom categories saved from this page, on top of the built-in defaults —
  // merged the same way on the Settings page's Expense Limits section, so
  // both pages always agree on the list. "Other" is kept last as a catch-all.
  const categories = Array.from(new Set([
    ...DEFAULT_EXPENSE_CATEGORIES.filter(c => c !== 'Other'),
    ...((currentSettings?.expenseCategories) || []),
    'Other',
  ]));

  const saveNewCategory = async () => {
    const value = newCategoryText.trim();
    if (!value) { setAddingCategory(false); return; }
    if (!categories.includes(value)) {
      const existing = await db.settings.toArray();
      const updatedList = Array.from(new Set([...(existing[0]?.expenseCategories || []), value]));
      if (existing.length > 0) {
        await db.settings.update(existing[0].id!, { expenseCategories: updatedList, updatedAt: new Date() });
      } else {
        await db.settings.add({ expenseCategories: updatedList, updatedAt: new Date() } as any);
      }
      await logAction('Expense', `Added new expense category: ${value}`);
    }
    setForm(f => ({ ...f, category: value }));
    setNewCategoryText('');
    setAddingCategory(false);
  };

  // Category Total Calculation (Requirement 14: Category Limits)
  // Sums this calendar month's expenses per category, so they can be
  // checked against the monthly limits configured in Settings.
  const categoryTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    const now = new Date();
    (allExpenses || []).forEach(e => {
      const d = new Date(e.data?.date || e.createdAt);
      if (d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()) {
        const cat = e.data?.category || 'Other';
        totals[cat] = (totals[cat] || 0) + (e.amount || 0);
      }
    });
    return totals;
  }, [allExpenses]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const limit = currentSettings?.expenseLimits?.[form.category];
    if (limit && Number(form.amount) > limit) {
      if (!confirm(`Warning: This expense exceeds the monthly limit of ${currency} ${limit} for ${form.category}. Proceed?`)) return;
    }

    const expenseAmount = Number(form.amount);

    await db.moduleRecords.add({
      module: 'expense',
      title: `${form.category}: ${form.description}`,
      status: 'Approved',
      amount: expenseAmount,
      data: { ...form, approvedBy: localStorage.getItem('username') },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // If this was paid out of the till, reflect it in the open cash drawer —
    // mirrors the "IN" movement POS checkout posts for cash sales, so the
    // drawer's tracked balance still matches physical cash after the payout.
    if (form.method === 'Cash' && expenseAmount > 0) {
      const openDrawers = await db.cashDrawers.where('status').equals('Open').toArray();
      const openDrawer = [...openDrawers].sort(
        (a: any, b: any) => new Date(b.openedAt).getTime() - new Date(a.openedAt).getTime()
      )[0];

      if (openDrawer) {
        await db.cashMovements.add({
          drawerId: openDrawer.id,
          type: 'OUT',
          amount: expenseAmount,
          reason: `${form.category} expense: ${form.description}`,
          date: new Date(),
          username: localStorage.getItem('username') || 'System'
        } as any);
      }
    }

    await logAction('Expense', `Recorded ${form.category} expense: ${form.amount}`);
    setForm({ category: 'Rent', description: '', amount: '', method: 'Cash', date: new Date().toISOString().split('T')[0] });
    setAddingCategory(false);
    setNewCategoryText('');
    document.getElementById('exp-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_expenses"
      fallback={
        <div className="min-h-screen bg-[#f8fafc] flex items-center justify-center p-5">
          <div className="gloss-card p-6 text-center max-w-lg">
            <div className="w-20 h-20 rounded-lg bg-danger/10 text-danger flex items-center justify-center mb-8 mx-auto">
              <Lock size={40} />
            </div>
            <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter mb-3">Access Restricted</h2>
            <p className="text-slate-500 font-bold text-sm">You don't have permission to view this page. Contact an administrator if you believe this is a mistake.</p>
          </div>
        </div>
      }
    >
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <div className="page-shell space-y-8">
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Wallet size={22} /></span>
              Expense Manager
            </h1>
            <p className="page-subtitle">Control outgoings & monthly budgets</p>
          </div>
          <button 
            onClick={() => document.getElementById('exp-modal')?.classList.remove('hidden')}
            className="btn btn-primary"
          >
            <Plus size={18} /> New Expense
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {expenses?.map(e => (
            <div key={e.id} className="gloss-card p-5 hover-lift relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity"><DollarSign size={80}/></div>
               <div className="flex justify-between items-start mb-6">
                  <span className="badge badge-info">{e.data.category}</span>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Calendar size={14}/> {new Date(e.data.date).toLocaleDateString()}</div>
               </div>
               <h3 className="text-xl font-black text-slate-900 tracking-tighter mb-4 leading-tight">{e.data.description}</h3>
               <div className="flex items-end justify-between border-t border-slate-50 pt-6">
                  <div>
                    <div className="text-lg font-black text-primary tracking-tighter">{currency} {e.amount?.toLocaleString()}</div>
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Via {e.data.method} • Approved by {e.data.approvedBy}</div>
                  </div>
                  <button onClick={() => { if (confirm('Delete this expense?')) db.moduleRecords.delete(e.id!); }} className="btn btn-icon btn-danger opacity-100 sm:opacity-0 sm:group-hover:opacity-100"><Trash2 size={16}/></button>
               </div>
            </div>
          ))}
        </div>

        {currentSettings?.expenseLimits && Object.values(currentSettings.expenseLimits).some(l => Number(l) > 0) && (
          <div className="gloss-card p-5 space-y-6">
            <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase">This Month's Category Spend</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
              {Object.entries(currentSettings.expenseLimits)
                .filter(([, limit]) => Number(limit) > 0)
                .map(([category, limit]) => {
                  const spent = categoryTotals[category] || 0;
                  const pct = Math.min(100, (spent / Number(limit)) * 100);
                  const overLimit = spent > Number(limit);
                  return (
                    <div key={category} className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                      <div className="flex justify-between items-center mb-3">
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{category}</span>
                        <span className={`text-[10px] font-black uppercase tracking-widest ${overLimit ? 'text-danger' : 'text-slate-400'}`}>
                          {currency} {spent.toLocaleString()} / {currency} {Number(limit).toLocaleString()}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${overLimit ? 'bg-danger' : 'bg-primary'}`} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        <Pagination totalItems={count} itemsPerPage={size} currentPage={page} onPageChange={setPage} />

        {/* Expense Modal */}
        <div id="exp-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high border border-white p-6 relative">
            <button onClick={() => { document.getElementById('exp-modal')?.classList.add('hidden'); setAddingCategory(false); setNewCategoryText(''); }} className="absolute top-10 right-10 p-3 rounded-2xl hover:bg-slate-50 transition-colors"><X size={24}/></button>
            <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-10">LOG EXPENSE</h2>
            <form onSubmit={handleSave} className="space-y-6">
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Category</label>
                   {addingCategory ? (
                     <div className="flex items-center gap-2">
                       <input
                         autoFocus
                         placeholder="New category..."
                         className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none"
                         value={newCategoryText}
                         onChange={e => setNewCategoryText(e.target.value)}
                         onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewCategory(); } if (e.key === 'Escape') { setAddingCategory(false); setNewCategoryText(''); } }}
                       />
                       <button type="button" onClick={saveNewCategory} className="p-3 rounded-2xl bg-primary text-white shrink-0"><Check size={16}/></button>
                       <button type="button" onClick={() => { setAddingCategory(false); setNewCategoryText(''); }} className="p-3 rounded-2xl bg-slate-100 text-slate-500 shrink-0"><X size={16}/></button>
                     </div>
                   ) : (
                     <select className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.category} onChange={e => {
                       if (e.target.value === ADD_NEW_EXPENSE_CATEGORY) { setAddingCategory(true); } else { setForm({...form, category: e.target.value}); }
                     }}>
                       {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       <option value={ADD_NEW_EXPENSE_CATEGORY}>+ Add new category...</option>
                     </select>
                   )}
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Payment Method</label>
                   <select className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.method} onChange={e => setForm({...form, method: e.target.value})}>
                     <option>Cash</option><option>M-Pesa</option><option>Card</option><option>Bank Transfer</option>
                   </select>
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Expense Description</label>
                 <input required className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="e.g. Monthly Electricity Bill" />
               </div>
               <div className="grid grid-cols-2 gap-6">
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Total Amount</label>
                   <div className="relative">
                     <div className="absolute left-5 top-1/2 -translate-y-1/2 font-black text-slate-300">{currency}</div>
                     <input type="number" required className="w-full p-5 pl-14 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                   </div>
                 </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Expense Date</label>
                   <input type="date" required className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.date} onChange={e => setForm({...form, date: e.target.value})} />
                 </div>
               </div>
               <button type="submit" className="btn btn-primary w-full">Record Transaction</button>
            </form>
          </div>
        </div>

      </div>
    </div>
    </PermissionGuard>
  );
}
