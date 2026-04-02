import { useState, useMemo } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Search, Plus, ChevronRight, ArrowLeft, Edit, Trash2, Package } from 'lucide-react';

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

// ─── Status Dots ────────────────────────────────────────────────────────────────

const STATUS_DOTS: Record<string, string> = {
  Draft: 'bg-zinc-400',
  Active: 'bg-teal-500',
  'Execution Completed': 'bg-amber-500',
  'Financially Closed': 'bg-emerald-500',
  Closed: 'bg-zinc-400',
};

const PO_STATUS_DOTS: Record<string, string> = {
  'Not Required': 'bg-emerald-500',
  Pending: 'bg-amber-500',
  Received: 'bg-teal-500',
};

const getStatusDot = (s?: string) => STATUS_DOTS[s ?? 'Draft'] ?? 'bg-zinc-400';
const getPOStatusDot = (s?: string) => PO_STATUS_DOTS[s ?? 'Pending'] ?? 'bg-amber-500';

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'detail'>('list');

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
    staleTime: 30 * 1000,
  });

  const { data: projectDetails, isLoading: detailsLoading } = useQuery<ProjectDetails>({
    queryKey: ['project-details', selectedProject?.id],
    queryFn: async () => {
      const [posResult, invoicesResult, expensesResult, paymentsResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('project_id', selectedProject!.id),
        supabase.from('project_invoices').select('*').eq('project_id', selectedProject!.id).order('invoice_date', { ascending: false }),
        supabase.from('project_expenses').select('*').eq('project_id', selectedProject!.id).order('expense_date', { ascending: false }),
        supabase.from('project_payments').select('*').eq('project_id', selectedProject!.id).order('payment_date', { ascending: false }),
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] px-6 py-6">
        <div className="max-w-[1400px] mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded-lg w-32" />
            <div className="h-12 bg-gray-200 rounded-xl w-full" />
            <div className="h-96 bg-gray-200 rounded-2xl w-full" />
          </div>
        </div>
      </div>
    );
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
    <div className="min-h-screen bg-[#fafafa] px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-extrabold text-zinc-900 tracking-tight">Projects</h1>
          <button
            onClick={() => navigate('/projects/new')}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            <Plus size={16} />
            New Project
          </button>
        </div>

        {/* Search Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search projects..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-teal-300 focus:ring-2 focus:ring-teal-300/20 focus:outline-none transition-all"
              />
            </div>
            <span className="text-xs text-zinc-400 font-medium">{filteredProjects.length} projects</span>
          </div>
        </div>

        {/* Projects Table Card */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          {filteredProjects.length === 0 ? (
            <div className="py-16 text-center">
              <Package size={48} strokeWidth={1} className="mx-auto text-zinc-300 mb-3" />
              <p className="text-sm text-zinc-400">No projects found</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Project</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Client</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Type</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Est. Value</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">PO Status</th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Completion</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => {
                  const showWarning = checkPORequiredWarning(p);
                  return (
                    <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-sm font-medium text-zinc-900 cursor-pointer hover:text-teal-600 transition-colors"
                            onClick={() => loadProjectDetails(p)}
                          >
                            {p.project_name || 'Unnamed Project'}
                          </span>
                          {p.project_code && (
                            <span className="text-[11px] text-zinc-400 font-medium">{p.project_code}</span>
                          )}
                          {showWarning && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-red-50 text-red-600 rounded-full text-[10px] font-semibold">
                              <span className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                              PO Required
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.client?.client_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{p.project_type || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 text-right font-medium">
                        {p.project_estimated_value ? formatCurrency(p.project_estimated_value) : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getPOStatusDot(p.po_status)}`} />
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-zinc-700 rounded-full">
                            {p.po_status || 'Pending'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getStatusDot(p.status)}`} />
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-zinc-700 rounded-full">
                            {p.status || 'Draft'}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="inline-flex items-center gap-2">
                          <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-teal-400 rounded-full"
                              style={{ width: `${p.completion_percentage || 0}%` }}
                            />
                          </div>
                          <span className="text-xs text-zinc-500 font-medium">{p.completion_percentage || 0}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => loadProjectDetails(p)}
                            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="View"
                          >
                            <ChevronRight size={16} />
                          </button>
                          <button
                            onClick={() => navigate(`/projects/edit?id=${p.id}`)}
                            className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-gray-100 rounded-full transition-colors"
                            title="Edit"
                          >
                            <Edit size={16} />
                          </button>
                          <button
                            onClick={() => deleteProject(p.id)}
                            className="p-2 text-zinc-400 hover:text-red-600 hover:bg-red-50 rounded-full transition-colors"
                            title="Delete"
                          >
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

  const fmt = (n: any) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n || 0);
  const fmtD = (d?: string) => { if (!d) return '-'; const x = new Date(d); return isNaN(x.getTime()) ? '-' : x.toLocaleDateString(); };

  const tabs = [
    { id: 'summary', label: 'Summary' },
    { id: 'pos', label: `POs`, count: projectPOs.length },
    { id: 'invoices', label: 'Invoices', count: projectInvoices.length },
    { id: 'payments', label: 'Payments', count: projectPayments.length },
    { id: 'expenses', label: 'Expenses', count: projectExpenses.length },
  ];

  return (
    <div className="min-h-screen bg-[#fafafa] px-6 py-6">
      <div className="max-w-[1400px] mx-auto">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-gray-100 rounded-full transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-xl font-extrabold text-zinc-900 tracking-tight">{project.project_name}</h1>
              <p className="text-xs text-zinc-400 font-medium mt-0.5">{project.project_code}</p>
            </div>
          </div>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-2 bg-zinc-900 text-white rounded-full px-5 py-2.5 text-sm font-semibold hover:bg-zinc-800 transition-colors"
          >
            <Edit size={16} />
            Edit Project
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 mb-5 overflow-x-auto pb-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id
                  ? 'bg-zinc-900 text-white'
                  : 'bg-white border border-gray-200 text-zinc-600 hover:bg-gray-50'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`ml-1.5 text-xs ${activeTab === tab.id ? 'text-zinc-400' : 'text-zinc-400'}`}>
                  ({tab.count})
                </span>
              )}
            </button>
          ))}
        </div>

        {detailsLoading && activeTab !== 'summary' && (
          <div className="py-12 text-center text-sm text-zinc-400">Loading...</div>
        )}

        {/* ── Summary ── */}
        {activeTab === 'summary' && (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-5">
              {/* Commercial Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Commercial Summary</h2>
                <div className="space-y-3">
                  {[
                    ['Project Code', project.project_code || '-'],
                    ['Project Name', project.project_name || '-'],
                    ['Client', project.client?.client_name || '-'],
                    ['Type', project.project_type || '-'],
                    ['Est. Value', project.project_estimated_value ? fmt(project.project_estimated_value) : '-'],
                    ['PO Required', project.po_required ? 'Yes' : 'No'],
                    ['PO Status', project.po_status || 'Pending'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-zinc-500 font-medium">{k}</span>
                      <span className="text-sm text-zinc-900 font-medium">{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Execution Summary */}
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
                <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Execution Summary</h2>
                <div className="space-y-3">
                  <div className="flex items-center justify-between py-2 border-b border-gray-100">
                    <span className="text-xs text-zinc-500 font-medium">Status</span>
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${getStatusDot(project.status)}`} />
                      <span className="text-sm font-medium text-zinc-900">{project.status || 'Draft'}</span>
                    </div>
                  </div>
                  {[
                    ['Start Date', fmtD(project.start_date)],
                    ['Expected End', fmtD(project.expected_end_date)],
                    ['Actual End', fmtD(project.actual_end_date)],
                    ['Completion', `${project.completion_percentage || 0}%`],
                    ['Remarks', project.remarks || '-'],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                      <span className="text-xs text-zinc-500 font-medium">{k}</span>
                      <span className="text-sm text-zinc-900 font-medium text-right max-w-[200px] truncate">{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Financial Summary */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
              <h2 className="text-[13px] font-bold uppercase tracking-widest text-zinc-500 mb-4">Financial Summary</h2>
              {!financialSummary ? (
                <div className="py-8 text-center text-sm text-zinc-400">
                  Click the POs / Invoices / Payments / Expenses tabs to load financial data.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                    {[
                      { label: 'Total PO Value', value: financialSummary.total_po_value, color: 'text-zinc-900' },
                      { label: 'Total Invoice', value: financialSummary.total_invoice_value, color: 'text-zinc-900' },
                      { label: 'Payment Received', value: financialSummary.total_payment_received, color: 'text-emerald-600' },
                      { label: 'Total Expense', value: financialSummary.total_expense, color: 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-50 rounded-xl p-4 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">{label}</div>
                        <div className={`text-lg font-bold ${color}`}>{fmt(value)}</div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Outstanding', value: financialSummary.outstanding_amount, color: financialSummary.outstanding_amount > 0 ? 'text-red-600' : 'text-emerald-600' },
                      { label: 'Profit', value: financialSummary.profit, color: financialSummary.profit >= 0 ? 'text-emerald-600' : 'text-red-600' },
                      { label: 'PO Balance', value: financialSummary.po_balance, color: financialSummary.po_balance >= 0 ? 'text-teal-600' : 'text-red-600' },
                    ].map(({ label, value, color }) => (
                      <div key={label} className="bg-gray-100 rounded-xl p-4 text-center">
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500 mb-2">{label}</div>
                        <div className={`text-xl font-bold ${color}`}>{fmt(value)}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}

        {/* ── POs ── */}
        {activeTab === 'pos' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900">Purchase Orders</h2>
              <button
                onClick={() => navigate(`/client-po/create?project_id=${project.id}`)}
                className="inline-flex items-center gap-2 bg-teal-300 text-zinc-900 rounded-full px-4 py-2 text-sm font-semibold hover:bg-teal-400 transition-colors"
              >
                <Plus size={14} />
                Create PO
              </button>
            </div>
            {projectPOs.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={40} strokeWidth={1} className="mx-auto text-zinc-300 mb-2" />
                <p className="text-sm text-zinc-400">No POs found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">PO Number</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total Value</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Utilized</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Available</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPOs.map(po => (
                    <tr key={po.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-900 font-medium">{po.po_number}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{fmtD(po.po_date)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 text-right font-medium">{fmt(po.po_total_value)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 text-right">{fmt(po.po_utilized_value)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 text-right">{fmt(po.po_available_value)}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${getPOStatusDot(po.status)}`} />
                          <span className="text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-zinc-700 rounded-full">{po.status}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Invoices ── */}
        {activeTab === 'invoices' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900">Invoices</h2>
              <button
                onClick={() => navigate(`/projects/invoice/new?project_id=${project.id}`)}
                className="inline-flex items-center gap-2 bg-teal-300 text-zinc-900 rounded-full px-4 py-2 text-sm font-semibold hover:bg-teal-400 transition-colors"
              >
                <Plus size={14} />
                Create Invoice
              </button>
            </div>
            {projectInvoices.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={40} strokeWidth={1} className="mx-auto text-zinc-300 mb-2" />
                <p className="text-sm text-zinc-400">No invoices found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Invoice</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Tax</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Total</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {projectInvoices.map(inv => (
                    <tr key={inv.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-900 font-medium">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{fmtD(inv.invoice_date)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 text-right">{fmt(inv.invoice_amount)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600 text-right">{fmt(inv.tax_amount)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 text-right font-semibold">{fmt(inv.total_amount)}</td>
                      <td className="px-4 py-3 text-[11px] font-medium px-2 py-0.5 bg-gray-100 text-zinc-700 rounded-full">{inv.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Payments ── */}
        {activeTab === 'payments' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900">Payments</h2>
              <button
                onClick={() => navigate(`/projects/payment/new?project_id=${project.id}`)}
                className="inline-flex items-center gap-2 bg-teal-300 text-zinc-900 rounded-full px-4 py-2 text-sm font-semibold hover:bg-teal-400 transition-colors"
              >
                <Plus size={14} />
                Record Payment
              </button>
            </div>
            {projectPayments.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={40} strokeWidth={1} className="mx-auto text-zinc-300 mb-2" />
                <p className="text-sm text-zinc-400">No payments found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Payment</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Mode</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {projectPayments.map(pay => (
                    <tr key={pay.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-900 font-medium">{pay.payment_number}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{fmtD(pay.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-emerald-600 text-right font-semibold">{fmt(pay.payment_amount)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{pay.payment_mode}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{pay.reference_number || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* ── Expenses ── */}
        {activeTab === 'expenses' && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm px-5 py-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-zinc-900">Expenses</h2>
              <button
                onClick={() => navigate(`/projects/expense/new?project_id=${project.id}`)}
                className="inline-flex items-center gap-2 bg-teal-300 text-zinc-900 rounded-full px-4 py-2 text-sm font-semibold hover:bg-teal-400 transition-colors"
              >
                <Plus size={14} />
                Add Expense
              </button>
            </div>
            {projectExpenses.length === 0 ? (
              <div className="py-12 text-center">
                <Package size={40} strokeWidth={1} className="mx-auto text-zinc-300 mb-2" />
                <p className="text-sm text-zinc-400">No expenses found</p>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Date</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Type</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Description</th>
                    <th className="px-4 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Vendor</th>
                    <th className="px-4 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-zinc-500">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {projectExpenses.map(exp => (
                    <tr key={exp.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3 text-sm text-zinc-600">{fmtD(exp.expense_date)}</td>
                      <td className="px-4 py-3 text-sm text-zinc-900 font-medium">{exp.expense_type}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{exp.description || '-'}</td>
                      <td className="px-4 py-3 text-sm text-zinc-600">{exp.vendor_name || '-'}</td>
                      <td className="px-4 py-3 text-sm text-red-600 text-right font-semibold">{fmt(exp.amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
