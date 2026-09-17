"use client";

import React, { useState } from "react";
import { db, User, UserRole, Permission } from "@/lib/db";
import { ALL_PERMISSIONS, PERMISSION_GROUPS, PERMISSION_LABELS } from "@/lib/permissions";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { logAction } from "@/lib/logger";
import { hashPassword } from "@/lib/security";
import { PermissionGuard } from "@/components/permissionguard";
import { UserCog, ShieldCheck, Plus, Key, Lock, Trash2, Edit3, X, ChevronDown, ChevronUp, Power } from "lucide-react";

export default function UsersManagementPage() {
  const users = useLiveQuery(() => db.users.toArray(), []);
  const [form, setForm] = useState<Partial<User>>({ username: '', password: '', role: 'Cashier', permissions: [] });
  const [editing, setEditing] = useState<number | null>(null);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.username || (!editing && !form.password)) return;

    const trimmedUsername = form.username.trim();
    const duplicate = await db.users.where('username').equalsIgnoreCase(trimmedUsername).first();
    if (duplicate && duplicate.id !== editing) {
      alert('That username is already taken. Please choose a different one.');
      return;
    }

    const now = new Date();

    // Never write the plain-text password field to the database.
    const { password: typedPassword, ...rest } = form;
    rest.username = trimmedUsername;

    if (typedPassword && typedPassword.length < 4) {
      alert('Password must be at least 4 characters.');
      return;
    }

    if (editing) {
      const originalUser = users?.find(u => u.id === editing);
      if (originalUser?.role === 'Admin' && rest.role !== 'Admin') {
        const otherActiveAdmins = users?.filter(u => u.role === 'Admin' && u.isActive && u.id !== editing).length || 0;
        if (otherActiveAdmins === 0) {
          alert("You can't remove Admin access from the last remaining Admin account.");
          return;
        }
      }

      const update: Partial<User> = { ...rest, updatedAt: now };

      if (typedPassword) {
        const { passwordHash, passwordSalt } = await hashPassword(typedPassword);
        update.passwordHash = passwordHash;
        update.passwordSalt = passwordSalt;
      }

      await db.users.update(editing, update);
      await logAction('Security', `Updated access for user: ${form.username}`);
    } else {
      const { passwordHash, passwordSalt } = await hashPassword(typedPassword!);

      await db.users.add({
        ...rest,
        passwordHash,
        passwordSalt,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      } as User);

      await logAction('Security', `Created new ${form.role} profile: ${form.username}`);
    }

    setForm({ username: '', password: '', role: 'Cashier', permissions: [] });
    setEditing(null);
    document.getElementById('user-modal')?.classList.add('hidden');
  };

  const togglePermission = (perm: Permission) => {
    const current = form.permissions || [];
    setForm({ ...form, permissions: current.includes(perm) ? current.filter(p => p !== perm) : [...current, perm] });
  };

  return (
    <PermissionGuard
      permission="view_users"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><UserCog size={22} /></span>
              Staff Access
            </h1>
            <p className="page-subtitle">Role-based security & permissions</p>
          </div>
          <PermissionGuard permission="create_users">
            <button onClick={() => { setEditing(null); setForm({username:'', role:'Cashier', permissions:[]}); document.getElementById('user-modal')?.classList.remove('hidden'); }} className="btn btn-primary">
              <Plus size={18} /> Create User
            </button>
          </PermissionGuard>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {users?.map(u => (
             <div key={u.id} className={`gloss-card p-5 group relative overflow-hidden flex flex-col ${!u.isActive && 'opacity-40 grayscale'}`}>
                <div className="flex justify-between items-start mb-8 leading-none">
                   <div className="w-16 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-primary text-xl uppercase shadow-inner leading-none">{u.username.charAt(0)}</div>
                   <span className="badge badge-info">{u.role}</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tighter mb-1 uppercase leading-tight">{u.username}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-10">Terminal ID: #{u.id}</p>
                <div className="flex gap-2 pt-8 border-t border-slate-50 mt-auto">
                   <PermissionGuard permission="edit_users">
                     <button onClick={() => { setEditing(u.id!); setForm({ ...u, password: '' }); document.getElementById('user-modal')?.classList.remove('hidden'); }} className="flex-1 bg-slate-50 text-slate-400 py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all active-click">Modify Access</button>
                   </PermissionGuard>
                   <button onClick={async () => {
                     if (u.isActive) {
                       const currentUserId = typeof window !== 'undefined' ? localStorage.getItem('userId') : null;
                       if (currentUserId && String(u.id) === currentUserId) {
                         alert("You can't deactivate your own account while logged in.");
                         return;
                       }
                       if (u.role === 'Admin') {
                         const activeAdmins = users?.filter(x => x.role === 'Admin' && x.isActive).length || 0;
                         if (activeAdmins <= 1) {
                           alert("You can't deactivate the last remaining Admin account.");
                           return;
                         }
                       }
                     }
                     await db.users.update(u.id!, {isActive: !u.isActive});
                   }} className="p-4 bg-slate-50 rounded-2xl text-slate-300 hover:text-slate-900 transition-colors active-click"><Power size={20}/></button>
                </div>
             </div>
           ))}
        </div>

        {/* Modal Overlay */}
        <div id="user-modal" className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-2xl hidden flex items-center justify-center p-4 animate-in fade-in duration-300">
           <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
              <div className="absolute top-0 left-0 w-full h-3 bg-primary"></div>
              <button onClick={() => document.getElementById('user-modal')?.classList.add('hidden')} className="absolute top-12 right-12 p-3 rounded-2xl hover:bg-slate-50 transition-all text-slate-200 hover:text-slate-900 leading-none"><X size={32}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-12 uppercase leading-none">{editing ? 'Override Access' : 'Authorize User'}</h2>
              <form onSubmit={handleSave} className="space-y-8 leading-none">
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Username</label>
                       <input required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all" value={form.username} onChange={e => setForm({...form, username: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">Authorization Rank</label>
                       <select className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none appearance-none cursor-pointer focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all" value={form.role} onChange={e => setForm({...form, role: e.target.value as any})}>
                          <option>Cashier</option><option>Supervisor</option><option>Admin</option>
                       </select>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-2 block">{editing ? 'Reset Security Key (leave blank to keep current)' : 'Initial Security Key'}</label>
                    <input type="password" required={!editing} className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all" value={form.password || ''} onChange={e => setForm({...form, password: e.target.value})} />
                 </div>

                 {form.role === 'Admin' ? (
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block leading-none">Custom Logic Permissions</label>
                      <div className="bg-slate-50 p-4 rounded-4xl border border-slate-100 shadow-inner text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                         Admins always have full access — nothing to set here.
                      </div>
                   </div>
                 ) : (
                 <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4 mb-1 block leading-none">Custom Logic Permissions</label>
                    <div className="max-h-56 overflow-y-auto no-scrollbar space-y-4 bg-slate-50 p-4 rounded-4xl border border-slate-100 shadow-inner">
                       {PERMISSION_GROUPS.map(g => (
                         <div key={g.name} className="space-y-3">
                            <div className="text-[9px] font-black text-primary uppercase tracking-[0.3em] opacity-30 mb-4 leading-none">{g.name}</div>
                            <div className="flex flex-wrap gap-2 mb-8">
                               {g.permissions.map(p => (
                                 // FIXED: Explicitly casting 'p' as Permission to satisfy strict TypeScript union check
                                 <button key={p} type="button" onClick={() => togglePermission(p as Permission)} className={`px-4 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all shadow-sm ${form.permissions?.includes(p as Permission) ? 'bg-primary text-white border-primary scale-105 shadow-glow-primary' : 'bg-white text-slate-400 border-slate-100 hover:border-primary/20'}`}>
                                    {PERMISSION_LABELS[p as Permission]}
                                 </button>
                               ))}
                            </div>
                         </div>
                       ))}
                    </div>
                 </div>
                 )}
                 <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-5xl font-black text-2xl shadow-high hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter mt-4 leading-none">Confirm User Access</button>
              </form>
           </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
