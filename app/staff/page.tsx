"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { Briefcase, Plus, User, Phone, Edit3, Trash2, X, ShieldCheck, Link2, Lock, Check } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

const emptyStaffForm = { name: '', phone: '', position: 'Senior Stylist', status: 'Active', userId: '' };

const DEFAULT_POSITIONS = ['Senior Stylist', 'Junior Stylist', 'Beautician', 'Receptionist', 'Specialist'];

// Special sentinel value for the "+ Add new position..." option in the dropdown.
const ADD_NEW_POSITION = '__add_new_position__';

export default function StaffPage() {
  const [page, setPage] = useState(1);
  const size = 12;

  const [form, setForm] = useState(emptyStaffForm);
  const [editing, setEditing] = useState<number | null>(null);
  const [addingPosition, setAddingPosition] = useState(false);
  const [newPositionText, setNewPositionText] = useState('');

  const staff = useLiveQuery(async () => {
    return await db.moduleRecords.where('module').equals('staff').offset((page - 1) * size).limit(size).toArray();
  }, [page]);

  const count = useLiveQuery(() => db.moduleRecords.where('module').equals('staff').count()) || 0;

  // Custom positions saved from this page, on top of the 5 built-in defaults —
  // so "Add new position" persists and shows up for every profile afterwards.
  const settingsRow = useLiveQuery(() => db.settings.toArray(), []);
  const positions = Array.from(new Set([...DEFAULT_POSITIONS, ...((settingsRow?.[0]?.staffPositions) || [])]));

  const saveNewPosition = async () => {
    const value = newPositionText.trim();
    if (!value) { setAddingPosition(false); return; }
    if (!positions.includes(value)) {
      const existing = await db.settings.toArray();
      const updatedList = Array.from(new Set([...(existing[0]?.staffPositions || []), value]));
      if (existing.length > 0) {
        await db.settings.update(existing[0].id!, { staffPositions: updatedList, updatedAt: new Date() });
      } else {
        await db.settings.add({ staffPositions: updatedList, updatedAt: new Date() } as any);
      }
      await logAction('HR', `Added new staff position: ${value}`);
    }
    setForm(f => ({ ...f, position: value }));
    setNewPositionText('');
    setAddingPosition(false);
  };

  // Real login accounts (the same "staff" already used by POS, Bookings and
  // Commissions). Offered here so an HR profile can optionally be linked to
  // the login account the same person uses operationally.
  const loginAccounts = useLiveQuery(() => db.users.filter(u => u.isActive).toArray(), []);
  const allLoginAccounts = useLiveQuery(() => db.users.toArray(), []);

  const linkedAccountInfo = (userId?: string) => {
    if (!userId) return null;
    const acc = allLoginAccounts?.find(u => String(u.id) === String(userId));
    if (!acc) return null;
    return { username: acc.username, isActive: acc.isActive };
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.userId) {
      const allStaff = await db.moduleRecords.where('module').equals('staff').toArray();
      const linkedElsewhere = allStaff.find(s => s.id !== editing && String(s.data?.userId || '') === String(form.userId));
      if (linkedElsewhere) {
        alert(`That login account is already linked to ${linkedElsewhere.title}. Please choose a different account.`);
        return;
      }
    }

    const now = new Date();
    if (editing) {
      await db.moduleRecords.update(editing, { title: form.name, status: form.status, data: form, updatedAt: now });
      await logAction('HR', `Modified profile: ${form.name}`);
    } else {
      await db.moduleRecords.add({ module: 'staff', title: form.name, status: form.status, data: form, createdAt: now, updatedAt: now });
      await logAction('HR', `Created profile: ${form.name}`);
    }
    setForm(emptyStaffForm);
    setEditing(null);
    document.getElementById('hr-modal')?.classList.add('hidden');
  };

  return (
    <PermissionGuard
      permission="manage_staff"
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
    <div className="page-shell space-y-8 animate-in fade-in duration-700 selection:bg-primary">
      <div className="page-header">
        <div>
          <h1 className="page-title">Professionals</h1>
          <p className="page-subtitle">Human Resource & Service Capability</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(emptyStaffForm); setAddingPosition(false); setNewPositionText(''); document.getElementById('hr-modal')?.classList.remove('hidden'); }} className="btn btn-primary">
          <Plus size={16} /> Add Professional
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {staff?.map(s => (
          <div key={s.id} className={`gloss-card p-5 relative group transition-all ${s.status !== 'Active' && 'opacity-40 grayscale'}`}>
             <div className="flex justify-between items-start mb-6">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-primary text-xl uppercase">{s.title.charAt(0)}</div>
                <div className="flex gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-all">
                   <button onClick={() => { setEditing(s.id!); setForm({ ...emptyStaffForm, ...s.data }); setAddingPosition(false); setNewPositionText(''); document.getElementById('hr-modal')?.classList.remove('hidden'); }} className="btn btn-secondary btn-icon" aria-label="Edit profile"><Edit3 size={16}/></button>
                   <button onClick={async () => { if(confirm('Remove profile? Their past sales stay recorded, but will no longer show up under this professional in Commission reports.')) { await db.moduleRecords.delete(s.id!); await logAction('HR', `Removed profile: ${s.title}`); } }} className="btn btn-danger btn-icon" aria-label="Delete profile"><Trash2 size={16}/></button>
                </div>
             </div>
             <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight mb-1">{s.title}</h3>
             <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-3">{s.data.position}</div>
             {(() => {
               const info = linkedAccountInfo(s.data.userId);
               if (info?.isActive) {
                 return (
                   <div className="flex items-center gap-2 text-[10px] font-bold text-success mb-6">
                     <Link2 size={12}/> Linked to login: {info.username}
                   </div>
                 );
               }
               if (info && !info.isActive) {
                 return (
                   <div className="flex items-center gap-2 text-[10px] font-bold text-amber-500 mb-6">
                     <Link2 size={12}/> Linked login deactivated: {info.username}
                   </div>
                 );
               }
               return (
                 <div className="flex items-center gap-2 text-[10px] font-bold text-slate-300 mb-6">
                   <Link2 size={12}/> No login account linked
                 </div>
               );
             })()}
             <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                <div className="flex items-center gap-2 text-slate-400 font-bold text-xs"><Phone size={14}/> {s.data.phone}</div>
                <span className={`badge ${s.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>{s.status}</span>
             </div>
          </div>
        ))}
      </div>

      {!staff?.length && (
        <div className="empty-state gloss-card">
          <div className="empty-state-icon"><User size={26} /></div>
          <p className="empty-state-title">No professionals yet</p>
          <p className="empty-state-text">Add your stylists and staff to start assigning sales and commissions.</p>
        </div>
      )}

      <Pagination totalItems={count} itemsPerPage={size} currentPage={page} onPageChange={setPage} />

      <div id="hr-modal" className="modal-backdrop hidden">
        <div className="modal-panel p-6 relative">
          <button onClick={() => document.getElementById('hr-modal')?.classList.add('hidden')} className="absolute top-5 right-5 btn btn-secondary btn-icon" aria-label="Close"><X size={18}/></button>
          <h2 className="text-lg font-black text-slate-900 tracking-tight mb-6 uppercase">{editing ? 'Override Profile' : 'Register Profile'}</h2>
          <form onSubmit={handleSave} className="space-y-5">
             <div>
               <label className="field-label">Professional Identity Name</label>
               <input required className="field-input w-full" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="field-label">Primary Position</label>
                  {addingPosition ? (
                    <div className="flex items-center gap-2">
                      <input
                        autoFocus
                        placeholder="Type new position..."
                        className="field-input w-full"
                        value={newPositionText}
                        onChange={e => setNewPositionText(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); saveNewPosition(); } if (e.key === 'Escape') { setAddingPosition(false); setNewPositionText(''); } }}
                      />
                      <button type="button" onClick={saveNewPosition} className="btn btn-primary btn-icon shrink-0"><Check size={16}/></button>
                      <button type="button" onClick={() => { setAddingPosition(false); setNewPositionText(''); }} className="btn btn-secondary btn-icon shrink-0"><X size={16}/></button>
                    </div>
                  ) : (
                    <select className="field-input w-full appearance-none cursor-pointer" value={form.position} onChange={e => {
                      if (e.target.value === ADD_NEW_POSITION) { setAddingPosition(true); } else { setForm({...form, position: e.target.value}); }
                    }}>
                       {positions.map(p => <option key={p} value={p}>{p}</option>)}
                       <option value={ADD_NEW_POSITION}>+ Add new position...</option>
                    </select>
                  )}
                </div>
                <div>
                  <label className="field-label">Mobile Contact</label>
                  <input required className="field-input w-full" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
                </div>
             </div>
             <div>
                <label className="field-label">Employment Status</label>
                <select className="field-input w-full appearance-none cursor-pointer" value={form.status} onChange={e => setForm({...form, status: e.target.value})}>
                   <option value="Active">Operational / Active</option>
                   <option value="On Leave">Temporary Absence / Leave</option>
                   <option value="Inactive">Terminated / Inactive</option>
                </select>
                <p className="text-[11px] font-semibold text-slate-400 mt-2">On Leave or Inactive hides this person from Commission reports — their past sales stay recorded but won't be shown under their name until they're Active again.</p>
             </div>
             <div>
                <label className="field-label">Linked Login Account (optional)</label>
                <select className="field-input w-full appearance-none cursor-pointer" value={form.userId} onChange={e => setForm({...form, userId: e.target.value})}>
                   <option value="">Not linked to a login account</option>
                   {loginAccounts?.map(u => <option key={u.id} value={u.id}>{u.username} ({u.role})</option>)}
                </select>
                <p className="text-[11px] font-semibold text-slate-400 mt-2">Link this profile to the login account this person uses at POS/Bookings, so future sales and commission reports can find them.</p>
             </div>
             <button type="submit" className="btn btn-primary w-full">Commit Profile Data</button>
          </form>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
