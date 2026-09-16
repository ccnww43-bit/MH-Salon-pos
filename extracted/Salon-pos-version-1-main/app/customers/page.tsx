"use client";

import React, { useState } from "react";
import { db, Customer, Sale, Booking, ClinicalRecord } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { PermissionGuard } from "@/components/permissionguard";
import { logAction } from "@/lib/logger";
import { Search, UserPlus, Phone, Mail, Calendar, Trash2, Edit3, UserCheck, AlertCircle, X, Eye, ShoppingBag, Clipboard, CreditCard, Star } from "lucide-react";

export default function CustomersPage() {
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const size = 10;

  const [form, setForm] = useState({ name: '', phone: '', email: '', gender: 'Female', dob: '', notes: '' });
  const [editing, setEditing] = useState<number | null>(null);

  // Client profile view: lets staff see one client's visit history, purchase
  // history and clinical notes without hunting across Transactions, Bookings
  // and Customer Records separately.
  const [viewingCustomer, setViewingCustomer] = useState<Customer | null>(null);

  const customerSales = useLiveQuery(
    () => viewingCustomer?.id
      ? db.sales.where('customerId').equals(viewingCustomer.id).sortBy('createdAt').then(a => a.reverse())
      : Promise.resolve([] as Sale[]),
    [viewingCustomer?.id]
  );

  const customerBookings = useLiveQuery(
    () => viewingCustomer?.id
      ? db.bookings.where('customerId').equals(viewingCustomer.id).sortBy('bookingDate').then(a => a.reverse())
      : Promise.resolve([] as Booking[]),
    [viewingCustomer?.id]
  );

  const customerRecords = useLiveQuery(
    () => viewingCustomer?.id
      ? db.clinicalRecords.where('customerId').equals(viewingCustomer.id).sortBy('date').then(a => a.reverse())
      : Promise.resolve([] as ClinicalRecord[]),
    [viewingCustomer?.id]
  );

  const customers = useLiveQuery(async () => {
    const q = query.toLowerCase().trim();
    const coll = db.customers;
    if (q) {
      // FIXED: Using !! to ensure the filter returns a strict boolean to pass the build
      return await coll.filter(c => 
        c.name.toLowerCase().includes(q) || 
        c.phone.includes(q) || 
        !!(c.email?.toLowerCase().includes(q))
      ).offset((page - 1) * size).limit(size).toArray();
    }
    return await coll.offset((page - 1) * size).limit(size).toArray();
  }, [page, query]);

  const total = useLiveQuery(() => db.customers.count()) || 0;

  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const currency = settings?.[0]?.currency || "KSh";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editing) {
      // FIX: Do NOT overwrite creditBalance/loyaltyPoints when editing an existing customer.
      // Only update the fields actually present in the edit form.
      const data = { ...form, updatedAt: new Date() };
      await db.customers.update(editing, data);
      await logAction('Customer Management', `Updated client: ${form.name}`);
    } else {
      // New customers correctly start with zeroed credit balance and loyalty points.
      const data = { ...form, creditBalance: 0, loyaltyPoints: 0, updatedAt: new Date() };
      await db.customers.add({ ...data, createdAt: new Date() } as Customer);
      await logAction('Customer Management', `Registered client: ${form.name}`);
    }
    
    setForm({ name: '', phone: '', email: '', gender: 'Female', dob: '', notes: '' });
    setEditing(null);
  };

  return (
    <>
    <Navbar />
    <div className="page-shell space-y-8 selection:bg-primary selection:text-white animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><UserCheck size={22} /></span>
            Client Base
          </h1>
          <p className="page-subtitle">Directory & loyalty profiles</p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <div className="relative group w-full sm:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              placeholder="Search clients..." 
              className="field-input w-full pl-11"
              value={query} onChange={e => setQuery(e.target.value)}
            />
          </div>
          <PermissionGuard permission="create_customers">
            <button onClick={() => { setEditing(null); setForm({ name: '', phone: '', email: '', gender: 'Female', dob: '', notes: '' }); }} className="btn btn-primary shrink-0">New Client</button>
          </PermissionGuard>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2">
          <div className="table-card">
            <div className="table-scroll">
            <table className="w-full text-left">
              <thead className="bg-slate-50/50 border-b border-slate-100">
                <tr>
                  <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Identity</th>
                  <th className="px-4 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact</th>
                  <th className="px-4 py-6 text-right text-[10px] font-black text-slate-400 uppercase tracking-widest">Manage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {customers?.map(c => (
                  <tr key={c.id} className="group hover:bg-slate-50/50 transition-colors">
                    <td className="px-4 py-2.5">
                      <div className="font-black text-slate-900 text-lg tracking-tight mb-1">{c.name}</div>
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{c.gender} • Joined {new Date(c.createdAt).toLocaleDateString()}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3 text-slate-600 font-bold mb-1"><Phone size={14} className="text-primary"/> {c.phone}</div>
                      {c.email && <div className="flex items-center gap-3 text-slate-400 text-xs font-bold"><Mail size={14}/> {c.email}</div>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                        <button onClick={() => setViewingCustomer(c)} className="p-3 rounded-2xl bg-white border border-slate-100 text-slate-500 shadow-sm hover:shadow-lg transition-all active-click" title="View profile"><Eye size={18}/></button>
                        <button onClick={() => { setEditing(c.id!); setForm(c as any); }} className="p-3 rounded-2xl bg-white border border-slate-100 text-primary shadow-sm hover:shadow-lg transition-all active-click"><Edit3 size={18}/></button>
                        <button onClick={async () => { if(confirm('Delete client profile?')) await db.customers.delete(c.id!) }} className="p-3 rounded-2xl bg-white border border-slate-100 text-danger shadow-sm hover:shadow-lg transition-all active-click"><Trash2 size={18}/></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {!customers?.length && (
              <div className="empty-state">
                <div className="empty-state-icon"><AlertCircle size={26} /></div>
                <div className="empty-state-title">Directory empty</div>
                <p className="empty-state-text">Add your first client to get started.</p>
              </div>
            )}
          </div>
          <Pagination totalItems={total} itemsPerPage={size} currentPage={page} onPageChange={setPage} />
        </div>

        <div className="xl:col-span-1">
          <form onSubmit={handleSave} className="bg-white p-5 rounded-xl shadow-high border border-white space-y-6">
            <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-8 leading-none uppercase">{editing ? 'Override Client' : 'New Registration'}</h2>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Full Legal Name</label>
              <input required className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none transition-all" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Primary Phone</label>
              <input required className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none transition-all" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Gender</label>
                <select className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none" value={form.gender} onChange={e => setForm({...form, gender: e.target.value})}><option>Female</option><option>Male</option><option>Other</option></select>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Birth Date</label>
                <input type="date" className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 font-bold outline-none text-xs" value={form.dob} onChange={e => setForm({...form, dob: e.target.value})} />
              </div>
            </div>
            <button type="submit" className="w-full bg-primary text-white py-6 rounded-4xl font-black shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-widest text-xs">Commit Profile Data</button>
          </form>
        </div>
      </div>

      {viewingCustomer && (
        <div className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-xl flex items-center justify-center p-4 animate-in fade-in duration-300">
          <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-xl shadow-high border border-white overflow-y-auto no-scrollbar p-6 space-y-12">
            <div className="flex justify-between items-start">
              <div>
                <div className="text-[10px] font-black text-primary uppercase tracking-[0.4em] mb-2 leading-none">Client Profile</div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tighter leading-none">{viewingCustomer.name}</h2>
                <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mt-3">{viewingCustomer.gender} • Joined {new Date(viewingCustomer.createdAt).toLocaleDateString()}</div>
              </div>
              <button onClick={() => setViewingCustomer(null)} className="p-4 bg-slate-50 rounded-3xl text-slate-200 hover:text-slate-900 transition-all active-click leading-none"><X size={32}/></button>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-6">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2"><Phone size={12}/> Phone</div>
                <div className="font-black text-slate-900 text-sm">{viewingCustomer.phone}</div>
              </div>
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-6">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2"><Mail size={12}/> Email</div>
                <div className="font-black text-slate-900 text-sm truncate">{viewingCustomer.email || 'Not provided'}</div>
              </div>
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-6">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2"><CreditCard size={12}/> Credit balance</div>
                <div className="font-black text-slate-900 text-sm">{currency} {(viewingCustomer.creditBalance || 0).toLocaleString()}</div>
              </div>
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-6">
                <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2"><Star size={12}/> Loyalty points</div>
                <div className="font-black text-slate-900 text-sm">{viewingCustomer.loyaltyPoints || 0}</div>
              </div>
            </div>

            {viewingCustomer.notes && (
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-4">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Notes</div>
                <div className="font-bold text-slate-600 text-sm leading-relaxed">{viewingCustomer.notes}</div>
              </div>
            )}

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-900"><ShoppingBag size={16} className="text-primary"/><h3 className="text-lg font-black tracking-tighter uppercase">Purchase History</h3></div>
              <div className="space-y-3">
                {customerSales?.slice(0, 8).map(s => (
                  <div key={s.id} className="flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-lg px-4 py-5">
                    <div>
                      <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{s.receiptNumber}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(s.createdAt).toLocaleString()} • {s.status}</div>
                    </div>
                    <div className="font-black text-primary text-lg">{currency} {s.total.toLocaleString()}</div>
                  </div>
                ))}
                {!customerSales?.length && (
                  <div className="text-center py-2.5 text-slate-300 font-black text-xs uppercase tracking-widest">No purchases yet</div>
                )}
              </div>
            </div>

            <div className="space-y-5">
              <div className="flex items-center gap-2 text-slate-900"><Calendar size={16} className="text-primary"/><h3 className="text-lg font-black tracking-tighter uppercase">Appointments</h3></div>
              <div className="space-y-3">
                {customerBookings?.slice(0, 8).map(b => (
                  <div key={b.id} className="flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-lg px-4 py-5">
                    <div>
                      <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{b.services.map(sv => sv.name).join(', ') || 'Booking'}</div>
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">{new Date(b.bookingDate).toLocaleDateString()} • {b.startTime} • {b.staffName || 'Unassigned'}</div>
                    </div>
                    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${b.status === 'Completed' ? 'bg-success/10 text-success' : b.status === 'Cancelled' || b.status === 'No Show' ? 'bg-danger/10 text-danger' : 'bg-primary/10 text-primary'}`}>{b.status}</span>
                  </div>
                ))}
                {!customerBookings?.length && (
                  <div className="text-center py-2.5 text-slate-300 font-black text-xs uppercase tracking-widest">No appointments yet</div>
                )}
              </div>
            </div>

            <PermissionGuard permission="view_clinical_records">
              <div className="space-y-5">
                <div className="flex items-center gap-2 text-slate-900"><Clipboard size={16} className="text-primary"/><h3 className="text-lg font-black tracking-tighter uppercase">Clinical Notes</h3></div>
                <div className="space-y-3">
                  {customerRecords?.slice(0, 8).map(r => (
                    <div key={r.id} className="bg-slate-50/50 border border-slate-100 rounded-lg px-4 py-5">
                      <div className="flex justify-between items-center mb-1">
                        <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{r.recordType}</div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{new Date(r.date).toLocaleDateString()}</div>
                      </div>
                      <div className="text-sm font-bold text-slate-500 leading-relaxed">{r.notes}</div>
                    </div>
                  ))}
                  {!customerRecords?.length && (
                    <div className="text-center py-2.5 text-slate-300 font-black text-xs uppercase tracking-widest">No clinical notes yet</div>
                  )}
                </div>
              </div>
            </PermissionGuard>
          </div>
        </div>
      )}
    </div>
    </>
  );
}
