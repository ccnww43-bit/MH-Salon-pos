"use client";

import React, {
  useEffect,
  useState,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { SESSION_KEYS } from "@/lib/app-mode";
import {
  Bell,
  HelpCircle,
  Search,
  Settings,
  LogOut,
} from "lucide-react";

export const Navbar = () => {
  const [role, setRole] = useState<
    string | null
  >(null);

  const [username, setUsername] = useState<
    string | null
  >(null);

  const [search, setSearch] =
    useState("");

  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined")
      return;

    setRole(
      localStorage.getItem("userRole")
    );

    setUsername(
      localStorage.getItem("username")
    );
  }, []);

  const handleLogout = () => {
    if (typeof window !== "undefined") {
      for (const key of SESSION_KEYS) {
        localStorage.removeItem(key);
      }
      router.push("/");
    }
  };

  const handleSearch = (
    event: React.FormEvent<HTMLFormElement>
  ) => {
    event.preventDefault();

    const value = search.trim();

    if (!value) return;

    router.push(
      `/customers?search=${encodeURIComponent(
        value
      )}`
    );
  };

  return (
    <header className="sticky top-0 z-50 px-4 pb-2 pt-4 md:px-7">
      <div className="glass-panel mx-auto flex min-h-[70px] max-w-[1700px] items-center gap-3 rounded-[25px] px-3 py-2 md:gap-5 md:px-5">
        <Link
          href="/dashboard"
          className="hidden items-center gap-2 text-sm font-black text-slate-900 md:flex lg:hidden"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#0b1422] text-sm font-black text-yellow-300 shadow-[0_8px_18px_rgba(15,23,42,.15)]">
            MH
          </span>

          <span>MH DIGITAL</span>
        </Link>

        <form
          onSubmit={handleSearch}
          className="relative min-w-0 flex-1"
        >
          <Search
            size={18}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            type="search"
            placeholder="Search anything..."
            className="h-[46px] w-full rounded-[17px] border border-white/90 bg-white/65 pl-11 pr-4 text-[12px] font-bold text-slate-800 shadow-[inset_0_1px_0_rgba(255,255,255,.9)] placeholder:text-slate-400 focus:border-blue-200 focus:bg-white/90 focus:ring-4 focus:ring-blue-500/10"
          />
        </form>

        <div className="flex shrink-0 items-center gap-1 md:gap-2">
          <Link
            href="/notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-700 transition hover:bg-white hover:text-blue-600"
            aria-label="Notifications"
          >
            <Bell size={20} />

            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-blue-600 ring-2 ring-white" />
          </Link>

          <Link
            href="/settings"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-white hover:text-blue-600 md:flex"
            aria-label="Settings"
          >
            <Settings size={20} />
          </Link>

          <button
            type="button"
            className="hidden h-10 w-10 items-center justify-center rounded-full text-slate-800 transition hover:bg-white hover:text-blue-600 sm:flex"
            aria-label="Help"
          >
            <HelpCircle size={20} />
          </button>

          <div className="ml-1 flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 py-1.5 pl-1.5 pr-2 shadow-[0_8px_25px_rgba(15,23,42,.06)] md:gap-3 md:pl-2 md:pr-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-slate-900 text-sm font-black text-yellow-300 shadow-sm">
              {(
                username?.trim()?.[0] ||
                "P"
              ).toUpperCase()}
            </div>

            <div className="hidden min-w-0 sm:block">
              <div className="max-w-[135px] truncate text-[12px] font-black text-slate-900">
                {username || "Manager"}
              </div>

              <div className="text-[10px] font-semibold capitalize text-slate-500">
                {role || "Guest"}
              </div>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="ml-1 rounded-full p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 md:hidden"
              aria-label="Logout"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
