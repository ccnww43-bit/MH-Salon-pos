"use client";

import React from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { logAction } from "@/lib/logger";
import { Bell, AlertTriangle, Gift, Calendar, DollarSign, ShieldAlert, CheckCircle2, MessageSquare, Info } from "lucide-react";

export default function NotificationsPage() {
  const settings = useLiveQuery(() => db.settings.toArray(), []);
  const inventory = useLiveQuery(() => db.inventory.toArray(), []);
  const bookings = useLiveQuery(() => db.bookings.toArray(), []);
  const vouchers = useLiveQuery(() => db.moduleRecords.where('module').equals('voucher').toArray(), []);

  // Notifications the user has dismissed ("mark as read"). Stored under the
  // existing 'notification' module in moduleRecords — no schema change —
  // keyed by each notification's stable id (title) so a dismissed alert
  // stays hidden across visits until the underlying condition changes.
  const dismissed = useLiveQuery(() => db.moduleRecords.where('module').equals('notification').toArray(), []);
  const dismissedIds = new Set((dismissed || []).map(d => d.title));

  // System-generated notifications (Requirement #28)
  const notifications = [
    ...(inventory?.filter(i => i.currentStock <= i.minimumStock).map(i => ({
      id: `stock-${i.id}`,
      type: 'Low Stock', icon: AlertTriangle, color: 'text-danger', bg: 'bg-danger/5',
      title: 'Inventory Alert', msg: `${i.name} has reached critical level (${i.currentStock} remaining).`
    })) || []),
    ...(bookings?.filter(b => new Date(b.bookingDate).toDateString() === new Date().toDateString() && b.status === 'Booked').map(b => ({
      id: `appt-${b.id}`,
      type: 'Appointment', icon: Calendar, color: 'text-primary', bg: 'bg-primary/5',
      title: 'Upcoming Appointment', msg: `${b.customerName} is scheduled for ${b.startTime} today.`
    })) || []),
    ...(vouchers?.filter(v => v.status === 'Active' && v.data.expiry && new Date(v.data.expiry) < new Date()).map(v => ({
       id: `voucher-${v.id}`,
       type: 'Expiry', icon: Gift, color: 'text-warning', bg: 'bg-warning/5',
       title: 'Voucher Expired', msg: `Voucher code ${v.title} has passed its validity date.`
    })) || [])
  ].filter(n => !dismissedIds.has(n.id));

  const handleDismiss = async (id: string) => {
    await db.moduleRecords.add({
      module: 'notification',
      title: id,
      status: 'Dismissed',
      data: {},
      createdAt: new Date(),
      updatedAt: new Date()
    });
    await logAction('Notifications', `Dismissed notification: ${id}`);
  };

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <Navbar />
      <div className="page-shell space-y-8">
        
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30"><Bell size={22} /></span>
            Notifications
          </h1>
          <p className="page-subtitle">System-generated alerts & operational reminders</p>
        </div>

        <div className="space-y-4">
           {notifications.map((n) => (
             <div key={n.id} className="gloss-card p-4 flex items-start gap-6 sm:gap-8 group">
                <div className={`p-5 rounded-3xl ${n.bg} ${n.color}`}>
                   <n.icon size={28}/>
                </div>
                <div className="grow">
                   <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">{n.type}</span>
                      <span className="text-[9px] font-black text-primary uppercase tracking-[0.2em]">Just Now</span>
                   </div>
                   <h3 className="text-xl font-black text-slate-900 tracking-tighter mb-1">{n.title}</h3>
                   <p className="text-sm font-bold text-slate-500 leading-relaxed">{n.msg}</p>
                </div>
                <button onClick={() => handleDismiss(n.id)} aria-label="Mark as read" className="btn btn-icon btn-secondary self-center opacity-60 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
                   <CheckCircle2 size={20}/>
                </button>
             </div>
           ))}

           {notifications.length === 0 && (
             <div className="empty-state gloss-card">
                <div className="empty-state-icon"><ShieldAlert size={26} /></div>
                <div className="empty-state-title">Clear system status</div>
                <p className="empty-state-text">No active alerts at this moment.</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
