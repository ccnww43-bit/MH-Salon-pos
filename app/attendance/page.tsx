"use client";

import React, { useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  Clock3,
  LogIn,
  LogOut,
  Calendar,
  User,
  AlertCircle,
  Lock,
} from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

export default function AttendancePage() {
  const [currentDateLabel, setCurrentDateLabel] = useState("");

  const staff = useLiveQuery(
    () =>
      db.moduleRecords
        .where("module")
        .equals("staff")
        .and((s: any) => s.status === "Active")
        .toArray(),
    []
  );

  const logs = useLiveQuery(
    () =>
      db.moduleRecords
        .where("module")
        .equals("attendance")
        .reverse()
        .limit(12)
        .toArray(),
    []
  );

  useEffect(() => {
    setCurrentDateLabel(
      new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    );
  }, []);

  const handleAction = async (
    id: number,
    name: string,
    type: "IN" | "OUT"
  ) => {
    const now = new Date();

    await db.moduleRecords.add({
      module: "attendance",
      title: `${name} - ${type === "IN" ? "Duty Start" : "Duty End"}`,
      status: type === "IN" ? "On Site" : "Off Site",
      staffId: id,
      data: {
        name,
        type,
        time: now.toLocaleTimeString(),
        date: now.toISOString().split("T")[0],
      },
      createdAt: now,
      updatedAt: now,
    });

    await logAction(
      "Attendance",
      `${name} performed ${type} scan`
    );
  };

  return (
    <PermissionGuard
      permission="manage_attendance"
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
    <div className="page-shell space-y-8 selection:bg-primary animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30">
              <Clock3 size={22} />
            </span>
            Duty Scan
          </h1>

          <p className="page-subtitle">
            Verified professional attendance tracking
          </p>
        </div>

        <div className="gloss-card px-4 py-3 font-black text-slate-900 text-sm tracking-widest uppercase">
          {currentDateLabel}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
        <div className="xl:col-span-2 space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-4 uppercase leading-none">
            <User className="text-primary" />
            Registered Professionals
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {staff?.map((s) => (
              <div
                key={s.id}
                className="bg-white p-4 rounded-xl shadow-premium border border-white flex items-center justify-between hover-lift group"
              >
                <div className="flex items-center gap-5">
                  <div className="w-16 h-16 rounded-lg bg-slate-50 flex items-center justify-center font-black text-primary text-xl uppercase group-hover:bg-primary group-hover:text-white transition-all shadow-sm leading-none">
                    {s.title.charAt(0)}
                  </div>

                  <div>
                    <div className="font-black text-slate-900 text-xl tracking-tighter leading-none mb-1">
                      {s.title}
                    </div>

                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      {s.data?.position || "Staff"}
                    </div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      handleAction(s.id!, s.title, "IN")
                    }
                    className="p-5 rounded-2xl bg-success/5 text-success hover:bg-success hover:text-white transition-all active-click shadow-sm"
                  >
                    <LogIn size={24} />
                  </button>

                  <button
                    onClick={() =>
                      handleAction(s.id!, s.title, "OUT")
                    }
                    className="p-5 rounded-2xl bg-danger/5 text-danger hover:bg-danger hover:text-white transition-all active-click shadow-sm"
                  >
                    <LogOut size={24} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-1 space-y-6">
          <h2 className="text-2xl font-black text-slate-900 tracking-tighter flex items-center gap-4 uppercase leading-none">
            <Calendar className="text-primary" />
            Session Feed
          </h2>

          <div className="bg-white rounded-xl shadow-high border border-white p-5 space-y-10 max-h-[700px] overflow-y-auto no-scrollbar relative">
            <div className="absolute top-0 left-0 w-full h-4 bg-gradient-to-b from-white to-transparent sticky z-10"></div>

            {logs?.map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-8 group border-b border-slate-50 pb-8 last:border-0 last:pb-0"
              >
                <div
                  className={`mt-2 w-3 h-3 rounded-full shrink-0 shadow-sm ${
                    l.data.type === "IN"
                      ? "bg-success ring-4 ring-success/10"
                      : "bg-danger ring-4 ring-danger/10"
                  }`}
                ></div>

                <div className="grow">
                  <div className="flex justify-between items-start mb-1 leading-none">
                    <div className="font-black text-slate-900 uppercase text-sm tracking-tight">
                      {l.data.name}
                    </div>

                    <div className="text-[9px] font-black text-slate-300 uppercase leading-none">
                      {l.data.time}
                    </div>
                  </div>

                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-2">
                    Verified Duty{" "}
                    {l.data.type === "IN" ? "Access" : "Closure"}
                  </div>
                </div>
              </div>
            ))}

            {!logs?.length && (
              <div className="text-center py-20 text-slate-100 font-black uppercase tracking-widest text-xs leading-none">
                <AlertCircle
                  size={48}
                  className="mx-auto mb-4 opacity-20"
                />
                Terminal Silent
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
