import { useState, useMemo, useRef, useEffect, useCallback, type ReactNode } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
  type RowSelectionState,
  type PaginationState,
  type OnChangeFn,
} from '@tanstack/react-table';
import { cn } from '../../lib/utils';
import { MoreHorizontal, Search, X } from 'lucide-react';

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ColumnFilterType = 'text' | 'select' | 'date';

export interface AppTableColumn<T extends Record<string, any>> {
  id?: string;
  accessorKey?: keyof T | string;
  header: string;
  cell?: (info: { getValue: () => any; row: { original: T }; column: { id: string } }) => ReactNode;
  filterType?: ColumnFilterType;
  filterOptions?: { label: string; value: string }[];
  size?: number;
  enableSorting?: boolean;
}

export interface AppTableProps<T extends Record<string, any>> {
  data: T[];
  columns: AppTableColumn<T>[];
  pageSizeOptions?: number[];
  defaultPageSize?: number;
  enableRowSelection?: boolean;
  enableColumnFilters?: boolean;
  enablePagination?: boolean;
  enableSorting?: boolean;
  enableActions?: boolean;
  actions?: { label: string; onClick: (row: T) => void; variant?: 'default' | 'danger' }[];
  onRowSelectionChange?: (selectedRows: T[]) => void;
  loading?: boolean;
  loadingRows?: number;
  emptyMessage?: string | ReactNode;
  className?: string;
  bulkActions?: {
    selectedCount: number;
    onPrint?: () => void;
    onDelete?: () => void;
  };
  /** @deprecated No longer applied. Kept in the interface for backward compatibility. */
  rowPadding?: string;
  cellAlign?: 'left' | 'center' | 'right';
  manualPagination?: boolean;
  totalCount?: number;
  pageIndex?: number;
  onPageChange?: (pageIndex: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MAX_VISIBLE_PAGES = 7;
/** TanStack Table's internal default when `size` is not set on a column. */
const TANSTACK_DEFAULT_COL_SIZE = 150;

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function getPageNumbers(current: number, total: number): (number | '...')[] {
  if (total <= MAX_VISIBLE_PAGES) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | '...')[] = [];
  const half = Math.floor(MAX_VISIBLE_PAGES / 2);
  let start = Math.max(1, current - half);
  let end = Math.min(total, current + half);
  if (start > 2) { pages.push(1, '...'); }
  else if (start === 2) { pages.push(1); }
  for (let i = start; i <= end; i++) pages.push(i);
  if (end < total - 1) { pages.push('...', total); }
  else if (end === total - 1) { pages.push(total); }
  return pages;
}

/** Maps `cellAlign` prop to a static Tailwind class — avoids dynamic class generation. */
const CELL_ALIGN_CLASS: Record<string, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

// ---------------------------------------------------------------------------
// Sort icon — single component, three states
// ---------------------------------------------------------------------------

const SORT_ICON_PROPS = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  'aria-hidden': true as const,
  className: 'h-4 w-4 shrink-0 overflow-clip',
} as const;

const PATH_PROPS = {
  fill: 'none',
  stroke: 'oklch(14.5% 0 0)',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SortIcon({ state }: { state: 'asc' | 'desc' | false }) {
  if (state === 'asc') {
    return (
      <svg {...SORT_ICON_PROPS}>
        <path d="m3 8 4-4 4 4" {...PATH_PROPS} />
        <path d="M7 4v16" {...PATH_PROPS} />
      </svg>
    );
  }
  if (state === 'desc') {
    return (
      <svg {...SORT_ICON_PROPS}>
        <path d="m21 16-4 4-4-4" {...PATH_PROPS} />
        <path d="M17 20V4" {...PATH_PROPS} />
      </svg>
    );
  }
  return (
    <svg {...SORT_ICON_PROPS}>
      <path d="m21 16-4 4-4-4" {...PATH_PROPS} />
      <path d="M17 20V4" {...PATH_PROPS} />
      <path d="m3 8 4-4 4 4" {...PATH_PROPS} />
      <path d="M7 4v16" {...PATH_PROPS} />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Row actions dropdown — extracted for keyboard nav & single-open behavior
// ---------------------------------------------------------------------------

function RowActionsCell<T extends Record<string, any>>({
  row,
  actions,
  isLastThree,
  isOpen,
  onToggle,
  onClose,
}: {
  row: { original: T; id: string };
  actions: NonNullable<AppTableProps<T>['actions']>;
  isLastThree: boolean;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
      return;
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
      if (!items?.length) return;
      const current = Array.from(items).findIndex((el) => el === document.activeElement);
      const next = e.key === 'ArrowDown'
        ? (current + 1) % items.length
        : (current - 1 + items.length) % items.length;
      items[next]?.focus();
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
      firstItem?.focus();
    }
  }, [isOpen]);

  return (
    <div className="relative flex justify-center pr-4 pl-2 py-2">
      <button
        onClick={(e) => { e.stopPropagation(); onToggle(); }}
        className="inline-flex items-center justify-center rounded-lg w-7 h-7 hover:bg-zinc-100 transition-colors"
        aria-label="Open row actions"
        aria-expanded={isOpen}
        aria-haspopup="menu"
      >
        <MoreHorizontal className="w-4 h-4 text-[#0A0A0A]" />
      </button>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <div
            ref={menuRef}
            role="menu"
            onKeyDown={handleKeyDown}
            className={cn(
              'absolute right-4 z-[100] w-44 rounded-lg border border-[#E5E5E5] bg-white p-1 shadow-lg shadow-black/5',
              isLastThree ? 'bottom-full mb-1' : 'top-full mt-1'
            )}
          >
            {actions.map((action, i) => (
              <button
                key={i}
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  onClose();
                  action.onClick(row.original);
                }}
                className={cn(
                  'flex w-full items-center gap-2 rounded-md px-2 text-[12px] py-[6px] transition-colors active:scale-[0.98]',
                  action.variant === 'danger'
                    ? 'text-zinc-600 hover:bg-red-50 hover:text-red-600'
                    : 'text-zinc-600 hover:bg-zinc-50 hover:text-[#0A0A0A]'
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Column filter — memoized sub-render
// ---------------------------------------------------------------------------

function ColumnFilterInput({ header }: { header: any }) {
  const col = header.column;
  const filterType = (col.columnDef as any).filterType as ColumnFilterType | undefined;
  if (!filterType) return null;
  const value = col.getFilterValue() as string;

  const inputClass = 'w-full px-2 py-1 text-xs border border-[#E5E5E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]';

  if (filterType === 'text') {
    return (
      <div className="relative">
        <input
          type="text"
          value={value ?? ''}
          onChange={(e) => col.setFilterValue(e.target.value)}
          placeholder="Filter..."
          className={inputClass}
        />
        {value && (
          <button
            onClick={() => col.setFilterValue(undefined)}
            className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
            aria-label="Clear filter"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    );
  }

  if (filterType === 'select') {
    const options = (col.columnDef as any).filterOptions as { label: string; value: string }[] | undefined;
    return (
      <select
        value={value ?? ''}
        onChange={(e) => col.setFilterValue(e.target.value || undefined)}
        className={inputClass}
      >
        <option value="">All</option>
        {options?.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    );
  }

  if (filterType === 'date') {
    return (
      <input
        type="date"
        value={value ?? ''}
        onChange={(e) => col.setFilterValue(e.target.value)}
        className={inputClass}
      />
    );
  }

  return null;
}

// ---------------------------------------------------------------------------
// Pagination button — shared class helper
// ---------------------------------------------------------------------------

const PAGE_BTN_BASE = 'h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors';
const PAGE_BTN_ENABLED = 'text-[#0A0A0A] hover:bg-zinc-50 bg-white border border-[#E5E5E5] shadow-sm active:scale-[0.98]';
const PAGE_BTN_DISABLED = 'text-zinc-300 bg-white border border-[#E5E5E5] cursor-not-allowed';

function PaginationButton({
  onClick,
  disabled,
  label,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  label?: string;
  ariaLabel?: string;
  children: ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel ?? label}
      className={cn(PAGE_BTN_BASE, disabled ? PAGE_BTN_DISABLED : PAGE_BTN_ENABLED)}
    >
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------
// AppTable
// ---------------------------------------------------------------------------

export function AppTable<T extends Record<string, any>>({
  data,
  columns,
  pageSizeOptions = DEFAULT_PAGE_SIZE_OPTIONS,
  defaultPageSize = 10,
  enableRowSelection = false,
  enableColumnFilters = false,
  enablePagination = true,
  enableSorting = true,
  enableActions = false,
  actions = [],
  onRowSelectionChange,
  loading = false,
  loadingRows = 5,
  emptyMessage = 'No data available',
  className,
  bulkActions,
  // rowPadding is deprecated — accepted but unused
  cellAlign = 'left',
  manualPagination = false,
  totalCount,
  pageIndex,
  onPageChange,
  onPageSizeChange,
}: AppTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [internalPagination, setInternalPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [globalFilter, setGlobalFilter] = useState('');

  // Single-open action menu: tracks which row's dropdown is open
  const [openActionRowId, setOpenActionRowId] = useState<string | null>(null);

  const selectAllRef = useRef<HTMLInputElement>(null);

  const pagination = manualPagination
    ? { pageIndex: pageIndex ?? 0, pageSize: defaultPageSize }
    : internalPagination;

  const setPagination: OnChangeFn<PaginationState> = useCallback((updater) => {
    if (manualPagination) {
      const current = { pageIndex: pageIndex ?? 0, pageSize: defaultPageSize };
      const next = typeof updater === 'function' ? updater(current) : updater;
      onPageChange?.(next.pageIndex);
      if (next.pageSize !== current.pageSize) {
        onPageSizeChange?.(next.pageSize);
      }
    } else {
      setInternalPagination(updater as any);
    }
  }, [manualPagination, pageIndex, defaultPageSize, onPageChange, onPageSizeChange]);

  // ---- Column definitions ----

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];

    if (enableRowSelection) {
      cols.push({
        id: 'select',
        size: 50,
        enableSorting: false,
        header: ({ table }) => {
          useEffect(() => {
            if (selectAllRef.current) {
              selectAllRef.current.indeterminate = table.getIsSomePageRowsSelected();
            }
          });
          return (
            <div className="flex items-center justify-center pl-4">
              <div className="flex items-center justify-center rounded-sm border-[0.8px] border-[#E5E5E5] w-4 h-4">
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={table.getIsAllPageRowsSelected()}
                  onChange={table.getToggleAllPageRowsSelectedHandler()}
                  className="w-3.5 h-3.5 rounded-sm cursor-pointer accent-[#0A0A0A]"
                  aria-label="Select all rows"
                />
              </div>
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="flex items-center justify-center pl-4 py-2">
            <div className="flex items-center justify-center rounded-sm border-[0.8px] border-[#E5E5E5] w-4 h-4">
              <input
                type="checkbox"
                checked={row.getIsSelected()}
                disabled={!row.getCanSelect()}
                onChange={row.getToggleSelectedHandler()}
                className="w-3.5 h-3.5 rounded-sm cursor-pointer accent-[#0A0A0A]"
                onClick={(e) => e.stopPropagation()}
                aria-label={`Select ${row.id}`}
              />
            </div>
          </div>
        ),
      });
    }

    columns.forEach((col) => {
      const colDef: ColumnDef<T> = {
        ...(col.id ? { id: col.id } : {}),
        ...(col.accessorKey ? { accessorKey: col.accessorKey as string } : {}),
        header: col.header,
        cell: col.cell ? ({ row, getValue }) => col.cell!({ getValue, row, column: { id: (col.id ?? col.accessorKey) as string } }) : undefined,
        size: col.size,
        enableSorting: col.enableSorting ?? col.size !== 0,
      };
      if (col.filterType) {
        (colDef as any).filterType = col.filterType;
        (colDef as any).filterOptions = col.filterOptions;
      }
      cols.push(colDef);
    });

    if (enableActions && actions.length > 0) {
      cols.push({
        id: 'actions',
        size: 56,
        enableSorting: false,
        header: () => <span className="sr-only">Actions</span>,
        cell: ({ row, table }) => {
          const sortedRows = table.getSortedRowModel().rows;
          const rowIndex = sortedRows.findIndex((r) => r.id === row.id);
          const isLastThree = rowIndex >= sortedRows.length - 3;
          return (
            <RowActionsCell
              row={row}
              actions={actions}
              isLastThree={isLastThree}
              isOpen={openActionRowId === row.id}
              onToggle={() => setOpenActionRowId((prev) => (prev === row.id ? null : row.id))}
              onClose={() => setOpenActionRowId(null)}
            />
          );
        },
      });
    }

    return cols;
    // openActionRowId is intentionally in the deps so action cells re-render on open/close
  }, [columns, enableRowSelection, enableActions, actions, openActionRowId]);

  // ---- Table instance ----

  const pageCount = manualPagination && totalCount != null
    ? Math.ceil(totalCount / pagination.pageSize)
    : undefined;

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableColumnFilters ? getFilteredRowModel() : undefined,
    getPaginationRowModel: (enablePagination && !manualPagination) ? getPaginationRowModel() : undefined,
    manualPagination: manualPagination || undefined,
    pageCount,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    onPaginationChange: setPagination,
    onGlobalFilterChange: setGlobalFilter,
    state: { sorting, columnFilters, rowSelection, pagination, globalFilter },
    initialState: { pagination: { pageSize: defaultPageSize } },
    enableRowSelection,
    enableSorting,
  });

  // ---- Derived state (memoized) ----

  const rowModel = table.getRowModel();
  const visibleColumnsCount = useMemo(
    () => columns.length + (enableRowSelection ? 1 : 0) + (enableActions && actions.length > 0 ? 1 : 0),
    [columns.length, enableRowSelection, enableActions, actions.length],
  );
  const selectedCount = useMemo(() => Object.keys(rowSelection).length, [rowSelection]);
  const hasColumnFilters = useMemo(() => columns.some((col) => col.filterType), [columns]);

  // ---- Row selection callback (stable ref) ----

  const onRowSelectionChangeRef = useRef(onRowSelectionChange);
  onRowSelectionChangeRef.current = onRowSelectionChange;

  useEffect(() => {
    if (onRowSelectionChangeRef.current) {
      const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
      onRowSelectionChangeRef.current(selectedRows);
    }
  }, [rowSelection]);

  // ---- Alignment class (static lookup, no dynamic Tailwind) ----

  const cellAlignClass = CELL_ALIGN_CLASS[cellAlign] ?? 'text-left';

  // ---- Shared render helpers ----

  const renderHeaderRow = useCallback((headerGroup: any) => (
    <tr key={headerGroup.id} className="border-b-[0.8px] border-b-solid border-b-[#E5E5E5]">
      {headerGroup.headers.map((header: any) => {
        const isSelectCol = header.column.id === 'select';
        const isActionCol = header.column.id === 'actions';
        const canSort = !isSelectCol && !isActionCol && header.column.columnDef.enableSorting !== false && enableSorting && header.column.getCanSort();
        const sorted = header.column.getIsSorted();
        const colSize = header.getSize();
        return (
          <th
            key={header.id}
            className={cn(
              'h-10 align-middle bg-white',
              isSelectCol ? 'w-[1%] pl-4' : isActionCol ? 'w-14 pr-4 pl-2' : 'px-2',
            )}
            style={colSize !== TANSTACK_DEFAULT_COL_SIZE ? { width: colSize } : undefined}
          >
            {canSort ? (
              <div
                className="inline-flex items-center h-8 px-2 rounded-[10px] gap-1.5 cursor-pointer select-none hover:bg-zinc-50 transition-colors"
                onClick={header.column.getToggleSortingHandler()}
                role="button"
                tabIndex={0}
                aria-label={`Sort by ${header.column.columnDef.header}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    header.column.getToggleSortingHandler()?.(e);
                  }
                }}
              >
                <span className="text-[14px] leading-[142.857%] font-medium text-[#0A0A0A] whitespace-nowrap">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </span>
                <span className="shrink-0">
                  <SortIcon state={sorted as 'asc' | 'desc' | false} />
                </span>
              </div>
            ) : (
              <span className={cn(
                'text-[14px] leading-[142.857%] font-medium text-[#0A0A0A] whitespace-nowrap',
                isSelectCol || isActionCol ? '' : 'block',
              )}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            )}
            {enableColumnFilters && (header.column.columnDef as any).filterType && (
              <div className="mt-1.5">
                <ColumnFilterInput header={header} />
              </div>
            )}
          </th>
        );
      })}
    </tr>
  ), [enableSorting, enableColumnFilters]);

  const renderRow = useCallback((row: any) => (
    <tr
      key={row.id}
      className={cn(
        'border-b-[0.8px] border-b-solid border-b-[#E5E5E5] transition-colors',
        'hover:bg-zinc-50/50',
        row.getIsSelected() && 'bg-blue-50/40',
      )}
      onClick={() => { if (enableRowSelection) row.toggleSelected(); }}
    >
      {row.getVisibleCells().map((cell: any) => {
        const isSelectCol = cell.column.id === 'select';
        const isActionCol = cell.column.id === 'actions';
        return (
          <td
            key={cell.id}
            className={cn(
              'align-middle whitespace-nowrap',
              isSelectCol ? 'pl-4 py-2' : isActionCol ? 'pr-4 pl-2 py-2' : `p-2 ${cellAlignClass}`,
            )}
            style={{ maxWidth: cell.column.getSize() }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  ), [enableRowSelection, cellAlignClass]);

  // ---- Loading skeleton ----

  if (loading) {
    return (
      <div className={cn('rounded-[25px] overflow-clip border-[0.8px] border-solid border-[#E5E5E5] bg-white', className)}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse caption-bottom" role="table" aria-busy="true" aria-label="Loading data">
            <thead>
              {table.getHeaderGroups().map(renderHeaderRow)}
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i} className="border-b-[0.8px] border-b-solid border-b-[#E5E5E5]">
                  {columns.map((_, j) => (
                    <td key={j} className="p-2">
                      <div className="h-4 bg-zinc-100 rounded animate-pulse w-full max-w-[200px]" aria-hidden="true" />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ---- Main render ----

  return (
    <div className={cn(
      'rounded-[25px] overflow-clip border-[0.8px] border-solid border-[#E5E5E5] bg-white antialiased',
      className,
    )}>
      {enableColumnFilters && hasColumnFilters && (
        <div className="px-6 py-3 border-b border-[#E5E5E5] bg-zinc-50/50 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search all columns..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-[#E5E5E5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#0A0A0A]/20"
              aria-label="Search all columns"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full border-collapse caption-bottom" role="table">
          <thead>
            {table.getHeaderGroups().map(renderHeaderRow)}
          </thead>
          <tbody>
            {rowModel.rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnsCount} className="px-6 py-16 text-center text-sm text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rowModel.rows.map(renderRow)
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {bulkActions && selectedCount > 0 && (
        <div className="sticky bottom-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl rounded-b-[25px]">
          <div>
            <span className="text-sm font-semibold">{selectedCount} selected</span>
            <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold ml-3">
              {bulkActions.selectedCount} total
            </span>
          </div>
          <div className="flex items-center gap-2">
            {bulkActions.onPrint && (
              <button
                onClick={bulkActions.onPrint}
                className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-zinc-100 transition-colors active:scale-[0.98]"
              >
                Print
              </button>
            )}
            {bulkActions.onDelete && (
              <button
                onClick={bulkActions.onDelete}
                className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-red-700 transition-colors active:scale-[0.98]"
              >
                Delete
              </button>
            )}
          </div>
        </div>
      )}

      {enablePagination && (
        <div className="sticky bottom-0 flex items-center justify-between px-6 py-4 border-t border-[#E5E5E5] bg-white z-10">
          <div className="flex items-center gap-2 text-sm font-medium text-[#0A0A0A]">
            <span>
              {manualPagination && totalCount != null
                ? `${pagination.pageIndex * pagination.pageSize + 1}-${Math.min((pagination.pageIndex + 1) * pagination.pageSize, totalCount)} of ${totalCount}`
                : `Page ${pagination.pageIndex + 1} of ${table.getPageCount()}`
              }
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="ml-2 px-2 py-1 text-xs border border-[#E5E5E5] rounded-md focus:outline-none focus:ring-1 focus:ring-[#0A0A0A]/20 bg-white"
              aria-label="Rows per page"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <PaginationButton onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} ariaLabel="First page">
              First
            </PaginationButton>
            <PaginationButton onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} ariaLabel="Previous page">
              Prev
            </PaginationButton>
            <div className="flex items-center gap-1.5 mx-1">
              {getPageNumbers(pagination.pageIndex + 1, table.getPageCount()).map((page, idx) =>
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-400" aria-hidden="true">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page - 1)}
                    aria-label={`Page ${page}`}
                    aria-current={page === pagination.pageIndex + 1 ? 'page' : undefined}
                    className={cn(
                      'h-[32px] min-w-[32px] px-3 py-1 text-sm font-medium rounded-md transition-colors',
                      page === pagination.pageIndex + 1
                        ? 'bg-[#0A0A0A] text-white border border-[#0A0A0A] shadow-sm'
                        : 'text-[#0A0A0A] hover:bg-zinc-50 bg-white border border-[#E5E5E5] active:scale-[0.98]',
                    )}
                  >
                    {page}
                  </button>
                ),
              )}
            </div>
            <PaginationButton onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} ariaLabel="Next page">
              Next
            </PaginationButton>
            <PaginationButton onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} ariaLabel="Last page">
              Last
            </PaginationButton>
          </div>
        </div>
      )}
    </div>
  );
}
