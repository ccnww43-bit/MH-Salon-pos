import type { SavedReport } from "@/lib/db";

export function dateOnly(value: Date | string | undefined) {
  if (!value) return "";

  const d = new Date(value);

  if (Number.isNaN(d.getTime())) return "";

  return d.toISOString().split("T")[0];
}

export function money(currency: string, value: number) {
  return `${currency} ${Number(value || 0).toLocaleString(undefined, {
    maximumFractionDigits: 2,
  })}`;
}

export function escapeCsv(value: unknown) {
  const s = String(value ?? "");

  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * There is no background scheduler in this offline app — a reminder never
 * sends or runs anything on its own. This only decides whether to show a
 * "Due" badge the next time the Report Center is opened, based on how long
 * it's been since the report was last opened from its saved entry.
 */
export function isSavedReportDue(saved: SavedReport): boolean {
  if (saved.reminder === "None") return false;

  const last = saved.lastRunAt || saved.createdAt;
  const diffMs = Date.now() - new Date(last).getTime();
  const day = 24 * 60 * 60 * 1000;

  if (saved.reminder === "Daily") return diffMs >= day;
  if (saved.reminder === "Weekly") return diffMs >= 7 * day;
  if (saved.reminder === "Monthly") return diffMs >= 30 * day;

  return false;
}

export function downloadCsv(filenamePrefix: string, csv: string) {
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8;" })
  );

  const link = document.createElement("a");

  link.href = url;
  link.download = `${filenamePrefix}-${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  document.body.appendChild(link);
  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}
