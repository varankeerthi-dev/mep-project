import { useState } from 'react'
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
  type PaginationState,
} from '@tanstack/react-table'
import { DataTable, DataTableHeader, DataTableToolbar, DataTablePagination } from './index'
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from './table'
import { Input } from '../input'
import { Button } from '../button'
import { Search, Plus, Filter, RefreshCcw } from 'lucide-react'
import { cn } from '../../../lib/utils'

interface EnhancedDataTableProps<TData, TValue> {
  data: TData[]
  columns: ColumnDef<TData, TValue>[]
  title?: string
  subtitle?: string
  onAdd?: () => void
  onRefresh?: () => void
  onRowClick?: (row: TData) => void
  addButtonLabel?: string
  enableSearch?: boolean
  enableSorting?: boolean
  enablePagination?: boolean
  pageSizeOptions?: number[]
  defaultPageSize?: number
  emptyMessage?: string
  loading?: boolean
  className?: string
}

export function EnhancedDataTable<TData, TValue>({
  data,
  columns,
  title,
  subtitle,
  onAdd,
  onRefresh,
  onRowClick,
  addButtonLabel = 'Add New',
  enableSearch = true,
  enableSorting = true,
  enablePagination = true,
  pageSizeOptions = [10, 25, 50, 100],
  defaultPageSize = 10,
  emptyMessage = 'No data available',
  loading = false,
  className,
}: EnhancedDataTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: defaultPageSize,
  })

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: enableSorting ? getSortedRowModel() : undefined,
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: enablePagination ? getPaginationRowModel() : undefined,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onPaginationChange: setPagination,
    state: {
      sorting,
      columnFilters,
      globalFilter,
      pagination,
    },
    initialState: {
      pagination: {
        pageSize: defaultPageSize,
      },
    },
  })

  const header = title ? (
    <DataTableHeader
      title={title}
      subtitle={subtitle}
      actions={
        <div className="flex items-center gap-2">
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              className="gap-2"
            >
              <RefreshCcw className="h-4 w-4" />
              Refresh
            </Button>
          )}
          {onAdd && (
            <Button
              variant="primary"
              size="sm"
              onClick={onAdd}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              {addButtonLabel}
            </Button>
          )}
        </div>
      }
    />
  ) : null

  const toolbar = enableSearch ? (
    <DataTableToolbar>
      <div className="relative flex-1 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          placeholder="Search..."
          value={globalFilter ?? ''}
          onChange={(e) => setGlobalFilter(e.target.value)}
          className="pl-9 h-9"
        />
      </div>
    </DataTableToolbar>
  ) : null

  const tableContent = (
    <Table>
      <TableHeader>
        {table.getHeaderGroups().map((headerGroup) => (
          <TableRow key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <TableHead key={header.id}>
                {header.isPlaceholder
                  ? null
                  : flexRender(header.column.columnDef.header, header.getContext())}
              </TableHead>
            ))}
          </TableRow>
        ))}
      </TableHeader>
      <TableBody>
        {loading ? (
          Array.from({ length: defaultPageSize }).map((_, i) => (
            <TableRow key={i}>
              {columns.map((_, j) => (
                <TableCell key={j}>
                  <div className="h-4 bg-slate-100 rounded animate-pulse w-full max-w-[200px]" />
                </TableCell>
              ))}
            </TableRow>
          ))
        ) : table.getRowModel().rows.length === 0 ? (
          <TableRow>
            <TableCell
              colSpan={columns.length}
              className="h-24 text-center text-slate-500"
            >
              {emptyMessage}
            </TableCell>
          </TableRow>
        ) : (
          table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              onClick={() => onRowClick?.(row.original)}
              style={{ cursor: onRowClick ? 'pointer' : 'default' }}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  )

  const paginationComponent = enablePagination ? (
    <DataTablePagination table={table} pageSizeOptions={pageSizeOptions} />
  ) : null

  return (
    <DataTable
      header={header}
      toolbar={toolbar}
      table={tableContent}
      pagination={paginationComponent}
      className={className}
    />
  )
}
