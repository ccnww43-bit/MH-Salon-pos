"use client";

import React from "react";
import Link from "next/link";
import {
  Bell,
  CalendarPlus,
  ChevronRight,
  Clock3,
  Plus,
  ShoppingCart,
  UserPlus,
  X,
} from "lucide-react";

type RightSidebarProps = {
  open: boolean;
  onClose: () => void;
};

export const RightSidebar = ({
  open,
  onClose,
}: RightSidebarProps) => {
  if (!open) return null;

  return (
    <aside className="hidden w-[280px] shrink-0 border-l border-slate-200/80 bg-white/75 backdrop-blur-xl lg:flex lg:flex-col">
      {/* HEADER */}
      <div className="flex h-[82px] shrink-0 items-center justify-between border-b border-slate-200/70 px-5">
        <div>
          <div className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-400">
            Workspace
          </div>

          <div className="mt-1 text-[15px] font-black text-slate-900">
            Quick Actions
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close right panel"
        >
          <X size={17} />
        </button>
      </div>

      {/* QUICK ACTIONS */}
      <div className="border-b border-slate-200/70 p-4">
        <div className="mb-3 text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
          Quick Actions
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/pos"
            className="flex min-h-[72px] flex-col justify-between rounded-xl border border-blue-100 bg-blue-50 p-3 text-blue-700 transition hover:border-blue-200 hover:bg-blue-100"
          >
            <ShoppingCart size={18} />

            <span className="text-[10px] font-black">
              New Sale
            </span>
          </Link>

          <Link
            href="/bookings"
            className="flex min-h-[72px] flex-col justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-emerald-700 transition hover:border-emerald-200 hover:bg-emerald-100"
          >
            <CalendarPlus size={18} />

            <span className="text-[10px] font-black">
              Booking
            </span>
          </Link>

          <Link
            href="/customers"
            className="flex min-h-[72px] flex-col justify-between rounded-xl border border-violet-100 bg-violet-50 p-3 text-violet-700 transition hover:border-violet-200 hover:bg-violet-100"
          >
            <UserPlus size={18} />

            <span className="text-[10px] font-black">
              Customer
            </span>
          </Link>

          <Link
            href="/services"
            className="flex min-h-[72px] flex-col justify-between rounded-xl border border-amber-100 bg-amber-50 p-3 text-amber-700 transition hover:border-amber-200 hover:bg-amber-100"
          >
            <Plus size={18} />

            <span className="text-[10px] font-black">
              Service
            </span>
          </Link>
        </div>
      </div>

      {/* TODAY */}
      <div className="border-b border-slate-200/70 p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
            Today
          </div>

          <Clock3
            size={15}
            className="text-slate-300"
          />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="text-[11px] font-bold text-slate-500">
            Your workspace
          </div>

          <div className="mt-1 text-[22px] font-black text-slate-900">
            Ready
          </div>

          <div className="mt-1 text-[10px] font-semibold text-slate-400">
            Use the shortcuts above to start working.
          </div>
        </div>
      </div>

      {/* NOTIFICATIONS */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-400">
            Notifications
          </div>

          <Bell
            size={15}
            className="text-slate-300"
          />
        </div>

        <Link
          href="/notifications"
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-blue-200 hover:bg-blue-50/40"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
            <Bell size={16} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-black text-slate-800">
              View notifications
            </div>

            <div className="mt-0.5 text-[9px] font-semibold text-slate-400">
              Check system alerts and updates.
            </div>
          </div>

          <ChevronRight
            size={15}
            className="text-slate-300"
          />
        </Link>
      </div>
    </aside>
  );
};
