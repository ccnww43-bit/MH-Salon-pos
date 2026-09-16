"use client";

import React, {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { db } from "@/lib/db";
import { logAction } from "@/lib/logger";
import { hashPassword } from "@/lib/security";

import {
  KeyRound,
  ShieldCheck,
  User,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
} from "lucide-react";

import {
  activateLicenseKey,
  getCurrentMachineId,
  formatLicenseDate,
  LICENSE_PRODUCT,
  type StoredLicense,
} from "@/lib/license";

export default function SetupPage() {
  const router = useRouter();

  // step 1 = license activation, step 2 = admin account
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // --- License step state ---
  const [machineId, setMachineId] = useState("");
  const [licenseKey, setLicenseKey] = useState("");
  const [activating, setActivating] = useState(false);
  const [licenseError, setLicenseError] = useState("");
  const [activatedLicense, setActivatedLicense] =
    useState<StoredLicense | null>(null);
  const [copied, setCopied] = useState(false);

  // --- Admin step state ---
  const [form, setForm] = useState({
    username: "admin",
    password: "",
    confirm: "",
  });

  useEffect(() => {
    const check = async () => {
      try {
        if ((await db.users.count()) > 0) {
          router.replace("/");
        }
      } catch (error) {
        console.error(
          "Setup check failed:",
          error
        );
      }
    };

    check();
  }, [router]);

  useEffect(() => {
    getCurrentMachineId().then(setMachineId);
  }, []);

  const handleCopyMachineId = async () => {
    try {
      await navigator.clipboard.writeText(machineId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can fail silently in some environments; no-op.
    }
  };

  const handleActivateLicense = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();
    setLicenseError("");

    if (!licenseKey.trim()) {
      setLicenseError("Please enter a license key.");
      return;
    }

    setActivating(true);

    try {
      const result = await activateLicenseKey(licenseKey);

      if (result.ok && result.license) {
        setActivatedLicense(result.license);
        setStep(2);
      } else {
        setLicenseError(result.message);
      }
    } catch (error) {
      console.error("License activation failed:", error);
      setLicenseError(
        "Could not activate this license key. Please check it and try again."
      );
    } finally {
      setActivating(false);
    }
  };

  const handleFinish = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (!form.username.trim()) {
      alert(
        "Please enter an administrator username."
      );
      return;
    }

    if (form.password.length < 4) {
      alert(
        "Security key must be at least 4 characters."
      );
      return;
    }

    if (form.password !== form.confirm) {
      alert(
        "Security keys do not match."
      );
      return;
    }

    setSaving(true);

    try {
      const existingSettings =
        await db.settings
          .toCollection()
          .first();

      if (!existingSettings) {
        await db.settings.add({
          salonName: "",
          currency: "KSh",
          phone: "",
          email: "",
          address: "",
          receiptFooter:
            "Thank you for your visit!",
          taxEnabled: false,
          taxRate: 0,
          expenseLimits: {},
          updatedAt: new Date(),
        } as any);
      }

      const existingUser =
        await db.users
          .where("username")
          .equalsIgnoreCase(
            form.username.trim()
          )
          .first();

      if (!existingUser) {
        const {
          passwordHash,
          passwordSalt,
        } = await hashPassword(
          form.password
        );

        await db.users.add({
          username:
            form.username.trim(),
          passwordHash,
          passwordSalt,
          role: "Admin",
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      await logAction(
        "System Initialization",
        `POS initialized. License ${
          activatedLicense?.licenseId ?? "unknown"
        } activated.`
      );

      router.push("/");
    } catch (error) {
      console.error(
        "Initialization error:",
        error
      );

      alert(
        "Initialization error. Please refresh and try again."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] p-6 selection:bg-primary selection:text-white">

      <div className="max-w-3xl w-full space-y-8">

        {/* HEADER */}

        <div className="text-center">

          <div className="inline-flex items-center justify-center bg-primary text-white w-20 h-20 rounded-3xl shadow-high mb-5">

            <KeyRound size={38} />

          </div>

          <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter">

            MH DIGITAL SALON POS

          </h1>

          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-2">

            First-Time System Setup

          </p>

        </div>

        {/* MAIN CARD */}

        <div className="bg-white rounded-xl shadow-high border border-slate-100 p-4 md:p-5 relative overflow-hidden">

          {/* PROGRESS */}

          <div className="absolute top-0 left-0 w-full h-2 bg-primary/10">

            <div
              className="h-full bg-primary transition-all duration-500"
              style={{
                width:
                  step === 1
                    ? "50%"
                    : "100%",
              }}
            />

          </div>

          {/* STEPS */}

          <div className="flex items-center justify-center gap-3 mb-10">

            <div
              className={`flex items-center gap-2 text-xs font-black uppercase ${
                step >= 1
                  ? "text-primary"
                  : "text-slate-300"
              }`}
            >

              <span className="w-8 h-8 rounded-full bg-primary text-white flex items-center justify-center">

                1

              </span>

              License

            </div>

            <div className="w-10 h-px bg-slate-200" />

            <div
              className={`flex items-center gap-2 text-xs font-black uppercase ${
                step >= 2
                  ? "text-primary"
                  : "text-slate-300"
              }`}
            >

              <span
                className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  step >= 2
                    ? "bg-primary text-white"
                    : "bg-slate-100 text-slate-400"
                }`}
              >

                2

              </span>

              Administrator

            </div>

          </div>

          {/* STEP 1: LICENSE */}

          {step === 1 && (

            <form
              onSubmit={handleActivateLicense}
              className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500"
            >

              <div className="flex items-center gap-4">

                <div className="bg-primary/10 p-3 rounded-2xl text-primary">

                  <ShieldCheck size={32} />

                </div>

                <div>

                  <h2 className="text-2xl font-black text-slate-900">

                    Activate {LICENSE_PRODUCT}

                  </h2>

                  <p className="text-xs text-slate-400 font-bold mt-1">

                    Enter the license key you received to activate this
                    installation.

                  </p>

                </div>

              </div>

              {/* DEVICE ID */}

              <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5">

                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">

                  Device ID

                </p>

                <div className="flex items-center gap-3">

                  <code className="flex-1 text-sm font-bold text-slate-700 bg-white border border-slate-100 rounded-2xl px-4 py-3 overflow-x-auto">

                    {machineId || "Loading..."}

                  </code>

                  <button
                    type="button"
                    onClick={handleCopyMachineId}
                    disabled={!machineId}
                    className="shrink-0 bg-white border border-slate-100 rounded-2xl p-3 text-slate-500 hover:text-primary hover:border-primary/30 transition-all disabled:opacity-40"
                  >

                    {copied ? (
                      <Check size={18} />
                    ) : (
                      <Copy size={18} />
                    )}

                  </button>

                </div>

                <p className="text-xs text-slate-400 font-medium mt-3">

                  Send this Device ID to your provider if you need a
                  license key issued for this computer.

                </p>

              </div>

              {/* LICENSE KEY INPUT */}

              <div className="space-y-2">

                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                  License Key

                </label>

                <textarea
                  required
                  rows={4}
                  className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 focus:border-primary outline-none font-bold text-sm resize-none"
                  value={licenseKey}
                  onChange={(e) =>
                    setLicenseKey(e.target.value)
                  }
                  placeholder="Paste your license key here..."
                />

              </div>

              {licenseError && (

                <div className="flex items-start gap-3 bg-red-50 border border-red-100 text-red-600 rounded-3xl p-4">

                  <AlertCircle size={18} className="shrink-0 mt-0.5" />

                  <p className="text-sm font-bold">

                    {licenseError}

                  </p>

                </div>

              )}

              <button
                type="submit"
                disabled={
                  activating || !licenseKey.trim()
                }
                className="w-full bg-primary text-white py-6 rounded-4xl font-black text-lg shadow-high shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
              >

                {activating
                  ? "ACTIVATING..."
                  : "ACTIVATE LICENSE"}

                <ArrowRight size={20} />

              </button>

            </form>

          )}

          {/* STEP 2: ADMINISTRATOR */}

          {step === 2 && (

            <form
              onSubmit={handleFinish}
              className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-500"
            >

              <div className="flex items-center gap-4">

                <div className="bg-primary/10 p-3 rounded-2xl text-primary">

                  <ShieldCheck size={32} />

                </div>

                <div>

                  <h2 className="text-2xl font-black text-slate-900">

                    Master Admin Access

                  </h2>

                  <p className="text-xs text-slate-400 font-bold mt-1">

                    Create the administrator account for this installation.

                  </p>

                </div>

              </div>

              {/* LICENSE CONFIRMATION */}

              {activatedLicense && (

                <div className="bg-slate-50 border border-slate-100 rounded-3xl p-5">

                  <div className="flex items-center gap-4">

                    <div className="bg-green-50 text-green-600 p-3 rounded-2xl">

                      <CheckCircle2 size={24} />

                    </div>

                    <div>

                      <p className="font-black text-slate-800 text-sm">

                        License Active

                      </p>

                      <p className="text-xs text-slate-500 font-medium">

                        Valid until{" "}
                        {formatLicenseDate(
                          activatedLicense.expiresAt
                        )}

                      </p>

                    </div>

                  </div>

                </div>

              )}

              {/* USERNAME */}

              <div className="space-y-2">

                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                  Admin Username

                </label>

                <div className="relative">

                  <User
                    className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"
                    size={20}
                  />

                  <input
                    required
                    className="w-full p-5 pl-14 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none font-bold"
                    value={form.username}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        username:
                          e.target.value,
                      })
                    }
                    placeholder="admin"
                  />

                </div>

              </div>

              {/* PASSWORDS */}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                <div className="space-y-2">

                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                    Security Key

                  </label>

                  <div className="relative">

                    <Lock
                      className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"
                      size={20}
                    />

                    <input
                      type="password"
                      required
                      className="w-full p-5 pl-14 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none font-bold"
                      value={form.password}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          password:
                            e.target.value,
                        })
                      }
                      placeholder="••••••••"
                    />

                  </div>

                </div>

                <div className="space-y-2">

                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-4">

                    Confirm Key

                  </label>

                  <input
                    type="password"
                    required
                    className="w-full p-5 rounded-3xl border border-slate-100 bg-slate-50 focus:bg-white focus:ring-8 focus:ring-primary/5 outline-none font-bold"
                    value={form.confirm}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        confirm:
                          e.target.value,
                      })
                    }
                    placeholder="••••••••"
                  />

                </div>

              </div>

              {/* BUTTONS */}

              <div className="flex gap-4">

                <button
                  type="button"
                  onClick={() =>
                    setStep(1)
                  }
                  className="px-4 border border-slate-100 rounded-3xl font-black text-slate-400 hover:bg-slate-50 transition-all"
                >

                  <ArrowLeft size={20} />

                </button>

                <button
                  type="submit"
                  disabled={
                    saving ||
                    !form.username.trim() ||
                    !form.password ||
                    !form.confirm
                  }
                  className="flex-1 bg-primary text-white py-6 rounded-4xl font-black text-xl shadow-high shadow-primary/30 hover:scale-[1.02] transition-all disabled:opacity-20"
                >

                  {saving
                    ? "ACTIVATING SYSTEM..."
                    : "ACTIVATE & FINISH SETUP"}

                </button>

              </div>

            </form>

          )}

        </div>

        {/* FOOTER */}

        <div className="text-center opacity-40">

          <div className="flex items-center justify-center gap-2">

            <CheckCircle2 size={14} />

            <p className="text-[10px] font-black tracking-widest uppercase">

              MH Digital Salon POS v1.0

            </p>

          </div>

          <p className="text-[9px] font-bold text-slate-400 uppercase mt-2">

            Offline Local System

          </p>

        </div>

      </div>

    </div>
  );
}
