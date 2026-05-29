import React, { useMemo, useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, ClipboardList, FolderOpen, Edit, Trash2, MoreHorizontal, Eye, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../../../contexts/AuthContext';
import { 
  useApprovePurchaseRequisition, 
  useCreatePurchaseRequisition, 
  useDeletePurchaseRequisition, 
  useProcessPurchaseRequisitionApproval, 
  usePurchaseAuditLogs, 
  usePurchaseRequisitions, 
  useUpdatePurchaseRequisition 
} from '../hooks/usePurchaseQueries';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../../components/ui/select';
import { useMaterials } from '../../../hooks/useMaterials';
import { useVariants } from '../../../hooks/useVariants';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../../components/ui/dialog';

const PURPOSES = ['PROJECT', 'SITE_WORK', 'COMPANY_EXPENSE', 'MAINTENANCE', 'CAPEX', 'OTHER'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Emergency'] as const;

const STATUS_FILTER_OPTIONS = ['All', 'Draft', 'Pending', 'Approved', 'Rejected', 'Pending Approval', 'Partially Fulfilled', 'Fulfilled', 'Cancelled'] as const;

const SUB_TABS = ['All PRs', 'Drafts'];

const PRIORITY_COLORS: Record<string, string> = {
  Low: '#6b7280',
  Normal: '#2563eb',
  High: '#d97706',
  Emergency: '#dc2626',
};

const FULFILLMENT_STAGES = ['Not Started', 'PO Released', 'Partially Received', 'Completed'] as const;

const FULFILLMENT_COLORS: Record<string, { bg: string; color: string }> = {
  'Not Started':       { bg: '#f3f4f6', color: '#6b7280' },
  'PO Released':       { bg: '#dbeafe', color: '#1d4ed8' },
  'Partially Received': { bg: '#fef3c7', color: '#b45309' },
  'Completed':         { bg: '#d1fae5', color: '#047857' },
};

function getFulfillmentStage(r: any): string {
  const lines = r.lines || [];
  if (lines.length === 0) return 'Not Started';
  const allCompleted = lines.every((l: any) => Number(l.received_qty || 0) >= Number(l.requested_qty || 0));
  if (allCompleted) return 'Completed';
  const anyReceived = lines.some((l: any) => Number(l.received_qty || 0) > 0);
  if (anyReceived) return 'Partially Received';
  const anyPO = lines.some((l: any) => Number(l.po_qty || 0) > 0);
  if (anyPO) return 'PO Released';
  return 'Not Started';
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Approved:             { bg: '#d1fae5', color: '#047857' },
  Rejected:             { bg: '#fee2e2', color: '#dc2626' },
  Draft:                { bg: '#f3f4f6', color: '#6b7280' },
  Pending:              { bg: '#dbeafe', color: '#1d4ed8' },
  'Pending Approval':   { bg: '#fef3c7', color: '#b45309' },
  'Partially Fulfilled': { bg: '#fef3c7', color: '#b45309' },
  Fulfilled:            { bg: '#d1fae5', color: '#047857' },
  Cancelled:            { bg: '#f3f4f6', color: '#9ca3af' },
};

const ALL_COLUMNS = [
  { id: 'requisition_no', label: 'PR No', width: '130px' },
  { id: 'date', label: 'Date', width: '120px' },
  { id: 'requested_by', label: 'Requested By', width: '150px' },
  { id: 'purpose', label: 'Purpose', width: '140px' },
  { id: 'priority', label: 'Priority', width: '100px' },
  { id: 'lines', label: 'Lines', width: '80px' },
  { id: 'estimated_total', label: 'Est. Total', width: '130px' },
  { id: 'status', label: 'Status', width: '120px' },
  { id: 'fulfillment', label: 'Fulfillment', width: '150px' },
];

const MANDATORY_COLUMNS = ['requisition_no', 'date', 'status'];

export const Requisitions: React.FC = () => {
  const { organisation, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromContext = searchParams.get('project_id');

  const [openForm, setOpenForm] = useState(false);
  const [purposeType, setPurposeType] = useState<(typeof PURPOSES)[number]>(projectIdFromContext ? 'PROJECT' : 'COMPANY_EXPENSE');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Normal');
  const [requiredDate, setRequiredDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [projectId, setProjectId] = useState(projectIdFromContext || '');
  const [lineItems, setLineItems] = useState<Array<{ id: string; item_id: string; item_name: string; make: string; variant_id: string; variant_name: string; requested_qty: string; uom: string; estimated_rate: string }>>([
    { id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' },
  ]);

  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [viewReq, setViewReq] = useState<any | null>(null);
  const [deleteConfirmReq, setDeleteConfirmReq] = useState<any | null>(null);
  const [actionMenuReqId, setActionMenuReqId] = useState<string | null>(null);

  const { data: requisitions = [], isLoading } = usePurchaseRequisitions(organisation?.id, projectIdFromContext || null);
  const createReq = useCreatePurchaseRequisition();
  const updateReq = useUpdatePurchaseRequisition();
  const deleteReq = useDeletePurchaseRequisition();
  const { data: materials = [] } = useMaterials();
  const { data: variants = [] } = useVariants();
  const approveReq = useApprovePurchaseRequisition();
  const processReq = useProcessPurchaseRequisitionApproval();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const { data: auditLogs = [] } = usePurchaseAuditLogs(organisation?.id, selectedReqId);

  // Table state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [subTab, setSubTab] = useState('All PRs');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('requisition_list_columns');
    return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
  });
  const [tempVisibleColumns, setVisibleColumnsTemp] = useState<string[]>(visibleColumns);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);

  const menuRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  // Click outside handlers
  useEffect(() => {
    if (!openMenuId) return;
    const handleClick = (e: MouseEvent) => { if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuId(null); };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenMenuId(null); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [openMenuId]);

  useEffect(() => {
    if (!showStatusDropdown) return;
    const handleClick = (e: MouseEvent) => { if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowStatusDropdown(false); };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setShowStatusDropdown(false); };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [showStatusDropdown]);

  useEffect(() => {
    if (!showColumnCustomizer) return;
    const handleClick = (e: MouseEvent) => { if (columnCustomizerRef.current && !columnCustomizerRef.current.contains(e.target as Node)) { setShowColumnCustomizer(false); setVisibleColumnsTemp(visibleColumns); } };
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') { setShowColumnCustomizer(false); setVisibleColumnsTemp(visibleColumns); } };
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => { document.removeEventListener('mousedown', handleClick); document.removeEventListener('keydown', handleEsc); };
  }, [showColumnCustomizer, visibleColumns]);

  // Reset filters on sub-tab change
  useEffect(() => {
    if (subTab === 'Drafts') setStatusFilter('Draft');
    else setStatusFilter('All');
    setCurrentPage(1);
  }, [subTab]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, statusFilter]);

  const toggleSelectAll = () => {
    if (selectedIds.size === paginationData.currentItems.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(paginationData.currentItems.map((r: any) => r.id)));
  };

  const toggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedIds(next);
  };

  const toggleSort = () => {
    if (sortOrder === null) setSortOrder('desc');
    else if (sortOrder === 'desc') setSortOrder('asc');
    else setSortOrder(null);
  };

  // Filtering
  const filtered = useMemo(() => {
    let items = requisitions;
    if (statusFilter !== 'All') items = items.filter((r: any) => r.status === statusFilter);
    const term = searchTerm.toLowerCase();
    if (term) {
      items = items.filter((r: any) =>
        r.requisition_number?.toLowerCase().includes(term) ||
        r.purpose_type?.toLowerCase().includes(term) ||
        r.lines?.some((l: any) => (l.item_name || '').toLowerCase().includes(term))
      );
    }
    if (sortOrder) {
      items = [...items].sort((a: any, b: any) => {
        const da = new Date(a.created_at).getTime();
        const db = new Date(b.created_at).getTime();
        return sortOrder === 'asc' ? da - db : db - da;
      });
    }
    return items;
  }, [requisitions, statusFilter, searchTerm, sortOrder]);

  const stats = useMemo(() => ({
    draft: requisitions.filter((r: any) => r.status === 'Draft').length,
    pending: requisitions.filter((r: any) => r.status === 'Pending').length,
    approved: requisitions.filter((r: any) => r.status === 'Approved').length,
    totalEstimated: requisitions.reduce((sum: number, r: any) => sum + (r.lines || []).reduce((s: number, l: any) => s + Number(l.estimated_amount || 0), 0), 0),
  }), [requisitions]);

  const paginationData = useMemo(() => {
    const totalItems = filtered.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
    const safePage = Math.min(currentPage, totalPages);
    const startIdx = (safePage - 1) * itemsPerPage;
    const currentItems = filtered.slice(startIdx, startIdx + itemsPerPage);
    return { totalItems, totalPages, currentPage: safePage, startIdx, endIdx: startIdx + currentItems.length, currentItems, hasPrev: safePage > 1, hasNext: safePage < totalPages };
  }, [filtered, currentPage, itemsPerPage]);

  // Form logic (unchanged)
  const resetForm = () => {
    setOpenForm(false);
    setEditingReqId(null);
    setPurposeType(projectIdFromContext ? 'PROJECT' : 'COMPANY_EXPENSE');
    setPriority('Normal');
    setRequiredDate(new Date().toISOString().split('T')[0]);
    setProjectId(projectIdFromContext || '');
    setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setNotes('');
  };

  const handleEdit = (r: any) => {
    setEditingReqId(r.id);
    setPurposeType(r.purpose_type);
    setPriority(r.priority);
    setRequiredDate(r.required_date || new Date().toISOString().split('T')[0]);
    setNotes(r.notes || '');
    setProjectId(r.project_id || '');
    setLineItems((r.lines || []).map((l: any) => ({
      id: l.id, item_id: l.item_id || '', item_name: l.item_name,
      make: l.notes?.startsWith('Make: ') ? l.notes.replace('Make: ', '') : '',
      variant_id: l.variant_id || '', variant_name: l.variant_name || '',
      requested_qty: String(l.requested_qty), uom: l.uom || 'Nos',
      estimated_rate: l.estimated_rate != null ? String(l.estimated_rate) : '',
    })));
    if (r.lines?.length === 0) setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setOpenForm(true);
    setActionMenuReqId(null);
  };

  const handleDelete = async () => {
    if (!deleteConfirmReq) return;
    try { await deleteReq.mutateAsync(deleteConfirmReq.id); setDeleteConfirmReq(null); } catch (e) { console.error('Delete failed', e); }
  };

  const addLine = () => setLineItems(prev => [...prev, { id: String(Date.now()), item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
  const removeLine = (id: string) => setLineItems(prev => (prev.length === 1 ? prev : prev.filter(l => l.id !== id)));
  const updateLine = (id: string, field: string, value: string) => setLineItems(prev => prev.map(l => (l.id === id ? { ...l, [field]: value } : l)));

  const updateLineItem = (id: string, itemId: string) => {
    const material: any = materials.find((m: any) => m.id === itemId);
    setLineItems(prev => prev.map(l => l.id === id ? {
      ...l, item_id: itemId, item_name: material?.display_name || material?.name || '',
      make: material?.make || '', uom: material?.unit || l.uom || 'Nos',
      estimated_rate: material?.sale_price != null ? String(material.sale_price) : l.estimated_rate,
    } : l));
  };

  const updateLineVariant = (id: string, variantId: string) => {
    const variant: any = variants.find((v: any) => v.id === variantId);
    setLineItems(prev => prev.map(l => l.id === id ? { ...l, variant_id: variantId, variant_name: variant?.variant_name || '' } : l));
  };

  const submit = async (status: 'Draft' | 'Pending' = 'Pending') => {
    if (!organisation?.id) return;
    const validLines = lineItems.filter(l => l.item_name.trim() && Number(l.requested_qty) > 0).map(l => ({
      item_id: l.item_id || null, item_name: l.item_name.trim(), variant_id: l.variant_id || null,
      variant_name: l.variant_name || null, requested_qty: Number(l.requested_qty), uom: l.uom || 'Nos',
      estimated_rate: l.estimated_rate ? Number(l.estimated_rate) : null, required_date: requiredDate,
      notes: l.make ? `Make: ${l.make}` : null,
    }));
    if (validLines.length === 0) { alert('At least one valid line is required'); return; }
    if (purposeType === 'PROJECT' && !projectId) { alert('Project is required for PROJECT requisition'); return; }
    const payload = {
      organisation_id: organisation.id, status, purpose_type: purposeType,
      project_id: purposeType === 'PROJECT' ? projectId : null, required_date: requiredDate,
      priority, notes, requested_by: user?.id || null, requested_by_name: user?.email || 'User',
      source_context: projectIdFromContext ? 'PROJECT' : 'CENTRAL' as any, lines: [...validLines],
    };
    if (editingReqId) await updateReq.mutateAsync({ id: editingReqId, input: payload });
    else await createReq.mutateAsync(payload);
    resetForm();
  };

  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const getStatusStyle = (status: string) => STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#6b7280' };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Bulk Action Header */}
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
              <button onClick={() => setSelectedIds(new Set())} className="p-1 hover:bg-zinc-800 rounded-full transition-colors">
                <X className="w-5 h-5" />
              </button>
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedIds.size} items selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold leading-none">Bulk Operations Active</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">Requisitions</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {paginationData.totalItems}
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mx-1">Draft</span>
              <span className="text-xs font-medium text-zinc-700 mx-1">{stats.draft}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mx-1">Pending</span>
              <span className="text-xs font-medium text-blue-700 mx-1">{stats.pending}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider mx-1">Approved</span>
              <span className="text-xs font-medium text-emerald-700 mx-1">{stats.approved}</span>
            </div>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider mx-1">Est. Value</span>
            <span className="text-sm font-medium text-zinc-900 mx-1">{formatCurrency(stats.totalEstimated)}</span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search requisitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Sub-tabs & Filters */}
      <div
        className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50"
        style={{ paddingTop: '15px', paddingBottom: '15px' }}
      >
        <div className="flex items-center gap-2">
          {SUB_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setSubTab(tab)}
              className={`w-[150px] h-[26px] px-4 text-sm font-medium transition-colors ${
                subTab === tab ? 'bg-blue-600/10 text-blue-600' : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {tab}
            </button>
          ))}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="w-[150px] h-[26px] flex items-center justify-center gap-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
            >
              {statusFilter === 'All' ? 'All Statuses' : statusFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showStatusDropdown && (
              <div className="absolute left-0 top-full mt-1 z-50 min-w-[160px] bg-white border border-zinc-200 rounded-lg shadow-lg py-1">
                {STATUS_FILTER_OPTIONS.map((status) => (
                  <button
                    key={status}
                    onClick={() => { setStatusFilter(status); setShowStatusDropdown(false); }}
                    className={`block w-full text-left px-3 py-2 text-sm transition-colors ${
                      statusFilter === status ? 'bg-indigo-50 text-indigo-700' : 'text-zinc-700 hover:bg-zinc-50'
                    }`}
                  >
                    {status === 'All' ? 'All Statuses' : status}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => { resetForm(); setOpenForm(true); }}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Requisition
          </button>
          <div className="relative" ref={columnCustomizerRef}>
            <button
              onClick={() => setShowColumnCustomizer(!showColumnCustomizer)}
              className="inline-flex items-center justify-center text-sm font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-100 transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              Columns
            </button>
            {showColumnCustomizer && (
              <div className="absolute right-0 top-full mt-2 z-[110] w-64 bg-white border border-zinc-200 rounded-xl shadow-2xl p-4 animate-in fade-in slide-in-from-top-2 duration-200">
                <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wider mb-3">Visible Columns</h3>
                <div className="space-y-[10px]">
                  {ALL_COLUMNS.map((col) => {
                    const isMandatory = MANDATORY_COLUMNS.includes(col.id);
                    return (
                      <label key={col.id} className={`flex items-center gap-3 p-2 rounded-lg transition-colors ${isMandatory ? 'opacity-50 cursor-not-allowed' : 'hover:bg-zinc-50 cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={tempVisibleColumns.includes(col.id)}
                          disabled={isMandatory}
                          onChange={(e) => {
                            if (isMandatory) return;
                            if (e.target.checked) setVisibleColumnsTemp([...tempVisibleColumns, col.id]);
                            else setVisibleColumnsTemp(tempVisibleColumns.filter(id => id !== col.id));
                          }}
                          className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center gap-2 pt-4 border-t border-zinc-100">
                  <button
                    onClick={() => { setVisibleColumns(tempVisibleColumns); localStorage.setItem('requisition_list_columns', JSON.stringify(tempVisibleColumns)); setShowColumnCustomizer(false); }}
                    className="flex-1 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-600 transition-colors active:scale-[0.98]"
                  >Save</button>
                  <button
                    onClick={() => { setVisibleColumnsTemp(visibleColumns); setShowColumnCustomizer(false); }}
                    className="flex-1 px-3 py-1.5 bg-zinc-100 text-zinc-600 text-xs font-medium rounded-lg hover:bg-zinc-200 transition-colors active:scale-[0.98]"
                  >Cancel</button>
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
                  <input
                    type="checkbox"
                    checked={selectedIds.size === paginationData.currentItems.length && paginationData.currentItems.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                  />
                </th>
                {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => (
                  <th
                    key={col.id}
                    style={{ width: col.width }}
                    className={`sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 ${
                      ['estimated_total', 'lines'].includes(col.id) ? 'text-right' : 'text-left'
                    }`}
                  >
                    {col.id === 'date' ? (
                      <button onClick={toggleSort} className="flex items-center gap-2 hover:text-zinc-900 transition-colors group">
                        {col.label}
                        <div className="flex flex-col">
                          {!sortOrder && <ArrowUpDown className="w-3 h-3 text-zinc-300 group-hover:text-zinc-400" />}
                          {sortOrder === 'asc' && <ArrowUp className="w-3 h-3 text-indigo-600" />}
                          {sortOrder === 'desc' && <ArrowDown className="w-3 h-3 text-indigo-600" />}
                        </div>
                      </button>
                    ) : col.label}
                  </th>
                ))}
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 text-center align-middle text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {isLoading ? (
                <tr><td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">Loading requisitions...</td></tr>
              ) : paginationData.currentItems.length === 0 ? (
                <tr><td colSpan={visibleColumns.length + 2} className="px-5 py-16 text-center text-sm text-zinc-500">No requisitions found</td></tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {paginationData.currentItems.map((r: any, index) => {
                    const estTotal = (r.lines || []).reduce((s: number, l: any) => s + Number(l.estimated_amount || 0), 0);
                    const ss = getStatusStyle(r.status);
                    return (
                      <motion.tr
                        key={r.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 30, opacity: { duration: 0.2 } }}
                        className={`cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${
                          openMenuId === r.id ? 'z-50' : 'z-0'
                        } ${index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'} ${selectedIds.has(r.id) ? 'bg-indigo-50/50 border-l-blue-600' : ''}`}
                      >
                        <td className="px-4 py-[26px] align-middle text-center border-t border-zinc-200/70">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(r.id)}
                            onChange={(e) => { e.stopPropagation(); toggleSelect(r.id); }}
                            onClick={(e) => e.stopPropagation()}
                            className="w-4 h-4 rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                          />
                        </td>
                        {ALL_COLUMNS.filter(col => visibleColumns.includes(col.id)).map(col => {
                          if (col.id === 'requisition_no') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap border-t border-zinc-200/70">
                              {r.requisition_number}
                            </td>
                          );
                          if (col.id === 'date') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 whitespace-nowrap border-t border-zinc-200/70">
                              {new Date(r.created_at).toLocaleDateString('en-IN')}
                            </td>
                          );
                          if (col.id === 'requested_by') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                              {r.requested_by_name || '-'}
                            </td>
                          );
                          if (col.id === 'purpose') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                              <div className="flex items-center gap-1.5">
                                <FolderOpen className="w-3 h-3 text-zinc-400" />
                                {r.purpose_type}
                              </div>
                            </td>
                          );
                          if (col.id === 'priority') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium border-t border-zinc-200/70">
                              <span style={{ color: PRIORITY_COLORS[r.priority] || '#6b7280' }}>{r.priority}</span>
                            </td>
                          );
                          if (col.id === 'lines') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm text-zinc-800 tabular-nums text-right border-t border-zinc-200/70">
                              {r.lines?.length || 0}
                            </td>
                          );
                          if (col.id === 'estimated_total') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-sm font-medium text-zinc-900 whitespace-nowrap tabular-nums text-right border-t border-zinc-200/70">
                              {estTotal > 0 ? formatCurrency(estTotal) : '-'}
                            </td>
                          );
                          if (col.id === 'status') return (
                            <td key={col.id} className="px-6 py-[26px] align-middle text-left whitespace-nowrap border-t border-zinc-200/70">
                              <span
                                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-5"
                                style={{ backgroundColor: ss.bg, color: ss.color }}
                              >
                                {r.status}
                              </span>
                            </td>
                          );
                          if (col.id === 'fulfillment') {
                            const stage = getFulfillmentStage(r);
                            const fc = FULFILLMENT_COLORS[stage] || FULFILLMENT_COLORS['Not Started'];
                            return (
                              <td key={col.id} className="px-6 py-[26px] align-middle text-left whitespace-nowrap border-t border-zinc-200/70">
                                <span
                                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-5"
                                  style={{ backgroundColor: fc.bg, color: fc.color }}
                                >
                                  {stage}
                                </span>
                              </td>
                            );
                          }
                          return null;
                        })}
                        <td className="px-5 pl-1 py-[26px] align-middle text-center border-t border-zinc-200/70">
                          <div className="relative inline-block" ref={openMenuId === r.id ? menuRef : null}>
                            <button
                              onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === r.id ? null : r.id); }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                            </button>
                            {openMenuId === r.id && (
                              <div className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                                index >= paginationData.currentItems.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                              }`}>
                                <button
                                  onClick={(e) => { e.stopPropagation(); setViewReq(r); setOpenMenuId(null); }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                  style={{ padding: '6px' }}
                                >
                                  <Eye className="w-3.5 h-3.5" /> View Details
                                </button>
                                {(r.status === 'Draft' || r.status === 'Pending') && (
                                  <>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); handleEdit(r); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                      style={{ padding: '6px' }}
                                    >
                                      <Edit className="w-3.5 h-3.5" /> Edit
                                    </button>
                                    <button
                                      onClick={(e) => { e.stopPropagation(); setDeleteConfirmReq(r); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
                                      style={{ padding: '6px' }}
                                    >
                                      <Trash2 className="w-3.5 h-3.5" /> Delete
                                    </button>
                                  </>
                                )}
                                {(r.status === 'Pending' || r.status === 'Draft') && (
                                  <>
                                    <div className="my-1 border-t border-zinc-100" />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); approveReq.mutate({ requisitionId: r.id, actorId: user?.id || null }); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-blue-600 transition-all hover:bg-blue-50 hover:text-blue-800 font-medium active:scale-[0.98]"
                                      style={{ padding: '6px' }}
                                      disabled={approveReq.isPending}
                                    >
                                      {approveReq.isPending ? '...' : 'Quick Approve'}
                                    </button>
                                  </>
                                )}
                                {r.approval_status === 'Pending Approval' && (
                                  <>
                                    <div className="my-1 border-t border-zinc-100" />
                                    <button
                                      onClick={(e) => { e.stopPropagation(); processReq.mutate({ requisitionId: r.id, action: 'APPROVE', actorId: user?.id || null }); setOpenMenuId(null); }}
                                      className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-blue-600 transition-all hover:bg-blue-50 hover:text-blue-800 font-medium active:scale-[0.98]"
                                      style={{ padding: '6px' }}
                                      disabled={processReq.isPending}
                                    >
                                      Approve Level
                                    </button>
                                  </>
                                )}
                                <div className="my-1 border-t border-zinc-100" />
                                <button
                                  onClick={(e) => { e.stopPropagation(); setSelectedReqId(r.id); setOpenMenuId(null); }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                  style={{ padding: '6px' }}
                                >
                                  <ClipboardList className="w-3.5 h-3.5" /> Audit Log
                                </button>
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

      {/* Pagination */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing {paginationData.totalItems === 0 ? 0 : paginationData.startIdx + 1} to {paginationData.endIdx} of {paginationData.totalItems} requisitions
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(paginationData.currentPage - 1)}
            disabled={!paginationData.hasPrev}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasPrev ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm' : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >Previous</button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, paginationData.totalPages)) }, (_, i) => {
              let pageNum: number;
              if (paginationData.totalPages <= 5) pageNum = i + 1;
              else if (paginationData.currentPage <= 3) pageNum = i + 1;
              else if (paginationData.currentPage >= paginationData.totalPages - 2) pageNum = paginationData.totalPages - 4 + i;
              else pageNum = paginationData.currentPage - 2 + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                    paginationData.currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                  }`}
                >{pageNum}</button>
              );
            })}
          </div>
          <button
            onClick={() => setCurrentPage(paginationData.currentPage + 1)}
            disabled={!paginationData.hasNext}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              paginationData.hasNext ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm' : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >Next</button>
        </div>
      </div>

      {/* Audit Log Panel */}
      {selectedReqId && (
        <div className="border border-zinc-200 rounded-lg p-3 mx-6 mb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-medium text-zinc-700">Requisition Audit</div>
            <Button variant="outline" className="h-7 text-[11px]" onClick={() => setSelectedReqId(null)}>Close</Button>
          </div>
          <div className="space-y-1">
            {auditLogs.map((a: any) => (
              <div key={a.id} className="text-xs text-zinc-600">
                {new Date(a.created_at).toLocaleString('en-IN')} - {a.action}
              </div>
            ))}
            {auditLogs.length === 0 && <div className="text-xs text-zinc-500">No audit entries</div>}
          </div>
        </div>
      )}

      {/* Create/Edit Form as Dialog */}
      <Dialog open={openForm} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-zinc-800">{editingReqId ? 'Edit Requisition' : 'New Requisition'}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2">
            <div>
              <label className="text-xs text-zinc-500">Purpose</label>
              <Select value={purposeType} onValueChange={(v) => setPurposeType(v as any)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{PURPOSES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Priority</label>
              <Select value={priority} onValueChange={(v) => setPriority(v as any)}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>{PRIORITIES.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-xs text-zinc-500">Required Date</label>
              <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} className="h-8" />
            </div>
            <div className="md:col-span-3 border border-zinc-200 rounded-md p-2 space-y-2">
              <div className="text-xs font-medium text-zinc-700">Line Items</div>
              {lineItems.map((line, idx) => (
                <div key={line.id} className="grid grid-cols-12 gap-2 items-end">
                  <div className="col-span-3">
                    <label className="text-[11px] text-zinc-500">Item</label>
                    <Select value={line.item_id || 'none'} onValueChange={(v) => updateLineItem(line.id, v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Select item" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Select item</SelectItem>
                        {materials.map((m: any) => <SelectItem key={m.id} value={m.id}>{m.display_name || m.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-zinc-500">Make</label>
                    <Input value={line.make} onChange={(e) => updateLine(line.id, 'make', e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-zinc-500">Variant</label>
                    <Select value={line.variant_id || 'none'} onValueChange={(v) => updateLineVariant(line.id, v === 'none' ? '' : v)}>
                      <SelectTrigger className="h-8"><SelectValue placeholder="Variant" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No variant</SelectItem>
                        {variants.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.variant_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-[11px] text-zinc-500">Qty</label>
                    <Input type="number" value={line.requested_qty} onChange={(e) => updateLine(line.id, 'requested_qty', e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[11px] text-zinc-500">UOM</label>
                    <Input value={line.uom} onChange={(e) => updateLine(line.id, 'uom', e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-1">
                    <label className="text-[11px] text-zinc-500">Rate</label>
                    <Input type="number" value={line.estimated_rate} onChange={(e) => updateLine(line.id, 'estimated_rate', e.target.value)} className="h-8" />
                  </div>
                  <div className="col-span-1">
                    <Button variant="outline" className="h-8 w-full text-xs" onClick={() => removeLine(line.id)} disabled={idx === 0 && lineItems.length === 1}>-</Button>
                  </div>
                </div>
              ))}
              <Button type="button" variant="outline" className="h-8 text-xs" onClick={addLine}>+ Add Line</Button>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-zinc-500">Notes</label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} className="h-8" />
            </div>
            <div>
              <label className="text-xs text-zinc-500">Project ID (for PROJECT purpose)</label>
              <Input value={projectId} onChange={(e) => setProjectId(e.target.value)} disabled={!!projectIdFromContext} className="h-8" placeholder={projectIdFromContext ? 'Auto-filled from project context' : 'Enter project id'} />
            </div>
          </div>
          <DialogFooter className="flex justify-end gap-2 pt-2">
            <Button variant="outline" className="h-8 text-xs" onClick={resetForm}>Cancel</Button>
            <Button variant="outline" className="h-8 text-xs" onClick={() => submit('Draft')} disabled={createReq.isPending || updateReq.isPending}>
              {(createReq.isPending || updateReq.isPending) ? 'Saving...' : 'Save as Draft'}
            </Button>
            <Button className="h-8 text-xs" onClick={() => submit('Pending')} disabled={createReq.isPending || updateReq.isPending}>
              {(createReq.isPending || updateReq.isPending) ? 'Saving...' : editingReqId ? 'Update & Submit' : 'Create & Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Requisition Dialog */}
      {viewReq && (
        <Dialog open={!!viewReq} onOpenChange={() => setViewReq(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-zinc-900">{viewReq.requisition_number}</span>
                  <div
                    className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold leading-5"
                    style={{ backgroundColor: getStatusStyle(viewReq.status).bg, color: getStatusStyle(viewReq.status).color }}
                  >
                    {viewReq.status}
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 py-6 border-y border-zinc-100">
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Purpose</p>
                <p className="text-sm font-medium text-zinc-800">{viewReq.purpose_type}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Priority</p>
                <p className="text-sm font-medium text-zinc-800">{viewReq.priority}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Required Date</p>
                <p className="text-sm font-medium text-zinc-800">{viewReq.required_date ? new Date(viewReq.required_date).toLocaleDateString('en-IN') : '-'}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Requested By</p>
                <p className="text-sm font-medium text-zinc-800 truncate" title={viewReq.requested_by_name}>{viewReq.requested_by_name || '-'}</p>
              </div>
            </div>
            {viewReq.notes && (
              <div className="py-4 border-b border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Internal Notes</p>
                <p className="text-sm text-zinc-600 whitespace-pre-wrap bg-zinc-50 p-3 rounded-lg border border-zinc-100 italic">"{viewReq.notes}"</p>
              </div>
            )}
            <div className="py-6">
              <h3 className="text-xs font-bold text-zinc-800 uppercase tracking-tight mb-4">Requisition Items ({viewReq.lines?.length || 0})</h3>
              <div className="border border-zinc-200 rounded-xl overflow-hidden shadow-sm">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
                    <tr>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">#</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider">Item Details</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-center">Qty</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Est. Rate</th>
                      <th className="px-4 py-3 font-bold uppercase tracking-wider text-right">Est. Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {(viewReq.lines || []).map((l: any, idx: number) => (
                      <tr key={l.id} className="hover:bg-zinc-50/50">
                        <td className="px-4 py-3 text-zinc-400 font-medium">{idx + 1}</td>
                        <td className="px-4 py-3">
                          <div className="font-bold text-zinc-900">{l.item_name}</div>
                          {l.variant_name && <div className="text-[10px] text-zinc-500">Variant: {l.variant_name}</div>}
                          {l.notes && <div className="text-[10px] text-zinc-500 italic mt-0.5">{l.notes}</div>}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className="font-bold text-zinc-900">{l.requested_qty}</span>
                          <span className="ml-1 text-zinc-400 text-[10px]">{l.uom}</span>
                        </td>
                        <td className="px-4 py-3 text-right text-zinc-600">
                          {l.estimated_rate ? formatCurrency(Number(l.estimated_rate)) : '-'}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-zinc-900">
                          {l.estimated_amount ? formatCurrency(Number(l.estimated_amount)) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-zinc-50/50 border-t border-zinc-100">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 text-right font-bold text-zinc-500 uppercase tracking-widest text-[10px]">Estimated Grand Total</td>
                      <td className="px-4 py-3 text-right font-black text-zinc-900 text-sm">
                        {formatCurrency((viewReq.lines || []).reduce((s: number, l: any) => s + Number(l.estimated_amount || 0), 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            <DialogFooter className="bg-zinc-50 -mx-6 -mb-6 p-6 mt-6 border-t border-zinc-100">
              <Button variant="outline" className="h-9 px-6 font-bold uppercase tracking-tight text-[11px]" onClick={() => setViewReq(null)}>Close</Button>
              {(viewReq.status === 'Draft' || viewReq.status === 'Pending') && (
                <Button className="h-9 px-6 font-bold uppercase tracking-tight text-[11px] bg-indigo-600 hover:bg-indigo-700 shadow-md" onClick={() => handleEdit(viewReq)}>Edit Requisition</Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete Confirmation Dialog */}
      {deleteConfirmReq && (
        <Dialog open={!!deleteConfirmReq} onOpenChange={() => setDeleteConfirmReq(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-rose-600">Delete Requisition</DialogTitle>
            </DialogHeader>
            <div className="py-4">
              <p className="text-sm text-zinc-600 leading-relaxed">
                Are you sure you want to delete requisition <span className="font-bold text-zinc-900">{deleteConfirmReq.requisition_number}</span>?
                This action will also remove all associated line items and cannot be undone.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="h-9 font-bold uppercase tracking-tight text-[11px]" onClick={() => setDeleteConfirmReq(null)}>Cancel</Button>
              <Button
                className="h-9 font-bold uppercase tracking-tight text-[11px] bg-rose-600 hover:bg-rose-700"
                onClick={handleDelete}
                disabled={deleteReq.isPending}
              >
                {deleteReq.isPending ? 'Deleting...' : 'Confirm Delete'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};

export default Requisitions;
