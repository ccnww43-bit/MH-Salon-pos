"use client";

import React, { useState } from "react";
import {
  FileBarChart,
  Download,
  Printer,
  Lock,
  ArrowLeft,
  Star,
  BookmarkPlus,
} from "lucide-react";
import { PermissionGuard } from "@/components/permissionguard";
import { Navbar } from "@/components/navbar";
import { useReportsData } from "@/lib/use-reports-data";
import { useReportBookmarks } from "@/lib/use-report-bookmarks";
import {
  getReportDefinition,
  type ReportId,
} from "@/lib/report-catalog";
import { escapeCsv, downloadCsv } from "@/lib/report-utils";
import type { SavedReport } from "@/lib/db";
import { ReportsHome } from "@/components/reports/reports-home";
import { ReportFilters } from "@/components/reports/report-filters";
import { ReportBody, buildReportCsv } from "@/components/reports/report-body";
import { SaveReportModal } from "@/components/reports/save-report-modal";

export default function ReportsPage() {
  const data = useReportsData();
  const bookmarks = useReportBookmarks();

  const [activeReportId, setActiveReportId] = useState<ReportId | null>(
    null
  );

  const [showSaveModal, setShowSaveModal] = useState(false);

  const definition = getReportDefinition(activeReportId || undefined);

  const openReport = (reportId: ReportId) => {
    bookmarks.recordView(reportId);
    setActiveReportId(reportId);
  };

  const openSavedReport = (saved: SavedReport) => {
    data.restoreFilters(saved.filters);

    if (saved.id) {
      bookmarks.markSavedReportRun(saved.id);
    }

    bookmarks.recordView(saved.reportId);
    setActiveReportId(saved.reportId as ReportId);
  };

  const exportCsv = () => {
    if (!activeReportId) return;

    const { headers, rows } = buildReportCsv(activeReportId, data);

    const csv = [headers, ...rows]
      .map((row) => row.map(escapeCsv).join(","))
      .join("\n");

    downloadCsv(
      `MH-Digital-${definition?.name.replace(/\s+/g, "-") || "Report"}`,
      csv
    );
  };

  const printReport = () => window.print();

  return (
    <PermissionGuard
      permission="view_reports"
      fallback={
        <div className="min-h-screen flex items-center justify-center p-5">
          <div className="gloss-card p-6 text-center">
            <Lock size={32} className="mx-auto mb-4 text-danger" />

            <h2 className="text-lg font-bold text-slate-900">
              Access Restricted
            </h2>

            <p className="text-slate-400 font-medium text-sm mt-2">
              You don't have permission to view reports.
            </p>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-slate-50">
        <div className="print:hidden">
          <Navbar />
        </div>
        <div className="shrink-0 px-6 py-4 bg-white border-b border-slate-200 shadow-premium print:hidden">
          <div className="max-w-7xl mx-auto flex flex-col xl:flex-row xl:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-primary mb-1.5">
                <FileBarChart size={16} />

                <span className="text-[11px] font-semibold uppercase tracking-wide">
                  Business Intelligence
                </span>
              </div>

              {activeReportId && definition ? (
                <>
                  <button
                    onClick={() => setActiveReportId(null)}
                    className="flex items-center gap-1.5 text-slate-400 font-semibold text-xs mb-2 hover:text-slate-600 transition-colors"
                  >
                    <ArrowLeft size={13} />
                    Report Center
                  </button>

                  <h1 className="text-xl font-bold text-slate-900">
                    {definition.name}
                  </h1>

                  <p className="text-slate-400 text-sm font-medium mt-1 max-w-2xl">
                    {definition.description}
                  </p>
                </>
              ) : (
                <>
                  <h1 className="text-xl font-bold text-slate-900">
                    Report Center
                  </h1>

                  <p className="text-slate-400 text-sm font-medium mt-1">
                    Choose a report to run against your offline POS database.
                  </p>
                </>
              )}
            </div>

            {activeReportId && definition && (
              <div className="flex gap-2">
                <button
                  onClick={() => bookmarks.toggleFavorite(definition.id)}
                  className={`px-3.5 py-2 rounded-xl border font-semibold text-xs flex items-center gap-1.5 transition-all ${
                    bookmarks.favoriteIds.has(definition.id)
                      ? "bg-warning/10 border-warning/20 text-warning"
                      : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                  aria-label="Toggle favorite"
                >
                  <Star
                    size={15}
                    fill={
                      bookmarks.favoriteIds.has(definition.id)
                        ? "currentColor"
                        : "none"
                    }
                  />
                </button>

                <button
                  onClick={() => setShowSaveModal(true)}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-xs flex items-center gap-1.5 text-slate-600 hover:border-slate-300 transition-all"
                >
                  <BookmarkPlus size={15} />
                  Save View
                </button>

                <button
                  onClick={exportCsv}
                  className="px-4 py-2 rounded-xl bg-primary text-white font-semibold text-xs flex items-center gap-1.5 hover:opacity-90 active:scale-[0.98] transition-all"
                >
                  <Download size={15} />
                  Export CSV
                </button>

                <button
                  onClick={printReport}
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 font-semibold text-xs flex items-center gap-1.5 text-slate-600 hover:border-slate-300 transition-all"
                >
                  <Printer size={15} />
                  Print
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="max-w-7xl mx-auto p-6 space-y-6 animate-in fade-in duration-500 print:p-0">
          {!activeReportId || !definition ? (
            <ReportsHome
              bookmarks={bookmarks}
              onOpenReport={openReport}
              onOpenSavedReport={openSavedReport}
            />
          ) : (
            <div className="space-y-6">
              <div className="print:hidden">
                <ReportFilters definition={definition} data={data} />
              </div>

              {data.isLoading ? (
                <div className="gloss-card p-6 text-center text-slate-400 font-semibold text-sm">
                  Loading report data...
                </div>
              ) : (
                <ReportBody reportId={definition.id} data={data} />
              )}
            </div>
          )}
        </div>
      </div>

      {showSaveModal && definition && (
        <SaveReportModal
          defaultName={definition.name}
          onClose={() => setShowSaveModal(false)}
          onSave={async ({ name, reminder }) => {
            await bookmarks.saveReport({
              reportId: definition.id,
              name,
              reminder,
              filters: data.filterSnapshot(),
            });

            setShowSaveModal(false);
          }}
        />
      )}
    </PermissionGuard>
  );
}
