import { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight, ArrowLeft, Edit, Trash2, Folder, TrendingUp, Clock, DollarSign } from 'lucide-react';
import ProjectTaskListView from '../components/tasks/ProjectTaskListView';
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

const STATUS_CONFIG = {
  Draft: { dot: '#94a3b8', label: 'Draft' },
  Active: { dot: '#10b981', label: 'Active' },
  'Execution Completed': { dot: '#f59e0b', label: 'Execution' },
  'Financially Closed': { dot: '#6366f1', label: 'Financially Closed' },
  Closed: { dot: '#64748b', label: 'Closed' },
};

const PO_STATUS_CONFIG = {
  'Not Required': { dot: '#10b981', label: 'Not Required' },
  Pending: { dot: '#f59e0b', label: 'Pending' },
  Received: { dot: '#3b82f6', label: 'Received' },
};

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@500&display=swap');
  
  :root {
    --bg-primary: #faf9f7;
    --bg-card: #ffffff;
    --bg-hover: #f5f3f0;
    --border: #e8e5e1;
    --border-hover: #d4d0ca;
    --text-primary: #1a1a1a;
    --text-secondary: #6b6b6b;
    --text-muted: #9ca3af;
    --accent: #e85d04;
    --accent-hover: #dc4c00;
    --accent-light: #fff4ed;
    --success: #10b981;
    --warning: #f59e0b;
    --danger: #ef4444;
  }
  
  * { box-sizing: border-box; }
  
  body { background: var(--bg-primary); }
  
  .pl-page {
    font-family: 'DM Sans', system-ui, sans-serif;
    background: var(--bg-primary);
    min-height: 100vh;
    padding: 2rem;
  }
  
  .pl-container {
    max-width: 1400px;
    margin: 0 auto;
  }
  
  /* Header */
  .pl-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 2rem;
  }
  
  .pl-title {
    font-size: 2rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
  }
  
  .pl-subtitle {
    font-size: 0.875rem;
    color: var(--text-secondary);
    margin-top: 0.25rem;
  }
  
  /* Buttons */
  .pl-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
  }
  
  .pl-btn-primary {
    background: var(--accent);
    color: white;
  }
  
  .pl-btn-primary:hover {
    background: var(--accent-hover);
    transform: translateY(-1px);
  }
  
  .pl-btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1px solid var(--border);
  }
  
  .pl-btn-secondary:hover {
    background: var(--bg-hover);
    border-color: var(--border-hover);
  }
  
  .pl-btn-icon {
    padding: 0.5rem;
    border-radius: 0.5rem;
    background: transparent;
    border: none;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .pl-btn-icon:hover {
    background: var(--bg-hover);
    color: var(--text-primary);
  }
  
  /* Search */
  .pl-search-wrapper {
    position: relative;
    margin-bottom: 1.5rem;
  }
  
  .pl-search-icon {
    position: absolute;
    left: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--text-muted);
  }
  
  .pl-search-input {
    width: 100%;
    padding: 0.875rem 1rem 0.875rem 2.75rem;
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    font-size: 0.9375rem;
    color: var(--text-primary);
    transition: all 0.2s ease;
    font-family: inherit;
  }
  
  .pl-search-input:focus {
    outline: none;
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(232, 93, 4, 0.1);
  }
  
  .pl-search-input::placeholder {
    color: var(--text-muted);
  }
  
  .pl-count {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    font-size: 0.75rem;
    color: var(--text-muted);
    font-family: 'JetBrains Mono', monospace;
  }
  
  /* Project Card */
  .pl-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 1rem;
    overflow: hidden;
    transition: all 0.25s ease;
  }
  
  .pl-card:hover {
    border-color: var(--border-hover);
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04);
  }
  
  .pl-table {
    width: 100%;
    border-collapse: collapse;
  }
  
  .pl-table thead {
    background: var(--bg-primary);
  }
  
  .pl-table th {
    padding: 0.875rem 1rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    border-bottom: 1px solid var(--border);
  }
  
  .pl-table th:last-child {
    text-align: right;
  }
  
  .pl-table td {
    padding: 1rem;
    border-bottom: 1px solid var(--border);
    vertical-align: middle;
  }
  
  .pl-table tbody tr {
    transition: background 0.15s ease;
  }
  
  .pl-table tbody tr:hover {
    background: var(--bg-hover);
  }
  
  .pl-table tbody tr:last-child td {
    border-bottom: none;
  }
  
  /* Project Name Cell */
  .pl-project-name {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
  }
  
  .pl-project-title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    cursor: pointer;
    transition: color 0.15s ease;
  }
  
  .pl-project-title:hover {
    color: var(--accent);
  }
  
  .pl-project-code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.6875rem;
    color: var(--text-muted);
  }
  
  /* Status Badge */
  .pl-status {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    background: var(--bg-primary);
    border-radius: 2rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--text-secondary);
  }
  
  .pl-status-dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
  }
  
  /* Warning Badge */
  .pl-warning {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.5rem;
    background: #fef2f2;
    color: var(--danger);
    border-radius: 0.25rem;
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }
  
  /* Progress Bar */
  .pl-progress {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }
  
  .pl-progress-bar {
    flex: 1;
    height: 0.375rem;
    background: var(--bg-primary);
    border-radius: 1rem;
    overflow: hidden;
  }
  
  .pl-progress-fill {
    height: 100%;
    background: var(--accent);
    border-radius: 1rem;
    transition: width 0.5s ease;
  }
  
  .pl-progress-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--text-secondary);
    min-width: 2.5rem;
    text-align: right;
    font-family: 'JetBrains Mono', monospace;
  }
  
  /* Action Buttons */
  .pl-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.25rem;
  }
  
  /* Empty State */
  .pl-empty {
    padding: 4rem 2rem;
    text-align: center;
  }
  
  .pl-empty-icon {
    width: 4rem;
    height: 4rem;
    margin: 0 auto 1rem;
    color: var(--text-muted);
    opacity: 0.5;
  }
  
  .pl-empty-text {
    font-size: 0.9375rem;
    color: var(--text-secondary);
  }
  
  /* Loading Skeleton */
  .pl-skeleton {
    background: linear-gradient(90deg, var(--bg-primary) 0%, var(--bg-card) 50%, var(--bg-primary) 100%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
    border-radius: 0.5rem;
  }
  
  @keyframes shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  
  /* Detail View */
  .pl-detail-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.5rem 1rem;
    margin-bottom: 0;
    border-bottom: 1px solid var(--border);
  }
  
  .pl-detail-title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 0;
  }
  
  .pl-tabs {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1.5rem;
    overflow-x: auto;
    padding-bottom: 0.5rem;
  }
  
  .pl-tab {
    padding: 0.625rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    border: 1px solid transparent;
    background: transparent;
    color: var(--text-secondary);
  }
  
  .pl-tab:hover {
    background: var(--bg-hover);
  }
  
  .pl-tab.active {
    background: var(--accent);
    color: white;
  }
  
  .pl-tab-count {
    margin-left: 0.375rem;
    opacity: 0.7;
  }
  
  /* Summary Cards */
  .pl-summary-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  
  .pl-summary-card {
    background: var(--bg-card);
    border: 1px solid var(--border);
    border-radius: 0.75rem;
    padding: 1.25rem;
  }
  
  .pl-summary-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 1rem;
  }
  
  .pl-summary-row {
    display: flex;
    justify-content: space-between;
    padding: 0.5rem 0;
    border-bottom: 1px solid var(--border);
  }
  
  .pl-summary-row:last-child {
    border-bottom: none;
  }
  
  .pl-summary-label {
    font-size: 0.8125rem;
    color: var(--text-secondary);
  }
  
  .pl-summary-value {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--text-primary);
  }
  
  /* Financial Grid */
  .pl-financial-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-bottom: 1rem;
  }
  
  .pl-financial-card {
    background: var(--bg-primary);
    border-radius: 0.75rem;
    padding: 1rem;
    text-align: center;
  }
  
  .pl-financial-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    margin-bottom: 0.5rem;
  }
  
  .pl-financial-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  
  .pl-financial-value.positive {
    color: var(--success);
  }
  
  .pl-financial-value.negative {
    color: var(--danger);
  }
  
  /* Responsive */
  @media (max-width: 1024px) {
    .pl-financial-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }
  
  @media (max-width: 768px) {
    .pl-page {
      padding: 1rem;
    }
    
    .pl-summary-grid {
      grid-template-columns: 1fr;
    }
    
    .pl-table th:nth-child(4),
    .pl-table td:nth-child(4) {
      display: none;
    }
  }
`;

// ─── Inject Styles ─────────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {
  const styleId = 'pl-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const { user, organisation } = useAuth();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');
  const [activeTab, setActiveTab] = useState('summary');

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
      console.log('POs fetched:', posResult.data);
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
    return projects.filter(p =>
      (p.project_name ?? '').toLowerCase().includes(q) ||
      (p.project_code ?? '').toLowerCase().includes(q) ||
      (p.client?.client_name ?? '').toLowerCase().includes(q)
    );
  }, [projects, searchTerm]);

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
    window.location.reload();
  };

  const checkPORequiredWarning = (p: Project) =>
    p.po_required && p.po_status !== 'Received' && p.po_status !== 'Not Required';

  const loadProjectDetails = (project: Project) => {
    setSelectedProject(project);
    setViewMode('detail');
  };

  const fmt = (n: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n || 0);
  const fmtD = (d?: string) => { if (!d) return '-'; const x = new Date(d); return isNaN(x.getTime()) ? '-' : x.toLocaleDateString(); };

  if (isLoading) {
    return (
      <div className="pl-page">
        <div className="pl-container">
          <div className="pl-header">
            <div>
              <div className="pl-skeleton" style={{ width: '120px', height: '2rem' }} />
              <div className="pl-skeleton" style={{ width: '180px', height: '1rem', marginTop: '0.5rem' }} />
            </div>
          </div>
          <div className="pl-skeleton" style={{ width: '100%', height: '3rem', marginBottom: '1.5rem' }} />
          <div className="pl-skeleton" style={{ width: '100%', height: '400px' }} />
        </div>
      </div>
    );
  }

  if (viewMode === 'detail' && selectedProject) {
    const tabs = [
      { id: 'summary', label: 'Summary' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'expenses', label: 'Expenses' },
    ];

    const transactionSubTabs = [
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
                <h3 className="pl-summary-title" style={{ marginBottom: '1rem' }}>Transaction Summary</h3>
                <div className="pl-financial-grid">
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Total POs</div>
                    <div className="pl-financial-value">{projectPOs.length}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">PO Value</div>
                    <div className="pl-financial-value">{fmt(financialSummary?.total_po_value)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Invoiced</div>
                    <div className="pl-financial-value">{fmt(financialSummary?.total_invoice_value)}</div>
                  </div>
                  <div className="pl-financial-card">
                    <div className="pl-financial-label">Payments</div>
                    <div className="pl-financial-value positive">{fmt(financialSummary?.total_payment_received)}</div>
                  </div>
                </div>
              </div>

              {/* Transaction Sub-Tabs */}
              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', padding: '0.5rem 0' }}>
                {transactionSubTabs.map(subTab => (
                  <button
                    key={subTab.id}
                    onClick={() => {}}
                    style={{
                      padding: '0.5rem 1rem',
                      borderRadius: '0.5rem',
                      fontSize: '0.875rem',
                      fontWeight: 500,
                      cursor: 'pointer',
                      border: '1px solid var(--border)',
                      background: subTab.id === 'pos' ? 'var(--accent)' : 'white',
                      color: subTab.id === 'pos' ? 'white' : 'var(--text-primary)',
                    }}
                  >
                    {subTab.label} ({subTab.count})
                  </button>
                ))}
              </div>

              {/* POs */}
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

              {/* Invoices */}
              <div className="pl-card" style={{ marginTop: '1rem' }}>
                <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Invoices</h3>
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
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {projectInvoices.map(inv => (
                        <tr key={inv.id}>
                          <td style={{ fontWeight: 500 }}>{inv.invoice_number}</td>
                          <td style={{ color: 'var(--text-secondary)' }}>{fmtD(inv.invoice_date)}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>{fmt(inv.total_amount)}</td>
                          <td><span className="pl-status">{inv.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Payments */}
              <div className="pl-card" style={{ marginTop: '1rem' }}>
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
        </div>
      </div>
    );
  }

  return (
    <div className="pl-page">
      <div className="pl-container">
        <div className="pl-header">
          <div>
            <h1 className="pl-title">Projects</h1>
            <p className="pl-subtitle">Manage and track all your projects</p>
          </div>
          <button className="pl-btn pl-btn-primary" onClick={() => navigate('/projects/new')}>
            <Plus size={18} />
            New Project
          </button>
        </div>

        <div className="pl-search-wrapper">
          <Search size={18} className="pl-search-icon" />
          <input
            type="text"
            className="pl-search-input"
            placeholder="Search by project name, code, or client..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
          <span className="pl-count">{filteredProjects.length} projects</span>
        </div>

        <div className="pl-card">
          {filteredProjects.length === 0 ? (
            <div className="pl-empty">
              <Folder className="pl-empty-icon" />
              <p className="pl-empty-text">No projects found</p>
            </div>
          ) : (
            <table className="pl-table">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Est. Value</th>
                  <th>PO Value</th>
                  <th>PO Status</th>
                  <th>Status</th>
                  <th>Completion</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => {
                  const statusCfg = STATUS_CONFIG[p.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.Draft;
                  const poStatusCfg = PO_STATUS_CONFIG[p.po_status as keyof typeof PO_STATUS_CONFIG] || PO_STATUS_CONFIG.Pending;
                  const showWarning = checkPORequiredWarning(p);

                  return (
                    <tr key={p.id}>
                      <td>
                        <div className="pl-project-name">
                          <span className="pl-project-title" onClick={() => loadProjectDetails(p)}>
                            {p.project_name || 'Unnamed Project'}
                          </span>
                          {p.project_code && <span className="pl-project-code">{p.project_code}</span>}
                          {showWarning && <span className="pl-warning">⚠ PO Required</span>}
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.client?.client_name || '-'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{p.project_type || '-'}</td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                        {p.project_estimated_value ? fmt(p.project_estimated_value) : '-'}
                      </td>
                      <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500 }}>
                        {p.pos && p.pos.length > 0 ? fmt(p.pos.reduce((sum, po) => sum + (po.po_total_value || 0), 0)) : '-'}
                      </td>
                      <td>
                        <span className="pl-status">
                          <span className="pl-status-dot" style={{ background: poStatusCfg.dot }} />
                          {poStatusCfg.label}
                        </span>
                      </td>
                      <td>
                        <span className="pl-status">
                          <span className="pl-status-dot" style={{ background: statusCfg.dot }} />
                          {statusCfg.label}
                        </span>
                      </td>
                      <td>
                        <div className="pl-progress">
                          <div className="pl-progress-bar">
                            <div className="pl-progress-fill" style={{ width: `${p.completion_percentage || 0}%` }} />
                          </div>
                          <span className="pl-progress-value">{p.completion_percentage || 0}%</span>
                        </div>
                      </td>
                      <td>
                        <div className="pl-actions">
                          <button className="pl-btn-icon" onClick={() => loadProjectDetails(p)} title="View">
                            <ChevronRight size={18} />
                          </button>
                          <button className="pl-btn-icon" onClick={() => navigate(`/projects/edit?id=${p.id}`)} title="Edit">
                            <Edit size={16} />
                          </button>
                          <button className="pl-btn-icon" onClick={() => deleteProject(p.id)} title="Delete" style={{ '--hover-color': 'var(--danger)' } as any}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
