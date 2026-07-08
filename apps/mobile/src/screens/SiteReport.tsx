import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { z } from 'zod';
import { BottomSheetPicker } from '../components/BottomSheetPicker';
import {
  ClipboardCheck,
  Plus,
  ChevronLeft,
  ChevronRight,
  X,
  Calendar,
  Users,
  ShieldCheck,
  AlertTriangle,
  CheckCircle,
  FileText,
  ArrowRight,
  Loader2,
  Building,
  Hammer,
  CheckSquare,
  Trash2,
  ChevronDown,
  ChevronUp,
  Download,
} from 'lucide-react';

// ---------- Types ----------
interface SiteReportItem {
  id: string;
  report_date: string;
  project_name?: string;
  client?: string;
  pm_status: string;
  total_manpower?: number;
  percent_complete?: string | number | null;
  project_id?: string;
  created_at: string;
  work_carried_out?: Array<{ value: string; trade: string }>;
  work_plan_next_day?: Array<{ value: string }>;
  // FK join shapes from supabase
  projects?: { project_name: string } | null;
  clients?: { client_name: string } | null;
}

interface ClientItem {
  id: string;
  client_name: string;
}

interface SubcontractorItem {
  id: string;
  company_name: string;
}

interface Project {
  id: string;
  project_name: string;
  project_code?: string;
  client?: string;
  client_id?: string;
  clients?: { client_name: string } | null;
}

interface SiteReportProps {
  isDemo?: boolean;
  onFormDirtyChange?: (dirty: boolean) => void;
}

// ---------- Helpers ----------
const formatDateDMY = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}-${mm}-${yyyy}`;
};

const formatDateDMMMY = (dateStr: string) => {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getDate()).padStart(2, '0');
  return `${dd}-${months[d.getMonth()]}-${d.getFullYear()}`;
};

const STATUS_CONFIG: Record<string, { label: string; bg: string; text: string }> = {
  Draft:              { label: 'Draft',             bg: 'bg-slate-100',     text: 'text-slate-600' },
  Pending:            { label: 'Pending',           bg: 'bg-amber-50',      text: 'text-amber-600' },
  Reported:           { label: 'Reported',          bg: 'bg-blue-50',       text: 'text-blue-600' },
  'Pending Approval': { label: 'Pending Approval',  bg: 'bg-orange-50',     text: 'text-orange-600' },
  Approved:           { label: 'Approved',          bg: 'bg-green-50',      text: 'text-green-600' },
  Rejected:           { label: 'Rejected',          bg: 'bg-red-50',        text: 'text-red-600' },
  'On Hold':          { label: 'On Hold',           bg: 'bg-purple-50',     text: 'text-purple-600' },
};

const TRADE_OPTIONS = ['MEP', 'Civil', 'Electrical', 'Plumbing', 'HVAC', 'Carpentry', 'Other'];

// ---------- Section Collapse Helper ----------
const Section: React.FC<{
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  accent?: string;
}> = ({ title, icon, children, accent = 'text-primary' }) => {
  const [open, setOpen] = useState(true);
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 bg-secondary/40 hover:bg-secondary/70 transition-colors"
      >
        <div className={`flex items-center gap-2 ${accent} font-semibold text-sm`}>
          {icon}
          <span>{title}</span>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && <div className="p-4 space-y-3">{children}</div>}
    </div>
  );
};

// ---------- Field Helpers ----------
const FieldRow: React.FC<{ label: string; value?: string | number | null; accent?: string }> = ({ label, value, accent }) => (
  <div className="flex justify-between items-start gap-2">
    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex-shrink-0">{label}</span>
    <span className={`text-xs font-semibold text-right ${accent || 'text-foreground'}`}>{value ?? '—'}</span>
  </div>
);

// ---------- Demo Data ----------
const DEMO_REPORTS: SiteReportItem[] = [
  {
    id: 'sr-demo-1',
    report_date: new Date().toISOString().split('T')[0],
    project_name: 'Metro Line Expansion',
    client: 'Metro Rail Authority',
    pm_status: 'Reported',
    total_manpower: 18,
    percent_complete: 62,
    project_id: 'demo-p1',
    created_at: new Date().toISOString(),
    work_carried_out: [
      { value: 'Cable tray installation on 3rd floor completed', trade: 'Electrical' },
      { value: 'MS piping for HVAC supply done on floor 2', trade: 'HVAC' },
    ],
    work_plan_next_day: [
      { value: 'Complete fire alarm wiring in zones 4 & 5' },
      { value: 'Pressure test plumbing lines on floor 1' },
    ],
  },
  {
    id: 'sr-demo-2',
    report_date: new Date(Date.now() - 86400000).toISOString().split('T')[0],
    project_name: 'Commercial Complex B',
    client: 'BuildIt Infra',
    pm_status: 'Approved',
    total_manpower: 12,
    percent_complete: 45,
    project_id: 'demo-p2',
    created_at: new Date(Date.now() - 86400000).toISOString(),
    work_carried_out: [
      { value: 'Conduit laying for LV panel room done', trade: 'Electrical' },
    ],
    work_plan_next_day: [
      { value: 'Terminate cables at MDB' },
    ],
  },
  {
    id: 'sr-demo-3',
    report_date: new Date(Date.now() - 172800000).toISOString().split('T')[0],
    project_name: 'Metro Line Expansion',
    client: 'Metro Rail Authority',
    pm_status: 'Draft',
    total_manpower: 10,
    percent_complete: 58,
    project_id: 'demo-p1',
    created_at: new Date(Date.now() - 172800000).toISOString(),
    work_carried_out: [
      { value: 'Earthing strip connection at transformer room', trade: 'Electrical' },
    ],
    work_plan_next_day: [
      { value: 'Continue cable pulling – Zone 3' },
    ],
  },
];

const DEMO_PROJECTS: Project[] = [
  { id: 'demo-p1', project_name: 'Metro Line Expansion', project_code: 'MLE-04', client: 'Metro Rail Authority' },
  { id: 'demo-p2', project_name: 'Commercial Complex B', project_code: 'CCB-12', client: 'BuildIt Infra' },
];

const DEMO_CLIENTS = [
  { id: 'demo-c1', client_name: 'Metro Rail Authority' },
  { id: 'demo-c2', client_name: 'BuildIt Infra' },
];

const DEMO_SUBCONTRACTORS = [
  { id: 'demo-s1', company_name: 'Alpha MEP Services' },
  { id: 'demo-s2', company_name: 'Beta Civil Works' },
];

// =============================================
// Main Component
// =============================================
export const SiteReport: React.FC<SiteReportProps> = ({ isDemo = false, onFormDirtyChange }) => {
  type ViewMode = 'list' | 'create' | 'view';
  const [view, setView] = useState<ViewMode>('list');
  const [reports, setReports] = useState<SiteReportItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [subcontractors, setSubcontractors] = useState<SubcontractorItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedReport, setSelectedReport] = useState<SiteReportItem | null>(null);
  const [step, setStep] = useState(0);

  // Form state
  const blankForm = () => ({
    project_id: '',
    client_id: '',   // UUID of selected client
    client: '',      // display name (typed or from dropdown)
    report_date: new Date().toISOString().split('T')[0],
    // Manpower
    total_manpower: '',
    skilled: '',
    unskilled: '',
    start_time: '08:00',
    end_time: '17:00',
    // Subcontractors
    subcontractors: [] as Array<{ subcontractor_id?: string; name: string; count: string; start: string; end: string }>,
    // Work
    work_carried_out: [{ value: '', trade: 'MEP' }],
    work_plan_next_day: [{ value: '' }],
    // Progress
    planned_progress: '',
    actual_progress: '',
    percent_complete: '',
    // Equipment
    equipment_on_site: '',
    equipment_breakdown: '',
    equipment_no_fault: false,
    equipment_no_fault_notes: '',
    // Safety
    toolbox_meeting: false,
    ppe_complied: false,
    // Quality
    quality_inspection: 'Not Required' as 'Yes' | 'Pending' | 'Not Required',
    satisfied_percent: '',
    rework_required: false,
    rework_reason: '',
    // Issues
    issues: [{ issue: '', solution: '' }],
    // Client Req
    client_requirements: [{ value: '' }],
    quote_to_be_sent: false,
    // Reporting
    pm_status: 'Draft' as string,
    material_arrangement: 'Pending' as string,
    // Footer
    engineer_name: '',
    signature_date: new Date().toISOString().split('T')[0],
    // Special instructions
    special_instructions: [{ value: '' }],
  });

  const [form, setForm] = useState(blankForm());

  // ---- Dirty form tracking ----
  const blankFormStr = useMemo(() => JSON.stringify(blankForm()), []);
  const isFormDirty = view === 'create' && JSON.stringify(form) !== blankFormStr;
  const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);

  useEffect(() => {
    onFormDirtyChange?.(isFormDirty);
    return () => onFormDirtyChange?.(false);
  }, [isFormDirty, onFormDirtyChange]);

  const handleCreateCancel = () => {
    if (isFormDirty) {
      setShowUnsavedDialog(true);
    } else {
      setView('list');
      setStep(0);
      setForm(blankForm());
    }
  };

  const confirmDiscardForm = () => {
    setShowUnsavedDialog(false);
    setView('list');
    setStep(0);
    setForm(blankForm());
  };

  // ---- Load ----
  useEffect(() => {
    if (isDemo) {
      setReports(DEMO_REPORTS);
      setProjects(DEMO_PROJECTS);
      setClients(DEMO_CLIENTS);
      setSubcontractors(DEMO_SUBCONTRACTORS);
      setLoading(false);
    } else {
      fetchData();
    }
  }, [isDemo]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Resolve organisation_id via org_members (same pattern as Dashboard/Approvals)
      const { data: memberData, error: memberError } = await supabase
        .from('org_members')
        .select('organisation_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError) throw memberError;
      const orgId = memberData?.organisation_id;
      if (!orgId) return;

      // Fetch site reports, projects, clients, and subcontractors
      const [reportsRes, projectsRes, clientsRes, subcontractorsRes] = await Promise.all([
        supabase
          .from('site_reports')
          .select('id, report_date, pm_status, engineer_name, client_id, project_id, created_at, total_manpower, percent_complete, projects(project_name), clients(client_name)')
          .eq('organisation_id', orgId)
          .order('report_date', { ascending: false })
          .limit(50),
        supabase
          .from('projects')
          .select('id, project_name, project_code')
          .eq('organisation_id', orgId)
          .order('project_name'),
        supabase
          .from('clients')
          .select('id, client_name')
          .eq('organisation_id', orgId)
          .order('client_name'),
        supabase
          .from('subcontractors')
          .select('id, company_name')
          .eq('organisation_id', orgId)
          .eq('status', 'Active')
          .order('company_name'),
      ]);

      // Normalize reports — extract project_name and client from FK joins
      const normalizedReports: SiteReportItem[] = (reportsRes.data || []).map((r: any) => ({
        ...r,
        project_name: r.projects?.project_name || r.project_name || '',
        client: r.clients?.client_name || r.client || '',
      }));

      setReports(normalizedReports);

      // Map projects
      setProjects((projectsRes.data || []).map((p: any) => ({ ...p, client: '' })));

      // Store clients separately for the dropdown
      setClients((clientsRes.data || []) as ClientItem[]);

      // Store subcontractors separately
      setSubcontractors((subcontractorsRes.data || []) as SubcontractorItem[]);

    } catch (e) {
      console.error('fetchData error:', e);
    } finally {
      setLoading(false);
    }
  };


  const handleSubmitWithStatus = async (overrideStatus?: string) => {
    // Zod validation for report date (cannot be in the future)
    const reportDateSchema = z.string().refine((val) => {
      const selectedDate = new Date(val);
      const today = new Date();
      selectedDate.setHours(0, 0, 0, 0);
      today.setHours(0, 0, 0, 0);
      return selectedDate <= today;
    }, {
      message: "Report cannot be created for future dates",
    });

    const dateResult = reportDateSchema.safeParse(form.report_date);
    if (!dateResult.success) {
      alert(dateResult.error.errors[0].message);
      return;
    }

    const proj = projects.find(p => p.id === form.project_id);
    const payload = {
      project_id: form.project_id || null,
      client_id: form.client_id || null,
      project_name: proj?.project_name || '',
      client: form.client || proj?.client || '',
      report_date: form.report_date,
      total_manpower: parseInt(form.total_manpower || '0'),
      skilled_manpower: parseInt(form.skilled || '0'),
      unskilled_manpower: parseInt(form.unskilled || '0'),
      start_time: form.start_time,
      end_time: form.end_time,
      planned_progress: form.planned_progress,
      actual_progress: form.actual_progress,
      percent_complete: form.percent_complete || '0',
      equipment_on_site: form.equipment_on_site,
      equipment_breakdown: form.equipment_no_fault ? '' : form.equipment_breakdown,
      equipment_no_fault: form.equipment_no_fault,
      equipment_no_fault_notes: form.equipment_no_fault ? form.equipment_no_fault_notes : '',
      toolbox_meeting: form.toolbox_meeting,
      ppe_followed: form.ppe_complied,
      inspection_status: form.quality_inspection,
      satisfied_percent: form.satisfied_percent,
      is_rework: form.rework_required,
      rework_reason: form.rework_reason,
      issues_faced: form.issues.filter(i => i.issue.trim()).map(i => `${i.issue}: ${i.solution}`).join('\n'),
      client_req_details: form.client_requirements.filter(c => c.value.trim()).map(c => c.value).join('\n'),
      quote_to_be_sent: form.quote_to_be_sent,
      pm_status: overrideStatus || form.pm_status,
      material_arrangement: form.material_arrangement,
      work_plan_next_day: form.work_plan_next_day.filter(w => w.value.trim()).map(w => w.value).join('\n'),
      special_instructions: form.special_instructions.filter(s => s.value.trim()).map(s => s.value).join('\n'),
      engineer_name: form.engineer_name,
      signature_date: form.signature_date,
    };

    if (isDemo) {
      const newReport: SiteReportItem = {
        id: `sr-demo-${Date.now()}`,
        report_date: form.report_date,
        project_name: proj?.project_name || '',
        client: form.client || proj?.client || '',
        pm_status: overrideStatus || form.pm_status,
        total_manpower: parseInt(form.total_manpower || '0'),
        percent_complete: parseFloat(form.percent_complete || '0'),
        project_id: form.project_id,
        created_at: new Date().toISOString(),
        work_carried_out: form.work_carried_out.filter(w => w.value.trim()),
        work_plan_next_day: form.work_plan_next_day.filter(w => w.value.trim()),
      };
      setReports(prev => [newReport, ...prev]);
      setView('list');
      setForm(blankForm());
      setStep(0);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    const { data: profileA } = await supabase
      .from('user_profiles')
      .select('organisation_id, organization_id')
      .eq('user_id', user!.id)
      .maybeSingle();
    const orgId = profileA
      ? ((profileA as any).organisation_id || (profileA as any).organization_id)
      : null;

    const insertPayload = { ...payload, organisation_id: orgId, organization_id: orgId };
    const { data: newRow } = await supabase.from('site_reports').insert(insertPayload).select('id').single();

    if (newRow?.id && form.subcontractors.filter(s => s.name.trim()).length > 0) {
      await supabase.from('sub_contractors').insert(
        form.subcontractors
          .filter(s => s.name.trim())
          .map(s => ({
            report_id: newRow.id,
            organization_id: orgId,
            name: s.name,
            count: s.count,
            start_time: s.start || null,
            end_time: s.end || null,
            subcontractor_id: s.subcontractor_id || null,
          }))
      );
    }

    await fetchData();
    setView('list');
    setForm(blankForm());
    setStep(0);
  };

  // ---- Steps for create flow ----
  const STEPS = [
    'Basic Info',
    'Manpower',
    'Work Done',
    'Progress',
    'Safety & Quality',
    'Client & Issues',
    'Next Day Plan',
    'Review',
  ];
  const totalSteps = STEPS.length;

  // ===================== VIEW: LIST =====================
  if (view === 'list') {
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10">
                <ClipboardCheck className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-bold tracking-tight text-foreground">Site Reports</h1>
                <p className="text-[10px] text-muted-foreground">{reports.length} reports</p>
              </div>
            </div>
            <button
              onClick={() => { setStep(0); setForm(blankForm()); setView('create'); }}
              className="flex items-center gap-1.5 bg-primary text-primary-foreground text-xs font-semibold px-3 py-2 rounded-xl active:scale-95 transition-transform shadow-md shadow-primary/30"
            >
              <Plus className="h-3.5 w-3.5" />
              New Report
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-sm text-muted-foreground">Loading reports...</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="p-5 rounded-full bg-secondary">
                <ClipboardCheck className="h-10 w-10 text-muted-foreground" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-foreground">No site reports yet</p>
                <p className="text-xs text-muted-foreground mt-1">Tap "New Report" to log your first daily site report</p>
              </div>
              <button
                onClick={() => { setStep(0); setForm(blankForm()); setView('create'); }}
                className="bg-primary text-primary-foreground text-sm font-semibold px-6 py-2.5 rounded-xl active:scale-95 transition-transform"
              >
                Create First Report
              </button>
            </div>
          ) : (
            reports.map((r, i) => {
              const status = STATUS_CONFIG[r.pm_status] || STATUS_CONFIG['Draft'];
              return (
                <div
                  key={r.id}
                  onClick={() => { setSelectedReport(r); setView('view'); }}
                  className="glass-card rounded-2xl p-4 active:scale-[0.99] transition-all cursor-pointer border border-border/40 hover:border-primary/20"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{r.project_name || '—'}</h3>
                      <p className="text-[10px] text-muted-foreground mt-0.5">{r.client || 'No client'}</p>
                    </div>
                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${status.bg} ${status.text}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-3">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{formatDateDMY(r.report_date)}</span>
                    </div>
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Users className="h-3 w-3" />
                      <span className="text-[10px] font-medium">{r.total_manpower ?? '—'} workers</span>
                    </div>
                    {r.percent_complete !== undefined && r.percent_complete !== null && (
                      <div className="flex items-center gap-1.5 text-primary">
                        <CheckCircle className="h-3 w-3" />
                        <span className="text-[10px] font-semibold">{r.percent_complete}% done</span>
                      </div>
                    )}
                  </div>

                  {r.work_carried_out && r.work_carried_out.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <p className="text-[10px] text-muted-foreground line-clamp-1">
                        {r.work_carried_out[0].value}
                        {r.work_carried_out.length > 1 && ` +${r.work_carried_out.length - 1} more`}
                      </p>
                    </div>
                  )}

                  <div className="flex justify-end mt-2">
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  }

  // ===================== VIEW: DETAIL =====================
  if (view === 'view' && selectedReport) {
    const r = selectedReport;
    const status = STATUS_CONFIG[r.pm_status] || STATUS_CONFIG['Draft'];
    return (
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
          <div className="max-w-lg mx-auto flex items-center gap-3">
            <button
              onClick={() => setView('list')}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
            >
              <ChevronLeft className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-foreground truncate">{r.project_name}</h1>
              <p className="text-[10px] text-muted-foreground">{formatDateDMMMY(r.report_date)}</p>
            </div>
            <span className={`text-[9px] font-bold px-2.5 py-1 rounded-full ${status.bg} ${status.text}`}>
              {status.label}
            </span>
            <button
              onClick={() => window.print()}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
              title="Download PDF"
            >
              <Download className="h-4 w-4 text-foreground" />
            </button>
          </div>
        </div>

        <div className="max-w-lg mx-auto px-4 pt-4 space-y-3">
          {/* Key Stats */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Manpower', value: r.total_manpower ?? '—', icon: <Users className="h-4 w-4" />, color: 'text-blue-600' },
              { label: '% Complete', value: r.percent_complete != null ? `${r.percent_complete}%` : '—', icon: <CheckCircle className="h-4 w-4" />, color: 'text-primary' },
              { label: 'Report Date', value: formatDateDMY(r.report_date), icon: <Calendar className="h-4 w-4" />, color: 'text-slate-500' },
            ].map(stat => (
              <div key={stat.label} className="glass-card rounded-2xl p-3 text-center">
                <div className={`flex justify-center mb-1 ${stat.color}`}>{stat.icon}</div>
                <p className="text-sm font-bold text-foreground">{stat.value}</p>
                <p className="text-[9px] font-medium text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Client */}
          <Section title="Project Info" icon={<Building className="h-4 w-4" />}>
            <FieldRow label="Client" value={r.client} />
            <FieldRow label="Project" value={r.project_name} />
            <FieldRow label="Report Date" value={formatDateDMMMY(r.report_date)} />
          </Section>

          {/* Work Carried Out */}
          {r.work_carried_out && r.work_carried_out.length > 0 && (
            <Section title="Work Carried Out" icon={<Hammer className="h-4 w-4" />} accent="text-blue-600">
              <div className="space-y-2">
                {r.work_carried_out.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="h-5 w-5 flex-shrink-0 flex items-center justify-center rounded-full bg-primary/10 text-primary text-[9px] font-bold">{i + 1}</span>
                    <div>
                      <p className="text-xs font-semibold text-foreground">{w.value}</p>
                      <p className="text-[9px] text-muted-foreground">{w.trade}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Next Day Plan */}
          {r.work_plan_next_day && r.work_plan_next_day.length > 0 && (
            <Section title="Next Day Plan" icon={<ArrowRight className="h-4 w-4" />} accent="text-amber-600">
              <div className="space-y-2">
                {r.work_plan_next_day.map((w, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <CheckSquare className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs font-medium text-foreground">{w.value}</p>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {/* Status */}
          <Section title="Reporting Status" icon={<FileText className="h-4 w-4" />} accent="text-slate-600">
            <FieldRow label="PM Status" value={r.pm_status} />
            <FieldRow label="Created" value={formatDateDMMMY(r.created_at)} />
          </Section>
        </div>
      </div>
    );
  }

  // ===================== VIEW: CREATE =====================
  const proj = projects.find(p => p.id === form.project_id);

  const renderStep = () => {
    switch (step) {
      // ---- Step 0: Basic Info ----
      case 0:
        return (
          <div className="space-y-4">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Client *</label>
              <BottomSheetPicker
                label="Select Client"
                placeholder="Select client..."
                options={clients.map(c => ({ id: c.id, name: c.client_name }))}
                value={form.client_id}
                onChange={val => {
                  const c = clients.find(cl => cl.id === val);
                  setForm(f => ({ ...f, client_id: val, client: c?.client_name || '' }));
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Project *</label>
              <BottomSheetPicker
                label="Select Project"
                placeholder="Select project..."
                options={projects.map(p => ({ id: p.id, name: p.project_code ? `${p.project_name} (${p.project_code})` : p.project_name }))}
                value={form.project_id}
                onChange={val => {
                  const p = projects.find(pr => pr.id === val);
                  setForm(f => ({ ...f, project_id: val, client: p?.client || f.client, client_id: p?.client_id || f.client_id }));
                }}
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Report Date *</label>
              <input
                type="date"
                value={form.report_date}
                onChange={e => setForm(f => ({ ...f, report_date: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">PM Status</label>
              <select
                value={form.pm_status}
                onChange={e => setForm(f => ({ ...f, pm_status: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Engineer / Supervisor Name *</label>
              <input
                type="text"
                value={form.engineer_name}
                onChange={e => setForm(f => ({ ...f, engineer_name: e.target.value }))}
                placeholder="Name of engineer submitting"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        );

      // ---- Step 1: Manpower ----
      case 1:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'total_manpower', label: 'Total' },
                { key: 'skilled', label: 'Skilled' },
                { key: 'unskilled', label: 'Unskilled' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type="number"
                    min="0"
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Start Time</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">End Time</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            {/* Subcontractors */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Subcontractors</p>
                <button
                  onClick={() => setForm(f => ({ ...f, subcontractors: [...f.subcontractors, { name: '', count: '', start: '', end: '' }] }))}
                  className="text-[10px] font-semibold text-primary flex items-center gap-1"
                >
                  + Add
                </button>
              </div>
              {form.subcontractors.length === 0 ? (
                <button
                  onClick={() => setForm(f => ({ ...f, subcontractors: [{ name: '', count: '', start: '', end: '' }] }))}
                  className="w-full py-2.5 rounded-xl border-2 border-dashed border-primary/20 text-muted-foreground text-xs font-semibold"
                >
                  + Add Subcontractor
                </button>
              ) : (
                <div className="space-y-2">
                  {form.subcontractors.map((sc, i) => (
                    <div key={i} className="glass-card rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-muted-foreground">Subcontractor {i + 1}</span>
                        <button
                          onClick={() => setForm(f => ({ ...f, subcontractors: f.subcontractors.filter((_, idx) => idx !== i) }))}
                          className="text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <div className="col-span-2">
                          <BottomSheetPicker
                            label="Select Subcontractor"
                            placeholder="Select Subcontractor..."
                            options={subcontractors.map(s => ({ id: s.id, name: s.company_name }))}
                            value={sc.subcontractor_id || ''}
                            onChange={val => {
                              const selectedSub = subcontractors.find(s => s.id === val);
                              if (selectedSub) {
                                setForm(f => {
                                  const arr = [...f.subcontractors];
                                  arr[i] = {
                                    ...arr[i],
                                    name: selectedSub.company_name,
                                    subcontractor_id: selectedSub.id
                                  };
                                  return { ...f, subcontractors: arr };
                                });
                              }
                            }}
                          />
                        </div>
                        <input
                          type="number"
                          value={sc.count}
                          onChange={e => setForm(f => { const arr = [...f.subcontractors]; arr[i] = { ...arr[i], count: e.target.value }; return { ...f, subcontractors: arr }; })}
                          placeholder="Count"
                          className="h-9 rounded-xl border border-input bg-background px-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
                        />
                        <div className="grid grid-cols-2 gap-1">
                          <input
                            type="time"
                            value={sc.start}
                            onChange={e => setForm(f => { const arr = [...f.subcontractors]; arr[i] = { ...arr[i], start: e.target.value }; return { ...f, subcontractors: arr }; })}
                            className="h-9 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <input
                            type="time"
                            value={sc.end}
                            onChange={e => setForm(f => { const arr = [...f.subcontractors]; arr[i] = { ...arr[i], end: e.target.value }; return { ...f, subcontractors: arr }; })}
                            className="h-9 rounded-xl border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      // ---- Step 2: Work Done ----
      case 2:
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">List all work carried out today on site.</p>
            {form.work_carried_out.map((w, i) => (
              <div key={i} className="glass-card rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-muted-foreground">Work Item {i + 1}</span>
                  {form.work_carried_out.length > 1 && (
                    <button
                      onClick={() => setForm(f => ({ ...f, work_carried_out: f.work_carried_out.filter((_, idx) => idx !== i) }))}
                      className="text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <textarea
                  value={w.value}
                  onChange={e => setForm(f => {
                    const arr = [...f.work_carried_out];
                    arr[i] = { ...arr[i], value: e.target.value };
                    return { ...f, work_carried_out: arr };
                  })}
                  rows={2}
                  placeholder="Describe the work done…"
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                <select
                  value={w.trade}
                  onChange={e => setForm(f => {
                    const arr = [...f.work_carried_out];
                    arr[i] = { ...arr[i], trade: e.target.value };
                    return { ...f, work_carried_out: arr };
                  })}
                  className="w-full h-9 rounded-xl border border-input bg-background px-3 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
                >
                  {TRADE_OPTIONS.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
            ))}
            <button
              onClick={() => setForm(f => ({ ...f, work_carried_out: [...f.work_carried_out, { value: '', trade: 'MEP' }] }))}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-primary/30 text-primary text-xs font-semibold active:scale-95 transition-transform"
            >
              + Add Work Item
            </button>
          </div>
        );

      // ---- Step 3: Progress ----
      case 3:
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: 'planned_progress', label: 'Planned %' },
                { key: 'actual_progress', label: 'Actual %' },
                { key: 'percent_complete', label: 'Overall %' },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">{f.label}</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={(form as any)[f.key]}
                    onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                    className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm text-center font-bold focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="0"
                  />
                </div>
              ))}
            </div>
            {form.percent_complete && (
              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                  <span>Overall completion</span>
                  <span className="font-bold text-primary">{form.percent_complete}%</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min(parseFloat(form.percent_complete) || 0, 100)}%` }}
                  />
                </div>
              </div>
            )}
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Equipment On Site</label>
              <input
                type="text"
                value={form.equipment_on_site}
                onChange={e => setForm(f => ({ ...f, equipment_on_site: e.target.value }))}
                placeholder="e.g. 1 Crane, 2 Compressors"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Equipment Status</label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, equipment_no_fault: false }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${
                    !form.equipment_no_fault
                      ? 'bg-red-50 border-red-300 text-red-700'
                      : 'bg-white border-border text-muted-foreground'
                  }`}
                >
                  Breakdown / Fault
                </button>
                <button
                  type="button"
                  onClick={() => setForm(f => ({ ...f, equipment_no_fault: true, equipment_breakdown: '' }))}
                  className={`flex-1 py-2 rounded-xl border text-xs font-semibold ${
                    form.equipment_no_fault
                      ? 'bg-green-50 border-green-300 text-green-700'
                      : 'bg-white border-border text-muted-foreground'
                  }`}
                >
                  No Equipment Fault
                </button>
              </div>
              {form.equipment_no_fault ? (
                <input
                  type="text"
                  value={form.equipment_no_fault_notes}
                  onChange={e => setForm(f => ({ ...f, equipment_no_fault_notes: e.target.value }))}
                  placeholder="All equipment functioning normally. Optional notes..."
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              ) : (
                <input
                  type="text"
                  value={form.equipment_breakdown}
                  onChange={e => setForm(f => ({ ...f, equipment_breakdown: e.target.value }))}
                  placeholder="Any breakdown details or NIL"
                  className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Material Arrangement</label>
              <select
                value={form.material_arrangement}
                onChange={e => setForm(f => ({ ...f, material_arrangement: e.target.value }))}
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {['Arranged', 'Pending', 'Not Required', 'Informed to stores'].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
        );

      // ---- Step 4: Safety & Quality ----
      case 4:
        return (
          <div className="space-y-4">
            <div className="space-y-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Safety Checks</p>
              {[
                { key: 'toolbox_meeting', label: 'Toolbox Meeting Conducted' },
                { key: 'ppe_complied', label: 'PPE Compliance' },
              ].map(item => (
                <div
                  key={item.key}
                  onClick={() => setForm(f => ({ ...f, [item.key]: !(f as any)[item.key] }))}
                  className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                    (form as any)[item.key]
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-card'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`h-4 w-4 ${(form as any)[item.key] ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                  </div>
                  <div className={`h-5 w-9 rounded-full transition-all flex items-center px-1 ${(form as any)[item.key] ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}>
                    <div className="h-3.5 w-3.5 bg-white rounded-full shadow" />
                  </div>
                </div>
              ))}
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Quality Inspection</label>
              <div className="flex gap-2">
                {(['Yes', 'Pending', 'Not Required'] as const).map(opt => (
                  <button
                    key={opt}
                    onClick={() => setForm(f => ({ ...f, quality_inspection: opt }))}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${
                      form.quality_inspection === opt
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border text-muted-foreground'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block mb-1">Satisfied %</label>
              <input
                type="number"
                min="0" max="100"
                value={form.satisfied_percent}
                onChange={e => setForm(f => ({ ...f, satisfied_percent: e.target.value }))}
                placeholder="e.g. 90"
                className="w-full h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            <div
              onClick={() => setForm(f => ({ ...f, rework_required: !f.rework_required }))}
              className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition-all ${
                form.rework_required ? 'border-destructive/50 bg-destructive/5' : 'border-border bg-card'
              }`}
            >
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-4 w-4 ${form.rework_required ? 'text-destructive' : 'text-muted-foreground'}`} />
                <span className="text-sm font-medium text-foreground">Rework Required</span>
              </div>
              <div className={`h-5 w-9 rounded-full transition-all flex items-center px-1 ${form.rework_required ? 'bg-destructive justify-end' : 'bg-muted justify-start'}`}>
                <div className="h-3.5 w-3.5 bg-white rounded-full shadow" />
              </div>
            </div>

            {form.rework_required && (
              <textarea
                value={form.rework_reason}
                onChange={e => setForm(f => ({ ...f, rework_reason: e.target.value }))}
                rows={2}
                placeholder="Reason for rework…"
                className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            )}
          </div>
        );

      // ---- Step 5: Client & Issues ----
      case 5:
        return (
          <div className="space-y-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Client Requirements</p>
              {form.client_requirements.map((c, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={c.value}
                    onChange={e => setForm(f => {
                      const arr = [...f.client_requirements];
                      arr[i] = { value: e.target.value };
                      return { ...f, client_requirements: arr };
                    })}
                    placeholder={`Requirement ${i + 1}…`}
                    className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {form.client_requirements.length > 1 && (
                    <button
                      onClick={() => setForm(f => ({ ...f, client_requirements: f.client_requirements.filter((_, idx) => idx !== i) }))}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setForm(f => ({ ...f, client_requirements: [...f.client_requirements, { value: '' }] }))}
                className="w-full py-2 rounded-xl border-2 border-dashed border-primary/30 text-primary text-xs font-semibold"
              >
                + Add Requirement
              </button>
              <div
                onClick={() => setForm(f => ({ ...f, quote_to_be_sent: !f.quote_to_be_sent }))}
                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer mt-3 transition-all ${form.quote_to_be_sent ? 'border-primary bg-primary/10' : 'border-border bg-card'}`}
              >
                <span className="text-sm font-medium text-foreground">Quote to be sent</span>
                <div className={`h-5 w-9 rounded-full flex items-center px-1 transition-all ${form.quote_to_be_sent ? 'bg-primary justify-end' : 'bg-muted justify-start'}`}>
                  <div className="h-3.5 w-3.5 bg-white rounded-full shadow" />
                </div>
              </div>
            </div>

            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Issues & Solutions</p>
              {form.issues.map((iss, i) => (
                <div key={i} className="glass-card rounded-xl p-3 space-y-2 mb-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-muted-foreground">Issue {i + 1}</span>
                    {form.issues.length > 1 && (
                      <button onClick={() => setForm(f => ({ ...f, issues: f.issues.filter((_, idx) => idx !== i) }))} className="text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={iss.issue}
                    onChange={e => setForm(f => { const arr = [...f.issues]; arr[i] = { ...arr[i], issue: e.target.value }; return { ...f, issues: arr }; })}
                    placeholder="Describe the issue…"
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <input
                    type="text"
                    value={iss.solution}
                    onChange={e => setForm(f => { const arr = [...f.issues]; arr[i] = { ...arr[i], solution: e.target.value }; return { ...f, issues: arr }; })}
                    placeholder="Proposed solution…"
                    className="w-full h-9 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
              ))}
              <button
                onClick={() => setForm(f => ({ ...f, issues: [...f.issues, { issue: '', solution: '' }] }))}
                className="w-full py-2 rounded-xl border-2 border-dashed border-amber-400/40 text-amber-600 text-xs font-semibold"
              >
                + Add Issue
              </button>
            </div>
          </div>
        );

      // ---- Step 6: Next Day Plan ----
      case 6:
        return (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Plan the work for tomorrow on site.</p>
            {form.work_plan_next_day.map((w, i) => (
              <div key={i} className="flex gap-2 items-start">
                <div className="h-7 w-7 flex-shrink-0 flex items-center justify-center rounded-full bg-amber-100 text-amber-600 text-[10px] font-bold mt-2">{i + 1}</div>
                <textarea
                  value={w.value}
                  onChange={e => setForm(f => {
                    const arr = [...f.work_plan_next_day];
                    arr[i] = { value: e.target.value };
                    return { ...f, work_plan_next_day: arr };
                  })}
                  rows={2}
                  placeholder="Work to be done tomorrow…"
                  className="flex-1 rounded-xl border border-input bg-background px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
                {form.work_plan_next_day.length > 1 && (
                  <button
                    onClick={() => setForm(f => ({ ...f, work_plan_next_day: f.work_plan_next_day.filter((_, idx) => idx !== i) }))}
                    className="text-destructive mt-2"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
            <button
              onClick={() => setForm(f => ({ ...f, work_plan_next_day: [...f.work_plan_next_day, { value: '' }] }))}
              className="w-full py-2.5 rounded-xl border-2 border-dashed border-amber-400/40 text-amber-600 text-xs font-semibold active:scale-95 transition-transform"
            >
              + Add Plan Item
            </button>

            <div className="mt-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Special Instructions (Optional)</p>
              {form.special_instructions.map((s, i) => (
                <div key={i} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={s.value}
                    onChange={e => setForm(f => { const arr = [...f.special_instructions]; arr[i] = { value: e.target.value }; return { ...f, special_instructions: arr }; })}
                    placeholder={`Instruction ${i + 1}…`}
                    className="flex-1 h-11 rounded-xl border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  {form.special_instructions.length > 1 && (
                    <button onClick={() => setForm(f => ({ ...f, special_instructions: f.special_instructions.filter((_, idx) => idx !== i) }))} className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setForm(f => ({ ...f, special_instructions: [...f.special_instructions, { value: '' }] }))}
                className="w-full py-2 rounded-xl border-2 border-dashed border-border text-muted-foreground text-xs font-semibold"
              >
                + Add Instruction
              </button>
            </div>
          </div>
        );

      // ---- Step 7: Review ----
      case 7:
        return (
          <div className="space-y-3">
            <div className="glass-card rounded-2xl p-4 space-y-2">
              <p className="text-xs font-bold text-foreground mb-3">Review Summary</p>
              <FieldRow label="Project" value={proj?.project_name} />
              <FieldRow label="Client" value={form.client} />
              <FieldRow label="Report Date" value={formatDateDMMMY(form.report_date)} />
              <FieldRow label="Engineer" value={form.engineer_name} />
              <FieldRow label="Total Manpower" value={form.total_manpower || '0'} />
              <FieldRow label="Overall %" value={form.percent_complete ? `${form.percent_complete}%` : '—'} accent="text-primary" />
              <FieldRow label="PM Status" value={form.pm_status} />
              <FieldRow label="Work Items" value={`${form.work_carried_out.filter(w => w.value).length} item(s)`} />
              <FieldRow label="Next Day Plans" value={`${form.work_plan_next_day.filter(w => w.value).length} item(s)`} />
              <FieldRow label="Safety - Toolbox" value={form.toolbox_meeting ? 'Yes ✓' : 'No'} accent={form.toolbox_meeting ? 'text-primary' : 'text-muted-foreground'} />
              <FieldRow label="Safety - PPE" value={form.ppe_complied ? 'Yes ✓' : 'No'} accent={form.ppe_complied ? 'text-primary' : 'text-muted-foreground'} />
              <FieldRow label="Rework Required" value={form.rework_required ? 'Yes' : 'No'} accent={form.rework_required ? 'text-destructive' : 'text-foreground'} />
            </div>
            <p className="text-[10px] text-muted-foreground text-center">Please review all details before submitting.</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24 flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur-xl border-b border-border px-4 pt-10 pb-3">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={handleCreateCancel}
              className="p-2 rounded-xl bg-secondary active:scale-95 transition-transform"
            >
              <X className="h-4 w-4 text-foreground" />
            </button>
            <div className="flex-1">
              <h1 className="text-base font-bold text-foreground">New Site Report</h1>
              <p className="text-[10px] text-muted-foreground">Step {step + 1} of {totalSteps} — {STEPS[step]}</p>
            </div>
          </div>
          {/* Progress bar */}
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${((step + 1) / totalSteps) * 100}%` }}
            />
          </div>
          {/* Step dots */}
          <div className="flex justify-center gap-1.5 mt-2">
            {STEPS.map((_s, i) => (
              <div
                key={i}
                className={`h-1 rounded-full transition-all duration-300 ${
                  i === step ? 'w-6 bg-primary' : i < step ? 'w-2 bg-primary/40' : 'w-2 bg-secondary'
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-lg mx-auto px-4 pt-5 pb-4">
          <div className="mb-4">
            <h2 className="text-sm font-bold text-foreground">{STEPS[step]}</h2>
          </div>
          {renderStep()}
        </div>
      </div>

      {/* Navigation */}
      <div className="fixed bottom-16 left-0 right-0 z-20 bg-card/90 backdrop-blur-xl border-t border-border px-4 py-3">
        <div className="max-w-lg mx-auto space-y-2">
          <div className="flex gap-3">
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="flex-1 h-11 rounded-xl border border-border text-sm font-semibold text-foreground active:scale-95 transition-transform"
              >
                Back
              </button>
            )}
            {step < totalSteps - 1 ? (
              <button
                onClick={() => setStep(s => s + 1)}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform shadow-md shadow-primary/30 flex items-center justify-center gap-2"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            ) : (
              <button
                onClick={() => { setSubmitting(true); handleSubmitWithStatus().finally(() => setSubmitting(false)); }}
                disabled={submitting}
                className="flex-1 h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold active:scale-95 transition-transform shadow-md shadow-primary/30 flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
                {submitting ? 'Submitting…' : 'Submit Report'}
              </button>
            )}
          </div>
          {/* Save Draft — always visible */}
          <button
            onClick={() => { setSubmitting(true); handleSubmitWithStatus('Draft').finally(() => setSubmitting(false)); }}
            disabled={submitting}
            className="w-full h-9 rounded-xl border border-border text-xs font-semibold text-muted-foreground active:scale-95 transition-transform flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
            Save as Draft
          </button>
        </div>
      </div>

      {/* Unsaved Changes Dialog */}
      {showUnsavedDialog && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-6">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUnsavedDialog(false)} />
          <div className="relative bg-card rounded-2xl p-6 max-w-sm w-full border border-border shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Unsaved Changes</h3>
              </div>
            </div>
            <p className="text-sm text-muted-foreground mb-6">
              You have unsaved form data. Going back will discard all changes.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => setShowUnsavedDialog(false)}
                className="h-10 px-5 rounded-xl bg-card border border-border text-sm font-semibold text-foreground active:scale-[0.98] transition-all cursor-pointer"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={confirmDiscardForm}
                className="h-10 px-5 rounded-xl bg-destructive text-white text-sm font-semibold flex items-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
              >
                Discard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
