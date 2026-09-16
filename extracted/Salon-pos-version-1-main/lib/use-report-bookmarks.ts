"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db, ReportFilterSnapshot, ReportReminder } from "@/lib/db";

/** How many distinct reports to keep in the "Recently Viewed" row. */
const MAX_RECENTS = 8;

export function useReportBookmarks() {
  const favorites = useLiveQuery(() => db.reportFavorites.toArray(), []);

  const recents = useLiveQuery(
    () => db.reportRecents.orderBy("viewedAt").reverse().toArray(),
    []
  );

  const savedReports = useLiveQuery(
    () => db.savedReports.orderBy("createdAt").reverse().toArray(),
    []
  );

  const favoriteIds = new Set((favorites || []).map((f) => f.reportId));

  const toggleFavorite = async (reportId: string) => {
    if (favoriteIds.has(reportId)) {
      await db.reportFavorites.delete(reportId);
    } else {
      await db.reportFavorites.put({ reportId, createdAt: new Date() });
    }
  };

  const recordView = async (reportId: string) => {
    await db.reportRecents.put({ reportId, viewedAt: new Date() });

    const all = await db.reportRecents
      .orderBy("viewedAt")
      .reverse()
      .toArray();

    const stale = all.slice(MAX_RECENTS);

    if (stale.length) {
      await db.reportRecents.bulkDelete(stale.map((r) => r.reportId));
    }
  };

  const saveReport = async (input: {
    reportId: string;
    name: string;
    filters: ReportFilterSnapshot;
    reminder: ReportReminder;
  }) => {
    await db.savedReports.add({
      ...input,
      createdAt: new Date(),
    });
  };

  const deleteSavedReport = async (id: number) => {
    await db.savedReports.delete(id);
  };

  /** Marks a saved report as just having been opened/run, clearing any "Due" badge. */
  const markSavedReportRun = async (id: number) => {
    await db.savedReports.update(id, { lastRunAt: new Date() });
  };

  return {
    favoriteIds,
    toggleFavorite,
    recents: recents || [],
    savedReports: savedReports || [],
    recordView,
    saveReport,
    deleteSavedReport,
    markSavedReportRun,
  };
}

export type ReportBookmarks = ReturnType<typeof useReportBookmarks>;
