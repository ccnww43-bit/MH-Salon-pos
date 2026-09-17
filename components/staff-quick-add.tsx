"use client";

import { FormEvent, useState } from "react";
import { X, User } from "lucide-react";
import { db, ModuleRecord } from "@/lib/db";
import { logAction } from "@/lib/logger";

/**
 * Lets a user register a new staff member directly from the Commissions
 * page (or anywhere else that needs a staff picker), instead of leaving
 * the screen to add the person via the Staff page first.
 *
 * Mirrors SupplierQuickAdd's shape/behaviour: writes a db.moduleRecords
 * row (module: 'staff') the same way app/staff/page.tsx creates
 * professionals, so the new person shows up everywhere staff are pulled
 * from (POS, Bookings, Commissions) immediately.
 *
 * Usage: render once at the bottom of a page, control visibility with
 * `open`, and select the newly created staff member via `onCreated`.
 *
 *   <StaffQuickAdd
 *     open={showQuickAddStaff}
 *     onClose={() => setShowQuickAddStaff(false)}
 *     onCreated={(s) => { ...select s.id in the page's form... }}
 *   />
 */

const EMPTY_FORM = {
  name: "",
  phone: "",
  position: "Senior Stylist",
  status: "Active",
  userId: "",
};

interface StaffQuickAddProps {
  open: boolean;
  onClose: () => void;
  onCreated: (staff: ModuleRecord) => void;
}

export function StaffQuickAdd({ open, onClose, onCreated }: StaffQuickAddProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const close = () => {
    if (saving) return;
    setForm(EMPTY_FORM);
    onClose();
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (!name || !phone) {
      return alert("Name and phone are required.");
    }

    setSaving(true);

    try {
      const now = new Date();

      const data = { ...form, name, phone };

      const record: Omit<ModuleRecord, "id"> = {
        module: "staff",
        title: name,
        status: "Active",
        data,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.moduleRecords.add(record as ModuleRecord);

      await logAction("HR", `Added new staff member: ${name} (quick add)`);

      setForm(EMPTY_FORM);
      onCreated({ ...record, id });
    } catch (err) {
      alert("Could not save this staff member. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] bg-slate-900/70 backdrop-blur-md flex items-center justify-center p-6"
      onClick={close}
    >
      <div
        className="bg-white w-full max-w-md max-h-[85vh] overflow-y-auto no-scrollbar rounded-xl shadow-high p-6 relative"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          className="absolute top-6 right-6 p-2 text-slate-300 hover:text-slate-900"
          title="Close"
        >
          <X size={24} />
        </button>

        <h2 className="text-lg font-black text-slate-900 tracking-tighter mb-1 flex items-center gap-2">
          <User size={20} className="text-primary" />
          Quick-Add Staff
        </h2>
        <p className="text-xs text-slate-400 font-bold mb-6">
          Add the team member without leaving this screen.
        </p>

        <form onSubmit={save} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Full Name
            </label>
            <input
              required
              autoFocus
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Phone
            </label>
            <input
              required
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Position (optional)
            </label>
            <input
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.position}
              onChange={(e) => setForm({ ...form, position: e.target.value })}
              placeholder="e.g. Senior Stylist"
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-primary text-white py-3.5 rounded-2xl font-black shadow-high shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all uppercase tracking-widest text-xs disabled:opacity-60 disabled:pointer-events-none"
            >
              {saving ? "Saving..." : "Save & Select"}
            </button>

            <button
              type="button"
              onClick={close}
              disabled={saving}
              className="px-5 rounded-2xl border border-slate-100 font-black text-slate-500 text-xs uppercase tracking-widest"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
