import React, { useState, useMemo, useRef, useEffect } from 'react';

export interface Column<T> {
  /** Unique identifier for the column */
  key: string;
  /** Header label or custom React element */
  header: React.ReactNode;
  /** Accessor key from the data object or custom value extractor function */
  accessor?: keyof T | ((row: T) => any);
  /** Custom render function for the cell */
  render?: (value: any, row: T, index: number) => React.ReactNode;
  /** Text alignment in header and body cells */
  align?: 'left' | 'center' | 'right';
  /** Optional width style (e.g. '150px', '200px', '20%', 'max-content') */
  width?: string;
  /** Custom header cell styles */
  headerStyle?: React.CSSProperties;
  /** Custom body cell styles */
  cellStyle?: React.CSSProperties;
}

export interface RowAction<T> {
  /** Unique identifier for action item */
  key?: string;
  /** Label text or React element */
  label: React.ReactNode;
  /** Optional icon rendered before the label */
  icon?: React.ReactNode;
  /** Action click callback */
  onClick: (row: T, index: number) => void;
  /** Styling variant: 'default' | 'danger' | 'warning' */
  variant?: 'default' | 'danger' | 'warning';
  /** Whether item is disabled */
  disabled?: boolean | ((row: T) => boolean);
  /** Whether item is hidden for a specific row */
  hidden?: boolean | ((row: T) => boolean);
}

export interface DynamicTableProps<T> {
  /** Array of column definitions */
  columns: Column<T>[];
  /** Data array to be rendered in the table */
  data: T[];
  /** Optional list of row actions or a function returning actions per row */
  actions?: RowAction<T>[] | ((row: T) => RowAction<T>[]);
  /** Header label for the actions column (default: empty) */
  actionsHeader?: React.ReactNode;
  /** Width of the actions column (default: '56px') */
  actionsColumnWidth?: string;
  /** Enable multi-row selection with checkboxes as the first column */
  enableRowSelection?: boolean;
  /** Controlled selected row keys */
  selectedRowKeys?: (string | number)[];
  /** Callback fired when row selection changes */
  onSelectionChange?: (selectedRows: T[], selectedKeys: (string | number)[]) => void;
  /** Custom width for selection column (default: '44px') */
  selectionColumnWidth?: string;
  /** Optional maximum height for vertical scrolling (e.g. '400px', '60vh') */
  maxHeight?: string;
  /** Whether the header stays fixed at top during vertical scroll (default: true) */
  stickyHeader?: boolean;
  /** Function to retrieve unique key for each row */
  keyExtractor?: (item: T, index: number) => string | number;
  /** Optional click handler when a row is selected */
  onRowClick?: (item: T, index: number) => void;
  /** Optional message or element to display when data is empty */
  emptyMessage?: React.ReactNode;
  /** Custom table container class name */
  className?: string;
  /** Custom inline styles for table container */
  style?: React.CSSProperties;
  /** Whether to show hover effects on rows */
  hoverable?: boolean;
  /** Compact mode for dense datasets */
  compact?: boolean;
  /** Enable client-side pagination (default: true) */
  enablePagination?: boolean;
  /** Items per page (default: 15, maximum allowed: 15) */
  pageSize?: number;
  /** Controlled active page index (1-indexed) */
  page?: number;
  /** Callback when page is changed */
  onPageChange?: (page: number) => void;
}

export function DynamicTable<T>({
  columns,
  data,
  actions,
  actionsHeader = 'Actions',
  actionsColumnWidth = '120px',
  enableRowSelection = false,


  selectedRowKeys: externalSelectedKeys,
  onSelectionChange,
  selectionColumnWidth = '44px',
  maxHeight,
  stickyHeader = true,
  keyExtractor,
  onRowClick,
  emptyMessage = 'No data available',
  className = '',
  style = {},
  hoverable = true,
  compact = false,
  enablePagination = true,
  pageSize = 15,
  page: externalPage,
  onPageChange,
}: DynamicTableProps<T>) {
  // Active open dropdown menu row key
  const [openMenuRowKey, setOpenMenuRowKey] = useState<string | number | null>(null);

  // Uncontrolled selected row keys state
  const [internalSelectedKeys, setInternalSelectedKeys] = useState<Set<string | number>>(new Set());

  // Active selected keys set
  const activeSelectedKeys = useMemo(() => {
    if (externalSelectedKeys !== undefined) {
      return new Set(externalSelectedKeys);
    }
    return internalSelectedKeys;
  }, [externalSelectedKeys, internalSelectedKeys]);

  // Ensure maximum of 15 items per page
  const effectivePageSize = Math.min(Math.max(1, pageSize), 15);
  
  const [internalPage, setInternalPage] = useState(1);
  const activePage = externalPage !== undefined ? externalPage : internalPage;

  const totalPages = Math.max(1, Math.ceil(data.length / effectivePageSize));

  const handlePageChange = (newPage: number) => {
    const targetPage = Math.min(Math.max(1, newPage), totalPages);
    setOpenMenuRowKey(null);
    if (externalPage === undefined) {
      setInternalPage(targetPage);
    }
    if (onPageChange) {
      onPageChange(targetPage);
    }
  };

  // Helper to extract row key
  const getRowKey = (item: T, globalIndex: number): string | number => {
    if (keyExtractor) return keyExtractor(item, globalIndex);
    return (item as any).id || (item as any).key || globalIndex;
  };

  // Slice data for current active page if pagination is enabled
  const paginatedData = useMemo(() => {
    if (!enablePagination) return data;
    const startIndex = (activePage - 1) * effectivePageSize;
    return data.slice(startIndex, startIndex + effectivePageSize);
  }, [data, enablePagination, activePage, effectivePageSize]);

  // Check if all visible paginated items are selected
  const isAllPageSelected = useMemo(() => {
    if (paginatedData.length === 0) return false;
    return paginatedData.every((item, idx) => {
      const globalIndex = (activePage - 1) * effectivePageSize + idx;
      return activeSelectedKeys.has(getRowKey(item, globalIndex));
    });
  }, [paginatedData, activePage, effectivePageSize, activeSelectedKeys]);

  // Check if some (but not all) visible paginated items are selected
  const isSomePageSelected = useMemo(() => {
    if (paginatedData.length === 0 || isAllPageSelected) return false;
    return paginatedData.some((item, idx) => {
      const globalIndex = (activePage - 1) * effectivePageSize + idx;
      return activeSelectedKeys.has(getRowKey(item, globalIndex));
    });
  }, [paginatedData, activePage, effectivePageSize, activeSelectedKeys, isAllPageSelected]);

  // Handle Select All / Deselect All for current page
  const handleToggleSelectAll = () => {
    const nextSet = new Set(activeSelectedKeys);

    if (isAllPageSelected) {
      // Deselect all items on current page
      paginatedData.forEach((item, idx) => {
        const globalIndex = (activePage - 1) * effectivePageSize + idx;
        nextSet.delete(getRowKey(item, globalIndex));
      });
    } else {
      // Select all items on current page
      paginatedData.forEach((item, idx) => {
        const globalIndex = (activePage - 1) * effectivePageSize + idx;
        nextSet.add(getRowKey(item, globalIndex));
      });
    }

    if (externalSelectedKeys === undefined) {
      setInternalSelectedKeys(nextSet);
    }

    if (onSelectionChange) {
      const selectedKeysArray = Array.from(nextSet);
      const selectedRows = data.filter((item, idx) =>
        nextSet.has(getRowKey(item, idx))
      );
      onSelectionChange(selectedRows, selectedKeysArray);
    }
  };

  // Handle Single Row Checkbox Toggle
  const handleToggleRow = (item: T, globalIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const key = getRowKey(item, globalIndex);
    const nextSet = new Set(activeSelectedKeys);

    if (nextSet.has(key)) {
      nextSet.delete(key);
    } else {
      nextSet.add(key);
    }

    if (externalSelectedKeys === undefined) {
      setInternalSelectedKeys(nextSet);
    }

    if (onSelectionChange) {
      const selectedKeysArray = Array.from(nextSet);
      const selectedRows = data.filter((row, idx) =>
        nextSet.has(getRowKey(row, idx))
      );
      onSelectionChange(selectedRows, selectedKeysArray);
    }
  };

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

  const getRowActions = (row: T): RowAction<T>[] => {
    if (!actions) return [];
    const list = typeof actions === 'function' ? actions(row) : actions;
    return list.filter((act) => {
      if (typeof act.hidden === 'function') return !act.hidden(row);
      return !act.hidden;
    });
  };

  const paddingY = compact ? '8px' : '12px';
  const paddingX = compact ? '12px' : '16px';
  const totalColumnCount =
    columns.length + (actions ? 1 : 0) + (enableRowSelection ? 1 : 0);

  return (
    <div
      className={className}
      style={{
        alignItems: 'start',
        backgroundColor: '#FFFFFF',
        borderColor: '#000000',
        borderStyle: 'solid',
        borderWidth: '0px',
        boxShadow: '#0A0A0A1A 0px 0px 0px 1px',
        boxSizing: 'border-box',
        display: 'flex',
        flexDirection: 'column',
        fontSize: '12px',
        fontSynthesis: 'none',
        height: '100%',
        justifyContent: 'center',
        lineHeight: '16px',
        overflow: 'hidden',
        paddingBlock: '1px',
        paddingInline: '13px',
        WebkitFontSmoothing: 'antialiased',
        ...style,
      }}
    >
      {/* Scroll Container */}
      <div
        style={{
          alignSelf: 'stretch',
          boxSizing: 'border-box',
          overflowX: 'auto',
          overflowY: maxHeight ? 'auto' : 'visible',
          maxHeight: maxHeight || 'none',
          width: '100%',
          position: 'relative',
        }}
      >
        <table
          style={{
            borderCollapse: 'collapse',
            boxSizing: 'border-box',
            captionSide: 'bottom',
            width: '100%',
            fontFamily: '"Geist", system-ui, sans-serif',
          }}
        >
          <thead>
            <tr
              style={{
                borderBottomColor: '#E5E5E5',
                borderBottomStyle: 'solid',
                borderBottomWidth: '0.8px',
                boxSizing: 'border-box',
              }}
            >
              {/* Checkbox Select All First Column Header */}
              {enableRowSelection && (
                <th
                  style={{
                    position: stickyHeader ? 'sticky' : 'static',
                    top: 0,
                    backgroundColor: '#FFFFFF',
                    zIndex: 10,
                    borderBottomColor: '#E5E5E5',
                    borderBottomStyle: 'solid',
                    borderBottomWidth: '0.8px',
                    boxSizing: 'border-box',
                    paddingBlock: paddingY,
                    paddingInline: '12px',
                    textAlign: 'center',
                    width: selectionColumnWidth,
                    minWidth: selectionColumnWidth,
                    boxShadow: stickyHeader ? '0 1px 0 #E5E5E5' : 'none',
                  }}
                >
                  <CheckboxInput
                    checked={isAllPageSelected}
                    indeterminate={isSomePageSelected}
                    onChange={handleToggleSelectAll}
                    ariaLabel="Select all rows"
                  />
                </th>
              )}

              {columns.map((col) => {
                const headerStyleObj: React.CSSProperties = {
                  position: stickyHeader ? 'sticky' : 'static',
                  top: 0,
                  backgroundColor: '#FFFFFF',
                  zIndex: 10,
                  borderBottomColor: '#E5E5E5',
                  borderBottomStyle: 'solid',
                  borderBottomWidth: '0.8px',
                  boxSizing: 'border-box',
                  paddingBlock: paddingY,
                  paddingInline: paddingX,
                  textAlign: col.align || 'left',
                  fontWeight: 500,
                  fontSize: '16px',
                  color: '#0A0A0A',
                  lineHeight: '150%',
                  boxShadow: stickyHeader ? '0 1px 0 #E5E5E5' : 'none',
                  ...col.headerStyle,
                };

                if (col.width) {
                  headerStyleObj.width = col.width;
                  headerStyleObj.minWidth = col.width;
                }

                return (
                  <th key={col.key} style={headerStyleObj}>
                    <div style={{ display: 'inline-block', width: 'max-content' }}>
                      {col.header}
                    </div>
                  </th>
                );
              })}

              {/* Actions Column Header */}
              {actions && (
                <th
                  style={{
                    position: stickyHeader ? 'sticky' : 'static',
                    top: 0,
                    backgroundColor: '#FFFFFF',
                    zIndex: 10,
                    borderBottomColor: '#E5E5E5',
                    borderBottomStyle: 'solid',
                    borderBottomWidth: '0.8px',
                    boxSizing: 'border-box',
                    paddingBlock: paddingY,
                    paddingInline: paddingX,
                    textAlign: 'center',
                    width: actionsColumnWidth,
                    minWidth: actionsColumnWidth,
                    fontWeight: 500,
                    fontSize: '16px',
                    color: '#0A0A0A',
                    lineHeight: '150%',
                    boxShadow: stickyHeader ? '0 1px 0 #E5E5E5' : 'none',
                  }}
                >
                  {actionsHeader}
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {paginatedData.length === 0 ? (
              <tr>
                <td
                  colSpan={totalColumnCount}
                  style={{
                    paddingBlock: '24px',
                    paddingInline: paddingX,
                    textAlign: 'center',
                    color: '#737373',
                    fontSize: '14px',
                  }}
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginatedData.map((item, rowIndex) => {
                const globalIndex = (activePage - 1) * effectivePageSize + rowIndex;
                const rowKey = getRowKey(item, globalIndex);
                const isSelected = activeSelectedKeys.has(rowKey);
                const isLastRow = rowIndex === paginatedData.length - 1;
                const rowActions = getRowActions(item);
                const isMenuOpen = openMenuRowKey === rowKey;

                return (
                  <tr
                    key={rowKey}
                    onClick={() => onRowClick && onRowClick(item, globalIndex)}
                    style={{
                      borderBottomColor: isLastRow && !enablePagination ? 'transparent' : '#E5E5E5',
                      borderBottomStyle: 'solid',
                      borderBottomWidth: isLastRow && !enablePagination ? '0px' : '0.8px',
                      boxSizing: 'border-box',
                      backgroundColor: isSelected ? '#F0F7FF' : 'transparent',
                      cursor: onRowClick ? 'pointer' : 'default',
                      transition: 'background-color 0.15s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      if (hoverable && !isSelected) {
                        e.currentTarget.style.backgroundColor = '#F9FAFB';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (hoverable && !isSelected) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Checkbox First Column Cell */}
                    {enableRowSelection && (
                      <td
                        style={{
                          boxSizing: 'border-box',
                          paddingBlock: paddingY,
                          paddingInline: '12px',
                          textAlign: 'center',
                          width: selectionColumnWidth,
                          minWidth: selectionColumnWidth,
                        }}
                        onClick={(e) => handleToggleRow(item, globalIndex, e)}
                      >
                        <CheckboxInput
                          checked={isSelected}
                          onChange={(e) => handleToggleRow(item, globalIndex, e as any)}
                          ariaLabel={`Select row ${globalIndex + 1}`}
                        />
                      </td>
                    )}

                    {columns.map((col) => {
                      const val = getCellValue(item, col);
                      const cellContent = col.render ? col.render(val, item, globalIndex) : val;

                      const cellStyleObj: React.CSSProperties = {
                        boxSizing: 'border-box',
                        paddingBlock: paddingY,
                        paddingInline: paddingX,
                        textAlign: col.align || 'left',
                        color: '#0A0A0A99',
                        fontSize: '16px',
                        lineHeight: '150%',
                        ...col.cellStyle,
                      };

                      if (col.width) {
                        cellStyleObj.width = col.width;
                        cellStyleObj.minWidth = col.width;
                      }

                      return (
                        <td key={col.key} style={cellStyleObj}>
                          {cellContent}
                        </td>
                      );
                    })}

                    {/* Row Action Dropdown Menu Cell */}
                    {actions && (
                      <td
                        style={{
                          boxSizing: 'border-box',
                          paddingBlock: paddingY,
                          paddingInline: paddingX,
                          textAlign: 'center',
                          width: actionsColumnWidth,
                          minWidth: actionsColumnWidth,
                          position: 'relative',
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <ActionMenuDropdown
                          row={item}
                          rowIndex={globalIndex}
                          actions={rowActions}
                          isOpen={isMenuOpen}
                          onToggle={() =>
                            setOpenMenuRowKey(isMenuOpen ? null : rowKey)
                          }
                          onClose={() => setOpenMenuRowKey(null)}
                        />
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Paper Design Bottom Pagination Bar (Pinned to Bottom) */}
      {enablePagination && (
        <div
          style={{
            alignSelf: 'stretch',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            paddingBlock: '16px',
            borderTop: '0.8px solid #E5E5E5',
            marginTop: 'auto',
            backgroundColor: '#FFFFFF',
            zIndex: 20,
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

/**
 * Styled Checkbox component for Table Selection
 */
interface CheckboxInputProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  ariaLabel?: string;
}

function CheckboxInput({
  checked,
  indeterminate = false,
  onChange,
  ariaLabel,
}: CheckboxInputProps) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={onChange}
      aria-label={ariaLabel}
      style={{
        width: '16px',
        height: '16px',
        borderRadius: '4px',
        accentColor: '#171717',
        cursor: 'pointer',
        verticalAlign: 'middle',
      }}
    />
  );
}

interface ActionMenuDropdownProps<T> {
  row: T;
  rowIndex: number;
  actions: RowAction<T>[];
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
}

function ActionMenuDropdown<T>({
  row,
  rowIndex,
  actions,
  isOpen,
  onToggle,
  onClose,
}: ActionMenuDropdownProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen, onClose]);

  // Identify primary "View" action
  const primaryViewAction = useMemo(() => {
    return actions.find(
      (a) =>
        a.key === 'view' ||
        (typeof a.label === 'string' && a.label.toLowerCase().includes('view'))
    );
  }, [actions]);

  // Remaining actions for dropdown menu
  const menuActions = useMemo(() => {
    if (!primaryViewAction) return actions;
    return actions.filter((a) => a !== primaryViewAction);
  }, [actions, primaryViewAction]);

  if (actions.length === 0) return null;

  return (
    <div ref={containerRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {/* Inline "View" Button before three dots */}
      {primaryViewAction && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            primaryViewAction.onClick(row, rowIndex);
          }}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            display: 'inline-flex',
            padding: '3px 9px',
            borderRadius: '6px',
            border: '1px solid #E5E7EB',
            backgroundColor: '#FFFFFF',
            color: '#2563EB',
            fontSize: '12px',
            fontFamily: '"Geist", system-ui, sans-serif',
            fontWeight: 600,
            cursor: 'pointer',
            marginRight: '6px',
            transition: 'all 0.15s ease',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#EFF6FF';
            e.currentTarget.style.borderColor = '#BFDBFE';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#FFFFFF';
            e.currentTarget.style.borderColor = '#E5E7EB';
          }}
        >
          View
        </button>
      )}

      {/* Horizontal Three Dots Button */}
      {menuActions.length > 0 && (
        <button
          type="button"
          onClick={onToggle}
          style={{
            alignItems: 'center',
            justifyContent: 'center',
            display: 'inline-flex',
            width: '28px',
            height: '28px',
            borderRadius: '6px',
            border: 'none',
            backgroundColor: isOpen ? '#F3F4F6' : 'transparent',
            cursor: 'pointer',
            color: '#525252',
            transition: 'background-color 0.15s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#F3F4F6';
          }}
          onMouseLeave={(e) => {
            if (!isOpen) e.currentTarget.style.backgroundColor = 'transparent';
          }}
          aria-label="More actions"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
      )}

      {/* Floating Dropdown Menu */}
      {isOpen && menuActions.length > 0 && (

        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 4px)',
            zIndex: 999,
            minWidth: '150px',
            backgroundColor: '#FFFFFF',
            borderRadius: '8px',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
            border: '1px solid #E5E7EB',
            padding: '4px',
            display: 'flex',
            flexDirection: 'column',
            gap: '2px',
          }}
        >
          {menuActions.map((act, index) => {
            const isDisabled =
              typeof act.disabled === 'function' ? act.disabled(row) : !!act.disabled;

            let textColor = '#1F2937';
            let hoverBg = '#F3F4F6';

            if (act.variant === 'danger') {
              textColor = '#DC2626';
              hoverBg = '#FEF2F2';
            } else if (act.variant === 'warning') {
              textColor = '#D97706';
              hoverBg = '#FFFBEB';
            }

            return (
              <button
                key={act.key || index}
                type="button"
                disabled={isDisabled}
                onClick={() => {
                  if (!isDisabled) {
                    act.onClick(row, rowIndex);
                    onClose();
                  }
                }}
                style={{
                  alignItems: 'center',
                  display: 'flex',
                  gap: '8px',
                  width: '100%',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: isDisabled ? '#9CA3AF' : textColor,
                  cursor: isDisabled ? 'not-allowed' : 'pointer',
                  fontSize: '14px',
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontWeight: 400,
                  textAlign: 'left',
                  transition: 'background-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) e.currentTarget.style.backgroundColor = hoverBg;
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                {act.icon && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
                    {act.icon}
                  </span>
                )}
                <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{act.label}</span>
              </button>
            );
          })}
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
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  };

  const pageNumbers = getPageNumbers();
  const isFirstPage = currentPage === 1;
  const isLastPage = currentPage === totalPages;

  return (
    <div
      style={{
        fontSynthesis: 'none',
        alignItems: 'center',
        display: 'flex',
        padding: '4px',
        borderRadius: '9999px',
        gap: '2px',
        backgroundColor: '#FFFFFFCC',
        borderWidth: '0.8px',
        borderStyle: 'solid',
        borderColor: '#E5E5E5',
        WebkitFontSmoothing: 'antialiased',
        fontSize: '12px',
        lineHeight: '16px',
        userSelect: 'none',
      }}
    >
      {/* Previous Button */}
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
          gap: '6px',
          borderWidth: '0.8px',
          borderStyle: 'solid',
          borderColor: '#00000000',
          background: 'none',
          cursor: isFirstPage ? 'not-allowed' : 'pointer',
          opacity: isFirstPage ? 0.4 : 1,
          transition: 'opacity 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isFirstPage) e.currentTarget.style.backgroundColor = '#F5F5F5';
        }}
        onMouseLeave={(e) => {
          if (!isFirstPage) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ height: '16px', width: '16px', flexShrink: 0, overflow: 'clip' }}
        >
          <path
            d="m15 18-6-6 6-6"
            fill="none"
            stroke="oklch(14.5% 0 0)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }}
          />
        </svg>
        <span
          style={{
            fontSize: '14px',
            lineHeight: '142.857%',
            width: 'max-content',
            flexShrink: 0,
            fontFamily: '"Geist", system-ui, sans-serif',
            fontWeight: 500,
            color: '#0A0A0A',
          }}
        >
          Previous
        </span>
      </button>

      {/* Page Numbers */}
      <div style={{ alignItems: 'center', display: 'flex', marginInline: '4px' }}>
        {pageNumbers.map((pageNum) => {
          const isActive = pageNum === currentPage;

          if (isActive) {
            return (
              <div key={pageNum} style={{ position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    borderRadius: '9999px',
                    boxShadow: '#0000001A 0px 4px 6px -1px, #0000001A 0px 2px 4px -2px',
                    backgroundColor: '#171717',
                    inset: 0,
                  }}
                />
                <button
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  style={{
                    alignItems: 'center',
                    display: 'inline-flex',
                    justifyContent: 'center',
                    borderRadius: '9999px',
                    position: 'relative',
                    width: '36px',
                    height: '36px',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    style={{
                      display: 'inline-block',
                      fontSize: '12px',
                      letterSpacing: '-0.6px',
                      lineHeight: '133.333%',
                      textTransform: 'uppercase',
                      width: 'max-content',
                      flexShrink: 0,
                      fontFamily: '"Geist", system-ui, sans-serif',
                      fontWeight: 700,
                      color: '#FAFAFA',
                    }}
                  >
                    {pageNum}
                  </span>
                </button>
              </div>
            );
          }

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
                width: '36px',
                height: '36px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                transition: 'background-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#F5F5F5';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <span
                style={{
                  display: 'inline-block',
                  fontSize: '12px',
                  letterSpacing: '-0.6px',
                  lineHeight: '133.333%',
                  textTransform: 'uppercase',
                  width: 'max-content',
                  flexShrink: 0,
                  fontFamily: '"Geist", system-ui, sans-serif',
                  fontWeight: 700,
                  color: '#737373',
                }}
              >
                {pageNum}
              </span>
            </button>
          );
        })}
      </div>

      {/* Next Button */}
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
          gap: '6px',
          borderWidth: '0.8px',
          borderStyle: 'solid',
          borderColor: '#00000000',
          background: 'none',
          cursor: isLastPage ? 'not-allowed' : 'pointer',
          opacity: isLastPage ? 0.4 : 1,
          transition: 'opacity 0.15s ease, background-color 0.15s ease',
        }}
        onMouseEnter={(e) => {
          if (!isLastPage) e.currentTarget.style.backgroundColor = '#F5F5F5';
        }}
        onMouseLeave={(e) => {
          if (!isLastPage) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <span
          style={{
            fontSize: '14px',
            lineHeight: '142.857%',
            width: 'max-content',
            flexShrink: 0,
            fontFamily: '"Geist", system-ui, sans-serif',
            fontWeight: 500,
            color: '#0A0A0A',
          }}
        >
          Next
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="24"
          height="24"
          viewBox="0 0 24 24"
          aria-hidden="true"
          style={{ height: '16px', width: '16px', flexShrink: 0, overflow: 'clip' }}
        >
          <path
            d="m9 18 6-6-6-6"
            fill="none"
            stroke="oklch(14.5% 0 0)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ boxSizing: 'border-box', transformOrigin: '0px 0px' }}
          />
        </svg>
      </button>
    </div>
  );
}

/**
 * Helper component for status badges matching Paper design tokens
 */
export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  
  let bg = 'oklab(60% -0.118 -0.010 / 10%)';
  let color = 'oklch(60% 0.118 184.7)';

  if (normalized === 'cancel' || normalized === 'cancelled' || normalized === 'inactive') {
    bg = 'oklab(57.7% 0.218 0.112 / 10%)';
    color = 'oklch(57.7% 0.245 27.3)';
  } else if (normalized === 'pending' || normalized === 'in_progress') {
    bg = 'oklab(75% 0.102 0.152 / 10%)';
    color = 'oklch(75% 0.183 55.9)';
  }

  return (
    <div
      style={{
        alignItems: 'center',
        backgroundColor: bg,
        borderColor: '#00000000',
        borderStyle: 'solid',
        borderWidth: '0.8px',
        boxSizing: 'border-box',
        display: 'inline-flex',
        gap: '4px',
        height: '20px',
        justifyContent: 'center',
        overflow: 'clip',
        paddingBlock: '2px',
        paddingInline: '8px',
        width: 'fit-content',
        borderRadius: '4px',
      }}
    >
      <span
        style={{
          color,
          display: 'inline-block',
          flexShrink: 0,
          fontFamily: '"Geist", system-ui, sans-serif',
          fontSize: '12px',
          fontWeight: 500,
          lineHeight: '133.333%',
          textTransform: 'capitalize',
          width: 'max-content',
        }}
      >
        {status}
      </span>
    </div>
  );
}
