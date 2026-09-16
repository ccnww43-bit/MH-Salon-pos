"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { Navbar } from "@/components/navbar";
import { logAction } from "@/lib/logger";
import {
  Wallet,
  Lock,
  Unlock,
  ArrowDownCircle,
  ArrowUpCircle,
} from "lucide-react";

export default function CashDrawerPage() {
  const [role, setRole] = useState<string | null>(null);
  const [openingBalance, setOpeningBalance] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [type, setType] = useState<"IN" | "OUT">("IN");

  useEffect(() => {
    setRole(localStorage.getItem("userRole"));
  }, []);

  // Live-queried straight from Dexie, so the drawer status and balance
  // re-render the instant anything writes to db.cashDrawers or
  // db.cashMovements — including a POS cash sale, which posts an "IN"
  // movement directly to db.cashMovements at checkout.
  const drawers = useLiveQuery(() => db.cashDrawers.toArray(), []);

  const latestOpenDrawer = useMemo(() => {
    return [...(drawers || [])]
      .filter((d: any) => d.status === "Open")
      .sort(
        (a: any, b: any) =>
          new Date(b.openedAt).getTime() -
          new Date(a.openedAt).getTime()
      )[0];
  }, [drawers]);

  const currentDrawerId: number | null = latestOpenDrawer
    ? latestOpenDrawer.id
    : null;

  const isOpen = Boolean(latestOpenDrawer);

  const drawerMovements = useLiveQuery<any[]>(() => {
    if (!currentDrawerId) return Promise.resolve([] as any[]);
    return db.cashMovements
      .where("drawerId")
      .equals(currentDrawerId)
      .toArray();
  }, [currentDrawerId]);

  const currentBalance = useMemo(() => {
    if (!latestOpenDrawer) return 0;

    return (drawerMovements || []).reduce(
      (total: number, record: any) => {
        if (record.type === "IN") {
          return total + Number(record.amount || 0);
        }

        if (record.type === "OUT") {
          return total - Number(record.amount || 0);
        }

        return total;
      },
      Number(latestOpenDrawer.openingBalance || 0)
    );
  }, [drawerMovements, latestOpenDrawer]);

  const openDrawer = async () => {
    const value = Number(openingBalance);

    if (!Number.isFinite(value) || value < 0) {
      alert("Enter a valid opening balance.");
      return;
    }

    const now = new Date();

    await db.cashDrawers.add({
      status: "Open",
      openedAt: now,
      openingBalance: value,
      openedBy: localStorage.getItem("username") || "unknown",
    } as any);

    await logAction(
      "Cash Drawer",
      `Opened cash drawer with ${value}`
    );

    setOpeningBalance("");
    // No manual reload needed — the live queries above pick up the
    // db.cashDrawers write automatically.
  };

  const recordMovement = async () => {
    const value = Number(amount);

    if (!Number.isFinite(value) || value <= 0) {
      alert("Enter a valid amount.");
      return;
    }

    if (!reason.trim()) {
      alert("Enter a reason.");
      return;
    }

    if (!isOpen || !currentDrawerId) {
      alert("Open the cash drawer first.");
      return;
    }

    const now = new Date();

    await db.cashMovements.add({
      drawerId: currentDrawerId,
      type,
      amount: value,
      reason: reason.trim(),
      date: now,
      username: localStorage.getItem("username") || "unknown",
    } as any);

    await logAction(
      "Cash Drawer",
      `${type === "IN" ? "Added" : "Removed"} cash: ${value}. Reason: ${reason}`
    );

    setAmount("");
    setReason("");
    // No manual reload needed — the live queries above pick up the
    // db.cashMovements write automatically.
  };

  const closeDrawer = async () => {
    if (!isOpen || !currentDrawerId) return;

    const now = new Date();

    await db.cashDrawers.update(currentDrawerId, {
      status: "Closed",
      closedAt: now,
      closingBalance: currentBalance,
      closedBy: localStorage.getItem("username") || "unknown",
    } as any);

    await logAction(
      "Cash Drawer",
      `Closed cash drawer with balance ${currentBalance}`
    );

    // No manual reload needed — the live queries above pick up the
    // db.cashDrawers write automatically.
  };

  const canManage =
    role === "Admin" ||
    role === "Supervisor" ||
    role === "Cashier";

  if (!canManage) {
    return (
      <>
      <Navbar />
      <div className="page-shell flex items-center justify-center min-h-[60vh]">
        <div className="gloss-card p-8 text-center max-w-lg">
          <h1 className="page-title text-xl">Access denied</h1>
        </div>
      </div>
      </>
    );
  }

  return (
    <>
    <Navbar />
    <div className="page-shell space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="page-title flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30">
            <Wallet size={22} />
          </span>
          Cash Drawer
        </h1>

        <p className="page-subtitle">
          Cash management and drawer control
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 gloss-card p-5">
          <div className="flex items-center justify-between gap-6 mb-10">
            <div>
              <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Drawer Status
              </div>

              <div className="text-lg font-black text-slate-900 mt-2">
                {isOpen ? "OPEN" : "CLOSED"}
              </div>
            </div>

            {isOpen ? (
              <div className="w-16 h-16 rounded-3xl bg-success/10 text-success flex items-center justify-center">
                <Unlock size={30} />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-3xl bg-danger/10 text-danger flex items-center justify-center">
                <Lock size={30} />
              </div>
            )}
          </div>

          <div className="p-5 rounded-xl bg-slate-50">
            <div className="text-[10px] font-black uppercase tracking-widest text-slate-400">
              Current Drawer Balance
            </div>

            <div className="text-2xl font-black text-slate-900 tracking-tighter mt-3">
              {currentBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
          </div>

          {!isOpen ? (
            <div className="mt-8">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Opening Balance
              </label>

              <input
                type="number"
                min="0"
                step="0.01"
                value={openingBalance}
                onChange={(e) =>
                  setOpeningBalance(e.target.value)
                }
                className="w-full mt-2 p-5 rounded-lg border border-slate-100 bg-slate-50 font-black outline-none focus:bg-white focus:ring-8 focus:ring-primary/5"
              />

              <button
                onClick={openDrawer}
                className="w-full mt-5 bg-primary text-white py-5 rounded-lg font-black uppercase tracking-widest shadow-high"
              >
                <span className="flex justify-center items-center gap-3">
                  <Unlock size={20} />
                  Open Drawer
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={closeDrawer}
              className="w-full mt-8 bg-slate-900 text-white py-5 rounded-lg font-black uppercase tracking-widest shadow-high"
            >
              <span className="flex justify-center items-center gap-3">
                <Lock size={20} />
                Close Drawer
              </span>
            </button>
          )}
        </div>

        <div className="gloss-card p-5">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
            Cash Movement
          </h2>

          <div className="mt-8 grid grid-cols-2 gap-3">
            <button
              onClick={() => setType("IN")}
              className={`p-4 rounded-2xl font-black text-xs uppercase ${
                type === "IN"
                  ? "bg-success text-white"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              <ArrowDownCircle className="mx-auto mb-2" />
              Cash In
            </button>

            <button
              onClick={() => setType("OUT")}
              className={`p-4 rounded-2xl font-black text-xs uppercase ${
                type === "OUT"
                  ? "bg-danger text-white"
                  : "bg-slate-50 text-slate-500"
              }`}
            >
              <ArrowUpCircle className="mx-auto mb-2" />
              Cash Out
            </button>
          </div>

          <div className="mt-6">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Amount
            </label>

            <input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) =>
                setAmount(e.target.value)
              }
              className="w-full mt-2 p-5 rounded-lg border border-slate-100 bg-slate-50 font-black outline-none focus:bg-white focus:ring-8 focus:ring-primary/5"
            />
          </div>

          <div className="mt-5">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
              Reason
            </label>

            <textarea
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
              className="w-full mt-2 p-5 rounded-lg border border-slate-100 bg-slate-50 font-bold outline-none focus:bg-white focus:ring-8 focus:ring-primary/5 min-h-[120px]"
              placeholder="Reason for cash movement..."
            />
          </div>

          <button
            onClick={recordMovement}
            disabled={!isOpen}
            className="w-full mt-5 bg-primary text-white py-5 rounded-lg font-black uppercase tracking-widest shadow-high disabled:opacity-40"
          >
            Record Movement
          </button>
        </div>
      </div>
    </div>
    </>
  );
}
