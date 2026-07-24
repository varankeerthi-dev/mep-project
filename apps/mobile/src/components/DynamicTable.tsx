import React, { useState, useMemo } from 'react';

export interface Column<T> {
  key: string;
  header: React.ReactNode;
  accessor?: keyof T | ((row: T) => any);
  render?: (value: any, row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  width?: string;
}

export interface DynamicTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor?: (item: T, index: number) => string | number;
  onRowClick?: (item: T, index: number) => void;
  emptyMessage?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  enablePagination?: boolean;
  pageSize?: number;
  page?: number;
  onPageChange?: (page: number) => void;
}

export function DynamicTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  style = {},
  enablePagination = true,
  pageSize = 25,
  page: externalPage,
  onPageChange,
}: DynamicTableProps<T>) {
  const effectivePageSize = Math.min(Math.max(1, pageSize), 25);
  const [internalPage, setInternalPage] = useState(1);
  const activePage = externalPage !== undefined ? externalPage : internalPage;

  const totalPages = Math.max(1, Math.ceil(data.length / effectivePageSize));

  const handlePageChange = (newPage: number) => {
    const targetPage = Math.min(Math.max(1, newPage), totalPages);
    if (externalPage === undefined) {
      setInternalPage(targetPage);
    }
    if (onPageChange) {
      onPageChange(targetPage);
    }
  };

  const paginatedData = useMemo(() => {
    if (!enablePagination) return data;
    const startIndex = (activePage - 1) * effectivePageSize;
    return data.slice(startIndex, startIndex + effectivePageSize);
  }, [data, enablePagination, activePage, effectivePageSize]);

  const getCellValue = (item: T, column: Column<T>): any => {
    if (typeof column.accessor === 'function') {
      return column.accessor(item);
    }
    if (column.accessor && typeof column.accessor === 'string' && column.accessor in (item as any)) {
      return (item as any)[column.accessor];
    }
    if (column.key in (item as any)) {
      return (item as any)[column.key];
    }
    return undefined;
  };

  return (
    <div
      className={className}
      style={{
        backgroundColor: '#FFFFFF',
        boxShadow: '0px 1px 3px rgba(0,0,0,0.08)',
        borderRadius: '8px',
        overflow: 'hidden',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        ...style,
      }}
    >
      <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', width: '100%' }}>
        <table
          style={{
            borderCollapse: 'collapse',
            width: '100%',
            minWidth: '100%',
            fontSize: '14px',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          <thead>
            <tr style={{ borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '10px 12px',
                    textAlign: col.align || 'left',
                    fontWeight: 600,
                    color: '#374151',
                    whiteSpace: 'nowrap',
                    width: col.width,
                  }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  style={{ padding: '20px', textAlign: 'center', color: '#6B7280' }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIndex) => {
                const globalIndex = (activePage - 1) * effectivePageSize + rowIndex;
                const rowKey = keyExtractor
                  ? keyExtractor(item, globalIndex)
                  : (item as any).id || globalIndex;
                const isLast = rowIndex === paginatedData.length - 1;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(item, globalIndex)}
                    style={{
                      borderBottom: isLast && !enablePagination ? 'none' : '1px solid #F3F4F6',
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {columns.map((col) => {
                      const val = getCellValue(item, col);
                      const cellContent = col.render ? col.render(val, item, globalIndex) : val;

                      return (
                        <td
                          key={col.key}
                          style={{
                            padding: '10px 12px',
                            textAlign: col.align || 'left',
                            color: '#1F2937',
                            width: col.width,
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

      {/* Bottom Pagination */}
      {enablePagination && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '12px',
            borderTop: '1px solid #E5E7EB',
            marginTop: 'auto',
          }}
        >
          <TablePagination
            currentPage={activePage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
}

interface TablePaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TablePagination({
  currentPage,
  totalPages,
  onPageChange,
}: TablePaginationProps) {
  const getPageNumbers = (): number[] => {
    const maxVisible = 5;
    if (totalPages <= maxVisible) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    let start = Math.max(1, currentPage - 2);
    let end = start + maxVisible - 1;
    if (end > totalPages) {
      end = totalPages;
      start = Math.max(1, end - maxVisible + 1);
    }
    const pages: number[] = [];
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div
      style={{
        alignItems: 'center',
        display: 'flex',
        padding: '4px',
        borderRadius: '9999px',
        gap: '2px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #E5E7EB',
        fontSize: '12px',
        userSelect: 'none',
      }}
    >
      <button
        type="button"
        disabled={isFirstPage}
        onClick={() => !isFirstPage && onPageChange(currentPage - 1)}
        style={{
          alignItems: 'center',
          height: '32px',
          display: 'inline-flex',
          justifyContent: 'center',
          paddingRight: '10px',
          paddingLeft: '6px',
          borderRadius: '9999px',
          gap: '4px',
          border: 'none',
          background: 'none',
          cursor: isFirstPage ? 'not-allowed' : 'pointer',
          opacity: isFirstPage ? 0.4 : 1,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
          <path d="m15 18-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>Prev</span>
      </button>

      <div style={{ alignItems: 'center', display: 'flex', marginInline: '2px' }}>
        {pageNumbers.map((pageNum) => {
          const isActive = pageNum === currentPage;
          return (
            <button
              key={pageNum}
              type="button"
              onClick={() => onPageChange(pageNum)}
              style={{
                alignItems: 'center',
                display: 'inline-flex',
                justifyContent: 'center',
                borderRadius: '9999px',
                width: '32px',
                height: '32px',
                background: isActive ? '#171717' : 'none',
                color: isActive ? '#FAFAFA' : '#6B7280',
                border: 'none',
                cursor: 'pointer',
                fontWeight: isActive ? 700 : 500,
                fontSize: '12px',
              }}
            >
              {pageNum}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={isLastPage}
        onClick={() => !isLastPage && onPageChange(currentPage + 1)}
        style={{
          alignItems: 'center',
          height: '32px',
          display: 'inline-flex',
          justifyContent: 'center',
          paddingRight: '6px',
          paddingLeft: '10px',
          borderRadius: '9999px',
          gap: '4px',
          border: 'none',
          background: 'none',
          cursor: isLastPage ? 'not-allowed' : 'pointer',
          opacity: isLastPage ? 0.4 : 1,
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 500, color: '#111827' }}>Next</span>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
          <path d="m9 18 6-6-6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  let bg = '#E6F4EA';
  let color = '#137333';

  if (normalized === 'cancel' || normalized === 'cancelled' || normalized === 'inactive') {
    bg = '#FCE8E6';
    color = '#C5221F';
  } else if (normalized === 'pending' || normalized === 'in_progress') {
    bg = '#FEF7E0';
    color = '#B06000';
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '12px',
        backgroundColor: bg,
        color: color,
        fontSize: '12px',
        fontWeight: 500,
        textTransform: 'capitalize',
      }}
    >
      {status}
    </span>
  );
}
