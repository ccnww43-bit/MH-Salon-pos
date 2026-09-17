"use client";

import React, { useMemo } from "react";
import Link from "next/link";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import {
  ArrowUp,
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CreditCard,
  DollarSign,
  Download,
  Package,
  Scissors,
  Users,
  WalletCards,
  Lock,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { PermissionGuard } from "@/components/permissionguard";

const money = (value: number, currency: string) =>
  `${currency} ${Math.round(value).toLocaleString()}`;

export default function DashboardPage() {
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const inventory = useLiveQuery(() => db.inventory.toArray(), []);
  const bookings = useLiveQuery(() => db.bookings.toArray(), []);
  const expenses = useLiveQuery(
    () => db.moduleRecords.where("module").equals("expense").toArray(),
    []
  );
  const settings = useLiveQuery(() => db.settings.toArray(), []);

  const currency = settings?.[0]?.currency || "KSh";

  const username =
    typeof window !== "undefined"
      ? localStorage.getItem("username") || "Manager"
      : "Manager";

  const stats = useMemo(() => {
    const now = new Date();
    const todayKey = now.toDateString();
    const month = now.getMonth();
    const year = now.getFullYear();

    const completedSales = (sales || []).filter(
      (s) => s.transactionStatus === "Completed"
    );

    const todaySales = completedSales.filter(
      (s) => new Date(s.createdAt).toDateString() === todayKey
    );

    const monthSales = completedSales.filter((s) => {
      const d = new Date(s.createdAt);

      return d.getMonth() === month && d.getFullYear() === year;
    });

    const todayRevenue = todaySales.reduce(
      (sum, s) => sum + s.total,
      0
    );

    const monthRevenue = monthSales.reduce(
      (sum, s) => sum + s.total,
      0
    );

    const expenseTotal = (expenses || [])
      .filter((e) => {
        const d = new Date((e.data && e.data.date) || e.createdAt);

        return d.getMonth() === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const todayBookings = (bookings || []).filter(
      (b) => new Date(b.bookingDate).toDateString() === todayKey
    );

    const servicesCompleted = todayBookings.filter(
      (b) => b.status === "Completed"
    ).length;

    const pendingPayments = completedSales.filter(
      (s) => s.balance > 0 && s.status !== "Cancelled"
    );

    const pendingValue = pendingPayments.reduce(
      (sum, s) => sum + s.balance,
      0
    );

    const lowStock = (inventory || []).filter(
      (i) =>
        i.isActive !== false &&
        i.currentStock <= i.minimumStock
    );

    const activeClients = customers?.length || 0;

    const paymentTotals = {
      Cash: 0,
      "M-Pesa": 0,
      Card: 0,
      "Bank Transfer": 0,
    } as Record<string, number>;

    completedSales.forEach((sale) => {
      sale.payments?.forEach((payment) => {
        if (paymentTotals[payment.method] !== undefined) {
          paymentTotals[payment.method] += payment.amount;
        }
      });
    });

    const serviceCounts = new Map<string, number>();

    completedSales.forEach((sale) =>
      sale.items
        ?.filter((i) => i.type === "Service")
        .forEach((item) =>
          serviceCounts.set(
            item.name,
            (serviceCounts.get(item.name) || 0) + item.quantity
          )
        )
    );

    const topServices = [...serviceCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const productCounts = new Map<string, number>();

    completedSales.forEach((sale) =>
      sale.items
        ?.filter((i) => i.type === "Product")
        .forEach((item) =>
          productCounts.set(
            item.name,
            (productCounts.get(item.name) || 0) + item.quantity
          )
        )
    );

    const topProducts = [...productCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const daily = Array.from({ length: 7 }, (_, index) => {
      const d = new Date(now);

      d.setDate(now.getDate() - (6 - index));

      const key = d.toDateString();

      return {
        label: d.toLocaleDateString(undefined, {
          weekday: "short",
        }),
        value: completedSales
          .filter(
            (s) => new Date(s.createdAt).toDateString() === key
          )
          .reduce((sum, s) => sum + s.total, 0),
      };
    });

    return {
      todayRevenue,
      monthRevenue,
      expenseTotal,
      profit: monthRevenue - expenseTotal,
      todayBookings,
      servicesCompleted,
      pendingValue,
      pendingCount: pendingPayments.length,
      lowStock,
      activeClients,
      paymentTotals,
      topServices,
      topProducts,
      daily,
    };
  }, [
    sales,
    customers,
    inventory,
    bookings,
    expenses,
  ]);

  const maxDaily = Math.max(
    ...stats.daily.map((d) => d.value),
    1
  );

  const recentBookings = [...(stats.todayBookings || [])]
    .sort((a, b) =>
      a.startTime.localeCompare(b.startTime)
    )
    .slice(0, 4);

  const productsSold = (sales || [])
    .filter((s) => s.transactionStatus === "Completed")
    .reduce(
      (sum, s) =>
        sum +
        s.items
          .filter((i) => i.type === "Product")
          .reduce((q, i) => q + i.quantity, 0),
      0
    );

  return (
    <PermissionGuard
      permission="view_dashboard"
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
    <div className="min-h-screen">
      <Navbar />

      <main className="mx-auto max-w-[1700px] px-4 pb-12 pt-5 md:px-7">
        <section className="mb-6 flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="mb-1 text-[15px] font-extrabold tracking-tight text-slate-800">
              WELCOME BACK,
            </p>

            <h1 className="text-[40px] font-black uppercase leading-[0.94] tracking-[-0.055em] text-slate-950 sm:text-[54px]">
              {username}
            </h1>

            <p className="mt-3 text-[14px] font-semibold text-slate-500">
              Here&apos;s what&apos;s happening with your salon today.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-3 rounded-[18px] border border-white/90 bg-white/75 px-4 py-3 text-sm font-extrabold text-slate-800 shadow-[0_12px_30px_rgba(15,23,42,.07)] backdrop-blur-xl">
              <CalendarDays size={18} />

              {new Date().toLocaleDateString(undefined, {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>

            <Link
              href="/reports"
              className="flex items-center gap-2 rounded-[18px] bg-[#0b1422] px-5 py-3 text-sm font-black text-white shadow-[0_14px_30px_rgba(15,23,42,.18)] transition hover:-translate-y-0.5"
            >
              <Download size={17} />
              Export Report
            </Link>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-2">
          <div className="gloss-card relative min-h-[245px] overflow-hidden rounded-[30px] p-7 md:p-4">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-blue-300/20 blur-3xl" />

            <div className="relative z-10">
              <div className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                Today Gross Revenue
              </div>

              <div className="mt-2 text-[43px] font-black leading-none tracking-[-0.045em] text-slate-950 md:text-[52px]">
                {money(stats.todayRevenue, currency)}
              </div>

              <div className="mt-5 h-8 w-[190px] overflow-hidden">
                <svg
                  viewBox="0 0 190 32"
                  className="h-full w-full"
                >
                  <path
                    d="M2 21 C20 6, 27 30, 44 19 S69 8, 84 21 S109 29, 124 12 S150 4, 169 17 S181 24, 188 10"
                    fill="none"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-blue-600 text-white shadow-[0_12px_24px_rgba(37,99,235,.28)]">
                  <ArrowUp size={19} />
                </div>

                <div>
                  <div className="text-[18px] font-black text-slate-950">
                    Today
                  </div>

                  <div className="text-[11px] font-bold text-slate-500">
                    Completed sales
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-7 right-7 flex h-24 w-24 items-center justify-center rounded-full border border-blue-200/80 bg-blue-500/15 shadow-[inset_0_0_0_8px_rgba(255,255,255,.55),0_20px_35px_rgba(37,99,235,.16)] backdrop-blur-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-blue-600 text-white shadow-[0_12px_25px_rgba(37,99,235,.35)]">
                <DollarSign size={30} strokeWidth={3} />
              </div>
            </div>
          </div>

          <div className="gloss-card relative min-h-[245px] overflow-hidden rounded-[30px] p-7 md:p-4">
            <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-emerald-300/20 blur-3xl" />

            <div className="relative z-10">
              <div className="text-[14px] font-black uppercase tracking-tight text-slate-900">
                Total Active Clients
              </div>

              <div className="mt-2 text-[43px] font-black leading-none tracking-[-0.045em] text-slate-950 md:text-[52px]">
                {stats.activeClients.toLocaleString()}
              </div>

              <div className="mt-5 h-8 w-[190px] overflow-hidden">
                <svg
                  viewBox="0 0 190 32"
                  className="h-full w-full"
                >
                  <path
                    d="M2 22 C18 25, 30 8, 46 18 S69 29, 84 16 S108 6, 122 20 S144 28, 157 12 S177 11, 188 7"
                    fill="none"
                    stroke="#10b981"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-[14px] bg-emerald-500 text-white shadow-[0_12px_24px_rgba(16,185,129,.25)]">
                  <Users size={19} />
                </div>

                <div>
                  <div className="text-[18px] font-black text-slate-950">
                    {stats.todayBookings.length} today
                  </div>

                  <div className="text-[11px] font-bold text-slate-500">
                    Bookings scheduled
                  </div>
                </div>
              </div>
            </div>

            <div className="absolute bottom-7 right-7 flex h-24 w-24 items-center justify-center rounded-full border border-emerald-200/80 bg-emerald-500/15 shadow-[inset_0_0_0_8px_rgba(255,255,255,.55),0_20px_35px_rgba(16,185,129,.14)] backdrop-blur-xl">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-white shadow-[0_12px_25px_rgba(16,185,129,.32)]">
                <Users size={29} fill="currentColor" />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {[
            {
              label: "TODAY SALES",
              value: money(stats.todayRevenue, currency),
              color: "bg-blue-600",
              text: "text-blue-600",
              icon: WalletCards,
              trend: "Live",
            },
            {
              label: "BOOKINGS",
              value: stats.todayBookings.length.toLocaleString(),
              color: "bg-orange-500",
              text: "text-orange-500",
              icon: CalendarDays,
              trend: "Today",
            },
            {
              label: "SERVICES",
              value: stats.servicesCompleted.toLocaleString(),
              color: "bg-violet-600",
              text: "text-violet-600",
              icon: Scissors,
              trend: "Completed",
            },
            {
              label: "PRODUCTS SOLD",
              value: productsSold.toLocaleString(),
              color: "bg-emerald-500",
              text: "text-emerald-600",
              icon: Package,
              trend: "Units",
            },
            {
              label: "AVG. TICKET",
              value: money(
                stats.todayBookings.length
                  ? stats.todayRevenue /
                      Math.max(stats.todayBookings.length, 1)
                  : 0,
                currency
              ),
              color: "bg-pink-500",
              text: "text-pink-500",
              icon: CreditCard,
              trend: "Today",
            },
            {
              label: "PENDING PAYMENTS",
              value: money(stats.pendingValue, currency),
              color: "bg-indigo-600",
              text: "text-indigo-600",
              icon: Clock3,
              trend: `${stats.pendingCount} invoices`,
            },
          ].map((card) => {
            const Icon = card.icon;

            return (
              <div
                key={card.label}
                className="gloss-card min-h-[170px] rounded-[25px] p-4 transition hover:-translate-y-1 md:p-5"
              >
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full ${card.color} text-white shadow-[0_10px_22px_rgba(15,23,42,.14)]`}
                >
                  <Icon size={21} />
                </div>

                <div className="mt-4 text-[10px] font-black text-slate-700">
                  {card.label}
                </div>

                <div className="mt-1 truncate text-[22px] font-black tracking-[-0.04em] text-slate-950">
                  {card.value}
                </div>

                <div
                  className={`mt-2 text-[10px] font-black ${card.text}`}
                >
                  {card.trend}
                </div>
              </div>
            );
          })}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="gloss-card rounded-[30px] p-6 md:p-7">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-[16px] font-black uppercase tracking-tight text-slate-950">
                  Sales Overview
                </h2>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Completed sales over the last 7 days
                </p>
              </div>

              <div className="rounded-[14px] border border-slate-200 bg-white/70 px-3 py-2 text-[10px] font-black text-slate-700">
                This Week
              </div>
            </div>

            <div className="flex h-[245px] gap-3">
              <div className="flex flex-col justify-between pb-7 pt-1 text-[9px] font-bold text-slate-400">
                <span>100K</span>
                <span>75K</span>
                <span>50K</span>
                <span>25K</span>
                <span>0</span>
              </div>

              <div className="relative flex flex-1 items-end justify-around gap-2 border-l border-b border-slate-200/70 px-2 pb-7">
                <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[82%] flex-col justify-between opacity-60">
                  <span className="border-t border-dashed border-slate-200" />
                  <span className="border-t border-dashed border-slate-200" />
                  <span className="border-t border-dashed border-slate-200" />
                  <span className="border-t border-dashed border-slate-200" />
                </div>

                {stats.daily.map((day, index) => (
                  <div
                    key={day.label}
                    className="relative z-10 flex h-full flex-1 flex-col items-center justify-end gap-2"
                  >
                    <div
                      className="w-full max-w-[34px] rounded-t-[10px] bg-gradient-to-t from-blue-700 to-blue-400 shadow-[0_8px_20px_rgba(37,99,235,.18)]"
                      style={{
                        height: `${Math.max(
                          (day.value / maxDaily) * 72,
                          day.value ? 8 : 3
                        )}%`,
                      }}
                      title={`${day.label}: ${money(
                        day.value,
                        currency
                      )}`}
                    />

                    <span
                      className={`text-[9px] font-black ${
                        index === 6
                          ? "text-blue-600"
                          : "text-slate-400"
                      }`}
                    >
                      {day.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="gloss-card rounded-[30px] p-6 md:p-7">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[16px] font-black uppercase tracking-tight text-slate-950">
                  Recent Bookings
                </h2>

                <p className="mt-1 text-[11px] font-semibold text-slate-400">
                  Today&apos;s schedule
                </p>
              </div>

              <Link
                href="/bookings"
                className="rounded-[14px] border border-slate-200 bg-white/70 px-3 py-2 text-[10px] font-black text-slate-700"
              >
                View All
              </Link>
            </div>

            <div className="space-y-2">
              {recentBookings.map((booking) => {
                const statusClass =
                  booking.status === "Confirmed"
                    ? "bg-emerald-100 text-emerald-700"
                    : booking.status === "In Progress"
                    ? "bg-blue-100 text-blue-700"
                    : booking.status === "Cancelled"
                    ? "bg-red-100 text-red-700"
                    : "bg-violet-100 text-violet-700";

                return (
                  <div
                    key={booking.id}
                    className="flex items-center gap-3 rounded-[18px] px-2 py-2.5 hover:bg-white/70"
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-slate-900 text-sm font-black text-white">
                      {booking.customerName?.[0]?.toUpperCase() ||
                        "C"}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[12px] font-black text-slate-900">
                        {booking.customerName}
                      </div>

                      <div className="truncate text-[10px] font-semibold text-slate-500">
                        {booking.services
                          ?.map((s) => s.name)
                          .join(", ") || "Service"}
                      </div>

                      <div className="mt-1 flex items-center gap-2 text-[9px] font-bold text-slate-400">
                        <CalendarDays size={10} />
                        Today
                        <Clock3 size={10} />
                        {booking.startTime}
                      </div>
                    </div>

                    <span
                      className={`shrink-0 rounded-full px-2.5 py-1.5 text-[9px] font-black ${statusClass}`}
                    >
                      {booking.status}
                    </span>
                  </div>
                );
              })}

              {!recentBookings.length && (
                <div className="rounded-[18px] bg-white/60 p-4 text-center text-[10px] font-black uppercase tracking-wider text-slate-400">
                  No bookings today
                </div>
              )}
            </div>

            <Link
              href="/bookings"
              className="mt-3 flex items-center justify-center gap-2 rounded-[16px] border border-blue-100 bg-blue-50/60 py-3 text-[10px] font-black text-slate-800"
            >
              View All Bookings
              <ArrowUpRight size={13} />
            </Link>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-3">
          <div className="gloss-card rounded-[26px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-black uppercase">
                Low Stock Alerts
              </h2>

              <Link
                href="/inventory"
                className="text-[10px] font-black text-blue-600"
              >
                View All
              </Link>
            </div>

            <div className="space-y-3">
              {stats.lowStock.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-[15px] bg-white/65 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                      <Package size={17} />
                    </div>

                    <div className="min-w-0">
                      <div className="truncate text-[11px] font-black">
                        {item.name}
                      </div>

                      <div className="text-[9px] font-semibold text-slate-400">
                        Min. Stock: {item.minimumStock}
                      </div>
                    </div>
                  </div>

                  <div className="text-sm font-black text-red-500">
                    {item.currentStock}
                  </div>
                </div>
              ))}

              {!stats.lowStock.length && (
                <div className="rounded-[15px] bg-emerald-50 p-4 text-center text-[10px] font-black text-emerald-700">
                  <CheckCircle2
                    className="mx-auto mb-1"
                    size={18}
                  />
                  Stock levels healthy
                </div>
              )}
            </div>
          </div>

          <div className="gloss-card rounded-[26px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-black uppercase">
                Payment Summary
              </h2>

              <Link
                href="/reports"
                className="text-[10px] font-black text-blue-600"
              >
                Reports
              </Link>
            </div>

            <div className="space-y-3">
              {Object.entries(stats.paymentTotals).map(
                ([method, value]) => (
                  <div
                    key={method}
                    className="flex items-center justify-between"
                  >
                    <span className="text-[11px] font-bold text-slate-500">
                      {method}
                    </span>

                    <span className="text-[12px] font-black text-slate-900">
                      {money(value, currency)}
                    </span>
                  </div>
                )
              )}

              <div className="mt-3 border-t border-slate-200 pt-3">
                <div className="flex justify-between">
                  <span className="text-[11px] font-bold text-slate-500">
                    Owed by debtors
                  </span>

                  <span className="text-[12px] font-black text-rose-600">
                    {money(stats.pendingValue, currency)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="gloss-card rounded-[26px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-black uppercase">
                Business Summary
              </h2>

              <Link
                href="/reports"
                className="text-[10px] font-black text-blue-600"
              >
                Open
              </Link>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-[16px] bg-blue-50 p-4">
                <div className="text-[9px] font-black uppercase text-blue-600">
                  Monthly Sales
                </div>

                <div className="mt-1 text-[18px] font-black">
                  {money(stats.monthRevenue, currency)}
                </div>
              </div>

              <div className="rounded-[16px] bg-red-50 p-4">
                <div className="text-[9px] font-black uppercase text-red-600">
                  Expenses
                </div>

                <div className="mt-1 text-[18px] font-black">
                  {money(stats.expenseTotal, currency)}
                </div>
              </div>

              <div className="col-span-2 rounded-[16px] bg-emerald-50 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[9px] font-black uppercase text-emerald-600">
                      Estimated Result
                    </div>

                    <div className="mt-1 text-[22px] font-black">
                      {money(stats.profit, currency)}
                    </div>

                    <div className="mt-0.5 text-[9px] font-medium text-emerald-700/70">
                      Revenue minus logged expenses — not a full P&L
                    </div>
                  </div>

                  <BarChart3
                    className="text-emerald-600"
                    size={28}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-2">
          <div className="gloss-card rounded-[26px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-black uppercase">
                Top Services
              </h2>

              <Scissors
                size={17}
                className="text-violet-600"
              />
            </div>

            <div className="space-y-3">
              {stats.topServices.map(
                ([name, count], i) => (
                  <div
                    key={name}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-[10px] font-black text-violet-600">
                      {i + 1}
                    </div>

                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
                      {name}
                    </span>

                    <span className="text-[11px] font-black text-slate-900">
                      {count}
                    </span>
                  </div>
                )
              )}

              {!stats.topServices.length && (
                <div className="text-[10px] font-bold text-slate-400">
                  No completed service sales yet.
                </div>
              )}
            </div>
          </div>

          <div className="gloss-card rounded-[26px] p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-[14px] font-black uppercase">
                Top Products
              </h2>

              <Package
                size={17}
                className="text-emerald-600"
              />
            </div>

            <div className="space-y-3">
              {stats.topProducts.map(
                ([name, count], i) => (
                  <div
                    key={name}
                    className="flex items-center gap-3"
                  >
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-black text-emerald-600">
                      {i + 1}
                    </div>

                    <span className="min-w-0 flex-1 truncate text-[11px] font-bold text-slate-700">
                      {name}
                    </span>

                    <span className="text-[11px] font-black text-slate-900">
                      {count}
                    </span>
                  </div>
                )
              )}

              {!stats.topProducts.length && (
                <div className="text-[10px] font-bold text-slate-400">
                  No completed product sales yet.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>
    </div>
    </PermissionGuard>
  );
}
