"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Gift, Plus, Search, Tag, Calendar, AlertCircle, Trash2, X, CheckCircle2, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

export default function VouchersPage() {
  const vouchers = useLiveQuery(() => db.moduleRecords.where('module').equals('voucher').reverse().toArray(), []);
  const [form, setForm] = useState({ code: '', amount: '', expiry: '' });

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = Number(form.amount);
    if (!value || value <= 0) {
      alert("Enter a voucher value greater than 0.");
      return;
    }
    const code = (form.code || `VCH-${Math.random().toString(36).toUpperCase().substr(2, 6)}`).trim().toUpperCase();

    const duplicate = vouchers?.find(v => (v.title || '').trim().toUpperCase() === code);
    if (duplicate) {
      alert(`Voucher code "${code}" is already in use. Choose a different code.`);
      return;
    }

    await db.moduleRecords.add({
      module: 'voucher',
      title: code,
      status: 'Active',
      amount: value,
      data: { ...form, code, balance: value },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await logAction('Voucher', `Issued voucher ${code} with value ${form.amount}`);
    setForm({ code: '', amount: '', expiry: '' });
    document.getElementById('vch-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_vouchers"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Gift size={22} /></span>
              Gift Vouchers
            </h1>
            <p className="page-subtitle">Store credit & prepaid gift management</p>
          </div>
          <button onClick={() => document.getElementById('vch-modal')?.classList.remove('hidden')} className="btn btn-primary">
            <Plus size={18} /> Issue Voucher
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
           {vouchers?.map(v => (
             <div key={v.id} className="gloss-card p-5 hover-lift relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-primary/5 transition-colors group-hover:text-primary/10">
                   <Tag size={100} strokeWidth={3}/>
                </div>
                <div className="flex justify-between items-start mb-8">
                   <span className="badge badge-neutral">
                     Code: {v.title}
                   </span>
                   <span className={`badge ${v.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                     {v.status}
                   </span>
                </div>
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Available Balance</div>
                <div className="text-2xl font-black text-slate-900 tracking-tighter mb-8">KSh {v.amount?.toLocaleString()}</div>
                <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      <Calendar size={14}/> Expires {v.data.expiry || 'Never'}
                   </div>
                   <button onClick={() => { if (confirm('Delete this voucher?')) db.moduleRecords.delete(v.id!); }} className="btn btn-icon btn-danger"><Trash2 size={16}/></button>
                </div>
             </div>
           ))}
        </div>

        {!vouchers?.length && (
          <div className="empty-state gloss-card">
            <div className="empty-state-icon"><Gift size={26} /></div>
            <div className="empty-state-title">No vouchers issued</div>
            <p className="empty-state-text">Issue a gift voucher to get started.</p>
          </div>
        )}

        {/* Modal */}
        <div id="vch-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
             <button onClick={() => document.getElementById('vch-modal')?.classList.add('hidden')} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32}/></button>
             <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-10">ISSUE VOUCHER</h2>
             <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Voucher Value (KSh)</label>
                   <input type="number" required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:ring-8 focus:ring-primary/5" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Custom Code (Optional)</label>
                     <input className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.code} onChange={e => setForm({...form, code: e.target.value})} placeholder="Auto-generate" />
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Expiry Date</label>
                     <input type="date" className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} />
                  </div>
                </div>
                <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xl shadow-high hover:scale-[1.02] transition-all">ACTIVATE STORE CREDIT</button>
             </form>
          </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
