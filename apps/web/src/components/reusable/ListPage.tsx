import React, { useState, useMemo, useEffect, useRef, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search as SearchIcon,
  Plus as PlusIcon,
  Download as DownloadIcon,
  Eye as EyeIcon,
  MoreHorizontal as MoreHorizontalIcon,
  ChevronDown as ChevronDownIcon,
  Trash2 as Trash2Icon,
  ArrowUpDown as ArrowUpDownIcon,
  ArrowUp as ArrowUpIcon,
  ArrowDown as ArrowDownIcon,
  Printer as PrinterIcon,
  X as XIcon,
  Loader2,
  Columns as ColumnsIcon,
} from 'lucide-react';

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ListPageColumn<T> {
  id: string;
  label: string;
  width?: string;
  render: (item: T) => ReactNode;
  textAlign?: 'left' | 'right' | 'center';
}

export interface ListPageAction<T> {
  label: string;
  icon: ReactNode;
  onClick: (item: T) => void;
  /** 'primary' = blue text, 'danger' = red, 'warning' = amber, 'default' = zinc */
  variant?: 'default' | 'primary' | 'danger' | 'warning';
  /** Put a separator <hr /> before or after this action */
  separator?: 'before' | 'after';
  /** Only show if condition is true (default: true) */
  condition?: (item: T) => boolean;
}

export interface ListPageStat {
  label: string;
  color: string;
  count: number;
}

export interface ListPageProps<T> {
  // ── Identity ──────────────────────────────
  title: string;
  entityNamePlural: string;       // "quotations", "invoices", etc.
  entityName: string;             // "quotation", "invoice", etc.

  // ── Data ──────────────────────────────────
  queryKey: string[];
  fetchData: () => Promise<T[]>;
  getId: (item: T) => string;
  loading?: boolean;

  // ── Columns ───────────────────────────────
  columns: ListPageColumn<T>[];
  mandatoryColumnIds?: string[];
  localStorageKey?: string;

  // ── Searching ─────────────────────────────
  searchPlaceholder?: string;
  filterItems: (items: T[], searchTerm: string, statusFilter: string) => T[];

  // ── Sub-tabs ──────────────────────────────
  subTabs: Array<{ label: string; statusFilter?: string }>;
  defaultSubTab?: string;

  // ── Status ────────────────────────────────
  statuses: string[];

  // ── Stats ─────────────────────────────────
  renderStats?: (items: T[]) => ListPageStat[];
  totalValueLabel?: string;
  getTotalValue?: (item: T) => number;

  // ── Navigation ────────────────────────────
  onRowClick?: (item: T) => void;
  onCreateLabel?: string;
  onCreateClick?: () => void;
  onView?: (item: T) => void;

  // ── Sorting ───────────────────────────────
  sortColumnId?: string;
  sortItems?: (items: T[], order: 'asc' | 'desc' | null) => T[];

  // ── Actions menu ──────────────────────────
  actions: (item: T) => ListPageAction<T>[];

  // ── Bulk operations ───────────────────────
  onBulkPrint?: (selectedIds: Set<string>) => void;
  onBulkDelete?: (selectedIds: Set<string>) => void;
  /** Override the entire bulk header area */
  renderBulkActions?: (selectedIds: Set<string>, clearSelection: () => void) => ReactNode;
  /** Extra bulk action buttons (e.g. "Mark as Sent") */
  bulkActionButtons?: (selectedIds: Set<string>, clearSelection: () => void) => ReactNode;
}

// ──────────────────────────────────────────────
// Component
// ──────────────────────────────────────────────

export function ListPage<T>({
  title,
  entityNamePlural,
  entityName,
  queryKey,
  fetchData,
  getId,
  loading: externalLoading,
  columns,
  mandatoryColumnIds,
  localStorageKey,
  searchPlaceholder,
  filterItems,
  subTabs,
  defaultSubTab = subTabs[0]?.label ?? '',
  statuses,
  renderStats,
  totalValueLabel,
  getTotalValue,
  onRowClick,
  onCreateLabel,
  onCreateClick,
  sortColumnId,
  sortItems,
  actions,
  onBulkPrint,
  onBulkDelete,
  renderBulkActions,
  bulkActionButtons,
}: ListPageProps<T>) {
  // ── State ──────────────────────────────────
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [subTab, setSubTab] = useState(defaultSubTab);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);

  const storageKey = localStorageKey ?? `${entityName}_list_columns`;

  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : columns.map(c => c.id);
    } catch {
      return columns.map(c => c.id);
    }
  });
  const [tempVisibleColumns, setVisibleColumnsTemp] = useState<string[]>(visibleColumns);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  // ── Fetch data ────────────────────────────
  const queryKeyStr = JSON.stringify(queryKey);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    fetchData()
      .then((result) => {
        if (mounted) setData(result);
      })
      .catch(console.error)
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKeyStr]);

  const isLoading = externalLoading ?? loading;

  // ── Selection ──────────────────────────────
  const currentItems = useMemo(() => {
    const q = searchTerm.toLowerCase();
    let items = filterItems(data, searchTerm, statusFilter);

    if (sortOrder && sortItems) {
      items = sortItems(items, sortOrder);
    }

    return items;
  }, [data, searchTerm, statusFilter, sortOrder, sortItems, filterItems]);

  const paginationData = useMemo(() => {
    const totalItems = currentItems.length;
    const totalValue = getTotalValue
      ? currentItems.reduce((sum, item) => sum + (getTotalValue(item) || 0), 0)
      : 0;
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const pageItems = currentItems.slice(startIndex, endIndex);

    return {
      totalItems,
      totalValue,
      totalPages,
      startIndex,
      endIndex,
      currentItems: pageItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    };
  }, [currentItems, currentPage, itemsPerPage, getTotalValue]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginationData.currentItems.map((item) => getId(item))));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  // ── Click-outside handlers ────────────────
  useEffect(() => {
    if (!openMenuId) return;
    const handle = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setOpenMenuId(null);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    const handle = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) setShowStatusDropdown(false);
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStatusDropdown(false);
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showStatusDropdown]);

  useEffect(() => {
    if (!showColumnCustomizer) return;
    const handle = (event: MouseEvent) => {
      if (columnCustomizerRef.current && !columnCustomizerRef.current.contains(event.target as Node)) {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    document.addEventListener('mousedown', handle);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handle);
      document.removeEventListener('keydown', handleKey);
    };
  }, [showColumnCustomizer, visibleColumns]);

  // ── Sub-tab / filter resets ───────────────
  useEffect(() => {
    const tab = subTabs.find(t => t.label === subTab);
    if (tab?.statusFilter) {
      setStatusFilter(tab.statusFilter);
    } else {
      setStatusFilter('All');
    }
    setCurrentPage(1);
  }, [subTab]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  // ── Sort toggle ────────────────────────────
  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder(null);
  };

  // ── Construct stats ────────────────────────
  const stats = useMemo(() => {
    if (renderStats) return renderStats(data);
    return [];
  }, [data, renderStats]);

  // ── Column customizer helper ───────────────
  const mandatoryIds = new Set(mandatoryColumnIds ?? []);

  const actionVariants: Record<string, string> = {
    default: 'hover:bg-indigo-50 hover:text-indigo-700',
    primary: 'hover:bg-indigo-50 hover:text-indigo-700 font-medium',
    danger: 'hover:bg-red-50 hover:text-red-600',
    warning: 'hover:bg-amber-50 hover:text-amber-700',
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* ── Sticky Bulk Action Header ────────── */}
      <AnimatePresence>
        {selectedIds.size >= 2 && (
          <motion.div
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-6">
              <button
                onClick={() => setSelectedIds(new Set())}
                className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
              >
                <XIcon className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedIds.size} items selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold leading-none">
                  Bulk Operations Active
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {renderBulkActions
                ? renderBulkActions(selectedIds, () => setSelectedIds(new Set()))
                : (
                  <>
                    {onBulkPrint && (
                      <button
                        onClick={() => onBulkPrint(selectedIds)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-all active:scale-[0.98]"
                      >
                        <PrinterIcon className="w-3.5 h-3.5" />
                        Print Selected
                      </button>
                    )}
                    {onBulkDelete && (
                      <button
                        onClick={() => {
                          if (confirm(`Are you sure you want to delete ${selectedIds.size} ${entityNamePlural}?`)) {
                            onBulkDelete(selectedIds);
                            setSelectedIds(new Set());
                          }
                        }}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"
                      >
                        <Trash2Icon className="w-3.5 h-3.5" />
                        Delete All
                      </button>
                    )}
                    {bulkActionButtons && bulkActionButtons(selectedIds, () => setSelectedIds(new Set()))}
                  </>
                )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Header ─────────────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">{title}</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {paginationData.totalItems}
            </span>
          </div>
          {stats.length > 0 && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-4">
                {stats.map((stat) => (
                  <div key={stat.label} className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-bold uppercase tracking-wider mx-1`} style={{ color: stat.color }}>
                      {stat.label}
                    </span>
                    <span className="text-xs font-medium text-zinc-700 mx-1">{stat.count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {totalValueLabel && getTotalValue && (
            <>
              <div className="h-4 w-px bg-zinc-200" />
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mx-1">
                  {totalValueLabel}
                </span>
                <span className="text-sm font-medium text-zinc-900 mx-1">
                  {paginationData.totalValue.toLocaleString('en-IN', {
                    style: 'currency',
                    currency: 'INR',
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder={searchPlaceholder ?? `Search ${entityNamePlural}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Sub-tabs & Filter Row ───────────── */}
      <div
        className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50"
        style={{ paddingTop: '15px', paddingBottom: '15px' }}
      >
        <div className="flex items-center gap-2">
          {subTabs.map((tab) => (
            <button
              key={tab.label}
              onClick={() => setSubTab(tab.label)}
              className={`w-[150px] h-[26px] px-4 text-sm font-medium transition-colors ${
                subTab === tab.label
                  ? 'bg-blue-600/10 text-blue-600'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab.label}
            </button>
          ))}

          {/* Status dropdown — only when not using a sub-tab's built-in filter */}
          {subTab === defaultSubTab && statuses.length > 0 && (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowStatusDropdown(!showStatusDropdown)}
                className="w-[150px] h-[26px] flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
              >
                {statusFilter === 'All' ? 'All Statuses' : statusFilter}
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1">
                  <button
                    onClick={() => { setStatusFilter('All'); setShowStatusDropdown(false); }}
                    className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                      statusFilter === 'All' ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    All Statuses
                  </button>
                  {statuses.map((status) => (
                    <button
                      key={status}
                      onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                      className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                        statusFilter === status ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
                      }`}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-[10px]">
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              {onCreateLabel ?? `Create ${entityName}`}
            </button>
          )}

          {/* Column Customizer */}
          <div className="relative" ref={columnCustomizerRef}>
            <button
              onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
              className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              <ColumnsIcon className="w-4 h-4 mr-1.5" />
              Columns
            </button>
            {showColumnCustomizer && (
              <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</h3>
                  <div className="space-y-[10px]">
                    {columns.map((col) => {
                      const isMandatory = mandatoryIds.has(col.id);
                      return (
                        <label
                          key={col.id}
                          className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${
                            isMandatory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={tempVisibleColumns.includes(col.id)}
                            disabled={isMandatory}
                            onChange={(e) => {
                              if (isMandatory) return;
                              if (e.target.checked) {
                                setVisibleColumnsTemp([...tempVisibleColumns, col.id]);
                              } else {
                                setVisibleColumnsTemp(tempVisibleColumns.filter(id => id !== col.id));
                              }
                            }}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                          <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => {
                      setVisibleColumns(tempVisibleColumns);
                      localStorage.setItem(storageKey, JSON.stringify(tempVisibleColumns));
                      setShowColumnCustomizer(false);
                    }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors active:scale-[0.98]"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => {
                      setVisibleColumnsTemp(visibleColumns);
                      setShowColumnCustomizer(false);
                    }}
                    className="flex-1 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors active:scale-[0.98]"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Table ───────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] px-4 text-center align-middle w-[50px] bg-white border-b border-zinc-200">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginationData.currentItems.length && paginationData.currentItems.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {columns
                  .filter(col => visibleColumns.includes(col.id))
                  .map((col) => (
                    <th
                      key={col.id}
                      style={{ width: col.width ?? 'auto' }}
                      className={`sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 ${
                        col.textAlign === 'right' ? 'text-right' : col.textAlign === 'center' ? 'text-center' : 'text-left'
                      }`}
                    >
                      {col.id === sortColumnId ? (
                        <button
                          onClick={toggleSort}
                          className="flex items-center gap-2 hover:text-zinc-900 transition-colors group"
                        >
                          {col.label}
                          <div className="flex flex-col">
                            {!sortOrder && <ArrowUpDownIcon className="w-3 h-3 text-zinc-300 group-hover:text-zinc-400" />}
                            {sortOrder === 'asc' && <ArrowUpIcon className="w-3 h-3 text-indigo-600" />}
                            {sortOrder === 'desc' && <ArrowDownIcon className="w-3 h-3 text-indigo-600" />}
                          </div>
                        </button>
                      ) : (
                        col.label
                      )}
                    </th>
                  ))}
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">
                    Loading {entityNamePlural}...
                  </td>
                </tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr>
                  <td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No {entityNamePlural} found
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginationData.currentItems.map((item, index) => {
                    const id = getId(item);
                    const itemActions = actions(item).filter(a => a.condition ? a.condition(item) : true);

                    return (
                      <motion.tr
                        key={id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          type: 'spring',
                          stiffness: 400,
                          damping: 30,
                          opacity: { duration: 0.2 },
                        }}
                        className={`cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${
                          openMenuId === id ? 'z-50' : 'z-0'
                        } ${
                          index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                        } ${selectedIds.has(id) ? 'bg-indigo-50/50 border-l-blue-600' : ''}`}
                        onClick={() => {
                          if (selectedIds.size === 0) {
                            onRowClick?.(item);
                          } else {
                            toggleSelect(id);
                          }
                        }}
                      >
                        <td className="px-4 py-[26px] align-middle text-center border-t border-zinc-200/70">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>

                        {columns
                          .filter(col => visibleColumns.includes(col.id))
                          .map((col) => (
                            <td
                              key={col.id}
                              className={`px-6 py-[26px] align-middle text-sm border-t border-zinc-200/70 ${
                                col.textAlign === 'right'
                                  ? 'text-right'
                                  : col.textAlign === 'center'
                                  ? 'text-center'
                                  : 'text-left'
                              } ${col.id === 'status' ? '' : 'text-zinc-800'}`}
                            >
                              {col.render(item)}
                            </td>
                          ))}

                        <td className="px-5 pl-1 py-[26px] align-middle text-center border-t border-zinc-200/70">
                          <div className="relative inline-block" ref={openMenuId === id ? menuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === id ? null : id);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"
                            >
                              <MoreHorizontalIcon className="w-4 h-4 text-zinc-500" />
                            </button>
                            {openMenuId === id && (
                              <div
                                className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                                  index >= paginationData.currentItems.length - 3 && index > 3
                                    ? 'bottom-full mb-1'
                                    : 'top-full mt-1'
                                }`}
                              >
                                {itemActions.map((action, ai) => (
                                  <React.Fragment key={ai}>
                                    {action.separator === 'before' && <div className="my-1 border-t border-zinc-100" />}
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setOpenMenuId(null);
                                        action.onClick(item);
                                      }}
                                      className={`flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all ${actionVariants[action.variant ?? 'default']} active:scale-[0.98]`}
                                      style={{ padding: '6px' }}
                                    >
                                      {action.icon}
                                      {action.label}
                                    </button>
                                    {action.separator === 'after' && <div className="my-1 border-t border-zinc-100" />}
                                  </React.Fragment>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination Footer ───────────────── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing{' '}
          {paginationData.totalItems === 0 ? 0 : paginationData.startIndex + 1}{' '}
          to {Math.min(paginationData.endIndex, paginationData.totalItems)} of{' '}
          {paginationData.totalItems} {entityNamePlural}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(currentPage - 1)}
            disabled={!paginationData.hasPrevPage}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasPrevPage
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Previous
          </button>

          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, paginationData.totalPages)) }, (_, i) => {
              let pageNum: number;
              if (paginationData.totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= paginationData.totalPages - 2) {
                pageNum = paginationData.totalPages - 4 + i;
              } else {
                pageNum = currentPage - 2 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => setCurrentPage(currentPage + 1)}
            disabled={!paginationData.hasNextPage}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasNextPage
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

export default ListPage;
