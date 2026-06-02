import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { toast } from '@/lib/logger';
import { generateProGridSiteReportPdf } from '@/pdf/proGridSiteReportPdf';
import {
  Badge,
  Button as ShadcnButton,
  Input,
  Label,
  Textarea,
  Checkbox,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { 
  Plus, 
  Trash2, 
  Save, 
  Upload, 
  Camera, 
  FileText, 
  CheckCircle2,
  AlertCircle,
  ChevronRight,
  HardHat,
  Users,
  Wrench,
  ClipboardCheck,
  Calendar as CalendarIcon,
  LayoutDashboard,
  Building2,
  FileSearch,
  ArrowLeft,
  MoreHorizontal,
  Pencil,
  Download,
  Clipboard,
  Search,
  X
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useAuth } from '../App';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { SiteReportPhotoUploader } from '@/components/SiteReportPhotoUploader';
import {
  useEnsurePhotoBucket,
  useUploadSiteReportPhoto,
  revokePendingPhoto,
  type PendingPhoto,
} from '@/hooks/useSiteReportPhotos';
import {
  SiteReportApprovalApi,
  type ApprovableMember,
} from '@/approvals/siteReportApproval';
import {
  useReportStoppages,
  useCreateStoppagesForReport,
  useDeleteStoppagesForReport,
} from '@/hooks/useStoppages';
import {
  STOPPAGE_CATEGORY_OPTIONS,
  BLOCKING_PARTY_OPTIONS,
  labelForStoppageCategory,
  labelForBlockingParty,
  toneClassForCategory,
  type StoppageCategory,
  type BlockingParty,
  type WorkStoppage,
} from '@/types/siteReportStoppage';

// Removed Material-UI imports

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const toNullableUuid = (value?: string | null): string | null => {
  const v = (value ?? '').trim();
  if (!v || v === 'null' || v === 'undefined') return null;
  return UUID_REGEX.test(v) ? v : null;
};

const siteReportSchema = z.object({
  client: z.string().min(1, "Client name is required"),
  projectName: z.string().min(1, "Project name is required"),
  date: z.string().min(1, "Date is required"),
  
  manpower: z.object({
    total: z.string().min(1, "Total manpower is required"),
    skilled: z.string().min(1, "Skilled manpower is required"),
    unskilled: z.string().min(1, "Unskilled manpower is required"),
    startTime: z.string().min(1, "Start time is required"),
    endTime: z.string().min(1, "End time is required"),
    subContractors: z.array(z.object({
      name: z.string(),
      count: z.string(),
      start: z.string(),
      end: z.string()
    }))
  }),
  
  workCarriedOut: z.array(z.object({ value: z.string().min(1, "Work description is required") })).min(1, "At least one work item is required"),
  milestonesCompleted: z.array(z.object({ value: z.string() })),
  
  progress: z.object({
    planned: z.string().min(1, "Planned progress is required"),
    actual: z.string().min(1, "Actual progress is required"),
    percentComplete: z.string().min(1, "Percent complete is required")
  }),
  
  equipment: z.object({
    onSite: z.string(),
    breakdown: z.string()
  }),
  
  safety: z.object({
    toolboxMeeting: z.boolean(),
    ppe: z.boolean()
  }),
  
  quality: z.object({
    inspection: z.enum(['Yes', 'Pending', 'Not Required']),
    satisfiedPercent: z.string().min(1, "Satisfied percentage is required"),
    reworkRequiredReason: z.string()
  }),
  
  rework: z.object({
    isRework: z.boolean(),
    reason: z.string(),
    start: z.string(),
    end: z.string(),
    materialUsed: z.string(),
    totalManpower: z.string()
  }),
  
  documents: z.object({
    type: z.enum(['INVOICE', 'DC']),
    docNo: z.string(),
    receivedSignature: z.enum(['Yes', 'Pending'])
  }),
  
  clientRequirements: z.object({
    details: z.array(z.object({ value: z.string() })),
    quoteToBe_sent: z.boolean().optional(),
    mailReceived: z.boolean()
  }),
  
  reporting: z.object({
    pmStatus: z.enum(['Reported', 'Pending', 'Draft', 'Pending Approval', 'Approved', 'Rejected', 'On Hold']),
    materialArrangement: z.enum(['Arranged', 'Pending', 'Not Required', 'Informed to stores'])
  }),
  
  workPlanNextDay: z.array(z.object({ value: z.string().min(1, "Next day plan is required") })).min(1, "At least one plan item is required"),
  specialInstructions: z.array(z.object({ value: z.string() })),
  
  issues: z.array(z.object({
    issue: z.string(),
    solution: z.string()
  })),
  
  documentation: z.object({
    filed: z.boolean(),
    toolsLocked: z.boolean(),
    sitePictures: z.enum(['Taken', 'Not Allowed'])
  }),
  
  footer: z.object({
    engineer: z.string().min(1, "Engineer name is required"),
    signatureDate: z.string().min(1, "Signature date is required")
  })
});

type SiteReportFormValues = z.infer<typeof siteReportSchema>;

// ---------- Date helpers (module-level) ----------
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const isSameDay = (a: Date, b: Date) => startOfDay(a).getTime() === startOfDay(b).getTime();
const daysAgo = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() - n); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); const dow = x.getDay(); const diff = (dow + 6) % 7; x.setDate(x.getDate() - diff); return x; };
const startOfMonth = (d: Date) => { const x = startOfDay(d); x.setDate(1); return x; };

const reportDateBucket = (reportDate: string): 'today' | 'yesterday' | 'this_week' | 'this_month' | 'earlier' => {
  const d = new Date(reportDate);
  const now = new Date();
  if (isSameDay(d, now)) return 'today';
  if (isSameDay(d, daysAgo(now, 1))) return 'yesterday';
  if (d >= startOfWeek(now)) return 'this_week';
  if (d >= startOfMonth(now)) return 'this_month';
  return 'earlier';
};

const BUCKET_LABELS: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  this_week: 'This Week',
  this_month: 'Earlier this Month',
  earlier: 'Earlier',
};

const dateRangePredicate = (range: DateRange, reportDate: string): boolean => {
  if (range === 'all') return true;
  const d = new Date(reportDate);
  const now = new Date();
  if (range === 'today') return isSameDay(d, now);
  if (range === 'yesterday') return isSameDay(d, daysAgo(now, 1));
  if (range === 'this_week') return d >= startOfWeek(now);
  if (range === 'this_month') return d >= startOfMonth(now);
  return true;
};

type DateRange = 'all' | 'today' | 'yesterday' | 'this_week' | 'this_month';

export function SiteReport() {
  const { user, organisation } = useAuth();
  const [view, setView] = useState<'list' | 'create' | 'edit' | 'view'>('list');
  const [pendingPhotos, setPendingPhotos] = useState<PendingPhoto[]>([]);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [selectedReportId, setSelectedReportId] = useState<string | null>(null);

  // List view filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [groupByDate, setGroupByDate] = useState(true);

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();

  // Accordion open/closed state — all open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identification: true,
    manpower: true,
    workMilestones: true,
    progressEquipmentSafety: true,
    logistics: true,
    issuesPlanClient: true,
    workStoppages: true,
    photos: true,
    footer: true,
  });
  const toggleSection = (section: string) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Approval flow state (Phase D)
  const [submitForApproval, setSubmitForApproval] = useState(false);
  const [selectedApproverId, setSelectedApproverId] = useState<string>('');

  // Work stoppages (Phase H) — local form state for create/edit; read-only display in view.
  type StoppageDraft = {
    category: StoppageCategory;
    blocking_party: BlockingParty;
    affected_work: string;
    reason_detail: string;
    expected_resolution_date: string;
  };
  const [stoppages, setStoppages] = useState<StoppageDraft[]>([]);
  const [stoppagesLoaded, setStoppagesLoaded] = useState(false);
  const addStoppageRow = () => setStoppages((prev) => [
    ...prev,
    { category: 'payment', blocking_party: 'unknown', affected_work: '', reason_detail: '', expected_resolution_date: '' },
  ]);
  const updateStoppageRow = (idx: number, patch: Partial<StoppageDraft>) =>
    setStoppages((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeStoppageRow = (idx: number) =>
    setStoppages((prev) => prev.filter((_, i) => i !== idx));
  const resetStoppages = () => { setStoppages([]); setStoppagesLoaded(false); };

  // Stoppage mutations (Phase H)
  const createStoppages = useCreateStoppagesForReport(organisation?.id ?? undefined, selectedReportId ?? undefined);
  const deleteStoppages = useDeleteStoppagesForReport(organisation?.id ?? undefined, selectedReportId ?? undefined);

  // Fetch existing stoppages for the report currently being viewed/edited
  const { data: existingStoppages = [] } = useReportStoppages(
    view === 'view' || view === 'edit' ? (selectedReportId ?? undefined) : undefined,
  );

  // Load existing stoppages into local form state when entering view/edit
  useEffect(() => {
    if ((view === 'view' || view === 'edit') && selectedReportId && !stoppagesLoaded) {
      setStoppages(
        existingStoppages.map((s) => ({
          category: s.category,
          blocking_party: s.blocking_party,
          affected_work: s.affected_work,
          reason_detail: s.reason_detail,
          expected_resolution_date: s.expected_resolution_date ?? '',
        })),
      );
      setStoppagesLoaded(true);
    }
    if (view === 'list' && stoppagesLoaded) {
      resetStoppages();
    }
  }, [view, selectedReportId, existingStoppages, stoppagesLoaded]);

  const issueIdParam = searchParams.get('issue_id');
  const actionParam = searchParams.get('action');

  useEffect(() => {
    if (actionParam === 'create' && view !== 'create') {
      setView('create');
      setSubmitForApproval(false);
      setSelectedApproverId('');
      // Clear the action param so we don't force 'create' if user clicks Back
      const newParams = new URLSearchParams(searchParams);
      newParams.delete('action');
      setSearchParams(newParams, { replace: true });
    }
  }, [actionParam, view, searchParams, setSearchParams]);

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
    mode: 'onSubmit', // Only validate on submit, not on every keystroke
    defaultValues: {
      client: '',
      projectName: '',
      date: new Date().toISOString().split('T')[0],
      manpower: {
        total: '', skilled: '', unskilled: '', startTime: '', endTime: '',
        subContractors: [{ name: '', count: '', start: '', end: '' }]
      },
      workCarriedOut: [{ value: '' }],
      milestonesCompleted: [{ value: '' }],
      progress: { planned: '', actual: '', percentComplete: '' },
      equipment: { onSite: '', breakdown: '' },
      safety: { toolboxMeeting: false, ppe: false },
      quality: { inspection: 'Pending', satisfiedPercent: '', reworkRequiredReason: '' },
      rework: { isRework: false, reason: '', start: '', end: '', materialUsed: '', totalManpower: '' },
      documents: { type: 'DC', docNo: '', receivedSignature: 'Pending' },
      clientRequirements: { details: [{ value: '' }], quoteToBe_sent: false, mailReceived: false },
      reporting: { pmStatus: 'Pending', materialArrangement: 'Pending' },
      workPlanNextDay: [{ value: '' }],
      specialInstructions: [{ value: '' }],
      issues: [{ issue: '', solution: '' }],
      documentation: { filed: false, toolsLocked: false, sitePictures: 'Taken' },
      footer: { engineer: '', signatureDate: new Date().toISOString().split('T')[0] }
    }
  });

  const { errors } = form.formState;
  const selectedClientId = form.watch('client');

  // Fetch existing reports
  const { data: reports, isLoading: reportsLoading } = useQuery({
    queryKey: ['site-reports', organisation?.id],
    queryFn: async () => {
      let query = supabase
        .from('site_reports')
        .select('id, report_date, pm_status, engineer_name, client_id, project_id, clients(client_name), projects(project_name)')
        .order('report_date', { ascending: false })
        .limit(50); // Only fetch recent 50 reports
      
      if (organisation?.id) {
        query = query.eq('organisation_id', organisation?.id);
      }
      
      const { data, error } = await query;
      if (error) {
        console.error('Reports fetch error:', error);
        throw error;
      }
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 2,  // Cache for 2 minutes
    gcTime: 1000 * 60 * 5,     // Keep in memory for 5 minutes
  });

  // Fetch Clients
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery({
    queryKey: ['site-report-clients', organisation?.id],
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30,    // Keep in memory for 30 minutes
    enabled: !!organisation?.id, // Fetch when org is available so it is ready
    queryFn: async () => {
      const { data, error } = await supabase
        .from('clients')
        .select('id, client_name')
        .eq('organisation_id', organisation?.id)
        .order('client_name');
      
      if (error) {
        console.error('Clients fetch error:', error);
        // Return empty array instead of throwing to prevent UI breaking
        return [];
      }
      return data || [];
    }
  });

  // Fetch Projects
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['site-report-projects', selectedClientId, organisation?.id],
    enabled: !!selectedClientId && !!organisation?.id,
    staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    gcTime: 1000 * 60 * 30,    // Keep in memory for 30 minutes
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('client_id', selectedClientId)
        .eq('organisation_id', organisation?.id) // Use correct column name
        .order('project_name');
      
      if (error) {
        console.error('Projects fetch error:', error);
        return []; // Return empty array instead of throwing
      }
      return data || [];
    }
  });

  // Fetch approvable org members (Phase D — for the Submit for Approval picker)
  const { data: approvableMembers = [] } = useQuery<ApprovableMember[]>({
    queryKey: ['approvable-members', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      return SiteReportApprovalApi.listApprovableMembers(organisation.id);
    },
    enabled: !!organisation?.id,
    staleTime: 1000 * 60 * 5,
  });

  // Fetch linked Issue if we came from an Issue
  const { data: linkedIssue } = useQuery({
    queryKey: ['issue-for-site-report', issueIdParam],
    enabled: !!issueIdParam,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('issues')
        .select('id, title, description, project_id, client_id, location_block, equipment_tag')
        .eq('id', issueIdParam)
        .single();
        
      if (error) throw error;
      return data;
    }
  });

  // Auto-fill form from linked issue
  useEffect(() => {
    if (linkedIssue && view === 'create') {
      if (linkedIssue.client_id) form.setValue('client', linkedIssue.client_id);
      if (linkedIssue.project_id) form.setValue('projectName', linkedIssue.project_id);
      
      const issueDesc = linkedIssue.title + (linkedIssue.description ? ` - ${linkedIssue.description}` : '');
      const currentIssues = form.getValues('issues');
      
      // If the first issue is empty, overwrite it, otherwise append
      if (currentIssues.length === 1 && !currentIssues[0].issue && !currentIssues[0].solution) {
        form.setValue('issues', [{ issue: issueDesc, solution: '' }]);
      } else if (!currentIssues.some(i => i.issue === issueDesc)) {
        form.setValue('issues', [...currentIssues, { issue: issueDesc, solution: '' }]);
      }
    }
  }, [linkedIssue, view, form]);

  // Fetch a single report (with child tables) for View/Edit
  const { data: selectedReport, isLoading: selectedReportLoading } = useQuery({
    queryKey: ['site-report', selectedReportId, organisation?.id],
    enabled: !!selectedReportId && (view === 'view' || view === 'edit'),
    queryFn: async () => {
      const { data: report, error: reportError } = await supabase
        .from('site_reports')
        .select('*')
        .eq('id', selectedReportId)
        .eq('organisation_id', organisation?.id)
        .single();
      if (reportError) throw reportError;

      const [subs, works, milestones, clientReqs, wpnd, si, issues] = await Promise.all([
        supabase.from('sub_contractors').select('name, count, start_time, end_time').eq('report_id', selectedReportId),
        supabase.from('work_carried_out').select('description').eq('report_id', selectedReportId),
        supabase.from('milestones_completed').select('description').eq('report_id', selectedReportId),
        supabase.from('site_report_client_requirements').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_work_plan_next_day').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_special_instructions').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_issues_faced').select('issue, solution, sort_order').eq('report_id', selectedReportId).order('sort_order'),
      ]);

      return {
        ...report,
        _subs: subs.data || [],
        _works: works.data || [],
        _milestones: milestones.data || [],
        _clientReqs: clientReqs.data || [],
        _wpnd: wpnd.data || [],
        _si: si.data || [],
        _issues: issues.data || []
      };
    },
  });

  // Prefill the form when entering view/edit mode and data is loaded
  useEffect(() => {
    if ((view !== 'view' && view !== 'edit') || !selectedReport) return;
    const r: any = selectedReport;
    const clientReq = (r._clientReqs || []).map((cr: any) => ({ value: cr.description || '' }));
    const nextDay = (r._wpnd || []).map((w: any) => ({ value: w.description || '' }));
    const instr = (r._si || []).map((s: any) => ({ value: s.description || '' }));
    const issues = (r._issues || []).map((i: any) => ({ issue: i.issue || '', solution: i.solution || '' }));
    form.reset({
      client: r.client_id || '',
      projectName: r.project_id || '',
      date: r.report_date || new Date().toISOString().split('T')[0],
      manpower: {
        total: r.total_manpower || '',
        skilled: r.skilled_manpower || '',
        unskilled: r.unskilled_manpower || '',
        startTime: r.start_time || '',
        endTime: r.end_time || '',
        subContractors: (r._subs || []).map((s: any) => ({
          name: s.name || '', count: s.count || '', start: s.start_time || '', end: s.end_time || ''
        })).length > 0
          ? (r._subs || []).map((s: any) => ({ name: s.name || '', count: s.count || '', start: s.start_time || '', end: s.end_time || '' }))
          : [{ name: '', count: '', start: '', end: '' }],
      },
      workCarriedOut: (r._works || []).map((w: any) => ({ value: w.description || '' })),
      milestonesCompleted: (r._milestones || []).map((m: any) => ({ value: m.description || '' })),
      progress: { planned: r.planned_progress || '', actual: r.actual_progress || '', percentComplete: r.percent_complete || '' },
      equipment: { onSite: r.equipment_on_site || '', breakdown: r.breakdown_issues || '' },
      safety: { toolboxMeeting: !!r.toolbox_meeting, ppe: !!r.ppe_followed },
      quality: { inspection: (r.inspection_status as any) || 'Pending', satisfiedPercent: r.satisfied_percent || '', reworkRequiredReason: r.rework_required_reason || '' },
      rework: {
        isRework: !!r.is_rework, reason: r.rework_reason || '',
        start: r.rework_start || '', end: r.rework_end || '',
        materialUsed: r.rework_material_used || '', totalManpower: r.rework_total_manpower || ''
      },
      documents: { type: (r.doc_type as any) || 'DC', docNo: r.doc_no || '', receivedSignature: (r.received_signature as any) || 'Pending' },
      clientRequirements: {
        details: clientReq.length > 0 ? clientReq : [{ value: '' }],
        quoteToBe_sent: !!r.quote_to_be_sent, mailReceived: !!r.mail_received,
      },
      reporting: { pmStatus: (r.pm_status as any) || 'Pending', materialArrangement: (r.material_arrangement as any) || 'Pending' },
      workPlanNextDay: nextDay.length > 0 ? nextDay : [{ value: '' }],
      specialInstructions: instr.length > 0 ? instr : [{ value: '' }],
      issues: issues.length > 0 ? issues : [{ issue: '', solution: '' }],
      documentation: { filed: !!r.is_filed, toolsLocked: !!r.tools_locked, sitePictures: (r.site_pictures_status as any) || 'Taken' },
      footer: { engineer: r.engineer_name || '', signatureDate: r.signature_date || new Date().toISOString().split('T')[0] }
    });
    // Intentionally one-shot per selectedReportId change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedReportId, selectedReportLoading]);

  const { fields: subContractorFields, append: appendSubContractor, remove: removeSubContractor } = useFieldArray({
    control: form.control,
    name: "manpower.subContractors"
  });

  const { fields: workFields, append: appendWork, remove: removeWork } = useFieldArray({
    control: form.control,
    name: "workCarriedOut"
  });

  const { fields: milestoneFields, append: appendMilestone, remove: removeMilestone } = useFieldArray({
    control: form.control,
    name: "milestonesCompleted"
  });

  const { fields: planFields, append: appendPlan, remove: removePlan } = useFieldArray({
    control: form.control,
    name: "workPlanNextDay"
  });

  const { fields: instructionFields, append: appendInstruction, remove: removeInstruction } = useFieldArray({
    control: form.control,
    name: "specialInstructions"
  });

  const { fields: issueFields, append: appendIssue, remove: removeIssue } = useFieldArray({
    control: form.control,
    name: "issues"
  });

  const { fields: clientReqFields, append: appendClientReq, remove: removeClientReq } = useFieldArray({
    control: form.control,
    name: "clientRequirements.details"
  });

  const ensureBucket = useEnsurePhotoBucket();
  const uploadPhoto = useUploadSiteReportPhoto();

  const saveMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      // 1. Save main report
      const finalPmStatus = submitForApproval ? 'Pending Approval' : values.reporting.pmStatus;
      const { data: report, error: reportError } = await supabase
        .from('site_reports')
        .insert([{
          organisation_id: organisation?.id,
          issue_id: toNullableUuid(issueIdParam),
          client_id: toNullableUuid(values.client),
          project_id: toNullableUuid(values.projectName),
          report_date: values.date,
          total_manpower: values.manpower.total,
          skilled_manpower: values.manpower.skilled,
          unskilled_manpower: values.manpower.unskilled,
          start_time: values.manpower.startTime || null,
          end_time: values.manpower.endTime || null,
          planned_progress: values.progress.planned,
          actual_progress: values.progress.actual,
          percent_complete: values.progress.percentComplete,
          equipment_on_site: values.equipment.onSite,
          breakdown_issues: values.equipment.breakdown,
          toolbox_meeting: values.safety.toolboxMeeting,
          ppe_followed: values.safety.ppe,
          inspection_status: values.quality.inspection,
          satisfied_percent: values.quality.satisfiedPercent,
          rework_required_reason: values.quality.reworkRequiredReason,
          is_rework: values.rework.isRework,
          rework_reason: values.rework.reason,
          rework_start: values.rework.start || null,
          rework_end: values.rework.end || null,
          rework_material_used: values.rework.materialUsed,
          rework_total_manpower: values.rework.totalManpower,
          doc_type: values.documents.type,
          doc_no: values.documents.docNo,
          received_signature: values.documents.receivedSignature,
          quote_to_be_sent: values.clientRequirements.quoteToBe_sent,
          mail_received: values.clientRequirements.mailReceived,
          pm_status: finalPmStatus,
          material_arrangement: values.reporting.materialArrangement,
          is_filed: values.documentation.filed,
          tools_locked: values.documentation.toolsLocked,
          site_pictures_status: values.documentation.sitePictures,
          engineer_name: values.footer.engineer,
          signature_date: values.footer.signatureDate
        }])
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Prepare all related inserts for parallel execution
      const relatedInserts = [];
      
      if (values.manpower.subContractors.length > 0) {
        const subs = values.manpower.subContractors
          .filter(s => s.name)
          .map(s => ({
            organisation_id: organisation?.id,
            report_id: report.id,
            name: s.name,
            count: s.count,
            start_time: s.start || null,
            end_time: s.end || null
          }));
        if (subs.length > 0) {
          relatedInserts.push(supabase.from('sub_contractors').insert(subs));
        }
      }

      if (values.workCarriedOut.length > 0) {
        const items = values.workCarriedOut
          .filter(i => i.value)
          .map(i => ({ 
            organisation_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          relatedInserts.push(supabase.from('work_carried_out').insert(items));
        }
      }

      if (values.milestonesCompleted.length > 0) {
        const items = values.milestonesCompleted
          .filter(i => i.value)
          .map(i => ({ 
            organisation_id: organisation?.id,
            report_id: report.id, 
            description: i.value 
          }));
        if (items.length > 0) {
          relatedInserts.push(supabase.from('milestones_completed').insert(items));
        }
      }

      const clientReqs = (values.clientRequirements.details || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: report.id,
          description: i.value,
          sort_order: idx
        }));
      if (clientReqs.length > 0) relatedInserts.push(supabase.from('site_report_client_requirements').insert(clientReqs));

      const wpnd = (values.workPlanNextDay || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: report.id,
          description: i.value,
          sort_order: idx
        }));
      if (wpnd.length > 0) relatedInserts.push(supabase.from('site_report_work_plan_next_day').insert(wpnd));

      const si = (values.specialInstructions || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: report.id,
          description: i.value,
          sort_order: idx
        }));
      if (si.length > 0) relatedInserts.push(supabase.from('site_report_special_instructions').insert(si));

      const issues = (values.issues || [])
        .filter(i => i.issue)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: report.id,
          issue: i.issue,
          solution: i.solution || '',
          sort_order: idx
        }));
      if (issues.length > 0) relatedInserts.push(supabase.from('site_report_issues_faced').insert(issues));

      // 3. Execute all related inserts in parallel
      if (relatedInserts.length > 0) {
        await Promise.allSettled(relatedInserts);
      }

      // 4. Insert work stoppages (Phase H) — only non-empty rows
      const stoppageRows = (stoppages || [])
        .filter((s) => s.affected_work.trim() || s.reason_detail.trim() || s.expected_resolution_date)
        .map((s) => ({
          organisation_id: organisation?.id,
          report_id: report.id,
          category: s.category,
          blocking_party: s.blocking_party,
          affected_work: s.affected_work,
          reason_detail: s.reason_detail,
          expected_resolution_date: s.expected_resolution_date || null,
        }));
      if (stoppageRows.length > 0) {
        await createStoppages.mutateAsync(stoppageRows as any);
      }

      return report;
    },
    
    // Add optimistic update for instant UI feedback
    onMutate: async (newReport) => {
      await queryClient.cancelQueries({ queryKey: ['site-reports'] });
      
      const previousReports = queryClient.getQueryData(['site-reports', organisation?.id]);
      
      queryClient.setQueryData(['site-reports', organisation?.id], (old: any) => {
        const optimisticReport = {
          id: 'temp-' + Date.now(),
          report_date: newReport.date,
          pm_status: newReport.reporting.pmStatus,
          engineer_name: newReport.footer.engineer,
          clients: { client_name: 'Saving...' },
          projects: { project_name: 'Saving...' }
        };
        return [optimisticReport, ...(old || [])];
      });
      
      toast.success('Saving report...', { duration: 1000 });
      return { previousReports };
    },
    
    onSuccess: async (report) => {
      const photoCount = pendingPhotos.length;
      let photoFailures = 0;

      if (photoCount > 0 && organisation?.id && user?.id) {
        try {
          const bucketName = await ensureBucket.mutateAsync();
          for (let i = 0; i < pendingPhotos.length; i++) {
            const p = pendingPhotos[i];
            try {
              await uploadPhoto.mutateAsync({
                reportId: report.id,
                organisationId: organisation.id,
                bucketName,
                file: { blob: p.blob, fileName: p.fileName, width: p.width, height: p.height, sizeBytes: p.sizeBytes },
                userId: user.id,
                caption: p.caption,
                sortOrder: i,
              });
            } catch (e: any) {
              console.error('Photo upload failed:', e);
              photoFailures++;
            }
          }
        } catch (e: any) {
          console.error('Bucket setup failed:', e);
          photoFailures = pendingPhotos.length;
        }
      }

      pendingPhotos.forEach(revokePendingPhoto);
      setPendingPhotos([]);

      let saved = true;
      let lastErr: any = null;
      try {
        if (submitForApproval && selectedApproverId && user?.id && organisation?.id) {
          const clientName = clients?.find((c: any) => c.id === (form.getValues('client') || ''))?.client_name;
          const projectName = projects?.find((p: any) => p.id === (form.getValues('projectName') || ''))?.project_name;
          const result = await SiteReportApprovalApi.createApprovalRequest({
            reportId: report.id,
            approverId: selectedApproverId,
            organisationId: organisation.id,
            engineerId: user.id,
            engineerName: form.getValues('footer.engineer'),
            reportDate: form.getValues('date'),
            clientName,
            projectName,
          });
          if (!result.success) {
            saved = false;
            lastErr = result.error;
          }
        } else if (submitForApproval && !selectedApproverId) {
          saved = false;
          lastErr = 'No approver selected';
        }
      } catch (e: any) {
        saved = false;
        lastErr = e?.message || 'Unknown error';
      }

      if (photoFailures > 0) {
        toast.error(`Saved, but ${photoFailures} photo(s) failed to upload`);
      } else if (submitForApproval && saved) {
        toast.success('Site report submitted for approval');
      } else if (submitForApproval && !saved) {
        toast.error(`Saved, but approval request failed: ${lastErr || 'unknown'}`);
      } else if (photoCount > 0) {
        toast.success(`Site report saved with ${photoCount} photo(s)`);
      } else {
        toast.success('Site report saved successfully!');
      }
      queryClient.invalidateQueries({ queryKey: ['site-reports'] });
      form.reset();
      setSubmitForApproval(false);
      setSelectedApproverId('');

      if (issueIdParam) {
        navigate(`/issue/${issueIdParam}`);
      } else {
        setView('list');
      }
    },
    
    onError: (error: any, newReport, context) => {
      if (context?.previousReports) {
        queryClient.setQueryData(['site-reports', organisation?.id], context.previousReports);
      }
      toast.error(`Failed to save report: ${error.message}`);
    }
  });

  // Update an existing report (Edit mode)
  const updateMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      if (!selectedReportId) throw new Error('No report selected for update');
      const reportId = selectedReportId;

      // Defensive: reject updates on locked reports
      const { data: existingReport } = await supabase
        .from('site_reports')
        .select('pm_status')
        .eq('id', reportId)
        .single();
      if (existingReport && (existingReport.pm_status === 'Pending Approval' || existingReport.pm_status === 'Approved' || existingReport.pm_status === 'Reported')) {
        throw new Error(`Cannot edit a report with status "${existingReport.pm_status}". It is locked after approval.`);
      }

      // 1. Update main row
      const { data: report, error: reportError } = await supabase
        .from('site_reports')
        .update({
          client_id: toNullableUuid(values.client),
          project_id: toNullableUuid(values.projectName),
          report_date: values.date,
          total_manpower: values.manpower.total,
          skilled_manpower: values.manpower.skilled,
          unskilled_manpower: values.manpower.unskilled,
          start_time: values.manpower.startTime || null,
          end_time: values.manpower.endTime || null,
          planned_progress: values.progress.planned,
          actual_progress: values.progress.actual,
          percent_complete: values.progress.percentComplete,
          equipment_on_site: values.equipment.onSite,
          breakdown_issues: values.equipment.breakdown,
          toolbox_meeting: values.safety.toolboxMeeting,
          ppe_followed: values.safety.ppe,
          inspection_status: values.quality.inspection,
          satisfied_percent: values.quality.satisfiedPercent,
          rework_required_reason: values.quality.reworkRequiredReason,
          is_rework: values.rework.isRework,
          rework_reason: values.rework.reason,
          rework_start: values.rework.start || null,
          rework_end: values.rework.end || null,
          rework_material_used: values.rework.materialUsed,
          rework_total_manpower: values.rework.totalManpower,
          doc_type: values.documents.type,
          doc_no: values.documents.docNo,
          received_signature: values.documents.receivedSignature,
          quote_to_be_sent: values.clientRequirements.quoteToBe_sent,
          mail_received: values.clientRequirements.mailReceived,
          pm_status: values.reporting.pmStatus,
          material_arrangement: values.reporting.materialArrangement,
          is_filed: values.documentation.filed,
          tools_locked: values.documentation.toolsLocked,
          site_pictures_status: values.documentation.sitePictures,
          engineer_name: values.footer.engineer,
          signature_date: values.footer.signatureDate
        })
        .eq('id', reportId)
        .select()
        .single();

      if (reportError) throw reportError;

      // 2. Replace child rows: delete existing, then insert new (mirrors saveMutation)
      await Promise.allSettled([
        supabase.from('sub_contractors').delete().eq('report_id', reportId),
        supabase.from('work_carried_out').delete().eq('report_id', reportId),
        supabase.from('milestones_completed').delete().eq('report_id', reportId),
        supabase.from('site_report_client_requirements').delete().eq('report_id', reportId),
        supabase.from('site_report_work_plan_next_day').delete().eq('report_id', reportId),
        supabase.from('site_report_special_instructions').delete().eq('report_id', reportId),
        supabase.from('site_report_issues_faced').delete().eq('report_id', reportId),
      ]);

      const relatedInserts: any[] = [];

      const subs = (values.manpower.subContractors || []).filter(s => s.name).map(s => ({
        organisation_id: organisation?.id,
        report_id: reportId,
        name: s.name, count: s.count,
        start_time: s.start || null, end_time: s.end || null
      }));
      if (subs.length > 0) relatedInserts.push(supabase.from('sub_contractors').insert(subs));

      const works = (values.workCarriedOut || []).filter(i => i.value).map(i => ({
        organisation_id: organisation?.id, report_id: reportId, description: i.value
      }));
      if (works.length > 0) relatedInserts.push(supabase.from('work_carried_out').insert(works));

      const miles = (values.milestonesCompleted || []).filter(i => i.value).map(i => ({
        organisation_id: organisation?.id, report_id: reportId, description: i.value
      }));
      if (miles.length > 0) relatedInserts.push(supabase.from('milestones_completed').insert(miles));

      const clientReqs = (values.clientRequirements.details || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          description: i.value,
          sort_order: idx
        }));
      if (clientReqs.length > 0) relatedInserts.push(supabase.from('site_report_client_requirements').insert(clientReqs));

      const wpnd = (values.workPlanNextDay || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          description: i.value,
          sort_order: idx
        }));
      if (wpnd.length > 0) relatedInserts.push(supabase.from('site_report_work_plan_next_day').insert(wpnd));

      const si = (values.specialInstructions || [])
        .filter(i => i.value)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          description: i.value,
          sort_order: idx
        }));
      if (si.length > 0) relatedInserts.push(supabase.from('site_report_special_instructions').insert(si));

      const issues = (values.issues || [])
        .filter(i => i.issue)
        .map((i, idx) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          issue: i.issue,
          solution: i.solution || '',
          sort_order: idx
        }));
      if (issues.length > 0) relatedInserts.push(supabase.from('site_report_issues_faced').insert(issues));

      if (relatedInserts.length > 0) await Promise.allSettled(relatedInserts);

      // Replace work stoppages (Phase H) — delete all existing rows for this report, then insert current drafts
      await deleteStoppages.mutateAsync();
      const stoppageRows = (stoppages || [])
        .filter((s) => s.affected_work.trim() || s.reason_detail.trim() || s.expected_resolution_date)
        .map((s) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          category: s.category,
          blocking_party: s.blocking_party,
          affected_work: s.affected_work,
          reason_detail: s.reason_detail,
          expected_resolution_date: s.expected_resolution_date || null,
        }));
      if (stoppageRows.length > 0) {
        await createStoppages.mutateAsync(stoppageRows as any);
      }

      return report;
    },
    onSuccess: () => {
      toast.success('Site report updated');
      queryClient.invalidateQueries({ queryKey: ['site-reports'] });
      queryClient.invalidateQueries({ queryKey: ['site-report', selectedReportId] });
      setView('list');
      setSelectedReportId(null);
    },
    onError: (error: any) => {
      toast.error(`Failed to update report: ${error.message}`);
    }
  });

  // -------- List view derived data: filtering, grouping, summary ----------

  const filteredReports = useMemo(() => {
    if (!reports) return [];
    const q = searchQuery.trim().toLowerCase();
    return reports.filter((r: any) => {
      if (projectFilter && r.project_id !== projectFilter) return false;
      if (engineerFilter && (r.engineer_name || '') !== engineerFilter) return false;
      if (!dateRangePredicate(dateRange, r.report_date)) return false;
      if (q) {
        const hay = [
          r.report_date, r.engineer_name, r.pm_status,
          r.clients?.client_name, r.projects?.project_name
        ].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [reports, searchQuery, projectFilter, engineerFilter, dateRange]);

  const groupedReports = useMemo(() => {
    if (!groupByDate) return null;
    const groups: Record<string, any[]> = {
      today: [], yesterday: [], this_week: [], this_month: [], earlier: []
    };
    for (const r of filteredReports) groups[reportDateBucket(r.report_date)].push(r);
    return groups;
  }, [filteredReports, groupByDate]);

  const uniqueEngineers = useMemo(() => {
    if (!reports) return [] as string[];
    return Array.from(new Set(reports.map((r: any) => r.engineer_name).filter(Boolean))).sort();
  }, [reports]);

  const uniqueProjects = useMemo(() => {
    if (!reports) return [] as { id: string; name: string }[];
    const map = new Map<string, string>();
    for (const r of (reports as any[])) {
      if (r.project_id) {
        const projName = Array.isArray(r.projects) ? r.projects?.[0]?.project_name : r.projects?.project_name;
        map.set(r.project_id, projName || r.project_id);
      }
    }
    return Array.from(map.entries()).map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [reports]);

  const summaryStats = useMemo(() => {
    if (!reports) return { total: 0, thisWeek: 0, today: 0, engineersActive: 0 };
    const now = new Date();
    const weekStart = startOfWeek(now);
    const todayCount = reports.filter((r: any) => isSameDay(new Date(r.report_date), now)).length;
    const weekCount = reports.filter((r: any) => new Date(r.report_date) >= weekStart).length;
    const engineers = new Set(reports.map((r: any) => r.engineer_name).filter(Boolean));
    return { total: reports.length, thisWeek: weekCount, today: todayCount, engineersActive: engineers.size };
  }, [reports]);

  const clearFilters = () => {
    setSearchQuery(''); setProjectFilter(''); setEngineerFilter(''); setDateRange('all');
  };
  const hasActiveFilters = !!(searchQuery || projectFilter || engineerFilter || dateRange !== 'all');

  const onSubmit = useCallback((data: SiteReportFormValues) => {
    if (view === 'edit') {
      updateMutation.mutate(data);
    } else {
      saveMutation.mutate(data);
    }
  }, [saveMutation, updateMutation, view]);

  const isMutating = saveMutation.isPending || updateMutation.isPending;
  const saveAsDraft = useCallback(() => {
    form.setValue('reporting.pmStatus', 'Draft');
    const values = form.getValues();
    if (!values.date) values.date = new Date().toISOString().split('T')[0];
    const payload = {
      ...values,
      reporting: { ...values.reporting, pmStatus: 'Draft' as const }
    } as SiteReportFormValues;
    if (view === 'edit') updateMutation.mutate(payload);
    else saveMutation.mutate(payload);
  }, [form, view, saveMutation, updateMutation]);

  const onInvalid = useCallback((errors: any) => {
    console.error("Form validation errors:", errors);
    toast.error("Please fill in all required fields correctly.");
  }, []);

  const handlePrintPDF = useCallback(() => {
    const { organisation } = useAuth();
    if (!organisation) {
      toast.error("Organization not found");
      return;
    }

    const siteReportData = {
      id: form.getValues('id') || 'temp-' + Date.now(),
      report_date: form.getValues('date'),
      client_name: clients.find(c => c.id === form.getValues('client'))?.client_name,
      project_name: projects.find(p => p.id === form.getValues('projectName'))?.project_name,
      pm_name: form.getValues('pmName'),
      pm_status: form.getValues('pmStatus'),
      weather: form.getValues('weather'),
      manpower: {
        subContractors: form.getValues('manpower.subContractors') || [],
        workCarriedOut: form.getValues('workCarriedOut') || [],
        milestonesCompleted: form.getValues('milestonesCompleted') || []
      },
      photos: [],
      footer: {
        enginear: form.getValues('footer.engineer'),
        signatureDate: form.getValues('footer.signatureDate')
      }
    };

    const doc = generateProGridSiteReportPdf({
      siteReport: siteReportData,
      organisation,
      orientation: 'portrait',
      pageFormat: 'a4'
    });

    // Create blob and download
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `site-report-${form.getValues('date')}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("PDF generated successfully");
  }, [form, clients, projects]);

  const downloadReportPDF = async (reportId: string) => {
    try {
      const { data: report, error } = await supabase
        .from('site_reports')
        .select(`
          id,
          report_date,
          pm_name,
          pm_status,
          weather,
          engineer_name,
          signature_date,
          organisation_id,
          clients (client_name),
          projects (project_name),
          sub_contractors (name, count, start_time, end_time),
          work_carried_out (description),
          milestones_completed (description)
        `)
        .eq('id', reportId)
        .single();

      if (error || !report) throw error || new Error('Report not found');

      const siteReportData = {
        id: report.id,
        report_date: report.report_date,
        client_name: (report.clients as any)?.client_name,
        project_name: (report.projects as any)?.project_name,
        pm_name: report.pm_name || '',
        pm_status: report.pm_status,
        weather: report.weather || '',
        manpower: {
          subContractors: (report as any).sub_contractors || [],
          workCarriedOut: (report as any).work_carried_out || [],
          milestonesCompleted: (report as any).milestones_completed || []
        },
        photos: [],
        footer: {
          enginear: report.engineer_name || '',
          signatureDate: report.signature_date || ''
        }
      };

      const doc = generateProGridSiteReportPdf({
        siteReport: siteReportData,
        organisation: organisation || { id: report.organisation_id, name: 'MEP Project' },
        orientation: 'portrait',
        pageFormat: 'a4'
      });

      const pdfBlob = doc.output('blob');
      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `site-report-${report.report_date}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("PDF downloaded successfully");
    } catch (err: any) {
      console.error(err);
      toast.error(`Failed to download PDF: ${err.message}`);
    }
  };

  if (view === 'list') {
    const renderRow = (report: any, idx: number) => {
      const isSelected = selectedReports.includes(report.id);
      const isEven = idx % 2 === 0;
      const bucket = reportDateBucket(report.report_date);
      const bucketBadge: Record<string, { label: string; cls: string }> = {
        today: { label: 'TODAY', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
        yesterday: { label: 'YESTERDAY', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
        this_week: { label: 'THIS WEEK', cls: 'bg-blue-50 text-blue-700 border-blue-200' },
        this_month: { label: 'THIS MONTH', cls: 'bg-zinc-100 text-zinc-600 border-zinc-200' },
        earlier: { label: 'EARLIER', cls: 'bg-zinc-50 text-zinc-500 border-zinc-200' },
      };
      const badge = bucketBadge[bucket];
      const isLocked = report.pm_status === 'Pending Approval' || report.pm_status === 'Approved' || report.pm_status === 'Reported';
      const statusStyle: Record<string, { color: string; bg: string; border: string }> = {
        'Approved':   { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
        'Reported':   { color: '#047857', bg: '#ecfdf5', border: '#a7f3d0' },
        'Rejected':   { color: '#b91c1c', bg: '#fef2f2', border: '#fecaca' },
        'On Hold':    { color: '#7c3aed', bg: '#f5f3ff', border: '#ddd6fe' },
        'Pending Approval': { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        'Pending':    { color: '#b45309', bg: '#fffbeb', border: '#fde68a' },
        'Draft':      { color: '#4b5563', bg: '#f3f4f6', border: '#e5e7eb' },
      };
      const ss = statusStyle[report.pm_status] || statusStyle['Pending'];
      return (
        <tr
          key={report.id}
          className={cn(
            "border-t border-zinc-200/70 transition-all duration-150 group",
            isEven ? "bg-white" : "bg-zinc-50/30",
            isSelected ? "bg-indigo-50/50 border-l-2 border-l-blue-600" : "hover:border-blue-600 hover:bg-blue-100/80 hover:shadow-sm"
          )}
        >
          <td className="px-4 py-[20px] text-center align-middle">
            <Checkbox
              checked={isSelected}
              onCheckedChange={(checked) => {
                if (checked) setSelectedReports(prev => [...prev, report.id]);
                else setSelectedReports(prev => prev.filter(id => id !== report.id));
              }}
              className="h-4 w-4 border-2 border-zinc-300 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
          </td>
          <td className="px-6 py-[20px] align-middle">
            <div className="flex flex-col gap-1">
              <span className="text-sm font-medium text-zinc-900">
                {new Date(report.report_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
              </span>
              {groupByDate && (
                <span className={cn(
                  "self-start inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-widest border",
                  badge.cls
                )}>
                  {badge.label}
                </span>
              )}
            </div>
          </td>
          <td className="px-6 py-[20px] align-middle max-w-[180px] truncate" title={report.clients?.client_name || '-'}>
            <span className="text-sm text-zinc-800">{report.clients?.client_name || '-'}</span>
          </td>
          <td className="px-6 py-[20px] align-middle max-w-[350px] truncate" title={report.projects?.project_name || '-'}>
            <span className="text-sm text-zinc-800">{report.projects?.project_name || '-'}</span>
          </td>
          <td className="px-6 py-[20px] align-middle">
            <span className="text-sm text-zinc-800">{report.engineer_name || '-'}</span>
          </td>
          <td className="px-6 py-[20px] align-middle">
            <span
              className="text-sm font-medium inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider border"
              style={{
                color: ss.color,
                backgroundColor: ss.bg,
                borderColor: ss.border,
              }}
              title={isLocked ? 'Report is locked after approval' : undefined}
            >
              {report.pm_status}
              {isLocked && <span className="ml-1.5 text-[9px]">🔒</span>}
            </span>
          </td>
          <td className="px-6 py-[20px] text-center align-middle w-[70px]">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 transition-all active:scale-[0.98]"
                >
                  <MoreHorizontal size={14} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44 bg-white border border-zinc-200/60 p-1 shadow-lg shadow-black/5 rounded-lg z-[100]">
                <DropdownMenuItem
                  style={{ padding: '6px' }}
                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98] cursor-pointer"
                  onClick={() => {
                    setSelectedReportId(report.id);
                    setView('view');
                  }}
                >
                  <Clipboard className="w-3.5 h-3.5" />
                  View Details
                </DropdownMenuItem>
                <DropdownMenuItem
                  style={{ padding: '6px' }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-md px-2 text-[12px] active:scale-[0.98]",
                    isLocked
                      ? "text-zinc-300 cursor-not-allowed"
                      : "text-zinc-600 hover:bg-indigo-50 hover:text-indigo-700 cursor-pointer"
                  )}
                  onClick={() => {
                    if (isLocked) return;
                    setSelectedReportId(report.id);
                    setView('edit');
                  }}
                >
                  <Pencil className="w-3.5 h-3.5" />
                  {isLocked ? 'Edit (locked)' : 'Edit Report'}
                </DropdownMenuItem>
                <DropdownMenuItem
                  style={{ padding: '6px' }}
                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-blue-600 hover:bg-blue-50 hover:text-blue-800 font-medium active:scale-[0.98] cursor-pointer"
                  onClick={() => downloadReportPDF(report.id)}
                >
                  <Download className="w-3.5 h-3.5" />
                  Download PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </td>
        </tr>
      );
    };

    const renderTableHead = () => (
      <thead>
        <tr>
          <th className="sticky top-0 z-10 h-[36px] w-[50px] px-4 text-center align-middle bg-white border-b border-zinc-200">
            <Checkbox
              checked={filteredReports.length > 0 && selectedReports.length === filteredReports.length}
              onCheckedChange={(checked) => {
                if (checked) setSelectedReports(filteredReports.map((r: any) => r.id));
                else setSelectedReports([]);
              }}
              className="h-4 w-4 border-2 border-zinc-300 rounded data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
            />
          </th>
          <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200 text-left">Date</th>
          <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200 text-left">Client</th>
          <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200 text-left">Project</th>
          <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200 text-left">Engineer</th>
          <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200 text-left">Status</th>
          <th className="sticky top-0 z-10 h-[36px] w-[70px] px-6 pl-1 text-center align-middle text-[11px] font-bold uppercase tracking-widest text-zinc-500 bg-white border-b border-zinc-200">Actions</th>
        </tr>
      </thead>
    );

    const renderEmpty = (message: string, sub: string) => (
      <tr>
        <td colSpan={7} className="px-6 py-16 text-center text-sm text-zinc-500 bg-white">
          <div className="mx-auto max-w-sm space-y-2">
            <div className="w-12 h-12 mx-auto rounded-full bg-zinc-100 flex items-center justify-center">
              <FileText className="w-6 h-6 text-zinc-400" />
            </div>
            <div className="text-sm font-semibold text-zinc-900">{message}</div>
            <div className="text-xs text-zinc-500">{sub}</div>
          </div>
        </td>
      </tr>
    );

    return (
      <div className="flex flex-col h-full bg-white">
        {/* Bulk Action Header */}
        {selectedReports.length > 0 && (
          <div className="sticky top-0 z-[120] w-full bg-zinc-900 text-white px-6 py-[12px] flex items-center justify-between shadow-2xl">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={true}
                onCheckedChange={() => setSelectedReports([])}
                className="h-4 w-4 border-2 border-white rounded data-[state=checked]:bg-white data-[state=checked]:border-white"
              />
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{selectedReports.length} Selected</span>
                <span className="text-[10px] text-zinc-400 uppercase tracking-widest font-bold">Bulk Actions</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                className="bg-white text-zinc-900 text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-zinc-100 transition-colors active:scale-[0.98]"
                onClick={async () => {
                  for (const id of selectedReports) await downloadReportPDF(id);
                }}
              >
                Print
              </button>
              <button
                type="button"
                className="bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-lg px-4 py-2 hover:bg-red-700 transition-colors active:scale-[0.98]"
                onClick={() => setSelectedReports([])}
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Page Header */}
        <div className="px-6 pt-5 pb-4 bg-white border-b border-zinc-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-xl font-semibold text-zinc-900">Site Reports</h1>
              <p className="text-xs text-zinc-500 mt-0.5">Daily logs from the field — manpower, progress, photos</p>
            </div>
            <button
              type="button"
              onClick={() => {
                form.reset();
                setSelectedReportId(null);
                setView('create');
              }}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm active:scale-[0.98] px-4 py-2"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Report
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Total Reports</div>
              <div className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{reportsLoading ? '—' : summaryStats.total}</div>
            </div>
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">This Week</div>
              <div className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{reportsLoading ? '—' : summaryStats.thisWeek}</div>
            </div>
            <div className="border border-emerald-200 rounded-lg p-3 bg-emerald-50/50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-700">Filed Today</div>
              <div className="text-2xl font-semibold text-emerald-700 mt-1 tabular-nums">{reportsLoading ? '—' : summaryStats.today}</div>
            </div>
            <div className="border border-zinc-200 rounded-lg p-3 bg-zinc-50/50">
              <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Engineers Active</div>
              <div className="text-2xl font-semibold text-zinc-900 mt-1 tabular-nums">{reportsLoading ? '—' : summaryStats.engineersActive}</div>
            </div>
          </div>

          {/* Filter bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-400 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by client, project, engineer…"
                className="w-full h-9 pl-8 pr-8 text-sm border border-zinc-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="h-9 w-[180px] text-sm bg-white">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All projects</SelectItem>
                {uniqueProjects.map(p => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={engineerFilter} onValueChange={setEngineerFilter}>
              <SelectTrigger className="h-9 w-[160px] text-sm bg-white">
                <SelectValue placeholder="All engineers" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All engineers</SelectItem>
                {uniqueEngineers.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="h-9 w-[140px] text-sm bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="yesterday">Yesterday</SelectItem>
                <SelectItem value="this_week">This week</SelectItem>
                <SelectItem value="this_month">This month</SelectItem>
              </SelectContent>
            </Select>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="h-9 px-3 text-xs font-semibold text-zinc-700 bg-zinc-100 hover:bg-zinc-200 rounded-lg active:scale-[0.98] transition-colors"
              >
                Clear filters
              </button>
            )}

            <div className="flex items-center gap-2 ml-auto pl-2">
              <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Group by date</span>
              <button
                type="button"
                onClick={() => setGroupByDate(g => !g)}
                className={cn(
                  "relative inline-flex h-5 w-9 rounded-full transition-colors",
                  groupByDate ? "bg-blue-600" : "bg-zinc-300"
                )}
                aria-pressed={groupByDate}
              >
                <span className={cn(
                  "inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
                  groupByDate ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                )} />
              </button>
            </div>
          </div>

          {/* Active filter chips */}
          {hasActiveFilters && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px]">
              <span className="text-zinc-500 font-semibold uppercase tracking-widest">Active filters:</span>
              {searchQuery && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">“{searchQuery}”</span>}
              {projectFilter && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Project: {uniqueProjects.find(p => p.id === projectFilter)?.name}</span>}
              {engineerFilter && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Engineer: {engineerFilter}</span>}
              {dateRange !== 'all' && <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full">Range: {BUCKET_LABELS[dateRange] || dateRange}</span>}
              <span className="text-zinc-500">· {filteredReports.length} of {reports?.length || 0} reports</span>
            </div>
          )}
        </div>

        {/* Table container */}
        <div className="flex-1 overflow-auto">
          {reportsLoading ? (
            <table className="w-full border-separate border-spacing-0">
              {renderTableHead()}
              <tbody>
                <tr>
                  <td colSpan={7} className="px-6 py-[26px] align-middle text-center bg-white">
                    <div className="flex items-center justify-center gap-2 text-zinc-500">
                      <div className="w-4 h-4 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin" />
                      <span className="text-sm">Loading reports...</span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          ) : reports?.length === 0 ? (
            <table className="w-full border-separate border-spacing-0">
              {renderTableHead()}
              <tbody>{renderEmpty('No reports filed yet', 'Create your first site report to get started.')}</tbody>
            </table>
          ) : filteredReports.length === 0 ? (
            <table className="w-full border-separate border-spacing-0">
              {renderTableHead()}
              <tbody>{renderEmpty('No reports match your filters', 'Try clearing filters or widening the date range.')}</tbody>
            </table>
          ) : groupByDate && groupedReports ? (
            <div>
              {(['today', 'yesterday', 'this_week', 'this_month', 'earlier'] as const).map((bucket, bIdx) => {
                const items = groupedReports[bucket];
                if (items.length === 0) return null;
                return (
                  <div key={bucket}>
                    <div className={cn(
                      "sticky z-10 bg-zinc-50 px-6 py-2 text-[10px] font-bold uppercase tracking-widest text-zinc-500 border-b border-zinc-200 flex items-center justify-between",
                      bIdx === 0 ? "top-0" : "top-0"
                    )}>
                      <span>{BUCKET_LABELS[bucket]}</span>
                      <span className="text-zinc-400 normal-case tracking-normal font-medium">{items.length} {items.length === 1 ? 'report' : 'reports'}</span>
                    </div>
                    <table className="w-full border-separate border-spacing-0">
                      {renderTableHead()}
                      <tbody>
                        {items.map((r, i) => renderRow(r, i))}
                      </tbody>
                    </table>
                  </div>
                );
              })}
            </div>
          ) : (
            <table className="w-full border-separate border-spacing-0">
              {renderTableHead()}
              <tbody>
                {filteredReports.map((r, i) => renderRow(r, i))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    );
  }

  if (view === 'create' || view === 'edit' || view === 'view') {
    // Show a loading state when fetching an existing report for view/edit
    if ((view === 'view' || view === 'edit') && selectedReportLoading && !selectedReport) {
      return (
        <div className="min-h-screen bg-zinc-50/30 flex items-center justify-center">
          <div className="flex items-center gap-3 text-zinc-500">
            <div className="w-5 h-5 border-2 border-zinc-300 border-t-blue-600 rounded-full animate-spin" />
            <span className="text-sm">Loading report…</span>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-zinc-50/30 py-8 px-6">
        <div className="max-w-5xl mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-500 mb-4">
            <button
              type="button"
              onClick={() => { setView('list'); setSelectedReportId(null); }}
              className="hover:text-zinc-800 transition-colors"
            >
              Site Reports
            </button>
            <ChevronRight className="w-3.5 h-3.5 text-zinc-400" />
            <span className="text-zinc-800 font-medium">
              {view === 'create' ? 'Create Report' : view === 'edit' ? 'Edit Report' : 'View Report'}
            </span>
          </div>

          {/* Header */}
          <div className="flex items-center justify-between mb-8 pb-4 border-b border-zinc-200">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">
                {view === 'create' ? 'Create Site Report' : view === 'edit' ? 'Edit Site Report' : 'Site Report Details'}
              </h1>
              <p className="text-sm text-zinc-500 mt-1">
                {view === 'create' 
                  ? 'Record daily activities, manpower logs, and progress reports' 
                  : view === 'edit' 
                    ? 'Update daily activities, manpower logs, and progress reports' 
                    : 'Review daily activities, manpower logs, and progress reports'}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setView('list')}
                className="px-4 py-2 border border-zinc-200 rounded-lg text-sm font-semibold text-zinc-700 bg-white hover:bg-zinc-50 transition-colors active:scale-[0.98]"
              >
                {view === 'view' ? 'Back to List' : 'Cancel'}
              </button>
              
              {view === 'view' ? (
                <button
                  type="button"
                  onClick={() => {
                    if (selectedReportId) {
                      downloadReportPDF(selectedReportId);
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors active:scale-[0.98]"
                >
                  Download PDF
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={saveAsDraft}
                    disabled={isMutating}
                    className="px-4 py-2 border border-zinc-200 hover:bg-zinc-50 text-zinc-700 rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm bg-white"
                  >
                    {isMutating ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="button"
                    onClick={form.handleSubmit(onSubmit, onInvalid)}
                    disabled={isMutating}
                    className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors active:scale-[0.98] disabled:opacity-50 shadow-sm"
                  >
                    {isMutating ? 'Saving...' : view === 'edit' ? 'Update Report' : 'Submit Report'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Form Content - Styled per SiteVisits design reference */}
          <form onSubmit={form.handleSubmit(onSubmit, onInvalid)} data-site-report>
            <fieldset disabled={view === 'view'} style={{ border: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {/* 1. Identification Section */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('identification')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.identification ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report Identification</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.identification && 'rotate-90')} />
                </button>
                {openSections.identification && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client *</label>
                    <Select 
                      value={form.watch('client')} 
                      onValueChange={(val) => {
                        form.setValue('client', val);
                        form.setValue('projectName', ''); 
                      }}
                    >
                      <SelectTrigger className={cn("h-9 text-sm bg-white", (errors.client || clientsError) && "border-red-500")}>
                        <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select Client"} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients?.map((client: any) => (
                          <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                        ))}
                        {clients?.length === 0 && !clientsLoading && (
                          <SelectItem value="_empty" disabled>No clients found</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.client && <p className="text-[10px] text-red-500 font-medium">{errors.client.message}</p>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Project *</label>
                    <Select 
                      value={form.watch('projectName')} 
                      onValueChange={(val) => form.setValue('projectName', val)}
                      disabled={!selectedClientId}
                    >
                      <SelectTrigger className={cn("h-9 text-sm bg-white", (errors.projectName || projectsError) && "border-red-500")}>
                        <SelectValue placeholder={!selectedClientId ? "Select client first" : projectsLoading ? "Fetching projects..." : "Select Project"} />
                      </SelectTrigger>
                      <SelectContent>
                        {projects?.map((project: any) => (
                          <SelectItem key={project.id} value={project.id}>{project.project_name}</SelectItem>
                        ))}
                        {projects?.length === 0 && !projectsLoading && (
                          <SelectItem value="_empty" disabled>No projects for this client</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                    {errors.projectName && <p className="text-[10px] text-red-500 font-medium">{errors.projectName.message}</p>}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Report Date *</label>
                    <Input 
                      type="date" 
                      className={cn("h-9 text-sm bg-white", errors.date && "border-red-500")}
                      {...form.register('date')} 
                    />
                    {errors.date && <p className="text-[10px] text-red-500 font-medium">{errors.date.message}</p>}
                  </div>
                </div>}
              </div>

              {/* 2. Manpower Section */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('manpower')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.manpower ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Manpower Details</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.manpower && 'rotate-90')} />
                </button>
                {openSections.manpower && <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SKILLED FORCE</label>
                    <Input className="h-9 bg-white text-sm" {...form.register('manpower.skilled')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>UNSKILLED FORCE</label>
                    <Input className="h-9 bg-white text-sm" {...form.register('manpower.unskilled')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>TOTAL FORCE</label>
                    <Input className="h-9 bg-zinc-50 font-bold text-sm" {...form.register('manpower.total')} placeholder="0" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>IN TIME</label>
                    <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.startTime')} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>OUT TIME</label>
                    <Input className="h-9 bg-white text-sm" type="time" {...form.register('manpower.endTime')} />
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sub-Contractors on Site</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendSubContractor({ name: '', count: '', start: '', end: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Entry
                      </button>
                    )}
                  </div>
                  
                  <div className="border border-zinc-100 rounded-lg overflow-hidden bg-white">
                    <Table>
                      <TableHeader className="bg-zinc-50/50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500">Company/Vendor Name</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[100px]">Count</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[120px]">In</TableHead>
                          <TableHead className="text-[10px] h-8 font-bold text-zinc-500 w-[120px]">Out</TableHead>
                          {view !== 'view' && <TableHead className="w-[40px] h-8"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subContractorFields.map((field, index) => (
                          <TableRow key={field.id} className="bg-white border-b-zinc-50 last:border-0 hover:bg-transparent">
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" {...form.register(`manpower.subContractors.${index}.name`)} placeholder="Enter vendor name..." />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" {...form.register(`manpower.subContractors.${index}.count`)} placeholder="0" />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" type="time" {...form.register(`manpower.subContractors.${index}.start`)} />
                            </TableCell>
                            <TableCell className="p-1">
                              <Input className="h-8 text-xs border-transparent focus:border-indigo-200 focus:ring-0 shadow-none bg-transparent" type="time" {...form.register(`manpower.subContractors.${index}.end`)} />
                            </TableCell>
                            {view !== 'view' && (
                              <TableCell className="p-1 text-center">
                                <ShadcnButton 
                                  type="button" 
                                  variant="ghost" 
                                  size="icon" 
                                  className="h-7 w-7 text-zinc-300 hover:text-red-500"
                                  onClick={() => removeSubContractor(index)}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </ShadcnButton>
                              </TableCell>
                            )}
                          </TableRow>
                        ))}
                        {subContractorFields.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={view === 'view' ? 4 : 5} className="h-12 text-center text-[11px] text-zinc-400 italic">No sub-contractors added</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                </>}
              </div>

              {/* 3. Work Carried Out & Milestones */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('workMilestones')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.workMilestones ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Carried Out & Milestones</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.workMilestones && 'rotate-90')} />
                </button>
                {openSections.workMilestones && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Done Today *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendWork({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Activity
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start group">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`workCarriedOut.${index}.value`)} placeholder="Describe activity..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-zinc-300 hover:text-red-500"
                            onClick={() => removeWork(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Milestones Hit</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendMilestone({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Milestone
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {milestoneFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start group">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`milestonesCompleted.${index}.value`)} placeholder="Milestone description..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-9 w-9 text-zinc-300 hover:text-red-500"
                            onClick={() => removeMilestone(index)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
              </div>

              {/* 4. Progress, Equipment, Safety & Quality */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('progressEquipmentSafety')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.progressEquipmentSafety ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress, Equipment & Safety</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.progressEquipmentSafety && 'rotate-90')} />
                </button>
                {openSections.progressEquipmentSafety && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Progress Monitoring */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Progress Monitoring</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>PLANNED FOR TODAY</label>
                    <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.planned')} placeholder="..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>ACTUAL PROGRESS</label>
                    <Textarea className="min-h-[60px] text-xs bg-white" {...form.register('progress.actual')} placeholder="..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>% COMPLETE</label>
                    <div className="relative">
                      <Input className="h-9 text-xs pr-8 font-bold" {...form.register('progress.percentComplete')} placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-bold text-[10px]">%</span>
                    </div>
                  </div>
                </div>

                {/* Equipment Status */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Equipment Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>MACHINES ON SITE</label>
                    <Textarea className="min-h-[80px] text-xs bg-white" {...form.register('equipment.onSite')} placeholder="List tools/machinery..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#ef4444' }}>ISSUES / BREAKDOWNS</label>
                    <Textarea className="min-h-[80px] text-xs bg-white border-red-50" {...form.register('equipment.breakdown')} placeholder="Report mechanical issues..." />
                  </div>
                </div>

                {/* Safety & Quality */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Safety & Quality</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-zinc-100 shadow-sm">
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Toolbox Meeting</label>
                      <Checkbox checked={form.watch('safety.toolboxMeeting')} onCheckedChange={(c) => form.setValue('safety.toolboxMeeting', !!c)} />
                    </div>
                    <div className="flex items-center justify-between p-2 bg-white rounded border border-zinc-100 shadow-sm">
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>PPE Protocols</label>
                      <Checkbox checked={form.watch('safety.ppe')} onCheckedChange={(c) => form.setValue('safety.ppe', !!c)} />
                    </div>
                  </div>
                  
                  <div className="h-px bg-zinc-200 my-1" />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>INSPECTION</label>
                      <Select value={form.watch('quality.inspection')} onValueChange={(val: any) => form.setValue('quality.inspection', val)}>
                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SATISFIED %</label>
                      <Input className="h-8 text-xs bg-white" {...form.register('quality.satisfiedPercent')} placeholder="0%" />
                    </div>
                  </div>
                </div>
              </div>}
              </div>

              {/* 5. Logistics & Internal Reporting */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('logistics')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.logistics ? '10px' : 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Logistics & Internal Reporting</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.logistics && 'rotate-90')} />
                </button>
                {openSections.logistics && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>APPROVAL STATUS</label>
                    <Select value={form.watch('reporting.pmStatus')} onValueChange={(v: any) => form.setValue('reporting.pmStatus', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Draft">Draft</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Pending Approval">Pending Approval</SelectItem>
                        <SelectItem value="Approved">Approved</SelectItem>
                        <SelectItem value="Rejected">Rejected</SelectItem>
                        <SelectItem value="On Hold">On Hold</SelectItem>
                        <SelectItem value="Reported">Reported</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>MATERIAL ARRANGEMENT</label>
                    <Select value={form.watch('reporting.materialArrangement')} onValueChange={(v: any) => form.setValue('reporting.materialArrangement', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Arranged">Arranged</SelectItem>
                        <SelectItem value="Pending">Pending</SelectItem>
                        <SelectItem value="Not Required">Not Required</SelectItem>
                        <SelectItem value="Informed to stores">Informed to stores</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>SITE PHOTO STATUS</label>
                    <Select value={form.watch('documentation.sitePictures')} onValueChange={(v: any) => form.setValue('documentation.sitePictures', v)}>
                      <SelectTrigger className="h-9 text-xs bg-white"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Taken">Taken</SelectItem>
                        <SelectItem value="Not Allowed">Not Allowed</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '8px', paddingLeft: '8px' }}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('documentation.filed')} onCheckedChange={(c) => form.setValue('documentation.filed', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Hardcopy Filed</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('documentation.toolsLocked')} onCheckedChange={(c) => form.setValue('documentation.toolsLocked', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Tools Secured</label>
                    </div>
                  </div>
                </div>}
              </div>

              {/* 6. Issues, Plan, Client Requirements */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('issuesPlanClient')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.issuesPlanClient ? '12px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issues, Planning & Client Requirements</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.issuesPlanClient && 'rotate-90')} />
                </button>
                {openSections.issuesPlanClient && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Issues */}
                <div style={{ border: '1px solid #fee2e2', borderRadius: '8px', padding: '16px', background: '#fff5f5', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Issues Faced</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendIssue({ issue: '', solution: '' })}
                        style={{ fontSize: '11px', color: '#b91c1c', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Log Issue
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {issueFields.map((field, index) => (
                      <div key={field.id} className="space-y-1 p-2 bg-white rounded border border-red-100 relative group">
                        <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.issue`)} placeholder="Issue..." />
                        <Input className="h-8 text-xs bg-white" {...form.register(`issues.${index}.solution`)} placeholder="Action..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 text-red-300 absolute -top-2 -right-2 bg-white border border-red-50 rounded-full" 
                            onClick={() => removeIssue(index)}
                          >
                            <Plus className="w-3 h-3 rotate-45" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Day Plan */}
                <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Next Day Plan *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendPlan({ value: '' })}
                        style={{ fontSize: '11px', color: '#2563eb', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Task
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {planFields.map((field, index) => (
                      <div key={field.id} className="flex gap-1 group items-center">
                        <Input className="h-8 text-xs bg-white flex-1" {...form.register(`workPlanNextDay.${index}.value`)} placeholder="Planned task..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500" onClick={() => removePlan(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Client Side Req */}
                <div style={{ border: '1px solid #fef3c7', borderRadius: '8px', padding: '16px', background: '#fffbeb', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Client Requirements</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendClientReq({ value: '' })}
                        style={{ fontSize: '11px', color: '#b45309', background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Add Req
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {clientReqFields.map((field, index) => (
                      <div key={field.id} className="flex gap-1 group items-center">
                        <Input className="h-8 text-xs bg-white flex-1" {...form.register(`clientRequirements.details.${index}.value`)} placeholder="Requirement..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="icon" className="h-8 w-8 text-zinc-300 hover:text-red-500" onClick={() => removeClientReq(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('clientRequirements.quoteToBe_sent')} onCheckedChange={(c) => form.setValue('clientRequirements.quoteToBe_sent', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Quote to be sent</label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Checkbox checked={form.watch('clientRequirements.mailReceived')} onCheckedChange={(c) => form.setValue('clientRequirements.mailReceived', !!c)} />
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>Mail Received from client</label>
                    </div>
                  </div>
                </div>
              </div>}
              </div>

              {/* Section 6.5: Work Stoppages (Phase H) — log blocks/restarts on this report */}
              <div style={{ border: '1px solid #fee2e2', borderRadius: '8px', padding: '16px', background: '#fff5f5' }}>
                <button type="button" onClick={() => toggleSection('workStoppages')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.workStoppages ? '12px' : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Work Stoppages</div>
                    {stoppages.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', background: '#fecaca', padding: '2px 6px', borderRadius: '10px' }}>
                        {stoppages.length} log{stoppages.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.workStoppages && 'rotate-90')} />
                </button>
                {openSections.workStoppages && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '10px', color: '#7f1d1d', lineHeight: '1.4' }}>
                      Log work that was stopped today and when (or whether) it is expected to restart. Resolution happens from the Projects Overview.
                    </div>
                    {stoppages.length === 0 ? (
                      <div style={{ padding: '16px', textAlign: 'center', fontSize: '11px', color: '#9f1239', background: '#fff', border: '1px dashed #fecaca', borderRadius: '6px' }}>
                        No work stoppages logged for this report.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {stoppages.map((s, index) => {
                          const tone = toneClassForCategory(s.category);
                          const isResolved = (existingStoppages[index]?.is_resolved) || false;
                          return (
                            <div key={`stoppage-${index}`} className="p-3 bg-white rounded border border-red-100 relative group">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span className={cn('w-2 h-2 rounded-full', tone.dot)} />
                                  <span style={{ fontSize: '10px', fontWeight: 700, color: '#7f1d1d', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Stoppage #{index + 1}
                                  </span>
                                  {isResolved && view === 'view' && (
                                    <span style={{ fontSize: '9px', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '2px 6px', borderRadius: '8px' }}>
                                      Resolved
                                    </span>
                                  )}
                                </div>
                                {view !== 'view' && (
                                  <ShadcnButton
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-300 hover:text-red-600"
                                    onClick={() => removeStoppageRow(index)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </ShadcnButton>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
                                <div>
                                  <label style={{ fontSize: '10px', fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Category</label>
                                  <Select
                                    value={s.category}
                                    onValueChange={(v) => updateStoppageRow(index, { category: v as StoppageCategory })}
                                    disabled={view === 'view'}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-white mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {STOPPAGE_CATEGORY_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <label style={{ fontSize: '10px', fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Blocked by</label>
                                  <Select
                                    value={s.blocking_party}
                                    onValueChange={(v) => updateStoppageRow(index, { blocking_party: v as BlockingParty })}
                                    disabled={view === 'view'}
                                  >
                                    <SelectTrigger className="h-8 text-xs bg-white mt-1">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {BLOCKING_PARTY_OPTIONS.map((o) => (
                                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Affected work</label>
                                <Input
                                  className="h-8 text-xs bg-white mt-1"
                                  value={s.affected_work}
                                  onChange={(e) => updateStoppageRow(index, { affected_work: e.target.value })}
                                  placeholder="e.g. AHU-1 piping on 3rd floor east wing"
                                  readOnly={view === 'view'}
                                />
                              </div>
                              <div style={{ marginBottom: '8px' }}>
                                <label style={{ fontSize: '10px', fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Reason / context</label>
                                <Textarea
                                  className="text-xs bg-white mt-1 min-h-[44px]"
                                  value={s.reason_detail}
                                  onChange={(e) => updateStoppageRow(index, { reason_detail: e.target.value })}
                                  placeholder="What happened, who needs to act"
                                  readOnly={view === 'view'}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '10px', fontWeight: 600, color: '#525252', textTransform: 'uppercase' }}>Expected restart date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(leave blank if unknown)</span></label>
                                <Input
                                  type="date"
                                  className="h-8 text-xs bg-white mt-1"
                                  value={s.expected_resolution_date}
                                  onChange={(e) => updateStoppageRow(index, { expected_resolution_date: e.target.value })}
                                  readOnly={view === 'view'}
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {view !== 'view' && (
                      <button
                        type="button"
                        onClick={addStoppageRow}
                        style={{ fontSize: '11px', color: '#b91c1c', background: 'none', border: '1px dashed #fca5a5', borderRadius: '6px', padding: '8px', cursor: 'pointer', fontWeight: 600 }}
                      >
                        + Log Stoppage
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section 7: Photos */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('photos')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.photos ? '10px' : 0 }}>
                  <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px', cursor: 'pointer' }}>Visual Documentation (Photos)</label>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.photos && 'rotate-90')} />
                </button>
                {openSections.photos && (
                  <SiteReportPhotoUploader
                    mode={view === 'view' ? 'view' : view === 'edit' ? 'edit' : 'create'}
                    reportId={selectedReportId}
                    organisationId={organisation?.id ?? null}
                    userId={user?.id ?? null}
                    pendingPhotos={pendingPhotos}
                    onPendingChange={setPendingPhotos}
                  />
                )}
              </div>

              {/* Section 8: Engineer Signature & Date */}
              <div style={{ border: '1px solid #f0f0f0', borderRadius: '8px', padding: '16px', background: '#fafafa' }}>
                <button type="button" onClick={() => toggleSection('footer')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', background: 'none', border: 'none', padding: 0, cursor: 'pointer', marginBottom: openSections.footer ? '14px' : 0 }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#404040', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Engineer Signature & Date</div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.footer && 'rotate-90')} />
                </button>
                {openSections.footer && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Engineer/Supervisor Name *</label>
                    <Input className="h-10 bg-white font-semibold" {...form.register('footer.engineer')} placeholder="Enter your name" />
                    {errors.footer?.engineer && <p className="text-[10px] text-red-500 font-medium">{errors.footer.engineer.message}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 700, color: '#525252', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Signature Date *</label>
                    <Input type="date" className="h-10 bg-white" {...form.register('footer.signatureDate')} />
                    {errors.footer?.signatureDate && <p className="text-[10px] text-red-500 font-medium">{errors.footer.signatureDate.message}</p>}
                  </div>
                </div>}
              </div>

              {/* Section 9: Approval (Phase D) — visible only in create mode */}
              {view === 'create' && (
                <div style={{ border: '1px solid #dbeafe', borderRadius: '8px', padding: '16px', background: '#eff6ff' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: submitForApproval ? '14px' : 0 }}>
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approval</div>
                      <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>
                        {submitForApproval
                          ? 'Pick an approver — they will review and approve / reject this report'
                          : 'Save as a draft now, or submit for approval'}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-semibold uppercase tracking-widest text-zinc-600">Submit for approval</span>
                      <button
                        type="button"
                        onClick={() => {
                          setSubmitForApproval((v) => !v);
                          if (submitForApproval) setSelectedApproverId('');
                        }}
                        className={cn(
                          "relative inline-flex h-5 w-9 rounded-full transition-colors",
                          submitForApproval ? "bg-blue-600" : "bg-zinc-300"
                        )}
                        aria-pressed={submitForApproval}
                      >
                        <span className={cn(
                          "inline-block h-4 w-4 rounded-full bg-white shadow transform transition-transform mt-0.5",
                          submitForApproval ? "translate-x-4 ml-0.5" : "translate-x-0.5"
                        )} />
                      </button>
                    </div>
                  </div>
                  {submitForApproval && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 700, color: '#1e3a8a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Approver (MD / PM / Manager) *</label>
                      <Select
                        value={selectedApproverId}
                        onValueChange={setSelectedApproverId}
                      >
                        <SelectTrigger className="h-10 bg-white">
                          <SelectValue placeholder={approvableMembers.length === 0 ? "No approvers available in this org" : "Select approver"} />
                        </SelectTrigger>
                        <SelectContent>
                          {approvableMembers.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.full_name || m.email} <span className="text-zinc-400 text-[10px]">· {m.role}</span>
                            </SelectItem>
                          ))}
                          {approvableMembers.length === 0 && (
                            <SelectItem value="_empty" disabled>No MD / PM / Manager found in this organisation</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {selectedApproverId && (
                        <p className="text-[10px] text-blue-700 font-medium">
                          This report will be locked after submission. The approver will be notified.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </fieldset>

            {/* Footer Buttons */}
            <div style={{
              display: 'flex',
              gap: '12px',
              marginTop: '24px',
              paddingTop: '16px',
              borderTop: '1px solid #e5e5e5',
            }}>
              <button
                type="button"
                onClick={() => setView('list')}
                style={{
                  flex: 1,
                  padding: '10px 16px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '6px',
                  background: '#fff',
                  color: '#525252',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {view === 'view' ? 'Back to List' : 'Cancel'}
              </button>
              {view !== 'view' && (
                <>
                  <button
                    type="button"
                    onClick={saveAsDraft}
                    disabled={isMutating}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '6px',
                      background: '#fff',
                      color: '#374151',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: isMutating ? 'not-allowed' : 'pointer',
                      opacity: isMutating ? 0.6 : 1,
                    }}
                  >
                    {isMutating ? 'Saving...' : 'Save as Draft'}
                  </button>
                  <button
                    type="submit"
                    disabled={isMutating}
                    style={{
                      flex: 1,
                      padding: '10px 16px',
                      border: 'none',
                      borderRadius: '6px',
                      background: '#2563eb',
                      color: '#fff',
                      fontSize: '14px',
                      fontWeight: 600,
                      cursor: isMutating ? 'not-allowed' : 'pointer',
                      opacity: isMutating ? 0.6 : 1,
                    }}
                  >
                    {isMutating ? 'Saving...' : view === 'edit' ? 'Update Report' : 'Submit Site Report'}
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }
}
