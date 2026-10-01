import type { PaginationResult } from '@/hooks/use-followup-pagination';

interface PaginationFooterProps<T> {
  page: number;
  setPage: (p: number) => void;
  pagination: PaginationResult<T>;
  /**
   * Server-side total. When it exceeds the fetched rows, the footer states
   * the bound instead of implying completeness ("of 1,247 · first 500 shown").
   */
  totalCount?: number;
  /** Extra honesty note, e.g. queue built from capped source lists. */
  note?: string;
}

/**
 * Page footer. Verbatim move of the footer previously defined inside
 * FollowUpCentre — appearance and behavior unchanged.
 */
export function PaginationFooter<T>({ page, setPage, pagination, totalCount, note }: PaginationFooterProps<T>) {
  const grandTotal = totalCount ?? pagination.totalItems;
  const isCapped = totalCount != null && totalCount > pagination.totalItems;
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 sticky bottom-0 z-20">
      <div className="text-xs text-slate-600">
        Showing <span className="font-semibold text-slate-900">{pagination.totalItems === 0 ? 0 : pagination.startIndex + 1}</span> to{' '}
        <span className="font-semibold text-slate-900">{Math.min(pagination.endIndex, pagination.totalItems)}</span> of <span className="font-semibold text-slate-900">{grandTotal}</span> items
        {isCapped && (
          <span className="text-amber-700"> · first {pagination.totalItems} loaded</span>
        )}
        {note && <span className="text-amber-700"> · {note}</span>}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setPage(page - 1)}
          disabled={!pagination.hasPrevPage}
          className={`min-h-10 min-w-10 rounded px-2.5 py-1 text-xs transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
            pagination.hasPrevPage
              ? 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              : 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-400 opacity-60'
          }`}
        >
          Previous
        </button>
        <div className="flex items-center gap-1">
          {Array.from({ length: Math.max(1, Math.min(5, pagination.totalPages)) }, (_, i) => {
            const pageNum =
              pagination.totalPages <= 5
                ? i + 1
                : page <= 3
                  ? i + 1
                  : page >= pagination.totalPages - 2
                    ? pagination.totalPages - 4 + i
                    : page - 2 + i;
            const isCurrent = page === pageNum;
            return (
              <button
                key={pageNum}
                type="button"
                onClick={() => setPage(pageNum)}
                // The active page is a visual state only without this.
                aria-current={isCurrent ? 'page' : undefined}
                className={`min-h-10 min-w-10 rounded px-2.5 py-1 text-xs transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
                  isCurrent
                    ? 'border border-blue-600 bg-blue-600 font-semibold text-white shadow-sm'
                    : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          onClick={() => setPage(page + 1)}
          disabled={!pagination.hasNextPage}
          className={`min-h-10 min-w-10 rounded px-2.5 py-1 text-xs transition-[transform,color,background-color] duration-150 active:scale-[0.96] ${
            pagination.hasNextPage
              ? 'border border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              : 'cursor-not-allowed border border-slate-300 bg-slate-100 text-slate-400 opacity-60'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
