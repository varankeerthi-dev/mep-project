import { useState, useMemo, useRef, useEffect, type ReactNode } from 'react';
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
} from '@tanstack/react-table';
import { cn } from '../../lib/utils';
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, MoreHorizontal, Search, X } from 'lucide-react';

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
  emptyMessage?: string;
  className?: string;
  bulkActions?: {
    selectedCount: number;
    onPrint?: () => void;
    onDelete?: () => void;
  };
  rowPadding?: string;
  cellAlign?: 'left' | 'center' | 'right';
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
const MAX_VISIBLE_PAGES = 7;

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
  rowPadding = 'py-3',
  cellAlign = 'left',
}: AppTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  });
  const [globalFilter, setGlobalFilter] = useState('');
  const selectAllRef = useRef<HTMLInputElement>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];

    if (enableRowSelection) {
      cols.push({
        id: 'select',
        size: 50,
        header: ({ table }) => {
          const [indeterminate, setIndeterminate] = useState(false);
          useEffect(() => {
            if (selectAllRef.current) {
              selectAllRef.current.indeterminate = table.getIsSomePageRowsSelected();
            }
          }, [table.getIsSomePageRowsSelected()]);
          return (
            <div className="px-4 text-center">
              <input
                ref={selectAllRef}
                type="checkbox"
                checked={table.getIsAllPageRowsSelected()}
                onChange={table.getToggleAllPageRowsSelectedHandler()}
                className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              />
            </div>
          );
        },
        cell: ({ row }) => (
          <div className="px-4 text-center">
            <input
              type="checkbox"
              checked={row.getIsSelected()}
              disabled={!row.getCanSelect()}
              onChange={row.getToggleSelectedHandler()}
              className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
              onClick={(e) => e.stopPropagation()}
            />
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
        size: 70,
        header: () => <div className="px-6 text-center"><span className="sr-only">Actions</span></div>,
        cell: ({ row, table }) => {
          const [open, setOpen] = useState<boolean>(false);
          const allRows = table.getSortedRowModel().rows;
          const rowIndex = allRows.findIndex((r) => r.id === row.id);
          const isLastThree = rowIndex >= allRows.length - 3;
          return (
            <div className="relative flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                className="p-1.5 rounded-md hover:bg-zinc-100 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-zinc-500" />
              </button>
              {open && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
                  <div
                    className={cn(
                      'absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5',
                      isLastThree ? 'bottom-full mb-1' : 'top-full mt-1'
                    )}
                  >
                    {actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          action.onClick(row.original);
                        }}
                        className={cn(
                          'flex w-full items-center gap-2 rounded-md px-2 text-[12px] py-[6px] transition-colors active:scale-[0.98]',
                          action.variant === 'danger'
                            ? 'text-zinc-600 hover:bg-red-50 hover:text-red-600'
                            : 'text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700'
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
        },
      });
    }

    return cols;
  }, [columns, enableRowSelection, enableActions, actions]);

  const table = useReactTable({
    data,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: enableColumnFilters ? getFilteredRowModel() : undefined,
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
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

  const onRowSelectionChangeRef = useRef(onRowSelectionChange);
  onRowSelectionChangeRef.current = onRowSelectionChange;

  useEffect(() => {
    if (onRowSelectionChangeRef.current) {
      const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
      onRowSelectionChangeRef.current(selectedRows);
    }
  }, [rowSelection]);

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = table.getIsSomePageRowsSelected();
    }
  });

  const hasColumnFilters = useMemo(() => {
    return columns.some((col) => col.filterType);
  }, [columns]);

  const renderFilter = (header: any) => {
    const col = header.column;
    const filterType = (col.columnDef as any).filterType as ColumnFilterType | undefined;
    if (!filterType) return null;
    const value = col.getFilterValue() as string;

    if (filterType === 'text') {
      return (
        <div className="relative">
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => col.setFilterValue(e.target.value)}
            placeholder="Filter..."
            className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
          {value && (
            <button
              onClick={() => col.setFilterValue(undefined)}
              className="absolute right-1 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600"
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
          className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="w-full px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }
    return null;
  };

  const visibleColumnsCount = columns.length + (enableRowSelection ? 1 : 0) + (enableActions && actions.length > 0 ? 1 : 0);
  const selectedCount = Object.keys(rowSelection).length;

  const renderHeaderRow = (headerGroup: any) => (
    <tr key={headerGroup.id}>
      {headerGroup.headers.map((header: any) => {
        const isSelectCol = header.column.id === 'select';
        const isActionCol = header.column.id === 'actions';
        return (
          <th
            key={header.id}
            className={cn(
              'sticky top-0 z-10 align-middle border-b border-zinc-200 bg-white',
              isSelectCol ? 'px-4 text-center w-[50px]' : isActionCol ? 'px-6 pl-1 text-center w-[70px]' : 'px-6 pl-1 text-left'
            )}
            style={{
              height: 36,
              width: header.getSize(),
            }}
          >
            {header.column.columnDef.enableSorting !== false && enableSorting && header.column.getCanSort() ? (
              <div
                className="flex items-center gap-2 hover:text-zinc-900 transition-colors group cursor-pointer select-none"
                onClick={header.column.getToggleSortingHandler()}
              >
                <span className="text-[13px] font-semibold text-zinc-700 tracking-tight">
                  {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                </span>
                <span className="shrink-0">
                  {header.column.getIsSorted() === 'asc' ? (
                    <ChevronUp className="w-3 h-3 text-indigo-600" />
                  ) : header.column.getIsSorted() === 'desc' ? (
                    <ChevronDown className="w-3 h-3 text-indigo-600" />
                  ) : (
                    <ChevronsUpDown className="w-3 h-3 text-zinc-300 group-hover:text-zinc-400" />
                  )}
                </span>
              </div>
            ) : (
              <span className={isSelectCol || isActionCol ? '' : 'text-[13px] font-semibold text-zinc-700 tracking-tight'}>
                {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
              </span>
            )}
            {enableColumnFilters && 'filterType' in (header.column.columnDef || {}) && (header.column.columnDef as any).filterType && (
              <div className="mt-1.5">{renderFilter(header)}</div>
            )}
          </th>
        );
      })}
    </tr>
  );

  const renderRow = (row: any, rowIndex: number) => (
    <tr
      key={row.id}
      className={cn(
        'group/row border-t border-zinc-200/70 transition-all',
        rowIndex % 2 === 1 ? 'bg-zinc-50/30' : 'bg-white',
        'hover:bg-blue-100/80 hover:shadow-sm cursor-pointer',
        row.getIsSelected() && 'bg-indigo-50/50 border-l-[3px] border-l-blue-600'
      )}
      style={{
        animation: `row-entrance 0.3s ease both`,
        animationDelay: `${Math.min(rowIndex * 20, 300)}ms`,
      }}
      onClick={() => {
        if (enableRowSelection) row.toggleSelected();
      }}
    >
      {row.getVisibleCells().map((cell: any) => {
        const isSelectCol = cell.column.id === 'select';
        const isActionCol = cell.column.id === 'actions';
        return (
          <td
            key={cell.id}
            className={cn(
              'align-middle whitespace-nowrap',
              isSelectCol ? 'px-4 text-center' : isActionCol ? 'px-6 text-center' : `px-6 ${rowPadding} text-${cellAlign}`
            )}
            style={{ maxWidth: cell.column.getSize() }}
          >
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </td>
        );
      })}
    </tr>
  );

  if (loading) {
    return (
      <div className={cn('bg-white border border-zinc-200 overflow-hidden', className)}>
        <div className="overflow-x-auto" ref={tableContainerRef}>
          <table className="w-full border-separate border-spacing-0">
            <thead>
              {table.getHeaderGroups().map(renderHeaderRow)}
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i} className="border-t border-zinc-200/70 bg-white">
                  {columns.map((_, j) => (
                    <td key={j} className={`px-6 ${rowPadding} align-middle`}>
                      <div className="h-4 bg-zinc-100 rounded animate-pulse w-full max-w-[200px]" />
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

  return (
    <div className={cn('bg-white border border-zinc-200 overflow-hidden', className)}>
      {enableColumnFilters && hasColumnFilters && (
        <div className="px-6 py-3 border-b border-zinc-200 bg-zinc-50/80 flex items-center gap-3">
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              value={globalFilter ?? ''}
              onChange={(e) => setGlobalFilter(e.target.value)}
              placeholder="Search all columns..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-500"
            />
          </div>
        </div>
      )}

      <div className="overflow-x-auto" ref={tableContainerRef}>
        <table className="w-full border-separate border-spacing-0">
          <thead>
            {table.getHeaderGroups().map(renderHeaderRow)}
          </thead>
          <tbody>
            {table.getSortedRowModel().rows.length === 0 && table.getFilteredRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={visibleColumnsCount} className="px-6 py-16 text-center text-sm text-zinc-500">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getSortedRowModel().rows.map((row, idx) => renderRow(row, idx))
            )}
          </tbody>
        </table>
      </div>

      {/* Bulk action bar */}
      {bulkActions && selectedCount > 0 && (
        <div className="sticky bottom-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl">
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-600">
            <span>
              Page {pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="ml-2 px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-500 bg-white"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size} per page</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className={cn(
                'h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors',
                !table.getCanPreviousPage()
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
              )}
            >
              First
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className={cn(
                'h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors',
                !table.getCanPreviousPage()
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
              )}
            >
              Prev
            </button>
            <div className="flex items-center gap-1.5 mx-1">
              {getPageNumbers(pagination.pageIndex + 1, table.getPageCount()).map((page, idx) =>
                page === '...' ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-zinc-400">...</span>
                ) : (
                  <button
                    key={page}
                    onClick={() => table.setPageIndex(page - 1)}
                    className={cn(
                      'h-[32px] min-w-[32px] px-3 py-1 text-sm font-medium rounded-md transition-colors',
                      page === pagination.pageIndex + 1
                        ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                        : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200 active:scale-[0.98]'
                    )}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className={cn(
                'h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors',
                !table.getCanNextPage()
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
              )}
            >
              Next
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className={cn(
                'h-[32px] min-w-[80px] text-sm font-medium rounded-md transition-colors',
                !table.getCanNextPage()
                  ? 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
                  : 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm active:scale-[0.98]'
              )}
            >
              Last
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
