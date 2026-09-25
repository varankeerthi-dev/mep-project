import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search as SearchIcon, ChevronDown as ChevronDownIcon, ChevronRight as ChevronRightIcon, MoreHorizontal as MoreHorizontalIcon, Eye as EyeIcon, Loader2, ArrowUpDown as ArrowUpDownIcon, ArrowUp as ArrowUpIcon, ArrowDown as ArrowDownIcon, X as XIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ShellColumn {
  id: string;
  label: string;
  width?: string;
  align?: 'left' | 'right' | 'center';
  mandatory?: boolean;
  sortable?: boolean;
  tdClass?: string;
}

export interface ShellMenuItem {
  label: string;
  icon?: any;
  danger?: boolean;
  tone?: 'indigo' | 'blue' | 'amber';
  dividerBefore?: boolean;
  children?: { label: string; onClick: () => void }[];
  onClick?: () => void;
}

const MENU_TONE_CLASS: Record<string, string> = {
  indigo: 'text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700',
  blue: 'text-blue-600 hover:bg-blue-50 hover:text-blue-800 font-medium',
  amber: 'text-amber-700 hover:bg-amber-50 hover:text-amber-800',
};

interface DocumentListShellProps {
  title: string;
  count: number | string;
  stats?: { label: string; value: string | number; labelClass?: string; valueClass?: string }[];
  totalValue?: { label: string; value: string };
  subtitle?: string;
  search: string;
  onSearch: (v: string) => void;
  searchPlaceholder?: string;
  subTabs?: string[];
  activeSubTab?: string;
  onSubTab?: (t: string) => void;
  statusOptions?: string[];
  statusFilter?: string;
  onStatusFilter?: (s: string) => void;
  statusLabel?: (s: string) => string;
  statusFilterStyle?: 'dropdown' | 'pills';
  onCreate?: () => void;
  createLabel?: string;
  createButton?: React.ReactNode;
  columns: ShellColumn[];
  visibleIds: string[];
  onVisibleChange: (ids: string[]) => void;
  columnStorageKey?: string;
  showColumnCustomizer?: boolean;
  columnCustomizer?: React.ReactNode;
  rows: any[];
  getRowId: (row: any, index: number) => string;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onRowClick?: (row: any) => void;
  renderCell: (col: ShellColumn, row: any, index: number) => React.ReactNode;
  eyeButton?: (row: any) => { onPreview: () => void; loading: boolean } | null;
  rowActions?: (row: any) => React.ReactNode;
  rowMenuItems?: (row: any, index: number) => ShellMenuItem[];
  sort?: { value: 'asc' | 'desc' | null; onToggle: () => void; columnId: string };
  bulkBar?: { threshold?: number; render: (ids: Set<string>, clear: () => void) => React.ReactNode };
  onClearSelection?: () => void;
  pagination?: { page: number; totalPages: number; onPage: (p: number) => void; totalItems: number };
  paginationRender?: React.ReactNode;
  loading?: boolean;
  loadingText?: string;
  emptyTitle?: string;
  emptyHint?: string;
}

// DocumentListShell - shared list chrome for quotations, sales orders, and
// future invoices / proformas / purchase orders / challans / debit+credit
// notes. Engines (queries, PDFs, approvals, conversions) stay in the modules:
// the shell only renders what callers pass via props and render-props.
export function DocumentListShell(props: DocumentListShellProps) {
  const {
    title, count, stats, totalValue, subtitle,
    search, onSearch, searchPlaceholder,
    subTabs, activeSubTab, onSubTab,
    statusOptions, statusFilter, onStatusFilter, statusLabel, statusFilterStyle,
    onCreate, createLabel, createButton,
    columns, visibleIds, onVisibleChange, columnStorageKey, showColumnCustomizer, columnCustomizer,
    rows, getRowId, selectedIds, onToggleSelect, onToggleSelectAll, onClearSelection,
    onRowClick, renderCell, eyeButton, rowActions, rowMenuItems,
    sort, bulkBar, pagination, paginationRender,
    loading, loadingText, emptyTitle, emptyHint,
  } = props;

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openSub, setOpenSub] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const colsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openMenuId && !showStatusDropdown && !showCols) return;
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) { setOpenMenuId(null); setOpenSub(null); }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowStatusDropdown(false);
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setShowCols(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setOpenMenuId(null); setShowStatusDropdown(false); setShowCols(false); setOpenSub(null); }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [openMenuId, showStatusDropdown, showCols]);

  const visibleCols = columns.filter((c) => visibleIds.includes(c.id));
  const allSelected = rows.length > 0 && rows.every((r, i) => selectedIds.has(getRowId(r, i)));
  const showBulk = bulkBar && selectedIds.size >= (bulkBar.threshold ?? 2);

  const toggleColumn = (id: string) => {
    const col = columns.find((c) => c.id === id);
    if (!col || col.mandatory) return;
    const next = visibleIds.includes(id) ? visibleIds.filter((v) => v !== id) : [...visibleIds, id];
    onVisibleChange(next);
    if (columnStorageKey) {
      try { localStorage.setItem(columnStorageKey, JSON.stringify(next)); } catch { /* ignore */ }
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      <AnimatePresence>
        {showBulk && bulkBar && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-6">
              <button
                onClick={() => { if (onClearSelection) onClearSelection(); else onToggleSelectAll(); }}
                className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
                aria-label="Clear selection"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedIds.size} items selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold leading-none">Bulk Operations Active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {bulkBar.render(selectedIds, () => { if (onClearSelection) onClearSelection(); else onToggleSelectAll(); })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">{title}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {count}
            </span>
          </div>
          {stats && stats.length > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-4">
                {stats.map((s) => (
                  <div key={s.label} className="flex items-center gap-1.5">
                    <span className={cn('text-[10px] font-bold uppercase tracking-wider mx-1', s.labelClass || 'text-zinc-400')}>{s.label}</span>
                    <span className={cn('text-xs font-medium mx-1', s.valueClass || 'text-zinc-700')}>{s.value}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {totalValue && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mx-1">{totalValue.label}</span>
                <span className="text-sm font-medium text-zinc-900 mx-1">{totalValue.value}</span>
              </div>
            </>
          )}
          {subtitle && (
            <p className="text-sm text-zinc-500">{subtitle}</p>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder={searchPlaceholder || 'Search...'}
              value={search}
              onChange={(e) => onSearch(e.target.value)}
              className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      <div
        className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50"
        style={{ paddingTop: '15px', paddingBottom: '15px' }}
      >
        <div className="flex items-center gap-2">
          {subTabs && subTabs.length > 0 && subTabs.map((tab) => (
            <button
              key={tab}
              onClick={() => onSubTab && onSubTab(tab)}
              className={`w-[150px] h-[26px] px-4 text-sm font-medium transition-colors ${
                activeSubTab === tab
                  ? 'bg-blue-600/10 text-blue-600'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab}
            </button>
          ))}
          {statusOptions && statusOptions.length > 0 && statusFilterStyle !== 'pills' && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-[150px] h-[26px] flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
              >
                {statusFilter === 'All' ? 'All Statuses' : (statusLabel ? statusLabel(statusFilter || '') : statusFilter)}
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1">
                  {statusOptions.map((status) => (
                    <button
                      key={status}
                      onClick={() => {
                        if (onStatusFilter) onStatusFilter(status);
                        setShowStatusDropdown(false);
                      }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                        statusFilter === status
                          ? 'bg-indigo-50 text-indigo-700'
                          : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {status === 'All' ? 'All Statuses' : (statusLabel ? statusLabel(status) : status)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {statusOptions && statusOptions.length > 0 && statusFilterStyle === 'pills' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 shrink-0">Status:</span>
              <div className="flex flex-wrap gap-1">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => onStatusFilter && onStatusFilter(status)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      statusFilter === status
                        ? 'bg-emerald-50 border-emerald-300 text-emerald-700'
                        : 'bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {statusLabel ? statusLabel(status) : status}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-[10px]">
          {createButton ? createButton : (onCreate && (
            <button
              onClick={onCreate}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              {createLabel || 'Create'}
            </button>
          ))}
          {columnCustomizer ? columnCustomizer : (showColumnCustomizer !== false && (
            <div className="relative" ref={colsRef}>
              <button
                onClick={() => setShowCols(!showCols)}
                className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors active:scale-[0.98]"
                style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
              >
                Columns
              </button>
              {showCols && (
                <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</h3>
                  <div className="space-y-[10px]">
                    {columns.map((col) => (
                      <label
                        key={col.id}
                        className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                          col.mandatory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 cursor-pointer'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={visibleIds.includes(col.id)}
                          disabled={!!col.mandatory}
                          onChange={() => toggleColumn(col.id)}
                          className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] px-4 text-center align-middle w-[50px] bg-white border-b border-zinc-200">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={onToggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {visibleCols.map((col) => (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    className={cn(
                      'sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200',
                      col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'
                    )}
                  >
                    {sort && sort.columnId === col.id ? (
                      <button
                        onClick={sort.onToggle}
                        className="flex items-center gap-2 hover:text-zinc-900 transition-colors group"
                      >
                        {col.label}
                        <div className="flex flex-col">
                          {!sort.value && <ArrowUpDownIcon className="w-3 h-3 text-zinc-300 group-hover:text-zinc-400" />}
                          {sort.value === 'asc' && <ArrowUpIcon className="w-3 h-3 text-indigo-600" />}
                          {sort.value === 'desc' && <ArrowDownIcon className="w-3 h-3 text-indigo-600" />}
                        </div>
                      </button>
                    ) : col.label}
                  </th>
                ))}
                {eyeButton && (
                  <th className="sticky top-0 z-10 h-[36px] px-0 align-middle w-[50px] bg-white border-b border-zinc-200" />
                )}
                {(rowMenuItems || rowActions) && (
                  <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
                    Action
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white">
              {loading ? (
                <tr>
                  <td colSpan={visibleCols.length + 3} className="px-5 py-16 text-center text-sm text-zinc-500">
                    {loadingText || 'Loading...'}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={visibleCols.length + 3} className="px-5 py-16 text-center text-sm text-zinc-500">
                    {emptyTitle || 'No records found'}
                    {emptyHint ? <div className="text-xs text-zinc-400 mt-1">{emptyHint}</div> : null}
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {rows.map((row, index) => {
                    const rowId = getRowId(row, index);
                    const eye = eyeButton ? eyeButton(row) : null;
                    const menuItems = rowMenuItems ? rowMenuItems(row, index) : [];
                    return (
                      <motion.tr
                        key={rowId}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                          opacity: { duration: 0.2 }
                        }}
                        className={cn(
                          'cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative',
                          openMenuId === rowId ? 'z-50' : 'z-0',
                          index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30',
                          selectedIds.has(rowId) && 'bg-indigo-50/50 border-l-blue-600'
                        )}
                        onClick={() => {
                          if (selectedIds.size === 0) {
                            if (onRowClick) onRowClick(row);
                          } else {
                            onToggleSelect(rowId);
                          }
                        }}
                      >
                        <td className="px-4 py-3 align-middle text-center border-t border-zinc-200/70">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(rowId)}
                            onChange={(e) => {
                              e.stopPropagation();
                              onToggleSelect(rowId);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        {visibleCols.map((col) => (
                          <td
                            key={col.id}
                            className={cn(
                              'px-6 py-3 align-middle text-sm border-t border-zinc-200/70',
                              col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left',
                              col.tdClass
                            )}
                          >
                            {renderCell(col, row, index)}
                          </td>
                        ))}
                        {eye && (
                          <td className="px-0 py-3 align-middle border-t border-zinc-200/70">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (!eye.loading) eye.onPreview();
                              }}
                              style={{
                                padding: '14px',
                                background: 'transparent',
                                border: 'none',
                                color: '#9ca3af',
                                borderRadius: '0',
                                cursor: eye.loading ? 'wait' : 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                transition: 'all 0.15s'
                              }}
                              onMouseEnter={(e) => { if (!eye.loading) e.currentTarget.style.color = '#185FA5'; }}
                              onMouseLeave={(e) => { if (!eye.loading) e.currentTarget.style.color = '#9ca3af'; }}
                            >
                              {eye.loading ? (
                                <Loader2 className="w-[18px] h-[18px] animate-spin" />
                              ) : (
                                <EyeIcon className="w-[18px] h-[18px]" />
                              )}
                            </button>
                          </td>
                        )}
                        {rowActions && (
                          <td className="px-5 pl-1 py-3 align-middle text-center border-t border-zinc-200/70">
                            {rowActions(row)}
                          </td>
                        )}
                        {rowMenuItems && (
                          <td className="px-5 pl-1 py-3 align-middle text-center border-t border-zinc-200/70">
                            <div className="relative inline-block" ref={openMenuId === rowId ? menuRef : undefined}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(openMenuId === rowId ? null : rowId);
                                  setOpenSub(null);
                                }}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"
                              >
                                <MoreHorizontalIcon className="w-4 h-4 text-zinc-500" />
                              </button>
                              {openMenuId === rowId && (
                                <div className={cn(
                                  'absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5',
                                  index >= rows.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                                )}>
                                  {menuItems.map((item) => {
                                    const ItemIcon = item.icon;
                                    const hasSub = item.children && item.children.length > 0;
                                    return (
                                      <div key={item.label} className="relative" onMouseEnter={() => { if (hasSub) setOpenSub(`${rowId}:${item.label}`); }}>
                                        {item.dividerBefore && <div className="my-1 border-t border-zinc-100" />}
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (hasSub) {
                                              setOpenSub(openSub === `${rowId}:${item.label}` ? null : `${rowId}:${item.label}`);
                                            } else {
                                              setOpenMenuId(null);
                                              setOpenSub(null);
                                              if (item.onClick) item.onClick();
                                            }
                                          }}
                                          className={cn(
                                            'flex w-full items-center gap-2 rounded-md px-2 text-[12px] transition-all active:scale-[0.98]',
                                            item.danger
                                              ? 'text-red-600 hover:bg-red-50'
                                              : (item.tone && MENU_TONE_CLASS[item.tone]) || MENU_TONE_CLASS.indigo
                                          )}
                                          style={{ padding: '6px' }}
                                        >
                                          {ItemIcon ? <ItemIcon className="w-3.5 h-3.5" /> : null}
                                          <span className="flex-1 text-left">{item.label}</span>
                                          {hasSub && <ChevronRightIcon className="w-3.5 h-3.5 text-zinc-400 shrink-0" />}
                                        </button>
                                        {hasSub && openSub === `${rowId}:${item.label}` && (
                                          <div className="absolute left-full top-0 ml-1 z-[110] min-w-[180px] bg-white border border-zinc-200 rounded-md shadow-lg p-1">
                                            {item.children!.map((c) => (
                                              <button
                                                key={c.label}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setOpenMenuId(null);
                                                  setOpenSub(null);
                                                  c.onClick();
                                                }}
                                                className="block w-full text-left px-2.5 py-2 text-[12px] font-medium text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 rounded transition-colors"
                                              >
                                                {c.label}
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          </td>
                        )}
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {paginationRender ? paginationRender : (pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between px-6 py-3 border-t border-zinc-200 bg-white">
          <span className="text-xs text-zinc-500">
            Page {pagination.page} of {pagination.totalPages} ({pagination.totalItems} records)
          </span>
          <div className="flex items-center gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => pagination.onPage(pagination.page - 1)}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40"
            >
              Previous
            </button>
            <button
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => pagination.onPage(pagination.page + 1)}
              className="px-3 py-1.5 text-xs font-medium border border-zinc-200 rounded-lg hover:bg-zinc-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
