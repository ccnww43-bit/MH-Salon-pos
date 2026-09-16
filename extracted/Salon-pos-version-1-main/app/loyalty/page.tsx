"use client";

import React, { useEffect, useState } from "react";
import { db, Customer } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { logAction } from "@/lib/logger";
import {
  Star,
  TrendingUp,
  Award,
  Search,
  ArrowRight,
  Settings,
  Lock,
  X,
  Plus,
  Minus,
  Clock,
  SlidersHorizontal
} from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";

// The loyalty settings record is stored as a regular moduleRecord (module:
// 'loyalty') with a reserved title so it never touches lib/db.ts — the
// schema already has a 'loyalty' ModuleName reserved for exactly this kind
// of use. Every other module (promotions, packages, etc.) already stores
// its records this way.
const SETTINGS_TITLE = "__loyalty_settings__";

export default function LoyaltyPage() {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const size = 9;

  // Reset to page 1 whenever the search changes so the user isn't stranded
  // on a now out-of-range page — same fix already applied on Inventory.
  useEffect(() => {
    setPage(1);
  }, [query]);

  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const currency = settings?.[0]?.currency || "KSh";

  // Paginated + searched list actually rendered as cards. Mirrors the
  // Customers page pattern: filter, then offset/limit at the query level
  // so the page doesn't render every customer's card at once.
  const customers = useLiveQuery(async () => {
    const q = query.toLowerCase().trim();
    const coll = db.customers;
    if (q) {
      return await coll
        .filter(c => c.name.toLowerCase().includes(q) || c.phone.includes(q))
        .offset((page - 1) * size)
        .limit(size)
        .toArray();
    }
    return await coll.offset((page - 1) * size).limit(size).toArray();
  }, [page, query]);

  const total = useLiveQuery(() => db.customers.count()) || 0;

  // Program-wide stats still need every customer's point balance to sum
  // correctly. This is a lightweight query (just numbers, no card
  // rendering) — the expensive part the report flagged was rendering every
  // customer as a card at once, which pagination above now fixes.
  const allCustomers = useLiveQuery(() => db.customers.toArray(), []);
  const totalPointsInCirculation =
    allCustomers?.reduce((s, c) => s + (c.loyaltyPoints || 0), 0) || 0;

  const loyaltySettingsRecord = useLiveQuery(
    () =>
      db.moduleRecords
        .where("module")
        .equals("loyalty")
        .filter(r => r.title === SETTINGS_TITLE)
        .first(),
    []
  );

  const [showSettings, setShowSettings] = useState(false);
  const [settingsForm, setSettingsForm] = useState({
    pointsPerCurrency: "1",
    redemptionValue: "1"
  });

  const openSettings = () => {
    setSettingsForm({
      pointsPerCurrency: String(
        loyaltySettingsRecord?.data?.pointsPerCurrency ?? 1
      ),
      redemptionValue: String(
        loyaltySettingsRecord?.data?.redemptionValue ?? 1
      )
    });
    setShowSettings(true);
  };

  const saveSettings = async (e: React.FormEvent) => {
    e.preventDefault();

    const pointsPerCurrency = Number(settingsForm.pointsPerCurrency) || 0;
    const redemptionValue = Number(settingsForm.redemptionValue) || 0;
    const now = new Date();

    if (loyaltySettingsRecord?.id) {
      await db.moduleRecords.update(loyaltySettingsRecord.id, {
        data: { pointsPerCurrency, redemptionValue },
        updatedAt: now
      });
    } else {
      await db.moduleRecords.add({
        module: "loyalty",
        title: SETTINGS_TITLE,
        status: "Settings",
        data: { pointsPerCurrency, redemptionValue },
        createdAt: now,
        updatedAt: now
      });
    }

    await logAction(
      "Loyalty",
      `Updated loyalty program settings — ${pointsPerCurrency} pt(s) per ${currency} spent, ${redemptionValue} ${currency} per point redeemed`
    );

    setShowSettings(false);
  };

  // Manual award / redeem / adjust points for a single customer.
  const [adjustingCustomer, setAdjustingCustomer] = useState<Customer | null>(null);
  const [adjustForm, setAdjustForm] = useState({
    type: "Award" as "Award" | "Redeem" | "Adjustment",
    points: "",
    reason: ""
  });

  const openAdjustModal = (c: Customer) => {
    setAdjustingCustomer(c);
    setAdjustForm({ type: "Award", points: "", reason: "" });
  };

  const closeAdjustModal = () => {
    setAdjustingCustomer(null);
    setAdjustForm({ type: "Award", points: "", reason: "" });
  };

  const submitAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!adjustingCustomer?.id) return;

    const pts = Number(adjustForm.points);

    if (!pts || pts <= 0) {
      alert("Enter a valid number of points.");
      return;
    }

    const current = adjustingCustomer.loyaltyPoints || 0;
    let delta = 0;
    let newBalance = current;

    if (adjustForm.type === "Award") {
      delta = pts;
      newBalance = current + pts;
    } else if (adjustForm.type === "Redeem") {
      if (pts > current) {
        alert("Cannot redeem more points than the customer currently has.");
        return;
      }
      delta = -pts;
      newBalance = current - pts;
    } else {
      // Adjustment sets the balance to an exact value.
      newBalance = pts;
      delta = pts - current;
    }

    const now = new Date();

    await db.customers.update(adjustingCustomer.id, {
      loyaltyPoints: newBalance,
      updatedAt: now
    });

    await db.moduleRecords.add({
      module: "loyalty",
      title:
        adjustForm.type === "Award"
          ? "Points Awarded"
          : adjustForm.type === "Redeem"
          ? "Points Redeemed"
          : "Balance Adjusted",
      status: adjustForm.type,
      customerId: adjustingCustomer.id,
      amount: delta,
      data: {
        reason: adjustForm.reason,
        previousBalance: current,
        newBalance
      },
      createdAt: now,
      updatedAt: now
    });

    await logAction(
      "Loyalty",
      `${adjustForm.type} ${Math.abs(delta)} point(s) for ${adjustingCustomer.name}${
        adjustForm.reason ? ` — ${adjustForm.reason}` : ""
      }`
    );

    closeAdjustModal();
  };

  // View a customer's full loyalty point history.
  const [historyCustomer, setHistoryCustomer] = useState<Customer | null>(null);

  const historyRecords = useLiveQuery(
    () =>
      historyCustomer?.id
        ? db.moduleRecords
            .where("module")
            .equals("loyalty")
            .filter(r => r.customerId === historyCustomer.id)
            .sortBy("createdAt")
            .then(a => a.reverse())
        : Promise.resolve([] as any[]),
    [historyCustomer?.id]
  );

  return (
    <PermissionGuard
      permission="manage_loyalty"
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
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30">
                <Star size={22} />
              </span>
              Loyalty Program
            </h1>

            <p className="page-subtitle">
              Reward points & VIP tier management
            </p>
          </div>

          <div className="flex gap-4">
            <div className="relative w-80">
              <Search
                className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"
                size={20}
              />

              <input
                placeholder="Search VIP Clients..."
                className="w-full pl-14 pr-6 py-5 rounded-lg border-none shadow-premium bg-white font-bold text-slate-900 focus:ring-8 focus:ring-primary/5 transition-all"
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
            </div>

            <button onClick={openSettings} className="btn btn-secondary btn-icon">
              <Settings size={28} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-4 gap-8">
          <div className="gloss-card p-5">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">
              Total Loyalty Base
            </div>

            <div className="text-2xl font-black text-slate-900 tracking-tighter">
              {total}
            </div>

            <p className="text-xs font-bold text-slate-400 mt-4">
              Active participating customers
            </p>
          </div>

          <div className="bg-slate-900 p-5 rounded-xl shadow-high text-white">
            <div className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em] mb-4">
              Points In Circulation
            </div>

            <div className="text-2xl font-black text-white tracking-tighter">
              {totalPointsInCirculation.toLocaleString()}
            </div>

            <div className="flex items-center gap-2 mt-4 text-white/40 font-black text-[10px] uppercase">
              <TrendingUp size={14} />
              Across all members
            </div>
          </div>

          <div className="gloss-card p-5">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">
              Points Per {currency}
            </div>

            <div className="text-2xl font-black text-slate-900 tracking-tighter">
              {loyaltySettingsRecord?.data?.pointsPerCurrency ?? 1}
            </div>

            <p className="text-xs font-bold text-slate-400 mt-4 flex items-center gap-2">
              <SlidersHorizontal size={12} /> Configured in Settings
            </p>
          </div>

          <div className="gloss-card p-5">
            <div className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">
              Redemption Value
            </div>

            <div className="text-2xl font-black text-slate-900 tracking-tighter">
              {currency} {loyaltySettingsRecord?.data?.redemptionValue ?? 1}
            </div>

            <p className="text-xs font-bold text-slate-400 mt-4">
              Value per point redeemed
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
          {customers
            ?.slice()
            .sort((a, b) => b.loyaltyPoints - a.loyaltyPoints)
            .map(c => (
              <div
                key={c.id}
                className="gloss-card p-5 hover-lift group relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 p-4 text-slate-50 group-hover:text-primary/5 transition-colors">
                  <Award size={120} />
                </div>

                <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-8">
                    <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-primary text-xl">
                      {c.name.charAt(0)}
                    </div>

                    <div>
                      <div className="font-black text-slate-900 text-xl tracking-tighter leading-none mb-1">
                        {c.name}
                      </div>

                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {c.phone}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-end justify-between border-t border-slate-50 pt-8">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
                        Available Points
                      </div>

                      <div className="text-xl font-black text-primary tracking-tighter">
                        {c.loyaltyPoints}
                      </div>
                    </div>

                    <div className="flex flex-col gap-2 items-end">
                      <button onClick={() => openAdjustModal(c)} className="bg-primary/10 text-primary px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-primary hover:text-white transition-all flex items-center gap-2">
                        <Plus size={14} />
                        ADJUST POINTS
                      </button>

                      <button onClick={() => setHistoryCustomer(c)} className="bg-slate-50 text-slate-900 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest group-hover:bg-slate-900 group-hover:text-white transition-all flex items-center gap-2">
                        VIEW HISTORY
                        <ArrowRight size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
        </div>

        {!customers?.length && (
          <div className="py-40 text-center gloss-card">
            <Star
              size={80}
              className="mx-auto text-slate-100 mb-6"
            />

            <h3 className="text-2xl font-black text-slate-300 uppercase tracking-[0.3em]">
              No Loyalty Members Found
            </h3>
          </div>
        )}

        <Pagination totalItems={total} itemsPerPage={size} currentPage={page} onPageChange={setPage} />
      </div>

      {/* Settings modal */}
      {showSettings && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
            <button onClick={() => setShowSettings(false)} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32} /></button>
            <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-10 uppercase">Loyalty Settings</h2>

            <form onSubmit={saveSettings} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Points earned per {currency} spent</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none"
                  value={settingsForm.pointsPerCurrency}
                  onChange={e => setSettingsForm({ ...settingsForm, pointsPerCurrency: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">{currency} value per point redeemed</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  required
                  className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none"
                  value={settingsForm.redemptionValue}
                  onChange={e => setSettingsForm({ ...settingsForm, redemptionValue: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full">Save Settings</button>
            </form>
          </div>
        </div>
      )}

      {/* Adjust points modal */}
      {adjustingCustomer && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-lg max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
            <button onClick={closeAdjustModal} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32} /></button>
            <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-2 uppercase">Adjust Points</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-10">{adjustingCustomer.name} — currently {adjustingCustomer.loyaltyPoints} pts</p>

            <form onSubmit={submitAdjustment} className="space-y-6">
              <div className="grid grid-cols-3 gap-3">
                {(["Award", "Redeem", "Adjustment"] as const).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setAdjustForm({ ...adjustForm, type: t })}
                    className={`py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                      adjustForm.type === t
                        ? "bg-primary text-white"
                        : "bg-slate-50 text-slate-500"
                    }`}
                  >
                    {t === "Award" && <Plus size={14} />}
                    {t === "Redeem" && <Minus size={14} />}
                    {t === "Adjustment" && <SlidersHorizontal size={14} />}
                    {t}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">
                  {adjustForm.type === "Adjustment" ? "New Points Balance" : "Points"}
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none"
                  value={adjustForm.points}
                  onChange={e => setAdjustForm({ ...adjustForm, points: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">Reason (optional)</label>
                <input
                  type="text"
                  className="w-full p-5 rounded-3xl bg-slate-50 border border-slate-100 font-bold text-slate-900 outline-none"
                  placeholder="e.g. Birthday bonus, service redemption..."
                  value={adjustForm.reason}
                  onChange={e => setAdjustForm({ ...adjustForm, reason: e.target.value })}
                />
              </div>

              <button type="submit" className="btn btn-primary w-full">Confirm {adjustForm.type}</button>
            </form>
          </div>
        </div>
      )}

      {/* History modal */}
      {historyCustomer && (
        <div className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6">
          <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
            <button onClick={() => setHistoryCustomer(null)} className="absolute top-10 right-10 p-2 text-slate-200 hover:text-slate-900"><X size={32} /></button>
            <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-2 uppercase">Points History</h2>
            <p className="text-slate-400 font-bold text-xs uppercase tracking-widest mb-10">{historyCustomer.name} — {historyCustomer.loyaltyPoints} pts available</p>

            <div className="space-y-3">
              {historyRecords?.map(r => (
                <div key={r.id} className="flex justify-between items-center bg-slate-50/50 border border-slate-100 rounded-lg px-4 py-5">
                  <div>
                    <div className="font-black text-slate-900 text-sm uppercase tracking-tight">{r.title}</div>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5 flex items-center gap-2">
                      <Clock size={12} /> {new Date(r.createdAt).toLocaleString()}
                    </div>
                    {r.data?.reason && (
                      <div className="text-xs font-bold text-slate-500 mt-1">{r.data.reason}</div>
                    )}
                  </div>
                  <div className={`font-black text-lg ${r.amount >= 0 ? "text-success" : "text-danger"}`}>
                    {r.amount >= 0 ? "+" : ""}{r.amount}
                  </div>
                </div>
              ))}

              {!historyRecords?.length && (
                <div className="text-center py-3 text-slate-300 font-black text-xs uppercase tracking-widest">No point activity recorded yet</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
