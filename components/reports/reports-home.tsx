import React, { useState } from "react";
import {
  Search,
  Star,
  Clock,
  Bookmark,
  Trash2,
  ChevronRight,
  AlertCircle,
} from "lucide-react";
import type { SavedReport } from "@/lib/db";
import {
  REPORT_DEFINITIONS,
  getReportDefinition,
  reportsByCategory,
  type ReportId,
} from "@/lib/report-catalog";
import type { ReportBookmarks } from "@/lib/use-report-bookmarks";
import { isSavedReportDue } from "@/lib/report-utils";

export function ReportsHome({
  bookmarks,
  onOpenReport,
  onOpenSavedReport,
}: {
  bookmarks: ReportBookmarks;
  onOpenReport: (reportId: ReportId) => void;
  onOpenSavedReport: (saved: SavedReport) => void;
}) {
  const [query, setQuery] = useState("");

  const matchesQuery = (name: string, description: string) => {
    if (!query.trim()) return true;

    const q = query.toLowerCase();

    return (
      name.toLowerCase().includes(q) || description.toLowerCase().includes(q)
    );
  };

  const favoriteReports = REPORT_DEFINITIONS.filter((report) =>
    bookmarks.favoriteIds.has(report.id)
  );

  const recentReports = bookmarks.recents
    .map((recent) => getReportDefinition(recent.reportId))
    .filter((report): report is NonNullable<typeof report> => !!report);

  return (
    <div className="space-y-8">
      {/* SEARCH */}

      <div className="relative">
        <Search
          className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
          size={16}
        />

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search reports..."
          className="w-full pl-11 pr-4 py-3 rounded-xl bg-white shadow-premium border border-slate-200 font-semibold text-sm text-slate-900 outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
        />
      </div>

      {/* FAVORITES */}

      {favoriteReports.length > 0 && (
        <section>
          <SectionHeading icon={Star} title="Favorites" />

          <div className="flex gap-3 overflow-x-auto pb-2">
            {favoriteReports.map((report) => (
              <ReportChip
                key={report.id}
                report={report}
                onClick={() => onOpenReport(report.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* RECENTLY VIEWED */}

      {recentReports.length > 0 && (
        <section>
          <SectionHeading icon={Clock} title="Recently Viewed" />

          <div className="flex gap-3 overflow-x-auto pb-2">
            {recentReports.map((report) => (
              <ReportChip
                key={report.id}
                report={report}
                onClick={() => onOpenReport(report.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* SAVED REPORTS */}

      {bookmarks.savedReports.length > 0 && (
        <section>
          <SectionHeading icon={Bookmark} title="Saved Reports" />

          <div className="bg-white rounded-2xl border border-slate-200 shadow-premium divide-y divide-slate-100 overflow-hidden">
            {bookmarks.savedReports.map((saved) => {
              const report = getReportDefinition(saved.reportId);
              const due = isSavedReportDue(saved);

              return (
                <div
                  key={saved.id}
                  className="flex items-center justify-between gap-4 p-4 hover:bg-slate-50/70 transition-colors"
                >
                  <button
                    onClick={() => onOpenSavedReport(saved)}
                    className="flex-1 min-w-0 flex items-center gap-3 text-left"
                  >
                    {report && (
                      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
                        <report.icon size={16} />
                      </span>
                    )}

                    <span className="min-w-0">
                      <span className="block font-bold text-sm text-slate-900 truncate">
                        {saved.name}
                      </span>

                      <span className="block text-[11px] font-medium text-slate-400 truncate">
                        {report?.name || saved.reportId}
                      </span>
                    </span>
                  </button>

                  <div className="flex items-center gap-2 shrink-0">
                    {saved.reminder !== "None" && (
                      <span
                        className={`px-2.5 py-1.5 rounded-lg text-[10px] font-semibold flex items-center gap-1 ${
                          due
                            ? "bg-danger/10 text-danger"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {due && <AlertCircle size={11} />}
                        {due ? "Due" : saved.reminder}
                      </span>
                    )}

                    <button
                      onClick={() =>
                        saved.id && bookmarks.deleteSavedReport(saved.id)
                      }
                      className="p-2 rounded-lg bg-slate-100 text-slate-400 hover:bg-danger/10 hover:text-danger transition-colors"
                      aria-label="Delete saved report"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* BROWSE BY CATEGORY */}

      {reportsByCategory().map(({ category, reports }) => {
        const visible = reports.filter((report) =>
          matchesQuery(report.name, report.description)
        );

        if (!visible.length) return null;

        return (
          <section key={category}>
            <SectionHeading title={category} />

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {visible.map((report) => (
                <ReportCard
                  key={report.id}
                  report={report}
                  isFavorite={bookmarks.favoriteIds.has(report.id)}
                  onOpen={() => onOpenReport(report.id)}
                  onToggleFavorite={() => bookmarks.toggleFavorite(report.id)}
                />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
}: {
  icon?: React.ElementType;
  title: string;
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      {Icon && <Icon size={14} className="text-slate-400" />}

      <h2 className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {title}
      </h2>
    </div>
  );
}

function ReportChip({
  report,
  onClick,
}: {
  report: (typeof REPORT_DEFINITIONS)[number];
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="shrink-0 w-48 bg-white rounded-xl shadow-premium border border-slate-200 p-4 text-left hover:shadow-high hover:border-primary/30 transition-all"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary mb-3">
        <report.icon size={16} />
      </span>

      <div className="font-bold text-sm text-slate-900">{report.name}</div>
    </button>
  );
}

function ReportCard({
  report,
  isFavorite,
  onOpen,
  onToggleFavorite,
}: {
  report: (typeof REPORT_DEFINITIONS)[number];
  isFavorite: boolean;
  onOpen: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-premium hover:shadow-high hover:border-primary/30 transition-all p-5 flex flex-col">
      <div className="flex items-start justify-between mb-4">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <report.icon size={18} />
        </span>

        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          aria-label={
            isFavorite ? "Remove from favorites" : "Add to favorites"
          }
          className={`p-1.5 rounded-lg transition-colors ${
            isFavorite
              ? "text-warning"
              : "text-slate-300 hover:text-slate-400"
          }`}
        >
          <Star size={16} fill={isFavorite ? "currentColor" : "none"} />
        </button>
      </div>

      <h3 className="font-bold text-sm text-slate-900 mb-1.5">
        {report.name}
      </h3>

      <p className="text-xs font-medium text-slate-400 leading-relaxed mb-5 flex-1">
        {report.description}
      </p>

      <button
        onClick={onOpen}
        className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-primary text-white font-semibold text-xs hover:opacity-90 active:scale-[0.98] transition-all"
      >
        Open Report
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
