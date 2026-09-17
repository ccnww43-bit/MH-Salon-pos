"use client";

import { FormEvent, useState } from "react";
import { X, UserPlus } from "lucide-react";
import { db, Customer } from "@/lib/db";
import { logAction } from "@/lib/logger";

/**
 * Workflow-audit fix (see salon_pos_workflow_audit_report.pdf):
 * a single reusable "add customer without leaving the page" modal,
 * instead of a separate customer form on every screen that needs one.
 *
 * Usage: render once at the bottom of a page, control visibility with
 * `open`, and select the newly created customer via `onCreated`.
 *
 *   <CustomerQuickAdd
 *     open={showQuickAddCustomer}
 *     onClose={() => setShowQuickAddCustomer(false)}
 *     onCreated={(c) => { ...select c.id in the page's form... }}
 *   />
 */

const EMPTY_FORM = {
  name: "",
  phone: "",
  email: "",
  gender: "Female",
  dob: "",
  notes: "",
};

interface CustomerQuickAddProps {
  open: boolean;
  onClose: () => void;
  onCreated: (customer: Customer) => void;
}

export function CustomerQuickAdd({
  open,
  onClose,
  onCreated,
}: CustomerQuickAddProps) {
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
      // Same duplicate-phone guard used on the full Customers page, so a
      // quick-added walk-in can't silently fork an existing client record.
      const phoneClash = await db.customers
        .where("phone")
        .equals(phone)
        .first();

      if (phoneClash) {
        alert(
          `A client with phone ${phone} already exists: ${phoneClash.name}. Select them from the list instead.`
        );
        setSaving(false);
        return;
      }

      const now = new Date();

      const data: Customer = {
        name,
        phone,
        email: form.email.trim(),
        gender: form.gender,
        dob: form.dob,
        notes: form.notes.trim(),
        creditBalance: 0,
        loyaltyPoints: 0,
        createdAt: now,
        updatedAt: now,
      };

      const id = await db.customers.add(data);

      await logAction(
        "Customer Management",
        `Registered client: ${name} (quick add)`
      );

      setForm(EMPTY_FORM);
      onCreated({ ...data, id });
    } catch (err) {
      alert("Could not save this customer. Please try again.");
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
          <UserPlus size={20} className="text-primary" />
          Quick-Add Customer
        </h2>
        <p className="text-xs text-slate-400 font-bold mb-6">
          Register the client without leaving this form.
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
              onChange={(e) =>
                setForm({ ...form, name: e.target.value })
              }
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
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                Gender
              </label>
              <select
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold outline-none"
                value={form.gender}
                onChange={(e) =>
                  setForm({ ...form, gender: e.target.value })
                }
              >
                <option>Female</option>
                <option>Male</option>
                <option>Other</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
                Birth Date
              </label>
              <input
                type="date"
                className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold outline-none text-xs"
                value={form.dob}
                onChange={(e) =>
                  setForm({ ...form, dob: e.target.value })
                }
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Email (optional)
            </label>
            <input
              type="email"
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              value={form.email}
              onChange={(e) =>
                setForm({ ...form, email: e.target.value })
              }
            />
          </div>

          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-3">
              Notes (optional)
            </label>
            <textarea
              className="w-full p-4 rounded-2xl border border-slate-100 bg-slate-50 font-bold focus:bg-white focus:ring-4 focus:ring-primary/10 outline-none transition-all"
              rows={2}
              value={form.notes}
              onChange={(e) =>
                setForm({ ...form, notes: e.target.value })
              }
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
