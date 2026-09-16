"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Megaphone, Plus, Search, Tag, Calendar, X, Trash2, Edit3, CheckCircle2, AlertCircle, Percent, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

export default function PromotionsPage() {
  const services = useLiveQuery(() => db.services.filter(s => s.isActive).toArray(), []);
  const promotions = useLiveQuery(() => db.moduleRecords.where('module').equals('promotion').reverse().toArray(), []);
  
  const [form, setForm] = useState({ name: '', discount: '', start: '', end: '', selectedServices: [] as number[], status: 'Active' });

  // Tracks which promotion is being edited. null means the modal (when
  // open) is in "create new campaign" mode.
  const [editingId, setEditingId] = useState<number | null>(null);

  const openCreateModal = () => {
    setEditingId(null);
    setForm({ name: '', discount: '', start: '', end: '', selectedServices: [], status: 'Active' });
    document.getElementById('promo-modal')?.classList.remove('hidden');
  };

  const openEditModal = (p: any) => {
    setEditingId(p.id);
    setForm({
      name: p.data.name || p.title || '',
      discount: p.data.discount != null ? String(p.data.discount) : String(p.amount ?? ''),
      start: p.data.start || '',
      end: p.data.end || '',
      selectedServices: p.data.selectedServices || [],
      status: p.status || 'Active',
    });
    document.getElementById('promo-modal')?.classList.remove('hidden');
  };

  const closeModal = () => {
    document.getElementById('promo-modal')?.classList.add('hidden');
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      await db.moduleRecords.update(editingId, {
        title: form.name,
        status: form.status,
        amount: Number(form.discount),
        data: { ...form },
        updatedAt: new Date()
      });

      await logAction('Promotion', `Updated marketing campaign: ${form.name} (${form.discount}%)`);
    } else {
      await db.moduleRecords.add({
        module: 'promotion',
        title: form.name,
        status: form.status,
        amount: Number(form.discount),
        data: { ...form },
        createdAt: new Date(),
        updatedAt: new Date()
      });

      await logAction('Promotion', `Launched marketing campaign: ${form.name} (${form.discount}%)`);
    }

    setForm({ name: '', discount: '', start: '', end: '', selectedServices: [], status: 'Active' });
    setEditingId(null);
    document.getElementById('promo-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_promotions"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Megaphone size={22} /></span>
              Marketing & Promotions
            </h1>
            <p className="page-subtitle">Campaign management & dynamic discounts</p>
          </div>
          <button onClick={openCreateModal} className="btn btn-primary">
            <Plus size={18} /> Create Campaign
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
           {promotions?.map(p => (
             <div key={p.id} className="gloss-card p-5 hover-lift relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-primary/5 transition-colors group-hover:text-primary/10">
                   <Percent size={100} strokeWidth={3}/>
                </div>
                <div className="flex justify-between items-start mb-8">
                   <span className={`badge ${p.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                     {p.status}
                   </span>
                   <div className="flex gap-1 relative z-10">
                     <button onClick={() => openEditModal(p)} className="btn btn-icon btn-secondary"><Edit3 size={16}/></button>
                     <button onClick={() => { if (confirm('Delete this promotion?')) db.moduleRecords.delete(p.id!); }} className="btn btn-icon btn-danger"><Trash2 size={16}/></button>
                   </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2 leading-tight">{p.title}</h3>
                <div className="text-2xl font-black text-primary tracking-tighter mb-8">{p.amount}% <span className="text-xs text-slate-300 uppercase tracking-widest font-black">OFF</span></div>
                
                <div className="space-y-2 mb-8 relative z-10">
                   {p.data.selectedServices?.map((sid: number) => (
                     <div key={sid} className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-2">
                        <div className="w-1 h-1 rounded-full bg-primary"></div>
                        {services?.find(s => s.id === sid)?.name}
                     </div>
                   ))}
                </div>

                <div className="flex items-center gap-2 text-[9px] font-black text-slate-300 uppercase tracking-widest pt-6 border-t border-slate-50">
                   <Calendar size={12}/> {p.data.start} — {p.data.end}
                </div>
             </div>
           ))}
        </div>

        {/* Modal */}
        <div id="promo-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
              <button onClick={closeModal} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-10">{editingId ? 'EDIT CAMPAIGN' : 'NEW CAMPAIGN'}</h2>
              <form onSubmit={handleSubmit} className="space-y-6">
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Campaign Title</label>
                       <input required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Summer Special" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Discount (%)</label>
                       <input type="number" min="0" max="100" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} />
                    </div>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Effective Date</label>
                       <input type="date" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.start} onChange={e => setForm({...form, start: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">End Date</label>
                       <input type="date" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.end} onChange={e => setForm({...form, end: e.target.value})} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Eligible Services</label>
                    <div className="grid grid-cols-2 gap-2 h-40 overflow-y-auto no-scrollbar bg-slate-50 p-4 rounded-3xl border border-slate-100">
                      {services?.map(s => (
                        <label key={s.id} className="flex items-center gap-3 p-3 bg-white rounded-2xl border border-slate-100 cursor-pointer">
                           <input type="checkbox" className="w-5 h-5 rounded-lg text-primary" checked={form.selectedServices.includes(s.id!)} onChange={e => setForm(f => ({...f, selectedServices: e.target.checked ? [...f.selectedServices, s.id!] : f.selectedServices.filter(id => id !== s.id)}))} />
                           <span className="text-[10px] font-black text-slate-700 uppercase">{s.name}</span>
                        </label>
                      ))}
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xl shadow-high hover:scale-[1.02] transition-all">{editingId ? 'SAVE CHANGES' : 'ACTIVATE CAMPAIGN'}</button>
              </form>
           </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
