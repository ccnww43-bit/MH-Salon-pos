"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { ShieldCheck, Plus, Search, UserCheck, Calendar, X, Trash2, Award, Zap, Lock, Check } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

const DEFAULT_PLANS = ['Gold VIP', 'Platinum Elite', 'Standard Member'];

// Special sentinel value for the "+ Add new plan..." option in the dropdown.
const ADD_NEW_PLAN = '__add_new_plan__';

export default function MembershipsPage() {
  const memberships = useLiveQuery(() => db.moduleRecords.where('module').equals('membership').reverse().toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const [form, setForm] = useState({ customerId: '', plan: 'Gold VIP', discount: '10', expiry: '' });
  const [addingPlan, setAddingPlan] = useState(false);
  const [newPlanText, setNewPlanText] = useState('');

  // Custom plans saved from this page, on top of the 3 built-in defaults —
  // so "Add new plan" persists and shows up for every enrollment afterwards.
  const settingsRow = useLiveQuery(() => db.settings.toArray(), []);
  const plans = Array.from(new Set([...DEFAULT_PLANS, ...((settingsRow?.[0]?.membershipPlans) || [])]));

  const saveNewPlan = async () => {
    const value = newPlanText.trim();
    if (!value) { setAddingPlan(false); return; }
    if (!plans.includes(value)) {
      const existing = await db.settings.toArray();
      const updatedList = Array.from(new Set([...(existing[0]?.membershipPlans || []), value]));
      if (existing.length > 0) {
        await db.settings.update(existing[0].id!, { membershipPlans: updatedList, updatedAt: new Date() });
      } else {
        await db.settings.add({ membershipPlans: updatedList, updatedAt: new Date() } as any);
      }
      await logAction('Membership', `Added new membership plan: ${value}`);
    }
    setForm(f => ({ ...f, plan: value }));
    setNewPlanText('');
    setAddingPlan(false);
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const customer = customers?.find(c => String(c.id) === form.customerId);
    
    await db.moduleRecords.add({
      module: 'membership',
      title: `${form.plan}: ${customer?.name}`,
      status: 'Active',
      customerId: Number(form.customerId),
      data: { ...form, customerName: customer?.name },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await logAction('Membership', `Assigned ${form.plan} to ${customer?.name}`);
    setForm({ customerId: '', plan: 'Gold VIP', discount: '10', expiry: '' });
    setAddingPlan(false);
    setNewPlanText('');
    document.getElementById('mem-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_memberships"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><ShieldCheck size={22} /></span>
              VIP Memberships
            </h1>
            <p className="page-subtitle">Client tiering & recurring benefits</p>
          </div>
          <button onClick={() => document.getElementById('mem-modal')?.classList.remove('hidden')} className="btn btn-primary">
            <Plus size={18} /> Enroll Member
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
           {memberships?.map(m => (
             <div key={m.id} className="gloss-card p-5 hover-lift relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 text-primary/5 transition-colors group-hover:text-primary/10">
                   <Award size={100} strokeWidth={3}/>
                </div>
                <div className="flex justify-between items-start mb-8">
                   <span className="badge badge-purple">
                     {m.data.plan}
                   </span>
                   <div className="flex items-center gap-2 text-success font-black text-[10px] uppercase tracking-widest">
                     <Zap size={14}/> {m.data.discount}% OFF
                   </div>
                </div>
                <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-8 leading-tight">{m.data.customerName}</h3>
                <div className="flex items-center justify-between border-t border-slate-50 pt-6">
                   <div className="flex items-center gap-2 text-[10px] font-black text-slate-300 uppercase tracking-widest">
                      <Calendar size={14}/> Valid Until {m.data.expiry || 'Open'}
                   </div>
                   <button onClick={() => { if (confirm('Delete this membership?')) db.moduleRecords.delete(m.id!); }} className="btn btn-icon btn-danger"><Trash2 size={16}/></button>
                </div>
             </div>
           ))}
        </div>

        {!memberships?.length && (
          <div className="empty-state gloss-card">
            <div className="empty-state-icon"><ShieldCheck size={26} /></div>
            <div className="empty-state-title">No active memberships</div>
            <p className="empty-state-text">Enroll a client to start tracking VIP benefits.</p>
          </div>
        )}

        {/* Modal */}
        <div id="mem-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
              <button onClick={() => { document.getElementById('mem-modal')?.classList.add('hidden'); setAddingPlan(false); setNewPlanText(''); }} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-10">MEMBER ENROLLMENT</h2>
              <form onSubmit={handleCreate} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Choose Client</label>
                    <select required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})}>
                       <option value="">Select Member</option>
                       {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                 </div>
                 <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Membership Plan</label>
                      {addingPlan ? (
                        <div className="flex items-center gap-2">
                          <input
                            autoFocus
                            placeholder="Type new plan..."
                            className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none"
                            value={newPlanText}
                            onChange={e => setNewPlanText(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewPlan(); } if (e.key === 'Escape') { setAddingPlan(false); setNewPlanText(''); } }}
                          />
                          <button type="button" onClick={saveNewPlan} className="p-3 rounded-2xl bg-primary text-white shrink-0"><Check size={16}/></button>
                          <button type="button" onClick={() => { setAddingPlan(false); setNewPlanText(''); }} className="p-3 rounded-2xl bg-slate-100 text-slate-500 shrink-0"><X size={16}/></button>
                        </div>
                      ) : (
                        <select className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.plan} onChange={e => {
                          if (e.target.value === ADD_NEW_PLAN) { setAddingPlan(true); } else { setForm({...form, plan: e.target.value}); }
                        }}>
                           {plans.map(p => <option key={p} value={p}>{p}</option>)}
                           <option value={ADD_NEW_PLAN}>+ Add new plan...</option>
                        </select>
                      )}
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Auto-Discount (%)</label>
                      <input type="number" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.discount} onChange={e => setForm({...form, discount: e.target.value})} />
                   </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Membership Expiry Date</label>
                    <input type="date" required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.expiry} onChange={e => setForm({...form, expiry: e.target.value})} />
                 </div>
                 <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xl shadow-high hover:scale-[1.02] transition-all">CONFIRM VIP STATUS</button>
              </form>
           </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
