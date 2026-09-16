"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { CalendarOff, Plus, Clock, Trash2, X, Lock } from "lucide-react";
import { logAction } from "@/lib/logger";
import { PermissionGuard } from "@/components/permissionguard";

export default function LeavePage() {
  const staff = useLiveQuery(
    () => db.moduleRecords.where("module").equals("staff").toArray(),
    []
  );

  const requests = useLiveQuery(
    () => db.moduleRecords.where("module").equals("leave").reverse().toArray(),
    []
  );

  const [form, setForm] = useState({
    staffId: "",
    type: "Annual Leave",
    start: "",
    end: "",
    notes: ""
  });

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();

    const staffMember = staff?.find(
      s => String(s.id) === form.staffId
    );

    const now = new Date();

    await db.moduleRecords.add({
      module: "leave",
      title: `${staffMember?.title}: ${form.type}`,
      status: "Awaiting",
      staffId: Number(form.staffId),
      data: {
        ...form,
        staffName: staffMember?.title
      },
      createdAt: now,
      updatedAt: now
    });

    await logAction(
      "HR",
      `Absence request logged for ${staffMember?.title}`
    );

    setForm({
      staffId: "",
      type: "Annual Leave",
      start: "",
      end: "",
      notes: ""
    });

    document
      .getElementById("leave-modal")
      ?.classList.add("hidden");
  };

  const handleStatus = async (
    id: number,
    status: string
  ) => {
    await db.moduleRecords.update(id, {
      status,
      updatedAt: new Date()
    });

    await logAction(
      "HR",
      `Absence #${id} decision: ${status}`
    );
  };

  return (
    <PermissionGuard
      permission="manage_leave"
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
          <h1 className="page-title">
            Absences
          </h1>

          <p className="page-subtitle">
            Staff leave logs & holiday tracking
          </p>
        </div>

        <button
          onClick={() =>
            document
              .getElementById("leave-modal")
              ?.classList.remove("hidden")
          }
          className="btn btn-primary"
        >
          <Plus size={18} />
          Request Leave
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-8">
        {requests?.map(r => (
          <div
            key={r.id}
            className="gloss-card p-5 relative overflow-hidden group"
          >
            <div className="flex justify-between items-start mb-10">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-slate-50 flex items-center justify-center font-black text-primary text-xl uppercase shadow-inner leading-none">
                  {r.data.staffName?.charAt(0)}
                </div>

                <div className="font-black text-slate-900 uppercase text-sm tracking-tighter leading-none">
                  {r.data.staffName}
                </div>
              </div>

              <span
                className={`badge ${
                  r.status === "Approved"
                    ? "badge-success"
                    : r.status === "Rejected"
                    ? "badge-danger"
                    : "badge-warning animate-pulse"
                }`}
              >
                {r.status}
              </span>
            </div>

            <h3 className="text-2xl font-black text-slate-900 tracking-tighter mb-4 leading-none uppercase">
              {r.data.type}
            </h3>

            <div className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em] flex items-center gap-2 mb-8 leading-none">
              <Clock size={14} />
              {r.data.start} — {r.data.end}
            </div>

            <div className="p-6 bg-slate-50 rounded-3xl text-xs font-bold text-slate-400 italic mb-10 leading-relaxed border border-slate-100">
              "{r.data.notes || "No justification provided"}"
            </div>

            <div className="flex gap-3 pt-8 border-t border-slate-50 mt-auto">
              {r.status === "Awaiting" && (
                <>
                  <button
                    onClick={() =>
                      handleStatus(r.id!, "Approved")
                    }
                    className="flex-1 bg-success text-white py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition-all active-click"
                  >
                    APPROVE
                  </button>

                  <button
                    onClick={() =>
                      handleStatus(r.id!, "Rejected")
                    }
                    className="flex-1 bg-white border border-danger/20 text-danger py-4 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-danger hover:text-white transition-all active-click"
                  >
                    REJECT
                  </button>
                </>
              )}

              <button
                onClick={async () =>
                  await db.moduleRecords.delete(r.id!)
                }
                className="p-4 bg-slate-50 text-slate-200 hover:text-danger rounded-2xl transition-colors"
              >
                <Trash2 size={20} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <div
        id="leave-modal"
        className="fixed inset-0 z-[200] bg-slate-900/80 backdrop-blur-2xl hidden flex items-center justify-center p-4 animate-in fade-in duration-300"
      >
        <div className="bg-white w-full max-w-2xl max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative">
          <button
            onClick={() =>
              document
                .getElementById("leave-modal")
                ?.classList.add("hidden")
            }
            className="absolute top-12 right-12 p-3 rounded-3xl hover:bg-slate-50 transition-all text-slate-200 hover:text-slate-900"
          >
            <X size={40} />
          </button>

          <h2 className="text-xl font-black text-slate-900 tracking-tighter mb-12 uppercase leading-none">
            Leave Logic
          </h2>

          <form
            onSubmit={handleApply}
            className="space-y-8 leading-none"
          >
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">
                Target Professional
              </label>

              <select
                required
                className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none appearance-none cursor-pointer focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all"
                value={form.staffId}
                onChange={e =>
                  setForm({
                    ...form,
                    staffId: e.target.value
                  })
                }
              >
                <option value="">
                  Choose Staff Member...
                </option>

                {staff?.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.title}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">
                  Effective Start
                </label>

                <input
                  type="date"
                  required
                  className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white transition-all text-xs"
                  value={form.start}
                  onChange={e =>
                    setForm({
                      ...form,
                      start: e.target.value
                    })
                  }
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">
                  Logical End
                </label>

                <input
                  type="date"
                  required
                  className="w-full p-6 rounded-4xl bg-slate-50 border border-slate-100 font-black text-slate-900 outline-none focus:bg-white transition-all text-xs"
                  value={form.end}
                  onChange={e =>
                    setForm({
                      ...form,
                      end: e.target.value
                    })
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-6">
                Absence Justification
              </label>

              <textarea
                className="w-full p-4 rounded-4xl bg-slate-50 border border-slate-100 font-bold outline-none min-h-[140px] focus:bg-white focus:ring-8 focus:ring-primary/5 transition-all leading-relaxed text-sm"
                placeholder="Provide operational detail for HR decision..."
                value={form.notes}
                onChange={e =>
                  setForm({
                    ...form,
                    notes: e.target.value
                  })
                }
              />
            </div>

            <button
              type="submit"
              className="w-full bg-primary text-white py-2.5 rounded-5xl font-black text-2xl shadow-high hover:scale-[1.02] active:scale-95 transition-all uppercase tracking-tighter mt-4"
            >
              SUBMIT REQUEST
            </button>
          </form>
        </div>
      </div>
    </div>
    </PermissionGuard>
  );
}
