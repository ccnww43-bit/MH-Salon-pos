"use client";

import React, { useEffect, useRef, useState } from "react";
import { Navbar } from "@/components/navbar";
import { db } from "@/lib/db";
import { logAction } from "@/lib/logger";
import {
  Settings,
  Store,
  DollarSign,
  Lock,
  Mail,
  MapPin,
  Receipt,
  ImagePlus,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Clock,
} from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";
import {
  activateLicenseKey,
  getLicenseStatus,
  formatLicenseDate,
} from "@/lib/license";

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export default function SettingsPage() {
  const [form, setForm] = useState({
    salonName: '', address: '', phone: '', email: '',
    currency: 'KSh', taxRate: 0, taxEnabled: false, receiptFooter: '',
    logoUrl: '',
    openingTime: '09:00', closingTime: '19:00', closedDays: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- License section state ---
  const [licenseStatus, setLicenseStatus] = useState<Awaited<ReturnType<typeof getLicenseStatus>> | null>(null);
  const [newLicenseKey, setNewLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);
  const [licenseMessage, setLicenseMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    db.settings.toArray().then(s => {
      if (s.length > 0) {
        const loaded: any = s[0];
        setForm(prev => ({ ...prev, ...loaded, closedDays: loaded.closedDays || [] }));
      }
    });
    refreshLicenseStatus();
  }, []);

  const refreshLicenseStatus = () => {
    getLicenseStatus().then(setLicenseStatus);
  };

  const toggleClosedDay = (day: string) => {
    setForm(prev => ({
      ...prev,
      closedDays: prev.closedDays.includes(day)
        ? prev.closedDays.filter(d => d !== day)
        : [...prev.closedDays, day],
    }));
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setForm(prev => ({ ...prev, logoUrl: reader.result as string }));
    };
    reader.readAsDataURL(file);
  };

  const handleActivateLicense = async () => {
    if (!newLicenseKey.trim()) {
      setLicenseMessage({ ok: false, text: 'Please enter a license key.' });
      return;
    }

    setActivating(true);
    setLicenseMessage(null);

    try {
      const result = await activateLicenseKey(newLicenseKey);
      setLicenseMessage({ ok: result.ok, text: result.message });

      if (result.ok) {
        setNewLicenseKey('');
        refreshLicenseStatus();
        await logAction('Settings', 'License activated/renewed');
      }
    } catch (error) {
      console.error('License activation failed:', error);
      setLicenseMessage({ ok: false, text: 'Could not activate this license key.' });
    } finally {
      setActivating(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const existing = await db.settings.toArray();
    if (existing.length > 0) await db.settings.update(existing[0].id!, { ...form, updatedAt: new Date() });
    else await db.settings.add({ ...form, updatedAt: new Date() } as any);
    await logAction('Settings', 'Global configuration updated');
    setSaving(false); alert('Settings Applied.');
  };

  return (
    <PermissionGuard
      permission="manage_settings"
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
    <div className="page-shell space-y-8 animate-in fade-in duration-500 selection:bg-primary leading-none max-w-6xl mx-auto">
      <h1 className="page-title flex items-center gap-4"><Settings size={26} className="text-primary"/> Configuration</h1>

      {/* LICENSE SECTION (separate from the form — saves/activates immediately) */}
      <div className="gloss-card p-6 space-y-8">
         <h2 className="text-lg font-black text-slate-900 uppercase flex items-center gap-3"><KeyRound size={20} className="text-primary"/> License</h2>

         {licenseStatus?.exists ? (
           <div className={`flex items-center gap-4 rounded-4xl p-6 border ${licenseStatus.valid ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}>
             {licenseStatus.valid ? <CheckCircle2 className="text-green-600 shrink-0" size={28}/> : <AlertCircle className="text-red-600 shrink-0" size={28}/>}
             <div>
               <p className={`font-black text-sm ${licenseStatus.valid ? 'text-green-700' : 'text-red-700'}`}>
                 {licenseStatus.valid ? 'License Active' : licenseStatus.expired ? 'License Expired' : 'License Invalid'}
               </p>
               {licenseStatus.license && (
                 <p className="text-xs font-bold text-slate-500 mt-1">
                   Expires {formatLicenseDate(licenseStatus.license.expiresAt)} &middot; {licenseStatus.license.licenseId}
                 </p>
               )}
             </div>
           </div>
         ) : (
           <div className="flex items-center gap-4 rounded-4xl p-6 border bg-red-50 border-red-100">
             <AlertCircle className="text-red-600 shrink-0" size={28}/>
             <p className="font-black text-sm text-red-700">No active license found on this installation.</p>
           </div>
         )}

         <div className="space-y-3">
           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Activate / Renew License Key</label>
           <div className="flex flex-col md:flex-row gap-4">
             <textarea
               rows={2}
               className="flex-1 p-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none font-bold text-sm resize-none"
               value={newLicenseKey}
               onChange={e => setNewLicenseKey(e.target.value)}
               placeholder="Paste new license key here..."
             />
             <button
               type="button"
               onClick={handleActivateLicense}
               disabled={activating || !newLicenseKey.trim()}
               className="shrink-0 bg-primary text-white px-4 rounded-3xl font-black uppercase text-sm disabled:opacity-30"
             >
               {activating ? 'Activating...' : 'Activate'}
             </button>
           </div>
           {licenseMessage && (
             <p className={`text-xs font-bold ${licenseMessage.ok ? 'text-green-600' : 'text-red-600'}`}>
               {licenseMessage.text}
             </p>
           )}
         </div>
      </div>

      <form onSubmit={handleSave} className="space-y-10 pb-20">
         <div className="bg-white p-6 rounded-xl shadow-high border border-white space-y-10">
            <h2 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-4"><Store className="text-primary"/> Identity</h2>

            {/* LOGO UPLOAD */}
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 rounded-3xl bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden shrink-0">
                {form.logoUrl ? (
                  <img src={form.logoUrl} alt="Salon logo" className="w-full h-full object-cover" />
                ) : (
                  <ImagePlus className="text-slate-300" size={28} />
                )}
              </div>
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="bg-slate-50 border border-slate-100 rounded-3xl px-6 py-3 font-black text-sm text-slate-600 hover:bg-slate-100 transition-all"
                >
                  {form.logoUrl ? 'Change Logo' : 'Upload Logo'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
                {form.logoUrl && (
                  <button
                    type="button"
                    onClick={() => setForm({ ...form, logoUrl: '' })}
                    className="block text-xs font-bold text-red-500 hover:underline"
                  >
                    Remove logo
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <input required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.salonName} onChange={e => setForm({...form, salonName: e.target.value})} placeholder="Brand Name" />
               <input className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} placeholder="Contact Phone" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="relative">
                 <Mail className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                 <input type="email" className="w-full p-6 pl-14 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="business@example.com" />
               </div>
               <div className="relative">
                 <MapPin className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" size={20} />
                 <input className="w-full p-6 pl-14 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.address} onChange={e => setForm({...form, address: e.target.value})} placeholder="Business address" />
               </div>
            </div>

            <div className="relative">
              <Receipt className="absolute left-6 top-6 text-slate-300" size={20} />
              <textarea
                rows={2}
                className="w-full p-6 pl-14 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none resize-none"
                value={form.receiptFooter}
                onChange={e => setForm({...form, receiptFooter: e.target.value})}
                placeholder="Thank you for your visit!"
              />
            </div>
         </div>

         {/* BUSINESS HOURS */}
         <div className="bg-white p-6 rounded-xl shadow-high border border-white space-y-10">
            <div>
              <h2 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-4"><Clock className="text-primary"/> Business Hours</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">Applies to every open day. Tap a day below to mark it closed.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Opening Time</label>
                 <input type="time" className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.openingTime} onChange={e => setForm({...form, openingTime: e.target.value})} />
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Closing Time</label>
                 <input type="time" className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.closingTime} onChange={e => setForm({...form, closingTime: e.target.value})} />
               </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Closed Days</label>
              <div className="flex flex-wrap gap-3">
                {WEEKDAYS.map(day => {
                  const isClosed = form.closedDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleClosedDay(day)}
                      className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all border ${
                        isClosed
                          ? 'bg-red-50 border-red-200 text-red-600'
                          : 'bg-slate-50 border-slate-100 text-slate-500 hover:border-slate-200'
                      }`}
                    >
                      {day.slice(0, 3)}
                    </button>
                  );
                })}
              </div>
            </div>
         </div>

         <div className="bg-white p-6 rounded-xl shadow-high border border-white space-y-10">
            <h2 className="text-2xl font-black text-slate-900 uppercase flex items-center gap-4"><DollarSign className="text-primary"/> Financials</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               <input required className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.currency} onChange={e => setForm({...form, currency: e.target.value})} placeholder="Currency (e.g. KSh)" />
               <input type="number" className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black outline-none" value={form.taxRate} onChange={e => setForm({...form, taxRate: Number(e.target.value)})} placeholder="Tax Rate %" />
            </div>
            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-4xl p-6">
               <div>
                 <div className="font-black text-slate-900 uppercase text-sm tracking-tight">Enable Tax</div>
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Apply the tax rate above to POS sales</div>
               </div>
               <button
                 type="button"
                 onClick={() => setForm({...form, taxEnabled: !form.taxEnabled})}
                 className={`w-16 h-9 rounded-full transition-all relative shrink-0 ${form.taxEnabled ? 'bg-primary' : 'bg-slate-200'}`}
               >
                 <span className={`absolute top-1 left-1 w-7 h-7 bg-white rounded-full shadow transition-all ${form.taxEnabled ? 'translate-x-7' : ''}`}/>
               </button>
            </div>
         </div>

         <button type="submit" disabled={saving} className="w-full bg-primary text-white py-2.5 rounded-5xl font-black text-2xl shadow-high hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter">COMMIT CONFIGURATION</button>
      </form>
    </div>
    </PermissionGuard>
  );
}
