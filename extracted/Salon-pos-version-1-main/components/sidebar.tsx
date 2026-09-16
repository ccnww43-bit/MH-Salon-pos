"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LogOut,
  Scissors,
  LayoutDashboard,
  ShoppingCart,
  Users,
  Settings,
  Receipt,
  Wallet,
  UserCog,
  CalendarDays,
  FileText,
  Boxes,
  ChevronDown,
  Gift,
  Star,
  Megaphone,
  Truck,
  ClipboardList,
  Clock3,
  CalendarOff,
  Bell,
  BadgeDollarSign,
  Package,
  CreditCard,
  DatabaseBackup,
  ScrollText,
  Menu,
  X,
  LayoutGrid,
} from "lucide-react";
import { hasPermission } from "@/lib/permissions";
import { db } from "@/lib/db";
import { logAction } from "@/lib/logger";
import { SESSION_KEYS } from "@/lib/app-mode";

type NavLeaf = {
  href: string;
  icon: React.ElementType;
  label: string;
  permission?: string;
};

export const Sidebar = () => {
  const [role, setRole] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);

  const pathname = usePathname();
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);

  const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

  useEffect(() => {
    setMounted(true);

    if (typeof window !== "undefined") {
      setRole(localStorage.getItem("userRole"));
    }
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      for (const key of SESSION_KEYS) {
        localStorage.removeItem(key);
      }
      router.push("/");
    }
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("userRole")) return;

    let idleTimer: ReturnType<typeof setTimeout>;

    const endIdleSession = () => {
      for (const key of SESSION_KEYS) {
        localStorage.removeItem(key);
      }
      alert(
        "You've been logged out after 15 minutes of inactivity. Please sign in again."
      );
      router.push("/");
    };

    const resetIdleTimer = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(endIdleSession, IDLE_TIMEOUT_MS);
    };

    const activityEvents = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];

    activityEvents.forEach((evt) =>
      window.addEventListener(evt, resetIdleTimer)
    );

    resetIdleTimer();

    return () => {
      clearTimeout(idleTimer);

      activityEvents.forEach((evt) =>
        window.removeEventListener(evt, resetIdleTimer)
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!localStorage.getItem("userRole")) return;

    const AUTO_BACKUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

    const lastBackup = localStorage.getItem("salon_pos_last_backup");

    const dueForBackup =
      !lastBackup ||
      Date.now() - new Date(lastBackup).getTime() >
        AUTO_BACKUP_INTERVAL_MS;

    if (!dueForBackup) return;

    const runAutoBackup = async () => {
      try {
        const [
          users,
          customers,
          services,
          bookings,
          sales,
          inventory,
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
          db.inventory.toArray(),
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
            inventory,
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
          { type: "application/json" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        const stamp = new Date()
          .toISOString()
          .replace(/[:.]/g, "-");

        link.href = url;
        link.download = `salon-pos-auto-backup-${stamp}.json`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);

        localStorage.setItem(
          "salon_pos_last_backup",
          new Date().toISOString()
        );

        await logAction(
          "Backups",
          "Automatic daily backup created (24+ hours since the last backup)."
        );
      } catch (err) {
        console.error("Automatic backup failed:", err);
      }
    };

    runAutoBackup();
  }, []);

  useEffect(() => {
    const onClickOutside = (event: MouseEvent) => {
      if (
        barRef.current &&
        !barRef.current.contains(event.target as Node)
      ) {
        setOpenGroup(null);
      }
    };

    document.addEventListener("mousedown", onClickOutside);

    return () =>
      document.removeEventListener(
        "mousedown",
        onClickOutside
      );
  }, []);

  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const can = (permission?: string) =>
    !permission || hasPermission(role, permission);

  const primaryItems: NavLeaf[] = [
    {
      href: "/dashboard",
      icon: LayoutDashboard,
      label: "Dashboard",
      permission: "view_dashboard",
    },
    {
      href: "/pos",
      icon: ShoppingCart,
      label: "POS",
      permission: "access_pos",
    },
    {
      href: "/bookings",
      icon: CalendarDays,
      label: "Bookings",
      permission: "view_bookings",
    },
    {
      href: "/customers",
      icon: Users,
      label: "Clients",
      permission: "view_customers",
    },
    {
      href: "/customer-records",
      icon: FileText,
      label: "Clinical Records",
      permission: "view_clinical_records",
    },
  ];

  const groups: {
    name: string;
    icon: React.ElementType;
    items: NavLeaf[];
  }[] = [
    {
      name: "Catalog",
      icon: LayoutGrid,
      items: [
        {
          href: "/services",
          icon: Scissors,
          label: "Services",
          permission: "view_services",
        },
        {
          href: "/packages",
          icon: Package,
          label: "Packages",
          permission: "manage_packages",
        },
        {
          href: "/memberships",
          icon: CreditCard,
          label: "Memberships",
          permission: "manage_memberships",
        },
        {
          href: "/vouchers",
          icon: Gift,
          label: "Vouchers",
          permission: "manage_vouchers",
        },
        {
          href: "/loyalty",
          icon: Star,
          label: "Loyalty",
          permission: "manage_loyalty",
        },
        {
          href: "/promotions",
          icon: Megaphone,
          label: "Promotions",
          permission: "manage_promotions",
        },
      ],
    },
    {
      name: "Inventory",
      icon: Boxes,
      items: [
        {
          href: "/inventory",
          icon: Boxes,
          label: "Inventory",
          permission: "manage_inventory",
        },
        {
          href: "/inventory/movements",
          icon: ClipboardList,
          label: "Stock Movements",
          permission: "manage_inventory",
        },
        {
          href: "/suppliers",
          icon: Truck,
          label: "Suppliers",
          permission: "manage_suppliers",
        },
        {
          href: "/purchase-orders",
          icon: ClipboardList,
          label: "Purchases",
          permission: "manage_purchase_orders",
        },
      ],
    },
    {
      name: "Finance",
      icon: Wallet,
      items: [
        {
          href: "/transactions",
          icon: Receipt,
          label: "Invoices",
          permission: "view_reports",
        },
        {
          href: "/cash-drawer",
          icon: CreditCard,
          label: "Cash Drawer",
          permission: "manage_cash_drawer",
        },
        {
          href: "/expenses",
          icon: Wallet,
          label: "Expenses",
          permission: "manage_expenses",
        },
        {
          href: "/reports",
          icon: FileText,
          label: "Reports",
          permission: "view_reports",
        },
      ],
    },
    {
      name: "Staff",
      icon: UserCog,
      items: [
        {
          href: "/staff",
          icon: UserCog,
          label: "Staff",
          permission: "manage_staff",
        },
        {
          href: "/commissions",
          icon: BadgeDollarSign,
          label: "Commissions",
          permission: "manage_commissions",
        },
        {
          href: "/attendance",
          icon: Clock3,
          label: "Attendance",
          permission: "manage_attendance",
        },
        {
          href: "/leave",
          icon: CalendarOff,
          label: "Leave",
          permission: "manage_leave",
        },
      ],
    },
    {
      name: "Admin",
      icon: Settings,
      items: [
        {
          href: "/notifications",
          icon: Bell,
          label: "Notifications",
        },
        {
          href: "/audit-logs",
          icon: ScrollText,
          label: "Audit Log",
          permission: "view_audit_logs",
        },
        {
          href: "/backups",
          icon: DatabaseBackup,
          label: "Backups",
          permission: "manage_backups",
        },
        {
          href: "/users",
          icon: UserCog,
          label: "Users",
          permission: "view_users",
        },
        {
          href: "/settings",
          icon: Settings,
          label: "Settings",
          permission: "manage_settings",
        },
      ],
    },
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" &&
      pathname.startsWith(`${href}/`));

  const visibleGroups = mounted
    ? groups
        .map((group) => ({
          ...group,
          items: group.items.filter((item) =>
            can(item.permission)
          ),
        }))
        .filter((group) => group.items.length > 0)
    : [];

  const visiblePrimary = mounted
    ? primaryItems.filter((item) => can(item.permission))
    : [];

  return (
    <>
      {/* MOBILE */}
      <div className="fixed left-0 right-0 top-0 z-[100] flex h-16 items-center justify-between bg-[#07101c] px-4 text-white lg:hidden">
        <Link
          href="/dashboard"
          className="flex items-center gap-2"
        >
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-yellow-300/70 bg-[#101b2a]">
            <span className="font-serif text-[15px] font-black text-yellow-300">
              MH
            </span>
          </div>

          <div>
            <div className="text-[11px] font-black tracking-[0.08em]">
              MH DIGITAL
            </div>
            <div className="text-[7px] font-black uppercase tracking-[0.22em] text-yellow-200/70">
              Salon POS
            </div>
          </div>
        </Link>

        <button
          type="button"
          onClick={() => setMobileOpen(!mobileOpen)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/[0.08]"
          aria-label="Toggle menu"
        >
          {mobileOpen ? (
            <X size={20} />
          ) : (
            <Menu size={20} />
          )}
        </button>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-[90] bg-[#07101c] pt-20 lg:hidden">
          <div className="prestige-scroll h-full overflow-y-auto px-4 pb-8">
            {visiblePrimary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-[13px] font-bold ${
                  isActive(item.href)
                    ? "bg-[#2463eb] text-white"
                    : "text-white/75 hover:bg-white/[0.08]"
                }`}
              >
                <item.icon size={17} />
                {item.label}
              </Link>
            ))}

            {visibleGroups.map((group) => (
              <div key={group.name} className="mt-5">
                <div className="px-4 text-[9px] font-black uppercase tracking-[0.16em] text-white/35">
                  {group.name}
                </div>

                <div className="mt-2">
                  {group.items.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`mb-1 flex items-center gap-3 rounded-xl px-4 py-3 text-[12px] font-bold ${
                        isActive(item.href)
                          ? "bg-[#2463eb] text-white"
                          : "text-white/70 hover:bg-white/[0.08]"
                      }`}
                    >
                      <item.icon size={16} />
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-red-300"
            >
              <LogOut size={17} />
              Logout
            </button>
          </div>
        </div>
      )}

      {/* DESKTOP LEFT SIDEBAR */}
      <aside
        ref={barRef}
        className="prestige-sidebar fixed bottom-0 left-0 top-0 z-[100] hidden w-[245px] flex-col text-white lg:flex"
      >
        {/* BRAND */}
        <div className="flex h-[82px] shrink-0 items-center border-b border-white/[0.07] px-5">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
          >
            <div className="flex h-11 w-11 items-center justify-center rounded-full border border-yellow-300/70 bg-[radial-gradient(circle,#27364b_0%,#101b2a_65%,#07101b_100%)]">
              <span className="font-serif text-[17px] font-black text-yellow-300">
                MH
              </span>
            </div>

            <div className="leading-tight">
              <div className="text-[13px] font-black tracking-[0.08em] text-yellow-200">
                MH DIGITAL
              </div>

              <div className="mt-1 text-[8px] font-black uppercase tracking-[0.25em] text-yellow-100/55">
                Salon POS
              </div>
            </div>
          </Link>
        </div>

        {/* NAVIGATION */}
        <div className="prestige-scroll min-h-0 flex-1 overflow-y-auto px-3 py-5">
          <div className="mb-2 px-3 text-[9px] font-black uppercase tracking-[0.17em] text-white/30">
            Main
          </div>

          <div className="space-y-1">
            {visiblePrimary.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[12px] font-extrabold transition ${
                  isActive(item.href)
                    ? "bg-[#2463eb] text-white shadow-[0_10px_24px_rgba(37,99,235,.25)]"
                    : "text-white/65 hover:bg-white/[0.07] hover:text-white"
                }`}
              >
                <item.icon
                  size={17}
                  strokeWidth={2.1}
                />
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {visibleGroups.map((group) => {
            const groupActive = group.items.some(
              (item) => isActive(item.href)
            );

            return (
              <div key={group.name} className="mt-5">
                <button
                  type="button"
                  onClick={() =>
                    setOpenGroup(
                      openGroup === group.name
                        ? null
                        : group.name
                    )
                  }
                  className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[9px] font-black uppercase tracking-[0.16em] transition ${
                    groupActive
                      ? "text-blue-300"
                      : "text-white/35 hover:text-white/65"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <group.icon size={13} />
                    {group.name}
                  </span>

                  <ChevronDown
                    size={13}
                    className={`transition-transform ${
                      openGroup === group.name
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>

                {(openGroup === group.name ||
                  groupActive) && (
                  <div className="mt-1 space-y-1">
                    {group.items.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`ml-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-[11px] font-bold transition ${
                          isActive(item.href)
                            ? "bg-white/[0.11] text-white"
                            : "text-white/55 hover:bg-white/[0.06] hover:text-white"
                        }`}
                      >
                        <item.icon size={15} />
                        {item.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* BOTTOM USER AREA */}
        <div className="shrink-0 border-t border-white/[0.07] p-3">
          <div className="mb-2 flex items-center gap-3 rounded-xl bg-white/[0.045] px-3 py-2.5">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#101b2a] text-sm font-black text-yellow-300">
              {(
                (typeof window !== "undefined"
                  ? localStorage.getItem("username")?.trim()?.[0]
                  : undefined) || "M"
              ).toUpperCase()}
            </div>

            <div className="min-w-0">
              <div className="truncate text-[11px] font-black text-white">
                {typeof window !== "undefined"
                  ? localStorage.getItem("username") ||
                    "Manager"
                  : "Manager"}
              </div>

              <div className="text-[9px] capitalize text-white/40">
                {role || "Manager"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1">
            <Link
              href="/backups"
              className="flex items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold text-white/45 hover:bg-white/[0.06] hover:text-white"
            >
              <DatabaseBackup size={14} />
              Backup
            </Link>

            <button
              type="button"
              onClick={handleLogout}
              className="flex items-center justify-center gap-2 rounded-xl py-2 text-[10px] font-bold text-white/45 hover:bg-red-500/10 hover:text-red-300"
            >
              <LogOut size={14} />
              Logout
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
