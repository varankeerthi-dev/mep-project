import { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useAuth } from '../App';
import { timedSupabaseQuery } from '../utils/queryTimeout';
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
  FileCheck as FileCheckIcon,
  Edit2 as EditIcon
} from 'lucide-react';
import { PDFDocument } from 'pdf-lib';

const PO_STATUSES = ['All', 'Open', 'Partially Billed', 'Closed'];

const SUB_TABS = ['All POs', 'Open'];

const STATUS_FILTER_OPTIONS = ['All', 'Open', 'Partially Billed', 'Closed'];

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Open':              { bg: '#dbeafe', color: '#1d4ed8' },
  'Partially Billed':  { bg: '#fef3c7', color: '#b45309' },
  'Closed':            { bg: '#d1fae5', color: '#047857' },
};

const getStatusColor = (status?: string) =>
  STATUS_COLORS[status ?? ''] ?? STATUS_COLORS['Open'];

const MANDATORY_COLUMNS = ['po_date', 'po_number', 'client', 'po_total_value'];
const ALL_COLUMNS = [
  { id: 'po_date', label: 'Date', width: '120px' },
  { id: 'client', label: 'Client', width: '300px' },
  { id: 'po_number', label: 'PO Number', width: '140px' },
  { id: 'prepared_by', label: 'Created By', width: '150px' },
  { id: 'status', label: 'Status', width: '120px' },
  { id: 'po_total_value', label: 'Amount', width: '120px' },
  { id: 'po_utilized_value', label: 'Utilised', width: '120px' },
  { id: 'po_available_value', label: 'Balance', width: '120px' },
];

export default function POList() {
  const navigate = useNavigate();
  const { organisation } = useAuth();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [subTab, setSubTab] = useState('All POs');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(20);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('po_list_columns');
    return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
  });
  const [tempVisibleColumns, setVisibleColumnsTemp] = useState<string[]>(visibleColumns);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginationData.currentItems.map((p: any) => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  useEffect(() => {
    if (!openMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMenuId(null);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [openMenuId]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowStatusDropdown(false);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowStatusDropdown(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showStatusDropdown]);

  useEffect(() => {
    if (!showColumnCustomizer) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (columnCustomizerRef.current && !columnCustomizerRef.current.contains(event.target as Node)) {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnCustomizer(false);
        setVisibleColumnsTemp(visibleColumns);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColumnCustomizer, visibleColumns]);

  // Reset status filter when switching sub-tabs
  useEffect(() => {
    if (subTab === 'Open') {
      setStatusFilter('Open');
    } else {
      setStatusFilter('All');
    }
    setCurrentPage(1);
  }, [subTab]);

  // Reset to first page when search or status filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter]);

  const posQuery = useQuery({
    queryKey: ['pos', statusFilter, organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('client_purchase_orders')
        .select('*')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });

      if (statusFilter !== 'All') query = query.eq('status', statusFilter);

      return await timedSupabaseQuery(query, 'PO list');
    },
    enabled: !!organisation?.id,
  });

  // Fetch client names separately
  const { data: clientsData = [] } = useQuery({
    queryKey: ['clients-for-pos', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation.id);
      return data || [];
    },
    enabled: !!organisation?.id,
  });

  const clientsMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const c of clientsData) map[c.id] = c.client_name;
    return map;
  }, [clientsData]);

  const pos = posQuery.data || [];
  const isLoading = posQuery.isPending && !posQuery.data;

  const filteredPOs = useMemo(() => {
    const q = searchTerm.toLowerCase();
    const items = pos.filter((p: any) =>
      p.po_number?.toLowerCase().includes(q) ||
      (clientsMap[p.client_id] || '').toLowerCase().includes(q)
    );

    if (sortOrder) {
      items.sort((a: any, b: any) => {
        const dateA = new Date(a.po_date).getTime();
        const dateB = new Date(b.po_date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    }

    return items;
  }, [pos, searchTerm, sortOrder]);

  const paginationData = useMemo(() => {
    const totalItems = filteredPOs.length;
    const totalValue = filteredPOs.reduce((sum, p) => sum + (Number(p.po_total_value) || 0), 0);
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const currentItems = filteredPOs.slice(startIndex, endIndex);
    
    return {
      totalItems,
      totalValue,
      totalPages,
      startIndex,
      endIndex,
      currentItems,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1
    };
  }, [filteredPOs, currentPage, itemsPerPage]);

  const stats = useMemo(() => {
    return {
      total: pos.length,
      open: pos.filter((p: any) => p.status === 'Open').length,
      partial: pos.filter((p: any) => p.status === 'Partially Billed').length,
      closed: pos.filter((p: any) => p.status === 'Closed').length,
    };
  }, [pos]);

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder(null);
  };

  const handleBulkPrint = async () => {
    if (selectedIds.size === 0) return;
    alert(`Bulk Print Merge for ${selectedIds.size} POs initialized.`);
    setSelectedIds(new Set());
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} purchase order(s)?`)) return;

    try {
      const { error } = await supabase
        .from('client_purchase_orders')
        .delete()
        .in('id', Array.from(selectedIds))
        .eq('organisation_id', organisation?.id);

      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ['pos'] });
      setSelectedIds(new Set());
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Sticky Bulk Action Header */}
      <AnimatePresence>
        {selectedIds.size >= 2 && (
          <motion.div 
            initial={{ y: -64, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -64, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl"
          >
            <div className="flex items-center gap-6">
              <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-zinc-800 rounded-full transition-colors"><XIcon className="w-5 h-5" /></button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedIds.size} items selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold leading-none">Bulk Operations Active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={handleBulkPrint} className="inline-flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-zinc-100 transition-all active:scale-[0.98]"><PrinterIcon className="w-3.5 h-3.5" />Print Selected</button>
              <button onClick={handleBulkDelete} className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg hover:bg-red-700 transition-all active:scale-[0.98]"><Trash2Icon className="w-3.5 h-3.5" />Delete All</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">Purchase Orders</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">{paginationData.totalItems}</span>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mx-1">Total</span><span className="text-xs font-medium text-zinc-700 mx-1">{stats.total}</span></div>
            <div className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mx-1">Open</span><span className="text-xs font-medium text-blue-700 mx-1">{stats.open}</span></div>
            <div className="flex items-center gap-1.5"><span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mx-1">Closed</span><span className="text-xs font-medium text-emerald-700 mx-1">{stats.closed}</span></div>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mx-1">Total Value</span>
            <span className="text-sm font-medium text-zinc-900 mx-1">{formatCurrency(paginationData.totalValue)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input type="text" placeholder="Search POs..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent" />
          </div>
        </div>
      </div>

      {/* Sub-tabs & Filter Row */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50" style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex items-center gap-2">
          {SUB_TABS.map((tab) => (
            <button key={tab} onClick={() => setSubTab(tab)} className={`w-[150px] h-[26px] px-4 text-sm font-medium transition-colors ${subTab === tab ? 'bg-blue-600/10 text-blue-600' : 'text-zinc-600 hover:bg-zinc-100'}`}>{tab}</button>
          ))}
          {subTab === 'All POs' && (
            <div className="relative" ref={dropdownRef}>
              <button onClick={() => setShowStatusDropdown(!showStatusDropdown)} className="w-[150px] h-[26px] flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors">
                {statusFilter === 'All' ? 'All Statuses' : statusFilter}
                <ChevronDownIcon className="w-4 h-4" />
              </button>
              {showStatusDropdown && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1">
                  {STATUS_FILTER_OPTIONS.map((status) => (
                    <button key={status} onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }} className={`block w-full text-left px-3 py-2 text-sm transition-colors ${statusFilter === status ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'}`}>{status === 'All' ? 'All Statuses' : status}</button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-[10px]">
          <button onClick={() => navigate('/client-po/create')} className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]" style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}>Create PO</button>
          <div className="relative" ref={columnCustomizerRef}>
            <button onClick={() => setShowColumnCustomizer(!showColumnCustomizer)} className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors active:scale-[0.98]" style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}>Columns</button>
            {showColumnCustomizer && (
              <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</h3>
                  <div className="space-y-[10px]">
                    {ALL_COLUMNS.map((col) => {
                      const isMandatory = MANDATORY_COLUMNS.includes(col.id);
                      return (
                        <label key={col.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isMandatory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 cursor-pointer'}`}>
                          <input type="checkbox" checked={tempVisibleColumns.includes(col.id)} disabled={isMandatory} onChange={(e) => { if (isMandatory) return; if (e.target.checked) setVisibleColumnsTemp([...tempVisibleColumns, col.id]); else setVisibleColumnsTemp(tempVisibleColumns.filter(id => id !== col.id)); }} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                          <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
                  <button onClick={() => { setVisibleColumns(tempVisibleColumns); localStorage.setItem('po_list_columns', JSON.stringify(tempVisibleColumns)); setShowColumnCustomizer(false); }} className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors active:scale-[0.98]">Save</button>
                  <button onClick={() => { setVisibleColumnsTemp(visibleColumns); setShowColumnCustomizer(false); }} className="flex-1 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors active:scale-[0.98]">Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] px-4 text-center align-middle w-[50px] bg-white border-b border-zinc-200">
                  <input type="checkbox" checked={selectedIds.size === paginationData.currentItems.length && paginationData.currentItems.length > 0} onChange={toggleSelectAll} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                </th>
                {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                  <th key={col.id} style={{ width: col.width }} className={`sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 ${['po_total_value', 'po_utilized_value', 'po_available_value'].includes(col.id) ? 'text-right' : 'text-left'}`}>
                    {col.id === 'po_date' ? (
                      <button onClick={toggleSort} className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                        {col.label}
                        <div className="flex flex-col">
                          {!sortOrder && <ArrowUpDownIcon className="w-3 h-3 text-zinc-300 group-hover:text-zinc-400" />}
                          {sortOrder === 'asc' && <ArrowUpIcon className="w-3 h-3 text-indigo-600" />}
                          {sortOrder === 'desc' && <ArrowDownIcon className="w-3 h-3 text-indigo-600" />}
                        </div>
                      </button>
                    ) : col.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">Action</th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr><td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">Loading orders...</td></tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr><td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">No purchase orders found</td></tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginationData.currentItems.map((p: any, index) => (
                    <motion.tr
                      key={p.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ type: "spring", stiffness: 400, damping: 30, opacity: { duration: 0.2 } }}
                      className={`cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${openMenuId === p.id ? 'z-[60]' : 'z-0'} ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'} ${selectedIds.has(p.id) ? 'bg-indigo-50/50 border-l-blue-600' : ''}`}
                      onClick={() => selectedIds.size === 0 ? navigate(`/client-po/details?id=${p.id}`) : toggleSelect(p.id)}
                    >
                      <td className="px-4 py-[26px] align-middle text-center border-t border-zinc-200/70">
                        <input type="checkbox" checked={selectedIds.has(p.id)} onChange={(e) => { e.stopPropagation(); toggleSelect(p.id); }} onClick={(e) => e.stopPropagation()} className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500" />
                      </td>
                      {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                        if (col.id === 'po_date') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap border-t border-zinc-200/70">{formatDate(p.po_date)}</td>;
                        if (col.id === 'po_number') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap border-t border-zinc-200/70">{p.po_number}</td>;
                        if (col.id === 'client') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70"><div className="max-w-[300px] truncate" title={clientsMap[p.client_id] || '-'}>{clientsMap[p.client_id] || '-'}</div></td>;
                        if (col.id === 'prepared_by') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70"><div className="truncate" title={p.prepared_by || '-'}>{p.prepared_by || '-'}</div></td>;
                        if (col.id === 'status') return <td key={col.id} className="px-6 py-[26px] align-middle text-left whitespace-nowrap border-t border-zinc-200/70"><span className="text-sm font-medium" style={{ color: getStatusColor(p.status).color }}>{p.status}</span></td>;
                        if (col.id === 'po_total_value') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap tabular-nums border-t border-zinc-200/70"><div className="text-right">{formatCurrency(p.po_total_value)}</div></td>;
                        if (col.id === 'po_utilized_value') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap tabular-nums border-t border-zinc-200/70"><div className="text-right">{formatCurrency(p.po_utilized_value)}</div></td>;
                        if (col.id === 'po_available_value') return <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium whitespace-nowrap tabular-nums border-t border-zinc-200/70"><div className={`text-right ${p.po_available_value > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{formatCurrency(p.po_available_value)}</div></td>;
                        return null;
                      })}
                      <td className="px-5 pl-1 py-[26px] align-middle text-center border-t border-zinc-200/70">
                        <div className="relative inline-block" ref={openMenuId === p.id ? menuRef : null}>
                          <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === p.id ? null : p.id!); }} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"><MoreHorizontalIcon className="w-4 h-4 text-zinc-500" /></button>
                          {openMenuId === p.id && (
                            <div className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/10 ${
                              index >= paginationData.currentItems.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}>
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/client-po/details?id=${p.id}`); }} className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]" style={{ padding: '6px' }}><EyeIcon className="w-3.5 h-3.5" />View Details</button>
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/proforma-invoices/create?clientId=${p.client_id}&poId=${p.id}`); }} className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]" style={{ padding: '6px' }}><FileCheckIcon className="w-3.5 h-3.5" />Create Proforma</button>
                              <button onClick={(e) => { e.stopPropagation(); navigate(`/client-po/create?id=${p.id}`); }} className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]" style={{ padding: '6px' }}><EditIcon className="w-3.5 h-3.5" />Edit</button>
                              <div className="my-1 border-t border-zinc-100" />
                              <button onClick={(e) => { e.stopPropagation(); if(confirm('Delete this PO?')) { supabase.from('approvals').delete().eq('reference_id', p.id).then(() => supabase.from('client_purchase_orders').delete().eq('id', p.id)).then(() => queryClient.invalidateQueries({ queryKey: ['pos'] })); } }} className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.98]" style={{ padding: '6px' }}><Trash2Icon className="w-3.5 h-3.5" />Delete</button>
                            </div>
                          )}
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Footer */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">Showing {paginationData.totalItems === 0 ? 0 : paginationData.startIndex + 1} to {Math.min(paginationData.endIndex, paginationData.totalItems)} of {paginationData.totalItems} results</div>
        <div className="flex items-center gap-2">
          <button onClick={() => setCurrentPage(currentPage - 1)} disabled={!paginationData.hasPrevPage} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${paginationData.hasPrevPage ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm' : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'}`}>Previous</button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, paginationData.totalPages)) }, (_, i) => {
              const pageNum = paginationData.totalPages <= 5 ? i + 1 : (currentPage <= 3 ? i + 1 : (currentPage >= paginationData.totalPages - 2 ? paginationData.totalPages - 4 + i : currentPage - 2 + i));
              return <button key={pageNum} onClick={() => setCurrentPage(pageNum)} className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${currentPage === pageNum ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm' : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'}`}>{pageNum}</button>;
            })}
          </div>
          <button onClick={() => setCurrentPage(currentPage + 1)} disabled={!paginationData.hasNextPage} className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${paginationData.hasNextPage ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm' : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'}`}>Next</button>
        </div>
      </div>
    </div>
  );
}
