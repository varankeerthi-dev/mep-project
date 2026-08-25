import { useState, useMemo, useRef, useEffect } from 'react';
import { supabase } from '../../supabase';
import { formatCurrency } from '../../utils/formatters';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, ChevronRight, ArrowLeft, Edit, Trash2, Folder,
  TrendingUp, Clock, DollarSign, MoreHorizontal, X,
  ChevronDown, ChevronUp, Link2, AlertTriangle, FilePlus2, FileText,
  Download, Calendar, Archive
} from 'lucide-react';
import ProjectTaskListView from '../../components/tasks/ProjectTaskListView';
import CreateProjectInvoiceModal from '../../components/CreateProjectInvoiceModal';
import { 
  useProjectMilestones, 
  useCreateMilestone, 
  useUpdateMilestone, 
  useDeleteMilestone, 
  ProjectMilestone 
} from '../../hooks/useMilestones';
import {
  useProjectTransactions,
  buildProjectTransactionSummary,
  type ProjectInvoice,
} from '../../hooks/useProjectTransactions';
import { useAuth } from '../../App';
import { PermissionGuard, useHasPermission } from '../../rbac';
import { SiteExpenses } from '../../pages/SiteExpenses';
import { ScopeEditor } from '../../components/projects/ScopeEditor';
import { ClosureChecklistPanel } from '../../components/projects/ClosureChecklistPanel';
import { Project, ProjectDetails } from '../types';
import {
  STATUS_CONFIG,
  PO_STATUS_CONFIG,
  STATUS_FILTER_OPTIONS,
  PROJECT_STATUS_STATS,
  MANDATORY_COLUMNS,
  ALL_COLUMNS,
} from '../constants';
import { fmt, fmtD } from '../utils';
import { useProjects, useProjectStats } from '../hooks/useProjects';
import { useProjectDetails } from '../hooks/useProjectDetails';
import { calculateFinancialSummary } from '../calculators/transactionCalculator';
import { calculateEquipmentStats } from '../calculators/equipmentCalculator';
import { TransactionsTab } from '../features/transactions/TransactionsTab';
import { EquipmentTab } from '../features/equipment/EquipmentTab';
import { SnagsTab } from '../features/snags/SnagsTab';
import { ContinuousImprovementTab } from '../features/improvement/ContinuousImprovementTab';
import { SummaryTab } from '../features/summary/SummaryTab';
import { AddEquipmentModal } from '../features/equipment/AddEquipmentModal';
import { ReportSnagModal } from '../features/snags/ReportSnagModal';
import { WarrantyClaimModal } from '../features/snags/WarrantyClaimModal';
import { TabErrorBoundary } from '../../components/projects/TabErrorBoundary';
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

  const [selectedTcCert, setSelectedTcCert] = useState<any | null>(null);
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

  // 1. Projects List Query with server-side pagination & filtering (Phase 4.5)
  const { data: projectsData, isLoading } = useProjects({
    organisationId: organisation?.id || '',
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm,
    status: statusFilter,
  });
  const projects = projectsData?.data ?? [];
  const totalCount = projectsData?.count ?? 0;

  // 2. Lightweight project status stats
  const { data: projectStats = {} } = useProjectStats(organisation?.id || '');

  // 3. Orchestrated project details loader (Phase 4.5)
  const {
    transactionsQuery,
    equipmentQuery,
    snagsQuery,
    warrantyClaimsQuery,
    insightsQuery,
    drawingsQuery,
    materialsQuery,
    jointMeasurementsQuery,
    tcProtocolsQuery,
  } = useProjectDetails(
    selectedProject?.id,
    activeTab,
    activeTransactionTab,
    organisation?.id
  );

  const projectDetails = transactionsQuery.data;
  const detailsLoading = transactionsQuery.isLoading;

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

  const projectEquipment = equipmentQuery.data ?? [];
  const refetchEquipment = equipmentQuery.refetch;

  const projectSnags = snagsQuery.data ?? [];
  const refetchSnags = snagsQuery.refetch;

  const warrantyClaims = warrantyClaimsQuery.data ?? [];
  const refetchClaims = warrantyClaimsQuery.refetch;

  const projectInsights = insightsQuery.data ?? [];
  const refetchInsights = insightsQuery.refetch;
  const insightsLoading = insightsQuery.isLoading;

  const { data: teamMembers = [] } = useQuery({
    queryKey: ['org-members', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('employees')
        .select('id, name')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return (data || []).map((emp: any) => ({
        user_id: emp.id,
        full_name: emp.name
      }));
    },
    enabled: !!organisation?.id && viewMode === 'detail',
  });

  const projectDrawings = drawingsQuery.data ?? [];
  const refetchDrawings = drawingsQuery.refetch;

  const projectMaterials = materialsQuery.data ?? [];
  const projectJointMeasurements = jointMeasurementsQuery.data ?? [];
  const projectTcProtocols = tcProtocolsQuery.data ?? [];


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
    return calculateFinancialSummary({
      pos: projectPOs,
      invoices: projectInvoices,
      payments: projectPayments,
      expenses: projectExpenses,
    });
  }, [projectDetails, projectPOs, projectInvoices, projectPayments, projectExpenses]);

  // ─── Stats ──────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    return {
      All: projectStats.All || 0,
      Active: projectStats.Active || 0,
      Draft: projectStats.Draft || 0,
      Closed: projectStats.Closed || 0,
    };
  }, [projectStats]);

  const equipmentStats = useMemo(() => {
    return calculateEquipmentStats(projectEquipment);
  }, [projectEquipment]);


  // ─── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / itemsPerPage));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalCount);
  const currentItems = projects;

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



  // ═══════════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (isLoading) return <PageSkeleton variant="list" rows={8} />;



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
            <Button variant="default" size="icon-xs" onClick={() => { setViewMode('list'); setSelectedProject(null); }}>
              <ArrowLeft size={18} />
            </Button>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
              <h1 className="pl-detail-title" style={{ fontSize: '18px', margin: 0 }}>{selectedProject.project_name}</h1>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8125rem' }}>{selectedProject.project_code}</span>
            </div>
            <div style={{ display: 'flex', gap: '0.25rem', alignItems: 'center' }}>
              {tabs.map(tab => (
                <Button variant="default" size="sm" key={tab.id} className={`pl-tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}
                  style={{ padding: '0.375rem 0.75rem', fontSize: '0.8125rem' }}
                >
                  {tab.label}
                </Button>
              ))}
            </div>
            <PermissionGuard permission="projects.update">
              <Button variant="default" size="sm" onClick={() => navigate(`/projects/${selectedProject.id}/edit`)}>
                <Edit size={14} />
                Edit
              </Button>
            </PermissionGuard>
            {selectedProject.status === 'Archived' ? (
              <PermissionGuard permission="projects.archive">
                <Button variant="default" size="sm" onClick={async () => {
                    if (!confirm('Unarchive this project? It will reappear in active views.')) return;
                    const { error } = await supabase.from('projects').update({ status: 'Active' }).eq('id', selectedProject.id);
                    if (error) { alert('Error unarchiving: ' + error.message); return; }
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                    setSelectedProject(null);
                    setViewMode('list');
                  }}
                >
                  Unarchive
                </Button>
              </PermissionGuard>
            ) : selectedProject.status !== 'Closed' ? (
              <PermissionGuard permission="projects.archive">
                <Button variant="default" size="sm" onClick={async () => {
                    if (!confirm('Archive this project? It will be hidden from active views.')) return;
                    const { error } = await supabase.from('projects').update({ status: 'Archived' }).eq('id', selectedProject.id);
                    if (error) { alert('Error archiving: ' + error.message); return; }
                    queryClient.invalidateQueries({ queryKey: ['projects'] });
                    setSelectedProject(null);
                    setViewMode('list');
                  }}
                >
                  Archive
                </Button>
              </PermissionGuard>
            ) : null}
          </div>

          <TabErrorBoundary tabName="Project Details">
          {activeTab === 'summary' && (
            <SummaryTab
              selectedProject={selectedProject}
              organisation={organisation}
              financialSummary={financialSummary}
              navigate={navigate}
              fmt={fmt}
              fmtD={fmtD}
              formatCurrency={formatCurrency}
            />
          )}

          {activeTab === 'transactions' && (
            <TransactionsTab
              selectedProject={selectedProject}
              activeTransactionTab={activeTransactionTab}
              setActiveTransactionTab={setActiveTransactionTab}
              projectPOs={projectPOs}
              projectInvoices={projectInvoices}
              projectExpenses={projectExpenses}
              projectPayments={projectPayments}
              projectMaterials={projectMaterials}
              projectJointMeasurements={projectJointMeasurements}
              financialSummary={financialSummary}
              linkedSummary={linkedSummary}
              linkedLoading={linkedLoading}
              linkedData={linkedData}
              setInvoiceModal={setInvoiceModal}
              navigate={navigate}
              fmt={fmt}
              fmtD={fmtD}
            />
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
                      <th style={{ textAlign: 'left' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {projectExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td style={{ color: 'var(--text-secondary)' }}>{fmtD(exp.expense_date)}</td>
                        <td style={{ fontWeight: 500 }}>{exp.expense_type}</td>
                        <td style={{ color: 'var(--text-secondary)' }}>{exp.description || '-'}</td>
                        <td style={{ fontFamily: 'JetBrains Mono, monospace', fontWeight: 500, color: 'var(--danger)', textAlign: 'left' }}>{fmt(exp.amount)}</td>
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

          {activeTab === 'subcontractors' && (
            <ProjectSubcontractorWorkOrders
              projectId={selectedProject.id}
              fmt={fmt}
              fmtD={fmtD}
              navigate={navigate}
            />
          )}

          {activeTab === 'equipment' && (
            <EquipmentTab
              selectedProject={selectedProject}
              projectEquipment={projectEquipment}
              projectTcProtocols={projectTcProtocols}
              equipmentStats={equipmentStats}
              setEqFormData={setEqFormData}
              setIsEqModalOpen={setIsEqModalOpen}
              setSelectedTcCert={setSelectedTcCert}
              fmtD={fmtD}
            />
          )}

          {activeTab === 'snags' && (
            <SnagsTab
              selectedProject={selectedProject}
              organisation={organisation}
              projectSnags={projectSnags}
              projectEquipment={projectEquipment}
              projectDrawings={projectDrawings}
              warrantyClaims={warrantyClaims}
              userRole={userRole}
              setSnagFormData={setSnagFormData}
              setIsSnagModalOpen={setIsSnagModalOpen}
              setClaimFormData={setClaimFormData}
              setIsClaimModalOpen={setIsClaimModalOpen}
              refetchDrawings={refetchDrawings}
              refetchClaims={refetchClaims}
              fmt={fmt}
              fmtD={fmtD}
            />
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


          {/* T&C Commissioning Certificate Modal */}
          {selectedTcCert && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100000, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '550px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', borderTopLeftRadius: '12px', borderTopRightRadius: '12px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#0f172a' }}>Testing & Commissioning Certificate</h3>
                    <span style={{ fontSize: '0.75rem', color: '#64748b' }}>Protocol Record & Witness Statement</span>
                  </div>
                  <Button variant="default" size="sm" onClick={() => setSelectedTcCert(null)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </Button>
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
                  <Button variant="default" size="sm" onClick={() => setSelectedTcCert(null)} className="pl-btn pl-btn-primary">
                    Close Certificate
                  </Button>
                </div>
              </div>
            </div>
          )}



          {/* Equipment Modal */}
          {activeTab === 'continuous-improvement' && (
            <ContinuousImprovementTab
              selectedProject={selectedProject}
              organisation={organisation}
              projectInsights={projectInsights}
              teamMembers={teamMembers}
              userRole={userRole}
              user={user}
              refetchInsights={refetchInsights}
              openEnrichmentModal={openEnrichmentModal}
              handleUpdateInsightStatus={handleUpdateInsightStatus}
              formatCurrency={formatCurrency}
            />
          )}

          </TabErrorBoundary>

          <AddEquipmentModal
            isOpen={isEqModalOpen}
            onClose={() => setIsEqModalOpen(false)}
            projectId={selectedProject?.id || ''}
            organisationId={organisation?.id || ''}
            refetchEquipment={refetchEquipment}
          />


          <ReportSnagModal
            isOpen={isSnagModalOpen}
            onClose={() => setIsSnagModalOpen(false)}
            projectId={selectedProject?.id || ''}
            organisationId={organisation?.id || ''}
            projectEquipment={projectEquipment}
            projectDrawings={projectDrawings}
            refetchSnags={refetchSnags}
          />


          <WarrantyClaimModal
            isOpen={isClaimModalOpen}
            onClose={() => setIsClaimModalOpen(false)}
            organisationId={organisation?.id || ''}
            projectEquipment={projectEquipment}
            userRole={userRole}
            refetchClaims={refetchClaims}
            initialData={claimFormData.id || claimFormData.vendor_name ? claimFormData : undefined}
          />


          {/* Continuous Improvement Enrichment Modal */}
          {isInsightModalOpen && selectedInsight && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(15, 23, 42, 0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
              <div style={{ background: '#fff', borderRadius: '12px', width: '100%', maxWidth: '600px', display: 'flex', flexDirection: 'column', maxHeight: '90vh', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0' }}>
                <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: '#1e293b' }}>Enrich & Edit Observation</h3>
                  <Button variant="default" size="sm" onClick={() => setIsInsightModalOpen(false)} style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}>
                    <X size={20} />
                  </Button>
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
                    <Button variant="default" size="sm" type="button" onClick={() => setIsInsightModalOpen(false)} className="pl-btn" style={{ background: '#fff', border: '1px solid #cbd5e1' }}>
                      Cancel
                    </Button>
                    <Button variant="default" size="sm" type="submit">
                      Save Enrichments
                    </Button>
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
                <Button variant="default" size="sm" onClick={() => {
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
                </Button>
                
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
                      <Button variant="default" size="sm" type="button" onClick={() => setIsMilestonePopoverOpen(false)}
                        style={{ padding: '0.25rem 0.75rem', fontSize: '12px', background: '#fff', border: '1px solid #d1d5db' }}
                      >
                        Cancel
                      </Button>
                      <Button variant="default" size="sm" type="button" onClick={async () => {
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
                      </Button>
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
                  <Button variant="default" size="sm" onClick={() => setSelectedMilestoneForDetails(null)}
                    style={{ border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' }}
                  >
                    <X size={14} />
                  </Button>
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
                    <Button variant="default" size="sm" onClick={() => {
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
                    </Button>
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
                                <Button variant="default" size="sm" onClick={() => {
                                    updateMilestoneMutation.mutate({
                                      id: m.id,
                                      project_id: m.project_id,
                                      is_completed: true
                                    });
                                  }}
                                  style={{ padding: '2px 8px', fontSize: '11px' }}
                                >
                                  Mark Complete
                                </Button>
                              )}
                              <Button variant="default" size="sm" onClick={() => {
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
                              </Button>
                              <Button variant="default" size="sm" onClick={() => setMilestoneToDelete(m)}
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
                              </Button>
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
                  <Button variant="default" size="sm" onClick={() => setMilestoneToDelete(null)} 
                    className="pl-btn"
                    style={{ background: '#fff', border: '1px solid #cbd5e1', color: '#6b7280', height: '36px', padding: '0 16px', borderRadius: '8px' }}
                  >
                    Cancel
                  </Button>
                  <Button variant="default" size="sm" onClick={async () => {
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
                  </Button>
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
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          {STATUS_FILTER_OPTIONS.map((status) => (
            <button
              key={status}
              onClick={() => { setStatusFilter(status); setCurrentPage(1); }}
              className={`px-3.5 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                statusFilter === status
                  ? 'bg-blue-50 text-blue-600 font-semibold shadow-xs'
                  : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100'
              }`}
            >
              {status === 'All' ? 'All Projects' : status}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-[10px]">
          <PermissionGuard permission="projects.create">
            <button
              onClick={() => navigate('/projects/new')}
              className="inline-flex items-center justify-center text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 shadow-sm transition-colors active:scale-[0.98]"
              style={{ paddingTop: '8px', paddingBottom: '8px', paddingLeft: '10px', paddingRight: '10px' }}
            >
              New Project
            </button>
          </PermissionGuard>
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
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
                  Est. Value
                </th>
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight bg-white border-b border-zinc-200 w-[130px]">
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
                <th className="sticky top-0 z-10 h-[36px] px-6 pl-1 align-middle text-left text-[13px] font-semibold text-zinc-700 tracking-tight w-[70px] bg-white border-b border-zinc-200">
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
                        <td className="pl-4 py-3 align-middle border-t border-zinc-200/70">
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
                        <td className="px-6 py-3 align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                          <div className="max-w-[200px] truncate" title={p.client?.client_name || '-'}>
                            {p.client?.client_name || '-'}
                          </div>
                        </td>
                        {/* Type */}
                        <td className="px-6 py-3 align-middle text-sm text-zinc-800 border-t border-zinc-200/70">
                          {p.project_type || '-'}
                        </td>
                        {/* Est. Value */}
                        <td className="px-6 py-3 align-middle text-sm font-mono font-medium text-zinc-900 text-left border-t border-zinc-200/70">
                          {p.project_estimated_value ? fmt(p.project_estimated_value) : '-'}
                        </td>
                        {/* PO Value */}
                        <td className="px-6 py-3 align-middle text-sm font-mono font-medium text-zinc-900 text-left border-t border-zinc-200/70">
                          {p.pos && p.pos.length > 0 ? fmt(p.pos.reduce((sum, po) => sum + (po.po_total_value || 0), 0)) : '-'}
                        </td>
                        {/* PO Status */}
                        <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                            <span className="w-2 h-2 rounded-full" style={{ background: poStatusCfg.dot }} />
                            {poStatusCfg.label}
                          </span>
                        </td>
                        {/* Status */}
                        <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-600">
                            <span className="w-2 h-2 rounded-full" style={{ background: statusCfg.dot }} />
                            {statusCfg.label}
                          </span>
                        </td>
                        {/* Completion */}
                        <td className="px-6 py-3 align-middle border-t border-zinc-200/70">
                          <div className="flex items-center gap-2.5">
                            <div className="flex-1 h-1.5 bg-zinc-100 rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full bg-blue-500 transition-all duration-500"
                                style={{ width: `${p.completion_percentage || 0}%` }}
                              />
                            </div>
                            <span className="text-xs font-medium text-zinc-500 font-mono min-w-[36px] text-left">
                              {p.completion_percentage || 0}%
                            </span>
                          </div>
                        </td>
                        {/* Actions */}
                        <td className="px-5 pl-1 py-3 align-middle text-left border-t border-zinc-200/70">
                          <div className="relative inline-block" ref={openMenuId === p.id ? menuRef : null}>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenMenuId(openMenuId === p.id ? null : p.id);
                              }}
                              className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-zinc-100 transition-colors text-zinc-500 hover:text-zinc-800"
                            >
                              <MoreHorizontal className="w-4 h-4" />
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
                              <PermissionGuard permission="projects.update">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenMenuId(null);
                                    navigate(`/projects/${p.id}/edit`);
                                  }}
                                  className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-indigo-50 hover:text-indigo-700 active:scale-[0.98]"
                                  style={{ padding: '6px' }}
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  Edit
                                </button>
                              </PermissionGuard>

                              <div className="my-1 border-t border-zinc-100" />

                              {p.status !== 'Archived' && p.status !== 'Closed' && (
                                <PermissionGuard permission="projects.archive">
                                  <button
                                    onClick={async (e) => {
                                      e.stopPropagation();
                                      setOpenMenuId(null);
                                      if (!confirm('Archive this project?')) return;
                                      const { error } = await supabase.from('projects').update({ status: 'Archived' }).eq('id', p.id);
                                      if (error) { alert('Error: ' + error.message); return; }
                                      queryClient.invalidateQueries({ queryKey: ['projects'] });
                                    }}
                                    className="flex w-full items-center gap-2 rounded-md px-2 text-[12px] text-zinc-600 transition-all hover:bg-zinc-50 hover:text-zinc-700 active:scale-[0.98]"
                                    style={{ padding: '6px' }}
                                  >
                                    <Archive className="w-3.5 h-3.5" />
                                    Archive
                                  </button>
                                </PermissionGuard>
                              )}

                              <div className="my-1 border-t border-zinc-100" />

                              <PermissionGuard permission="projects.delete">
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
                              </PermissionGuard>
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
          Showing {totalCount === 0 ? 0 : startIndex + 1} to {endIndex} of {totalCount} projects
        </div>
        <div className="flex items-center gap-2">
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage <= 1}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage > 1
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Previous
          </Button>
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
                <Button variant="default" size="sm" key={pageNum} onClick={() => setCurrentPage(pageNum)}
                  className={`px-3 py-1 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[32px] flex items-center justify-center ${
                    currentPage === pageNum
                      ? 'bg-blue-600/10 text-blue-600 border border-blue-600/20 shadow-sm'
                      : 'text-zinc-600 hover:bg-zinc-100 bg-white border border-zinc-200'
                  }`}
                >
                  {pageNum}
                </Button>
              );
            })}
          </div>
          <Button variant="default" size="sm" onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage >= totalPages}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors h-[32px] min-w-[80px] flex items-center justify-center ${
              currentPage < totalPages
                ? 'text-zinc-700 hover:bg-zinc-200 bg-white border border-zinc-200 shadow-sm'
                : 'text-zinc-400 bg-zinc-50 border border-zinc-100 cursor-not-allowed'
            }`}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Subcontractor Work Orders Tab for Project Detail ─────────────────────────
import { ProjectSubcontractorWorkOrders } from '../../components/projects/ProjectSubcontractorWorkOrders';
import { KanbanCard } from '../../components/projects/KanbanCard';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
