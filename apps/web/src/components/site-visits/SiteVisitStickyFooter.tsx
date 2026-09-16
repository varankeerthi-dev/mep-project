import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { SITE_VISIT_LABELS } from './siteVisitLabels';

export interface SiteVisitStickyFooterProps {
  selectedCount: number;
  page: number;
  pageSize: number;
  totalRows: number;
  onPageChange: (page: number) => void;
}

/**
 * Persistent bottom status rail: selection count, keyboard navigation legend
 * and compact pagination (reference design system — footer bar).
 * All copy comes from SITE_VISIT_LABELS.
 */
export const SiteVisitStickyFooter: React.FC<SiteVisitStickyFooterProps> = ({
  selectedCount,
  page,
  pageSize,
  totalRows,
  onPageChange,
}) => {
  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const startRow = totalRows === 0 ? 0 : (page - 1) * pageSize + 1;
  const endRow = Math.min(page * pageSize, totalRows);

  return (
    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-2.5 text-[11px] text-slate-500">
      {/* Left: selection count */}
      <div className="flex items-center gap-3">
        {selectedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
            <span className="inline-flex h-5 min-w-[20px] items-center justify-center rounded bg-blue-600 px-1.5 text-[10px] font-semibold text-white tabular-nums">
              {selectedCount}
            </span>
            {selectedCount === 1 ? SITE_VISIT_LABELS.footer.itemSelected : SITE_VISIT_LABELS.footer.itemsSelected}
          </span>
        ) : (
          <span className="font-medium">{SITE_VISIT_LABELS.page.title}</span>
        )}

        {/* Keyboard navigation legend */}
        <span className="hidden items-center gap-3 md:inline-flex">
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-600">J</kbd>
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-600">K</kbd>
            {SITE_VISIT_LABELS.footer.navigateHint}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-600">↵</kbd>
            {SITE_VISIT_LABELS.footer.inspectHint}
          </span>
          <span className="inline-flex items-center gap-1">
            <kbd className="rounded border border-slate-200 bg-slate-50 px-1.5 font-mono text-[10px] text-slate-600">Space</kbd>
            {SITE_VISIT_LABELS.footer.selectHint}
          </span>
        </span>
      </div>

      {/* Right: range summary + compact pagination */}
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {SITE_VISIT_LABELS.actions.showing}{' '}
          <span className="font-semibold text-slate-700">
            {startRow}–{endRow}
          </span>{' '}
          {SITE_VISIT_LABELS.actions.of}{' '}
          <span className="font-semibold text-slate-700">{totalRows}</span>{' '}
          {SITE_VISIT_LABELS.actions.visits}
        </span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label={SITE_VISIT_LABELS.actions.previous}
            disabled={page <= 1}
            onClick={() => onPageChange(page - 1)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 transition-colors ${
              page <= 1 ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ChevronLeft size={13} />
          </button>
          <span className="px-1 font-semibold text-slate-700 tabular-nums">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            aria-label={SITE_VISIT_LABELS.actions.next}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
            className={`inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 transition-colors ${
              page >= totalPages ? 'cursor-not-allowed text-slate-300' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <ChevronRight size={13} />
          </button>
        </div>
      </div>
    </div>
  );
};
