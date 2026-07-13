import { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../supabase';
import { formatCurrency } from '../utils/formatters';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronRight, ArrowLeft, Edit, Trash2, Folder,
  TrendingUp, Clock, DollarSign, MoreHorizontal, X,
  ChevronDown, ChevronUp, Link2, AlertTriangle, FilePlus2, FileText,
  Download, Calendar
} from 'lucide-react';
import ProjectTaskListView from '../components/tasks/ProjectTaskListView';
import CreateProjectInvoiceModal from '../components/CreateProjectInvoiceModal';
import { 
  useProjectMilestones, 
  useCreateMilestone, 
  useUpdateMilestone, 
  useDeleteMilestone, 
  ProjectMilestone 
} from '../hooks/useMilestones';
import {
  useProjectTransactions,
  buildProjectTransactionSummary,
  type ProjectInvoice,
} from '../hooks/useProjectTransactions';
import { useAuth } from '../App';
import { SiteExpenses } from './SiteExpenses';

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
  contractor_scope?: string;
  client_scope?: string;
  excluded_scope?: string;
  pending_approval?: string;
  site_instructions?: string;
  created_by?: string;
  updated_by?: string;
  created_by_user?: { full_name?: string } | null;
  updated_by_user?: { full_name?: string } | null;
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

import { TabErrorBoundary } from '../components/projects/TabErrorBoundary';

// ─── ProjectList ──────────────────────────────────────────────────────────────

export default function ProjectList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, organisation, organisations } = useAuth();
  
  const userRole = useMemo(() => {
    const currentMember = organisations?.find(o => o.organisation_id === organisation?.id || o.organisation?.id === organisation?.id);
    return currentMember?.role || '';
  }, [organisations, organisation]);

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
  const [activeTransactionTab, setActiveTransactionTab] = useState<'po-utilization' | 'pos' | 'invoices' | 'payments' | 'reconciliation'>('po-utilization');
  const [expandedPoId, setExpandedPoId] = useState<string | null>(null);
  const [invoiceModal, setInvoiceModal] = useState<
    | { open: false }
    | { open: true; mode: 'create' | 'edit'; invoice?: ProjectInvoice | null; defaultPoId?: string | null }
  >({ open: false });
  const itemsPerPage = 20;

  // Equipment, Snag, and Claim modal states
  const [isEqModalOpen, setIsEqModalOpen] = useState(false);
  const [eqFormData, setEqFormData] = useState({
    equipment_name: '',
    make_model: '',
    serial_number: '',
    supplier: '',
    quantity: 1,
    warranty_start_date: '',
    warranty_duration_months: 12
  });

  const [isSnagModalOpen, setIsSnagModalOpen] = useState(false);
  
  // Continuous Improvement State
  const [isInsightModalOpen, setIsInsightModalOpen] = useState(false);
  const [selectedInsight, setSelectedInsight] = useState<any | null>(null);
  const [insightFilter, setInsightFilter] = useState('All');
  
  // Enrichment form states
  const [enrichDescription, setEnrichDescription] = useState('');
  const [enrichRootCause, setEnrichRootCause] = useState('');
  const [enrichImpactType, setEnrichImpactType] = useState('');
  const [enrichImpactLevel, setEnrichImpactLevel] = useState('Low');
  const [enrichLossAmount, setEnrichLossAmount] = useState(0);
  const [enrichDelayDays, setEnrichDelayDays] = useState(0);
  const [enrichTagsText, setEnrichTagsText] = useState('');
  const [enrichVisibility, setEnrichVisibility] = useState('Everyone');
  const [enrichIsRepeat, setEnrichIsRepeat] = useState(false);
  const [enrichRepeatCount, setEnrichRepeatCount] = useState(1);
  const [enrichAssignedTo, setEnrichAssignedTo] = useState('');
  const [enrichTargetDate, setEnrichTargetDate] = useState('');
  const [enrichStatus, setEnrichStatus] = useState('Open');

  // Milestone state variables
  const [isMilestonePopoverOpen, setIsMilestonePopoverOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<any | null>(null);
  const [selectedMilestoneForDetails, setSelectedMilestoneForDetails] = useState<any | null>(null);
  const [milestoneForm, setMilestoneForm] = useState({
    name: '',
    milestone_date: '',
    type: 'inspection' as 'equipment_testing' | 'inspection' | 'handover' | 'other',
    notes: ''
  });
  const [milestoneToDelete, setMilestoneToDelete] = useState<any | null>(null);

  const openEnrichmentModal = (insight: any) => {
    setSelectedInsight(insight);
    setEnrichDescription(insight.description || '');
    setEnrichRootCause(insight.root_cause || '');
    setEnrichImpactType(insight.impact_type || '');
    setEnrichImpactLevel(insight.impact_level || 'Low');
    setEnrichLossAmount(insight.estimated_loss_amount || 0);
    setEnrichDelayDays(insight.estimated_delay_days || 0);
    setEnrichTagsText((insight.tags || []).join(', '));
    setEnrichVisibility(insight.visibility || 'Everyone');
    setEnrichIsRepeat(!!insight.is_repeat_issue);
    setEnrichRepeatCount(insight.repeat_issue_count || 1);
    setEnrichAssignedTo(insight.assigned_to || '');
    setEnrichTargetDate(insight.target_date || '');
    setEnrichStatus(insight.status || 'Open');
    setIsInsightModalOpen(true);
  };

  const handleUpdateInsightStatus = async (insightId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('project_insights')
        .update({ status: newStatus })
        .eq('id', insightId);
      if (error) throw error;
      refetchInsights();
    } catch (err: any) {
      alert('Error updating status: ' + err.message);
    }
  };

  const handleEnrichSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedInsight) return;
    try {
      const tagsArray = enrichTagsText.split(',')
        .map(t => t.trim().toLowerCase())
        .filter(t => t.length > 0);

      const { error } = await supabase
        .from('project_insights')
        .update({
          description: enrichDescription || null,
          root_cause: enrichRootCause || null,
          impact_type: enrichImpactType || null,
          impact_level: enrichImpactLevel || 'Low',
          estimated_loss_amount: parseFloat(enrichLossAmount as any) || 0,
          estimated_delay_days: parseInt(enrichDelayDays as any) || 0,
          tags: tagsArray.length > 0 ? tagsArray : null,
          visibility: enrichVisibility || 'Everyone',
          is_repeat_issue: enrichIsRepeat,
          repeat_issue_count: parseInt(enrichRepeatCount as any) || 1,
          assigned_to: enrichAssignedTo || null,
          target_date: enrichTargetDate || null,
          status: enrichStatus
        })
        .eq('id', selectedInsight.id);

      if (error) throw error;
      setIsInsightModalOpen(false);
      refetchInsights();
    } catch (err: any) {
      alert('Error updating insight: ' + err.message);
    }
  };
  const [snagFormData, setSnagFormData] = useState({
    description: '',
    location_area: '',
    severity: 'Medium',
    status: 'Open',
    covered_under_warranty: false,
    equipment_id: '',
    drawing_id: '',
    pin_x: null as number | null,
    pin_y: null as number | null
  });

  const [activeDrawingId, setActiveDrawingId] = useState<string>('');
  const [highlightedSnagId, setHighlightedSnagId] = useState<string | null>(null);
  const [newDrawingName, setNewDrawingName] = useState('');
  const [newDrawingUrl, setNewDrawingUrl] = useState('');
  const [isAddingDrawing, setIsAddingDrawing] = useState(false);

  const [selectedTcCert, setSelectedTcCert] = useState<any | null>(null);
  const [notifyingClaim, setNotifyingClaim] = useState<any | null>(null);
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySlaDays, setNotifySlaDays] = useState(7);

  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimFormData, setClaimFormData] = useState({
    id: '', // for edit if needed
    snag_id: '',
    equipment_id: '',
    vendor_name: '',
    claim_reference_number: '',
    status: 'Draft',
    vendor_dispute_reason: '',
    parts_covered: true,
    labor_covered: false,
    vendor_claimed_cost: '',
    vendor_approved_cost: '',
    internal_cost_incurred: '',
    resolution_method: 'N/A',
    resolution_date: ''
  });

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
        .select('*, client:clients(id, client_name), pos:client_purchase_orders(po_total_value), created_by_user:user_profiles!created_by(full_name), updated_by_user:user_profiles!updated_by(full_name)')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false })
        .limit(500);
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

  const { data: milestones = [] } = useProjectMilestones(selectedProject?.id || null);
  const createMilestoneMutation = useCreateMilestone();
  const updateMilestoneMutation = useUpdateMilestone();
  const deleteMilestoneMutation = useDeleteMilestone();

  const { data: atRiskMilestoneCounts = {} } = useQuery<Record<string, number>>({
    queryKey: ['at-risk-milestones-count', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return {};
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysLater = new Date(new Date().getTime() + 7 * 24 * 3600 * 1000).toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('project_milestones')
        .select('project_id')
        .eq('organisation_id', organisation.id)
        .eq('is_completed', false)
        .or(`milestone_date.lt.${today},and(milestone_date.gte.${today},milestone_date.lte.${sevenDaysLater})`);
      
      if (error) throw error;
      
      const counts: Record<string, number> = {};
      (data || []).forEach((m: any) => {
        counts[m.project_id] = (counts[m.project_id] || 0) + 1;
      });
      return counts;
    },
    enabled: !!organisation?.id,
  });

  const { data: projectEquipment = [], refetch: refetchEquipment } = useQuery({
    queryKey: ['project-equipment', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('project_equipment')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: projectSnags = [], refetch: refetchSnags } = useQuery({
    queryKey: ['project-snags', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('project_snags')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: warrantyClaims = [], refetch: refetchClaims } = useQuery({
    queryKey: ['warranty-claims', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('warranty_claims')
        .select('*, equipment:project_equipment(*), snag:project_snags(*)')
        .eq('organisation_id', organisation?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((c: any) => c.equipment?.project_id === selectedProject.id);
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: projectInsights = [], refetch: refetchInsights, isLoading: insightsLoading } = useQuery({
    queryKey: ['project-insights', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('project_insights')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['org-members', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('user_profiles')
        .select('user_id, full_name')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id && viewMode === 'detail',
  });

  const { data: projectDrawings = [], refetch: refetchDrawings } = useQuery({
    queryKey: ['project-drawings', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('project_drawings')
        .select('*')
        .eq('project_id', selectedProject.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: projectMaterials = [] } = useQuery({
    queryKey: ['project-materials', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('project_material_list')
        .select('*, materials(name, unit), company_variants(variant_name)')
        .eq('project_id', selectedProject.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: projectJointMeasurements = [] } = useQuery({
    queryKey: ['project-joint-measurements', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('joint_measurements')
        .select('*')
        .eq('project_id', selectedProject.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });

  const { data: projectTcProtocols = [] } = useQuery({
    queryKey: ['project-tc-protocols', selectedProject?.id],
    queryFn: async () => {
      if (!selectedProject?.id) return [];
      const { data, error } = await supabase
        .from('tc_protocols')
        .select('*, site_visit:site_visits(signed_off_by, signed_off_designation, signature_image_url, visit_date)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedProject?.id && viewMode === 'detail',
  });


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

  const equipmentStats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysFromNow = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);

    let active = 0;
    let expired = 0;
    let expiring30 = 0;
    let expiring90 = 0;

    projectEquipment.forEach((eq: any) => {
      if (!eq.warranty_end_date) return;
      const endDate = new Date(eq.warranty_end_date);
      endDate.setHours(0, 0, 0, 0);
      if (endDate < today) {
        expired++;
      } else {
        active++;
        if (endDate <= thirtyDaysFromNow) {
          expiring30++;
        } else if (endDate <= ninetyDaysFromNow) {
          expiring90++;
        }
      }
    });

    return { active, expired, expiring30, expiring90 };
  }, [projectEquipment]);


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

  const loadProjectDetails = (project: Project, scrollToMilestones = false) => {
    setSelectedProject(project);
    setViewMode('detail');
    setCurrentPage(1);
    if (scrollToMilestones) {
      setTimeout(() => {
        const el = document.getElementById('project-milestones-section');
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
        }
      }, 300);
    }
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

  const downloadCompletionCertificate = async (project: Project) => {
    try {
      const orgId = project.organisation_id || organisation?.id;
      if (!orgId) {
        alert('Organisation ID not found');
        return;
      }

      // Fetch org details
      const { data: orgDetails, error: orgError } = await supabase
        .from('organisations')
        .select('name, address, phone, email, gstin, website')
        .eq('id', orgId)
        .single();

      if (orgError) {
        console.warn('Error fetching organisation details:', orgError);
      }

      const companyName = orgDetails?.name || organisation?.name || 'Organisation';
      const companyAddress = orgDetails?.address || '';
      const companyPhone = orgDetails?.phone || '';
      const companyEmail = orgDetails?.email || '';
      const companyGSTIN = orgDetails?.gstin || '';
      const companyWebsite = orgDetails?.website || '';

      const { default: jsPDF } = await import('jspdf');
      const doc = new jsPDF({ unit: 'pt', format: 'a4' });

      // Border and Background styling
      doc.setDrawColor(203, 213, 225); // Slate 300
      doc.setFillColor(255, 255, 255);
      doc.rect(28, 28, 539, 785.89, 'S');

      // Top Header Border Line (accent colors)
      doc.setDrawColor(59, 130, 246); // Blue 500
      doc.setLineWidth(3);
      doc.line(28, 28, 567, 28);
      doc.setLineWidth(1);

      // Company Info
      doc.setTextColor(30, 41, 59); // Slate 800
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(22);
      doc.text(companyName, 44, 70);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      let headerY = 86;
      if (companyAddress) {
        doc.text(companyAddress, 44, headerY, { maxWidth: 350 });
        const addressLines = doc.splitTextToSize(companyAddress, 350);
        headerY += addressLines.length * 11 + 3;
      }
      
      const contactInfo = [
        companyPhone ? `Phone: ${companyPhone}` : '',
        companyEmail ? `Email: ${companyEmail}` : '',
        companyGSTIN ? `GSTIN: ${companyGSTIN}` : '',
        companyWebsite ? `Website: ${companyWebsite}` : ''
      ].filter(Boolean).join('  |  ');
      
      if (contactInfo) {
        doc.text(contactInfo, 44, headerY);
        headerY += 15;
      }

      // Decorative divider
      doc.setDrawColor(226, 232, 240); // Slate 200
      doc.line(44, headerY + 5, 551, headerY + 5);

      // Title
      const titleY = headerY + 45;
      doc.setTextColor(15, 23, 42); // Slate 900
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.text('PROJECT COMPLETION CERTIFICATE', 297.64, titleY, { align: 'center' });

      // Certificate Metadata
      const metaY = titleY + 30;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      
      const certNo = `Cert Ref: CC-${project.project_code || project.id.slice(0, 8).toUpperCase()}`;
      const dateStr = `Date: ${new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
      
      doc.text(certNo, 44, metaY);
      doc.text(dateStr, 551, metaY, { align: 'right' });

      // Main letter body
      const bodyY = metaY + 40;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(11);
      doc.setTextColor(51, 65, 85); // Slate 700
      
      const certText = `This is to certify that the project detailed below has been successfully completed in accordance with the contract specifications, agreed deliverables, and quality guidelines. We hereby confirm that all milestones have been executed, inspected, and handed over to the client.`;
      
      const textLines = doc.splitTextToSize(certText, 507);
      doc.text(textLines, 44, bodyY, { leading: 16 });

      // Project Details Card
      const cardY = bodyY + (textLines.length * 16) + 20;
      doc.setFillColor(248, 250, 252); // Slate 50
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(44, cardY, 507, 185, 6, 6, 'FD');

      // Table/Grid of Project Details inside the card
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.text('Project Details', 56, cardY + 22);

      doc.setDrawColor(226, 232, 240);
      doc.line(56, cardY + 30, 539, cardY + 30);

      // Label/Value details
      doc.setFontSize(9.5);
      const rowHeight = 22;
      let curRowY = cardY + 46;

      const formatDisplayVal = (val: any) => val ? String(val) : '-';

      const detailsData = [
        { label: 'Project Name', val: project.project_name },
        { label: 'Project Code', val: project.project_code },
        { label: 'Client / Customer', val: project.client?.client_name },
        { label: 'Project Type', val: project.project_type },
        { label: 'Commencement Date', val: project.start_date ? new Date(project.start_date).toLocaleDateString('en-GB') : '-' },
        { label: 'Completion Date', val: project.actual_end_date ? new Date(project.actual_end_date).toLocaleDateString('en-GB') : (project.expected_end_date ? new Date(project.expected_end_date).toLocaleDateString('en-GB') : '-') }
      ];

      detailsData.forEach((item) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(100, 116, 139);
        doc.text(item.label, 56, curRowY);
        
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(15, 23, 42);
        doc.text(formatDisplayVal(item.val), 180, curRowY, { maxWidth: 350 });
        
        curRowY += rowHeight;
      });

      // Signature area
      const sigY = cardY + 230;
      doc.setDrawColor(226, 232, 240);
      doc.line(380, sigY + 50, 539, sigY + 50);
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text('Authorized Signatory', 380, sigY + 66);
      
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(companyName, 380, sigY + 80, { maxWidth: 170 });

      // Save PDF
      doc.save(`Completion_Certificate_${project.project_code || 'Project'}.pdf`);
    } catch (error) {
      console.error('Error downloading completion certificate:', error);
      alert('Failed to generate completion certificate. Please try again.');
    }
  };

  const handleEqSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedProject?.id || !organisation?.id) return;
      
      const { error } = await supabase
        .from('project_equipment')
        .insert([{
          project_id: selectedProject.id,
          organisation_id: organisation.id,
          equipment_name: eqFormData.equipment_name,
          make_model: eqFormData.make_model || null,
          serial_number: eqFormData.serial_number || null,
          supplier: eqFormData.supplier || null,
          quantity: Number(eqFormData.quantity) || 1,
          warranty_start_date: eqFormData.warranty_start_date,
          warranty_duration_months: Number(eqFormData.warranty_duration_months) || 12,
        }]);

      if (error) throw error;
      
      setIsEqModalOpen(false);
      setEqFormData({
        equipment_name: '',
        make_model: '',
        serial_number: '',
        supplier: '',
        quantity: 1,
        warranty_start_date: '',
        warranty_duration_months: 12
      });
      refetchEquipment();
      alert('Equipment added successfully');
    } catch (err: any) {
      alert('Error adding equipment: ' + err.message);
    }
  };

  const handleSnagSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!selectedProject?.id || !organisation?.id) return;

      const { error } = await supabase
        .from('project_snags')
        .insert([{
          project_id: selectedProject.id,
          organisation_id: organisation.id,
          description: snagFormData.description,
          location_area: snagFormData.location_area || null,
          severity: snagFormData.severity,
          status: snagFormData.status,
          covered_under_warranty: snagFormData.covered_under_warranty,
          equipment_id: snagFormData.covered_under_warranty && snagFormData.equipment_id ? snagFormData.equipment_id : null,
          drawing_id: snagFormData.drawing_id || null,
          pin_x: snagFormData.pin_x,
          pin_y: snagFormData.pin_y
        }]);

      if (error) throw error;

      setIsSnagModalOpen(false);
      setSnagFormData({
        description: '',
        location_area: '',
        severity: 'Medium',
        status: 'Open',
        covered_under_warranty: false,
        equipment_id: '',
        drawing_id: '',
        pin_x: null,
        pin_y: null
      });
      refetchSnags();
      alert('Defect snag registered successfully');
    } catch (err: any) {
      alert('Error adding snag: ' + err.message);
    }
  };

  const handleClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (!organisation?.id) return;

      const claimData: any = {
        organisation_id: organisation.id,
        snag_id: claimFormData.snag_id,
        equipment_id: claimFormData.equipment_id,
        vendor_name: claimFormData.vendor_name,
        claim_reference_number: claimFormData.claim_reference_number || null,
        status: claimFormData.status,
        vendor_dispute_reason: claimFormData.vendor_dispute_reason || null,
        parts_covered: claimFormData.parts_covered,
        labor_covered: claimFormData.labor_covered,
        resolution_method: claimFormData.resolution_method,
        resolution_date: claimFormData.resolution_date || null
      };

      // Gated cost inputs (PM/Admin only)
      const isPrivileged = ['Project Manager', 'Admin'].includes(userRole);
      if (isPrivileged) {
        claimData.vendor_claimed_cost = claimFormData.vendor_claimed_cost ? Number(claimFormData.vendor_claimed_cost) : null;
        claimData.vendor_approved_cost = claimFormData.vendor_approved_cost ? Number(claimFormData.vendor_approved_cost) : null;
        claimData.internal_cost_incurred = claimFormData.internal_cost_incurred ? Number(claimFormData.internal_cost_incurred) : null;
      }

      // Date Snapshotting logic: on transitioning from Draft -> Sent / Pending Response, capture current equipment warranty dates
      if (claimFormData.status === 'Pending Response') {
        const matchingEquipment = projectEquipment.find((e: any) => e.id === claimFormData.equipment_id);
        if (matchingEquipment) {
          claimData.date_escalated = new Date().toISOString().split('T')[0];
          claimData.escalated_warranty_start = matchingEquipment.warranty_start_date;
          claimData.escalated_warranty_end = matchingEquipment.warranty_end_date;
        }
      }

      let error;
      if (claimFormData.id) {
        // Edit Claim
        const { error: editErr } = await supabase
          .from('warranty_claims')
          .update(claimData)
          .eq('id', claimFormData.id);
        error = editErr;
      } else {
        // Create Claim
        const { error: createErr } = await supabase
          .from('warranty_claims')
          .insert([claimData]);
        error = createErr;
      }

      if (error) throw error;

      setIsClaimModalOpen(false);
      refetchClaims();
      alert('Warranty claim saved successfully');
    } catch (err: any) {
      alert('Error saving warranty claim: ' + err.message);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════════
  // DETAIL VIEW (preserved as-is)
  // ═══════════════════════════════════════════════════════════════════════════════
  if (viewMode === 'detail' && selectedProject) {
    const tabs = [
      { id: 'summary', label: 'Summary' },
      { id: 'transactions', label: 'Transactions' },
      { id: 'tasks', label: 'Tasks' },
      { id: 'expenses', label: 'Expenses' },
      { id: 'site-expenses', label: 'Site Expenses' },
      { id: 'subcontractors', label: 'Subcontractor W/O' },
      { id: 'equipment', label: 'Equipment & Warranty' },
      { id: 'snags', label: 'Snags / Defects' },
      { id: 'continuous-improvement', label: 'Continuous Improvement' },
    ];

    const transactionSubTabs: Array<{ id: 'po-utilization' | 'pos' | 'invoices' | 'payments' | 'reconciliation'; label: string; count: number }> = [
      { id: 'po-utilization', label: 'PO Utilization', count: projectPOs.length },
      { id: 'pos', label: 'POs', count: projectPOs.length },
      { id: 'invoices', label: 'Invoices', count: projectInvoices.length },
      { id: 'payments', label: 'Payments', count: projectPayments.length },
      { id: 'reconciliation', label: 'Material Reconciliation', count: projectMaterials.length },
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

          <TabErrorBoundary tabName="Project Details">
          {activeTab === 'summary' && (
            <>
              <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.25rem', flexWrap: 'wrap' }}>
                {/* Download Certificate Button */}
                {Number(selectedProject.completion_percentage) === 100 &&
                  ['Execution Completed', 'Closed', 'Financially Closed'].includes(selectedProject.status || '') && (
                    <button
                      className="pl-btn"
                      style={{
                        background: '#10b981',
                        color: '#ffffff',
                        border: 'none',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.375rem',
                        padding: '0.5rem 1rem',
                        borderRadius: '0.375rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                      }}
                      onClick={() => downloadCompletionCertificate(selectedProject)}
                    >
                      <Download size={14} />
                      Download Completion Certificate
                    </button>
                )}

                {/* Schedule AMC Visit Button */}
                <button
                  className="pl-btn"
                  disabled={!selectedProject.client_id}
                  title={!selectedProject.client_id ? "This project has no client linked" : "Schedule AMC / Maintenance visit"}
                  style={{
                    background: selectedProject.client_id ? 'var(--pl-primary, #3b82f6)' : '#e2e8f0',
                    color: selectedProject.client_id ? '#ffffff' : '#94a3b8',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.375rem',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: selectedProject.client_id ? 'pointer' : 'not-allowed',
                    boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)'
                  }}
                  onClick={() => {
                    if (selectedProject.client_id) {
                      navigate(`/site-visits?scheduleNew=true&projectId=${selectedProject.id}&clientId=${selectedProject.client_id}`);
                    }
                  }}
                >
                  <Calendar size={14} />
                  Schedule AMC / Maintenance Visit
                </button>
              </div>

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

              <div className="pl-card" style={{ padding: '1.25rem 1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <h3 className="pl-summary-title">Project Scope & Site Instructions</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Contractor Scope</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
                      {selectedProject.contractor_scope || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Client Scope</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
                      {selectedProject.client_scope || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Excluded Scope</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
                      {selectedProject.excluded_scope || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Scope Awaiting Approval</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
                      {selectedProject.pending_approval || 'N/A'}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', padding: '0.75rem', borderRadius: '0.375rem', background: 'var(--pl-bg-muted, #f8fafc)', border: '1px solid var(--pl-border)' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--pl-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Instructions to Site Engineer</span>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--pl-text-primary)', whiteSpace: 'pre-line', marginTop: '0.25rem', fontWeight: 500 }}>
                    {selectedProject.site_instructions || 'N/A'}
                  </span>
                </div>
              </div>

              {/* Audit Info */}
              <div className="pl-card" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {selectedProject.created_by_user?.full_name && (
                  <span>Created by: <strong>{selectedProject.created_by_user.full_name}</strong></span>
                )}
                {selectedProject.updated_by_user?.full_name && (
                  <span>Last updated by: <strong>{selectedProject.updated_by_user.full_name}</strong></span>
                )}
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

              {/* ── Material Reconciliation / Variance ── */}
              {activeTransactionTab === 'reconciliation' && (
                <div className="pl-card">
                  <div style={{ padding: '1rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Material Reconciliation & Variance</h3>
                      <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                        Tracks quantity variances from BOQ Budget vs Inwarded (delivered to site) vs Installed (as per JMS sign-offs).
                      </p>
                    </div>
                  </div>
                  {projectMaterials.length === 0 ? (
                    <div className="pl-empty">
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No project materials logged</p>
                    </div>
                  ) : (
                    <table className="pl-table">
                      <thead>
                        <tr>
                          <th>Material Name & Variant</th>
                          <th>Unit</th>
                          <th style={{ textAlign: 'right' }}>BOQ Budget (Planned)</th>
                          <th style={{ textAlign: 'right' }}>Inwarded (Delivered)</th>
                          <th style={{ textAlign: 'right' }}>Installed (JMS)</th>
                          <th style={{ textAlign: 'right' }}>On-Site Balance</th>
                          <th style={{ textAlign: 'right' }}>BOQ vs Installed Var.</th>
                          <th style={{ textAlign: 'right' }}>Wastage %</th>
                        </tr>
                      </thead>
                      <tbody>
                        {projectMaterials.map((mat: any) => {
                          const materialName = mat.materials?.name || 'Unknown Material';
                          const variantName = mat.company_variants?.variant_name || '';
                          const materialFullName = `${materialName} ${variantName}`.trim();
                          
                          const planned = parseFloat(mat.planned_qty) || 0;
                          const inwarded = parseFloat(mat.received_qty) || 0;
                          
                          // Calculate installed qty from completed JMS reports
                          let installed = 0;
                          projectJointMeasurements.forEach((jms: any) => {
                            if (Array.isArray(jms.measured_items)) {
                              jms.measured_items.forEach((itm: any) => {
                                const jmsItemName = (itm.item_name || '').toLowerCase().trim();
                                const matLower = materialName.toLowerCase().trim();
                                const fullLower = materialFullName.toLowerCase().trim();
                                if (jmsItemName === fullLower || jmsItemName === matLower) {
                                  installed += (parseFloat(itm.agreed_qty) || 0);
                                }
                              });
                            }
                          });

                          const onSiteBalance = inwarded - installed;
                          const boqVariance = planned - installed;
                          const wastagePercent = inwarded > 0 ? (onSiteBalance / inwarded) * 100 : 0;
                          const isHighWastage = wastagePercent > 3;

                          return (
                            <tr key={mat.id}>
                              <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                                {materialFullName}
                              </td>
                              <td style={{ color: 'var(--text-secondary)' }}>{mat.materials?.unit || mat.unit}</td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 500 }}>
                                {planned.toFixed(2)}
                              </td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 500, color: '#2563eb' }}>
                                {inwarded.toFixed(2)}
                              </td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 500, color: '#10b981' }}>
                                {installed.toFixed(2)}
                              </td>
                              <td style={{ fontFamily: 'JetBrains Mono, monospace', textAlign: 'right', fontWeight: 500 }}>
                                {onSiteBalance.toFixed(2)}
                              </td>
                              <td style={{ 
                                fontFamily: 'JetBrains Mono, monospace', 
                                textAlign: 'right', 
                                fontWeight: 500,
                                color: boqVariance < 0 ? '#ef4444' : 'inherit'
                              }}>
                                {boqVariance.toFixed(2)}
                              </td>
                              <td style={{ 
                                fontFamily: 'JetBrains Mono, monospace', 
                                textAlign: 'right', 
                                fontWeight: 600,
                                color: isHighWastage ? '#ef4444' : '#10b981'
                              }}>
                                {wastagePercent.toFixed(1)}%
                                {isHighWastage && (
                                  <span style={{ marginLeft: '4px', fontSize: '10px', background: '#fee2e2', color: '#ef4444', padding: '1px 4px', borderRadius: '4px' }}>
                                    High Wastage
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
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

          {activeTab === 'site-expenses' && (
            <SiteExpenses
              projectId={selectedProject.id}
              clientId={selectedProject.client_id}
            />
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

          {activeTab === 'subcontractors' && (() => {
            return (
              <ProjectSubcontractorWorkOrders projectId={selectedProject.id} fmt={fmt} fmtD={fmtD} />
            );
          })()}

          {activeTab === 'equipment' && (
            <div className="pl-card" style={{ padding: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Equipment & Warranty Register</h3>
                <button 
                  className="pl-btn pl-btn-primary" 
                  onClick={() => {
                    setEqFormData({
                      equipment_name: '',
                      make_model: '',
                      serial_number: '',
                      supplier: '',
                      quantity: 1,
                      warranty_start_date: new Date().toISOString().split('T')[0],
                      warranty_duration_months: 12
                    });
                    setIsEqModalOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
                >
                  <Plus size={14} /> Add Equipment
                </button>
              </div>

              {/* Alerts Rollup Box */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Warranty</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#065f46', marginTop: '0.25rem' }}>{equipmentStats.active}</span>
                </div>
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b45309', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring in 30 Days</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#92400e', marginTop: '0.25rem' }}>{equipmentStats.expiring30}</span>
                </div>
                <div style={{ background: '#fef3c7', border: '1px solid #fcd34d', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#d97706', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expiring in 90 Days</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#b45309', marginTop: '0.25rem' }}>{equipmentStats.expiring90}</span>
                </div>
                <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', padding: '1rem', borderRadius: '8px', display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#b91c1c', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Expired</span>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: '#991b1b', marginTop: '0.25rem' }}>{equipmentStats.expired}</span>
                </div>
              </div>

              {projectEquipment.length === 0 ? (
                <div className="pl-empty" style={{ padding: '2.5rem' }}>
                  <Folder className="pl-empty-icon" />
                  <p className="pl-empty-text">No equipment registered yet</p>
                </div>
              ) : (
                <table className="pl-table">
                  <thead>
                    <tr>
                      <th>Equipment Name</th>
                      <th>Make / Model</th>
                      <th>Serial Number</th>
                      <th>Supplier</th>
                      <th>Quantity</th>
                      <th>Warranty Start</th>
                      <th>Warranty End</th>
                      <th>Status</th>
                      <th>T&C Protocol</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectEquipment.map((eq: any) => {
                      const today = new Date();
                      today.setHours(0,0,0,0);
                      const endDate = eq.warranty_end_date ? new Date(eq.warranty_end_date) : null;
                      let statusText = 'No Warranty';
                      let badgeBg = '#f4f4f5';
                      let badgeColor = '#52525b';

                      if (endDate) {
                        endDate.setHours(0,0,0,0);
                        const isExpired = endDate < today;
                        const thirtyDays = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const ninetyDays = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000);
                        
                        if (isExpired) {
                          statusText = 'Expired';
                          badgeBg = '#fee2e2';
                          badgeColor = '#991b1b';
                        } else if (endDate <= thirtyDays) {
                          statusText = 'Expiring (<30d)';
                          badgeBg = '#fef3c7';
                          badgeColor = '#92400e';
                        } else if (endDate <= ninetyDays) {
                          statusText = 'Expiring (<90d)';
                          badgeBg = '#fffbeb';
                          badgeColor = '#b45309';
                        } else {
                          statusText = 'Active';
                          badgeBg = '#d1fae5';
                          badgeColor = '#065f46';
                        }
                      }

                      // Find if there is a T&C certificate for this equipment
                      const tcCert = projectTcProtocols.find((tc: any) => tc.equipment_id === eq.id);

                      return (
                        <tr key={eq.id}>
                          <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{eq.equipment_name}</td>
                          <td>{eq.make_model || '-'}</td>
                          <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>{eq.serial_number || '-'}</td>
                          <td>{eq.supplier || '-'}</td>
                          <td>{eq.quantity}</td>
                          <td>{fmtD(eq.warranty_start_date)}</td>
                          <td>{fmtD(eq.warranty_end_date)}</td>
                          <td>
                            <span style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.125rem 0.5rem',
                              borderRadius: '9999px',
                              fontSize: '0.75rem',
                              fontWeight: 500,
                              background: badgeBg,
                              color: badgeColor
                            }}>
                              {statusText}
                            </span>
                          </td>
                          <td>
                            {tcCert ? (
                              <button
                                onClick={() => setSelectedTcCert(tcCert)}
                                className="pl-btn"
                                style={{
                                  fontSize: '0.75rem',
                                  padding: '0.25rem 0.5rem',
                                  background: '#ecfdf5',
                                  color: '#065f46',
                                  border: '1px solid #a7f3d0',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '0.25rem',
                                  cursor: 'pointer'
                                }}
                              >
                                <FileText size={12} />
                                View Certificate
                              </button>
                            ) : (
                              <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>Pending Commissioning</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'snags' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              
              {/* Drawings Selector Bar */}
              <div className="pl-card" style={{ padding: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>Layout Drawings & Schematic Blueprints</h3>
                  <button 
                    className="pl-btn pl-btn-primary" 
                    onClick={() => {
                      setSnagFormData({
                        description: '',
                        location_area: '',
                        severity: 'Medium',
                        status: 'Open',
                        covered_under_warranty: false,
                        equipment_id: '',
                        drawing_id: '',
                        pin_x: null,
                        pin_y: null
                      });
                      setIsSnagModalOpen(true);
                    }}
                    style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.8125rem' }}
                  >
                    <Plus size={14} /> Add Snag
                  </button>
                </div>
                
                <div style={{ marginTop: '1rem' }}>
                  {projectDrawings.length === 0 ? (
                    <div style={{ padding: '1.5rem', background: '#f8fafc', border: '1px dashed #cbd5e1', borderRadius: '8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.75rem', textAlign: 'center' }}>
                      <p style={{ margin: 0, fontSize: '0.875rem', color: '#64748b' }}>No drawing layouts uploaded for this project yet.</p>
                      <div style={{ display: 'flex', gap: '0.75rem' }}>
                        <button 
                          className="pl-btn pl-btn-primary"
                          style={{ fontSize: '0.8125rem' }}
                          onClick={async () => {
                            try {
                              if (!selectedProject?.id || !organisation?.id) return;
                              const { error } = await supabase
                                .from('project_drawings')
                                .insert([{
                                  organisation_id: organisation.id,
                                  project_id: selectedProject.id,
                                  name: 'Ground Floor HVAC & Piping Layout',
                                  file_url: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=1000&auto=format&fit=crop'
                                }]);
                              if (error) throw error;
                              refetchDrawings();
                              alert('Ground Floor Layout initialized successfully');
                            } catch (err: any) {
                              alert('Error initializing: ' + err.message);
                            }
                          }}
                        >
                          Initialize Default Blueprint
                        </button>
                        <button 
                          className="pl-btn"
                          style={{ background: '#fff', border: '1px solid #cbd5e1', fontSize: '0.8125rem' }}
                          onClick={() => setIsAddingDrawing(true)}
                        >
                          Upload Custom Drawing
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#64748b' }}>Select Layout:</span>
                      {projectDrawings.map((dw: any) => (
                        <button 
                          key={dw.id} 
                          onClick={() => {
                            setActiveDrawingId(dw.id);
                            setHighlightedSnagId(null);
                          }}
                          className="pl-btn"
                          style={{
                            fontSize: '0.8125rem',
                            padding: '0.25rem 0.75rem',
                            background: activeDrawingId === dw.id ? '#2563eb' : '#fff',
                            color: activeDrawingId === dw.id ? '#fff' : '#475569',
                            border: '1px solid ' + (activeDrawingId === dw.id ? '#2563eb' : '#cbd5e1'),
                          }}
                        >
                          {dw.name}
                        </button>
                      ))}
                      <button 
                        onClick={() => setIsAddingDrawing(true)} 
                        className="pl-btn"
                        style={{
                          fontSize: '0.8125rem',
                          padding: '0.25rem 0.5rem',
                          background: '#f8fafc',
                          border: '1px dashed #cbd5e1',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.25rem'
                        }}
                      >
                        <Plus size={14} /> Add Drawing
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Main Content: Split layout */}
              <div style={{ display: 'flex', gap: '1.5rem', flexDirection: 'row', flexWrap: 'wrap' }}>
                
                {/* Snags Table column */}
                <div className="pl-card" style={{ flex: '1 1 55%', minWidth: '400px', padding: '1.25rem' }}>
                  <h4 style={{ margin: '0 0 1rem 0', fontWeight: 600, color: '#1e293b' }}>Defect Registry</h4>
                  {projectSnags.length === 0 ? (
                    <div className="pl-empty" style={{ padding: '2.5rem' }}>
                      <Folder className="pl-empty-icon" />
                      <p className="pl-empty-text">No snags or defects reported yet</p>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table className="pl-table">
                        <thead>
                          <tr>
                            <th>Description</th>
                            <th>Location</th>
                            <th>Severity</th>
                            <th>Status</th>
                            <th>Warranty</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projectSnags.map((snag: any) => {
                            const linkedEquipment = projectEquipment.find((e: any) => e.id === snag.equipment_id);
                            const matchingClaim = warrantyClaims.find((c: any) => c.snag_id === snag.id);
                            const isHighlighted = highlightedSnagId === snag.id;
                            
                            let severityBg = '#f4f4f5';
                            let severityColor = '#52525b';
                            if (snag.severity === 'Critical') {
                              severityBg = '#fee2e2';
                              severityColor = '#991b1b';
                            } else if (snag.severity === 'High') {
                              severityBg = '#ffedd5';
                              severityColor = '#c2410c';
                            } else if (snag.severity === 'Medium') {
                              severityBg = '#fef3c7';
                              severityColor = '#b45309';
                            } else if (snag.severity === 'Low') {
                              severityBg = '#e0f2fe';
                              severityColor = '#0369a1';
                            }

                            let statusBg = '#f4f4f5';
                            let statusColor = '#52525b';
                            if (snag.status === 'Resolved' || snag.status === 'Closed') {
                              statusBg = '#d1fae5';
                              statusColor = '#065f46';
                            } else if (snag.status === 'In Progress') {
                              statusBg = '#dbeafe';
                              statusColor = '#1e40af';
                            } else if (snag.status === 'Open') {
                              statusBg = '#fee2e2';
                              statusColor = '#991b1b';
                            }

                            return (
                              <tr 
                                key={snag.id} 
                                onClick={() => {
                                  if (snag.drawing_id) {
                                    setActiveDrawingId(snag.drawing_id);
                                  }
                                  setHighlightedSnagId(snag.id);
                                }}
                                style={{ 
                                  cursor: 'pointer',
                                  background: isHighlighted ? '#f0fdf4' : 'transparent',
                                  transition: 'background 0.2s'
                                }}
                              >
                                <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{snag.description}</td>
                                <td>{snag.location_area || '-'}</td>
                                <td>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: severityBg,
                                    color: severityColor
                                  }}>
                                    {snag.severity}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    padding: '0.125rem 0.5rem',
                                    borderRadius: '9999px',
                                    fontSize: '0.75rem',
                                    fontWeight: 500,
                                    background: statusBg,
                                    color: statusColor
                                  }}>
                                    {snag.status}
                                  </span>
                                </td>
                                <td>
                                  {snag.covered_under_warranty ? (
                                    <span style={{ color: '#059669', fontSize: '0.75rem', fontWeight: 600 }}>
                                      Yes {linkedEquipment ? `(${linkedEquipment.equipment_name})` : ''}
                                    </span>
                                  ) : (
                                    <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>No</span>
                                  )}
                                </td>
                                <td>
                                  <div style={{ display: 'flex', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                                    {snag.covered_under_warranty && (
                                      <>
                                        {matchingClaim ? (
                                          <button
                                            className="pl-btn"
                                            onClick={() => {
                                              setClaimFormData({
                                                id: matchingClaim.id,
                                                snag_id: matchingClaim.snag_id || '',
                                                equipment_id: matchingClaim.equipment_id || '',
                                                vendor_name: matchingClaim.vendor_name || '',
                                                claim_reference_number: matchingClaim.claim_reference_number || '',
                                                status: matchingClaim.status || 'Draft',
                                                vendor_dispute_reason: matchingClaim.vendor_dispute_reason || '',
                                                parts_covered: matchingClaim.parts_covered ?? true,
                                                labor_covered: matchingClaim.labor_covered ?? false,
                                                vendor_claimed_cost: matchingClaim.vendor_claimed_cost?.toString() || '',
                                                vendor_approved_cost: matchingClaim.vendor_approved_cost?.toString() || '',
                                                internal_cost_incurred: matchingClaim.internal_cost_incurred?.toString() || '',
                                                resolution_method: matchingClaim.resolution_method || 'N/A',
                                                resolution_date: matchingClaim.resolution_date || ''
                                              });
                                              setIsClaimModalOpen(true);
                                            }}
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '0.2rem 0.4rem',
                                              background: '#eff6ff',
                                              color: '#1e40af',
                                              border: '1px solid #bfdbfe'
                                            }}
                                          >
                                            Claim: {matchingClaim.status}
                                          </button>
                                        ) : (
                                          <button
                                            className="pl-btn pl-btn-primary"
                                            onClick={() => {
                                              const supplierName = linkedEquipment?.supplier || '';
                                              setClaimFormData({
                                                id: '',
                                                snag_id: snag.id,
                                                equipment_id: snag.equipment_id || '',
                                                vendor_name: supplierName,
                                                claim_reference_number: '',
                                                status: 'Draft',
                                                vendor_dispute_reason: '',
                                                parts_covered: true,
                                                labor_covered: false,
                                                vendor_claimed_cost: '',
                                                vendor_approved_cost: '',
                                                internal_cost_incurred: '',
                                                resolution_method: 'N/A',
                                                resolution_date: ''
                                              });
                                              setIsClaimModalOpen(true);
                                            }}
                                            style={{
                                              fontSize: '0.7rem',
                                              padding: '0.2rem 0.4rem',
                                              background: '#10b981',
                                              border: 'none',
                                              color: '#fff'
                                            }}
                                          >
                                            Claim
                                          </button>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Interactive Map column */}
                {activeDrawingId && (() => {
                  const activeDrawing = projectDrawings.find((d: any) => d.id === activeDrawingId);
                  if (!activeDrawing) return null;

                  const drawingSnags = projectSnags.filter((s: any) => s.drawing_id === activeDrawingId && s.pin_x !== null && s.pin_y !== null);

                  return (
                    <div className="pl-card" style={{ flex: '1 1 38%', minWidth: '320px', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <h4 style={{ margin: 0, fontWeight: 600, color: '#1e293b' }}>Visual Pin-Map</h4>
                        <span style={{ fontSize: '0.75rem', padding: '0.125rem 0.375rem', background: '#f1f5f9', color: '#475569', borderRadius: '4px', fontWeight: 500 }}>
                          {activeDrawing.name}
                        </span>
                      </div>
                      
                      <div style={{ 
                        position: 'relative', 
                        borderRadius: '8px', 
                        overflow: 'hidden', 
                        border: '1px solid #cbd5e1', 
                        background: '#f8fafc',
                        minHeight: '300px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        <img 
                          src={activeDrawing.file_url} 
                          alt="Floor layout blueprint" 
                          style={{ width: '100%', height: 'auto', maxHeight: '500px', objectFit: 'contain' }}
                        />
                        
                        {/* Render pins */}
                        {drawingSnags.map((snag: any) => {
                          const isHighlighted = highlightedSnagId === snag.id;
                          
                          let pinColor = '#ef4444'; // default open
                          if (snag.status === 'Resolved' || snag.status === 'Closed') {
                            pinColor = '#10b981'; // green
                          } else if (snag.status === 'In Progress') {
                            pinColor = '#3b82f6'; // blue
                          }

                          return (
                            <div 
                              key={snag.id}
                              onClick={() => setHighlightedSnagId(snag.id)}
                              style={{
                                position: 'absolute',
                                left: `${snag.pin_x}%`,
                                top: `${snag.pin_y}%`,
                                width: isHighlighted ? '18px' : '12px',
                                height: isHighlighted ? '18px' : '12px',
                                borderRadius: '50%',
                                background: pinColor,
                                border: '2px solid #fff',
                                transform: 'translate(-50%, -50%)',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                                boxShadow: isHighlighted ? `0 0 0 6px ${pinColor}80` : '0 2px 4px rgba(0,0,0,0.2)',
                                zIndex: isHighlighted ? 10 : 2
                              }}
                              title={`${snag.description} (${snag.severity}) - ${snag.status}`}
                            />
                          );
                        })}
                      </div>

                      {/* Info Panel for highlighted snag */}
                      {highlightedSnagId && (() => {
                        const snag = projectSnags.find((s: any) => s.id === highlightedSnagId);
                        if (!snag) return null;
                        return (
                          <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                              <span style={{ fontWeight: 600, color: '#334155' }}>Selected Snag Details</span>
                              <button 
                                onClick={() => setHighlightedSnagId(null)} 
                                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0 }}
                              >
                                <X size={14} />
                              </button>
                            </div>
                            <p style={{ margin: '0.25rem 0', color: '#475569' }}>{snag.description}</p>
                            <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem', flexWrap: 'wrap', color: '#64748b', fontSize: '0.75rem' }}>
                              <span><strong>Location:</strong> {snag.location_area || 'N/A'}</span>
                              <span><strong>Severity:</strong> {snag.severity}</span>
                              <span><strong>Status:</strong> {snag.status}</span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  );
                })()}

              </div>

              {/* Warranty Claims Card */}
              <div className="pl-card" style={{ padding: '1.25rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontWeight: 600, color: 'var(--text-primary)' }}>Warranty Claims Registry</h3>
                {warrantyClaims.length === 0 ? (
                  <div className="pl-empty" style={{ padding: '2rem' }}>
                    <Folder className="pl-empty-icon" />
                    <p className="pl-empty-text">No active warranty claims registered</p>
                  </div>
                ) : (
                  <table className="pl-table">
                    <thead>
                      <tr>
                        <th>Equipment</th>
                        <th>Vendor</th>
                        <th>Claim Ref / RMA</th>
                        <th>Status</th>
                        <th>Coverage</th>
                        <th>Escalated Dates</th>
                        {['Project Manager', 'Admin'].includes(userRole) && (
                          <>
                            <th>Claimed Cost</th>
                            <th>Approved Cost</th>
                            <th>Internal Cost</th>
                          </>
                        )}
                        <th>Resolution</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {warrantyClaims.map((claim: any) => {
                        let statusColor = '#4b5563';
                        let statusBg = '#f3f4f6';
                        if (claim.status === 'Resolved') {
                          statusColor = '#065f46';
                          statusBg = '#d1fae5';
                        } else if (claim.status === 'Pending Response') {
                          statusColor = '#92400e';
                          statusBg = '#fef3c7';
                        } else if (claim.status === 'Draft') {
                          statusColor = '#374151';
                          statusBg = '#e5e7eb';
                        } else if (claim.status === 'Rejected' || claim.status === 'Disputed') {
                          statusColor = '#991b1b';
                          statusBg = '#fee2e2';
                        }

                        return (
                          <tr key={claim.id}>
                            <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                              {claim.equipment?.equipment_name || '-'}
                            </td>
                            <td>{claim.vendor_name}</td>
                            <td style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: '0.75rem' }}>
                              {claim.claim_reference_number || '-'}
                            </td>
                            <td>
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                padding: '0.125rem 0.5rem',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                                background: statusBg,
                                color: statusColor
                              }}>
                                {claim.status}
                              </span>
                            </td>
                            <td style={{ fontSize: '0.75rem' }}>
                              <div>Parts: {claim.parts_covered ? 'Yes' : 'No'}</div>
                              <div>Labor: {claim.labor_covered ? 'Yes' : 'No'}</div>
                            </td>
                            <td style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {claim.date_escalated ? (
                                <>
                                  <div>Sent: {fmtD(claim.date_escalated)}</div>
                                  <div>End: {fmtD(claim.escalated_warranty_end)}</div>
                                </>
                              ) : (
                                'Not Sent Yet'
                              )}
                            </td>
                            {['Project Manager', 'Admin'].includes(userRole) && (
                              <>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{claim.vendor_claimed_cost ? fmt(claim.vendor_claimed_cost) : '-'}</td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{claim.vendor_approved_cost ? fmt(claim.vendor_approved_cost) : '-'}</td>
                                <td style={{ fontFamily: 'JetBrains Mono, monospace' }}>{claim.internal_cost_incurred ? fmt(claim.internal_cost_incurred) : '-'}</td>
                              </>
                            )}
                            <td>
                              {claim.resolution_method && claim.resolution_method !== 'N/A' ? (
                                <div>
                                  <div style={{ fontWeight: 500 }}>{claim.resolution_method}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmtD(claim.resolution_date)}</div>
                                </div>
                              ) : (
                                '-'
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', gap: '0.375rem', alignItems: 'center' }}>
                                <button
                                  className="pl-btn"
                                  onClick={() => {
                                    setClaimFormData({
                                      id: claim.id,
                                      snag_id: claim.snag_id || '',
                                      equipment_id: claim.equipment_id || '',
                                      vendor_name: claim.vendor_name || '',
                                      claim_reference_number: claim.claim_reference_number || '',
                                      status: claim.status || 'Draft',
                                      vendor_dispute_reason: claim.vendor_dispute_reason || '',
                                      parts_covered: claim.parts_covered ?? true,
                                      labor_covered: claim.labor_covered ?? false,
                                      vendor_claimed_cost: claim.vendor_claimed_cost?.toString() || '',
                                      vendor_approved_cost: claim.vendor_approved_cost?.toString() || '',
                                      internal_cost_incurred: claim.internal_cost_incurred?.toString() || '',
                                      resolution_method: claim.resolution_method || 'N/A',
                                      resolution_date: claim.resolution_date || ''
                                    });
                                    setIsClaimModalOpen(true);
                                  }}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    background: '#f3f4f6',
                                    border: '1px solid #d1d5db',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Edit
                                </button>
                                <button
                                  className="pl-btn"
                                  onClick={() => {
                                    setNotifyingClaim(claim);
                                    setNotifyEmail(claim.vendor_email || '');
                                    setNotifySlaDays(7);
                                  }}
                                  style={{
                                    fontSize: '0.75rem',
                                    padding: '0.25rem 0.5rem',
                                    background: '#fef3c7',
                                    color: '#b45309',
                                    border: '1px solid #fcd34d',
                                    cursor: 'pointer'
                                  }}
                                >
                                  {claim.vendor_notified_at ? 'Re-send Letter' : 'Send Claim Letter'}
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

          {isAddingDrawing && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '400px', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Add Layout Drawing</h3>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Drawing Name *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. Ground Floor Piping"
                    className="pl-input"
                    value={newDrawingName}
                    onChange={e => setNewDrawingName(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Drawing Image URL *</label>
                  <input 
                    type="text" 
                    required
                    placeholder="e.g. https://example.com/drawing.jpg"
                    className="pl-input"
                    value={newDrawingUrl}
                    onChange={e => setNewDrawingUrl(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
                  <button className="pl-btn" onClick={() => setIsAddingDrawing(false)} style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                    Cancel
                  </button>
                  <button 
                    className="pl-btn pl-btn-primary" 
                    onClick={async () => {
                      if (!newDrawingName || !newDrawingUrl) return;
                      try {
                        if (!selectedProject?.id || !organisation?.id) return;
                        const { error } = await supabase
                          .from('project_drawings')
                          .insert([{
                            organisation_id: organisation.id,
                            project_id: selectedProject.id,
                            name: newDrawingName,
                            file_url: newDrawingUrl
                          }]);
                        if (error) throw error;
                        setNewDrawingName('');
                        setNewDrawingUrl('');
                        setIsAddingDrawing(false);
                        refetchDrawings();
                        alert('Layout drawing added successfully');
                      } catch (err: any) {
                        alert('Error: ' + err.message);
                      }
                    }}
                  >
                    Add Layout
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* T&C Commissioning Certificate Modal */}
          {selectedTcCert && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>Testing & Commissioning Certificate</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Protocol Record & Witness Statement</span>
                  </div>
                  <button onClick={() => setSelectedTcCert(null)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                  
                  {/* Equipment metadata */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', background: '#f8fafc', padding: '0.75rem 1rem', borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '0.8125rem' }}>
                    <div>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>Equipment Name</span>
                      <strong style={{ color: '#334155' }}>
                        {projectEquipment.find((e: any) => e.id === selectedTcCert.equipment_id)?.equipment_name || 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>Test Protocol Type</span>
                      <strong style={{ color: '#334155' }}>{selectedTcCert.test_type}</strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>Tested Date</span>
                      <strong style={{ color: '#334155' }}>
                        {selectedTcCert.site_visit?.visit_date ? fmtD(selectedTcCert.site_visit.visit_date) : 'N/A'}
                      </strong>
                    </div>
                    <div>
                      <span style={{ display: 'block', color: '#64748b', fontSize: '0.75rem' }}>Witness Representative</span>
                      <strong style={{ color: '#334155' }}>{selectedTcCert.witnessed_by_client || 'N/A'}</strong>
                    </div>
                  </div>

                  {/* Readings Table */}
                  <div>
                    <span style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Verification Parameters & Readings
                    </span>
                    <table className="pl-table" style={{ fontSize: '0.8125rem' }}>
                      <thead>
                        <tr>
                          <th>Parameter Tested</th>
                          <th>Req. Value</th>
                          <th>Act. Value</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Array.isArray(selectedTcCert.readings) && selectedTcCert.readings.map((rd: any, idx: number) => (
                          <tr key={idx}>
                            <td style={{ fontWeight: 500, color: '#1e293b' }}>{rd.parameter}</td>
                            <td>{rd.required_value}</td>
                            <td style={{ fontWeight: 600, color: '#0f172a' }}>{rd.actual_value}</td>
                            <td>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '9999px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: rd.status === 'Pass' ? '#d1fae5' : rd.status === 'Fail' ? '#fee2e2' : '#fef3c7',
                                color: rd.status === 'Pass' ? '#065f46' : rd.status === 'Fail' ? '#991b1b' : '#b45309'
                              }}>
                                {rd.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Signature & Signoff */}
                  {selectedTcCert.site_visit?.signed_off_by && (
                    <div style={{ marginTop: '0.5rem', padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b' }}>Client Sign-off Witness</span>
                        <strong style={{ display: 'block', fontSize: '0.875rem', color: '#1e293b', marginTop: '0.125rem' }}>
                          {selectedTcCert.site_visit.signed_off_by}
                        </strong>
                        <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          {selectedTcCert.site_visit.signed_off_designation}
                        </span>
                      </div>
                      {selectedTcCert.site_visit.signature_image_url && (
                        <div>
                          <span style={{ display: 'block', fontSize: '0.75rem', color: '#64748b', textAlign: 'right', marginBottom: '0.25rem' }}>Digital Signature</span>
                          <img 
                            src={selectedTcCert.site_visit.signature_image_url} 
                            alt="Client Witness Signature" 
                            style={{ border: '1px solid #e2e8f0', borderRadius: '4px', background: '#fff', maxHeight: '50px', maxWidth: '150px' }}
                          />
                        </div>
                      )}
                    </div>
                  )}

                </div>
                <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                  <button onClick={() => setSelectedTcCert(null)} className="pl-btn pl-btn-primary">
                    Close Certificate
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Send Claim Letter Modal */}
          {notifyingClaim && (() => {
            const matchingEquipment = projectEquipment.find((e: any) => e.id === notifyingClaim.equipment_id);
            const matchingSnag = projectSnags.find((s: any) => s.id === notifyingClaim.snag_id);
            const slaDate = new Date();
            slaDate.setDate(slaDate.getDate() + notifySlaDays);
            
            const letterBody = `Dear ${notifyingClaim.vendor_name || 'Vendor'},\n\n` +
              `This is a formal MEP warranty claim notification regarding the following equipment:\n` +
              `- Equipment: ${matchingEquipment?.equipment_name || 'N/A'}\n` +
              `- Model/Make: ${matchingEquipment?.make_model || 'N/A'}\n` +
              `- Serial Number: ${matchingEquipment?.serial_number || 'N/A'}\n\n` +
              `Reported Defect Details:\n` +
              `"${matchingSnag?.description || notifyingClaim.snag?.description || 'N/A'}"\n\n` +
              `As per our Service Level Agreement (SLA), please resolve this issue or provide a replacement by ${slaDate.toLocaleDateString()}.\n\n` +
              `Please respond to this email to confirm receipt and share the dispatch details of your service engineer.\n\n` +
              `Best regards,\n` +
              `${organisation?.organisation_name || 'Project Management Team'}`;

            return (
              <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
                <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Send Warranty Claim Letter</h3>
                    <button onClick={() => setNotifyingClaim(null)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                      <X size={20} />
                    </button>
                  </div>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor Email *</label>
                        <input
                          type="email"
                          required
                          placeholder="vendor@supplier.com"
                          className="pl-input"
                          value={notifyEmail}
                          onChange={e => setNotifyEmail(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>SLA Duration (Days)</label>
                        <select
                          className="pl-input"
                          value={notifySlaDays}
                          onChange={e => setNotifySlaDays(parseInt(e.target.value) || 7)}
                          style={{ width: '100%' }}
                        >
                          <option value="3">3 Days (Critical)</option>
                          <option value="7">7 Days (Standard)</option>
                          <option value="14">14 Days (Extended)</option>
                          <option value="30">30 Days</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Letter Preview</label>
                      <textarea
                        readOnly
                        className="pl-input"
                        value={letterBody}
                        style={{ width: '100%', height: '240px', background: '#f8fafc', fontFamily: 'monospace', fontSize: '0.8125rem', padding: '0.75rem' }}
                      />
                    </div>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button onClick={() => setNotifyingClaim(null)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </button>
                    <button
                      onClick={async () => {
                        if (!notifyEmail) {
                          alert('Please enter a vendor email address.');
                          return;
                        }
                        try {
                          const calculatedSlaDate = new Date();
                          calculatedSlaDate.setDate(calculatedSlaDate.getDate() + notifySlaDays);

                          const { error } = await supabase
                            .from('warranty_claims')
                            .update({
                              vendor_email: notifyEmail,
                              vendor_notified_at: new Date().toISOString(),
                              sla_due_date: calculatedSlaDate.toISOString().split('T')[0],
                              status: notifyingClaim.status === 'Draft' ? 'Pending Response' : notifyingClaim.status
                            })
                            .eq('id', notifyingClaim.id);

                          if (error) throw error;
                          setNotifyingClaim(null);
                          refetchClaims();
                          alert('Warranty claim letter sent successfully to vendor.');
                        } catch (err: any) {
                          alert('Error sending letter: ' + err.message);
                        }
                      }}
                      className="pl-btn pl-btn-primary"
                    >
                      Dispatch Claim Letter
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* Equipment Modal */}
          {activeTab === 'continuous-improvement' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Overview Metric Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem' }}>
                {(() => {
                  const openCount = projectInsights.filter((i: any) => i.status !== 'Closed' && i.category !== 'Best Practice' && i.category !== 'Cost Saving Idea').length;
                  const criticalCount = projectInsights.filter((i: any) => i.status !== 'Closed' && i.impact_level === 'Critical').length;
                  const savings = projectInsights.filter((i: any) => i.category === 'Cost Saving Idea').reduce((sum: number, i: any) => sum + (parseFloat(i.estimated_loss_amount) || 0), 0);
                  const losses = projectInsights.filter((i: any) => i.category === 'Improvement Opportunity' || i.category === 'Coordination Issue' || i.category === 'Safety Observation').reduce((sum: number, i: any) => sum + (parseFloat(i.estimated_loss_amount) || 0), 0);
                  const resolvedThisMonth = projectInsights.filter((i: any) => {
                    if (i.status !== 'Closed' || !i.resolved_at) return false;
                    const resDate = new Date(i.resolved_at);
                    const now = new Date();
                    return resDate.getMonth() === now.getMonth() && resDate.getFullYear() === now.getFullYear();
                  }).length;

                  return (
                    <>
                      <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #ef4444', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Open Issues</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{openCount}</span>
                      </div>
                      <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #f59e0b', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Critical Issues</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#f59e0b' }}>{criticalCount}</span>
                      </div>
                      <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #10b981', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Savings Identified</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#10b981' }}>{formatCurrency(savings)}</span>
                      </div>
                      <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #6b7280', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Estimated Losses</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(losses)}</span>
                      </div>
                      <div className="pl-card" style={{ padding: '1rem', borderLeft: '4px solid #3b82f6', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' }}>Resolved This Month</span>
                        <span style={{ fontSize: '1.5rem', fontWeight: 700, color: '#3b82f6' }}>{resolvedThisMonth}</span>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Insights & Kanban Board */}
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: '1.5rem', alignItems: 'start' }}>
                
                {/* Insights Panel */}
                <div className="pl-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Observations Log</h3>
                    
                    {/* Add Observation Option (for PM/Admin on desktop) */}
                    {(userRole === 'Project Manager' || userRole === 'Admin') && (
                      <button
                        type="button"
                        onClick={() => {
                          const title = prompt('Enter observation title:');
                          if (!title) return;
                          const category = prompt('Enter category (Improvement Opportunity, Best Practice, Client Feedback, Coordination Issue, Safety Observation, Cost Saving Idea):', 'Improvement Opportunity');
                          if (!category) return;
                          supabase.from('project_insights').insert([{
                            organisation_id: organisation?.id,
                            project_id: selectedProject.id,
                            category,
                            title,
                            status: 'Open',
                            visibility: 'Everyone',
                            created_by: user?.id
                          }]).then(({ error }) => {
                            if (error) alert(error.message);
                            else refetchInsights();
                          });
                        }}
                        className="pl-btn pl-btn-primary"
                        style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                      >
                        + Add Log
                      </button>
                    )}
                  </div>

                  {/* Filter Chips */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                    {[
                      { id: 'All', label: 'All' },
                      { id: 'Improvement Opportunity', label: 'Opportunities' },
                      { id: 'Best Practice', label: 'Best Practices' },
                      { id: 'Client Feedback', label: 'Feedback' },
                      { id: 'Coordination Issue', label: 'Coordination' },
                      { id: 'Safety Observation', label: 'Safety' },
                      { id: 'Cost Saving Idea', label: 'Cost Savings' }
                    ].map(chip => (
                      <button
                        key={chip.id}
                        onClick={() => setInsightFilter(chip.id)}
                        style={{
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          background: insightFilter === chip.id ? 'var(--primary-color, #2563eb)' : '#f1f5f9',
                          color: insightFilter === chip.id ? '#fff' : '#475569'
                        }}
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>

                  {/* Insights Cards List */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '500px', overflowY: 'auto' }}>
                    {(() => {
                      const filtered = projectInsights.filter((i: any) => insightFilter === 'All' || i.category === insightFilter);
                      if (filtered.length === 0) {
                        return <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', padding: '1rem 0', textAlign: 'center' }}>No observations matching filter</span>;
                      }

                      return filtered.map((ins: any) => {
                        let borderLeftColor = '#cbd5e1';
                        if (ins.category === 'Improvement Opportunity') borderLeftColor = '#ef4444';
                        else if (ins.category === 'Best Practice') borderLeftColor = '#10b981';
                        else if (ins.category === 'Client Feedback') borderLeftColor = '#3b82f6';
                        else if (ins.category === 'Coordination Issue') borderLeftColor = '#f97316';
                        else if (ins.category === 'Safety Observation') borderLeftColor = '#f59e0b';
                        else if (ins.category === 'Cost Saving Idea') borderLeftColor = '#14b8a6';

                        const creatorName = teamMembers.find((m: any) => m.user_id === ins.created_by)?.full_name || 'Site Staff';

                        return (
                          <div
                            key={ins.id}
                            style={{
                              border: '1px solid #cbd5e1',
                              borderLeft: `4px solid ${borderLeftColor}`,
                              borderRadius: '6px',
                              padding: '0.75rem',
                              background: '#fff',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.375rem'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{ins.category}</span>
                              <span style={{
                                fontSize: '0.6875rem',
                                padding: '2px 6px',
                                borderRadius: '4px',
                                background: ins.status === 'Closed' ? '#d1fae5' : ins.status === 'In Progress' ? '#fef3c7' : '#f1f5f9',
                                color: ins.status === 'Closed' ? '#065f46' : ins.status === 'In Progress' ? '#92400e' : '#475569',
                                fontWeight: 600
                              }}>{ins.status}</span>
                            </div>
                            <span style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)' }}>{ins.title}</span>
                            {ins.description && (
                              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{ins.description}</p>
                            )}

                            {/* Tags */}
                            {ins.tags && ins.tags.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem', marginTop: '0.25rem' }}>
                                {ins.tags.map((t: string) => (
                                  <span key={t} style={{ fontSize: '0.625rem', padding: '1px 5px', background: '#f1f5f9', borderRadius: '4px', color: '#64748b' }}>#{t}</span>
                                ))}
                              </div>
                            )}

                            {/* Enrichment Metadata indicators */}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: '0.25rem', borderTop: '1px dashed #f1f5f9', paddingTop: '0.375rem' }}>
                              {ins.root_cause && (
                                <span>RCA: <strong>{ins.root_cause}</strong></span>
                              )}
                              {ins.estimated_loss_amount > 0 && (
                                <span style={{ color: ins.category === 'Cost Saving Idea' ? '#047857' : '#b91c1c' }}>
                                  {ins.category === 'Cost Saving Idea' ? 'Saved' : 'Impact'}: <strong>₹{ins.estimated_loss_amount.toLocaleString('en-IN')}</strong>
                                </span>
                              )}
                              {ins.estimated_delay_days > 0 && (
                                <span style={{ color: '#b91c1c' }}>Delay: <strong>{ins.estimated_delay_days}d</strong></span>
                              )}
                              {ins.is_repeat_issue && (
                                <span style={{ color: '#b91c1c', display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                  <AlertTriangle size={10} /> Repeat ({ins.repeat_issue_count}x)
                                </span>
                              )}
                            </div>

                            {/* Footer card actions */}
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.25rem', fontSize: '0.6875rem', color: 'var(--text-muted)' }}>
                              <span>By: {creatorName}</span>
                              {(userRole === 'Project Manager' || userRole === 'Admin') && (
                                <button
                                  type="button"
                                  onClick={() => openEnrichmentModal(ins)}
                                  className="pl-link-btn"
                                  style={{ color: 'var(--primary-color, #2563eb)', fontWeight: 600, border: 'none', background: 'none', cursor: 'pointer', padding: 0 }}
                                >
                                  Enrich / Edit
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      });
                    })()}
                  </div>

                </div>

                {/* Kanban Actions Panel */}
                <div className="pl-card" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <h3 style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)', fontSize: '1rem' }}>Actions Tracking (Kanban)</h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', alignItems: 'start' }}>
                    
                    {/* Column 1: Open */}
                    <div style={{ background: '#f8fafc', borderRadius: '8px', padding: '0.5rem', border: '1px solid #e2e8f0', minHeight: '400px' }}>
                      <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase' }}>Open</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#e2e8f0', color: '#475569', padding: '1px 6px', borderRadius: '10px' }}>
                          {projectInsights.filter((i: any) => i.status === 'Open').length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {projectInsights.filter((i: any) => i.status === 'Open').map((ins: any) => (
                          <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                        ))}
                      </div>
                    </div>

                    {/* Column 2: In Progress */}
                    <div style={{ background: '#fffbeb', borderRadius: '8px', padding: '0.5rem', border: '1px solid #fef3c7', minHeight: '400px' }}>
                      <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b45309', textTransform: 'uppercase' }}>In Progress</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#fde68a', color: '#b45309', padding: '1px 6px', borderRadius: '10px' }}>
                          {projectInsights.filter((i: any) => i.status === 'In Progress').length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {projectInsights.filter((i: any) => i.status === 'In Progress').map((ins: any) => (
                          <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                        ))}
                      </div>
                    </div>

                    {/* Column 3: Closed */}
                    <div style={{ background: '#f0fdf4', borderRadius: '8px', padding: '0.5rem', border: '1px solid #dcfce7', minHeight: '400px' }}>
                      <div style={{ padding: '0.25rem 0.5rem', marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#15803d', textTransform: 'uppercase' }}>Closed</span>
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, background: '#bbf7d0', color: '#15803d', padding: '1px 6px', borderRadius: '10px' }}>
                          {projectInsights.filter((i: any) => i.status === 'Closed').length}
                        </span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        {projectInsights.filter((i: any) => i.status === 'Closed').map((ins: any) => (
                          <KanbanCard key={ins.id} insight={ins} onMove={(status) => handleUpdateInsightStatus(ins.id, status)} teamMembers={teamMembers} onEdit={() => openEnrichmentModal(ins)} userRole={userRole} />
                        ))}
                      </div>
                    </div>

                  </div>
                </div>

              </div>
            </div>
          )}

          </TabErrorBoundary>

          {isEqModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Add Equipment to Project</h3>
                  <button onClick={() => setIsEqModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEqSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Equipment Name *</label>
                      <input
                        type="text"
                        required
                        className="pl-input"
                        value={eqFormData.equipment_name}
                        onChange={e => setEqFormData(prev => ({ ...prev, equipment_name: e.target.value }))}
                        style={{ width: '100%' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Make / Model</label>
                        <input
                          type="text"
                          className="pl-input"
                          value={eqFormData.make_model}
                          onChange={e => setEqFormData(prev => ({ ...prev, make_model: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Serial Number</label>
                        <input
                          type="text"
                          className="pl-input"
                          value={eqFormData.serial_number}
                          onChange={e => setEqFormData(prev => ({ ...prev, serial_number: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Supplier (Vendor)</label>
                        <input
                          type="text"
                          className="pl-input"
                          value={eqFormData.supplier}
                          onChange={e => setEqFormData(prev => ({ ...prev, supplier: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Quantity</label>
                        <input
                          type="number"
                          min="1"
                          className="pl-input"
                          value={eqFormData.quantity}
                          onChange={e => setEqFormData(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Warranty Start Date *</label>
                        <input
                          type="date"
                          required
                          className="pl-input"
                          value={eqFormData.warranty_start_date}
                          onChange={e => setEqFormData(prev => ({ ...prev, warranty_start_date: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Warranty Duration (Months)</label>
                        <input
                          type="number"
                          min="1"
                          className="pl-input"
                          value={eqFormData.warranty_duration_months}
                          onChange={e => setEqFormData(prev => ({ ...prev, warranty_duration_months: parseInt(e.target.value) || 12 }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" onClick={() => setIsEqModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </button>
                    <button type="submit" className="pl-btn pl-btn-primary">
                      Save Equipment
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Snag Modal */}
          {isSnagModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Report Defect / Snag</h3>
                  <button onClick={() => setIsSnagModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleSnagSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Description *</label>
                      <textarea
                        required
                        className="pl-input"
                        value={snagFormData.description}
                        onChange={e => setSnagFormData(prev => ({ ...prev, description: e.target.value }))}
                        style={{ width: '100%', height: '80px', padding: '0.5rem' }}
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Location Area / Zone</label>
                        <input
                          type="text"
                          placeholder="e.g. Server Room B, 2nd Floor"
                          className="pl-input"
                          value={snagFormData.location_area}
                          onChange={e => setSnagFormData(prev => ({ ...prev, location_area: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Severity</label>
                        <select
                          className="pl-input"
                          value={snagFormData.severity}
                          onChange={e => setSnagFormData(prev => ({ ...prev, severity: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Status</label>
                        <select
                          className="pl-input"
                          value={snagFormData.status}
                          onChange={e => setSnagFormData(prev => ({ ...prev, status: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="Open">Open</option>
                          <option value="In Progress">In Progress</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Closed">Closed</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', height: '100%', paddingTop: '1.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={snagFormData.covered_under_warranty}
                            onChange={e => setSnagFormData(prev => ({ ...prev, covered_under_warranty: e.target.checked }))}
                            style={{ width: '16px', height: '16px' }}
                          />
                          Covered Under Warranty
                        </label>
                      </div>
                    </div>

                    {snagFormData.covered_under_warranty && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Link to Equipment *</label>
                        <select
                          required={snagFormData.covered_under_warranty}
                          className="pl-input"
                          value={snagFormData.equipment_id}
                          onChange={e => setSnagFormData(prev => ({ ...prev, equipment_id: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select Linked Equipment</option>
                          {projectEquipment.map((eq: any) => (
                            <option key={eq.id} value={eq.id}>
                              {eq.equipment_name} {eq.serial_number ? `(S/N: ${eq.serial_number})` : ''} - Supplier: {eq.supplier || 'Unknown'}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div>
                      <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Floor Layout Drawing</label>
                      <select
                        className="pl-input"
                        value={snagFormData.drawing_id || ''}
                        onChange={e => setSnagFormData(prev => ({ ...prev, drawing_id: e.target.value, pin_x: null, pin_y: null }))}
                        style={{ width: '100%' }}
                      >
                        <option value="">Select Drawing (Optional)</option>
                        {projectDrawings.map((dw: any) => (
                          <option key={dw.id} value={dw.id}>{dw.name}</option>
                        ))}
                      </select>
                    </div>

                    {snagFormData.drawing_id && (() => {
                      const selectedDrawing = projectDrawings.find((d: any) => d.id === snagFormData.drawing_id);
                      if (!selectedDrawing) return null;
                      return (
                        <div style={{ marginTop: '0.5rem' }}>
                          <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#64748b', marginBottom: '0.25rem' }}>
                            Click on the floor plan below to pin the defect location:
                          </span>
                          <div 
                            onClick={(e) => {
                              const rect = e.currentTarget.getBoundingClientRect();
                              const pin_x = ((e.clientX - rect.left) / rect.width) * 100;
                              const pin_y = ((e.clientY - rect.top) / rect.height) * 100;
                              setSnagFormData(prev => ({ ...prev, pin_x, pin_y }));
                            }}
                            style={{ 
                              position: 'relative', 
                              cursor: 'crosshair', 
                              borderRadius: '6px', 
                              overflow: 'hidden', 
                              border: '1px solid #cbd5e1',
                              maxHeight: '200px',
                              background: '#f1f5f9',
                              display: 'flex',
                              justifyContent: 'center',
                              alignItems: 'center'
                            }}
                          >
                            <img 
                              src={selectedDrawing.file_url} 
                              alt="Floor Plan" 
                              style={{ width: '100%', height: 'auto', maxHeight: '200px', objectFit: 'contain' }} 
                            />
                            {snagFormData.pin_x !== null && snagFormData.pin_y !== null && (
                              <div 
                                style={{
                                  position: 'absolute',
                                  left: `${snagFormData.pin_x}%`,
                                  top: `${snagFormData.pin_y}%`,
                                  width: '12px',
                                  height: '12px',
                                  borderRadius: '50%',
                                  background: '#ef4444',
                                  border: '2px solid #fff',
                                  transform: 'translate(-50%, -50%)',
                                  boxShadow: '0 0 0 4px rgba(239, 68, 68, 0.4)',
                                  pointerEvents: 'none'
                                }}
                              />
                            )}
                          </div>
                          {snagFormData.pin_x !== null && (
                            <span style={{ display: 'block', fontSize: '0.75rem', color: '#10b981', marginTop: '0.25rem' }}>
                              Pin mapped at X: {snagFormData.pin_x.toFixed(1)}%, Y: {snagFormData.pin_y?.toFixed(1)}%
                            </span>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" onClick={() => setIsSnagModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </button>
                    <button type="submit" className="pl-btn pl-btn-primary">
                      Save Snag
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Warranty Claim Modal */}
          {isClaimModalOpen && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>
                    {claimFormData.id ? 'Edit Warranty Claim' : 'Escalate to Warranty Claim'}
                  </h3>
                  <button onClick={() => setIsClaimModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleClaimSubmit} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor / Supplier Name *</label>
                        <input
                          type="text"
                          required
                          className="pl-input"
                          value={claimFormData.vendor_name}
                          onChange={e => setClaimFormData(prev => ({ ...prev, vendor_name: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Claim Reference / RMA Number</label>
                        <input
                          type="text"
                          className="pl-input"
                          placeholder="RMA-12345"
                          value={claimFormData.claim_reference_number}
                          onChange={e => setClaimFormData(prev => ({ ...prev, claim_reference_number: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Status</label>
                        <select
                          className="pl-input"
                          value={claimFormData.status}
                          onChange={e => setClaimFormData(prev => ({ ...prev, status: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="Draft">Draft</option>
                          <option value="Pending Response">Pending Response</option>
                          <option value="Acknowledged">Acknowledged</option>
                          <option value="Accepted">Accepted</option>
                          <option value="Partially Accepted">Partially Accepted</option>
                          <option value="Disputed">Disputed</option>
                          <option value="Resolved">Resolved</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', height: '100%', paddingTop: '1.5rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={claimFormData.parts_covered}
                            onChange={e => setClaimFormData(prev => ({ ...prev, parts_covered: e.target.checked }))}
                            style={{ width: '16px', height: '16px' }}
                          />
                          Parts Covered
                        </label>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.875rem', fontWeight: 500, color: '#334155' }}>
                          <input
                            type="checkbox"
                            checked={claimFormData.labor_covered}
                            onChange={e => setClaimFormData(prev => ({ ...prev, labor_covered: e.target.checked }))}
                            style={{ width: '16px', height: '16px' }}
                          />
                          Labor Covered
                        </label>
                      </div>
                    </div>

                    {claimFormData.status === 'Disputed' && (
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Vendor Dispute Reason</label>
                        <textarea
                          className="pl-input"
                          value={claimFormData.vendor_dispute_reason}
                          onChange={e => setClaimFormData(prev => ({ ...prev, vendor_dispute_reason: e.target.value }))}
                          style={{ width: '100%', height: '60px', padding: '0.5rem' }}
                        />
                      </div>
                    )}

                    {/* Gated Procurement Costs - Visible only to PM / Admin roles */}
                    {['Project Manager', 'Admin'].includes(userRole) && (
                      <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Procurement & Financial details (Gated View)</span>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Claimed Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              className="pl-input"
                              value={claimFormData.vendor_claimed_cost}
                              onChange={e => setClaimFormData(prev => ({ ...prev, vendor_claimed_cost: e.target.value }))}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Approved Cost</label>
                            <input
                              type="number"
                              step="0.01"
                              className="pl-input"
                              value={claimFormData.vendor_approved_cost}
                              onChange={e => setClaimFormData(prev => ({ ...prev, vendor_approved_cost: e.target.value }))}
                              style={{ width: '100%' }}
                            />
                          </div>
                          <div>
                            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, color: '#475569', marginBottom: '0.25rem' }}>Internal Cost Incurred</label>
                            <input
                              type="number"
                              step="0.01"
                              className="pl-input"
                              value={claimFormData.internal_cost_incurred}
                              onChange={e => setClaimFormData(prev => ({ ...prev, internal_cost_incurred: e.target.value }))}
                              style={{ width: '100%' }}
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Resolution Method</label>
                        <select
                          className="pl-input"
                          value={claimFormData.resolution_method}
                          onChange={e => setClaimFormData(prev => ({ ...prev, resolution_method: e.target.value }))}
                          style={{ width: '100%' }}
                        >
                          <option value="N/A">N/A - Not Resolved</option>
                          <option value="Replaced">Replaced</option>
                          <option value="Repaired">Repaired</option>
                          <option value="Credited">Credited</option>
                          <option value="Rejected">Rejected</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#334155', marginBottom: '0.25rem' }}>Resolution Date</label>
                        <input
                          type="date"
                          className="pl-input"
                          value={claimFormData.resolution_date}
                          onChange={e => setClaimFormData(prev => ({ ...prev, resolution_date: e.target.value }))}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" onClick={() => setIsClaimModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </button>
                    <button type="submit" className="pl-btn pl-btn-primary">
                      Save Claim Details
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Continuous Improvement Enrichment Modal */}
          {isInsightModalOpen && selectedInsight && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Enrich & Edit Observation</h3>
                  <button onClick={() => setIsInsightModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={handleEnrichSave} style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  <div style={{ padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Category</label>
                        <select className="pl-input" value={selectedInsight.category} disabled style={{ width: '100%', background: '#f8fafc' }}>
                          <option value={selectedInsight.category}>{selectedInsight.category}</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Title</label>
                        <input className="pl-input" value={selectedInsight.title} disabled style={{ width: '100%', background: '#f8fafc' }} />
                      </div>
                    </div>

                    <div>
                      <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Description</label>
                      <textarea
                        className="pl-input"
                        value={enrichDescription}
                        onChange={e => setEnrichDescription(e.target.value)}
                        placeholder="Detailed explanation of the issue, what happened, or why this best practice works well..."
                        style={{ width: '100%', height: '80px', padding: '0.5rem' }}
                      />
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Root Cause</label>
                        <select
                          className="pl-input"
                          value={enrichRootCause}
                          onChange={e => setEnrichRootCause(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select Root Cause</option>
                          <option value="Human Error">Human Error</option>
                          <option value="Process Gap">Process Gap</option>
                          <option value="Training Gap">Training Gap</option>
                          <option value="Vendor Issue">Vendor Issue</option>
                          <option value="Client Change">Client Change</option>
                          <option value="Design Error">Design Error</option>
                          <option value="Communication Failure">Communication Failure</option>
                          <option value="Material Quality">Material Quality</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Tags (comma-separated)</label>
                        <input
                          type="text"
                          className="pl-input"
                          placeholder="e.g. hvac, vendor-delay, piping"
                          value={enrichTagsText}
                          onChange={e => setEnrichTagsText(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Impact Type</label>
                        <select
                          className="pl-input"
                          value={enrichImpactType}
                          onChange={e => setEnrichImpactType(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Select Impact Type</option>
                          <option value="Cost">Cost</option>
                          <option value="Time">Time</option>
                          <option value="Quality">Quality</option>
                          <option value="Safety">Safety</option>
                          <option value="Customer Satisfaction">Customer Satisfaction</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Impact Level</label>
                        <select
                          className="pl-input"
                          value={enrichImpactLevel}
                          onChange={e => setEnrichImpactLevel(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="Low">Low</option>
                          <option value="Medium">Medium</option>
                          <option value="High">High</option>
                          <option value="Critical">Critical</option>
                        </select>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>
                          {selectedInsight.category === 'Cost Saving Idea' ? 'Estimated Savings (₹)' : 'Estimated Loss (₹)'}
                        </label>
                        <input
                          type="number"
                          className="pl-input"
                          value={enrichLossAmount || ''}
                          onChange={e => setEnrichLossAmount(parseFloat(e.target.value) || 0)}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Estimated Delay (Days)</label>
                        <input
                          type="number"
                          className="pl-input"
                          value={enrichDelayDays || ''}
                          onChange={e => setEnrichDelayDays(parseInt(e.target.value) || 0)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Visibility Level</label>
                        <select
                          className="pl-input"
                          value={enrichVisibility}
                          onChange={e => setEnrichVisibility(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="Everyone">Everyone</option>
                          <option value="Project Team">Project Team</option>
                          <option value="Managers">Managers Only</option>
                          <option value="Leadership">Leadership Only</option>
                        </select>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center', paddingTop: '0.25rem' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600, color: '#475569' }}>
                          <input
                            type="checkbox"
                            checked={enrichIsRepeat}
                            onChange={e => setEnrichIsRepeat(e.target.checked)}
                            style={{ width: '16px', height: '16px' }}
                          />
                          Flag as Repeat Issue
                        </label>
                        {enrichIsRepeat && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Times Repeated:</span>
                            <input
                              type="number"
                              min="1"
                              className="pl-input"
                              value={enrichRepeatCount}
                              onChange={e => setEnrichRepeatCount(parseInt(e.target.value) || 1)}
                              style={{ width: '60px', padding: '0.25rem', fontSize: '0.75rem' }}
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Assigned Action Owner</label>
                        <select
                          className="pl-input"
                          value={enrichAssignedTo}
                          onChange={e => setEnrichAssignedTo(e.target.value)}
                          style={{ width: '100%' }}
                        >
                          <option value="">Unassigned</option>
                          {teamMembers.map((m: any) => (
                            <option key={m.user_id} value={m.user_id}>{m.full_name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: '#475569', marginBottom: '0.25rem' }}>Target Date</label>
                        <input
                          type="date"
                          className="pl-input"
                          value={enrichTargetDate}
                          onChange={e => setEnrichTargetDate(e.target.value)}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>

                  </div>
                  <div style={{ padding: '1rem 1.5rem', borderTop: '1px solid #e2e8f0', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', borderBottomLeftRadius: '12px', borderBottomRightRadius: '12px' }}>
                    <button type="button" onClick={() => setIsInsightModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </button>
                    <button type="submit" className="pl-btn pl-btn-primary">
                      Save Enrichments
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Project Milestones Section */}
          <div id="project-milestones-section" className="pl-card" style={{ padding: '1.25rem 1.5rem', marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflow: 'visible' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className="pl-summary-title" style={{ margin: 0 }}>Project Milestones</h3>
              <div style={{ display: 'flex', gap: '0.5rem', position: 'relative' }}>
                <button
                  className="pl-btn pl-btn-primary"
                  onClick={() => {
                    setEditingMilestone(null);
                    setMilestoneForm({
                      name: '',
                      milestone_date: '',
                      type: 'inspection',
                      notes: ''
                    });
                    setIsMilestonePopoverOpen(true);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  <Plus size={14} /> Add Milestone
                </button>
                
                {/* Milestone Form Popover */}
                {isMilestonePopoverOpen && (
                  <div 
                    className="dropdown-container"
                    style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '0.5rem',
                      width: '320px',
                      background: 'white',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)',
                      zIndex: 50,
                      padding: '1rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.75rem',
                      textAlign: 'left'
                    }}
                  >
                    <div style={{ fontWeight: 600, fontSize: '13px', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.5rem' }}>
                      {editingMilestone ? 'Edit Milestone' : 'Add New Milestone'}
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Name *</label>
                      <input 
                        type="text"
                        className="pl-input"
                        placeholder="e.g. Equipment Commissioning"
                        value={milestoneForm.name}
                        onChange={e => setMilestoneForm(prev => ({ ...prev, name: e.target.value }))}
                        required
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Date *</label>
                      <input 
                        type="date"
                        className="pl-input"
                        value={milestoneForm.milestone_date}
                        onChange={e => setMilestoneForm(prev => ({ ...prev, milestone_date: e.target.value }))}
                        required
                        style={{ width: '100%', fontSize: '12px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Type *</label>
                      <select 
                        className="pl-input"
                        value={milestoneForm.type}
                        onChange={e => setMilestoneForm(prev => ({ ...prev, type: e.target.value as any }))}
                        required
                        style={{ width: '100%', fontSize: '12px' }}
                      >
                        <option value="equipment_testing">Equipment Testing</option>
                        <option value="inspection">Inspection</option>
                        <option value="handover">Handover</option>
                        <option value="other">Other</option>
                      </select>
                    </div>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Notes (Optional)</label>
                      <textarea 
                        className="pl-input"
                        placeholder="Additional details..."
                        value={milestoneForm.notes}
                        onChange={e => setMilestoneForm(prev => ({ ...prev, notes: e.target.value }))}
                        style={{ width: '100%', height: '60px', padding: '0.25rem', fontSize: '12px' }}
                      />
                    </div>
                    
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.5rem' }}>
                      <button 
                        type="button" 
                        className="pl-btn"
                        onClick={() => setIsMilestonePopoverOpen(false)}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '12px', background: '#fff', border: '1px solid #d1d5db' }}
                      >
                        Cancel
                      </button>
                      <button 
                        type="button" 
                        className="pl-btn pl-btn-primary"
                        onClick={async () => {
                          if (!milestoneForm.name || !milestoneForm.milestone_date || !selectedProject?.id) return;
                          try {
                            if (editingMilestone) {
                              await updateMilestoneMutation.mutateAsync({
                                id: editingMilestone.id,
                                project_id: selectedProject.id,
                                name: milestoneForm.name,
                                milestone_date: milestoneForm.milestone_date,
                                type: milestoneForm.type,
                                notes: milestoneForm.notes || null,
                              });
                            } else {
                              await createMilestoneMutation.mutateAsync({
                                project_id: selectedProject.id,
                                name: milestoneForm.name,
                                milestone_date: milestoneForm.milestone_date,
                                type: milestoneForm.type,
                                notes: milestoneForm.notes || null,
                                is_completed: false
                              });
                            }
                            setIsMilestonePopoverOpen(false);
                            setEditingMilestone(null);
                            setMilestoneForm({
                              name: '',
                              milestone_date: '',
                              type: 'inspection',
                              notes: ''
                            });
                          } catch (err: any) {
                            alert(err.message || 'Failed to save milestone');
                          }
                        }}
                        disabled={createMilestoneMutation.isPending || updateMilestoneMutation.isPending || !milestoneForm.name || !milestoneForm.milestone_date}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '12px' }}
                      >
                        Save
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline Strip (Hidden on mobile / screens < 768px) */}
            {milestones.length > 0 && (
              <div className="hidden md:block" style={{ overflowX: 'auto', padding: '1.5rem 0.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <div style={{ minWidth: '800px', position: 'relative', height: '100px', margin: '0 2rem' }}>
                  {/* Timeline Horizontal Line */}
                  <div style={{ position: 'absolute', top: '50px', left: 0, right: 0, height: '4px', background: '#cbd5e1', borderRadius: '2px' }} />
                  
                  {/* Milestones Dots */}
                  {(() => {
                    const start = selectedProject.start_date ? new Date(selectedProject.start_date).getTime() : new Date().getTime();
                    let end = selectedProject.expected_end_date ? new Date(selectedProject.expected_end_date).getTime() : new Date().getTime();
                    
                    // Calibrate end date to include furthest milestone
                    milestones.forEach((m: any) => {
                      const mTime = new Date(m.milestone_date).getTime();
                      if (mTime > end) end = mTime;
                    });
                    
                    const duration = end - start || 1;

                    // Stacking calculations
                    const stackedMilestones = milestones.map((m: any) => {
                      const time = new Date(m.milestone_date).getTime();
                      const pct = Math.max(0, Math.min(100, ((time - start) / duration) * 100));
                      return { ...m, pct };
                    });

                    // Stack dots if within 5% of each other
                    const verticalLevels: number[] = [];
                    stackedMilestones.forEach((m: any, i: number) => {
                      let level = 0;
                      for (let j = 0; j < i; j++) {
                        const prev = stackedMilestones[j];
                        if (Math.abs(m.pct - prev.pct) < 5 && verticalLevels[j] === level) {
                          level++;
                        }
                      }
                      verticalLevels.push(level);
                    });

                    return stackedMilestones.map((m: any, index: number) => {
                      const level = verticalLevels[index];
                      const isCompleted = m.is_completed;
                      const isOverdue = !isCompleted && new Date(m.milestone_date) < new Date();
                      
                      const timeDiff = new Date(m.milestone_date).getTime() - new Date().getTime();
                      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                      const isAtRisk = !isCompleted && daysDiff >= 0 && daysDiff <= 7;

                      let dotColor = '#94a3b8'; // Grey (Upcoming)
                      if (isCompleted) dotColor = '#10b981'; // Green
                      else if (isOverdue) dotColor = '#ef4444'; // Red
                      else if (isAtRisk) dotColor = '#f59e0b'; // Amber

                      return (
                        <div 
                          key={m.id}
                          style={{
                            position: 'absolute',
                            left: `${m.pct}%`,
                            top: `${50 - (level * 20)}px`,
                            transform: 'translate(-50%, -50%)',
                            zIndex: 10
                          }}
                        >
                          {/* 44px Tappable target overlay */}
                          <div 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedMilestoneForDetails(m);
                            }}
                            style={{
                              width: '44px',
                              height: '44px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                              borderRadius: '50%',
                              background: 'transparent'
                            }}
                          >
                            <div 
                              style={{
                                width: '12px',
                                height: '12px',
                                borderRadius: '50%',
                                background: dotColor,
                                border: '2px solid #fff',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
                              }}
                            />
                          </div>

                          {/* Hover/Small label */}
                          <div style={{
                            position: 'absolute',
                            top: '32px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            whiteSpace: 'nowrap',
                            fontSize: '9px',
                            fontWeight: 600,
                            color: '#64748b',
                            pointerEvents: 'none'
                          }}>
                            {fmtD(m.milestone_date)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Timeline Dot Details Popover */}
            {selectedMilestoneForDetails && (
              <div 
                className="dropdown-container"
                style={{
                  padding: '1rem',
                  background: '#f8fafc',
                  border: '1px solid #cbd5e1',
                  borderRadius: '8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  fontSize: '12px'
                }}
              >
                <div style={{ display: 'flex', justifyContext: 'space-between', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#1e293b' }}>
                    {selectedMilestoneForDetails.name}
                  </div>
                  <button 
                    onClick={() => setSelectedMilestoneForDetails(null)}
                    style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '0.75rem', color: '#475569' }}>
                  <span><strong>Date:</strong> {fmtD(selectedMilestoneForDetails.milestone_date)}</span>
                  <span><strong>Type:</strong> <span style={{ textTransform: 'capitalize' }}>{selectedMilestoneForDetails.type.replace('_', ' ')}</span></span>
                </div>
                {selectedMilestoneForDetails.notes && (
                  <div style={{ color: '#64748b', fontStyle: 'italic', background: '#fff', padding: '0.5rem', borderRadius: '4px', border: '1px solid #e2e8f0' }}>
                    {selectedMilestoneForDetails.notes}
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem' }}>
                  <span style={{ fontWeight: 600 }}>
                    {(() => {
                      const isCompleted = selectedMilestoneForDetails.is_completed;
                      const timeDiff = new Date(selectedMilestoneForDetails.milestone_date).getTime() - new Date().getTime();
                      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                      if (isCompleted) return <span style={{ color: '#10b981' }}>Completed</span>;
                      if (daysDiff < 0) return <span style={{ color: '#ef4444' }}>Overdue by {Math.abs(daysDiff)} days</span>;
                      if (daysDiff <= 7) return <span style={{ color: '#f59e0b' }}>At Risk ({daysDiff} days left)</span>;
                      return <span style={{ color: '#64748b' }}>{daysDiff} days left</span>;
                    })()}
                  </span>
                  
                  {!selectedMilestoneForDetails.is_completed && (
                    <button
                      className="pl-btn pl-btn-primary"
                      onClick={() => {
                        updateMilestoneMutation.mutate({
                          id: selectedMilestoneForDetails.id,
                          project_id: selectedMilestoneForDetails.project_id,
                          is_completed: true
                        });
                        setSelectedMilestoneForDetails(null);
                      }}
                      style={{ padding: '2px 8px', fontSize: '11px' }}
                    >
                      Mark Complete
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Table View */}
            <div style={{ marginTop: '0.5rem' }}>
              {milestones.length === 0 ? (
                <div style={{ padding: '1rem', border: '1px dashed #cbd5e1', borderRadius: '6px', textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
                  No milestones found
                </div>
              ) : (
                <table className="pl-table" style={{ width: '100%', fontSize: '12px' }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Name</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Type</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Date</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Remaining</th>
                      <th style={{ textAlign: 'left', padding: '0.5rem' }}>Status</th>
                      <th style={{ textAlign: 'right', padding: '0.5rem' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {milestones.map((m: any) => {
                      const isCompleted = m.is_completed;
                      const timeDiff = new Date(m.milestone_date).getTime() - new Date().getTime();
                      const daysDiff = Math.ceil(timeDiff / (1000 * 3600 * 24));
                      const isOverdue = !isCompleted && daysDiff < 0;
                      const isAtRisk = !isCompleted && daysDiff >= 0 && daysDiff <= 7;

                      let statusLabel = 'Upcoming';
                      let statusBg = '#f1f5f9';
                      let statusText = '#475569';
                      
                      if (isCompleted) {
                        statusLabel = 'Completed';
                        statusBg = '#dcfce7';
                        statusText = '#15803d';
                      } else if (isOverdue) {
                        statusLabel = 'Overdue';
                        statusBg = '#fee2e2';
                        statusText = '#b91c1c';
                      } else if (isAtRisk) {
                        statusLabel = 'At Risk';
                        statusBg = '#fef3c7';
                        statusText = '#b45309';
                      }

                      return (
                        <tr key={m.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '0.5rem', fontWeight: 500 }}>{m.name}</td>
                          <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>
                            {m.type.replace('_', ' ')}
                          </td>
                          <td style={{ padding: '0.5rem' }}>{fmtD(m.milestone_date)}</td>
                          <td style={{ padding: '0.5rem' }}>
                            {isCompleted ? '-' : isOverdue ? `${Math.abs(daysDiff)}d overdue` : `${daysDiff}d left`}
                          </td>
                          <td style={{ padding: '0.5rem' }}>
                            <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', fontSize: '10px', fontWeight: 600, background: statusBg, color: statusText }}>
                              {statusLabel}
                            </span>
                          </td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.375rem' }}>
                              {!isCompleted && (
                                <button
                                  className="pl-btn pl-btn-primary"
                                  onClick={() => {
                                    updateMilestoneMutation.mutate({
                                      id: m.id,
                                      project_id: m.project_id,
                                      is_completed: true
                                    });
                                  }}
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                >
                                  Mark Complete
                                </button>
                              )}
                              <button
                                className="pl-btn"
                                onClick={() => {
                                  setEditingMilestone(m);
                                  setMilestoneForm({
                                    name: m.name,
                                    milestone_date: m.milestone_date,
                                    type: m.type,
                                    notes: m.notes || ''
                                  });
                                  setIsMilestonePopoverOpen(true);
                                }}
                                style={{ padding: '2px 8px', fontSize: '11px', background: '#fff', border: '1px solid #cbd5e1' }}
                              >
                                Edit
                              </button>
                              <button
                                className="pl-btn"
                                onClick={() => setMilestoneToDelete(m)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '2px',
                                  padding: '2px 8px',
                                  fontSize: '11px',
                                  background: '#fff',
                                  color: '#000000',
                                  border: '1px solid #cbd5e1'
                                }}
                              >
                                <Trash2 size={11} /> Delete
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
          
          {/* Delete Milestone Confirmation Modal */}
          {milestoneToDelete && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(0, 0, 0, 0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '100%', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
                  <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#fff1f2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trash2 size={20} style={{ color: '#e11d48' }} />
                  </div>
                  <h4 style={{ fontSize: '15px', fontWeight: 600, color: '#18181b', margin: 0 }}>Delete Milestone</h4>
                </div>
                <div style={{ fontSize: '13px', color: '#71717a', lineHeight: '18px', marginBottom: '20px' }}>
                  Are you sure you want to delete the milestone "{milestoneToDelete.name}"? This action will unlink any tasks connected to it and cannot be undone.
                </div>
                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button 
                    onClick={() => setMilestoneToDelete(null)} 
                    className="pl-btn"
                    style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#6b7280', height: '36px', padding: '0 16px', borderRadius: '8px' }}
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={async () => {
                      if (milestoneToDelete) {
                        await deleteMilestoneMutation.mutateAsync({ id: milestoneToDelete.id, project_id: milestoneToDelete.project_id });
                        setMilestoneToDelete(null);
                      }
                    }} 
                    className="pl-btn"
                    disabled={deleteMilestoneMutation.isPending}
                    style={{ background: '#e11d48', border: 'none', color: '#fff', height: '36px', padding: '0 16px', borderRadius: '8px', fontWeight: 600 }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
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
                            <div className="flex items-center gap-2 flex-wrap">
                              {p.project_code && (
                                <span className="text-[11px] font-mono text-zinc-400">{p.project_code}</span>
                              )}
                              {showWarning && (
                                <span className="inline-flex items-center px-1.5 py-0.5 bg-red-50 text-red-600 rounded text-[10px] font-semibold uppercase tracking-wider">
                                  ⚠ PO Required
                                </span>
                              )}
                              {atRiskMilestoneCounts[p.id] > 0 && (
                                <span 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    loadProjectDetails(p, true);
                                  }}
                                  className="inline-flex items-center px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-semibold uppercase tracking-wider hover:bg-amber-100 transition-colors cursor-pointer"
                                  title="Click to view at risk milestones"
                                >
                                  ⚠ {atRiskMilestoneCounts[p.id]} {atRiskMilestoneCounts[p.id] === 1 ? 'Milestone' : 'Milestones'} At Risk
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

// ─── Subcontractor Work Orders Tab for Project Detail ─────────────────────────
import { ProjectSubcontractorWorkOrders } from '../components/projects/ProjectSubcontractorWorkOrders';
import { KanbanCard } from '../components/projects/KanbanCard';
