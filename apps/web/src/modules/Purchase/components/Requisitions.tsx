import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../supabase';
import { withSessionCheck } from '../../../queryClient';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, ClipboardList, FolderOpen, Edit, Trash2, MoreHorizontal, Eye, X, ChevronDown, 
  ArrowUpDown, ArrowUp, ArrowDown, ChevronRight, Save, Send, AlertCircle, CheckCircle2, RotateCcw
} from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import { z } from 'zod';
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
import { SearchableItemSelect } from '../../../components/SearchableItemSelect';
import { DynamicTable, Column, RowAction } from '../../../components/ui/DynamicTable';
import { useMaterials } from '../../../hooks/useMaterials';
import { useVariants } from '../../../hooks/useVariants';
import { useClients } from '../../../hooks/useClients';
import { useProjects } from '../../../hooks/useProjects';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '../../../components/ui/dialog';

const PURPOSES = ['PROJECT', 'SITE_WORK', 'COMPANY_EXPENSE', 'MAINTENANCE', 'CAPEX', 'OTHER'] as const;
const PRIORITIES = ['Low', 'Normal', 'High', 'Emergency'] as const;
const DEPARTMENTS = [
  'Finance & Accounts',
  'HR & Admin',
  'IT & Infrastructure',
  'Operations & Logistics',
  'Quality Control & Safety',
  'Sales & Marketing',
  'Maintenance & Facilities',
  'Procurement & Store',
  'Management & Executive',
  'Other',
] as const;

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

// ============================================
// ZOD VALIDATION SCHEMAS
// ============================================
const requisitionLineSchema = z.object({
  item_name: z.string().min(1, 'Item name is required'),
  requested_qty: z
    .number({ invalid_type_error: 'Quantity must be a valid number' })
    .min(0.001, 'Quantity must be greater than 0'),
  uom: z.string().min(1, 'UOM is required'),
  estimated_rate: z
    .number({ invalid_type_error: 'Rate must be a number' })
    .min(0, 'Rate cannot be negative')
    .nullable()
    .optional(),
});

const requisitionFormSchema = z
  .object({
    purposeType: z.enum(PURPOSES, { required_error: 'Purpose is required' }),
    priority: z.enum(PRIORITIES, { required_error: 'Priority is required' }),
    requiredDate: z.string().min(1, 'Wanted date is required'),
    department: z.string().optional(),
    clientId: z.string().optional(),
    projectId: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(requisitionLineSchema).min(1, 'At least one line item is required'),
  })
  .refine(
    (data) => {
      if (data.purposeType === 'PROJECT' || data.purposeType === 'SITE_WORK') {
        return !!data.projectId && data.projectId.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Project is required when Purpose is SITE_WORK or PROJECT',
      path: ['projectId'],
    }
  )
  .refine(
    (data) => {
      if (data.purposeType === 'COMPANY_EXPENSE' || data.purposeType === 'MAINTENANCE') {
        return !!data.department && data.department.trim().length > 0;
      }
      return true;
    },
    {
      message: 'Department is required when Purpose is COMPANY_EXPENSE or MAINTENANCE',
      path: ['department'],
    }
  );

export const Requisitions: React.FC = () => {
  const { organisation, user } = useAuth();
  const [searchParams] = useSearchParams();
  const projectIdFromContext = searchParams.get('project_id');

  const [openForm, setOpenForm] = useState(false);
  const [purposeType, setPurposeType] = useState<(typeof PURPOSES)[number]>(projectIdFromContext ? 'PROJECT' : 'SITE_WORK');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('Normal');
  const [requiredDate, setRequiredDate] = useState(new Date().toISOString().split('T')[0]);
  const [department, setDepartment] = useState('');
  const [notes, setNotes] = useState('');
  const [clientId, setClientId] = useState('');
  const [projectId, setProjectId] = useState(projectIdFromContext || '');
  const [lineItems, setLineItems] = useState<Array<{ id: string; item_id: string; item_name: string; make: string; variant_id: string; variant_name: string; requested_qty: string; uom: string; estimated_rate: string }>>([
    { id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' },
  ]);

  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editingReqNumber, setEditingReqNumber] = useState<string>('');
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [isDraftRestored, setIsDraftRestored] = useState(false);

  const [viewReq, setViewReq] = useState<any | null>(null);
  const [deleteConfirmReq, setDeleteConfirmReq] = useState<any | null>(null);
  const [actionMenuReqId, setActionMenuReqId] = useState<string | null>(null);

  const { data: requisitions = [], isLoading } = usePurchaseRequisitions(organisation?.id, projectIdFromContext || null);
  const createReq = useCreatePurchaseRequisition();
  const updateReq = useUpdatePurchaseRequisition();
  const deleteReq = useDeletePurchaseRequisition();
  const { data: materials = [] } = useMaterials();
  const { data: variants = [] } = useVariants();
  const { data: clients = [] } = useClients();
  const { data: projects = [] } = useProjects();
  const approveReq = useApprovePurchaseRequisition();
  const processReq = useProcessPurchaseRequisitionApproval();
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const { data: auditLogs = [] } = usePurchaseAuditLogs(organisation?.id, selectedReqId);

  // Fetch item variant pricing map to dynamically filter available variants per item
  const { data: itemVariantPricing = [] } = useQuery({
    queryKey: ['item-variant-pricing', organisation?.id],
    queryFn: withSessionCheck(async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('item_variant_pricing')
        .select('item_id, company_variant_id, make, sale_price, purchase_price');
      if (error) {
        console.warn('item_variant_pricing query warning:', error);
        return [];
      }
      return data || [];
    }),
    enabled: !!organisation?.id,
  });

  // Dynamically get available variants for a selected material item
  const getItemVariants = useCallback((itemId: string) => {
    if (!itemId) return variants;

    // 1. Check if variants directly belong to this item_id
    const directVariants = variants.filter((v: any) => v.item_id === itemId);
    if (directVariants.length > 0) return directVariants;

    // 2. Check item_variant_pricing mapping
    const pricingVariantIds = itemVariantPricing
      .filter((ivp: any) => ivp.item_id === itemId)
      .map((ivp: any) => ivp.company_variant_id);

    if (pricingVariantIds.length > 0) {
      const matched = variants.filter((v: any) => pricingVariantIds.includes(v.id));
      if (matched.length > 0) return matched;
    }

    // 3. Fallback: return all company variants
    return variants;
  }, [variants, itemVariantPricing]);

  // Filter projects by selected client
  const filteredProjects = useMemo(() => {
    if (!clientId) return projects;
    return projects.filter((p: any) => p.client_id === clientId || p.client_name === clients.find((c: any) => c.id === clientId)?.client_name);
  }, [projects, clientId, clients]);

  const handleSelectProject = (pId: string) => {
    setProjectId(pId);
    if (pId) {
      const selectedProj: any = projects.find((p: any) => p.id === pId || p.project_code === pId);
      if (selectedProj?.client_id) {
        setClientId(selectedProj.client_id);
      }
    }
  };

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

  const DRAFT_KEY = useMemo(() => `pr_form_draft_${organisation?.id || 'default'}`, [organisation?.id]);

  // Auto-save local draft when creating new PR
  useEffect(() => {
    if (openForm && !editingReqId) {
      const draftData = {
        purposeType,
        priority,
        requiredDate,
        notes,
        projectId,
        lineItems,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draftData));
    }
  }, [openForm, editingReqId, purposeType, priority, requiredDate, notes, projectId, lineItems, DRAFT_KEY]);

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

  // DynamicTable column definitions adaptable based on user visible columns selection
  const tableColumns = useMemo<Column<any>[]>(() => {
    const cols: Column<any>[] = [];

    if (visibleColumns.includes('requisition_no')) {
      cols.push({
        key: 'requisition_no',
        header: 'PR No',
        width: '130px',
        accessor: 'requisition_number',
        render: (val, r) => (
          <button
            onClick={() => setViewReq(r)}
            className="font-semibold text-zinc-900 hover:text-blue-600 hover:underline cursor-pointer"
          >
            {val || r.requisition_number}
          </button>
        ),
      });
    }

    if (visibleColumns.includes('date')) {
      cols.push({
        key: 'date',
        header: (
          <div
            className="flex items-center gap-1 cursor-pointer select-none"
            onClick={toggleSort}
          >
            Date
            {sortOrder === 'asc' ? (
              <ArrowUp className="w-3.5 h-3.5 text-indigo-600" />
            ) : sortOrder === 'desc' ? (
              <ArrowDown className="w-3.5 h-3.5 text-indigo-600" />
            ) : (
              <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
            )}
          </div>
        ),
        width: '120px',
        accessor: (r) => (r.created_at ? new Date(r.created_at).toLocaleDateString('en-IN') : '-'),
      });
    }

    if (visibleColumns.includes('requested_by')) {
      cols.push({
        key: 'requested_by',
        header: 'Requested By',
        width: '150px',
        accessor: 'requested_by_name',
        render: (val) => (
          <span className="truncate max-w-[150px] inline-block" title={val}>
            {val || '-'}
          </span>
        ),
      });
    }

    if (visibleColumns.includes('purpose')) {
      cols.push({
        key: 'purpose',
        header: 'Purpose',
        width: '140px',
        accessor: 'purpose_type',
        render: (val) => <span className="font-medium text-zinc-700">{val}</span>,
      });
    }

    if (visibleColumns.includes('priority')) {
      cols.push({
        key: 'priority',
        header: 'Priority',
        width: '100px',
        accessor: 'priority',
        render: (val) => (
          <span className="font-semibold" style={{ color: PRIORITY_COLORS[val] || '#6b7280' }}>
            {val}
          </span>
        ),
      });
    }

    if (visibleColumns.includes('lines')) {
      cols.push({
        key: 'lines',
        header: 'Lines',
        width: '80px',
        align: 'center',
        accessor: (r) => r.lines?.length || 0,
        render: (val) => <span className="font-semibold text-zinc-800">{val}</span>,
      });
    }

    if (visibleColumns.includes('estimated_total')) {
      cols.push({
        key: 'estimated_total',
        header: 'Est. Total',
        width: '130px',
        align: 'left', // Strictly obeying table rule: monetary values left-aligned!
        accessor: (r) => {
          const totalEst = (r.lines || []).reduce(
            (s: number, l: any) => s + Number(l.estimated_amount || 0),
            0
          );
          return formatCurrency(totalEst);
        },
        cellStyle: { fontWeight: 600, color: '#111827' },
      });
    }

    if (visibleColumns.includes('status')) {
      cols.push({
        key: 'status',
        header: 'Status',
        width: '120px',
        accessor: 'status',
        render: (val) => {
          const style = getStatusStyle(val);
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
              style={{ backgroundColor: style.bg, color: style.color }}
            >
              {val}
            </span>
          );
        },
      });
    }

    if (visibleColumns.includes('fulfillment')) {
      cols.push({
        key: 'fulfillment',
        header: 'Fulfillment',
        width: '150px',
        accessor: (r) => getFulfillmentStage(r),
        render: (stage) => {
          const stageStyle = FULFILLMENT_COLORS[stage] || { bg: '#f3f4f6', color: '#6b7280' };
          return (
            <span
              className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ backgroundColor: stageStyle.bg, color: stageStyle.color }}
            >
              {stage}
            </span>
          );
        },
      });
    }

    return cols;
  }, [visibleColumns, sortOrder]);

  const rowActions = useMemo<RowAction<any>[]>(() => [
    {
      key: 'view',
      label: 'View Details',
      icon: <Eye className="w-3.5 h-3.5" />,
      onClick: (r) => setViewReq(r),
    },
    {
      key: 'edit',
      label: 'Edit',
      icon: <Edit className="w-3.5 h-3.5" />,
      hidden: (r) => r.status !== 'Draft' && r.status !== 'Pending',
      onClick: (r) => handleEdit(r),
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Trash2 className="w-3.5 h-3.5 text-rose-500" />,
      variant: 'danger',
      onClick: (r) => setDeleteConfirmReq(r),
    },
  ], []);


  const handlePurposeChange = (newPurpose: (typeof PURPOSES)[number]) => {
    setPurposeType(newPurpose);
    if (newPurpose === 'COMPANY_EXPENSE' || newPurpose === 'MAINTENANCE' || newPurpose === 'CAPEX' || newPurpose === 'OTHER') {
      setClientId('');
      setProjectId('');
    } else if (newPurpose === 'SITE_WORK' || newPurpose === 'PROJECT') {
      setDepartment('');
    }
  };

  const resetForm = () => {
    setOpenForm(false);
    setEditingReqId(null);
    setEditingReqNumber('');
    setFormErrors({});
    setIsDraftRestored(false);
    setPurposeType(projectIdFromContext ? 'PROJECT' : 'SITE_WORK');
    setPriority('Normal');
    setRequiredDate(new Date().toISOString().split('T')[0]);
    setDepartment('');
    setClientId('');
    setProjectId(projectIdFromContext || '');
    setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setNotes('');
  };

  const handleOpenNewForm = () => {
    resetForm();
    // Check for saved local draft
    const savedDraft = localStorage.getItem(DRAFT_KEY);
    if (savedDraft) {
      try {
        const parsed = JSON.parse(savedDraft);
        if (parsed && typeof parsed === 'object') {
          if (parsed.purposeType) setPurposeType(parsed.purposeType);
          if (parsed.priority) setPriority(parsed.priority);
          if (parsed.requiredDate) setRequiredDate(parsed.requiredDate);
          if (parsed.department) setDepartment(parsed.department);
          if (parsed.notes) setNotes(parsed.notes);
          if (parsed.clientId) setClientId(parsed.clientId);
          if (parsed.projectId) setProjectId(parsed.projectId);
          if (Array.isArray(parsed.lineItems) && parsed.lineItems.length > 0) {
            setLineItems(parsed.lineItems);
          }
          setIsDraftRestored(true);
        }
      } catch (e) {
        console.error('Failed to parse saved draft:', e);
      }
    }
    setOpenForm(true);
  };

  const handleDiscardLocalDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
    setIsDraftRestored(false);
    setPurposeType(projectIdFromContext ? 'PROJECT' : 'SITE_WORK');
    setPriority('Normal');
    setRequiredDate(new Date().toISOString().split('T')[0]);
    setDepartment('');
    setClientId('');
    setProjectId(projectIdFromContext || '');
    setLineItems([{ id: '1', item_id: '', item_name: '', make: '', variant_id: '', variant_name: '', requested_qty: '', uom: 'Nos', estimated_rate: '' }]);
    setNotes('');
  };

  const handleEdit = (r: any) => {
    setEditingReqId(r.id);
    setEditingReqNumber(r.requisition_number || '');
    setFormErrors({});
    setIsDraftRestored(false);
    setPurposeType(r.purpose_type);
    setPriority(r.priority);
    setRequiredDate(r.required_date || new Date().toISOString().split('T')[0]);
    setDepartment(r.department || '');
    setNotes(r.notes || '');
    setClientId(r.client_id || '');
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

  const updateLineItem = (id: string, itemId: string, material?: any) => {
    const mat: any = material || materials.find((m: any) => m.id === itemId);
    const availableVars = getItemVariants(itemId);

    setLineItems(prev => prev.map(l => {
      if (l.id !== id) return l;
      // Auto-validate/reset variant when item changes
      const isCurrentVarValid = availableVars.some((v: any) => v.id === l.variant_id);
      const newVarId = isCurrentVarValid ? l.variant_id : (availableVars.length === 1 ? availableVars[0].id : '');
      const newVarObj: any = variants.find((v: any) => v.id === newVarId);

      // Check variant pricing row if variant is active
      const ivp = itemVariantPricing.find((p: any) => p.item_id === itemId && p.company_variant_id === newVarId);

      return {
        ...l,
        item_id: itemId,
        item_name: mat?.display_name || mat?.name || l.item_name || '',
        make: ivp?.make || mat?.make || l.make || '',
        variant_id: newVarId,
        variant_name: newVarObj?.variant_name || '',
        uom: mat?.unit || mat?.uom || l.uom || 'Nos',
        estimated_rate: ivp?.sale_price != null ? String(ivp.sale_price) : (mat?.sale_price != null ? String(mat.sale_price) : (mat?.purchase_rate != null ? String(mat.purchase_rate) : l.estimated_rate)),
      };
    }));
  };

  const updateLineVariant = (id: string, variantId: string, itemId?: string) => {
    const variant: any = variants.find((v: any) => v.id === variantId);
    const targetItemId = itemId || lineItems.find(l => l.id === id)?.item_id;
    const ivp = itemVariantPricing.find((p: any) => p.item_id === targetItemId && p.company_variant_id === variantId);

    setLineItems(prev => prev.map(l => {
      if (l.id !== id) return l;
      return {
        ...l,
        variant_id: variantId,
        variant_name: variant?.variant_name || '',
        make: ivp?.make || l.make,
        estimated_rate: ivp?.sale_price != null ? String(ivp.sale_price) : (ivp?.purchase_price != null ? String(ivp.purchase_price) : l.estimated_rate),
      };
    }));
  };

  const validateForm = () => {
    const rawLines = lineItems.map((l) => ({
      item_name: l.item_name.trim(),
      requested_qty: l.requested_qty ? Number(l.requested_qty) : 0,
      uom: l.uom.trim(),
      estimated_rate: l.estimated_rate ? Number(l.estimated_rate) : null,
    }));

    const result = requisitionFormSchema.safeParse({
      purposeType,
      priority,
      requiredDate,
      department,
      clientId,
      projectId: projectId.trim(),
      notes,
      lines: rawLines,
    });

    if (!result.success) {
      const errors: Record<string, string> = {};
      result.error.issues.forEach((issue) => {
        const key = issue.path.join('.');
        errors[key] = issue.message;
      });
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const submit = async (status: 'Draft' | 'Pending' = 'Pending') => {
    if (!organisation?.id) return;
    
    // For Pending submit, enforce full Zod validation
    if (status === 'Pending') {
      if (!validateForm()) return;
    } else {
      // For Draft, require at least one line with name
      if (!lineItems.some(l => l.item_name.trim())) {
        setFormErrors({ general: 'Please specify at least one item name to save draft.' });
        return;
      }
    }

    const validLines = lineItems
      .filter(l => l.item_name.trim())
      .map(l => ({
        item_id: l.item_id || null, 
        item_name: l.item_name.trim(), 
        variant_id: l.variant_id || null,
        variant_name: l.variant_name || null, 
        requested_qty: Number(l.requested_qty) || 1, 
        uom: l.uom || 'Nos',
        estimated_rate: l.estimated_rate ? Number(l.estimated_rate) : null, 
        required_date: requiredDate,
        notes: l.make ? `Make: ${l.make}` : null,
      }));

    const payload = {
      organisation_id: organisation.id, 
      status, 
      purpose_type: purposeType,
      project_id: (purposeType === 'PROJECT' || purposeType === 'SITE_WORK') ? (projectId || null) : null, 
      required_date: requiredDate,
      priority, 
      notes: department ? `[Dept: ${department}] ${notes}` : notes,
      department: department || null,
      requested_by: user?.id || null, 
      requested_by_name: user?.email || 'User',
      source_context: projectIdFromContext ? 'PROJECT' : 'CENTRAL' as any, 
      lines: [...validLines],
    };

    try {
      if (editingReqId) await updateReq.mutateAsync({ id: editingReqId, input: payload });
      else await createReq.mutateAsync(payload);

      // Clear local auto-save draft upon successful submit
      localStorage.removeItem(DRAFT_KEY);
      resetForm();
    } catch (e: any) {
      console.error('Submit error:', e);
      setFormErrors({ general: e.message || 'Failed to save requisition' });
    }
  };

  const formatCurrency = (v: number) => `₹${v.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;

  const getStatusStyle = (status: string) => STATUS_COLORS[status] || { bg: '#f3f4f6', color: '#6b7280' };

  // ============================================
  // BREADCRUMB FULL-PAGE FORM VIEW (NEW & EDIT)
  // ============================================
  if (openForm) {
    return (
      <div className="flex flex-col min-h-screen bg-zinc-50/60 pb-12">
        {/* Breadcrumb Header */}
        <div className="bg-white border-b border-zinc-200 px-6 py-3 flex items-center justify-between shadow-xs sticky top-0 z-30">
          <div className="flex items-center gap-2 text-sm text-zinc-600 font-sans">
            <button
              onClick={resetForm}
              className="hover:text-zinc-900 font-medium transition-colors cursor-pointer flex items-center gap-1.5"
            >
              Requisitions
            </button>
            <ChevronRight className="w-4 h-4 text-zinc-400" />
            <span className="font-semibold text-zinc-900">
              {editingReqId ? `Edit ${editingReqNumber || 'Requisition'}` : 'New Requisition'}
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={resetForm}
              className="[font-synthesis:none] items-center flex justify-center px-3 py-1.5 rounded-lg gap-1.5 bg-white [border-width:0.8px] border-solid border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors cursor-pointer antialiased h-8"
            >
              <span className="inline-block text-[14px] leading-[142.857%] text-center w-max shrink-0 font-['Geist',system-ui,sans-serif] font-medium text-[#0A0A0A]">
                Cancel
              </span>
            </button>
            <button
              type="button"
              onClick={() => submit('Draft')}
              disabled={createReq.isPending || updateReq.isPending}
              className="[font-synthesis:none] items-center flex justify-center px-3 py-1.5 rounded-lg gap-1.5 bg-white [border-width:0.8px] border-solid border-[#E5E5E5] hover:bg-[#F5F5F5] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer antialiased h-8"
            >
              <span className="inline-block text-[14px] leading-[142.857%] text-center w-max shrink-0 font-['Geist',system-ui,sans-serif] font-medium text-[#0A0A0A]">
                {(createReq.isPending || updateReq.isPending) ? 'Saving...' : 'Save as Draft'}
              </span>
              <Save className="w-4 h-4 text-[#0A0A0A] flex-shrink-0" />
            </button>
            <button
              type="button"
              onClick={() => submit('Pending')}
              disabled={createReq.isPending || updateReq.isPending}
              className="[font-synthesis:none] items-center flex justify-center px-3.5 py-1.5 rounded-lg gap-1.5 bg-[#16A34A] [border-width:0.8px] border-solid border-[#16A34A] hover:bg-[#15803D] disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer antialiased h-8 shadow-xs"
            >
              <span className="inline-block text-[14px] leading-[142.857%] text-center w-max shrink-0 font-['Geist',system-ui,sans-serif] font-medium text-white">
                {(createReq.isPending || updateReq.isPending) ? 'Saving...' : editingReqId ? 'Update & Submit' : 'Submit Requisition'}
              </span>
              <Send className="w-4 h-4 text-white flex-shrink-0" />
            </button>
          </div>
        </div>

        <div className="max-w-6xl w-full mx-auto px-6 pt-6 space-y-6">
          {/* Unsaved draft restoration notice */}
          {isDraftRestored && !editingReqId && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 px-4 flex items-center justify-between text-xs text-amber-800">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                <span>Restored unsaved draft from your last session.</span>
              </div>
              <button
                onClick={handleDiscardLocalDraft}
                className="font-medium text-amber-700 hover:text-amber-900 underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Discard Draft
              </button>
            </div>
          )}

          {/* Form level error alert */}
          {formErrors.general && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 px-4 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{formErrors.general}</span>
            </div>
          )}

          {/* Requisition Details Card - Form Field Row Pattern (DESIGN.md) */}
          <div style={{ background: '#f8f9fa', padding: '16px', borderRadius: '6px', border: '1px solid #e5e7eb' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 24px' }}>
              {/* Column 1: Purpose, Department, Urgency/Priority & Wanted Date */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Requisition Details & Urgency
                </div>
                
                {/* Purpose */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>Purpose:</span>
                  <div style={{ flex: 1 }}>
                    <select
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none cursor-pointer"
                      value={purposeType}
                      onChange={(e) => handlePurposeChange(e.target.value as any)}
                    >
                      {PURPOSES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formErrors.purposeType && <p style={{ fontSize: '10px', color: '#ef4444', marginLeft: '103px', marginTop: '-4px', marginBottom: '4px' }}>{formErrors.purposeType}</p>}

                {/* Department Dropdown (Active for COMPANY_EXPENSE or MAINTENANCE) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>
                    Department: {(purposeType === 'COMPANY_EXPENSE' || purposeType === 'MAINTENANCE') && <span className="text-red-500">*</span>}
                  </span>
                  <div style={{ flex: 1 }}>
                    <select
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      disabled={purposeType !== 'COMPANY_EXPENSE' && purposeType !== 'MAINTENANCE'}
                    >
                      <option value="">-- Select Department --</option>
                      {DEPARTMENTS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formErrors.department && <p style={{ fontSize: '10px', color: '#ef4444', marginLeft: '103px', marginTop: '-4px', marginBottom: '4px' }}>{formErrors.department}</p>}

                {/* Execution Urgency / Priority */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>Urgency:</span>
                  <div style={{ flex: 1 }}>
                    <select
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none cursor-pointer"
                      value={priority}
                      onChange={(e) => setPriority(e.target.value as any)}
                    >
                      {PRIORITIES.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formErrors.priority && <p style={{ fontSize: '10px', color: '#ef4444', marginLeft: '103px', marginTop: '-4px', marginBottom: '4px' }}>{formErrors.priority}</p>}

                {/* Wanted Date (On-Site Required Date) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>Wanted Date:</span>
                  <div style={{ flex: 1 }}>
                    <input
                      type="date"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none"
                      value={requiredDate}
                      onChange={(e) => setRequiredDate(e.target.value)}
                    />
                  </div>
                </div>
                {formErrors.requiredDate && <p style={{ fontSize: '10px', color: '#ef4444', marginLeft: '103px', marginTop: '-4px', marginBottom: '4px' }}>{formErrors.requiredDate}</p>}
              </div>

              {/* Column 2: Client, Project & Justification */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ fontWeight: 600, fontSize: '11px', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                  Client & Project Details
                </div>

                {/* Client Dropdown (Greyed out for Company Expense / Maintenance) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>Client:</span>
                  <div style={{ flex: 1 }}>
                    <select
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                      value={clientId}
                      onChange={(e) => setClientId(e.target.value)}
                      disabled={purposeType !== 'SITE_WORK' && purposeType !== 'PROJECT'}
                    >
                      <option value="">-- All / Select Client --</option>
                      {clients.map((c: any) => (
                        <option key={c.id} value={c.id}>{c.client_name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Project Selection (Greyed out for Company Expense / Maintenance) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>
                    Project: {(purposeType === 'PROJECT' || purposeType === 'SITE_WORK') && <span className="text-red-500">*</span>}
                  </span>
                  <div style={{ flex: 1 }}>
                    <select
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none cursor-pointer disabled:bg-zinc-100 disabled:text-zinc-400 disabled:cursor-not-allowed"
                      value={projectId}
                      onChange={(e) => handleSelectProject(e.target.value)}
                      disabled={purposeType !== 'SITE_WORK' && purposeType !== 'PROJECT' || !!projectIdFromContext}
                    >
                      <option value="">-- Select Project --</option>
                      {filteredProjects.map((p: any) => (
                        <option key={p.id} value={p.id}>{p.project_name || p.name || p.project_code} ({p.project_code || 'PRJ'})</option>
                      ))}
                    </select>
                  </div>
                </div>
                {formErrors.projectId && <p style={{ fontSize: '10px', color: '#ef4444', marginLeft: '103px', marginTop: '-4px', marginBottom: '4px' }}>{formErrors.projectId}</p>}

                {/* Notes / Justification */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', textAlign: 'right' }}>Notes:</span>
                  <div style={{ flex: 1 }}>
                    <input
                      type="text"
                      style={{ padding: '4px 8px', fontSize: '12px' }}
                      className="border border-zinc-200 w-full bg-white hover:border-zinc-400 focus:ring-2 focus:ring-[#185FA5]/20 focus:border-[#185FA5] rounded-md outline-none"
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Optional notes or justification..."
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Requested Line Items Card - Excel-Style Grid (CreateQuotationV2) */}
          <div className="bg-white border border-zinc-200 rounded-xl p-5 shadow-xs space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xs font-semibold text-zinc-700 uppercase tracking-wider">Requested Line Items</h2>
                <p className="text-[11px] text-zinc-500">Excel-style grid: Select items from master or enter custom materials</p>
              </div>
              <button
                type="button"
                onClick={addLine}
                className="[font-synthesis:none] items-center flex justify-center px-2.5 py-1 rounded-lg gap-1.5 bg-white [border-width:0.8px] border-solid border-[#E5E5E5] hover:bg-[#F5F5F5] transition-colors cursor-pointer antialiased h-7"
              >
                <Plus className="w-3.5 h-3.5 text-[#0A0A0A] flex-shrink-0" />
                <span className="inline-block text-[12px] font-medium text-[#0A0A0A]">
                  Add Row
                </span>
              </button>
            </div>

            {formErrors.lines && <p className="text-xs text-red-600">{formErrors.lines}</p>}

            <div style={{ border: '1px solid #cbd5e1', borderRadius: '4px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                <thead>
                  <tr style={{ background: '#f8fafc', borderBottom: '1px solid #cbd5e1', color: '#475569', height: '28px' }}>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '36px', textAlign: 'center', fontWeight: 600 }}>#</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '240px', textAlign: 'left', fontWeight: 600 }}>Item Name *</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '130px', textAlign: 'left', fontWeight: 600 }}>Make / Brand</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '140px', textAlign: 'left', fontWeight: 600 }}>Variant</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '85px', textAlign: 'right', fontWeight: 600 }}>Qty *</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '80px', textAlign: 'left', fontWeight: 600 }}>UOM</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '100px', textAlign: 'right', fontWeight: 600 }}>Est. Rate (₹)</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '110px', textAlign: 'right', fontWeight: 600 }}>Est. Total (₹)</th>
                    <th style={{ border: '1px solid #cbd5e1', padding: '4px 6px', width: '36px', textAlign: 'center', fontWeight: 600 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {lineItems.map((line, idx) => {
                    const qtyNum = Number(line.requested_qty) || 0;
                    const rateNum = Number(line.estimated_rate) || 0;
                    const subtotal = qtyNum * rateNum;

                    return (
                      <tr key={line.id} style={{ height: '28px' }}>
                        {/* Serial Number */}
                        <td style={{ border: '1px solid #cbd5e1', textAlign: 'center', background: '#f8fafc', color: '#64748b', fontWeight: 500 }}>
                          {idx + 1}
                        </td>

                        {/* Searchable Item Dropdown / Custom Name */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff', verticalAlign: 'top' }}>
                          <SearchableItemSelect
                            materials={materials}
                            value={line.item_id}
                            onChange={(id, mat) => updateLineItem(line.id, id, mat)}
                            placeholder="Select item..."
                          />
                          {!line.item_id && (
                            <input
                              type="text"
                              style={{ width: '100%', height: '24px', border: 'none', borderTop: '1px solid #e2e8f0', padding: '2px 6px', fontSize: '11px', outline: 'none', background: '#fff' }}
                              value={line.item_name}
                              onChange={(e) => updateLine(line.id, 'item_name', e.target.value)}
                              placeholder="Or enter custom item name..."
                            />
                          )}
                          {formErrors[`lines.${idx}.item_name`] && (
                            <p style={{ fontSize: '10px', color: '#ef4444', padding: '1px 6px' }}>{formErrors[`lines.${idx}.item_name`]}</p>
                          )}
                        </td>

                        {/* Make / Brand */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff' }}>
                          <input
                            type="text"
                            style={{ width: '100%', height: '100%', border: 'none', padding: '2px 6px', fontSize: '11px', outline: 'none', background: 'transparent' }}
                            value={line.make}
                            onChange={(e) => updateLine(line.id, 'make', e.target.value)}
                            placeholder="Make / Brand"
                          />
                        </td>

                        {/* Dynamic Variant Dropdown per selected Item */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff' }}>
                          {(() => {
                            const itemVars = getItemVariants(line.item_id);
                            return (
                              <select
                                style={{ width: '100%', height: '100%', border: 'none', padding: '2px 4px', fontSize: '11px', outline: 'none', background: 'transparent', cursor: 'pointer' }}
                                value={line.variant_id || ''}
                                onChange={(e) => updateLineVariant(line.id, e.target.value, line.item_id)}
                              >
                                <option value="">
                                  {!line.item_id ? '-- Select item first --' : (itemVars.length > 0 ? 'No variant' : 'No variants available')}
                                </option>
                                {itemVars.map((v: any) => (
                                  <option key={v.id} value={v.id}>{v.variant_name}</option>
                                ))}
                              </select>
                            );
                          })()}
                        </td>

                        {/* Qty */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff' }}>
                          <input
                            type="number"
                            step="any"
                            style={{ width: '100%', height: '100%', border: 'none', padding: '2px 6px', fontSize: '11px', textAlign: 'right', outline: 'none', background: 'transparent' }}
                            value={line.requested_qty}
                            onChange={(e) => updateLine(line.id, 'requested_qty', e.target.value)}
                            placeholder="0"
                          />
                          {formErrors[`lines.${idx}.requested_qty`] && (
                            <p style={{ fontSize: '10px', color: '#ef4444', padding: '1px 6px', textAlign: 'right' }}>
                              {formErrors[`lines.${idx}.requested_qty`]}
                            </p>
                          )}
                        </td>

                        {/* UOM */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff' }}>
                          <input
                            type="text"
                            style={{ width: '100%', height: '100%', border: 'none', padding: '2px 6px', fontSize: '11px', outline: 'none', background: 'transparent' }}
                            value={line.uom}
                            onChange={(e) => updateLine(line.id, 'uom', e.target.value)}
                            placeholder="Nos"
                          />
                        </td>

                        {/* Est. Rate */}
                        <td style={{ border: '1px solid #cbd5e1', padding: 0, background: '#fff' }}>
                          <input
                            type="number"
                            step="any"
                            style={{ width: '100%', height: '100%', border: 'none', padding: '2px 6px', fontSize: '11px', textAlign: 'right', outline: 'none', background: 'transparent' }}
                            value={line.estimated_rate}
                            onChange={(e) => updateLine(line.id, 'estimated_rate', e.target.value)}
                            placeholder="0.00"
                          />
                        </td>

                        {/* Est. Total */}
                        <td style={{ border: '1px solid #cbd5e1', padding: '4px 6px', textAlign: 'right', fontWeight: 500, color: '#1e293b', background: '#f8fafc' }}>
                          {formatCurrency(subtotal)}
                        </td>

                        {/* Delete row */}
                        <td style={{ border: '1px solid #cbd5e1', textAlign: 'center', background: '#fff' }}>
                          <button
                            type="button"
                            onClick={() => removeLine(line.id)}
                            disabled={lineItems.length === 1}
                            style={{
                              border: 'none',
                              background: 'transparent',
                              cursor: lineItems.length === 1 ? 'not-allowed' : 'pointer',
                              opacity: lineItems.length === 1 ? 0.3 : 0.7,
                              padding: '2px',
                            }}
                            title="Remove row"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-red-500" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr style={{ background: '#f1f5f9', borderTop: '2px solid #cbd5e1', height: '30px' }}>
                    <td colSpan={7} style={{ border: '1px solid #cbd5e1', padding: '4px 8px', textAlign: 'right', fontWeight: 600, fontSize: '11px', color: '#334155' }}>
                      Total Estimated Requisition Amount:
                    </td>
                    <td style={{ border: '1px solid #cbd5e1', padding: '4px 8px', textAlign: 'right', fontWeight: 700, fontSize: '12px', color: '#16a34a' }}>
                      {formatCurrency(
                        lineItems.reduce(
                          (sum, l) => sum + (Number(l.requested_qty) || 0) * (Number(l.estimated_rate) || 0),
                          0
                        )
                      )}
                    </td>
                    <td style={{ border: '1px solid #cbd5e1' }}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // REQUISITIONS LIST VIEW
  // ============================================
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
              {filtered.length}
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
            onClick={handleOpenNewForm}
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
                          className="rounded border-zinc-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <span className="text-sm font-medium text-zinc-700">{col.label}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-3 border-t border-zinc-100">
                  <button
                    onClick={() => { setVisibleColumns(tempVisibleColumns); localStorage.setItem('requisition_list_columns', JSON.stringify(tempVisibleColumns)); setShowColumnCustomizer(false); }}
                    className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 transition-colors"
                  >
                    Apply
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Requisitions Table (Refactored to DynamicTable) */}
      <div className="flex-1 p-4 overflow-hidden">
        <DynamicTable
          columns={tableColumns}
          data={filtered}
          actions={rowActions}
          enableRowSelection={true}
          selectedRowKeys={Array.from(selectedIds)}
          onSelectionChange={(_rows, keys) => {
            setSelectedIds(new Set(keys.map(String)));
          }}
          loading={isLoading}
          pageSize={15}
          enablePagination={true}
          hoverable={true}
          stickyHeader={true}
          getRowKey={(r) => r.id}
          emptyText="No requisitions found."
        />
      </div>


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
