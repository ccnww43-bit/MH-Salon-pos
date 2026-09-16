"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Package, Plus, Search, Layers, Scissors, User, Trash2, X, AlertCircle, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

export default function PackagesPage() {
  const packages = useLiveQuery(() => db.moduleRecords.where('module').equals('package').reverse().toArray(), []);
  const services = useLiveQuery(() => db.services.filter(s => s.isActive).toArray(), []);
  const [form, setForm] = useState({ name: '', price: '', sessions: '', selectedServices: [] as number[] });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();

    // FIXED: Added mandatory 'status' property to satisfy the ModuleRecord interface
    await db.moduleRecords.add({
      module: 'package',
      title: form.name,
      status: 'Active',
      amount: Number(form.price),
      quantity: Number(form.sessions),
      data: { ...form },
      createdAt: now,
      updatedAt: now
    });

    await logAction('Package Management', `Created bundle: ${form.name}`);
    setForm({ name: '', price: '', sessions: '', selectedServices: [] });
    document.getElementById('pkg-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_packages"
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
      <div className="page-shell space-y-8 animate-in fade-in duration-500">
        <div className="page-header">
          <div>
            <h1 className="page-title flex items-center gap-4">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Package size={22} /></span>
              Bundled Packages
            </h1>
            <p className="page-subtitle">Multi-session prepaid services</p>
          </div>
          <button onClick={() => document.getElementById('pkg-modal')?.classList.remove('hidden')} className="btn btn-primary">
            <Plus size={18} /> Create Bundle
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
           {packages?.map(p => (
             <div key={p.id} className="gloss-card p-5 hover-lift group relative overflow-hidden flex flex-col">
                <div className="absolute top-0 right-0 p-5 text-primary/5 group-hover:text-primary/10 transition-colors">
                   <Layers size={120} strokeWidth={2}/>
                </div>
                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="text-lg font-black text-slate-900 tracking-tighter mb-4 leading-tight uppercase">{p.title}</h3>
                  <div className="flex gap-3 mb-10">
                    <div className="bg-primary/5 px-5 py-2 rounded-2xl border border-primary/5">
                      <span className="text-[10px] font-black text-primary uppercase tracking-widest leading-none">{p.quantity} SESSIONS</span>
                    </div>
                    <div className="bg-slate-50 px-5 py-2 rounded-2xl border border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">KSh {p.amount?.toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <div className="space-y-3 mb-12 flex-1">
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-4 leading-none">Included Services</div>
                    {p.data.selectedServices.map((sid: number) => (
                      <div key={sid} className="flex items-center gap-3 text-xs font-bold text-slate-600 uppercase tracking-tight">
                          <div className="w-2 h-2 rounded-full bg-primary/20 shadow-inner"></div>
                          {services?.find(s => s.id === sid)?.name || 'Service Asset'}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-between border-t border-slate-50 pt-8">
                    <div className="text-[9px] font-black text-slate-300 uppercase tracking-widest leading-none">Updated {new Date(p.updatedAt).toLocaleDateString()}</div>
                    <button onClick={async () => { if(confirm('Purge Bundle?')) await db.moduleRecords.delete(p.id!) }} className="p-4 bg-red-50 text-red-200 hover:text-red-500 rounded-2xl transition-all active-click shadow-sm"><Trash2 size={20}/></button>
                  </div>
                </div>
             </div>
           ))}
        </div>

        {!packages?.length && (
          <div className="empty-state gloss-card">
            <div className="empty-state-icon"><Package size={26} /></div>
            <div className="empty-state-title">No active bundles</div>
            <p className="empty-state-text">Create a package to bundle sessions together.</p>
          </div>
        )}

        {/* Modal Overlay */}
        <div id="pkg-modal" className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-2xl hidden flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
              <div className="absolute top-0 left-0 w-full h-3 bg-primary"></div>
              <button onClick={() => document.getElementById('pkg-modal')?.classList.add('hidden')} className="absolute top-12 right-12 p-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-200 hover:text-slate-900 leading-none"><X size={32}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-12 uppercase leading-none">Bundle design</h2>
              <form onSubmit={handleCreate} className="space-y-8 leading-none">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6 mb-2 block">Identity Name</label>
                    <input required className="w-full p-7 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all text-lg" value={form.name} onChange={e => setForm({...form, name: e.target.value})} placeholder="e.g. Prestige Bridal Glow" />
                 </div>
                 <div className="grid grid-cols-2 gap-8">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6 mb-2 block">Prepaid Price (KSh)</label>
                      <input type="number" required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all" value={form.price} onChange={e => setForm({...form, price: e.target.value})} />
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6 mb-2 block">Authorized Sessions</label>
                      <input type="number" required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all" value={form.sessions} onChange={e => setForm({...form, sessions: e.target.value})} />
                   </div>
                 </div>
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6 mb-1 block">Logic Selection: Included Services</label>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto no-scrollbar bg-slate-50 p-6 rounded-4xl border border-slate-100 shadow-inner">
                      {services?.map(s => (
                        <label key={s.id} className={`flex items-center gap-4 p-4 rounded-3xl border transition-all cursor-pointer ${form.selectedServices.includes(s.id!) ? 'bg-primary text-white border-primary shadow-glow-primary scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-primary/20'}`}>
                           <input type="checkbox" className="hidden" checked={form.selectedServices.includes(s.id!)} onChange={e => setForm(f => ({...f, selectedServices: e.target.checked ? [...f.selectedServices, s.id!] : f.selectedServices.filter(id => id !== s.id)}))} />
                           <span className="text-[10px] font-black uppercase tracking-widest leading-none">{s.name}</span>
                        </label>
                      ))}
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-5xl font-black text-2xl shadow-high hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter mt-6">Confirm bundle offer</button>
              </form>
           </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
