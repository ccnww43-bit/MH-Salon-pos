"use client";

import React, { useState, useMemo } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { WalletCards, TrendingUp, Target, Plus, Search, User, Briefcase, Trash2, X, ChevronRight, Calendar, Activity, Award, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";
import { StaffQuickAdd } from "@/components/staff-quick-add";
import type { ModuleRecord } from "@/lib/db";

const EMPTY_RULE_FORM = { staffId: '', rate: '' };

export default function CommissionsPage() {
  // Pulls every staff profile, active or not, so a rule can be set up for
  // anyone in the directory — not just people currently marked Active.
  const staff = useLiveQuery(() => db.moduleRecords.where('module').equals('staff').toArray(), []);
  const services = useLiveQuery(() => db.services.filter(s => s.isActive).toArray(), []);
  const rules = useLiveQuery(() => db.moduleRecords.where('module').equals('commission').toArray(), []);
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const currency = settings?.[0]?.currency || "KSh";

  // Simple rule form: pick a staff member (or leave it for "All Staff"),
  // choose a commission percentage. Calculation type is always Percentage
  // here and there's no separate rule name or target to fill in.
  const [form, setForm] = useState(EMPTY_RULE_FORM);
  const [showQuickAddStaff, setShowQuickAddStaff] = useState(false);

  // Date range for the commission calculation below (defaults to no filter = all-time)
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const staffMember = staff?.find(s => String(s.id) === form.staffId);
    const staffName = staffMember?.title || 'All Staff';

    await db.moduleRecords.add({
      module: 'commission',
      title: `${staffName} — ${form.rate}%`,
      status: 'Active',
      staffId: form.staffId ? Number(form.staffId) : undefined,
      data: { type: 'Percentage', rate: form.rate, staffName },
      createdAt: new Date(),
      updatedAt: new Date()
    });

    await logAction('Commission', `Configured rule: ${form.rate}% for ${staffName}`);
    setForm(EMPTY_RULE_FORM);
    document.getElementById('comm-modal')?.classList.add('hidden');
  };

  const handleStaffCreated = (newStaff: ModuleRecord) => {
    setForm(f => ({ ...f, staffId: String(newStaff.id) }));
    setShowQuickAddStaff(false);
  };

  // Real commission calculation: walk every Completed sale in the selected
  // date range, credit each SaleItem's total to whichever staff member it
  // was assigned to at POS (item.staffId, which points at a real
  // db.moduleRecords "staff" record — the employee directory, not a login
  // account), then apply that staff member's matching commission rule.
  const earnings = useMemo(() => {
    if (!sales || !staff) return [];

    const perStaff = new Map<number, { salesTotal: number; itemCount: number }>();

    for (const sale of sales) {
      if (sale.transactionStatus !== 'Completed') continue;
      const d = new Date(sale.createdAt).toISOString().split('T')[0];
      if (start && d < start) continue;
      if (end && d > end) continue;

      // Spread the sale's cart-level discount (manual + membership,
      // sale.discount) proportionally across items so a big whole-cart
      // discount actually reduces the sales figure commission is based on,
      // instead of crediting staff for the pre-discount line price.
      const saleDiscount = Number(sale.discount) || 0;
      const saleSubtotal = Number(sale.subtotal) || 0;

      for (const item of sale.items || []) {
        if (!item.staffId) continue;
        const itemShareOfDiscount = saleSubtotal > 0 ? (item.total / saleSubtotal) * saleDiscount : 0;
        const effectiveTotal = Math.max(0, item.total - itemShareOfDiscount);

        const bucket = perStaff.get(item.staffId) || { salesTotal: 0, itemCount: 0 };
        bucket.salesTotal += effectiveTotal;
        bucket.itemCount += 1;
        perStaff.set(item.staffId, bucket);
      }
    }

    const activeRules = (rules || []).filter(r => r.status === 'Active');

    return staff
      .map(member => {
        const totals = perStaff.get(member.id!) || { salesTotal: 0, itemCount: 0 };

        // Prefer a rule written specifically for this staff member; fall
        // back to an "All Active Staff" rule (saved with no staffId).
        const rule =
          activeRules.find(r => r.staffId === member.id) ||
          activeRules.find(r => !r.staffId);

        let commission = 0;
        if (rule) {
          const rate = Number(rule.data?.rate) || 0;
          commission = rule.data?.type === 'Fixed Amount'
            ? rate * totals.itemCount
            : totals.salesTotal * (rate / 100);
        }

        const target = rule?.data?.target ? Number(rule.data.target) : null;

        return {
          staffId: member.id!,
          name: member.title,
          salesTotal: totals.salesTotal,
          itemCount: totals.itemCount,
          ruleName: rule?.title || null,
          ruleType: rule?.data?.type || null,
          rate: rule ? Number(rule.data?.rate) || 0 : 0,
          commission,
          target,
        };
      })
      .filter(row => row.itemCount > 0 || row.ruleName)
      .sort((a, b) => b.commission - a.commission);
  }, [sales, staff, rules, start, end]);

  const totalCommissionPayable = earnings.reduce((sum, e) => sum + e.commission, 0);
  const totalSalesCounted = earnings.reduce((sum, e) => sum + e.salesTotal, 0);

  return (
    <PermissionGuard
      permission="manage_commissions"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><WalletCards size={22} /></span>
              Commission Rules
            </h1>
            <p className="page-subtitle">Staff incentive structures & performance targets</p>
          </div>

          <button onClick={() => document.getElementById('comm-modal')?.classList.remove('hidden')} className="btn btn-primary">
            <Plus size={18} /> Configure Rule
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-8">
          {rules?.map(r => (
            <div key={r.id} className="gloss-card p-5 hover-lift relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 text-primary/5 transition-colors group-hover:text-primary/10">
                  <TrendingUp size={100} strokeWidth={3}/>
               </div>
               <div className="flex justify-between items-start mb-8">
                  <span className={`badge ${r.status === 'Active' ? 'badge-success' : 'badge-neutral'}`}>
                    {r.status}
                  </span>
                  <button onClick={() => { if (confirm('Delete this commission rule?')) db.moduleRecords.delete(r.id!); }} className="btn btn-icon btn-danger"><Trash2 size={18}/></button>
               </div>
               <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-2">{r.title}</h3>
               <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest mb-8">
                 <User size={14}/> {r.data.staffName}
               </div>

               <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-8">
                  <div>
                    <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Earning Rate</div>
                    <div className="text-lg font-black text-primary tracking-tighter">
                      {r.data.rate}{r.data.type === 'Percentage' ? '%' : ` ${currency}`}
                    </div>
                  </div>
                  {r.data.target && (
                    <div className="text-right">
                      <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest mb-1">Sales Target</div>
                      <div className="text-xl font-black text-slate-900 tracking-tighter">{currency} {Number(r.data.target).toLocaleString()}</div>
                    </div>
                  )}
               </div>
            </div>
          ))}
        </div>

        {!rules?.length && (
          <div className="empty-state gloss-card">
            <div className="empty-state-icon"><WalletCards size={26} /></div>
            <div className="empty-state-title">No rules configured</div>
            <p className="empty-state-text">Create a commission rule to start tracking staff incentives.</p>
          </div>
        )}

        {/* Real Commission Calculation, from actual db.sales data */}
        <div className="space-y-8">
          <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter flex items-center gap-4">
                <Award className="text-primary" size={32}/> Commission Earned
              </h2>
              <p className="text-slate-500 font-bold mt-2 uppercase text-[10px] tracking-widest opacity-60">Calculated live from completed POS sales</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 gloss-card p-3">
              <div className="px-3 flex items-center gap-3 flex-wrap">
                 <Calendar size={18} className="text-slate-300"/>
                 <input type="date" className="bg-transparent border-none outline-none font-black text-xs uppercase text-slate-900" value={start} onChange={e => setStart(e.target.value)} />
                 <span className="text-slate-200 font-black">TO</span>
                 <input type="date" className="bg-transparent border-none outline-none font-black text-xs uppercase text-slate-900" value={end} onChange={e => setEnd(e.target.value)} />
              </div>
              <button onClick={() => {setStart(""); setEnd("");}} className="btn btn-secondary btn-icon shrink-0"><Activity size={18}/></button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             <div className="gloss-card p-5">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3">Sales Attributed to Staff</div>
                <div className="text-2xl font-black text-slate-900 tracking-tighter">{currency} {totalSalesCounted.toLocaleString()}</div>
             </div>
             <div className="bg-[#0f172a] p-5 rounded-[24px] shadow-high text-white">
                <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.3em] mb-3">Total Commission Payable</div>
                <div className="text-2xl font-black text-white tracking-tighter">{currency} {totalCommissionPayable.toLocaleString(undefined, { maximumFractionDigits: 2 })}</div>
             </div>
          </div>

          <div className="table-card">
            <div className="table-scroll">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-100">
                  <tr>
                    <th className="text-left p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Staff</th>
                    <th className="text-left p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Rule Applied</th>
                    <th className="text-right p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Items Sold</th>
                    <th className="text-right p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Sales Total</th>
                    <th className="text-right p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Target Progress</th>
                    <th className="text-right p-6 font-black text-[10px] text-slate-400 uppercase tracking-widest">Commission Earned</th>
                  </tr>
                </thead>
                <tbody>
                  {earnings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-5 text-center text-slate-300 font-bold uppercase tracking-widest text-xs">
                        No staff-assigned sales in this period.
                      </td>
                    </tr>
                  ) : (
                    earnings.map(row => (
                      <tr key={row.staffId} className="border-b border-slate-50 last:border-0">
                        <td className="p-6 font-black text-slate-900">{row.name}</td>
                        <td className="p-6 text-slate-500 font-bold text-xs uppercase tracking-widest">
                          {row.ruleName ? `${row.ruleName} (${row.ruleType === 'Fixed Amount' ? `${currency}${row.rate}/item` : `${row.rate}%`})` : 'No rule assigned'}
                        </td>
                        <td className="p-6 text-right font-bold text-slate-500">{row.itemCount}</td>
                        <td className="p-6 text-right font-black text-slate-900">{currency} {row.salesTotal.toLocaleString()}</td>
                        <td className="p-6 text-right">
                          {row.target ? (
                            <span className={`font-black ${row.salesTotal >= row.target ? 'text-success' : 'text-slate-400'}`}>
                              {currency} {row.salesTotal.toLocaleString()} / {currency} {row.target.toLocaleString()}
                            </span>
                          ) : (
                            <span className="text-slate-200">—</span>
                          )}
                        </td>
                        <td className="p-6 text-right font-black text-primary text-lg">{currency} {row.commission.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Modal */}
        <div id="comm-modal" className="fixed inset-0 z-[100] bg-slate-900/70 backdrop-blur-md hidden flex items-center justify-center p-6">
           <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
              <button onClick={() => document.getElementById('comm-modal')?.classList.add('hidden')} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32}/></button>
              <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-10">COMMISSION RULE</h2>
              <form onSubmit={handleSave} className="space-y-6">
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Staff</label>
                    <div className="flex gap-2">
                      <select className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.staffId} onChange={e => setForm({...form, staffId: e.target.value})}>
                         <option value="">All Staff</option>
                         {staff?.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}
                      </select>
                      <button
                        type="button"
                        onClick={() => setShowQuickAddStaff(true)}
                        className="shrink-0 btn btn-secondary"
                        title="Add a new staff member without leaving this form"
                      >
                        + New
                      </button>
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Commission (%)</label>
                    <input type="number" min="0" max="100" step="0.1" required className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none" value={form.rate} onChange={e => setForm({...form, rate: e.target.value})} placeholder="e.g. 10" />
                 </div>
                 <button type="submit" className="w-full bg-primary text-white py-2.5 rounded-xl font-black text-xl shadow-high hover:scale-[1.02] transition-all">ACTIVATE COMMISSION RULE</button>
              </form>
           </div>
        </div>
      </div>
    </div>

    <StaffQuickAdd
      open={showQuickAddStaff}
      onClose={() => setShowQuickAddStaff(false)}
      onCreated={handleStaffCreated}
    />
    </PermissionGuard>
  );
}
