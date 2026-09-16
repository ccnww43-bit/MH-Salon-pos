import React, { useState } from "react";
import { X } from "lucide-react";
import type { ReportReminder } from "@/lib/db";

const REMINDER_OPTIONS: ReportReminder[] = [
  "None",
  "Daily",
  "Weekly",
  "Monthly",
];

export function SaveReportModal({
  defaultName,
  onClose,
  onSave,
}: {
  defaultName: string;
  onClose: () => void;
  onSave: (input: { name: string; reminder: ReportReminder }) => void;
}) {
  const [name, setName] = useState(defaultName);
  const [reminder, setReminder] = useState<ReportReminder>("None");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return;

    onSave({ name: name.trim(), reminder });
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 backdrop-blur-md p-6">
      <div className="relative w-full max-w-md max-h-[85vh] overflow-y-auto bg-white rounded-xl p-4 shadow-[0_40px_100px_rgba(15,23,42,.3)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-6 top-6 p-2 rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="mb-6 pr-10">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-primary mb-2">
            Save Report View
          </div>

          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            Name this view
          </h2>
        </div>

        <form onSubmit={submit} className="space-y-5">
          <div>
            <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Report Name
            </label>

            <input
              autoFocus
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Weekly Cash Close"
              className="w-full h-12 rounded-2xl border border-slate-100 bg-slate-50 px-4 text-sm font-bold text-slate-800 outline-none focus:border-primary/30 focus:bg-white focus:ring-4 focus:ring-primary/10"
            />
          </div>

          <div>
            <label className="mb-2 ml-1 block text-[10px] font-black uppercase tracking-widest text-slate-400">
              Remind me
            </label>

            <div className="grid grid-cols-4 gap-2">
              {REMINDER_OPTIONS.map((option) => (
                <button
                  type="button"
                  key={option}
                  onClick={() => setReminder(option)}
                  className={`py-3 rounded-xl text-[10px] font-black uppercase ${
                    reminder === option
                      ? "bg-primary text-white"
                      : "bg-slate-50 text-slate-500"
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>

            <p className="text-[11px] font-bold text-slate-400 mt-3 leading-relaxed">
              This app works offline, so reminders don't send anything — a
              "Due" badge will show on the Report Center once the interval
              has passed since you last opened it.
            </p>
          </div>

          <button
            type="submit"
            className="w-full py-4 rounded-2xl bg-slate-900 text-white font-black uppercase text-xs tracking-widest"
          >
            Save View
          </button>
        </form>
      </div>
    </div>
  );
}
