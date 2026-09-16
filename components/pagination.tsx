import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface PaginationProps {
  totalItems: number;
  itemsPerPage: number;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const Pagination = ({
  totalItems,
  itemsPerPage,
  currentPage,
  onPageChange,
}: PaginationProps) => {
  const totalPages = Math.max(
    1,
    Math.ceil(totalItems / itemsPerPage)
  );

  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    totalPages
  );

  if (totalItems <= 0) {
    return null;
  }

  const startItem =
    (safeCurrentPage - 1) * itemsPerPage + 1;

  const endItem = Math.min(
    safeCurrentPage * itemsPerPage,
    totalItems
  );

  return (
    <div className="mt-7 flex flex-col gap-4 rounded-[24px] border border-white/90 bg-white/70 px-4 py-4 shadow-[0_14px_35px_rgba(15,23,42,.05)] backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between md:rounded-[28px] md:px-6">
      <div className="text-center text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 sm:text-left">
        Displaying{' '}
        <span className="text-blue-600">
          {startItem}
        </span>{' '}
        -{' '}
        <span className="text-blue-600">
          {endItem}
        </span>{' '}
        of{' '}
        <span className="text-slate-900">
          {totalItems}
        </span>{' '}
        results
      </div>

      <nav
        className="flex items-center justify-center gap-2"
        aria-label="Pagination"
      >
        <button
          type="button"
          onClick={() =>
            onPageChange(
              Math.max(1, safeCurrentPage - 1)
            )
          }
          disabled={safeCurrentPage === 1}
          className="active-click flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>

        <div className="flex h-10 items-center rounded-xl bg-blue-50 px-4 text-[9px] font-black uppercase tracking-[0.12em] text-blue-600 ring-1 ring-inset ring-blue-100">
          Page {safeCurrentPage} / {totalPages}
        </div>

        <button
          type="button"
          onClick={() =>
            onPageChange(
              Math.min(
                totalPages,
                safeCurrentPage + 1
              )
            )
          }
          disabled={
            safeCurrentPage === totalPages
          }
          className="active-click flex h-10 w-10 items-center justify-center rounded-xl border border-slate-100 bg-white text-slate-500 shadow-sm transition hover:border-blue-100 hover:bg-blue-50 hover:text-blue-600 disabled:cursor-not-allowed disabled:opacity-30"
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </nav>
    </div>
  );
};
