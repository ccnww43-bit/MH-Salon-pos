"use client";

import React, { useEffect, useState } from "react";
import { db } from "@/lib/db";
import { logAction } from "@/lib/logger";
import { Navbar } from "@/components/navbar";
import { PermissionGuard } from "@/components/permissionguard";

import {
  DatabaseBackup,
  Download,
  Upload,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Lock,
} from "lucide-react";

export default function BackupsPage() {
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);


  useEffect(() => {
    if (typeof window === "undefined") return;

    const saved = localStorage.getItem("salon_pos_last_backup");

    if (saved) {
      setLastBackup(saved);
    }
  }, []);

  const createBackup = async () => {
    if (busy) return;

    setBusy(true);
    setStatus("");

    try {
      const [
        users,
        customers,
        services,
        bookings,
        sales,
        expenses,
        inventory,
        suppliers,
        purchaseOrders,
        moduleRecords,
        auditLogs,
        clinicalRecords,
        inventoryMovements,
        settings,
        cashDrawers,
        cashMovements,
      ] = await Promise.all([
        db.users.toArray(),
        db.customers.toArray(),
        db.services.toArray(),
        db.bookings.toArray(),
        db.sales.toArray(),

        db.moduleRecords
          .where("module")
          .equals("expense")
          .toArray(),

        db.inventory.toArray(),

        db.moduleRecords
          .where("module")
          .equals("supplier")
          .toArray(),

        db.moduleRecords
          .where("module")
          .equals("purchase-order")
          .toArray(),

        db.moduleRecords.toArray(),
        db.auditLogs.toArray(),
        db.clinicalRecords.toArray(),
        db.inventoryMovements.toArray(),
        db.settings.toArray(),
        db.cashDrawers.toArray(),
        db.cashMovements.toArray(),
      ]);

      const backup = {
        application: "Salon POS",
        version: "1.0",
        createdAt: new Date().toISOString(),

        data: {
          users,
          customers,
          services,
          bookings,

          sales,

          transactions: sales,

          expenses,
          inventory,
          suppliers,
          purchaseOrders,

          moduleRecords,
          auditLogs,
          clinicalRecords,
          inventoryMovements,
          settings,
          cashDrawers,
          cashMovements,
        },
      };

      const blob = new Blob(
        [JSON.stringify(backup, null, 2)],
        {
          type: "application/json",
        }
      );

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");

      const stamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

      link.href = url;
      link.download = `salon-pos-backup-${stamp}.json`;

      document.body.appendChild(link);
      link.click();
      link.remove();

      URL.revokeObjectURL(url);

      const now = new Date().toISOString();

      if (typeof window !== "undefined") {
        localStorage.setItem(
          "salon_pos_last_backup",
          now
        );
      }

      setLastBackup(now);
      setStatus("Backup created successfully.");

      await logAction(
        "Backups",
        "Created a complete Salon POS data backup"
      );
    } catch (error) {
      console.error(error);
      setStatus("Unable to create backup.");
    } finally {
      setBusy(false);
    }
  };

  const restoreBackup = () => {
    if (busy) return;

    setStatus("");

    document
      .getElementById("backup-file")
      ?.click();
  };

  const handleRestore = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    setBusy(true);
    setStatus("");

    try {
      const text = await file.text();
      const backup = JSON.parse(text);

      if (!backup?.data) {
        throw new Error("Invalid backup file");
      }

      const data = backup.data;

      if (Array.isArray(data.users)) {
        await db.users.bulkPut(data.users);
      }

      if (Array.isArray(data.customers)) {
        await db.customers.bulkPut(data.customers);
      }

      if (Array.isArray(data.services)) {
        await db.services.bulkPut(data.services);
      }

      if (Array.isArray(data.bookings)) {
        await db.bookings.bulkPut(data.bookings);
      }

      const salesData = Array.isArray(data.sales)
        ? data.sales
        : Array.isArray(data.transactions)
          ? data.transactions
          : [];

      if (salesData.length > 0) {
        await db.sales.bulkPut(salesData);
      }

      if (Array.isArray(data.moduleRecords)) {
        await db.moduleRecords.bulkPut(
          data.moduleRecords
        );
      } else {
        const legacyModuleRecords = [
          ...(Array.isArray(data.expenses)
            ? data.expenses
            : []),
          ...(Array.isArray(data.suppliers)
            ? data.suppliers
            : []),
          ...(Array.isArray(data.purchaseOrders)
            ? data.purchaseOrders
            : []),
        ];

        if (legacyModuleRecords.length > 0) {
          await db.moduleRecords.bulkPut(
            legacyModuleRecords
          );
        }
      }

      if (Array.isArray(data.inventory)) {
        await db.inventory.bulkPut(
          data.inventory
        );
      }

      if (Array.isArray(data.auditLogs)) {
        await db.auditLogs.bulkPut(
          data.auditLogs
        );
      }

      if (Array.isArray(data.clinicalRecords)) {
        await db.clinicalRecords.bulkPut(
          data.clinicalRecords
        );
      }

      if (Array.isArray(data.inventoryMovements)) {
        await db.inventoryMovements.bulkPut(
          data.inventoryMovements
        );
      }

      if (Array.isArray(data.settings)) {
        await db.settings.bulkPut(
          data.settings
        );
      }

      if (Array.isArray(data.cashDrawers)) {
        await db.cashDrawers.bulkPut(
          data.cashDrawers
        );
      }

      if (Array.isArray(data.cashMovements)) {
        await db.cashMovements.bulkPut(
          data.cashMovements
        );
      }

      setStatus(
        "Backup restored successfully."
      );

      await logAction(
        "Backups",
        "Restored Salon POS data from a backup file"
      );
    } catch (error) {
      console.error(error);
      setStatus(
        "Invalid or incompatible backup file."
      );
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  };

  return (
    <PermissionGuard
      permission="manage_backups"
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
    <div className="page-shell space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="page-title flex items-center gap-4">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30">
            <DatabaseBackup size={22} />
          </span>

          Backups
        </h1>

        <p className="page-subtitle">
          Protect your Salon POS data
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="gloss-card p-5">
          <div className="w-20 h-20 rounded-lg bg-success/10 text-success flex items-center justify-center mb-8">
            <ShieldCheck size={42} />
          </div>

          <h2 className="text-lg font-black text-slate-900 tracking-tighter uppercase">
            Backup Status
          </h2>

          <p className="text-slate-500 font-bold mt-3">
            Create a local backup containing the Salon POS data stored in
            IndexedDB.
          </p>

          <div className="mt-10 p-6 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <Clock size={16} />
              Last Backup
            </div>

            <div className="mt-3 font-black text-slate-900">
              {lastBackup
                ? new Date(
                    lastBackup
                  ).toLocaleString()
                : "No backup recorded"}
            </div>
          </div>

          <button
            onClick={createBackup}
            disabled={busy}
            className="w-full mt-8 bg-primary text-white py-6 rounded-lg font-black uppercase tracking-widest shadow-high hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-3">
              <Download size={22} />

              {busy
                ? "Processing..."
                : "Backup Now"}
            </span>
          </button>
        </div>

        <div className="gloss-card p-5">
          <div className="w-20 h-20 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-8">
            <Upload size={42} />
          </div>

          <h2 className="text-lg font-black text-slate-900 tracking-tighter uppercase">
            Restore Backup
          </h2>

          <p className="text-slate-500 font-bold mt-3">
            Restore data from a previously exported Salon POS backup.
          </p>

          <div className="mt-10 p-6 bg-warning/5 border border-warning/10 rounded-lg">
            <div className="flex items-start gap-3">
              <AlertTriangle
                size={20}
                className="text-warning shrink-0"
              />

              <p className="text-xs font-bold text-slate-500 leading-relaxed">
                Only restore a backup created by this Salon POS system.
              </p>
            </div>
          </div>

          <button
            onClick={restoreBackup}
            disabled={busy}
            className="w-full mt-8 bg-slate-900 text-white py-6 rounded-lg font-black uppercase tracking-widest shadow-high hover:scale-[1.01] active:scale-95 transition-all disabled:opacity-50"
          >
            <span className="flex items-center justify-center gap-3">
              <Upload size={22} />
              Restore Backup
            </span>
          </button>

          <input
            id="backup-file"
            type="file"
            accept=".json,application/json"
            onChange={handleRestore}
            className="hidden"
          />
        </div>
      </div>

      {status && (
        <div className="bg-white rounded-lg shadow-premium border border-white px-4 py-6 font-black text-sm text-slate-700">
          {status}
        </div>
      )}
    </div>
    </PermissionGuard>
  );
}
