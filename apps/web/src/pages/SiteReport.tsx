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
  X,
  Mic,
  Clock
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
import TaskLinkSelector from '@/components/tasks/TaskLinkSelector';
import { useTaskLabelResolution } from '@/hooks/useTaskSearch';

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
      subcontractor_id: z.string().optional(),
      name: z.string(),
      count: z.string(),
      start: z.string(),
      end: z.string()
    }))
  }),
  
  workCarriedOut: z.array(z.object({
    value: z.string().min(1, "Work description is required"),
    trade: z.string().min(1, "Trade category is required")
  })).min(1, "At least one work item is required"),
  milestonesCompleted: z.array(z.object({ value: z.string() })),
  
  progress: z.object({
    planned: z.string().min(1, "Planned progress is required"),
    actual: z.string().min(1, "Actual progress is required"),
    percentComplete: z.string().min(1, "Percent complete is required")
  }),
  
  equipment: z.object({
    onSite: z.string(),
    breakdown: z.string(),
    noFault: z.boolean().optional(),
    noFaultNotes: z.string().optional()
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
    receivedSignature: z.enum(['Yes', 'Pending']),
    dcInvoiceSupplied: z.boolean().optional(),
    submittedToOffice: z.boolean().optional(),
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

  // Continuous Improvement Observations state
  const [observations, setObservations] = useState<Array<{ category: string; title: string }>>([]);
  const [activeListeningIdx, setActiveListeningIdx] = useState<number | null>(null);

  const startListeningForObservation = (idx: number) => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Voice input is not supported in this browser. Please use Chrome/Safari.');
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setActiveListeningIdx(idx);
    };

    recognition.onresult = (event: any) => {
      const speechToText = event.results[0][0].transcript;
      setObservations(prev => prev.map((o, i) => i === idx ? { ...o, title: speechToText } : o));
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setActiveListeningIdx(null);
    };

    recognition.onend = () => {
      setActiveListeningIdx(null);
    };

    recognition.start();
  };

  // List view filters
  const [searchQuery, setSearchQuery] = useState('');
  const [projectFilter, setProjectFilter] = useState<string>('');
  const [engineerFilter, setEngineerFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<DateRange>('all');
  const [groupByDate, setGroupByDate] = useState(true);

  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const issueIdParam = searchParams.get('issue_id');
  const actionParam = searchParams.get('action');
  const taskIdParam = searchParams.get('task_id');

  // Accordion open/closed state — all open by default
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    identification: true,
    manpower: true,
    workMilestones: true,
    taskLinks: true,
    progressEquipmentSafety: true,
    logistics: true,
    issuesPlanClient: true,
    workStoppages: true,
    continuousImprovement: false,
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

  // Task linking state (from 075_report_task_integration.sql)
  const [primaryTaskId, setPrimaryTaskId] = useState<string | null>(null);
  const [coveredTaskIds, setCoveredTaskIds] = useState<string[]>([]);
  // Per-stoppage task_id: keyed by stoppage index
  const [stoppageTaskIds, setStoppageTaskIds] = useState<Record<number, string | null>>({});

  const addStoppageRow = () => setStoppages((prev) => [
    ...prev,
    { category: 'payment', blocking_party: 'unknown', affected_work: '', reason_detail: '', expected_resolution_date: '' },
  ]);
  const updateStoppageRow = (idx: number, patch: Partial<StoppageDraft>) =>
    setStoppages((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  const removeStoppageRow = (idx: number) => {
    setStoppages((prev) => prev.filter((_, i) => i !== idx));
    setStoppageTaskIds((prev) => {
      const next: Record<number, string | null> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = Number(k);
        if (ki < idx) next[ki] = v;
        else if (ki > idx) next[ki - 1] = v;
      });
      return next;
    });
  };
  const resetStoppages = () => { setStoppages([]); setStoppagesLoaded(false); setStoppageTaskIds({}); };

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

  const form = useForm<SiteReportFormValues>({
    resolver: zodResolver(siteReportSchema),
    mode: 'onTouched', // Validate on blur/touch for inline feedback
    defaultValues: {
      client: '',
      projectName: '',
      date: new Date().toISOString().split('T')[0],
      manpower: {
        total: '', skilled: '', unskilled: '', startTime: '', endTime: '',
        subContractors: [{ name: '', count: '', start: '', end: '' }]
      },
      workCarriedOut: [{ value: '', trade: 'General' }],
      milestonesCompleted: [{ value: '' }],
      progress: { planned: '', actual: '', percentComplete: '' },
      equipment: { onSite: '', breakdown: '', noFault: false, noFaultNotes: '' },
      safety: { toolboxMeeting: false, ppe: false },
      quality: { inspection: 'Pending', satisfiedPercent: '', reworkRequiredReason: '' },
      rework: { isRework: false, reason: '', start: '', end: '', materialUsed: '', totalManpower: '' },
      documents: { type: 'DC', docNo: '', receivedSignature: 'Pending', dcInvoiceSupplied: false, submittedToOffice: false },
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

  // Style constants for the refactored form
  const sectionCardStyle: React.CSSProperties = {
    background: '#fff',
    borderRadius: '10px',
    padding: '20px',
    boxShadow: '0 1px 3px 0 rgba(0,0,0,0.06), 0 1px 2px -1px rgba(0,0,0,0.04)',
  };
  const sectionHeaderStyle = (isOpen: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
    marginBottom: isOpen ? '16px' : 0,
  });
  const accentHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  };
  const accentLineStyle: React.CSSProperties = {
    width: '3px',
    height: '16px',
    background: '#2563eb',
    borderRadius: '2px',
    flexShrink: 0,
  };
  const sectionTitleStyle: React.CSSProperties = {
    fontSize: '13px',
    fontWeight: 600,
    color: '#1e293b',
  };
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    fontWeight: 500,
    color: '#374151',
  };
  const fieldGroupLabelStyle: React.CSSProperties = {
    fontSize: '10px',
    fontWeight: 600,
    color: '#64748b',
  };
  const addOutlineBtnStyle: React.CSSProperties = {
    fontSize: '11px',
    fontWeight: 600,
    color: '#2563eb',
    background: '#fff',
    border: '1px solid #bfdbfe',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
  };
  const subSectionStyle: React.CSSProperties = {
    background: '#f8fafc',
    borderRadius: '8px',
    padding: '16px',
  };

  // Auto-calculate total manpower
  const skilledCount = form.watch('manpower.skilled');
  const unskilledCount = form.watch('manpower.unskilled');
  const computedTotal = useMemo(() => {
    const s = parseInt(skilledCount || '0', 10);
    const u = parseInt(unskilledCount || '0', 10);
    return (isNaN(s) ? 0 : s) + (isNaN(u) ? 0 : u);
  }, [skilledCount, unskilledCount]);

  // Sync computed total back to form
  useEffect(() => {
    form.setValue('manpower.total', String(computedTotal));
  }, [computedTotal, form]);

  // Project milestones query & dismissal states
  const selectedProjectId = form.watch('projectName');
  const reportDateStr = form.watch('date');

  const { data: upcomingMilestones = [] } = useQuery<any[]>({
    queryKey: ['upcoming-milestones', selectedProjectId, organisation?.id],
    queryFn: async () => {
      if (!selectedProjectId || !organisation?.id) return [];
      
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fourteenDaysLater = new Date(today);
      fourteenDaysLater.setDate(today.getDate() + 14);
      const limitStr = fourteenDaysLater.toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('project_milestones')
        .select('*')
        .eq('project_id', selectedProjectId)
        .eq('organisation_id', organisation.id)
        .eq('is_completed', false)
        .lte('milestone_date', limitStr)
        .order('milestone_date', { ascending: true });
        
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProjectId && !!organisation?.id && (view === 'create' || view === 'edit'),
  });

  const [dismissedMilestones, setDismissedMilestones] = useState<string[]>([]);
  const [expandMilestones, setExpandMilestones] = useState(false);

  const milestoneStorageKey = selectedProjectId && reportDateStr
    ? `mep-dismissed-milestone-${selectedProjectId}-${reportDateStr}`
    : null;

  useEffect(() => {
    if (milestoneStorageKey) {
      const isDismissed = localStorage.getItem(milestoneStorageKey) === 'true';
      if (isDismissed) {
        setDismissedMilestones(prev => [...prev, selectedProjectId]);
      } else {
        setDismissedMilestones(prev => prev.filter(id => id !== selectedProjectId));
      }
    }
  }, [milestoneStorageKey, selectedProjectId]);

  const dismissMilestoneBar = () => {
    if (milestoneStorageKey && selectedProjectId) {
      localStorage.setItem(milestoneStorageKey, 'true');
      setDismissedMilestones(prev => [...prev, selectedProjectId]);
    }
  };

  // Load tasks using useTaskLabelResolution
  const linkedTaskIds = useMemo(() => {
    const ids = [];
    if (primaryTaskId) ids.push(primaryTaskId);
    if (coveredTaskIds && coveredTaskIds.length > 0) {
      coveredTaskIds.forEach(id => {
        if (id && id !== primaryTaskId) ids.push(id);
      });
    }
    return ids;
  }, [primaryTaskId, coveredTaskIds]);

  const { data: linkedTasks = [] } = useTaskLabelResolution(organisation?.id ?? '', linkedTaskIds);

  // Pre-fill task links when navigated here from a task drawer
  useEffect(() => {
    if (taskIdParam && view === 'create') {
      setPrimaryTaskId(taskIdParam);
      setCoveredTaskIds(prev => prev.includes(taskIdParam) ? prev : [taskIdParam, ...prev]);
      
      // Fetch the task to pre-fill the project
      supabase
        .from('tasks')
        .select('project_id')
        .eq('id', taskIdParam)
        .single()
        .then(({ data }) => {
          if (data?.project_id) {
            form.setValue('projectName', data.project_id);
          }
        });
    }
  }, [taskIdParam, view, form]);

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
  const { data: clients, isLoading: clientsLoading, error: clientsError } = useQuery<any[]>({
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
  const { data: projects, isLoading: projectsLoading, error: projectsError } = useQuery<any[]>({
    queryKey: ['site-report-projects', organisation?.id],
    enabled: !!organisation?.id,
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name, project_code')
        .eq('organisation_id', organisation.id)
        .eq('status', 'Active')
        .order('project_name');
      if (error) {
        console.error('Projects fetch error:', error);
        return [];
      }
      return data || [];
    }
  });

  const { data: subcontractors } = useQuery<any[]>({
    queryKey: ['site-report-subcontractors', organisation?.id],
    enabled: !!organisation?.id,
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('subcontractors')
        .select('id, company_name, sub_number')
        .eq('organisation_id', organisation.id)
        .eq('status', 'Active')
        .order('company_name');
      if (error) {
        console.error('Subcontractors fetch error:', error);
        return [];
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

      const [subs, works, milestones, clientReqs, wpnd, si, issues, taskLinks, insights] = await Promise.all([
        supabase.from('sub_contractors').select('name, count, start_time, end_time, subcontractor_id').eq('report_id', selectedReportId),
        supabase.from('work_carried_out').select('description, trade').eq('report_id', selectedReportId),
        supabase.from('milestones_completed').select('description').eq('report_id', selectedReportId),
        supabase.from('site_report_client_requirements').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_work_plan_next_day').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_special_instructions').select('description, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('site_report_issues_faced').select('issue, solution, sort_order').eq('report_id', selectedReportId).order('sort_order'),
        supabase.from('report_task_links').select('task_id').eq('report_id', selectedReportId),
        supabase.from('project_insights').select('category, title').eq('site_report_id', selectedReportId),
      ]);

      return {
        ...report,
        _subs: subs.data || [],
        _works: works.data || [],
        _milestones: milestones.data || [],
        _clientReqs: clientReqs.data || [],
        _wpnd: wpnd.data || [],
        _si: si.data || [],
        _issues: issues.data || [],
        _taskLinks: taskLinks.data || [],
        _observations: insights.data || []
      };
    },
  });

  // Prefill the form when entering view/edit mode and data is loaded
  useEffect(() => {
    if ((view !== 'view' && view !== 'edit') || !selectedReport) return;
    const r: any = selectedReport;
    
    // Initialize task links state
    const linkedIds = (r._taskLinks || []).map((tl: any) => tl.task_id);
    setPrimaryTaskId(r.primary_task_id || null);
    setCoveredTaskIds(linkedIds.filter((id: string) => id !== r.primary_task_id));
    const clientReq = (r._clientReqs || []).map((cr: any) => ({ value: cr.description || '' }));
    const nextDay = (r._wpnd || []).map((w: any) => ({ value: w.description || '' }));
    const instr = (r._si || []).map((s: any) => ({ value: s.description || '' }));
    const issues = (r._issues || []).map((i: any) => ({ issue: i.issue || '', solution: i.solution || '' }));
    const loadedObs = (r._observations || []).map((o: any) => ({ category: o.category || '', title: o.title || '' }));
    setObservations(loadedObs);
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
          subcontractor_id: s.subcontractor_id || '', name: s.name || '', count: s.count || '', start: s.start_time || '', end: s.end_time || ''
        })).length > 0
          ? (r._subs || []).map((s: any) => ({ subcontractor_id: s.subcontractor_id || '', name: s.name || '', count: s.count || '', start: s.start_time || '', end: s.end_time || '' }))
          : [{ subcontractor_id: '', name: '', count: '', start: '', end: '' }],
      },
      workCarriedOut: (r._works || []).map((w: any) => ({ value: w.description || '', trade: w.trade || 'General' })),
      milestonesCompleted: (r._milestones || []).map((m: any) => ({ value: m.description || '' })),
      progress: { planned: r.planned_progress || '', actual: r.actual_progress || '', percentComplete: r.percent_complete || '' },
      equipment: { onSite: r.equipment_on_site || '', breakdown: r.breakdown_issues || '', noFault: !!r.equipment_no_fault, noFaultNotes: r.equipment_no_fault_notes || '' },
      safety: { toolboxMeeting: !!r.toolbox_meeting, ppe: !!r.ppe_followed },
      quality: { inspection: (r.inspection_status as any) || 'Pending', satisfiedPercent: r.satisfied_percent || '', reworkRequiredReason: r.rework_required_reason || '' },
      rework: {
        isRework: !!r.is_rework, reason: r.rework_reason || '',
        start: r.rework_start || '', end: r.rework_end || '',
        materialUsed: r.rework_material_used || '', totalManpower: r.rework_total_manpower || ''
      },
      documents: { type: (r.doc_type as any) || 'DC', docNo: r.doc_no || '', receivedSignature: (r.received_signature as any) || 'Pending', dcInvoiceSupplied: !!r.dc_invoice_supplied, submittedToOffice: !!r.submitted_to_office },
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
      // 0. Fetch task snapshots for linked tasks (primaryTaskId + coveredTaskIds)
      const allLinkedIds = Array.from(new Set([
        ...(primaryTaskId ? [primaryTaskId] : []),
        ...coveredTaskIds,
      ])).filter(Boolean);

      let taskSnapshots: any[] = [];
      if (allLinkedIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, completion_percentage')
          .in('id', allLinkedIds);
        
        if (tasksError) throw tasksError;

        taskSnapshots = (tasksData || []).map(t => ({
          task_id: t.id,
          status_during_report: t.status,
          completion_snapshot: t.completion_percentage,
          is_completed_in_report: t.status === 'completed'
        }));
      }

      // 1. Save main report and links using RPC
      const finalPmStatus = submitForApproval ? 'Pending Approval' : values.reporting.pmStatus;
      const reportPayload = {
        organisation_id: organisation?.id,
        issue_id: toNullableUuid(issueIdParam) || null,
        client_id: toNullableUuid(values.client) || null,
        project_id: toNullableUuid(values.projectName) || null,
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
        breakdown_issues: values.equipment.noFault ? '' : values.equipment.breakdown,
        equipment_no_fault: values.equipment.noFault || false,
        equipment_no_fault_notes: values.equipment.noFault ? (values.equipment.noFaultNotes || '') : '',
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
        dc_invoice_supplied: values.documents.dcInvoiceSupplied || false,
        submitted_to_office: values.documents.submittedToOffice || false,
        quote_to_be_sent: values.clientRequirements.quoteToBe_sent,
        mail_received: values.clientRequirements.mailReceived,
        pm_status: finalPmStatus,
        material_arrangement: values.reporting.materialArrangement,
        is_filed: values.documentation.filed,
        tools_locked: values.documentation.toolsLocked,
        site_pictures_status: values.documentation.sitePictures,
        engineer_name: values.footer.engineer,
        signature_date: values.footer.signatureDate,
        primary_task_id: primaryTaskId || null
      };

      const { data: reportId, error: rpcError } = await supabase.rpc('create_complete_site_report', {
        p_report: reportPayload,
        p_links: taskSnapshots,
        p_children: {
          subContractors: values.manpower.subContractors.map(s => ({
            subcontractor_id: s.subcontractor_id || null,
            name: s.name,
            count: s.count,
            start: s.start || null,
            end: s.end || null,
          })),
          workCarriedOut: values.workCarriedOut.map(w => ({
            value: w.value,
            trade: w.trade || 'General',
          })),
          milestonesCompleted: values.milestonesCompleted.map(m => ({ value: m.value })),
          clientRequirements: values.clientRequirements.details,
          workPlanNextDay: values.workPlanNextDay,
          specialInstructions: values.specialInstructions,
          issuesFaced: values.issues,
        },
      });

      if (rpcError) throw rpcError;
      const report = { id: reportId };
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
      setObservations([]);
      setSubmitForApproval(false);
      setSelectedApproverId('');

      if (issueIdParam) {
        navigate(`/issue/${issueIdParam}`);
      } else {
        setView('list');
      }
    },

    onError: (error: any) => {
      toast.error(`Failed to save report: ${error.message}`);
    }
  });

  // Update an existing report (Edit mode)
  const updateMutation = useMutation({
    mutationFn: async (values: SiteReportFormValues) => {
      if (!selectedReportId) throw new Error('No report selected for update');
      const reportId = selectedReportId;

      // 0. Fetch task snapshots for linked tasks (primaryTaskId + coveredTaskIds)
      const allLinkedIds = Array.from(new Set([
        ...(primaryTaskId ? [primaryTaskId] : []),
        ...coveredTaskIds,
      ])).filter(Boolean);

      let taskSnapshots: any[] = [];
      if (allLinkedIds.length > 0) {
        const { data: tasksData, error: tasksError } = await supabase
          .from('tasks')
          .select('id, status, completion_percentage')
          .in('id', allLinkedIds);
        
        if (tasksError) throw tasksError;

        taskSnapshots = (tasksData || []).map(t => ({
          task_id: t.id,
          status_during_report: t.status,
          completion_snapshot: t.completion_percentage,
          is_completed_in_report: t.status === 'completed'
        }));
      }

      // 1. Atomic update: main row + all child rows in a single transaction
      const reportPayload = {
        organisation_id: organisation?.id,
        issue_id: toNullableUuid(selectedReport?.issue_id) || toNullableUuid(issueIdParam) || null,
        client_id: toNullableUuid(values.client) || null,
        project_id: toNullableUuid(values.projectName) || null,
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
        breakdown_issues: values.equipment.noFault ? '' : values.equipment.breakdown,
        equipment_no_fault: values.equipment.noFault || false,
        equipment_no_fault_notes: values.equipment.noFault ? (values.equipment.noFaultNotes || '') : '',
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
        dc_invoice_supplied: values.documents.dcInvoiceSupplied || false,
        submitted_to_office: values.documents.submittedToOffice || false,
        quote_to_be_sent: values.clientRequirements.quoteToBe_sent,
        mail_received: values.clientRequirements.mailReceived,
        pm_status: values.reporting.pmStatus,
        material_arrangement: values.reporting.materialArrangement,
        is_filed: values.documentation.filed,
        tools_locked: values.documentation.toolsLocked,
        site_pictures_status: values.documentation.sitePictures,
        engineer_name: values.footer.engineer,
        signature_date: values.footer.signatureDate,
        primary_task_id: primaryTaskId || null
      };

      await supabase.rpc('update_complete_site_report', {
        p_report_id: reportId,
        p_report: reportPayload,
        p_links: taskSnapshots,
        p_children: {
          subContractors: values.manpower.subContractors.map(s => ({
            subcontractor_id: s.subcontractor_id || null,
            name: s.name,
            count: s.count,
            start: s.start || null,
            end: s.end || null,
          })),
          workCarriedOut: values.workCarriedOut.map(w => ({
            value: w.value,
            trade: w.trade || 'General',
          })),
          milestonesCompleted: values.milestonesCompleted.map(m => ({ value: m.value })),
          clientRequirements: values.clientRequirements.details,
          workPlanNextDay: values.workPlanNextDay,
          specialInstructions: values.specialInstructions,
          issuesFaced: values.issues,
        },
      });

      // Stoppages and observations remain as separate side-effect calls
      // (they are not part of the core report aggregate)
      await deleteStoppages.mutateAsync();
      const stoppageRows = (stoppages || [])
        .filter((s) => s.affected_work.trim() || s.reason_detail.trim() || s.expected_resolution_date)
        .map((s, idx) => ({
          organisation_id: organisation?.id,
          report_id: reportId,
          category: s.category,
          blocking_party: s.blocking_party,
          affected_work: s.affected_work,
          reason_detail: s.reason_detail,
          expected_resolution_date: s.expected_resolution_date || null,
          task_id: stoppageTaskIds[idx] || null,
        }));
      if (stoppageRows.length > 0) {
        await createStoppages.mutateAsync(stoppageRows as any);
      }

      await supabase
        .from('project_insights')
        .delete()
        .eq('site_report_id', reportId);

      if (observations && observations.length > 0) {
        const obsRows = observations
          .filter((obs: any) => obs.category && obs.title)
          .map((obs: any) => ({
            organisation_id: organisation?.id,
            project_id: toNullableUuid(values.projectName) || null,
            source_type: 'site_report',
            source_id: reportId,
            site_report_id: reportId,
            category: obs.category,
            title: obs.title,
            status: 'Open',
            visibility: 'Everyone',
            created_by: user?.id || null
          }));
        if (obsRows.length > 0) {
          const { error: obsError } = await supabase
            .from('project_insights')
            .insert(obsRows);
          if (obsError) throw obsError;
        }
      }
    },
    onSuccess: () => {
      toast.success('Site report updated');
      queryClient.invalidateQueries({ queryKey: ['site-reports'] });
      queryClient.invalidateQueries({ queryKey: ['site-report', selectedReportId] });
      // Invalidate task queries so "Last Report" column and drawer history refresh
      queryClient.invalidateQueries({ queryKey: ['task-site-reports'] });
      queryClient.invalidateQueries({ queryKey: ['project-tasks'] });
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
    if (!organisation) {
      toast.error("Organization not found");
      return;
    }

    const values = form.getValues();
    const siteReportData = {
      id: 'temp-' + Date.now(),
      report_date: values.date,
      client_name: clients?.find(c => c.id === values.client)?.client_name,
      project_name: projects?.find(p => p.id === values.projectName)?.project_name,
      pm_name: '',
      pm_status: values.reporting?.pmStatus || 'Draft',
      weather: '',
      start_time: values.manpower?.startTime || '',
      end_time: values.manpower?.endTime || '',
      total_manpower: values.manpower?.total || '',
      skilled_manpower: values.manpower?.skilled || '',
      unskilled_manpower: values.manpower?.unskilled || '',
      planned_progress: values.progress?.planned || '',
      actual_progress: values.progress?.actual || '',
      percent_complete: values.progress?.percentComplete || '',
      equipment_on_site: values.equipment?.onSite || '',
      breakdown_issues: values.equipment?.noFault ? '' : (values.equipment?.breakdown || ''),
      equipment_no_fault: values.equipment?.noFault || false,
      equipment_no_fault_notes: values.equipment?.noFault ? (values.equipment?.noFaultNotes || '') : '',
      toolbox_meeting: values.safety?.toolboxMeeting || false,
      ppe_followed: values.safety?.ppe || false,
      inspection_status: values.quality?.inspection || '',
      satisfied_percent: values.quality?.satisfiedPercent || '',
      rework_required_reason: values.quality?.reworkRequiredReason || '',
      is_rework: values.rework?.isRework || false,
      rework_reason: values.rework?.reason || '',
      rework_start: values.rework?.start || '',
      rework_end: values.rework?.end || '',
      rework_material_used: values.rework?.materialUsed || '',
      rework_total_manpower: values.rework?.totalManpower || '',
      work_plan_next_day: (values.workPlanNextDay || []).map((w: any) => w.value).filter(Boolean).join(', '),
      special_instructions: (values.specialInstructions || []).map((s: any) => s.value).filter(Boolean).join(', '),
      issues_faced: (values.issues || []).map((i: any) => `${i.issue}: ${i.solution}`).filter(Boolean).join('; '),
      doc_type: values.documents?.type || '',
      doc_no: values.documents?.docNo || '',
      received_signature: values.documents?.receivedSignature || '',
      dc_invoice_supplied: values.documents?.dcInvoiceSupplied || false,
      submitted_to_office: values.documents?.submittedToOffice || false,
      quote_to_be_sent: values.clientRequirements?.quoteToBe_sent || false,
      mail_received: values.clientRequirements?.mailReceived || false,
      is_filed: values.documentation?.filed || false,
      tools_locked: values.documentation?.toolsLocked || false,
      site_pictures_status: values.documentation?.sitePictures || '',
      manpower: {
        subContractors: (values.manpower?.subContractors || []).map((s: any) => ({
          name: s.name || '',
          count: s.count || '',
          start_time: s.start || s.start_time || '',
          end_time: s.end || s.end_time || '',
        })),
        workCarriedOut: (values.workCarriedOut || []).map((w: any) => ({ description: w.value || '' })),
        milestonesCompleted: (values.milestonesCompleted || []).map((m: any) => ({ description: m.value || '' })),
      },
      photos: [],
      footer: {
        enginear: values.footer?.engineer || '',
        signatureDate: values.footer?.signatureDate || ''
      }
    };

    const doc = generateProGridSiteReportPdf({
      siteReport: siteReportData as any,
      organisation,
      orientation: 'portrait',
      pageFormat: 'a4'
    });

    // Create blob and download
    const pdfBlob = doc.output('blob');
    const url = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.href = url;
      link.download = `site-report-${values.date}.pdf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    toast.success("PDF generated successfully");
  }, [form, clients, projects, organisation]);

  const downloadReportPDF = async (reportId: string) => {
    try {
      const { data: report, error } = await supabase
        .from('site_reports')
        .select(`
          id,
          report_date,
          pm_status,
          engineer_name,
          signature_date,
          organisation_id,
          start_time,
          end_time,
          total_manpower,
          skilled_manpower,
          unskilled_manpower,
          planned_progress,
          actual_progress,
          percent_complete,
          equipment_on_site,
          breakdown_issues,
          toolbox_meeting,
          ppe_followed,
          inspection_status,
          satisfied_percent,
          rework_required_reason,
          is_rework,
          rework_reason,
          rework_start,
          rework_end,
          rework_material_used,
          rework_total_manpower,
          work_plan_next_day,
          special_instructions,
          issues_faced,
          doc_type,
          doc_no,
          received_signature,
          dc_invoice_supplied,
          submitted_to_office,
          quote_to_be_sent,
          mail_received,
          is_filed,
          tools_locked,
          site_pictures_status,
          clients (client_name),
          projects (project_name),
          sub_contractors (name, count, start_time, end_time),
          work_carried_out (description, trade),
          milestones_completed (description),
          site_report_photos (file_name, file_path)
        `)
        .eq('id', reportId)
        .single();

      if (error || !report) throw error || new Error('Report not found');

      const r = report as any;
      const siteReportData = {
        id: report.id,
        report_date: report.report_date,
        client_name: r.clients?.client_name,
        project_name: r.projects?.project_name,
        pm_name: '',
        pm_status: report.pm_status,
        weather: '',
        start_time: report.start_time || '',
        end_time: report.end_time || '',
        total_manpower: report.total_manpower || '',
        skilled_manpower: report.skilled_manpower || '',
        unskilled_manpower: report.unskilled_manpower || '',
        planned_progress: report.planned_progress || '',
        actual_progress: report.actual_progress || '',
        percent_complete: report.percent_complete || '',
        equipment_on_site: report.equipment_on_site || '',
        breakdown_issues: report.equipment_no_fault ? '' : (report.breakdown_issues || ''),
        equipment_no_fault: report.equipment_no_fault || false,
        equipment_no_fault_notes: report.equipment_no_fault ? (report.equipment_no_fault_notes || '') : '',
        toolbox_meeting: report.toolbox_meeting,
        ppe_followed: report.ppe_followed,
        inspection_status: report.inspection_status || '',
        satisfied_percent: report.satisfied_percent || '',
        rework_required_reason: report.rework_required_reason || '',
        is_rework: report.is_rework,
        rework_reason: report.rework_reason || '',
        rework_start: report.rework_start || '',
        rework_end: report.rework_end || '',
        rework_material_used: report.rework_material_used || '',
        rework_total_manpower: report.rework_total_manpower || '',
        work_plan_next_day: report.work_plan_next_day || '',
        special_instructions: report.special_instructions || '',
        issues_faced: report.issues_faced || '',
        doc_type: report.doc_type || '',
        doc_no: report.doc_no || '',
        received_signature: report.received_signature || '',
        dc_invoice_supplied: report.dc_invoice_supplied || false,
        submitted_to_office: report.submitted_to_office || false,
        quote_to_be_sent: report.quote_to_be_sent,
        mail_received: report.mail_received,
        is_filed: report.is_filed,
        tools_locked: report.tools_locked,
        site_pictures_status: report.site_pictures_status || '',
        manpower: {
          subContractors: r.sub_contractors || [],
          workCarriedOut: r.work_carried_out || [],
          milestonesCompleted: r.milestones_completed || [],
        },
        photos: r.site_report_photos || [],
        footer: {
          enginear: report.engineer_name || '',
          signatureDate: report.signature_date || '',
        },
      };

      const doc = generateProGridSiteReportPdf({
        siteReport: siteReportData,
        organisation: organisation || { id: report.organisation_id, name: 'MEP Project' },
        orientation: 'portrait',
        pageFormat: 'a4',
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
                setObservations([]);
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
          <div className="flex items-start justify-between mb-6">
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-zinc-900">
                {view === 'create' ? 'Create Site Report' : view === 'edit' ? 'Edit Site Report' : 'Site Report Details'}
              </h1>
              {/* Summary bar */}
              <div className="flex items-center gap-6 mt-3 text-xs text-zinc-500">
                <div className="flex items-center gap-1.5">
                  <CalendarIcon className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">{form.watch('date') ? new Date(form.watch('date') + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">{view === 'create' ? 'New' : form.watch('reporting.pmStatus') || 'Draft'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">{form.watch('footer.engineer') || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span className="font-medium text-zinc-700">
                    {projects?.find((p: any) => p.id === form.watch('projectName'))?.project_name || '—'}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-6">
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
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('identification')} style={sectionHeaderStyle(openSections.identification)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Report Identification</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.identification && 'rotate-90')} />
                </button>
                {openSections.identification && (
                  <>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={fieldLabelStyle}>Client *</label>
                        <Select 
                          value={form.watch('client')} 
                          onValueChange={(val) => {
                            form.setValue('client', val);
                            form.setValue('projectName', ''); 
                          }}
                        >
                          <SelectTrigger className={cn("h-10 text-sm bg-white", (errors.client || clientsError) && "border-red-500")}>
                            <SelectValue placeholder={clientsLoading ? "Loading clients..." : "Select client"} />
                          </SelectTrigger>
                          <SelectContent>
                            {clients?.map((client: any) => (
                              <SelectItem key={client.id} value={client.id}>{client.client_name}</SelectItem>
                            ))}
                            {clients?.length === 0 && !clientsLoading && (
                              <SelectItem value="_empty">No clients found</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {errors.client && <p className="text-[11px] text-red-500 font-medium">{errors.client.message}</p>}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={fieldLabelStyle}>Project *</label>
                        <Select 
                          value={form.watch('projectName')} 
                          onValueChange={(val) => form.setValue('projectName', val)}
                          disabled={!selectedClientId}
                        >
                          <SelectTrigger className={cn("h-10 text-sm bg-white", (errors.projectName || projectsError) && "border-red-500")}>
                            <SelectValue placeholder={!selectedClientId ? "Select a client to load projects" : projectsLoading ? "Fetching projects..." : "Select project"} />
                          </SelectTrigger>
                          <SelectContent>
                            {projects?.map((project: any) => (
                              <SelectItem key={project.id} value={project.id}>{project.project_name}</SelectItem>
                            ))}
                            {projects?.length === 0 && !projectsLoading && (
                              <SelectItem value="_empty">No active projects available</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                        {errors.projectName && <p className="text-[11px] text-red-500 font-medium">{errors.projectName.message}</p>}
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={fieldLabelStyle}>Report Date *</label>
                        <Input 
                          type="date" 
                          className={cn("h-10 text-sm bg-white", errors.date && "border-red-500")}
                          {...form.register('date')} 
                        />
                        {errors.date && <p className="text-[11px] text-red-500 font-medium">{errors.date.message}</p>}
                      </div>
                    </div>

                    {linkedTasks.length > 0 && (
                      <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #f1f5f9' }}>
                        <label style={fieldGroupLabelStyle}>Linked Tasks</label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '8px' }}>
                          {linkedTasks.map(t => (
                            <div
                              key={t.id}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '6px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                fontSize: '12px',
                                color: '#334155',
                              }}
                            >
                              <span style={{ fontWeight: 600, color: '#64748b' }}>#{t.task_no}</span>
                              <span>{t.title}</span>
                              {t.due_date && renderDueDateChip(t.due_date, t.status)}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Milestone Reminder Bar */}
              {upcomingMilestones.length > 0 && !dismissedMilestones.includes(selectedProjectId) && (
                <div
                  style={{
                    background: '#fffbeb',
                    borderLeft: '3px solid #f59e0b',
                    borderRadius: '8px',
                    padding: '14px 18px',
                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: '#92400e' }}>
                        Upcoming Milestone Reminder:
                      </span>
                      <span style={{ fontSize: '13px', color: '#78350f' }}>
                        <strong>{upcomingMilestones[0].name}</strong> — due {new Date(upcomingMilestones[0].milestone_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {upcomingMilestones.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setExpandMilestones(!expandMilestones)}
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            color: '#b45309',
                            background: '#fef3c7',
                            border: '1px solid #fde68a',
                            borderRadius: '6px',
                            padding: '3px 8px',
                            cursor: 'pointer',
                          }}
                        >
                          +{upcomingMilestones.length - 1} more
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={dismissMilestoneBar}
                      style={{
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        color: '#92400e',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '2px',
                        flexShrink: 0,
                      }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  
                  {expandMilestones && upcomingMilestones.length > 1 && (
                    <div style={{ marginTop: '10px', paddingLeft: '34px', display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px dashed #fde68a', paddingTop: '10px' }}>
                      {upcomingMilestones.slice(1).map((m: any) => (
                        <div key={m.id} style={{ fontSize: '12px', color: '#78350f', display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#b45309', flexShrink: 0 }} />
                          <strong>{m.name}</strong> — due {new Date(m.milestone_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 2. Manpower Section */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('manpower')} style={sectionHeaderStyle(openSections.manpower)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Manpower Details</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.manpower && 'rotate-90')} />
                </button>
                {openSections.manpower && <>
                {/* Group: Counts */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={subSectionStyle}>
                    <label style={{ ...fieldGroupLabelStyle, marginBottom: '10px', display: 'block' }}>On-site Workforce</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Skilled</label>
                        <Input className="h-10 bg-white text-sm" {...form.register('manpower.skilled')} placeholder="0" type="number" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Unskilled</label>
                        <Input className="h-10 bg-white text-sm" {...form.register('manpower.unskilled')} placeholder="0" type="number" />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Total</label>
                        <div className="h-10 flex items-center px-3 rounded-lg bg-zinc-50 border border-zinc-200 text-sm font-semibold text-zinc-700">
                          {computedTotal}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Group: Timing */}
                <div style={{ marginBottom: '20px' }}>
                  <div style={subSectionStyle}>
                    <label style={{ ...fieldGroupLabelStyle, marginBottom: '10px', display: 'block' }}>Timing</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', maxWidth: '400px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>In Time</label>
                        <div style={{ position: 'relative' }}>
                          <Input className="h-10 bg-white text-sm pl-9" type="time" {...form.register('manpower.startTime')} />
                          <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Out Time</label>
                        <div style={{ position: 'relative' }}>
                          <Input className="h-10 bg-white text-sm pl-9" type="time" {...form.register('manpower.endTime')} />
                          <Clock className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={fieldLabelStyle}>Sub-Contractors on Site</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendSubContractor({ subcontractor_id: '', name: '', count: '', start: '', end: '' })}
                        style={addOutlineBtnStyle}
                      >
                        <Plus className="w-3 h-3" />
                        Add Entry
                      </button>
                    )}
                  </div>
                  
                  <div className="rounded-lg overflow-hidden bg-white border border-zinc-200">
                    <Table>
                      <TableHeader className="bg-zinc-50">
                        <TableRow className="hover:bg-transparent">
                          <TableHead className="text-[11px] h-10 font-semibold text-zinc-600">Company/Vendor Name</TableHead>
                          <TableHead className="text-[11px] h-10 font-semibold text-zinc-600 w-[100px]">Count</TableHead>
                          <TableHead className="text-[11px] h-10 font-semibold text-zinc-600 w-[120px]">In</TableHead>
                          <TableHead className="text-[11px] h-10 font-semibold text-zinc-600 w-[120px]">Out</TableHead>
                          {view !== 'view' && <TableHead className="w-[50px] h-10"></TableHead>}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {subContractorFields.map((field, index) => (
                          <TableRow key={field.id} className="bg-white border-b-zinc-100 last:border-0 hover:bg-zinc-50/50" style={{ height: '52px' }}>
                            <TableCell className="p-2">
                              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                <input type="hidden" {...form.register(`manpower.subContractors.${index}.subcontractor_id`)} />
                                <Input className="h-9 text-sm border-zinc-200 focus:border-blue-400 bg-white" {...form.register(`manpower.subContractors.${index}.name`)} placeholder="Enter name..." style={{ flex: 1, minWidth: 0 }} />
                                {view !== 'view' && (
                                  <select
                                    style={{ fontSize: '12px', padding: '6px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', minWidth: '140px', height: '36px' }}
                                    value={form.watch(`manpower.subContractors.${index}.subcontractor_id`) || ''}
                                    onChange={(e) => {
                                      if (!e.target.value) return;
                                      const sub = subcontractors?.find((s: any) => s.id === e.target.value);
                                      if (sub) {
                                        form.setValue(`manpower.subContractors.${index}.name`, sub.company_name);
                                        form.setValue(`manpower.subContractors.${index}.subcontractor_id`, sub.id);
                                      }
                                    }}
                                  >
                                    <option value="">Pick sub</option>
                                    {subcontractors?.map((s: any) => (
                                      <option key={s.id} value={s.id}>{s.company_name}</option>
                                    ))}
                                  </select>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="p-2">
                              <Input className="h-9 text-sm bg-white" {...form.register(`manpower.subContractors.${index}.count`)} placeholder="0" />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input className="h-9 text-sm bg-white pl-8" type="time" {...form.register(`manpower.subContractors.${index}.start`)} />
                            </TableCell>
                            <TableCell className="p-2">
                              <Input className="h-9 text-sm bg-white pl-8" type="time" {...form.register(`manpower.subContractors.${index}.end`)} />
                            </TableCell>
                            {view !== 'view' && (
                              <TableCell className="p-2 text-center">
                                <ShadcnButton 
                                  type="button" 
                                  variant="ghost" 
                                  size="sm" 
                                  className="h-8 w-8 text-zinc-400 hover:text-red-500"
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
                            <TableCell colSpan={view === 'view' ? 4 : 5} className="h-14 text-center text-[12px] text-zinc-400">No sub-contractors added</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
                </>}
              </div>

              {/* 3. Work Carried Out & Milestones */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('workMilestones')} style={sectionHeaderStyle(openSections.workMilestones)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Work Carried Out & Milestones</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.workMilestones && 'rotate-90')} />
                </button>
                {openSections.workMilestones && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                <div style={subSectionStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label style={fieldLabelStyle}>Work Done Today *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendWork({ value: '', trade: 'General' })}
                        style={addOutlineBtnStyle}
                      >
                        <Plus className="w-3 h-3" />
                        Add Activity
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {workFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start p-2 bg-white rounded-lg border border-zinc-100" style={{ minHeight: '44px' }}>
                        <Select 
                          value={form.watch(`workCarriedOut.${index}.trade`) || 'General'} 
                          onValueChange={(val) => form.setValue(`workCarriedOut.${index}.trade`, val)}
                          disabled={view === 'view'}
                        >
                          <SelectTrigger className="h-9 w-36 text-xs bg-white">
                            <SelectValue placeholder="Select Trade" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="HVAC/Ducting">HVAC/Ducting</SelectItem>
                            <SelectItem value="Plumbing">Plumbing</SelectItem>
                            <SelectItem value="Electrical">Electrical</SelectItem>
                            <SelectItem value="Fire Fighting">Fire Fighting</SelectItem>
                            <SelectItem value="Flooring">Flooring</SelectItem>
                            <SelectItem value="Partition">Partition</SelectItem>
                            <SelectItem value="False Ceiling">False Ceiling</SelectItem>
                            <SelectItem value="Painting">Painting</SelectItem>
                            <SelectItem value="Glazing">Glazing</SelectItem>
                            <SelectItem value="General">General</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`workCarriedOut.${index}.value`)} placeholder="Describe activity..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 w-9 text-zinc-400 hover:text-red-500 flex-shrink-0"
                            onClick={() => removeWork(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                <div style={subSectionStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <label style={fieldLabelStyle}>Milestones Hit</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendMilestone({ value: '' })}
                        style={addOutlineBtnStyle}
                      >
                        <Plus className="w-3 h-3" />
                        Add Milestone
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {milestoneFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-start p-2 bg-white rounded-lg border border-zinc-100" style={{ minHeight: '44px' }}>
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`milestonesCompleted.${index}.value`)} placeholder="Milestone description..." />
                        {view !== 'view' && (
                          <ShadcnButton 
                            type="button" 
                            variant="ghost" 
                            size="sm" 
                            className="h-9 w-9 text-zinc-400 hover:text-red-500 flex-shrink-0"
                            onClick={() => removeMilestone(index)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>}
              </div>

              {/* 4. Progress, Equipment, Safety & Quality */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('progressEquipmentSafety')} style={sectionHeaderStyle(openSections.progressEquipmentSafety)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Progress, Equipment & Safety</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.progressEquipmentSafety && 'rotate-90')} />
                </button>
                {openSections.progressEquipmentSafety && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Progress Monitoring */}
                <div style={subSectionStyle}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Progress Monitoring</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Planned for today</label>
                    <Textarea className="min-h-[60px] text-sm bg-white" {...form.register('progress.planned')} placeholder="What was planned for today..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Actual progress</label>
                    <Textarea className="min-h-[60px] text-sm bg-white" {...form.register('progress.actual')} placeholder="What was actually achieved..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Completion</label>
                    <div className="relative">
                      <Input className="h-10 text-sm pr-10 font-semibold bg-white" {...form.register('progress.percentComplete')} placeholder="0" />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 font-medium text-xs">%</span>
                    </div>
                  </div>
                </div>

                {/* Equipment Status */}
                <div style={subSectionStyle}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Equipment Status</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Machines on site</label>
                    <Textarea className="min-h-[80px] text-sm bg-white" {...form.register('equipment.onSite')} placeholder="List tools and machinery on site..." />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Issues / breakdowns</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        type="button"
                        onClick={() => { form.setValue('equipment.noFault', false); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          !form.watch('equipment.noFault')
                            ? 'bg-red-50 border-red-300 text-red-700'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        Breakdown / Fault
                      </button>
                      <button
                        type="button"
                        onClick={() => { form.setValue('equipment.noFault', true); form.setValue('equipment.breakdown', ''); }}
                        className={`px-3 py-1.5 text-xs font-medium rounded-md border transition-colors ${
                          form.watch('equipment.noFault')
                            ? 'bg-green-50 border-green-300 text-green-700'
                            : 'bg-white border-zinc-200 text-zinc-500 hover:bg-zinc-50'
                        }`}
                      >
                        No Equipment Fault
                      </button>
                    </div>
                    {form.watch('equipment.noFault') ? (
                      <Textarea
                        className="min-h-[60px] text-sm bg-white"
                        value={form.watch('equipment.noFaultNotes') || ''}
                        onChange={(e) => form.setValue('equipment.noFaultNotes', e.target.value)}
                        placeholder="All equipment functioning normally. Optional notes..."
                      />
                    ) : (
                      <Textarea className="min-h-[80px] text-sm bg-white" {...form.register('equipment.breakdown')} placeholder="Report mechanical issues or breakdowns..." />
                    )}
                  </div>
                </div>

                {/* Safety & Quality */}
                <div style={subSectionStyle}>
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#334155', marginBottom: '12px' }}>Safety & Quality</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-zinc-100">
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Toolbox meeting</label>
                      <Checkbox checked={form.watch('safety.toolboxMeeting')} onCheckedChange={(c) => form.setValue('safety.toolboxMeeting', !!c)} />
                    </div>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-zinc-100">
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>PPE protocols followed</label>
                      <Checkbox checked={form.watch('safety.ppe')} onCheckedChange={(c) => form.setValue('safety.ppe', !!c)} />
                    </div>
                  </div>
                  
                  <div className="h-px bg-zinc-200 my-3" />
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Inspection</label>
                      <Select value={form.watch('quality.inspection')} onValueChange={(val: any) => form.setValue('quality.inspection', val)} disabled={view === 'view'}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Yes">Yes</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Satisfied %</label>
                      <Input className="h-9 text-sm bg-white" {...form.register('quality.satisfiedPercent')} placeholder="0%" disabled={view === 'view'} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginTop: '8px' }}>
                    <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Rework required reason</label>
                    <Input className="h-9 text-sm bg-white" {...form.register('quality.reworkRequiredReason')} placeholder="Reason for rework if any..." disabled={view === 'view'} />
                  </div>

                  <div className="h-px bg-zinc-200 my-3" />
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="flex items-center justify-between px-3 py-2.5 bg-white rounded-lg border border-zinc-100">
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Rework performed today</label>
                      <Checkbox checked={form.watch('rework.isRework')} onCheckedChange={(c) => form.setValue('rework.isRework', !!c)} disabled={view === 'view'} />
                    </div>
                    
                    {form.watch('rework.isRework') && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', padding: '12px', background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Rework reason *</label>
                          <Input className="h-9 text-sm bg-white" {...form.register('rework.reason')} placeholder="What is being reworked..." disabled={view === 'view'} />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Start date</label>
                            <Input type="date" className="h-9 text-sm bg-white" {...form.register('rework.start')} disabled={view === 'view'} />
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>End date</label>
                            <Input type="date" className="h-9 text-sm bg-white" {...form.register('rework.end')} disabled={view === 'view'} />
                          </div>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Material used</label>
                          <Input className="h-9 text-sm bg-white" {...form.register('rework.materialUsed')} placeholder="Pipes, valves, etc..." disabled={view === 'view'} />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                          <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Total manpower</label>
                          <Input className="h-9 text-sm bg-white" {...form.register('rework.totalManpower')} placeholder="e.g. 2 fitters, 3 hours" disabled={view === 'view'} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>}
              </div>

              {/* 5. Logistics & Internal Reporting */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('logistics')} style={sectionHeaderStyle(openSections.logistics)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Logistics & Internal Reporting</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.logistics && 'rotate-90')} />
                </button>
                {openSections.logistics && <>
                <div style={subSectionStyle}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '16px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={fieldGroupLabelStyle}>Approval status</label>
                      <Select value={form.watch('reporting.pmStatus')} onValueChange={(v: any) => form.setValue('reporting.pmStatus', v)}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={fieldGroupLabelStyle}>Material arrangement</label>
                      <Select value={form.watch('reporting.materialArrangement')} onValueChange={(v: any) => form.setValue('reporting.materialArrangement', v)}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Arranged">Arranged</SelectItem>
                          <SelectItem value="Pending">Pending</SelectItem>
                          <SelectItem value="Not Required">Not Required</SelectItem>
                          <SelectItem value="Informed to stores">Informed to stores</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={fieldGroupLabelStyle}>Site photo status</label>
                      <Select value={form.watch('documentation.sitePictures')} onValueChange={(v: any) => form.setValue('documentation.sitePictures', v)}>
                        <SelectTrigger className="h-9 text-sm bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Taken">Taken</SelectItem>
                          <SelectItem value="Not Allowed">Not Allowed</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '10px', paddingLeft: '8px' }}>
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={form.watch('documentation.filed')} onCheckedChange={(c) => form.setValue('documentation.filed', !!c)} />
                        <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Hardcopy filed</label>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <Checkbox checked={form.watch('documentation.toolsLocked')} onCheckedChange={(c) => form.setValue('documentation.toolsLocked', !!c)} />
                        <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Tools secured</label>
                      </div>
                    </div>
                  </div>
                </div>
                {/* DC/Invoice Section */}
                <div style={subSectionStyle}>
                  <label style={{ ...fieldLabelStyle, marginBottom: '10px', display: 'block' }}>Documentation</label>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={form.watch('documents.dcInvoiceSupplied')} onCheckedChange={(c) => form.setValue('documents.dcInvoiceSupplied', !!c)} />
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>DC/Invoice supplied today</label>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Checkbox 
                        checked={form.watch('documents.submittedToOffice')} 
                        onCheckedChange={(c) => form.setValue('documents.submittedToOffice', !!c)}
                        disabled={!form.watch('documents.dcInvoiceSupplied')}
                      />
                      <label style={{ fontSize: '12px', fontWeight: 500, color: form.watch('documents.dcInvoiceSupplied') ? '#374151' : '#9ca3af' }}>Submitted to office</label>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <label style={fieldGroupLabelStyle}>DC no (optional)</label>
                      <Input className="h-9 text-sm bg-white" {...form.register('documents.docNo')} placeholder="Enter DC number..." />
                    </div>
                  </div>
                </div>
              </>}
              </div>

              {/* 6. Issues, Plan, Client Requirements */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('issuesPlanClient')} style={sectionHeaderStyle(openSections.issuesPlanClient)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Issues, Planning & Client Requirements</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.issuesPlanClient && 'rotate-90')} />
                </button>
                {openSections.issuesPlanClient && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                {/* Issues */}
                <div style={{ background: '#fef2f2', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c' }}>Issues Faced</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendIssue({ issue: '', solution: '' })}
                        style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', background: '#fff', border: '1px solid #fecaca', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus className="w-3 h-3" />
                        Log Issue
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {issueFields.map((field, index) => (
                      <div key={field.id} className="p-2.5 bg-white rounded-lg border border-red-100 relative group">
                        <div className="flex gap-1.5">
                          <Input className="h-8 text-sm bg-white flex-1" {...form.register(`issues.${index}.issue`)} placeholder="Issue..." />
                          {view !== 'view' && (
                            <ShadcnButton 
                              type="button" 
                              variant="ghost" 
                              size="sm" 
                              className="h-8 w-8 text-red-300 hover:text-red-600 flex-shrink-0" 
                              onClick={() => removeIssue(index)}
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </ShadcnButton>
                          )}
                        </div>
                        <Input className="h-8 text-sm bg-white mt-1.5" {...form.register(`issues.${index}.solution`)} placeholder="Action taken..." />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Next Day Plan */}
                <div style={subSectionStyle}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <label style={fieldLabelStyle}>Next Day Plan *</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendPlan({ value: '' })}
                        style={addOutlineBtnStyle}
                      >
                        <Plus className="w-3 h-3" />
                        Add Task
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {planFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center p-1.5 bg-white rounded-lg border border-zinc-100">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`workPlanNextDay.${index}.value`)} placeholder="Planned task..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="sm" className="h-9 w-9 text-zinc-400 hover:text-red-500 flex-shrink-0" onClick={() => removePlan(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Client Side Req */}
                <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600, color: '#b45309' }}>Client Requirements</label>
                    {view !== 'view' && (
                      <button 
                        type="button" 
                        onClick={() => appendClientReq({ value: '' })}
                        style={{ fontSize: '11px', fontWeight: 600, color: '#b45309', background: '#fff', border: '1px solid #fde68a', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus className="w-3 h-3" />
                        Add Req
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '8px' }}>
                    {clientReqFields.map((field, index) => (
                      <div key={field.id} className="flex gap-2 items-center p-1.5 bg-white rounded-lg border border-amber-100">
                        <Input className="h-9 text-sm bg-white flex-1" {...form.register(`clientRequirements.details.${index}.value`)} placeholder="Requirement..." />
                        {view !== 'view' && (
                          <ShadcnButton type="button" variant="ghost" size="sm" className="h-9 w-9 text-zinc-400 hover:text-red-500 flex-shrink-0" onClick={() => removeClientReq(index)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </ShadcnButton>
                        )}
                      </div>
                    ))}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={form.watch('clientRequirements.quoteToBe_sent')} onCheckedChange={(c) => form.setValue('clientRequirements.quoteToBe_sent', !!c)} />
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Quote to be sent</label>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Checkbox checked={form.watch('clientRequirements.mailReceived')} onCheckedChange={(c) => form.setValue('clientRequirements.mailReceived', !!c)} />
                      <label style={{ fontSize: '12px', fontWeight: 500, color: '#374151' }}>Mail received from client</label>
                    </div>
                  </div>
                </div>
              </div>}
              </div>

              {/* Section 6.5: Work Stoppages */}
              <div style={{ ...sectionCardStyle, borderLeft: '3px solid #fca5a5' }}>
                <button type="button" onClick={() => toggleSection('workStoppages')} style={sectionHeaderStyle(openSections.workStoppages)}>
                  <div style={accentHeaderStyle}>
                    <div style={{ ...accentLineStyle, background: '#ef4444' }} />
                    <span style={{ ...sectionTitleStyle, color: '#b91c1c' }}>Work Stoppages</span>
                    {stoppages.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#b91c1c', background: '#fecaca', padding: '2px 8px', borderRadius: '10px' }}>
                        {stoppages.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.workStoppages && 'rotate-90')} />
                </button>
                {openSections.workStoppages && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#7f1d1d', lineHeight: '1.5' }}>
                      Log work that was stopped today and when it is expected to restart. Resolution happens from Projects Overview.
                    </div>
                    {stoppages.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#9f1239', background: '#fff', border: '1px dashed #fecaca', borderRadius: '8px' }}>
                        No work stoppages logged for this report.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {stoppages.map((s, index) => {
                          const tone = toneClassForCategory(s.category);
                          const isResolved = (existingStoppages[index]?.is_resolved) || false;
                          return (
                            <div key={`stoppage-${index}`} className="p-4 bg-white rounded-lg border border-red-100 relative group">
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span className={cn('w-2.5 h-2.5 rounded-full', tone.dot)} />
                                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#7f1d1d' }}>
                                    Stoppage #{index + 1}
                                  </span>
                                  {isResolved && view === 'view' && (
                                    <span style={{ fontSize: '10px', fontWeight: 600, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '8px' }}>
                                      Resolved
                                    </span>
                                  )}
                                </div>
                                {view !== 'view' && (
                                  <ShadcnButton
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 w-7 text-red-300 hover:text-red-600"
                                    onClick={() => removeStoppageRow(index)}
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </ShadcnButton>
                                )}
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                                <div>
                                  <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Category</label>
                                  <Select
                                    value={s.category}
                                    onValueChange={(v) => updateStoppageRow(index, { category: v as StoppageCategory })}
                                    disabled={view === 'view'}
                                  >
                                    <SelectTrigger className="h-9 text-sm bg-white mt-1">
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
                                  <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Blocked by</label>
                                  <Select
                                    value={s.blocking_party}
                                    onValueChange={(v) => updateStoppageRow(index, { blocking_party: v as BlockingParty })}
                                    disabled={view === 'view'}
                                  >
                                    <SelectTrigger className="h-9 text-sm bg-white mt-1">
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
                              <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Affected work</label>
                                <Input
                                  className="h-9 text-sm bg-white mt-1"
                                  value={s.affected_work}
                                  onChange={(e) => updateStoppageRow(index, { affected_work: e.target.value })}
                                  placeholder="e.g. AHU-1 piping on 3rd floor east wing"
                                  readOnly={view === 'view'}
                                />
                              </div>
                              <div style={{ marginBottom: '10px' }}>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Reason / context</label>
                                <Textarea
                                  className="text-sm bg-white mt-1 min-h-[50px]"
                                  value={s.reason_detail}
                                  onChange={(e) => updateStoppageRow(index, { reason_detail: e.target.value })}
                                  placeholder="What happened, who needs to act"
                                  readOnly={view === 'view'}
                                />
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>
                                  Expected restart date <span style={{ fontWeight: 400, color: '#9ca3af' }}>(leave blank if unknown)</span>
                                </label>
                                <Input
                                  type="date"
                                  className="h-9 text-sm bg-white mt-1"
                                  value={s.expected_resolution_date}
                                  onChange={(e) => updateStoppageRow(index, { expected_resolution_date: e.target.value })}
                                  readOnly={view === 'view'}
                                />
                              </div>
                              <div style={{ marginTop: '8px' }}>
                                <TaskLinkSelector
                                  label="Affected Task (optional)"
                                  organisationId={organisation?.id ?? ''}
                                  projectId={form.watch('projectName') || null}
                                  value={stoppageTaskIds[index] ?? null}
                                  onChange={(val) => setStoppageTaskIds((prev) => ({ ...prev, [index]: val as string | null }))}
                                  mode="single"
                                  placeholder="Link to a specific task..."
                                  disabled={view === 'view'}
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
                        style={{ fontSize: '11px', fontWeight: 600, color: '#b91c1c', background: '#fff', border: '1px solid #fca5a5', borderRadius: '6px', padding: '7px 14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <Plus className="w-3 h-3" />
                        Log Stoppage
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section 6.8: Continuous Improvement Observations */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('continuousImprovement')} style={sectionHeaderStyle(openSections.continuousImprovement)}>
                  <div style={accentHeaderStyle}>
                    <div style={{ ...accentLineStyle, background: '#10b981' }} />
                    <span style={sectionTitleStyle}>Continuous Improvement Observations</span>
                    {observations.length > 0 && (
                      <span style={{ fontSize: '10px', fontWeight: 700, color: '#047857', background: '#d1fae5', padding: '2px 8px', borderRadius: '10px' }}>
                        {observations.length}
                      </span>
                    )}
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.continuousImprovement && 'rotate-90')} />
                </button>
                {openSections.continuousImprovement && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#475569', lineHeight: '1.5' }}>
                      Log any coordination issues, best practices, safety observations, or improvement opportunities noticed on site today.
                    </div>
                    {observations.length === 0 ? (
                      <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b', background: '#fff', border: '1px dashed #cbd5e1', borderRadius: '8px' }}>
                        No observations recorded.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {observations.map((obs, idx) => (
                          <div key={`obs-${idx}`} className="p-4 bg-white rounded-lg border border-zinc-200 relative group flex flex-col gap-3">
                            <div className="flex justify-between items-center">
                              <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>Observation #{idx + 1}</span>
                              {view !== 'view' && (
                                <ShadcnButton
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  className="h-7 w-7 text-zinc-400 hover:text-red-600"
                                  onClick={() => setObservations(prev => prev.filter((_, i) => i !== idx))}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </ShadcnButton>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Category *</label>
                                <Select
                                  value={obs.category}
                                  onValueChange={(v) => setObservations(prev => prev.map((o, i) => i === idx ? { ...o, category: v } : o))}
                                  disabled={view === 'view'}
                                >
                                  <SelectTrigger className="h-9 text-sm bg-white mt-1">
                                    <SelectValue placeholder="Select category" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="Improvement Opportunity">Improvement Opportunity</SelectItem>
                                    <SelectItem value="Best Practice">Best Practice</SelectItem>
                                    <SelectItem value="Client Feedback">Client Feedback</SelectItem>
                                    <SelectItem value="Coordination Issue">Coordination Issue</SelectItem>
                                    <SelectItem value="Safety Observation">Safety Observation</SelectItem>
                                    <SelectItem value="Cost Saving Idea">Cost Saving Idea</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div>
                                <label style={{ fontSize: '11px', fontWeight: 500, color: '#475569' }}>Title *</label>
                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', marginTop: '4px' }}>
                                  <Input
                                    className="h-9 text-sm bg-white mt-0 flex-1"
                                    value={obs.title}
                                    onChange={(e) => {
                                      const val = e.target.value;
                                      setObservations(prev => prev.map((o, i) => i === idx ? { ...o, title: val } : o));
                                    }}
                                    disabled={view === 'view'}
                                    placeholder="Brief description of what happened..."
                                  />
                                  {view !== 'view' && (
                                    <button
                                      type="button"
                                      onClick={() => startListeningForObservation(idx)}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '6px',
                                        borderRadius: '6px',
                                        border: '1px solid #e2e8f0',
                                        background: activeListeningIdx === idx ? '#fee2e2' : '#ffffff',
                                        color: activeListeningIdx === idx ? '#ef4444' : '#475569',
                                        cursor: 'pointer',
                                        width: '36px',
                                        height: '36px',
                                      }}
                                      title={activeListeningIdx === idx ? 'Listening...' : 'Dictate Title'}
                                    >
                                      <Mic size={15} style={{ animation: activeListeningIdx === idx ? 'pulse 1s infinite' : 'none' }} />
                                    </button>
                                  )}
                                </div>
                                {view !== 'view' && (
                                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                                    {[
                                      'Material dimension mismatch',
                                      'Vendor supply delay',
                                      'Drawing revision mismatch',
                                      'Power / utility shut-off',
                                      'Pressure test passed',
                                      'Safety hazard detected'
                                    ].map(template => (
                                      <button
                                        key={template}
                                        type="button"
                                        onClick={() => setObservations(prev => prev.map((o, i) => i === idx ? { ...o, title: template } : o))}
                                        style={{
                                          fontSize: '10px',
                                          padding: '3px 8px',
                                          borderRadius: '12px',
                                          border: '1px solid #e2e8f0',
                                          background: '#fff',
                                          color: '#64748b',
                                          cursor: 'pointer',
                                        }}
                                      >
                                        {template}
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    {view !== 'view' && (
                      <button
                        type="button"
                        onClick={() => setObservations(prev => [...prev, { category: 'Improvement Opportunity', title: '' }])}
                        style={addOutlineBtnStyle}
                      >
                        <Plus className="w-3 h-3" />
                        Add Observation
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Section 7: Photos */}
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('photos')} style={sectionHeaderStyle(openSections.photos)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Visual Documentation</span>
                  </div>
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
              <div style={sectionCardStyle}>
                <button type="button" onClick={() => toggleSection('footer')} style={sectionHeaderStyle(openSections.footer)}>
                  <div style={accentHeaderStyle}>
                    <div style={accentLineStyle} />
                    <span style={sectionTitleStyle}>Engineer Signature & Date</span>
                  </div>
                  <ChevronRight className={cn('w-4 h-4 text-zinc-400 transition-transform duration-200', openSections.footer && 'rotate-90')} />
                </button>
                {openSections.footer && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={fieldLabelStyle}>Engineer/Supervisor Name *</label>
                    <Input className="h-10 bg-white text-sm" {...form.register('footer.engineer')} placeholder="Enter your name" />
                    {errors.footer?.engineer && <p className="text-[11px] text-red-500 font-medium">{errors.footer.engineer.message}</p>}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <label style={fieldLabelStyle}>Signature Date *</label>
                    <Input type="date" className="h-10 bg-white text-sm" {...form.register('footer.signatureDate')} />
                    {errors.footer?.signatureDate && <p className="text-[11px] text-red-500 font-medium">{errors.footer.signatureDate.message}</p>}
                  </div>
                </div>}
              </div>

              {/* Section 9: Approval — visible only in create mode */}
              {view === 'create' && (
                <div style={{ ...sectionCardStyle, borderLeft: '3px solid #93c5fd' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: submitForApproval ? '16px' : 0 }}>
                    <div>
                      <div style={sectionTitleStyle}>Approval</div>
                      <div style={{ fontSize: '12px', color: '#475569', marginTop: '4px' }}>
                        {submitForApproval
                          ? 'Pick an approver — they will review and approve / reject this report'
                          : 'Save as a draft now, or submit for approval'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-medium text-zinc-600">Submit for approval</span>
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
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={fieldLabelStyle}>Approver (MD / PM / Manager) *</label>
                      <Select
                        value={selectedApproverId}
                        onValueChange={setSelectedApproverId}
                      >
                        <SelectTrigger className="h-10 bg-white text-sm">
                          <SelectValue placeholder={approvableMembers.length === 0 ? "No approvers available in this org" : "Select approver"} />
                        </SelectTrigger>
                        <SelectContent>
                          {approvableMembers.map((m) => (
                            <SelectItem key={m.user_id} value={m.user_id}>
                              {m.full_name || m.email} <span className="text-zinc-400 text-[11px]">· {m.role}</span>
                            </SelectItem>
                          ))}
                          {approvableMembers.length === 0 && (
                            <SelectItem value="_empty">No MD / PM / Manager found in this organisation</SelectItem>
                          )}
                        </SelectContent>
                      </Select>
                      {selectedApproverId && (
                        <p className="text-[11px] text-blue-700 font-medium">
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
              marginTop: '28px',
              paddingTop: '20px',
              borderTop: '1px solid #e2e8f0',
            }}>
              <button
                type="button"
                onClick={() => setView('list')}
                style={{
                  flex: 1,
                  padding: '12px 20px',
                  border: '1px solid #d1d5db',
                  borderRadius: '8px',
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
                      padding: '12px 20px',
                      border: '1px solid #d1d5db',
                      borderRadius: '8px',
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
                      padding: '12px 20px',
                      border: 'none',
                      borderRadius: '8px',
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

function renderDueDateChip(dueDate: string, status: string) {
  const parts = dueDate.split('-');
  const due = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const diffTime = due.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  let bg = '#f8fafc';
  let text = '#475569';
  let border = '#e2e8f0';
  let label = due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
  
  if (status === 'completed' || status === 'cancelled') {
    bg = '#f1f5f9';
    text = '#64748b';
  } else if (diffDays < 0) {
    bg = '#fef2f2';
    text = '#ef4444';
    border = '#fee2e2';
    label = 'Overdue';
  } else if (diffDays <= 3) {
    bg = '#fffbeb';
    text = '#d97706';
    border = '#fef3c7';
    label = diffDays === 0 ? 'Today' : `Due in ${diffDays}d`;
  }
  
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 5px',
        borderRadius: '3px',
        fontSize: '10px',
        fontWeight: 500,
        background: bg,
        color: text,
        border: `1px solid ${border}`,
        marginLeft: '4px',
      }}
    >
      {label}
    </span>
  );
}
