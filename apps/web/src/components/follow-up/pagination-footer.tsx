import type { PaginationResult } from '@/hooks/use-followup-pagination';

interface PaginationFooterProps<T> {
  page: number;
  setPage: (p: number) => void;
  pagination: PaginationResult<T>;
}

/**
 * Page footer. Verbatim move of the footer previously defined inside
 * FollowUpCentre — appearance and behavior unchanged.
 */
export function PaginationFooter<T>({ page, setPage, pagination }: PaginationFooterProps<T>) {
  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-3 sticky bottom-0 z-20">
      <div className="text-xs text-slate-600">
        Showing <span className="font-semibold text-slate-900">{pagination.totalItems === 0 ? 0 : pagination.startIndex + 1}</span> to{' '}
        <span className="font-semibold text-slate-900">{Math.min(pagination.endIndex, pagination.totalItems)}</span> of <span className="font-semibold text-slate-900">{pagination.totalItems}</span> items
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setPage(page - 1)}
          disabled={!pagination.hasPrevPage}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
            pagination.hasPrevPage
              ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
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
            return (
              <button
                key={pageNum}
                onClick={() => setPage(pageNum)}
                className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                  page === pageNum
                    ? 'border-blue-600 bg-blue-600 text-white font-semibold shadow-sm'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        <button
          onClick={() => setPage(page + 1)}
          disabled={!pagination.hasNextPage}
          className={`px-2.5 py-1 text-xs rounded border transition-colors ${
            pagination.hasNextPage
              ? 'border-slate-300 bg-white text-slate-700 shadow-sm hover:bg-slate-50'
              : 'border-slate-300 bg-slate-100 text-slate-400 cursor-not-allowed opacity-60'
          }`}
        >
          Next
        </button>
      </div>
    </div>
  );
}
