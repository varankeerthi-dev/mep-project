import { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatDate, formatCurrency } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

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
};

type ProjectDetails = {
  pos: any[];
  invoices: any[];
  expenses: any[];
  payments: any[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  Draft:                { bg: '#f3f4f6', color: '#6b7280' },
  Active:               { bg: '#dbeafe', color: '#1d4ed8' },
  'Execution Completed':{ bg: '#fef3c7', color: '#b45309' },
  'Financially Closed': { bg: '#d1fae5', color: '#047857' },
  Closed:               { bg: '#f3f4f6', color: '#374151' },
};

const PO_STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  'Not Required': { bg: '#d1fae5', color: '#047857' },
  Pending:        { bg: '#fef3c7', color: '#b45309' },
  Received:       { bg: '#dbeafe', color: '#1d4ed8' },
};

const getStatusColor  = (s?: string) => STATUS_COLORS[s ?? '']    ?? STATUS_COLORS['Draft'];
const getPOStatusColor = (s?: string) => PO_STATUS_COLORS[s ?? ''] ?? PO_STATUS_COLORS['Pending'];

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm]         = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode]             = useState<'list' | 'detail'>('list');

  // ── Projects query (cached, no re-fetch on tab switch) ──────────────────────
  const { data: projects = [], isLoading } = useQuery<Project[]>({
    queryKey: ['projects'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*, client:clients(client_name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 3 * 60 * 1000,
  });

  // ── Project details query (only fires when a project is selected in detail view) ─
  const { data: projectDetails, isLoading: detailsLoading } = useQuery<ProjectDetails>({
    queryKey: ['project-details', selectedProject?.id],
    queryFn: async () => {
      const [posResult, invoicesResult, expensesResult, paymentsResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('project_id', selectedProject!.id),
        supabase.from('project_invoices').select('*').eq('project_id', selectedProject!.id).order('invoice_date', { ascending: false }),
        supabase.from('project_expenses').select('*').eq('project_id', selectedProject!.id).order('expense_date', { ascending: false }),
        supabase.from('project_payments').select('*').eq('project_id', selectedProject!.id).order('payment_date', { ascending: false }),
      ]);
      if (posResult.error)     throw posResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (expensesResult.error) throw expensesResult.error;
      if (paymentsResult.error) throw paymentsResult.error;
      return {
        pos:      posResult.data      ?? [],
        invoices: invoicesResult.data ?? [],
        expenses: expensesResult.data ?? [],
        payments: paymentsResult.data ?? [],
      };
    },
    // Only fetches when we're actually viewing the detail page
    enabled: !!selectedProject?.id && viewMode === 'detail',
    staleTime: 2 * 60 * 1000,
  });

  const projectPOs       = projectDetails?.pos      ?? [];
  const projectInvoices  = projectDetails?.invoices ?? [];
  const projectExpenses  = projectDetails?.expenses ?? [];
  const projectPayments  = projectDetails?.payments ?? [];

  // ── Financial summary (derived, no extra query needed) ─────────────────────
  const financialSummary = useMemo(() => {
    if (!projectDetails) return null;
    const totalPOValue           = projectPOs.reduce((s, p) => s + (parseFloat(p.po_total_value) || 0), 0);
    const totalInvoiceValue      = projectInvoices.reduce((s, i) => s + (parseFloat(i.total_amount) || 0), 0);
    const totalPaymentReceived   = projectPayments.reduce((s, p) => s + (parseFloat(p.payment_amount) || 0), 0);
    const totalExpense           = projectExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
    return {
      total_po_value:          totalPOValue,
      total_invoice_value:     totalInvoiceValue,
      total_payment_received:  totalPaymentReceived,
      total_expense:           totalExpense,
      outstanding_amount:      totalInvoiceValue - totalPaymentReceived,
      profit:                  totalInvoiceValue - totalExpense,
      po_balance:              totalPOValue - totalInvoiceValue,
    };
  }, [projectDetails]);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filteredProjects = useMemo(() => {
    const q = searchTerm.toLowerCase();
    return projects.filter(p =>
      (p.project_name  ?? '').toLowerCase().includes(q) ||
      (p.project_code  ?? '').toLowerCase().includes(q) ||
      (p.client?.client_name ?? '').toLowerCase().includes(q)
    );
  }, [projects, searchTerm]);

  // ── Delete ──────────────────────────────────────────────────────────────────
  const deleteProject = async (id: string) => {
    const [posRes, invoicesRes, expensesRes, paymentsRes] = await Promise.all([
      supabase.from('client_purchase_orders').select('id').eq('project_id', id),
      supabase.from('project_invoices').select('id').eq('project_id', id),
      supabase.from('project_expenses').select('id').eq('project_id', id),
      supabase.from('project_payments').select('id').eq('project_id', id),
    ]);
    if (
      (posRes.data?.length  ?? 0) > 0 ||
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
    // TanStack Query will auto-refetch on next stale check.
    // Force immediate refresh:
    setSelectedProject(null);
    window.location.reload();
  };

  const checkPORequiredWarning = (p: Project) =>
    p.po_required && p.po_status !== 'Received' && p.po_status !== 'Not Required';

  const loadProjectDetails = (project: Project) => {
    setSelectedProject(project);
    setViewMode('detail');
  };

  // ── Render ──────────────────────────────────────────────────────────────────

  if (isLoading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (viewMode === 'detail' && selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        financialSummary={financialSummary}
        projectPOs={projectPOs}
        projectInvoices={projectInvoices}
        projectExpenses={projectExpenses}
        projectPayments={projectPayments}
        detailsLoading={detailsLoading}
        onBack={() => { setViewMode('list'); setSelectedProject(null); }}
        onEdit={() => navigate(`/projects/edit?id=${selectedProject.id}`)}
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <button className="btn btn-primary" onClick={() => navigate('/projects/new')}>
          + New Project
        </button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>
      </div>

      <div className="card">
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <h3>No Projects Found</h3>
            <p>Create your first project to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Est. Value</th>
                  <th>PO Status</th>
                  <th>Status</th>
                  <th>Completion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => {
                  const statusStyle   = getStatusColor(p.status);
                  const poStatusStyle = getPOStatusColor(p.po_status);
                  const showWarning   = checkPORequiredWarning(p);
                  return (
                    <tr key={p.id}>
                      <td>{p.project_code || '-'}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span
                            style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}
                            onClick={() => loadProjectDetails(p)}
                          >
                            {p.project_name || 'Unnamed Project'}
                          </span>
                          {showWarning && (
                            <span style={{
                              background: '#fee2e2', color: '#dc2626',
                              padding: '2px 6px', borderRadius: '4px',
                              fontSize: '10px', fontWeight: 600,
                            }}>
                              PO Required
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{p.client?.client_name || '-'}</td>
                      <td>{p.project_type || '-'}</td>
                      <td>{p.project_estimated_value ? formatCurrency(p.project_estimated_value) : '-'}</td>
                      <td>
                        <span style={{
                          background: poStatusStyle.bg, color: poStatusStyle.color,
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '11px', fontWeight: 600,
                        }}>
                          {p.po_status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: statusStyle.bg, color: statusStyle.color,
                          padding: '4px 8px', borderRadius: '4px',
                          fontSize: '11px', fontWeight: 600,
                        }}>
                          {p.status || 'Draft'}
                        </span>
                      </td>
                      <td>{p.completion_percentage || 0}%</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => loadProjectDetails(p)}>View</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => navigate(`/projects/edit?id=${p.id}`)}>Edit</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px', color: '#dc2626' }} onClick={() => deleteProject(p.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── ProjectDetailView ────────────────────────────────────────────────────────

function ProjectDetailView({
  project,
  financialSummary,
  projectPOs,
  projectInvoices,
  projectExpenses,
  projectPayments,
  detailsLoading,
  onBack,
  onEdit,
}: {
  project: Project;
  financialSummary: any;
  projectPOs: any[];
  projectInvoices: any[];
  projectExpenses: any[];
  projectPayments: any[];
  detailsLoading: boolean;
  onBack: () => void;
  onEdit: () => void;
}) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('summary');

  const fmt  = (n: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);
  const fmtD = (d?: string) => { if (!d) return '-'; const x = new Date(d); return isNaN(x.getTime()) ? '-' : x.toLocaleDateString(); };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{project.project_name}</h1>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>{project.project_code}</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onEdit}>Edit Project</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {(['summary', 'pos', 'invoices', 'payments', 'expenses'] as const).map(tab => (
          <button
            key={tab}
            className={`btn ${activeTab === tab ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab === 'summary'  && 'Summary'}
            {tab === 'pos'      && `POs (${projectPOs.length})`}
            {tab === 'invoices' && `Invoices (${projectInvoices.length})`}
            {tab === 'payments' && `Payments (${projectPayments.length})`}
            {tab === 'expenses' && `Expenses (${projectExpenses.length})`}
          </button>
        ))}
      </div>

      {detailsLoading && activeTab !== 'summary' && (
        <div style={{ padding: '20px', textAlign: 'center', color: '#6b7280' }}>Loading...</div>
      )}

      {/* ── Summary ── */}
      {activeTab === 'summary' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Commercial Summary</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                {[
                  ['Project Code',      project.project_code || '-'],
                  ['Project Name',      project.project_name || '-'],
                  ['Client',            project.client?.client_name || '-'],
                  ['Project Type',      project.project_type || '-'],
                  ['Estimated Value',   project.project_estimated_value ? fmt(project.project_estimated_value) : '-'],
                  ['PO Required',       project.po_required ? 'Yes' : 'No'],
                  ['PO Status',         project.po_status || 'Pending'],
                ].map(([k, v], i, arr) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #e5e7eb' : undefined }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ fontWeight: 500 }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Execution Summary</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Status</span>
                  <span style={{ background: getStatusColor(project.status).bg, color: getStatusColor(project.status).color, padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {project.status || 'Draft'}
                  </span>
                </div>
                {[
                  ['Start Date',         fmtD(project.start_date)],
                  ['Expected End Date',  fmtD(project.expected_end_date)],
                  ['Actual End Date',    fmtD(project.actual_end_date)],
                  ['Completion',         `${project.completion_percentage || 0}%`],
                  ['Remarks',            project.remarks || '-'],
                ].map(([k, v], i, arr) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #e5e7eb' : undefined }}>
                    <span style={{ color: '#6b7280' }}>{k}</span>
                    <span style={{ fontWeight: 500, maxWidth: '200px', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Financial Summary</h3>
            {!financialSummary ? (
              <div style={{ padding: '16px', textAlign: 'center', color: '#6b7280', fontSize: '13px' }}>
                Click the POs / Invoices / Payments / Expenses tabs to load financial data.
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
                  {[
                    { label: 'Total PO Value',           value: financialSummary.total_po_value,         bg: '#eff6ff', color: '#1d4ed8' },
                    { label: 'Total Invoice Value',       value: financialSummary.total_invoice_value,    bg: '#fef3c7', color: '#b45309' },
                    { label: 'Total Payment Received',    value: financialSummary.total_payment_received, bg: '#dcfce7', color: '#047857' },
                    { label: 'Total Expense',             value: financialSummary.total_expense,          bg: '#fee2e2', color: '#dc2626' },
                  ].map(({ label, value, bg, color }) => (
                    <div key={label} style={{ background: bg, padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '20px', fontWeight: 700, color }}>{fmt(value)}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
                  <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Outstanding Amount</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary.outstanding_amount > 0 ? '#dc2626' : '#047857' }}>{fmt(financialSummary.outstanding_amount)}</div>
                  </div>
                  <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Profit</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary.profit >= 0 ? '#047857' : '#dc2626' }}>{fmt(financialSummary.profit)}</div>
                  </div>
                  <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                    <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>PO Balance</div>
                    <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary.po_balance >= 0 ? '#7c3aed' : '#dc2626' }}>{fmt(financialSummary.po_balance)}</div>
                  </div>
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ── POs ── */}
      {activeTab === 'pos' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Purchase Orders</h3>
            <button className="btn btn-primary" onClick={() => navigate(`/client-po/create?project_id=${project.id}`)}>+ Create PO</button>
          </div>
          {projectPOs.length === 0 ? <div className="empty-state"><p>No POs found</p></div> : (
            <table className="table">
              <thead><tr><th>PO Number</th><th>PO Date</th><th>Total Value</th><th>Utilized</th><th>Available</th><th>Status</th></tr></thead>
              <tbody>
                {projectPOs.map(po => (
                  <tr key={po.id}>
                    <td>{po.po_number}</td>
                    <td>{fmtD(po.po_date)}</td>
                    <td>{fmt(po.po_total_value)}</td>
                    <td>{fmt(po.po_utilized_value)}</td>
                    <td>{fmt(po.po_available_value)}</td>
                    <td>{po.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Invoices ── */}
      {activeTab === 'invoices' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Invoices</h3>
            <button className="btn btn-primary" onClick={() => navigate(`/projects/invoice/new?project_id=${project.id}`)}>+ Create Invoice</button>
          </div>
          {projectInvoices.length === 0 ? <div className="empty-state"><p>No invoices found</p></div> : (
            <table className="table">
              <thead><tr><th>Invoice Number</th><th>Date</th><th>Amount</th><th>Tax</th><th>Total</th><th>Status</th></tr></thead>
              <tbody>
                {projectInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{fmtD(inv.invoice_date)}</td>
                    <td>{fmt(inv.invoice_amount)}</td>
                    <td>{fmt(inv.tax_amount)}</td>
                    <td>{fmt(inv.total_amount)}</td>
                    <td>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Payments ── */}
      {activeTab === 'payments' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Payments</h3>
            <button className="btn btn-primary" onClick={() => navigate(`/projects/payment/new?project_id=${project.id}`)}>+ Record Payment</button>
          </div>
          {projectPayments.length === 0 ? <div className="empty-state"><p>No payments found</p></div> : (
            <table className="table">
              <thead><tr><th>Payment Number</th><th>Date</th><th>Amount</th><th>Mode</th><th>Reference</th></tr></thead>
              <tbody>
                {projectPayments.map(pay => (
                  <tr key={pay.id}>
                    <td>{pay.payment_number}</td>
                    <td>{fmtD(pay.payment_date)}</td>
                    <td>{fmt(pay.payment_amount)}</td>
                    <td>{pay.payment_mode}</td>
                    <td>{pay.reference_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* ── Expenses ── */}
      {activeTab === 'expenses' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Expenses</h3>
            <button className="btn btn-primary" onClick={() => navigate(`/projects/expense/new?project_id=${project.id}`)}>+ Add Expense</button>
          </div>
          {projectExpenses.length === 0 ? <div className="empty-state"><p>No expenses found</p></div> : (
            <table className="table">
              <thead><tr><th>Date</th><th>Type</th><th>Description</th><th>Vendor</th><th>Amount</th></tr></thead>
              <tbody>
                {projectExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{fmtD(exp.expense_date)}</td>
                    <td>{exp.expense_type}</td>
                    <td>{exp.description || '-'}</td>
                    <td>{exp.vendor_name || '-'}</td>
                    <td>{fmt(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
