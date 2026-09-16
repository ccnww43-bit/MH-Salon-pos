"use client";

import React, { useState } from "react";
import { db } from "@/lib/db";
import { useLiveQuery } from "dexie-react-hooks";
import { Navbar } from "@/components/navbar";
import { Pagination } from "@/components/pagination";
import { ShieldCheck, Search, Clock, User, FileText, Lock } from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";

export default function AuditLogsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");

  const size = 15;

  const logs = useLiveQuery(
    async () => {
      const all = await db.auditLogs.reverse().toArray();

      const filtered = search.trim()
        ? all.filter((log) =>
            `${log.username} ${log.action} ${log.details}`
              .toLowerCase()
              .includes(search.toLowerCase())
          )
        : all;

      return filtered.slice((page - 1) * size, page * size);
    },
    [page, search]
  );

  const total = useLiveQuery(
    async () => {
      const all = await db.auditLogs.toArray();

      if (!search.trim()) return all.length;

      return all.filter((log) =>
        `${log.username} ${log.action} ${log.details}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ).length;
    },
    [search]
  ) || 0;

  return (
    <PermissionGuard
      permission="view_audit_logs"
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
    <Navbar />
    <div className="page-shell space-y-8 animate-in fade-in duration-500">
      <div className="page-header">
        <div>
          <h1 className="page-title flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-white shadow-high shadow-primary/30">
              <ShieldCheck size={22} />
            </span>
            Audit Logs
          </h1>

          <p className="page-subtitle">
            Complete system activity history
          </p>
        </div>
      </div>

      <div className="gloss-card p-5 md:p-6">
        <div className="relative max-w-xl">
          <Search
            size={20}
            className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"
          />

          <input
            value={search}
            onChange={(e) => {
              setPage(1);
              setSearch(e.target.value);
            }}
            placeholder="Search audit activity..."
            className="field-input w-full pl-14 focus:ring-8 focus:ring-primary/5 transition-all"
          />
        </div>
      </div>

      <div className="table-card">
        <div className="table-scroll">
          <table className="record-table">
            <thead>
              <tr className="border-b border-slate-100 text-left">
                <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  User
                </th>
                <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Action
                </th>
                <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Details
                </th>
                <th className="px-4 py-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                  Date & Time
                </th>
              </tr>
            </thead>

            <tbody>
              {logs?.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50 transition-colors"
                >
                  <td data-label="User" className="px-4 py-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/5 flex items-center justify-center text-primary">
                        <User size={18} />
                      </div>

                      <span className="font-black text-slate-900">
                        {log.username}
                      </span>
                    </div>
                  </td>

                  <td data-label="Action" className="px-4 py-6">
                    <span className="badge badge-info">
                      {log.action}
                    </span>
                  </td>

                  <td data-label="Details" className="px-4 py-6">
                    <div className="flex items-start gap-3 max-w-xl">
                      <FileText
                        size={17}
                        className="text-slate-300 mt-0.5 shrink-0"
                      />
                      <span className="font-bold text-sm text-slate-600">
                        {log.details}
                      </span>
                    </div>
                  </td>

                  <td data-label="Date & Time" className="px-4 py-6">
                    <div className="flex items-center gap-2 text-slate-500">
                      <Clock size={16} />
                      <span className="text-xs font-black">
                        {new Date(log.timestamp).toLocaleString()}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!logs?.length && (
          <div className="empty-state">
            <div className="empty-state-icon">
              <ShieldCheck size={26} />
            </div>
            <div className="empty-state-title">No audit records</div>
            <p className="empty-state-text">
              Activity will show up here as staff use the system.
            </p>
          </div>
        )}
      </div>

      <Pagination
        totalItems={total}
        itemsPerPage={size}
        currentPage={page}
        onPageChange={setPage}
      />
    </div>
    </PermissionGuard>
  );
}
