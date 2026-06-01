import { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronRight, ArrowLeft, Edit, Trash2, Folder,
  TrendingUp, Clock, DollarSign, MoreHorizontal, X,
  ChevronDown, ChevronUp, Link2, AlertTriangle, FilePlus2,
} from 'lucide-react';
import ProjectTaskListView from '../components/tasks/ProjectTaskListView';
import CreateProjectInvoiceModal from '../components/CreateProjectInvoiceModal';
import {
  useProjectTransactions,
  buildProjectTransactionSummary,
  type ProjectInvoice,
} from '../hooks/useProjectTransactions';
import { useAuth } from '../App';

// ─── Types ────────────────────────────────────────────────────────────────────

type Project = {
  id: string;
  project_name?: string;
  project_code?: string;
  project_type?: string;
  project_estimated_value?: number;
  po_required?: boolean;
  po_status?: string;
  status?: string;
  completion_percentage?: number;
  start_date?: string;
  expected_end_date?: string;
  actual_end_date?: string;
  remarks?: string;
  client?: { client_name?: string } | null;
  client_id?: string;
  organisation_id?: string;
  pos?: Array<{ po_total_value?: number }>;
};

type ProjectDetails = {
  pos: any[];
  invoices: any[];
  expenses: any[];
  payments: any[];
};

// ─── Status Config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  Draft:                { dot: '#94a3b8', label: 'Draft' },
  Active:               { dot: '#10b981', label: 'Active' },
  'Execution Completed':{ dot: '#f59e0b', label: 'Execution' },
  'Financially Closed': { dot: '#6366f1', label: 'Financially Closed' },
  Closed:               { dot: '#64748b', label: 'Closed' },
};

const PO_STATUS_CONFIG: Record<string, { dot: string; label: string }> = {
  'Not Required': { dot: '#10b981', label: 'Not Required' },
  Pending:        { dot: '#f59e0b', label: 'Pending' },
  Received:       { dot: '#3b82f6', label: 'Received' },
};

const STATUS_FILTER_OPTIONS = ['All', 'Active', 'Execution Completed', 'Financially Closed', 'Closed', 'Draft'];
const PROJECT_STATUS_STATS = ['Active', 'Draft', 'Closed'];

const MANDATORY_COLUMNS = ['project', 'actions'];
const ALL_COLUMNS = [
  { id: 'project', label: 'Project' },
  { id: 'client', label: 'Client' },
  { id: 'type', label: 'Type' },
  { id: 'est_value', label: 'Est. Value' },
  { id: 'po_value', label: 'PO Value' },
  { id: 'po_status', label: 'PO Status' },
  { id: 'status', label: 'Status' },
  { id: 'completion', label: 'Completion' },
  { id: 'actions', label: 'Action' },
];

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [activeTab, setActiveTab] = useState('summary');
  const [statusFilter, setStatusFilter] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [showColumnCustomizer, setShowColumnCustomizer] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<string[]>(() => {
    const saved = localStorage.getItem('project_list_columns');
    return saved ? JSON.parse(saved) : ALL_COLUMNS.map(c => c.id);
  });
  const [tempVisibleColumns, setTempVisibleColumns] = useState<string[]>(visibleColumns);
  const [activeTransactionTab, setActiveTransactionTab] = useState<'po-utilization' | 'pos' | 'invoices' | 'payments'>('po-utilization');
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<
    | { open: false }
    | { open: true; mode: 'create' | 'edit'; invoice?: ProjectInvoice | null; defaultPoId?: string | null }
  >({ open: false });
  const itemsPerPage = 20;

  const menuRef = useRef<HTMLDivElement>(null);
  const columnCustomizerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showColumnCustomizer) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (columnCustomizerRef.current && !columnCustomizerRef.current.contains(event.target as Node)) {
        setShowColumnCustomizer(false);
        setTempVisibleColumns(visibleColumns);
      }
    };
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowColumnCustomizer(false);
        setTempVisibleColumns(visibleColumns);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [showColumnCustomizer, visibleColumns]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects', organisation?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(id, client_name), pos:client_purchase_orders(po_total_value)')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!organisation?.id,
    staleTime: 30 * 1000,
  });

  const { data: projectDetails, isLoading: detailsLoading } = useQuery<ProjectDetails>({
    queryKey: ['project-details', selectedProject?.id],
    queryFn: async () => {
      const [posResult, invoicesResult, expensesResult, paymentsResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('project_id', selectedProject!.id),
        supabase.from('project_invoices').select('*').eq('project_id', selectedProject!.id).eq('organisation_id', organisation?.id).order('invoice_date', { ascending: false }),
        supabase.from('project_expenses').select('*').eq('project_id', selectedProject!.id).eq('organisation_id', organisation?.id).order('expense_date', { ascending: false }),
        supabase.from('project_payments').select('*').eq('project_id', selectedProject!.id).eq('organisation_id', organisation?.id).order('payment_date', { ascending: false }),
      ]);
      if (posResult.error) throw posResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      return {
        pos: posResult.data ?? [],
        invoices: invoicesResult.data ?? [],
        expenses: expensesResult.data ?? [],
        payments: paymentsResult.data ?? [],
      };
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
    staleTime: 30 * 1000,
  });

  const projectPOs = projectDetails?.pos ?? [];
  const projectInvoices = projectDetails?.invoices ?? [];
  const projectExpenses = projectDetails?.expenses ?? [];
  const projectPayments = projectDetails?.payments ?? [];

  // Linked transaction view: POs joined with their invoices (per-PO utilization).
  const { data: linkedData, isLoading: linkedLoading } = useProjectTransactions(
    viewMode === 'detail' ? selectedProject?.id : null,
  );
  const linkedSummary = useMemo(() => {
    if (!linkedData) return null;
    return buildProjectTransactionSummary(linkedData.pos, linkedData.invoices);
  }, [linkedData]);

  const financialSummary = useMemo(() => {
    if (!projectDetails) return null;
    const totalPOValue = projectPOs.reduce((s, p) => s + (parseFloat(p.po_total_value) || 0), 0);
    const totalInvoiceValue = projectInvoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const totalPaymentReceived = projectPayments.reduce((s, p) => s + (parseFloat(p.payment_amount) || 0), 0);
    const totalExpense = projectExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return {
      total_po_value: totalPOValue,
      total_invoice_value: totalInvoiceValue,
      total_payment_received: totalPaymentReceived,
      total_expense: totalExpense,
      outstanding_amount: totalInvoiceValue - totalPaymentReceived,
      profit: totalInvoiceValue - totalExpense,
      po_balance: totalPOValue - totalInvoiceValue,
    };
  }, [projectDetails]);

  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return projects.filter(p => {
      const matchesSearch =
        (p.project_name ?? '').toLowerCase().includes(q) ||
        (p.project_code ?? '').toLowerCase().includes(q) ||
        (p.client?.client_name ?? '').toLowerCase().includes(q);
      const matchesStatus = statusFilter === 'All' || p.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchTerm, statusFilter]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const st: Record<string, number> = { All: projects.length };
    PROJECT_STATUS_STATS.forEach(s => {
      st[s] = projects.filter(p => p.status === s).length;
    });
    return st;
  }, [projects]);

  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, filteredProjects.length);
  const currentItems = filteredProjects.slice(startIndex, endIndex);

  const deleteProject = async (id: string) => {
    const [posRes, invoicesRes, expensesRes, paymentsRes] = await Promise.all([
      supabase.from('client_purchase_orders').select('id').eq('project_id', id),
      supabase.from('project_invoices').select('id').eq('project_id', id),
      supabase.from('project_expenses').select('id').eq('project_id', id),
      supabase.from('project_payments').select('id').eq('project_id', id),
    ]);
    if (
      (posRes.data?.length ?? 0) > 0 ||
      (invoicesRes.data?.length ?? 0) > 0 ||
      (expensesRes.data?.length ?? 0) > 0 ||
      (paymentsRes.data?.length ?? 0) > 0
    ) {
      alert('Cannot delete project: Related records exist');
      return;
    }
    if (!confirm('Are you sure you want to delete this project?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) { alert('Error deleting project: ' + error.message); return; }
    setSelectedProject(null);
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  };

  const checkPORequiredWarning = (p: Project) =>
    p.po_required && p.po_status !== 'Received' && p.po_status !== 'Not Required';

  const loadProjectDetails = (project: Project) => {
    setSelectedProject(project);
    setViewMode('detail');
    setCurrentPage(1);
  };

  const fmt = (n: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const fmtD = (d?: string | null) => { if (!d) return '-'; const x = new Date(d); return isNaN(x.getTime()) ? '-' : x.toLocaleDateString(); };

  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-zinc-500">
        Loading projects...
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW (preserved as-is)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (viewMode === 'detail' && selectedProject) {
    const tabs = [
      { id: 'summary', label: 'Summary' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'expenses', label: 'Expenses' },
    ];

    const transactionSubTabs: Array<{ id: 'po-utilization' | 'pos' | 'invoices' | 'payments'; label: string; count: number }> = [
      { id: 'po-utilization', label: 'PO Utilization', count: projectPOs.length },
      { id: 'pos', label: 'POs', count: projectPOs.length },
      { id: 'invoices', label: 'Invoices', count: projectInvoices.length },
      { id: 'payments', label: 'Payments', count: projectPayments.length },
    ];

    return (
      <div className="pl-page">
        <div className="pl-container">
          <div className="pl-detail-header" style={{ padding: '0.5rem 1rem', gap: '0.75rem' }}>
            <button className="pl-btn-icon" onClick={() => { setViewMode('list'); setSelectedProject(null); }}>
              <ArrowLeft size={18} />
            </button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
              <h1 className="pl-detail-title" style={{ fontSize: '18px', margin: 0 }}>{selectedProject.project_name}</h1>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{selectedProject.project_code}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  className={`pl-tab ${activeTab === tab.id ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <button className="pl-btn pl-btn-primary" onClick={() => navigate(`/projects/edit?id=${selectedProject.id}`)}>
              <Edit size={14} />
              Edit
            </button>
          </div>

          {activeTab === 'summary' && (
            <>
              <div className="pl-summary-grid">
                <div className="pl-summary-card">
                  <h3 className="pl-summary-title">Commercial</h3>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Client</span>
                    <span className="pl-summary-value">{selectedProject.client?.client_name || '-'}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Type</span>
                    <span className="pl-summary-value">{selectedProject.project_type || '-'}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Est. Value</span>
                    <span className="pl-summary-value">{selectedProject.project_estimated_value ? fmt(selectedProject.project_estimated_value) : '-'}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">PO Status</span>
                    <span className="pl-summary-value">{selectedProject.po_status || 'Pending'}</span>
                  </div>
                </div>

                <div className="pl-summary-card">
                  <h3 className="pl-summary-title">Execution</h3>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Status</span>
                    <span className="pl-summary-value">{selectedProject.status || 'Draft'}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Start Date</span>
                    <span className="pl-summary-value">{fmtD(selectedProject.start_date)}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">End Date</span>
                    <span className="pl-summary-value">{fmtD(selectedProject.expected_end_date)}</span>
                  </div>
                  <div className="pl-summary-row">
                    <span className="pl-summary-label">Completion</span>
                    <span className="pl-summary-value">{selectedProject.completion_percentage || 0}%</span>
                  </div>
                </div>
              </div>

              <div className="pl-card" style={{ padding: '1.25rem' }}>
                <h3 className="pl-summary-title" style={{ marginBottom: '1rem' }}>Financial Overview</h3>
                <div className="pl-financial-grid">
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">PO Value</div>
                    <div className="pl-financial-value">{fmt(financialSummary?.total_po_value)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Invoice</div>
                    <div className="pl-financial-value">{fmt(financialSummary?.total_invoice_value)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Payments</div>
                    <div className="pl-financial-value positive">{fmt(financialSummary?.total_payment_received)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Expenses</div>
                    <div className="pl-financial-value negative">{fmt(financialSummary?.total_expense)}</div>
                  </div>
                </div>
              </div>
            </>
          )}

          {activeTab === 'transactions' && (
            <div>
              {/* Transactions Summary */}
              <div className="pl-card" style={{ padding: '1.25rem', marginBottom: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 className="pl-summary-title" style={{ margin: 0 }}>Transaction Summary</h3>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="pl-btn pl-btn-primary"
                      onClick={() => navigate(`/client-po/create?project_id=${selectedProject.id}`)}
                    >
                      <Plus size={16} />
                      Create PO
                    </button>
                    <button
                      className="pl-btn"
                      onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: null })}
                      style={{
                        background: '#fff',
                        color: 'var(--text-primary)',
                        border: '1px solid var(--border)',
                      }}
                    >
                      <FilePlus2 size={16} />
                      Create Invoice
                    </button>
                  </div>
                </div>
                <div className="pl-financial-grid">
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Total POs</div>
                    <div className="pl-financial-value">{projectPOs.length}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">PO Value</div>
                    <div className="pl-financial-value">{fmt(linkedSummary?.totalPOValue ?? financialSummary?.total_po_value)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Invoice Utilised</div>
                    <div
                      className="pl-financial-value"
                      title="Sum of invoices linked to POs (auto-tracked via trigger)"
                      style={{ color: 'var(--accent, #2563eb)' }}
                    >
                      {fmt(linkedSummary?.totalUtilized)}
                    </div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Unlinked Invoices</div>
                    <div
                      className="pl-financial-value"
                      title="Invoices without a PO link"
                      style={{ color: linkedSummary && linkedSummary.invoicedWithoutPO > 0 ? '#d97706' : undefined }}
                    >
                      {fmt(linkedSummary?.invoicedWithoutPO)}
                    </div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">PO Balance</div>
                    <div className="pl-financial-value">{fmt(linkedSummary?.poBalance ?? financialSummary?.po_balance)}</div>
                  </div>
                </div>
              </div>

              {/* Transaction Sub-Tabs (NOW FUNCTIONAL) */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0', flexWrap: 'wrap' }}>
                {transactionSubTabs.map(subTab => {
                  const isActive = activeTransactionTab === subTab.id;
                  return (
                    <button
                      key={subTab.id}
                      onClick={() => setActiveTransactionTab(subTab.id)}
                      style={{
                        padding: '0.5rem 1rem',
                        borderRadius: '0.5rem',
                        fontSize: '0.875rem',
                        fontWeight: 500,
                        cursor: 'pointer',
                        border: '1px solid var(--border)',
                        background: isActive ? 'var(--accent, #2563eb)' : 'white',
                        color: isActive ? 'white' : 'var(--text-primary)',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {subTab.label} ({subTab.count})
                    </button>
                  );
                })}
              </div>

              {/* ── PO Utilization (linked view) ── */}
              {activeTransactionTab === 'po-utilization' && (
                <div className="pl-card">
                  <div
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid var(--border)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '0.5rem',
                    }}
                  >
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>PO → Invoice Utilization</h3>
                      <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Each PO tracks its own invoiced value. Click a row to see the linked invoices.
                      </p>
                    </div>
                  </div>
                  {linkedLoading ? (
                    <div className="pl-empty">Loading…</div>
                  ) : !linkedSummary || linkedSummary.perPO.length === 0 ? (
                    <div className="pl-empty">
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No purchase orders found. Create a PO to start tracking utilization.</p>
                    </div>
                  ) : (
                    <table className="pl-table">
                      <thead>
                        <tr>
                          <th style={{ width: 32 }}></th>
                          <th>PO Number</th>
                          <th>Date</th>
                          <th style={{ textAlign: 'right' }}>PO Value</th>
                          <th style={{ textAlign: 'right' }}>Invoice Utilised</th>
                          <th style={{ textAlign: 'right' }}>Balance</th>
                          <th style={{ minWidth: 140 }}>Utilization</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {linkedSummary.perPO.map(({ po, invoiced, available, utilizationPct, overInvoiced, invoices: linkedInvoices }) => {
                          const isExpanded = expandedPoId === po.id;
                          const poTotal = Number(po.po_total_value) || 0;
                          const statusCfg = PO_STATUS_CONFIG[po.status as keyof typeof PO_STATUS_CONFIG];
                          const statusColor = statusCfg?.dot || '#94a3b8';
                          return (
                            <>
                              <tr
                                key={po.id}
                                onClick={() => setExpandedPoId(isExpanded ? null : po.id)}
                                style={{ cursor: 'pointer' }}
                              >
                                <td style={{ color: 'var(--text-muted)' }}>
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </td>
                                <td style={{ fontWeight: 500 }}>{po.po_number}</td>
                                <td style={{ color: 'var(--text-secondary)' }}>{fmtD(po.po_date)}</td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, textAlign: 'right' }}>
                                  {fmt(poTotal)}
                                </td>
                                <td
                                  style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontWeight: 500,
                                    textAlign: 'right',
                                    color: overInvoiced ? '#dc2626' : 'var(--accent, #2563eb)',
                                  }}
                                  title={overInvoiced ? 'Invoiced exceeds PO total' : 'Sum of linked invoices'}
                                >
                                  {fmt(invoiced)}
                                </td>
                                <td
                                  style={{
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontWeight: 500,
                                    textAlign: 'right',
                                    color: available < 0 ? '#dc2626' : 'var(--text-primary)',
                                  }}
                                >
                                  {fmt(available)}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <div
                                      style={{
                                        flex: 1,
                                        height: 6,
                                        background: '#f1f5f9',
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: `${utilizationPct}%`,
                                          height: '100%',
                                          background: overInvoiced
                                            ? '#dc2626'
                                            : utilizationPct >= 90
                                              ? '#d97706'
                                              : 'var(--accent, #2563eb)',
                                          transition: 'width 0.3s ease',
                                        }}
                                      />
                                    </div>
                                    <span
                                      style={{
                                        fontFamily: 'JetBrains Mono, monospace',
                                        fontSize: '0.75rem',
                                        color: 'var(--text-muted)',
                                        minWidth: 32,
                                        textAlign: 'right',
                                      }}
                                    >
                                      {utilizationPct}%
                                    </span>
                                  </div>
                                </td>
                                <td>
                                  <span className="pl-status">
                                    <span className="pl-status-dot" style={{ background: statusColor }} />
                                    {po.status || 'Pending'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                                  <button
                                    className="pl-btn"
                                    onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: po.id })}
                                    style={{
                                      background: 'var(--accent, #2563eb)',
                                      color: '#fff',
                                      border: 'none',
                                      padding: '0.375rem 0.625rem',
                                      borderRadius: '0.375rem',
                                      fontSize: '0.75rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                    }}
                                  >
                                    <Plus size={12} /> Invoice
                                  </button>
                                </td>
                              </tr>
                              {isExpanded && (
                                <tr key={`${po.id}-expanded`} style={{ background: 'var(--bg-subtle, #f8fafc)' }}>
                                  <td colSpan={9} style={{ padding: '0.75rem 1.5rem' }}>
                                    {linkedInvoices.length === 0 ? (
                                      <div
                                        style={{
                                          padding: '0.75rem',
                                          color: 'var(--text-muted)',
                                          fontSize: '0.8125rem',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: '0.5rem',
                                        }}
                                      >
                                        <Link2 size={12} /> No invoices linked to this PO yet.
                                        <button
                                          onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: po.id })}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            color: 'var(--accent, #2563eb)',
                                            fontSize: '0.8125rem',
                                            cursor: 'pointer',
                                            padding: 0,
                                            textDecoration: 'underline',
                                          }}
                                        >
                                          Create the first invoice
                                        </button>
                                      </div>
                                    ) : (
                                      <table style={{ width: '100%', fontSize: '0.8125rem' }}>
                                        <thead>
                                          <tr style={{ color: 'var(--text-muted)' }}>
                                            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Invoice #</th>
                                            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Date</th>
                                            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Amount</th>
                                            <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Status</th>
                                            <th style={{ textAlign: 'right', padding: '0.25rem 0.5rem', fontWeight: 500 }}>Action</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {linkedInvoices.map(inv => (
                                            <tr key={inv.id}>
                                              <td style={{ padding: '0.375rem 0.5rem', fontWeight: 500 }}>{inv.invoice_number}</td>
                                              <td style={{ padding: '0.375rem 0.5rem', color: 'var(--text-secondary)' }}>{fmtD(inv.invoice_date)}</td>
                                              <td
                                                style={{
                                                  padding: '0.375rem 0.5rem',
                                                  textAlign: 'right',
                                                  fontFamily: 'JetBrains Mono, monospace',
                                                }}
                                              >
                                                {fmt(inv.total_amount)}
                                              </td>
                                              <td style={{ padding: '0.375rem 0.5rem' }}>
                                                <span className="pl-status">{inv.status || 'Pending'}</span>
                                              </td>
                                              <td style={{ padding: '0.375rem 0.5rem', textAlign: 'right' }}>
                                                <button
                                                  onClick={() => setInvoiceModal({ open: true, mode: 'edit', invoice: inv })}
                                                  style={{
                                                    background: 'transparent',
                                                    border: '1px solid var(--border)',
                                                    color: 'var(--text-secondary)',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '0.25rem',
                                                    fontSize: '0.6875rem',
                                                    cursor: 'pointer',
                                                  }}
                                                >
                                                  Edit
                                                </button>
                                              </td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                    )}
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── POs (raw list) ── */}
              {activeTransactionTab === 'pos' && (
                <div className="pl-card">
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Purchase Orders</h3>
                    <button className="pl-btn pl-btn-primary" onClick={() => navigate(`/client-po/create?project_id=${selectedProject.id}`)}>
                      <Plus size={16} />
                      Create PO
                    </button>
                  </div>
                  {projectPOs.length === 0 ? (
                    <div className="pl-empty">
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No purchase orders found</p>
                    </div>
                  ) : (
                    <table className="pl-table">
                      <thead>
                        <tr>
                          <th>PO Number</th>
                          <th>Date</th>
                          <th>Total Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectPOs.map(po => (
                          <tr key={po.id}>
                            <td style={{ fontWeight: 500 }}>{po.po_number}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{fmtD(po.po_date)}</td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{fmt(po.po_total_value)}</td>
                            <td>
                              <span className="pl-status">
                                <span className="pl-status-dot" style={{ background: PO_STATUS_CONFIG[po.status as keyof typeof PO_STATUS_CONFIG]?.dot || '#94a3b8' }} />
                                {po.status || 'Pending'}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Invoices (raw list, with linked PO) ── */}
              {activeTransactionTab === 'invoices' && (
                <div className="pl-card">
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Invoices</h3>
                    <button
                      className="pl-btn pl-btn-primary"
                      onClick={() => setInvoiceModal({ open: true, mode: 'create', defaultPoId: null })}
                    >
                      <Plus size={16} />
                      Create Invoice
                    </button>
                  </div>
                  {projectInvoices.length === 0 ? (
                    <div className="pl-empty">
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No invoices found</p>
                    </div>
                  ) : (
                    <table className="pl-table">
                      <thead>
                        <tr>
                          <th>Invoice</th>
                          <th>Date</th>
                          <th>Linked PO</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectInvoices.map(inv => {
                          const linkedPo = linkedData?.pos.find(p => p.id === inv.po_id);
                          return (
                            <tr key={inv.id}>
                              <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                              <td style={{ color: 'var(--text-secondary)' }}>{fmtD(inv.invoice_date)}</td>
                              <td>
                                {linkedPo ? (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      padding: '0.125rem 0.5rem',
                                      background: '#eff6ff',
                                      color: '#1d4ed8',
                                      borderRadius: '0.25rem',
                                      fontSize: '0.75rem',
                                      fontWeight: 500,
                                    }}
                                  >
                                    <Link2 size={10} /> {linkedPo.po_number}
                                  </span>
                                ) : (
                                  <span
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '0.25rem',
                                      color: '#d97706',
                                      fontSize: '0.75rem',
                                    }}
                                    title="This invoice is not linked to a PO. Link it to track PO utilization."
                                  >
                                    <AlertTriangle size={10} /> Unlinked
                                  </span>
                                )}
                              </td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{fmt(inv.total_amount)}</td>
                              <td><span className="pl-status">{inv.status}</span></td>
                              <td style={{ textAlign: 'right' }}>
                                <button
                                  onClick={() => setInvoiceModal({ open: true, mode: 'edit', invoice: inv })}
                                  style={{
                                    background: 'transparent',
                                    border: '1px solid var(--border)',
                                    color: 'var(--text-secondary)',
                                    padding: '0.25rem 0.5rem',
                                    borderRadius: '0.25rem',
                                    fontSize: '0.6875rem',
                                    cursor: 'pointer',
                                  }}
                                >
                                  Edit
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* ── Payments (raw list) ── */}
              {activeTransactionTab === 'payments' && (
                <div className="pl-card">
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Payments</h3>
                  </div>
                  {projectPayments.length === 0 ? (
                    <div className="pl-empty">
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No payments found</p>
                    </div>
                  ) : (
                    <table className="pl-table">
                      <thead>
                        <tr>
                          <th>Payment</th>
                          <th>Date</th>
                          <th>Amount</th>
                          <th>Mode</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectPayments.map(pay => (
                          <tr key={pay.id}>
                            <td style={{ fontWeight: 500 }}>{pay.payment_number}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{fmtD(pay.payment_date)}</td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--success)' }}>{fmt(pay.payment_amount)}</td>
                            <td style={{ color: 'var(--text-secondary)' }}>{pay.payment_mode}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === 'expenses' && (
            <div className="pl-card">
              <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Expenses</h3>
              </div>
              {projectExpenses.length === 0 ? (
                <div className="pl-empty">
                  <Folder className="pl-empty-icon" />
                  <p className="pl-empty-text">No expenses found</p>
                </div>
              ) : (
                <table className="pl-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Description</th>
                      <th>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtD(exp.expense_date)}</td>
                        <td style={{ fontWeight: 500 }}>{exp.expense_type}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{exp.description || '-'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--danger)' }}>{fmt(exp.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'tasks' && (
            selectedProject && user && organisation && (
              <ProjectTaskListView 
                projectId={selectedProject.id} 
                projectName={selectedProject.project_name}
                organisationId={organisation.id}
                userId={user.id}
              />
            )
          )}

          {invoiceModal.open && selectedProject && (
            <CreateProjectInvoiceModal
              isOpen
              onClose={() => setInvoiceModal({ open: false })}
              mode={invoiceModal.mode}
              projectId={selectedProject.id}
              pos={(linkedData?.pos ?? projectPOs) as any}
              invoice={invoiceModal.invoice ?? null}
              defaultPoId={invoiceModal.defaultPoId ?? null}
            />
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // LIST VIEW (QuotationList UI pattern)
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div className="flex flex-col h-full min-h-[400px] max-w-[1400px] mx-auto w-full">
      {/* ── Main Header ── */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-medium text-zinc-900">Projects</h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-zinc-100 text-zinc-600">
              {projects.length}
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-200" />
          <div className="flex items-center gap-4">
            {PROJECT_STATUS_STATS.map(s => (
              <div key={s} className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider mx-1">
                  {s === 'Active' ? 'Active' : s === 'Draft' ? 'Draft' : 'Closed'}
                </span>
                <span className={`text-xs font-medium mx-1 ${
                  s === 'Active' ? 'text-emerald-700' : s === 'Draft' ? 'text-zinc-700' : 'text-zinc-700'
                }`}>
                  {stats[s] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="px-4 h-[30px] w-64 text-sm border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* ── Filter Row ── */}
      <div className="flex items-center justify-between px-6 border-b border-zinc-100 bg-zinc-50/50"
        style={{ paddingTop: '15px', paddingBottom: '15px' }}>
        <div className="flex items-center gap-2">
          {STATUS_FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`w-[130px] h-[26px] px-4 text-sm font-medium transition-colors ${
                statusFilter === status
                  ? 'bg-blue-600/10 text-blue-600'
                  : 'text-zinc-600 hover:bg-zinc-100'
              }`}
            >
              {status === 'All' ? 'All Projects' : status}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[10px]">
          <button
            onClick={() => navigate('/projects/new')}
            className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
            style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
          >
            New Project
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full">
          <table className="w-full border-separate border-spacing-0">
            <thead className="z-10">
              <tr>
                <th className="sticky top-0 z-10 h-[36px] pl-4 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[240px]">
                  Project
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[150px]">
                  Client
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[100px]">
                  Type
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-right text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
                  Est. Value
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-right text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
                  PO Value
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[120px]">
                  PO Status
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[100px]">
                  Status
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 min-w-[150px]">
                  Completion
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-center text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="bg-white">
              {currentItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center text-sm text-zinc-500">
                    No projects found
                  </td>
                </tr>
              ) : (
                <AnimatePresence mode="popLayout">
                  {currentItems.map((p, index) => {
                    const statusCfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
                    const poStatusCfg = PO_STATUS_CONFIG[p.po_status as keyof typeof PO_STATUS_CONFIG] || PO_STATUS_CONFIG.Pending;
                    const showWarning = checkPORequiredWarning(p);

                    return (
                      <motion.tr
                        key={p.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{
                          type: "spring",
                          stiffness: 400,
                          damping: 30,
                          opacity: { duration: 0.2 }
                        }}
                        className={`cursor-pointer transition-all duration-200 border-l-2 border-transparent hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm group relative ${
                          openMenuId === p.id ? 'z-50' : 'z-0'
                        } ${
                          index % 2 === 0 ? 'bg-white' : 'bg-zinc-50/30'
                        }`}
                        onClick={() => loadProjectDetails(p)}
                      >
                        {/* Project */}
                        <td className="pl-4 py-[26px] align-middle border-t border-zinc-200/70">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-semibold text-zinc-900 hover:text-blue-600 transition-colors">
                              {p.project_name || 'Unnamed Project'}
                            </span>
                            <div className="flex items-center gap-2">
                              {p.project_code && (
                                <span className="text-[11px] font-mono text-zinc-400">{p.project_code}</span>
                              )}
                              {showWarning && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold uppercase tracking-wider">
                                  ⚠ PO Required
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        {/* Client */}
                        <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                          <div className="max-w-[200px] truncate" title={p.client?.client_name || '-'}>
                            {p.client?.client_name || '-'}
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-6 py-[26px] align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                          {p.project_type || '-'}
                        </td>
                        {/* Est. Value */}
                        <td className="px-6 py-[26px] align-middle text-sm font-mono font-medium text-zinc-900 text-right border-t border-zinc-200/70">
                          {p.project_estimated_value ? fmt(p.project_estimated_value) : '-'}
                        </td>
                        {/* PO Value */}
                        <td className="px-6 py-[26px] align-middle text-sm font-mono font-medium text-zinc-900 text-right border-t border-zinc-200/70">
                          {p.pos && p.pos.length > 0 ? fmt(p.pos.reduce((sum, po) => sum + (po.po_total_value || 0), 0)) : '-'}
                        </td>
                        {/* PO Status */}
                        <td className="px-6 py-[26px] align-middle border-t border-zinc-200/70">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                            <span className="w-2 h-2 rounded-full" style={{ background: poStatusCfg.dot }} />
                            {poStatusCfg.label}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-6 py-[26px] align-middle border-t border-zinc-200/70">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                            <span className="w-2 h-2 rounded-full" style={{ background: statusCfg.dot }} />
                            {statusCfg.label}
                          </span>
                        </td>
                        {/* Completion */}
                        <td className="px-6 py-[26px] align-middle border-t border-zinc-200/70">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${p.completion_percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-zinc-500 font-mono min-w-[36px] text-right">
                              {p.completion_percentage || 0}%
                            </span>
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-5 pl-1 py-[26px] align-middle text-center border-t border-zinc-200/70">
                          <div className="relative inline-block" ref={openMenuId === p.id ? menuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === p.id ? null : p.id);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors"
                            >
                              <MoreHorizontal className="w-4 h-4 text-zinc-500" />
                            </button>
                          {openMenuId === p.id && (
                            <div className={`absolute right-0 z-[100] w-44 rounded-lg border border-zinc-200/60 bg-white p-1 shadow-lg shadow-black/5 ${
                              index >= currentItems.length - 3 && index > 3 ? 'bottom-full mb-1' : 'top-full mt-1'
                            }`}>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  loadProjectDetails(p);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <Folder className="w-3.5 h-3.5" />
                                View Details
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  navigate(`/projects/edit?id=${p.id}`);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <Edit className="w-3.5 h-3.5" />
                                Edit
                              </button>

                              <div className="my-1 border-t border-zinc-100" />

                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setOpenMenuId(null);
                                  deleteProject(p.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
                                style={{ padding: '6px' }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Delete
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

      {/* ── Pagination ── */}
      <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200 bg-zinc-50/50">
        <div className="text-sm font-medium text-zinc-600">
          Showing {filteredProjects.length === 0 ? 0 : startIndex + 1} to {Math.min(endIndex, filteredProjects.length)} of {filteredProjects.length} projects
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage > 1
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Previous
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: Math.max(1, Math.min(5, totalPages)) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) {
                pageNum = i + 1;
              } else if (currentPage <= 3) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 2) {
                pageNum = totalPages - 4 + i;
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
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage < totalPages
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
