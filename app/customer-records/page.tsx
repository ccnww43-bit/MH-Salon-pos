"use client";

import React, { useState } from "react";
import { db, Customer } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { PermissionGuard } from "@/components/permissionguard";
import { CustomerQuickAdd } from "@/components/customer-quick-add";
import { logAction } from "@/lib/logger";
import { FileText, Plus, Clipboard, Calendar, X, User, Scissors, Lock } from "lucide-react";

export default function ClinicalRecordsPage() {
  const [page, setPage] = useState(1);
  const size = 10;

  const [form, setForm] = useState({ customerId: '', recordType: 'Consultation', staffId: '', notes: '' });
  const records = useLiveQuery(() => db.clinicalRecords.reverse().offset((page - 1) * size).limit(size).toArray(), [page]);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  // Staff dropdown must come from the real employee directory
  // (moduleRecords, module: 'staff') — the same source POS and Commissions
  // use — not from db.users, which is login accounts and can include
  // people who aren't actually staff (or exclude staff with no account).
  const staff = useLiveQuery(() => db.moduleRecords.where('module').equals('staff').and(s => s.status === 'Active').toArray(), []);
  const count = useLiveQuery(() => db.clinicalRecords.count()) || 0;

  // Workflow-audit fix: lets staff register a walk-in customer without
  // leaving the treatment-log form. `customers` above is a live query, so
  // the new record shows up in the dropdown automatically once saved —
  // this handler just selects it and closes the quick-add modal.
  const [showQuickAddCustomer, setShowQuickAddCustomer] = useState(false);
  const handleCustomerCreated = (c: Customer) => {
    setForm(f => ({ ...f, customerId: String(c.id) }));
    setShowQuickAddCustomer(false);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.customerId || !form.notes) return;

    const now = new Date();

    // FIXED: Providing createdAt and updatedAt to satisfy the strict ClinicalRecord interface
    await db.clinicalRecords.add({
      customerId: Number(form.customerId),
      recordType: form.recordType as any,
      staffId: Number(form.staffId),
      notes: form.notes,
      date: now,
      createdAt: now,
      updatedAt: now
    });

    await logAction('Clinical Records', `Added ${form.recordType} record for Client ID: ${form.customerId}`);
    setForm({ customerId: '', recordType: 'Consultation', staffId: '', notes: '' });
    document.getElementById('record-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="view_clinical_records"
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
    <Navbar />
    <div className="page-shell space-y-8 selection:bg-primary selection:text-white animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Clipboard size={20} /></span>
            Clinical Logs
          </h1>
          <p className="page-subtitle">Treatment History & Progress Notes</p>
        </div>

        <PermissionGuard permission="manage_clinical_records">
          <button
            onClick={() => document.getElementById('record-modal')?.classList.remove('hidden')}
            className="btn btn-primary"
          >
            <Plus size={16} /> New Treatment Log
          </button>
        </PermissionGuard>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {records?.map(r => {
          const client = customers?.find(c => c.id === r.customerId);
          const user = staff?.find(u => u.id === r.staffId);
          return (
            <div key={r.id} className="gloss-card p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 text-primary/5 group-hover:text-primary/10 transition-colors">
                <FileText size={100} strokeWidth={1} />
              </div>
              <div className="relative z-10">
                <div className="flex justify-between items-center mb-6">
                  <span className="badge badge-info">
                    {r.recordType}
                  </span>
                  <div className="text-[11px] font-bold text-slate-400 flex items-center gap-2">
                    <Calendar size={14}/> {new Date(r.date).toLocaleDateString()}
                  </div>
                </div>
                <h3 className="text-base font-black text-slate-900 tracking-tight mb-3 leading-tight uppercase">{client?.name || 'Walk-in Client'}</h3>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 mb-6">
                  <p className="text-slate-500 font-semibold text-sm leading-relaxed italic line-clamp-4">"{r.notes}"</p>
                </div>
                <div className="pt-4 border-t border-slate-100 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/5 flex items-center justify-center font-black text-primary text-xs uppercase">
                    {user?.title?.charAt(0) || '?'}
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-slate-400 leading-none mb-1">Logged Professional</div>
                    <div className="text-xs font-black text-slate-900 uppercase leading-none">{user?.title || 'Unknown'}</div>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!records?.length && (
        <div className="empty-state gloss-card">
          <div className="empty-state-icon"><Clipboard size={26} /></div>
          <p className="empty-state-title">No treatment history</p>
          <p className="empty-state-text">Logged treatments and consultation notes will show up here.</p>
        </div>
      )}

      <Pagination totalItems={count} itemsPerPage={size} currentPage={page} onPageChange={setPage} />

      {/* Modal Overlay */}
      <div id="record-modal" className="modal-backdrop hidden">
        <div className="modal-panel p-6 relative">
          <div className="absolute top-0 left-0 w-full h-2 bg-primary rounded-t-[24px]"></div>
          <button onClick={() => document.getElementById('record-modal')?.classList.add('hidden')} className="absolute top-5 right-5 btn btn-secondary btn-icon">
            <X size={18}/>
          </button>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mb-6 uppercase mt-2">Log treatment</h2>
          <form onSubmit={handleSave} className="space-y-5">
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
               <div>
                 <label className="field-label">Target Client</label>
                 <div className="flex gap-2">
                   <select required className="field-input w-full appearance-none cursor-pointer" value={form.customerId} onChange={e => setForm({...form, customerId: e.target.value})}>
                     <option value="">Identify Client...</option>
                     {customers?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                   <button
                     type="button"
                     onClick={() => setShowQuickAddCustomer(true)}
                     className="shrink-0 btn btn-secondary"
                     title="Register a new customer without leaving this form"
                   >
                     + New
                   </button>
                 </div>
               </div>
               <div>
                 <label className="field-label">Procedure Type</label>
                 <select className="field-input w-full appearance-none cursor-pointer" value={form.recordType} onChange={e => setForm({...form, recordType: e.target.value})}>
                   <option>Consultation</option><option>Treatment</option><option>Progress Note</option>
                 </select>
               </div>
             </div>
             <div>
               <label className="field-label">Verified Professional</label>
               <select required className="field-input w-full appearance-none cursor-pointer" value={form.staffId} onChange={e => setForm({...form, staffId: e.target.value})}>
                 <option value="">Authorize Professional...</option>
                 {staff?.map(u => <option key={u.id} value={u.id}>{u.title}</option>)}
               </select>
             </div>
             <div>
               <label className="field-label">Case Notes & Findings</label>
               <textarea required className="field-input w-full min-h-[160px]" placeholder="Document clinical findings and session outcomes..." value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} />
             </div>
             <button type="submit" className="btn btn-primary w-full">Confirm Log Entry</button>
          </form>
        </div>
      </div>
    </div>

    <CustomerQuickAdd
      open={showQuickAddCustomer}
      onClose={() => setShowQuickAddCustomer(false)}
      onCreated={handleCustomerCreated}
    />
    </PermissionGuard>
  );
}
