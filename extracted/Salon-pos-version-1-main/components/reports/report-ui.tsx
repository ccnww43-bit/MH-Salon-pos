import React from "react";

export function Empty() {
  return (
    <div className="py-3 text-center text-slate-400 font-semibold text-sm">
      No data for the selected filters
    </div>
  );
}

export function Card({
  title,
  value,
  icon: Icon,
  muted = false,
}: {
  title: string;
  value: string;
  icon: React.ElementType;
  muted?: boolean;
}) {
  return (
    <div
      className={`${
        muted ? "bg-slate-50" : "bg-white"
      } p-5 rounded-2xl border border-slate-200 shadow-premium hover:shadow-high hover:border-primary/30 transition-all`}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
          <Icon size={16} />
        </span>

        <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
          {title}
        </span>
      </div>

      <div className="text-2xl font-bold text-slate-900 leading-none">
        {value}
      </div>
    </div>
  );
}

export function ReportTable({
  title,
  headers,
  rows,
  onRowClick,
}: {
  title: string;
  headers: string[];
  rows: (string | number)[][];
  /** Optional. When provided, each row becomes clickable (e.g. to open the
   * matching record elsewhere) and is called with that row's index. Rows
   * render exactly as before when this is omitted. */
  onRowClick?: (index: number) => void;
}) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-premium overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="text-sm font-bold text-slate-900">{title}</h2>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              {headers.map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-400"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rows.length ? (
              rows.map((row, index) => (
                <tr
                  key={index}
                  onClick={onRowClick ? () => onRowClick(index) : undefined}
                  className={`border-b border-slate-100 last:border-0 hover:bg-slate-50/70 transition-colors ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                >
                  {row.map((cell, cellIndex) => (
                    <td
                      key={cellIndex}
                      className={`px-4 py-3 ${
                        cellIndex === 0
                          ? "font-semibold text-slate-900"
                          : "font-medium text-slate-500"
                      } ${
                        onRowClick && cellIndex === 0
                          ? "text-primary hover:underline"
                          : ""
                      }`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={headers.length}>
                  <Empty />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
