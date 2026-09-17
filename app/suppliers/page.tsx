"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { logAction } from "@/lib/logger";
import { Truck, Plus, Search, Phone, Mail, MapPin, Trash2, Edit3, X, Lock } from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";

export default function SuppliersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const size = 10;

  const [form, setForm] = useState({ name: '', contactPerson: '', phone: '', email: '', address: '' });
  const [editing, setEditing] = useState<number | null>(null);

  // Reset to page 1 whenever the search changes so the user isn't stranded
  // on a now out-of-range page — same pattern used on Inventory/Loyalty.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const suppliers = useLiveQuery(async () => {
    const q = query.toLowerCase().trim();
    const coll = db.moduleRecords.where('module').equals('supplier');
    if (q) {
      const all = await coll.toArray();
      return all.filter(r => r.title.toLowerCase().includes(q)).slice((page - 1) * size, page * size);
    }
    return await coll.offset((page - 1) * size).limit(size).toArray();
  }, [page, query]);

  // Total must reflect the active search filter — otherwise Pagination
  // renders page numbers based on the full unfiltered vendor count while
  // the list above only ever has the (much smaller) filtered results.
  const count = useLiveQuery(async () => {
    const q = query.toLowerCase().trim();
    if (q) {
      const all = await db.moduleRecords.where('module').equals('supplier').toArray();
      return all.filter(r => r.title.toLowerCase().includes(q)).length;
    }
    return await db.moduleRecords.where('module').equals('supplier').count();
  }, [query]) || 0;

  const handleDelete = async (supplierId: number, name: string) => {
    const linkedProducts = await db.inventory.where('supplierId').equals(supplierId).count();

    const warning = linkedProducts > 0
      ? `${linkedProducts} product${linkedProducts === 1 ? '' : 's'} in Inventory ${linkedProducts === 1 ? 'is' : 'are'} linked to "${name}". Deleting this vendor will remove that link — those products will no longer show a supplier. Continue?`
      : `Purge Vendor?`;

    if (confirm(warning)) {
      await db.moduleRecords.delete(supplierId);
      await logAction('Suppliers', `Deleted vendor: ${name}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const now = new Date();
    if (editing) {
      await db.moduleRecords.update(editing, { title: form.name, data: form, updatedAt: now });
      await logAction('Suppliers', `Updated vendor: ${form.name}`);
    } else {
      await db.moduleRecords.add({ module: 'supplier', title: form.name, status: 'Active', data: form, createdAt: now, updatedAt: now });
      await logAction('Suppliers', `Added new vendor: ${form.name}`);
    }
    setForm({ name: '', contactPerson: '', phone: '', email: '', address: '' });
    setEditing(null);
    document.getElementById('sup-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_suppliers"
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
    <div className="page-shell space-y-8 animate-in fade-in duration-500 selection:bg-primary">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Truck size={20} /></span>
            Vendors
          </h1>
          <p className="page-subtitle">Supplier Directory & Procurement Sources</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative group w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
            <input placeholder="Search suppliers..." className="field-input w-full pl-11" value={query} onChange={e => setQuery(e.target.value)} />
          </div>
          <button onClick={() => { setEditing(null); setForm({ name:'', contactPerson:'', phone:'', email:'', address:'' }); document.getElementById('sup-modal')?.classList.remove('hidden'); }} className="btn btn-primary">
            <Plus size={16} /> New Vendor
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-6">
        {suppliers?.map(s => (
          <div key={s.id} className="gloss-card p-5 relative group">
             <div className="flex justify-between items-start mb-6">
                <div className="p-3 bg-primary/5 text-primary rounded-2xl"><Truck size={22}/></div>
                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                   <button onClick={() => { setEditing(s.id!); setForm(s.data); document.getElementById('sup-modal')?.classList.remove('hidden'); }} className="btn btn-secondary btn-icon" aria-label="Edit vendor"><Edit3 size={16}/></button>
                   <button onClick={() => handleDelete(s.id!, s.title)} className="btn btn-danger btn-icon" aria-label="Delete vendor"><Trash2 size={16}/></button>
                </div>
             </div>
             <h3 className="text-base font-black text-slate-900 tracking-tight mb-4 uppercase leading-tight">{s.title}</h3>
             <div className="space-y-3 border-t border-slate-100 pt-4">
                <div className="flex items-center gap-3 text-slate-600 font-bold text-sm">
                   <Phone size={14} className="text-primary shrink-0"/> {s.data.phone}
                </div>
                <div className="flex items-center gap-3 text-slate-400 text-xs font-bold">
                   <Mail size={14} className="shrink-0"/> {s.data.email || 'No email provided'}
                </div>
                <div className="flex items-start gap-3 text-slate-400 text-xs font-semibold leading-relaxed">
                   <MapPin size={14} className="shrink-0 mt-0.5"/> {s.data.address || 'Address not logged'}
                </div>
             </div>
          </div>
        ))}
      </div>

      {!suppliers?.length && (
        <div className="empty-state gloss-card">
          <div className="empty-state-icon"><Truck size={26} /></div>
          <p className="empty-state-title">No vendors registered</p>
          <p className="empty-state-text">Add a vendor to start tracking purchase orders and contacts.</p>
        </div>
      )}

      <Pagination totalItems={count} itemsPerPage={size} currentPage={page} onPageChange={setPage} />

      {/* Modal */}
      <div id="sup-modal" className="modal-backdrop hidden">
         <div className="modal-panel p-6 relative">
            <button onClick={() => document.getElementById('sup-modal')?.classList.add('hidden')} className="absolute top-5 right-5 btn btn-secondary btn-icon" aria-label="Close"><X size={18}/></button>
            <h2 className="text-lg font-black text-slate-900 tracking-tight mb-6 uppercase">{editing ? 'Update Vendor' : 'Onboard Vendor'}</h2>
            <form onSubmit={handleSave} className="space-y-5">
               <div>
                  <label className="field-label">Company Identity Name</label>
                  <input required className="field-input w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                     <label className="field-label">Point of Contact</label>
                     <input className="field-input w-full" value={form.contactPerson} onChange={e => setForm({...form, contactPerson: e.target.value})} />
                  </div>
                  <div>
                     <label className="field-label">Mobile Channel</label>
                     <input required className="field-input w-full" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                  </div>
               </div>
               <div>
                  <label className="field-label">Physical/Postal Address</label>
                  <textarea className="field-input w-full" value={form.address} onChange={e => setForm({...form, address: e.target.value})} />
               </div>
               <button type="submit" className="btn btn-primary w-full">Commit Vendor Data</button>
            </form>
         </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
