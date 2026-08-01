import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

export interface ColumnDef<T> {
  header: string;
  accessorKey?: keyof T;
  id?: string;
  align?: 'left' | 'right' | 'center';
  cell?: (info: { row: T; getValue: () => any }) => React.ReactNode;
}

export interface DataTableProps<T> {
  data: T[];
  columns: ColumnDef<T>[];
  loading?: boolean;
  page: number;
  pageSize: number;
  totalRows: number;
  searchable?: boolean;
  selectable?: boolean;
  sortable?: boolean;
  pagination?: boolean;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  onSearch?: (value: string) => void;

  // Custom visual extensions for backward compatibility
  title?: string;
  emptyLabel?: string;
  emptyDescription?: string;
  onRowClick?: (row: T) => void;
  entryLabel?: string;
}

export function DataTableV2<T>({
  data,
  columns,
  loading,
  page,
  pageSize,
  totalRows,
  searchable = false,
  selectable = false,
  sortable = false,
  pagination = true,
  onPageChange,
  onPageSizeChange,
  onSearch,
  title,
  emptyLabel = 'No entries found',
  emptyDescription = 'There are no items to display in this list.',
  onRowClick,
  entryLabel = 'entries',
}: DataTableProps<T>) {
  const [searchValue, setSearchValue] = useState('');
  
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSearchValue(val);
    if (onSearch) {
      onSearch(val);
    }
  };

  const getAlignmentStyle = (align?: 'left' | 'right' | 'center'): React.CSSProperties => {
    if (align === 'right') return { textAlign: 'right' };
    if (align === 'center') return { textAlign: 'center' };
    return { textAlign: 'left' };
  };

  const totalPages = Math.ceil(totalRows / pageSize) || 1;
  const showPagination = pagination && totalRows > 0;

  return (
    <div className="w-full flex flex-col font-['Inter']">
      {/* Title & Toolbar */}
      {(title || searchable) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', paddingInline: '4px' }}>
          {title ? (
            <h2 className="text-[17px] font-semibold text-zinc-900 margin-0">
              {title}
            </h2>
          ) : <div />}
          
          {searchable && (
            <div style={{ position: 'relative', width: '240px' }}>
              <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#9ca3af' }} />
              <input
                type="text"
                placeholder="Search..."
                value={searchValue}
                onChange={handleSearchChange}
                style={{
                  padding: '4px 12px 4px 32px',
                  fontSize: '12px',
                  height: '32px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
                  background: '#fff',
                  color: '#111827',
                  outline: 'none',
                  width: '100%',
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Table Card Container */}
      <div 
        style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #E5E7EB',
          borderRadius: '16px',
          boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.05)',
          overflow: 'hidden',
          width: '100%',
        }}
      >
        <div style={{ overflowX: 'auto', width: '100%' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr style={{ height: '44px' }}>
                {selectable && (
                  <th
                    style={{
                      backgroundColor: '#F9FAFB',
                      borderBottom: '1px solid #E5E7EB',
                      width: '40px',
                      padding: '12px 16px',
                      borderTopLeftRadius: '16px',
                    }}
                  >
                    <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                  </th>
                )}
                {columns.map((col, idx) => {
                  const isFirst = idx === 0 && !selectable;
                  const isLast = idx === columns.length - 1;
                  return (
                    <th
                      key={col.id || col.header || idx}
                      style={{
                        backgroundColor: '#F9FAFB',
                        borderBottom: '1px solid #E5E7EB',
                        color: '#6B7280',
                        fontFamily: '"Inter", sans-serif',
                        fontSize: '12px',
                        fontWeight: 600,
                        lineHeight: '1.2',
                        padding: '12px 24px',
                        ...getAlignmentStyle(col.align),
                        borderTopLeftRadius: isFirst ? '16px' : undefined,
                        borderTopRightRadius: isLast ? '16px' : undefined,
                        cursor: sortable ? 'pointer' : 'default',
                      }}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.header}
                        {sortable && (
                          <span style={{ fontSize: '10px', color: '#9ca3af' }}>↕</span>
                        )}
                      </span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, rIdx) => (
                  <tr key={rIdx} style={{ borderBottom: '1px solid #F3F4F6' }}>
                    <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: '16px 24px' }}>
                      <div className="h-4 bg-zinc-100 rounded-md animate-pulse w-full" />
                    </td>
                  </tr>
                ))
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: '48px 24px', textAlign: 'center' }}>
                    <div className="flex flex-col items-center justify-center">
                      <p className="text-sm font-medium text-zinc-500">{emptyLabel}</p>
                      <p className="text-xs text-zinc-400 mt-1">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                data.map((row, rIdx) => {
                  const isLastRow = rIdx === data.length - 1;
                  return (
                    <tr
                      key={rIdx}
                      onClick={() => onRowClick && onRowClick(row)}
                      style={{
                        borderBottom: isLastRow ? 'none' : '1px solid #F3F4F6',
                        cursor: onRowClick ? 'pointer' : 'default',
                        transition: 'background-color 0.15s ease',
                      }}
                      className={onRowClick ? 'hover:bg-zinc-50/50' : 'hover:bg-zinc-50/20'}
                    >
                      {selectable && (
                        <td style={{ padding: '14px 16px', borderBottom: isLastRow ? 'none' : '1px solid #F3F4F6' }} onClick={e => e.stopPropagation()}>
                          <input type="checkbox" className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                        </td>
                      )}
                      {columns.map((col, cIdx) => {
                        const val = col.accessorKey ? row[col.accessorKey] : undefined;
                        const cellContent = col.cell 
                          ? col.cell({ row, getValue: () => val }) 
                          : (val !== undefined ? String(val) : '');

                        return (
                          <td
                            key={cIdx}
                            style={{
                              color: '#111827',
                              fontSize: '13.5px',
                              fontWeight: 500,
                              lineHeight: '1.5',
                              padding: '14px 24px',
                              verticalAlign: 'middle',
                              ...getAlignmentStyle(col.align),
                              borderBottom: isLastRow ? 'none' : '1px solid #F3F4F6',
                            }}
                          >
                            {cellContent}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination at the bottom */}
        {showPagination && (
          <div 
            style={{
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              borderTop: '1px solid #E5E7EB',
              display: 'flex',
              justifyContent: 'space-between',
              padding: '12px 24px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <span className="text-xs text-zinc-400 tabular-nums">
                Showing{' '}
                <span className="font-semibold text-zinc-600">
                  {(page - 1) * pageSize + 1}
                </span>{' '}
                to{' '}
                <span className="font-semibold text-zinc-600">
                  {Math.min(page * pageSize, totalRows)}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-zinc-600">
                  {totalRows}
                </span>{' '}
                {entryLabel}
              </span>

              {onPageSizeChange && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span className="text-xs text-zinc-400">Rows per page:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    style={{
                      padding: '2px 8px',
                      fontSize: '11px',
                      border: '1px solid #d1d5db',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#4B5563',
                      outline: 'none',
                    }}
                  >
                    {[10, 20, 50, 100].map(sz => (
                      <option key={sz} value={sz}>{sz}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <button
                disabled={page === 1}
                onClick={() => onPageChange && onPageChange(page - 1)}
                style={{
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  color: '#4B5563',
                  cursor: page === 1 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  fontSize: '12px',
                  fontWeight: 500,
                  height: '32px',
                  justifyContent: 'center',
                  opacity: page === 1 ? 0.4 : 1,
                  paddingInline: '10px',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97]"
              >
                Prev
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
                  const isActive = p === page;
                  return (
                    <button
                      key={p}
                      onClick={() => onPageChange && onPageChange(p)}
                      style={{
                        alignItems: 'center',
                        backgroundColor: isActive ? '#16A34A' : '#FFFFFF',
                        border: isActive ? '1px solid #16A34A' : '1px solid #E5E7EB',
                        borderRadius: '8px',
                        color: isActive ? '#FFFFFF' : '#4B5563',
                        cursor: 'pointer',
                        display: 'flex',
                        fontSize: '12px',
                        fontWeight: 600,
                        height: '32px',
                        justifyContent: 'center',
                        width: '32px',
                        transition: 'all 0.15s ease',
                      }}
                      className={isActive ? '' : 'hover:bg-zinc-50 hover:text-zinc-700'}
                    >
                      {p}
                    </button>
                  );
                })}
              </div>

              <button
                disabled={page === totalPages}
                onClick={() => onPageChange && onPageChange(page + 1)}
                style={{
                  alignItems: 'center',
                  backgroundColor: '#FFFFFF',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  color: '#4B5563',
                  cursor: page === totalPages ? 'not-allowed' : 'pointer',
                  display: 'inline-flex',
                  fontSize: '12px',
                  fontWeight: 500,
                  height: '32px',
                  justifyContent: 'center',
                  opacity: page === totalPages ? 0.4 : 1,
                  paddingInline: '10px',
                  transition: 'all 0.15s ease',
                }}
                className="hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.97]"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
