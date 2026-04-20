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
import { ChevronUp, ChevronDown, ChevronsUpDown, ChevronLeft, ChevronRight, MoreHorizontal, Search, X, Pencil, Download, Eye, Trash2 } from 'lucide-react';

export type ColumnFilterType = 'text' | 'select' | 'date';

export interface AppTableColumn<T extends Record<string, any>> {
  accessorKey?: keyof T | string;
  header: string;
  cell?: (info: { getValue: () => any; row: { original: T }; column: { id: string } }) => ReactNode;
  filterType?: ColumnFilterType;
  filterOptions?: { label: string; value: string }[];
  size?: number;
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
}

const DEFAULT_PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

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

  const tableColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = [];

    if (enableRowSelection) {
      cols.push({
        id: 'select',
        size: 40,
        header: ({ table }) => {
          const [indeterminate, setIndeterminate] = useState(false);
          useEffect(() => {
            if (selectAllRef.current) {
              selectAllRef.current.indeterminate = table.getIsSomePageRowsSelected();
            }
          }, [table.getIsSomePageRowsSelected()]);
          return (
            <input
              ref={selectAllRef}
              type="checkbox"
              checked={table.getIsAllPageRowsSelected()}
              onChange={table.getToggleAllPageRowsSelectedHandler()}
              className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            />
          );
        },
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            disabled={!row.getCanSelect()}
            onChange={row.getToggleSelectedHandler()}
            className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
            onClick={(e) => e.stopPropagation()}
          />
        ),
      });
    }

    columns.forEach((col) => {
      const colDef: ColumnDef<T> = {
        accessorKey: col.accessorKey as string,
        header: col.header,
        cell: col.cell ? ({ row, getValue }) => col.cell!({ getValue, row, column: { id: col.accessorKey as string } }) : undefined,
        size: col.size,
        enableSorting: col.size !== 0,
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
        size: 50,
        header: () => <span className="text-right">Actions</span>,
        cell: ({ row }) => {
          const [open, setOpen] = useState<boolean>(false);
          return (
            <div className="relative flex justify-center">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen(!open);
                }}
                className="p-1.5 rounded-md hover:bg-gray-100 transition-colors"
              >
                <MoreHorizontal className="w-4 h-4 text-gray-500" />
              </button>
              {open && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-50 py-1">
                    {actions.map((action, i) => (
                      <button
                        key={i}
                        onClick={(e) => {
                          e.stopPropagation();
                          setOpen(false);
                          action.onClick(row.original);
                        }}
                        className={cn(
                          'w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2',
                          action.variant === 'danger' ? 'text-red-600' : 'text-gray-700'
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
    state: {
      sorting,
      columnFilters,
      rowSelection,
      pagination,
      globalFilter,
    },
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
    enableRowSelection,
    enableSorting,
  });

  useEffect(() => {
    if (onRowSelectionChange) {
      const selectedRows = table.getSelectedRowModel().rows.map((r) => r.original);
      onRowSelectionChange(selectedRows);
    }
  }, [rowSelection, onRowSelectionChange]);

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
            className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
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
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="">All</option>
          {options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
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
          className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      );
    }

    return null;
  };

  const visibleColumnsCount = columns.length + (enableRowSelection ? 1 : 0) + (enableActions && actions.length > 0 ? 1 : 0);

  if (loading) {
    return (
      <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden', className)}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500 border-b border-zinc-200"
                      style={{ width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {Array.from({ length: loadingRows }).map((_, i) => (
                <tr key={i} className="border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors">
                  {columns.map((_, j) => (
                    <td key={j} className="px-3 py-1.5 align-middle">
                      <div className="h-4 bg-gray-100 rounded animate-pulse w-full max-w-[200px]" />
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
    <div className={cn('bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden', className)}>
      {enableColumnFilters && hasColumnFilters && (
        <div className="px-4 py-3 border-b border-zinc-200 bg-zinc-50/80 flex items-center gap-3">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="h-10 px-3 text-left align-middle text-xs font-medium text-zinc-500 border-b border-zinc-200"
                    style={{ width: header.getSize() }}
                  >
                    {header.column.columnDef.enableSorting !== false && enableSorting ? (
                      <div
                        className={cn(
                          'flex items-center gap-1 cursor-pointer select-none hover:text-gray-900',
                          header.column.getCanSort() ? 'cursor-pointer' : 'cursor-default'
                        )}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <span className="ml-1 text-zinc-400">
                            {header.column.getIsSorted() === 'asc' ? (
                              <ChevronUp className="w-3 h-3" />
                            ) : header.column.getIsSorted() === 'desc' ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronsUpDown className="w-3 h-3" />
                            )}
                          </span>
                        )}
                      </div>
                    ) : header.isPlaceholder ? null : (
                      flexRender(header.column.columnDef.header, header.getContext())
                    )}
                    {enableColumnFilters &&
                      'filterType' in (header.column.columnDef || {}) &&
                      (header.column.columnDef as any).filterType && (
                        <div className="mt-1.5">{renderFilter(header)}</div>
                      )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getSortedRowModel().rows.length === 0 && table.getFilteredRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={visibleColumnsCount}
                  className="px-4 py-12 text-center text-gray-500"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              table.getSortedRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b border-zinc-100 hover:bg-zinc-50/80 transition-colors cursor-pointer',
                    row.getIsSelected() && 'bg-indigo-50/30'
                  )}
                  onClick={() => {
                    if (enableRowSelection) {
                      row.toggleSelected();
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className="px-3 py-1.5 align-middle whitespace-nowrap text-[12px] font-medium text-zinc-500"
                      style={{ maxWidth: cell.column.getSize() }}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {enablePagination && (
        <div className="px-4 py-3 border-t border-zinc-200 flex items-center justify-between bg-zinc-50/80">
          <div className="flex items-center gap-2 text-sm text-zinc-600">
            <span>
              Page {pagination.pageIndex + 1} of {table.getPageCount()}
            </span>
            <select
              value={pagination.pageSize}
              onChange={(e) => {
                table.setPageSize(Number(e.target.value));
              }}
              className="ml-2 px-2 py-1 text-xs border border-zinc-200 rounded-md focus:outline-none focus:ring-1 focus:ring-zinc-500"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size} per page
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => table.setPageIndex(0)}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
              disabled={!table.getCanNextPage()}
              className="p-1.5 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}