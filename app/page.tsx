"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { db } from "@/lib/db";
import { getPermissions } from "@/lib/permissions";
import { logAction } from "@/lib/logger";
import {
  hashPassword,
  verifyPassword,
} from "@/lib/security";

import {
  Scissors,
  User,
  Lock,
  LogIn,
  ShieldCheck,
  CheckCircle2,
  KeyRound,
  CalendarDays,
} from "lucide-react";

import {
  getLicenseStatus,
  formatLicenseDate,
} from "@/lib/license";

export default function LoginPage() {
  const router = useRouter();

  const [checking, setChecking] =
    useState(true);

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [error, setError] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [licenseExpired, setLicenseExpired] =
    useState(false);

  const [licenseInfo, setLicenseInfo] =
    useState<any>(null);

  useEffect(() => {
    const checkSetup = async () => {
      try {
        const userCount =
          await db.users.count();

        if (userCount === 0) {
          router.replace("/setup");
          return;
        }

        const license =
          await getLicenseStatus();

        if (!license.exists) {
          setError(
            "This installation does not have an active license."
          );

          setChecking(false);
          return;
        }

        setLicenseInfo(
          license.license
        );

        if (license.expired) {
          setLicenseExpired(true);
        }
      } catch (err) {
        console.error(
          "System verification failed:",
          err
        );

        setError(
          "System verification failed. Please refresh."
        );
      } finally {
        setChecking(false);
      }
    };

    checkSetup();
  }, [router]);

  const handleLogin = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    setError("");
    setLoading(true);

    try {
      const license =
        await getLicenseStatus();

      if (!license.exists) {
        setError(
          "This installation does not have an active license."
        );

        setLoading(false);
        return;
      }

      setLicenseInfo(
        license.license
      );

      if (license.expired) {
        setLicenseExpired(true);
        setLoading(false);
        return;
      }

      const user =
        await db.users
          .where("username")
          .equalsIgnoreCase(
            username.trim()
          )
          .first();

      if (!user) {
        setError(
          "Verification failed. Invalid username or password."
        );

        setLoading(false);
        return;
      }

      let passwordOk = false;

      if (
        user.passwordHash &&
        user.passwordSalt
      ) {
        passwordOk =
          await verifyPassword(
            password,
            user.passwordHash,
            user.passwordSalt
          );
      } else if (user.password) {
        passwordOk =
          user.password === password;

        if (
          passwordOk &&
          user.id
        ) {
          const {
            passwordHash,
            passwordSalt,
          } =
            await hashPassword(
              password
            );

          await db.users.update(
            user.id,
            {
              passwordHash,
              passwordSalt,
              password: undefined,
            }
          );
        }
      }

      if (!passwordOk) {
        setError(
          "Verification failed. Invalid username or password."
        );

        setLoading(false);
        return;
      }

      if (!user.isActive) {
        setError(
          "This account has been deactivated by the manager."
        );

        setLoading(false);
        return;
      }

      const permissions =
        user.role === "Admin"
          ? getPermissions("Admin")
          : (user.permissions && user.permissions.length > 0
              ? user.permissions
              : getPermissions(user.role));

      localStorage.setItem(
        "userRole",
        user.role
      );

      localStorage.setItem(
        "username",
        user.username
      );

      localStorage.setItem(
        "userId",
        String(user.id || "")
      );

      localStorage.setItem(
        "userPermissions",
        JSON.stringify(
          permissions
        )
      );

      await logAction(
        "Login",
        `User session started for ${user.username} (${user.role})`
      );

      router.push("/pos");
    } catch (err) {
      console.error(err);

      setError(
        "A system database error occurred. Please refresh."
      );

      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">

        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />

        <p className="font-black text-slate-400 uppercase tracking-widest text-xs">

          Authenticating System

        </p>

      </div>
    );
  }

  if (licenseExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6">

        <div className="max-w-md w-full">

          <div className="text-center mb-8">

            <div className="bg-red-500 w-24 h-24 rounded-5xl flex items-center justify-center mx-auto mb-6 shadow-high">

              <KeyRound
                className="text-white"
                size={48}
              />

            </div>

            <h1 className="text-lg font-black text-slate-900 tracking-tight">

              LICENSE EXPIRED

            </h1>

            <p className="text-slate-500 font-bold text-xs uppercase tracking-widest mt-2">

              MH Digital Salon POS

            </p>

          </div>

          <div className="bg-white rounded-5xl shadow-high border border-slate-100 p-5">

            <div className="bg-red-50 border border-red-100 rounded-3xl p-6 mb-6">

              <div className="flex items-start gap-4">

                <ShieldCheck
                  className="text-red-500 shrink-0"
                  size={24}
                />

                <div>

                  <p className="font-black text-red-700">

                    Your license has expired.

                  </p>

                  <p className="text-xs text-red-600/70 font-medium mt-2">

                    This installation can no longer be accessed until a valid license is provided.

                  </p>

                </div>

              </div>

            </div>

            {licenseInfo && (

              <div className="space-y-3 text-sm mb-8">

                <div className="flex justify-between gap-4">

                  <span className="text-slate-400 font-bold">

                    Business

                  </span>

                  <span className="text-slate-800 font-black text-right">

                    {licenseInfo.businessName}

                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-slate-400 font-bold">

                    License

                  </span>

                  <span className="text-slate-800 font-black">

                    {licenseInfo.licenseId}

                  </span>

                </div>

                <div className="flex justify-between gap-4">

                  <span className="text-slate-400 font-bold">

                    Expired

                  </span>

                  <span className="text-red-600 font-black">

                    {formatLicenseDate(
                      licenseInfo.expiresAt
                    )}

                  </span>

                </div>

              </div>

            )}

            <button
              type="button"
              onClick={() =>
                window.location.reload()
              }
              className="w-full bg-slate-900 text-white py-5 rounded-4xl font-black hover:bg-slate-800 transition-all"
            >

              CHECK LICENSE AGAIN

            </button>

          </div>

        </div>

      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 selection:bg-primary selection:text-white">

      <div className="max-w-md w-full">

        {/* LOGO */}

        <div className="text-center mb-10">

          <div className="bg-primary w-24 h-24 rounded-5xl flex items-center justify-center mx-auto mb-6 shadow-high shadow-primary/30 rotate-3 hover:rotate-0 transition-transform duration-500">

            <Scissors
              className="text-white w-12 h-12"
            />

          </div>

          <h1 className="text-xl font-black text-slate-900 tracking-tighter mb-2">

            SALON POS

          </h1>

          <p className="text-slate-500 font-bold tracking-tight opacity-70 uppercase text-[10px] tracking-[0.2em]">

            Management & Checkout

          </p>

        </div>

        {/* LOGIN CARD */}

        <div className="bg-white rounded-5xl shadow-high border border-slate-100 p-5 relative overflow-hidden group">

          <div className="absolute top-0 left-0 w-full h-2 bg-primary" />

          {error && (

            <div className="mb-6 bg-red-50 text-red-600 text-xs font-black p-4 rounded-3xl border border-red-100 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300">

              <ShieldCheck
                size={18}
                className="shrink-0"
              />

              {error}

            </div>

          )}

          {/* LICENSE STATUS */}

          {licenseInfo && (

            <div className="mb-6 bg-green-50 border border-green-100 rounded-3xl p-4">

              <div className="flex items-center gap-3">

                <div className="bg-green-100 text-green-600 p-2 rounded-2xl">

                  <CheckCircle2
                    size={18}
                  />

                </div>

                <div className="min-w-0">

                  <p className="text-[10px] font-black text-green-700 uppercase tracking-widest">

                    License Active

                  </p>

                  <p className="text-xs font-bold text-green-600 truncate">

                    Expires{" "}
                    {formatLicenseDate(
                      licenseInfo.expiresAt
                    )}

                  </p>

                </div>

              </div>

            </div>

          )}

          <form
            onSubmit={handleLogin}
            className="space-y-6"
          >

            {/* USERNAME */}

            <div className="space-y-2">

              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                Credential: Username

              </label>

              <div className="relative">

                <User
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors"
                  size={20}
                />

                <input
                  required
                  autoFocus
                  placeholder="admin"
                  className="w-full p-5 pl-14 rounded-4xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-900 placeholder:text-slate-200"
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* PASSWORD */}

            <div className="space-y-2">

              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                Credential: Security Key

              </label>

              <div className="relative">

                <Lock
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-primary transition-colors"
                  size={20}
                />

                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  className="w-full p-5 pl-14 rounded-4xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 focus:border-primary outline-none transition-all font-bold text-slate-900 placeholder:text-slate-200"
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                />

              </div>

            </div>

            {/* LOGIN */}

            <button
              disabled={loading}
              className="w-full bg-primary text-white py-6 rounded-4xl font-black text-lg shadow-high shadow-primary/25 hover:bg-blue-700 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:bg-slate-200 disabled:shadow-none disabled:cursor-not-allowed group"
            >

              {loading ? (

                <div className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />

              ) : (

                <>

                  <span>
                    ACCESS ACCOUNT
                  </span>

                  <LogIn
                    size={22}
                    className="group-hover:translate-x-1 transition-transform"
                  />

                </>

              )}

            </button>

          </form>

        </div>

        {/* FOOTER */}

        <div className="mt-12 flex flex-col items-center gap-2 opacity-30">

          <div className="flex items-center gap-2">

            <CheckCircle2
              size={14}
              className="text-success"
            />

            <p className="text-[10px] font-black tracking-widest uppercase">

              Production Ready System v1.0

            </p>

          </div>

          <p className="text-[9px] font-bold text-slate-400 uppercase">

            Offline Local Storage Encryption

          </p>

        </div>

      </div>

    </div>
  );
}
