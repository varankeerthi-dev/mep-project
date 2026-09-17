import { memo } from 'react';
import { LayoutList, Columns3 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KanbanViewSwitcherProps {
  viewMode: 'table' | 'board';
  onViewModeChange: (mode: 'table' | 'board') => void;
  showLabels?: boolean;
  className?: string;
  size?: 'sm' | 'default';
}

/**
 * Reusable View Mode Switcher (Table ↔ Board)
 * Designed with modern segmented control styling, active elevation,
 * tooltips, and accessibility labels. Supports icon-only (default) or with labels.
 */
export const KanbanViewSwitcher = memo(function KanbanViewSwitcher({
  viewMode,
  onViewModeChange,
  showLabels = false,
  className,
  size = 'sm',
}: KanbanViewSwitcherProps) {
  const isSm = size === 'sm';

  return (
    <div
      role="group"
      aria-label="View mode toggle"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg border border-slate-200/90 bg-slate-100/90 p-0.5 select-none shadow-2xs shrink-0',
        className
      )}
    >
      <button
        type="button"
        onClick={() => onViewModeChange('table')}
        className={cn(
          'flex items-center justify-center rounded-md transition cursor-pointer',
          isSm ? 'h-6 px-1.5' : 'h-7 px-2',
          showLabels ? 'gap-1.5' : 'w-6',
          viewMode === 'table'
            ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
            : 'text-slate-500 hover:text-slate-900 font-medium'
        )}
        title="Table View"
        aria-label="Table View"
        aria-pressed={viewMode === 'table'}
      >
        <LayoutList className={cn(isSm ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        {showLabels && <span className="text-xs">Table</span>}
      </button>

      <button
        type="button"
        onClick={() => onViewModeChange('board')}
        className={cn(
          'flex items-center justify-center rounded-md transition cursor-pointer',
          isSm ? 'h-6 px-1.5' : 'h-7 px-2',
          showLabels ? 'gap-1.5' : 'w-6',
          viewMode === 'board'
            ? 'bg-white text-blue-700 shadow-xs border border-slate-200/80 font-bold'
            : 'text-slate-500 hover:text-slate-900 font-medium'
        )}
        title="Kanban Board View"
        aria-label="Kanban Board View"
        aria-pressed={viewMode === 'board'}
      >
        <Columns3 className={cn(isSm ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
        {showLabels && <span className="text-xs">Board</span>}
      </button>
    </div>
  );
});
