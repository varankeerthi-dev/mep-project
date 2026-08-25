// src/App.tsx
import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { User } from '@supabase/supabase-js';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, Navigate } from 'react-router-dom';
import { PageSkeleton } from './components/ui/skeleton';
import { useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { PermissionGuard } from './rbac';
import { supabase, getUserOrganisations, createOrganization, signOut, sendVerificationEmail } from './supabase';
import { queryClient, refreshSessionIfNeeded } from './queryClient';
import { Toaster } from './lib/logger';
import { AuthContext, useAuth, type AuthContextValue, type Organisation, type OrganisationMember } from './contexts/AuthContext';
import { DateFormatProvider } from './contexts/DateFormatContext';


export { useAuth };
export type { AuthContextValue, Organisation, OrganisationMember };

import ItemEditorPage from './features/materials/page/ItemEditorPage';

const DynamicAgentation = lazy(() => {
  if (typeof window === 'undefined') return Promise.resolve({ default: () => null });
  return import('agentation').then(m => ({ default: m.Agentation }));
});

const lazyAny = (
  factory: () => Promise<{ default: ComponentType<any> }>
): LazyExoticComponent<ComponentType<any>> => lazy(factory);

// Memoised lazy-module loader: the import() only fires the first time a
// derived lazyAny component is actually rendered; subsequent calls return
// the same in-flight / resolved promise from the module cache.
function memoLazyModule<T>(loader: () => Promise<T>): () => Promise<T> {
  let cached: Promise<T> | null = null;
  return () => (cached ??= loader());
}


// Lazy load all pages
const LandingPage      = lazyAny(() => import('./pages/LandingPage'));

const Sidebar         = lazyAny(() => import('./components/Sidebar'));
const QuickAccessBar  = lazyAny(() => import('./components/QuickAccessBar'));
const DesignAuditPage = lazyAny(() => import('./components/DesignAuditPage'));
const SkeletonDemoPage = lazyAny(() => import('./components/SkeletonDemoPage'));
const EmployeeTab      = lazyAny(() => import('./pages/hr/EmployeeTab'));
const AttendancePlanning = lazyAny(() => import('./pages/hr/AttendancePlanning'));
const AttendanceEntry  = lazyAny(() => import('./pages/hr/AttendanceEntry'));
const SalarySlipDashboard = lazyAny(() => import('./pages/hr/salary-slip/SalarySlipDashboard').then(m => ({ default: m.SalarySlipDashboard })));
const ToolsManagement  = lazyAny(() => import('./pages/ToolsManagement'));
const DynamicTableDemo = lazyAny(() => import('./components/ui/DynamicTableDemo').then(m => ({ default: m.DynamicTableDemo })));
const CreateDC = lazyAny(() => import('./pages/CreateDC'));
const CreateDCV2 = lazyAny(() => import('./pages/CreateDCV2'));
const CreateNonBillableDC = lazyAny(() => import('./pages/CreateNonBillableDC'));
const DCList = lazyAny(() => import('./pages/DCList'));
const NonBillableDCList = lazyAny(() => import('./pages/NonBillableDCList'));
const DateWiseConsolidation = lazyAny(() => import('./pages/DateWiseConsolidation'));
const MaterialWiseConsolidation = lazyAny(() => import('./pages/MaterialWiseConsolidation'));
const DCConsolidation = lazyAny(() => import('./pages/DCConsolidation').then(m => ({ default: m.default })));
const MaterialsList = lazyAny(() => import('./features/materials/page/MaterialsPage'));
const StockTransfer = lazyAny(() => import('./pages/StockTransfer'));
const TransactionNumberSeries = lazyAny(() => import('./pages/TransactionNumberSeries'));
const CreatePO = lazyAny(() => import('./pages/CreatePO'));
const POList = lazyAny(() => import('./pages/POList'));
const PODetails = lazyAny(() => import('./pages/PODetails'));
const InvoiceListPage = lazyAny(() => import('./invoices/pages/InvoiceListPage'));
const InvoiceEditorPage = lazyAny(() => import('./invoices/pages/InvoiceEditorPage'));
const InvoiceView = lazyAny(() => import('./invoices/pages/InvoiceView'));
const ProformaListPage = lazyAny(() => import('./proforma-invoices/pages/ProformaListPage'));
const ProformaEditorPage = lazyAny(() => import('./proforma-invoices/pages/ProformaEditorPage'));
const LedgerDashboard = lazyAny(() => import('./ledger/LedgerDashboard'));
const ProjectList = lazyAny(() => import('./projects/pages/ProjectList'));
const CreateProject = lazyAny(() => import('./projects/pages/CreateProject'));
const LegacyCreateProject = lazyAny(() => import('./pages/CreateProject'));
const _authModule        = memoLazyModule(() => import('./pages/Auth'));
const Login              = lazyAny(() => _authModule().then(m => ({ default: m.Login })));
const Signup             = lazyAny(() => _authModule().then(m => ({ default: m.Signup })));
const AuthCallback       = lazyAny(() => _authModule().then(m => ({ default: m.AuthCallback })));
const SelectOrganisation = lazyAny(() => _authModule().then(m => ({ default: m.SelectOrganisation })));
const RequestAccessPage = lazyAny(() => import('./pages/RequestAccess'));
const AccessControlPage = lazyAny(() => import('./pages/AccessControl'));
const OrganisationSettings = lazyAny(() => import('./pages/Organisation').then(m => ({ default: m.OrganisationSettings })));
const QuotationList = lazyAny(() => import('./pages/QuotationList'));
const CreateQuotation = lazyAny(() => import('./pages/CreateQuotation/index'));
const WorkCompletionCertificatePage = lazyAny(() => import('./pages/WorkCompletionCertificatePage'));
const CreateQuotationV2 = lazyAny(() => import('./pages/CreateQuotationV2/index'));
const QuotationView = lazyAny(() => import('./pages/QuotationView'));
const SalesOrderList = lazyAny(() => import('./pages/sales/SalesOrderList'));
const SalesOrderCreate = lazyAny(() => import('./pages/sales/SalesOrderCreate'));
const SalesOrderCreateV2 = lazyAny(() => import('./pages/sales/SalesOrderCreateV2'));
const SalesOrderDetail = lazyAny(() => import('./pages/sales/SalesOrderDetail'));
const DCView = lazyAny(() => import('./pages/DCView'));
const ReturnListPage = lazyAny(() => import('./pages/ReturnListPage'));
const ReturnEditorPage = lazyAny(() => import('./pages/ReturnEditorPage'));
const ReturnViewPage = lazyAny(() => import('./pages/ReturnViewPage'));
const TemplateSettings = lazyAny(() => import('./pages/TemplateSettings'));
const DiscountSettings = lazyAny(() => import('./pages/DiscountSettings'));
const QuickQuoteSettings = lazyAny(() => import('./pages/QuickQuoteSettings'));
const TermsConditionsDashboard = lazyAny(() => import('./pages/TermsConditionsDirect').then(m => ({ default: m.TermsConditionsDashboard })));
const TermsConditionsSettings  = lazyAny(() => import('./pages/TermsConditionsSettingsRefactored').then(m => ({ default: m.TermsConditionsSettings })));
const QuickStockCheckList = lazyAny(() => import('./pages/QuickStockCheckList'));
const QuickStockCheck = lazyAny(() => import('./pages/QuickStockCheck'));
const ProcurementList = lazyAny(() => import('./pages/ProcurementList'));
const ProcurementDetail = lazyAny(() => import('./pages/ProcurementDetail'));
const HandoverList = lazyAny(() => import('./pages/HandoverList'));
const ProjectOverview = lazyAny(() => import('./pages/ProjectOverview'));
const SiteExpenses = lazyAny(() => import('./pages/SiteExpenses').then(m => ({ default: m.SiteExpenses })));
const Projects = lazyAny(() => import('./projects/pages/Projects'));
const LegacyProjects = lazyAny(() => import('./pages/Projects'));
const FollowUpCentre = lazyAny(() => import('./pages/FollowUpCentre'));
const DayBook = lazyAny(() => import('./pages/accounting/DayBook'));
const ChartOfAccounts = lazyAny(() => import('./pages/accounting/ChartOfAccounts'));
const PricingTableOneDemo = lazyAny(() => import('./components/pricing-table-one-demo').then(m => ({ default: m.PricingTableOneDemo })));
const FieldVariationsList = lazyAny(() => import('./pages/FieldVariationsList').then(m => ({ default: m.FieldVariationsList })));
const MaterialReturnVerification = lazyAny(() => import('./pages/MaterialReturnVerification').then(m => ({ default: m.MaterialReturnVerification })));
const VendorDisputesLog = lazyAny(() => import('./pages/VendorDisputesLog').then(m => ({ default: m.VendorDisputesLog })));
const DCLineItemReconciliation = lazyAny(() => import('./pages/DCLineItemReconciliation').then(m => ({ default: m.DCLineItemReconciliation })));
const SiteStoppageTaskIntents = lazyAny(() => import('./pages/SiteStoppageTaskIntents').then(m => ({ default: m.SiteStoppageTaskIntents })));
const ProjectScheduleBaselineControl = lazyAny(() => import('./pages/ProjectScheduleBaselineControl').then(m => ({ default: m.ProjectScheduleBaselineControl })));


// Lazy load internally moved pages
const Dashboard = lazyAny(() => import('./pages/Dashboard'));
const DashboardDemo = lazyAny(() => import('./pages/DashboardDemo'));
const Operations = lazyAny(() => import('./pages/operations/Operations'));
const OperationsV2 = lazyAny(() => import('./pages/operations/OperationsV2'));
const DailyUpdates = lazyAny(() => import('./pages/DailyUpdates'));
const TodoList = lazyAny(() => import('./pages/TodoList'));
const RemindMe = lazyAny(() => import('./pages/RemindMe'));
const Approvals = lazyAny(() => import('./pages/Approvals'));
const ClientManagement = lazyAny(() => import('./pages/ClientManagement'));
const CreateClient = lazyAny(() => import('./pages/ClientManagement').then(m => ({ default: m.CreateClient })));
const CreateClientEdit = lazyAny(() => import('./pages/ClientManagement').then(m => ({ default: m.CreateClientEdit })));
const ClientList = lazyAny(() => import('./pages/ClientList'));
const MaterialInward = lazyAny(() => import('./pages/MaterialInward'));
const MaterialOutward = lazyAny(() => import('./pages/MaterialOutward'));
const MeetingsList = lazyAny(() => import('./meetings/pages/MeetingsList'));
const CreateMeeting = lazyAny(() => import('./meetings/pages/CreateMeeting'));
const MeetingMinutesEditor = lazyAny(() => import('./meetings/pages/MeetingMinutesEditor'));
const MeetingMinutesView = lazyAny(() => import('./meetings/pages/MeetingMinutesView'));
const ClientRequests = lazyAny(() => import('./pages/ClientRequests'));
const SiteVisits = lazyAny(() => import('./pages/SiteVisits').then(m => ({ default: m.SiteVisits })));
const SiteReport = lazyAny(() => import('./pages/SiteReport').then(m => ({ default: m.SiteReport })));
const ClientCommunication = lazyAny(() => import('./pages/ClientCommunication').then(m => ({ default: m.ClientCommunication })));
const ManagerAlerts = lazyAny(() => import('./pages/ManagerAlerts'));
const _subcontractors        = memoLazyModule(() => import('./pages/Subcontractors'));
const SubcontractorDashboard = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorDashboard })));
const CreateSubcontractor    = lazyAny(() => _subcontractors().then(m => ({ default: m.CreateSubcontractor })));
const SubcontractorView      = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorView })));
const SubcontractorEdit      = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorEdit })));
const ManpowerAttendance     = lazyAny(() => import('./pages/ManpowerAttendance').then(m => ({ default: m.ManpowerAttendance })));
const ManpowerAttendanceList = lazyAny(() => import('./pages/ManpowerAttendanceList').then(m => ({ default: m.ManpowerAttendanceList })));
const SubcontractorWorkOrders     = lazyAny(() => import('./pages/SubcontractorWorkOrderProfessional').then(m => ({ default: m.WorkOrderList })));
const SubcontractorWorkOrderCreate = lazyAny(() => import('./pages/SubcontractorWorkOrderCreate'));
const SubcontractorWorkOrderCreateV2 = lazyAny(() => import('./pages/SubcontractorWorkOrderCreateV2'));
const WorkOrderDetailView    = lazyAny(() => import('./pages/WorkOrderDetailView').then(m => ({ default: m.WorkOrderDetailView })));
const MeasurementSheetWrapper = lazyAny(() => import('./pages/MeasurementSheetWrapper').then(m => ({ default: m.MeasurementSheetWrapper })));
const SubcontractorDailyLogs = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorDailyLogs })));
const SubcontractorPayments  = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorPayments })));
const SubcontractorInvoices  = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorInvoices })));
const SubcontractorDocuments = lazyAny(() => _subcontractors().then(m => ({ default: m.SubcontractorDocuments })));
const SubcontractorsPage = lazyAny(() => import('./features/subcontractor-v2/pages/SubcontractorsPage'));

const _reports       = memoLazyModule(() => import('./pages/Reports'));
const StockBalance   = lazyAny(() => _reports().then(m => ({ default: m.StockBalance })));
const StockReport    = lazyAny(() => _reports().then(m => ({ default: m.StockReport })));
const PurchaseReport = lazyAny(() => _reports().then(m => ({ default: m.PurchaseReport })));
const SalesReport    = lazyAny(() => _reports().then(m => ({ default: m.SalesReport })));
const ReportsDashboard = lazyAny(() => import('./pages/reports/ReportsDashboard'));
const FinancialReports = lazyAny(() => import('./pages/reports/FinancialReports'));
const ProjectReports = lazyAny(() => import('./pages/reports/ProjectReports'));
const InventoryReports = lazyAny(() => import('./pages/reports/InventoryReports'));
const ComplianceReports = lazyAny(() => import('./pages/reports/ComplianceReports'));
const InvoiceReports = lazyAny(() => import('./pages/reports/InvoiceReports'));
const ProfitReport = lazyAny(() => import('./pages/reports/ProfitReport'));
const _projectMgmtInternal = memoLazyModule(() => import('./pages/ProjectManagementInternal'));
const SiteMaterials        = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.SiteMaterials })));
const ToolsList            = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.ToolsList })));
const LeadsModule = lazyAny(() => import('./modules/Leads/LeadsModule'));
const PurchaseModule = lazyAny(() => import('./modules/Purchase/PurchaseModule'));
const DebitNoteViewV2 = lazyAny(() => import('./modules/Purchase/components/DebitNoteViewV2'));
const PurchaseOrdersV2 = lazyAny(() => import('./modules/Purchase/components/PurchaseOrdersV2'));
const AdvanceExpenseModule = lazyAny(() => import('./modules/AdvanceExpense/AdvanceExpenseModule'));
const CreditNoteListPage = lazyAny(() => import('./credit-notes/pages/CreditNoteListPage').then(m => ({ default: m.CreditNoteListPage })));
const CreditNoteViewPage = lazyAny(() => import('./credit-notes/pages/CreditNoteViewPage').then(m => ({ default: m.CreditNoteViewPage })));
const CreditNoteEditorPage = lazyAny(() => import('./credit-notes/pages/CreditNoteEditorPage').then(m => ({ default: m.CreditNoteEditorPage })));
const CreditNoteEditorPageV2 = lazyAny(() => import('./credit-notes/pages/CreditNoteEditorPageV2').then(m => ({ default: m.CreditNoteEditorPageV2 })));
const InvoiceEditorPageV2 = lazyAny(() => import('./invoices/pages/InvoiceEditorPageV2'));
const BOQ = lazyAny(() => import('./pages/BOQ'));
const BOQList = lazyAny(() => import('./pages/BOQList'));
const TableDemo = lazyAny(() => import('./pages/TableDemo'));
const CustomTableDemo = lazyAny(() => import('./pages/CustomTableDemo'));

// Warehouse Management module
const WarehouseModule = lazyAny(() => import('./warehouse/WarehouseModule'));

// Manufacturing
const ManufacturingShellV0 = lazyAny(() => import('./pages/manufacturing-v0/ManufacturingShell'));
const ManufacturingShellV2 = lazyAny(() => import('./pages/manufacturing/ManufacturingShell'));
const IssueList       = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.IssueList })));
const IssueAllList    = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.IssueAllList })));
const IssueDashboard  = lazyAny(() => import('./issues/pages/IssueDashboard').then(m => ({ default: m.IssueDashboard })));
const IssueListPage   = lazyAny(() => import('./issues/pages/IssueListPage').then(m => ({ default: m.IssueListPage })));
const IssueDetailPage = lazyAny(() => import('./issues/pages/IssueDetailPage').then(m => ({ default: m.IssueDetailPage })));
const IssueCreateModal = lazyAny(() => import('./issues/pages/IssueCreateModal').then(m => ({ default: m.IssueCreateModal })));
const ClientComm = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.ClientComm })));
const Documents  = lazyAny(() => _projectMgmtInternal().then(m => ({ default: m.Documents })));
const DCEdit = lazyAny(() => import('./pages/DCEdit'));
const NonBillableDCEdit = lazyAny(() => import('./pages/NonBillableDCEdit'));
const SettingsPage = lazyAny(() => import('./pages/Settings'));
const SettingsV2Page = lazyAny(() => import('./features/settings-v2/SettingsV2Page'));
const ModuleSettingsPage = lazyAny(() => import('./components/ModuleSettings'));
const StockAdjustmentPage = lazyAny(() => import('./pages/StockAdjustment'));
const HelpPage = lazyAny(() => import('./pages/HelpPage'));
const ApprovalSettings = lazyAny(() => import('./components/ApprovalSettings'));
const PaymentsHub = lazyAny(() => import('./modules/Purchase/components/PaymentsHub'));
const PrintSettings = lazyAny(() => import('./pages/PrintSettings'));
const DatabaseSetup = lazyAny(() => import('./pages/DatabaseSetup'));

// Estimation pages
const BOQListPage = lazyAny(() => import('./features/estimation/pages/boq/BOQListPage'));
const BOQFormPage = lazyAny(() => import('./features/estimation/pages/boq/BOQFormPage'));
const BOQDetailPage = lazyAny(() => import('./features/estimation/pages/boq/BOQDetailPage'));
const TenderListPage = lazyAny(() => import('./features/estimation/pages/tenders/TenderListPage'));
const TenderFormPage = lazyAny(() => import('./features/estimation/pages/tenders/TenderFormPage'));
const TenderDetailPage = lazyAny(() => import('./features/estimation/pages/tenders/TenderDetailPage'));
const ResourceCatalogPage = lazyAny(() => import('./features/estimation/pages/resources/ResourceCatalogPage'));
const PartnerListPage = lazyAny(() => import('./features/partner-allocation/pages/partners/PartnerListPage'));
const PartnerFormPage = lazyAny(() => import('./features/partner-allocation/pages/partners/PartnerFormPage'));
const AllocationsListPage = lazyAny(() => import('./features/partner-allocation/pages/allocations/AllocationsListPage'));
const PartnerInboxPage = lazyAny(() => import('./features/partner-allocation/pages/allocations/PartnerInboxPage'));
const EmployeeCheckIn = lazyAny(() => import('./pages/EmployeeCheckIn'));
const HRAdminDashboard = lazyAny(() => import('./pages/HRAdminDashboard'));
const ClientLookup = lazyAny(() => import('./pages/ClientLookup'));

type CreateOrganisationResult = {
  data?: Organisation | null;
  error?: { message?: string } | null;
};

type QuickAction =
  | 'new-dc'
  | 'daily-updates'
  | 'approvals'
  | 'remind'
  | 'search'
  | 'export';

const AdminRoute = ({ children }: { children: React.ReactNode }) => {
  const { organisation, organisations } = useAuth();
  const currentOrg = organisations.find(o => o.organisation?.id === organisation?.id);
  if (currentOrg?.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
};

export default function App() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dbSetup, setDbSetup] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);
  const [tourStep, setTourStep] = useState(0);
  const [tourRect, setTourRect] = useState<DOMRect | null>(null);
  const currentPath = `${location.pathname}${location.search}` || '/';
  const tokenInvalidateGateRef = useRef(0);
  const refreshMembershipsGateRef = useRef(0);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const handleResendVerification = async () => {
    if (!user?.email) return;
    setResendLoading(true);
    const { error } = await sendVerificationEmail(user.email);
    if (error) {
      setResendMessage('Failed to resend verification email');
    } else {
      setResendMessage('Verification email sent! Check your inbox.');
    }
    setResendLoading(false);
  };

  const getDaysRemaining = (createdAt?: string) => {
    if (!createdAt) return 7;
    const createdDate = new Date(createdAt).getTime();
    const now = Date.now();
    const diffDays = Math.floor((now - createdDate) / (1000 * 60 * 60 * 24));
    return Math.max(0, 7 - diffDays);
  };

  const navigate = useCallback((path?: string) => {
    routerNavigate(path || '/');
  }, [routerNavigate]);

  const markActiveQueriesStale = useCallback(() => {
    const now = Date.now();
    if (now - tokenInvalidateGateRef.current < 1000) return;
    tokenInvalidateGateRef.current = now;
    // Avoid triggering network fetches from inside auth event callbacks.
    queryClient.invalidateQueries({ type: 'active', stale: true, refetchType: 'none' } as any);
  }, [queryClient]);

  const handleSidebarNavigate = useCallback((path: string) => {
    navigate(path);
    setMobileSidebarOpen(false);
  }, [navigate]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const handleNewQuote = useCallback(() => {
    navigate('/quotation/create');
  }, [navigate]);

  const handleNewDC = useCallback(() => {
    navigate('/dc/create');
  }, [navigate]);

  const handleHelp = useCallback(() => {
    navigate('/help');
  }, [navigate]);

  useEffect(() => {
    const onboardingCompleted = Boolean((organisation as any)?.onboarding_completed);
    const tourSeen = localStorage.getItem('mep-onboarding-tour-seen') === 'true';
    if (user && organisation && !onboardingCompleted && !tourSeen) {
      setTourOpen(true);
      setTourStep(0);
    } else {
      setTourOpen(false);
    }
  }, [user, organisation]);

  const completeTour = useCallback(() => {
    localStorage.setItem('mep-onboarding-tour-seen', 'true');
    setTourOpen(false);
    setTourStep(0);
  }, []);

  const tourSteps = [
    {
      title: 'Quick access toolbar',
      body: 'Use this top bar to create records fast, open help, and manage shortcuts.',
      selector: '[data-tour-anchor="quick-access-bar"]',
      action: null,
    },
    {
      title: 'Side menu',
      body: 'This is the module map. It keeps the workspace organized and hides what the org does not use.',
      selector: '[data-tour-anchor="sidebar"]',
      action: null,
    },
    {
      title: 'Module settings',
      body: 'Here you can switch modules on or off. Manufacturing remains hidden when the organisation setup says No.',
      selector: '[data-tour-anchor="module-settings"]',
      action: () => navigate('/settings'),
    },
  ] as const;

  useEffect(() => {
    if (!tourOpen) return;
    const updateTourRect = () => {
      const selector = tourSteps[tourStep]?.selector;
      const element = selector ? document.querySelector(selector) as HTMLElement | null : null;
      if (element) setTourRect(element.getBoundingClientRect());
    };
    updateTourRect();
    window.addEventListener('resize', updateTourRect);
    window.addEventListener('scroll', updateTourRect, true);
    const timer = window.setInterval(updateTourRect, 250);
    return () => {
      window.removeEventListener('resize', updateTourRect);
      window.removeEventListener('scroll', updateTourRect, true);
      window.clearInterval(timer);
    };
  }, [tourOpen, tourStep]);

  const renderedPage = useMemo(() => {
    const pathKey = (currentPath || '/').split('?')[0];

    // ── Unauthenticated shell ─────────────────────────────────────────────────
    // Only auth-related pages are rendered before login. Nothing else loads its
    // chunk. Any unknown path while logged-out falls through to Login so the
    // user is not left with a blank screen.
    if (!user) {
      if (pathKey === '/') return <Suspense fallback={null}><LandingPage /></Suspense>;
      switch (pathKey) {
        case '/login':               return <Suspense fallback={null}><Login onLogin={() => navigate('/')} /></Suspense>;
        case '/signup':              return <Suspense fallback={null}><Signup /></Suspense>;
        case '/auth/callback':       return <Suspense fallback={null}><AuthCallback /></Suspense>;
        case '/select-organisation': return <Suspense fallback={null}><SelectOrganisation organisations={organisations} onSelect={handleSelectOrganisation} onCreateNew={handleCreateOrganisation} /></Suspense>;
        case '/request-access':      return <Suspense fallback={null}><RequestAccessPage /></Suspense>;
        default:                     return <Suspense fallback={null}><Login onLogin={() => navigate('/')} /></Suspense>;
      }
    }

    // ── Authenticated shell ───────────────────────────────────────────────────
    // Only reached after user is confirmed. Lazy chunks only load on demand.
    switch (pathKey) {
      case '/terms-conditions': return <TermsConditionsDashboard />;
      case '/pricing-demo': return <PricingTableOneDemo />;
      case '/table-demo': return <TableDemo />;
      case '/custom-table-demo': return <CustomTableDemo />;
      case '/design-audit': return <DesignAuditPage />;
      case '/skeleton-demo': return <SkeletonDemoPage />;
      case '/':
        return <Dashboard onNavigate={navigate} />;
      case '/login':
      case '/dashboard':
        return <Dashboard onNavigate={navigate} />;
      case '/dashboard-demo':
      case '/settings/dashboard-demo':
        return <DashboardDemo />;
      case '/operations':
      case '/settings/operations':
        return <Operations />;
      case '/operations-v2':
      case '/settings/operations-v2':
        return <OperationsV2 />;
      case '/projects':
      case '/projects-v2':
        return <PermissionGuard permission="projects.read" fallback={<div className="p-6">Access Denied</div>}><Projects /></PermissionGuard>;
      case '/projects-old':
      case '/settings/projects-old':
        return <PermissionGuard permission="projects.read" fallback={<div className="p-6">Access Denied</div>}><LegacyProjects /></PermissionGuard>;
      case '/tools': return <ToolsManagement />;
      case '/projects/new':
      case '/projects-v2/new':
        return <PermissionGuard permission="projects.create" fallback={<div className="p-6">Access Denied</div>}><CreateProject onSuccess={() => navigate('/projects')} onCancel={() => navigate('/projects')} /></PermissionGuard>;
      case '/projects-old/new':
        return <PermissionGuard permission="projects.create" fallback={<div className="p-6">Access Denied</div>}><LegacyCreateProject onSuccess={() => navigate('/projects-old')} onCancel={() => navigate('/projects-old')} /></PermissionGuard>;
      case '/projects/edit':
      case '/projects-v2/edit':
        return <PermissionGuard permission="projects.update" fallback={<div className="p-6">Access Denied</div>}><CreateProject onSuccess={() => navigate('/projects')} onCancel={() => navigate('/projects')} /></PermissionGuard>;
      case '/projects-old/edit':
        return <PermissionGuard permission="projects.update" fallback={<div className="p-6">Access Denied</div>}><LegacyCreateProject onSuccess={() => navigate('/projects-old')} onCancel={() => navigate('/projects-old')} /></PermissionGuard>;
      case '/projects/daily-updates': return <Projects />;
      case '/projects/site-materials': return <Projects />;
      case '/todo': return <TodoList />;
      case '/remindme': return <RemindMe />;
      case '/approvals': return <Approvals />;
      case '/clients/new': return <CreateClient onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients/edit': return <CreateClientEdit onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients': return <ClientList />;
      case '/meetings': return <MeetingsList />;
      case '/meetings/create': return <CreateMeeting />;
      case '/meetings/edit': return <CreateMeeting />;
      case '/site-visits': return <SiteVisits />;
      case '/site-expenses': return <SiteExpenses />;
      case '/site-reports': return <SiteReport />;
      case '/handover': return <HandoverList />;
      case '/projects-overview':
      case '/settings/projects-overview':
      case '/settings/ceo-dashboard':
        return <ProjectOverview />;
      case '/client-communication': return <ClientCommunication />;
      case '/manager-alerts': return <ManagerAlerts />;
      case '/subcontractors': return <SubcontractorDashboard onNavigate={navigate} />;
      case '/subcontractors/new': return <CreateSubcontractor onSuccess={() => navigate('/subcontractors')} onCancel={() => navigate('/subcontractors')} />;
      case '/subcontractors/view': return <SubcontractorView onNavigate={navigate} />;
      case '/subcontractors/edit': return <SubcontractorEdit onNavigate={navigate} />;
      case '/subcontractors/workorders': return <SubcontractorWorkOrders onNavigate={navigate} />;
      case '/subcontractors/workorders/create': return <SubcontractorWorkOrderCreate onNavigate={navigate} />;
      case '/subcontractors/workorders/create-v2': return <SubcontractorWorkOrderCreateV2 onNavigate={navigate} />;
      case '/subcontractors/attendance': return <ManpowerAttendance onNavigate={navigate} />;
      case '/subcontractors/attendance/list': return <ManpowerAttendanceList onNavigate={navigate} />;
      case '/subcontractors/payments': return <SubcontractorPayments onNavigate={navigate} />;
      case '/subcontractors/invoices': return <SubcontractorInvoices onNavigate={navigate} />;
      case '/subcontractors/documents': return <SubcontractorDocuments onNavigate={navigate} />;

      case '/subcontractors-v2':
      case '/subcontractors-v2/new':
      case '/subcontractors-v2/view':
      case '/subcontractors-v2/edit':
      case '/subcontractors-v2/workorders':
      case '/subcontractors-v2/workorders/create':
      case '/subcontractors-v2/attendance':
      case '/subcontractors-v2/payments':
      case '/subcontractors-v2/invoices':
      case '/subcontractors-v2/documents':
        return <SubcontractorsPage onNavigate={navigate} />;

      // Client PO
      case '/client-po': return <POList />;
      case '/client-po/create': return <CreatePO onSuccess={() => navigate('/client-po')} onCancel={() => navigate('/client-po')} />;
      // Sales
      case '/client-po/view': return <PODetails />;
      case '/leads':
      case '/leads/kanban':
      case '/leads/settings':
        return <LeadsModule />;
      case '/quotation': return <QuotationList />;
      case '/quotation/create': return <CreateQuotation onSuccess={() => navigate('/quotation')} onCancel={() => navigate('/quotation')} />;
      case '/quotation/create-v2': return <CreateQuotationV2 />;
      case '/quotation/view': return <QuotationView />;
      case '/quotation/edit': return <CreateQuotation onSuccess={() => navigate('/quotation')} onCancel={() => navigate('/quotation')} editMode={true} />;
      case '/sales-orders': return <SalesOrderList />;
      case '/sales-orders/create': return <SalesOrderCreate onSuccess={() => navigate('/sales-orders')} onCancel={() => navigate('/sales-orders')} />;
      case '/sales-orders/create-v2': return <SalesOrderCreateV2 />;
      case '/sales-orders/edit': return <SalesOrderCreate onSuccess={() => navigate('/sales-orders')} onCancel={() => navigate('/sales-orders')} editMode={true} />;
      case '/sales-orders/view': return <SalesOrderDetail />;
      case '/client-lookup': return <PermissionGuard permission="quick_lookup.read" fallback={<div className="p-6">Access Denied</div>}><ClientLookup /></PermissionGuard>;
      case '/invoices': return <InvoiceListPage />;
      case '/invoices/view': return <InvoiceView />;
      case '/invoices/create': return <InvoiceEditorPage />;
      case '/invoices/edit': return <InvoiceEditorPage />;
      case '/proforma-invoices': return <ProformaListPage />;
      case '/proforma-invoices/create': return <ProformaEditorPage />;
      case '/proforma-invoices/edit': return <ProformaEditorPage />;
      case '/credit-notes': return <CreditNoteListPage />;
      case '/credit-notes/view': return <CreditNoteViewPage />;
      case '/credit-notes/create': return <CreditNoteEditorPage />;
      case '/credit-notes/edit': return <CreditNoteEditorPage />;
      case '/credit-notes/create-v2': return <CreditNoteEditorPageV2 />;
      case '/credit-notes/edit-v2': return <CreditNoteEditorPageV2 />;
      case '/invoices/create-v2': return <InvoiceEditorPageV2 />;
      case '/invoices/edit-v2': return <InvoiceEditorPageV2 />;
      case '/ledger': return <LedgerDashboard onNavigate={navigate} />;
      case '/follow-up': return <FollowUpCentre />;
      case '/boq': return <BOQList />;
      case '/boq/create': return <BOQ onSuccess={() => navigate('/boq')} onCancel={() => navigate('/boq')} />;
      // Estimation module
      case '/estimation/boq': return <PermissionGuard permission="estimation.boq.read" fallback={<div className="p-6">Access Denied</div>}><BOQListPage /></PermissionGuard>;
      case '/estimation/boq/new': return <PermissionGuard permission="estimation.boq.create" fallback={<div className="p-6">Access Denied</div>}><BOQFormPage /></PermissionGuard>;
      case '/estimation/boq/edit': return <PermissionGuard permission="estimation.boq.update" fallback={<div className="p-6">Access Denied</div>}><BOQFormPage /></PermissionGuard>;
      case '/estimation/boq/detail': return <PermissionGuard permission="estimation.boq.read" fallback={<div className="p-6">Access Denied</div>}><BOQDetailPage /></PermissionGuard>;
      case '/estimation/tenders': return <PermissionGuard permission="estimation.tender.read" fallback={<div className="p-6">Access Denied</div>}><TenderListPage /></PermissionGuard>;
      case '/estimation/tenders/new': return <PermissionGuard permission="estimation.tender.create" fallback={<div className="p-6">Access Denied</div>}><TenderFormPage /></PermissionGuard>;
      case '/estimation/tenders/edit': return <PermissionGuard permission="estimation.tender.update" fallback={<div className="p-6">Access Denied</div>}><TenderFormPage /></PermissionGuard>;
      case '/estimation/tenders/detail': return <PermissionGuard permission="estimation.tender.read" fallback={<div className="p-6">Access Denied</div>}><TenderDetailPage /></PermissionGuard>;
      case '/estimation/resources': return <PermissionGuard permission="estimation.resources.read" fallback={<div className="p-6">Access Denied</div>}><ResourceCatalogPage /></PermissionGuard>;
      // Manufacturing — V2 (refactored) module is now the default at /manufacturing
      case '/manufacturing':
      case '/manufacturing/machines':
      case '/manufacturing/moulds':
      case '/manufacturing/dashboard':
      case '/manufacturing/inventory':
      case '/manufacturing/boms':
      case '/manufacturing/boms/create':
      case '/manufacturing/boms/edit':
      case '/manufacturing/schedules':
      case '/manufacturing/schedules/create':
      case '/manufacturing/schedules/edit':
      case '/manufacturing/job-cards':
      case '/manufacturing/job-cards/create':
      case '/manufacturing/production':
      case '/manufacturing/production/create':
      case '/manufacturing/dispatch':
      case '/manufacturing/plans':
      case '/manufacturing/plans/create':
      case '/manufacturing/work-centers':
      case '/manufacturing/stores':
      case '/manufacturing/stores/grn/create':
      case '/manufacturing/qc':
      case '/manufacturing/qc/create':
      case '/manufacturing/qc/parameters':
      case '/manufacturing/qc/ipqc':
      case '/manufacturing/qc/ipqc/checkpoints':
      case '/manufacturing/inventory/wip-valuation':
      case '/manufacturing/custom-units':
      case '/manufacturing/custom-fields':
      case '/manufacturing/activity-log':
        return <ManufacturingShellV2 />;
      // Original Manufacturing module (v0) — preserved, not in the sidebar
      case '/manufacturing-v0':
      case '/manufacturing-v0/inventory':
      case '/manufacturing-v0/inventory/wip-valuation':
      case '/manufacturing-v0/boms':
      case '/manufacturing-v0/boms/create':
      case '/manufacturing-v0/boms/edit':
      case '/manufacturing-v0/schedules':
      case '/manufacturing-v0/schedules/create':
      case '/manufacturing-v0/schedules/edit':
      case '/manufacturing-v0/job-cards':
      case '/manufacturing-v0/job-cards/create':
      case '/manufacturing-v0/production':
      case '/manufacturing-v0/production/create':
      case '/manufacturing-v0/custom-units':
      case '/manufacturing-v0/custom-fields':
      case '/manufacturing-v0/activity-log':
        return <ManufacturingShellV0 />;
      case '/documents': return <PermissionGuard permission="work_completion.read" fallback={<div className="p-6">Access Denied</div>}><Documents /></PermissionGuard>;
      case '/work-completion': return <PermissionGuard permission="work_completion.read" fallback={<div className="p-6">Access Denied</div>}><Documents /></PermissionGuard>;
      case '/work-completion/create': return <PermissionGuard permission="work_completion.create" fallback={<div className="p-6">Access Denied</div>}><WorkCompletionCertificatePage /></PermissionGuard>;
      case '/work-completion/edit': return <PermissionGuard permission="work_completion.update" fallback={<div className="p-6">Access Denied</div>}><WorkCompletionCertificatePage /></PermissionGuard>;
      case '/issue': return <IssueDashboard />;
      case '/issues': return <IssueListPage />;
      case '/issue/new': return <IssueCreateModal isOpen={true} onClose={() => navigate('/issues')} />;
      case '/purchase':
      case '/purchase/dashboard':
      case '/purchase/vendors':
      case '/purchase/debit-notes-v2':
        return <DebitNoteViewV2 />;
      case '/purchase/orders-v2':
        return <PurchaseOrdersV2 />;
      case '/purchase/requisitions':
      case '/purchase/inquiries':
      case '/purchase/orders':
      case '/purchase/bills':
      case '/purchase/invoice-verification':
      case '/purchase/debit-notes':
      case '/purchase/payments':
      case '/purchase/payment-queue':
      case '/purchase/payment-accountant':
        return <PurchaseModule />;
      // Warehouse Management module
      case '/warehouse':
      case '/warehouse/dashboard':
      case '/warehouse/designer':
      case '/warehouse/viewer':
      case '/warehouse/inventory':
      case '/warehouse/operations':
      case '/warehouse/reports':
      case '/warehouse/warehouses':
        return <PermissionGuard permission="warehouses.read" fallback={<div className="p-6">Access Denied</div>}><WarehouseModule /></PermissionGuard>;
      // Inventory
      case '/procurement': return <ProcurementList />;
      case '/procurement/detail': return <ProcurementDetail />;
      case '/store/materials/items/new': return <ItemEditorPage />;
      case '/store/materials': return <MaterialsList />;
      case '/store/inward': return <MaterialInward />;
      case '/store/outward': return <MaterialOutward />;
      case '/store/transfer': return <StockTransfer />;
      case '/store/stock': return <StockBalance />;
      case '/store/adjust': return <StockAdjustmentPage />;
      case '/quick-stock-check': return <QuickStockCheck />;
      // Reports
      case '/reports': return <ReportsDashboard />;
      case '/reports/financial': return <FinancialReports />;
      case '/reports/projects': return <ProjectReports />;
      case '/reports/inventory': return <InventoryReports />;
      case '/reports/compliance': return <ComplianceReports />;
      case '/reports/invoices': return <InvoiceReports />;
      case '/reports/stock': return <StockReport />;
      case '/reports/purchase': return <PurchaseReport />;
      case '/reports/sales': return <SalesReport />;
      case '/reports/profit': return <ProfitReport />;
      // Delivery Challan
      case '/dc/create': return <CreateDC onSuccess={() => navigate('/dc/list')} onCancel={() => navigate('/dc/list')} />;
      case '/dc/create-v2': return <CreateDCV2 onSuccess={() => navigate('/dc/list')} onCancel={() => navigate('/dc/list')} />;
      case '/dc/list': return <DCList />;
      case '/dc/consolidation': return <DCConsolidation />;
      case '/dc/consolidation/date': return <DateWiseConsolidation />;
      case '/dc/consolidation/material': return <MaterialWiseConsolidation />;
      case '/nb-dc/list': return <NonBillableDCList />;
      case '/nb-dc/create': return <CreateNonBillableDC onSuccess={() => navigate('/nb-dc/list')} onCancel={() => navigate('/nb-dc/list')} />;
      // Operational Governance Modules
      case '/field-variations': return <FieldVariationsList />;
      case '/material-returns-verification': return <MaterialReturnVerification />;
      case '/vendor-disputes': return <VendorDisputesLog />;
      case '/dc-reconciliation': return <DCLineItemReconciliation />;
      case '/site-stoppages-intents': return <SiteStoppageTaskIntents />;
      case '/schedule-baseline-control': return <ProjectScheduleBaselineControl />;
      // Material Returns
      case '/returns': return <ReturnListPage />;
      case '/returns/create': return <ReturnEditorPage />;
      case '/returns/edit': return <ReturnEditorPage />;
      case '/returns/view': return <ReturnViewPage />;
      // Settings
      case '/dynamic-table-demo': return <DynamicTableDemo />;
      case '/help': return <HelpPage onNavigate={navigate} />;

      case '/settings': return <SettingsPage />;
      case '/settings-v2': return <SettingsV2Page />;
      case '/settings/print': return <PrintSettings />;
      case '/settings/template': return <TemplateSettings />;
      case '/settings/discounts': return <DiscountSettings />;
      case '/settings/quick-quote': return <QuickQuoteSettings />;
      case '/settings/terms-conditions': return <TermsConditionsSettings />;
      case '/settings/document-series': return <TransactionNumberSeries />;
      case '/settings/organisation': return <AdminRoute><OrganisationSettings organisation={organisation} userId={user?.id} /></AdminRoute>;
      case '/settings/access-control': return <AdminRoute><AccessControlPage /></AdminRoute>;
      case '/approval-settings': return <ApprovalSettings />;
      case '/advances-expenses':
      case '/advances-expenses/new':
      case '/advances-expenses/list':
      case '/advances-expenses/reports':
      case '/advances-expenses/petty-cash':
      case '/advances-expenses/ceo-dashboard':
        return <AdvanceExpenseModule />;
      case '/finance/payments': return <PaymentsHub />;
      case '/accounting/day-book': return <DayBook />;
      case '/accounting/chart-of-accounts': return <ChartOfAccounts />;
      case '/hr/employees': return <EmployeeTab />;
      case '/hr/planning': return <AttendancePlanning />;
      case '/hr/entry': return <AttendanceEntry />;
      case '/hr/salary-slip': return <SalarySlipDashboard />;
      // Partner Allocation
      case '/partner-allocation/partners': return <PermissionGuard permission="partners.read" fallback={<div className="p-6">Access Denied</div>}><PartnerListPage /></PermissionGuard>;
      case '/partner-allocation/partners/new': return <PermissionGuard permission="partners.create" fallback={<div className="p-6">Access Denied</div>}><PartnerFormPage /></PermissionGuard>;
      case '/partner-allocation/partners/edit': return <PermissionGuard permission="partners.update" fallback={<div className="p-6">Access Denied</div>}><PartnerFormPage /></PermissionGuard>;
      case '/partner-allocation/allocations': return <PermissionGuard permission="allocations.read" fallback={<div className="p-6">Access Denied</div>}><AllocationsListPage /></PermissionGuard>;
      case '/partner-allocation/inbox': return <PermissionGuard permission="allocations.update" fallback={<div className="p-6">Access Denied</div>}><PartnerInboxPage /></PermissionGuard>;
      default:
        if (pathKey.startsWith('/issue/')) {
          // Match /issue/<id> but not /issue/new
          if (!pathKey.includes('/issue/new') && !pathKey.endsWith('/issue')) {
            return <IssueDetailPage />;
          }
        }
        if (pathKey.startsWith('/dc/view/')) {
          return <DCView />;
        }
        if (pathKey.startsWith('/dc/edit/')) {
          const dcId = pathKey.split('/dc/edit/')[1];
          return <DCEdit dcId={dcId} onCancel={() => navigate('/dc/list')} />;
        }
        if (pathKey.startsWith('/nb-dc/edit/')) {
          const dcId = pathKey.split('/nb-dc/edit/')[1];
          return <NonBillableDCEdit dcId={dcId} onCancel={() => navigate('/nb-dc/list')} />;
        }
        if (pathKey.startsWith('/client-po/view')) {
          return <PODetails />;
        }
        if (pathKey.startsWith('/subcontractors/workorders/')) {
          const parts = pathKey.split('/subcontractors/workorders/')[1].split('/');
          const id = parts[0];
          const action = parts[1];

          if (action === 'create-measurement') {
            return <MeasurementSheetWrapper workOrderId={id} onBack={() => navigate(`/subcontractors/workorders/${id}`)} onSuccess={() => navigate(`/subcontractors/workorders/${id}`)} />;
          }
          return <WorkOrderDetailView workOrderId={id} onNavigate={navigate} />;
        }
        // Redirect legacy /manufacturing-v2 deep links to the clean /manufacturing paths
        if (pathKey === '/manufacturing-v2' || pathKey.startsWith('/manufacturing-v2/')) {
          return <Navigate to={currentPath.replace('/manufacturing-v2', '/manufacturing')} replace />;
        }
        // Original Manufacturing module (v0) — job card deep links
        if (pathKey.startsWith('/manufacturing-v0/job-cards/')) {
          return <ManufacturingShellV0 />;
        }
        // V2 Manufacturing module deep links
        if (
          pathKey.startsWith('/manufacturing/') ||
          pathKey.startsWith('/manufacturing-v2/')
        ) {
          return <ManufacturingShellV2 />;
        }
        // Warehouse module deep links (e.g. /warehouse/designer/<id>)
        if (pathKey.startsWith('/warehouse/')) {
          return <PermissionGuard permission="warehouses.read" fallback={<div className="p-6">Access Denied</div>}><WarehouseModule /></PermissionGuard>;
        }
        if (pathKey.startsWith('/meetings/') && pathKey.includes('/minutes')) {
          const meetingId = pathKey.split('/meetings/')[1].split('/minutes')[0];
          return <MeetingMinutesEditor meetingId={meetingId} />;
        }
        if (pathKey.startsWith('/meetings/') && pathKey.includes('/view')) {
          const meetingId = pathKey.split('/meetings/')[1].split('/view')[0];
          return <MeetingMinutesView meetingId={meetingId} />;
        }
        if (pathKey.startsWith('/meetings/edit/')) {
          const meetingId = pathKey.split('/meetings/edit/')[1];
          return <CreateMeeting meetingId={meetingId} />;
        }
        if ((pathKey.startsWith('/projects/') || pathKey.startsWith('/projects-v2/')) && pathKey.endsWith('/edit')) {
          return <PermissionGuard permission="projects.update" fallback={<div className="p-6">Access Denied</div>}><CreateProject onSuccess={() => navigate('/projects')} onCancel={() => navigate('/projects')} /></PermissionGuard>;
        }
        if (pathKey.startsWith('/projects-old/') && pathKey.endsWith('/edit')) {
          return <PermissionGuard permission="projects.update" fallback={<div className="p-6">Access Denied</div>}><LegacyCreateProject onSuccess={() => navigate('/projects-old')} onCancel={() => navigate('/projects-old')} /></PermissionGuard>;
        }
        return <Dashboard onNavigate={navigate} />;
    }
  }, [currentPath, navigate, user]);

  const handleLogout = useCallback(async () => {
    await signOut();
    localStorage.removeItem('mep-unconfirmed-user-session');
    setUser(null);
    setOrganisation(null);
    setOrganisations([]);
    navigate('/login');
  }, [navigate]);

  const handleSelectOrganisation = useCallback((org: Organisation) => {
    setOrganisation(org);
  }, []);

  const handleCreateOrganisation = async (
    orgName: string,
    options?: {
      organisationTypes?: string[];
      manufacturingEnabled?: boolean;
      onboardingCompleted?: boolean;
    }
  ) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      alert('Session expired. Please sign in again.');
      return;
    }

    const { data, error } = (await createOrganization(orgName, session.user.id, options)) as CreateOrganisationResult;
    if (error) {
      console.error('Create org error:', error);
      alert('Error creating organisation: ' + (error.message || 'Unknown error'));
      return;
    }
    if (data) {
      const { data: orgs } = await getUserOrganisations(session.user.id);
      setUser(session.user);
      setOrganisations(orgs || []);
      setOrganisation(orgs?.[0]?.organisation);
    }
  };

  const refreshMemberships = useCallback(async () => {
    if (!user) return;
    const { data: orgs } = await getUserOrganisations(user.id);
    setOrganisations(orgs || []);
    if (orgs && orgs.length > 0) {
      // If current org is still valid keep it, otherwise default to the first active org.
      const stillValid = organisation?.id && orgs.some((m) => (m.organisation as any)?.id === organisation.id);
      setOrganisation(stillValid ? organisation : (orgs[0].organisation as Organisation));
    } else {
      setOrganisation(null);
    }
  }, [user, organisation]);

  const checkDatabase = async () => {
    try {
      const { error } = await supabase.from('projects').select('id').limit(1);
      if (error) {
        const message = String(error.message || '');
        const code = String(error.code || '');
        const looksLikeMissingTable =
          code === '42P01' ||
          /does not exist/i.test(message) ||
          /schema cache/i.test(message);
        if (looksLikeMissingTable) setDbSetup(true);
      }
    } catch (e) {
      console.warn('Database check failed (non-fatal):', e);
    }
  };

  const initAuth = async (): Promise<(() => void) | undefined> => {
    let resolveInitialSession: (user: User | null) => void;
    const initialSession = new Promise<User | null>((resolve) => {
      resolveInitialSession = resolve;
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'INITIAL_SESSION') {
          resolveInitialSession(session?.user ?? null);
        }

        if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
          setUser(session.user);
        }

        if (event === 'SIGNED_OUT') {
          const savedUnconfirmed = localStorage.getItem('mep-unconfirmed-user-session');
          if (savedUnconfirmed) {
            try {
              const parsed = JSON.parse(savedUnconfirmed);
              setUser(parsed);
              return;
            } catch (e) {}
          }
          setUser(null);
          setOrganisation(null);
          setOrganisations([]);
          localStorage.removeItem('mep-auth-token-fallback');
          localStorage.removeItem('mep-auth-token');
        }
      }
    );

    const subscription = listener?.subscription;
    const listenerCleanup = () => subscription?.unsubscribe();

    // Supabase native getSession() automatically reads from localStorage,
    // handles PKCE URL parameters, and parses hash tokens.
    const { data: { session }, error } = await supabase.auth.getSession();
    
    let resolvedUser: User | null = session?.user || null;

    if (!resolvedUser) {
      const savedUnconfirmed = localStorage.getItem('mep-unconfirmed-user-session');
      if (savedUnconfirmed) {
        try {
          resolvedUser = JSON.parse(savedUnconfirmed);
        } catch (e) {
          console.warn('Failed to parse saved unconfirmed session', e);
        }
      }
    }

    try {
      if (resolvedUser) {
        setUser(resolvedUser);

        let { data: orgs } = await getUserOrganisations(resolvedUser.id);
        
        // For unconfirmed/trial users with no db orgs yet, assign a default trial workspace
        if ((!orgs || orgs.length === 0) && (!resolvedUser.email_confirmed_at && !(resolvedUser as any).confirmed_at)) {
          const defaultOrg: OrganisationMember = {
            id: `mem_${resolvedUser.id}`,
            user_id: resolvedUser.id,
            organisation_id: `org_demo_${resolvedUser.id}`,
            role: 'admin',
            status: 'active',
            organisation: {
              id: `org_demo_${resolvedUser.id}`,
              name: 'My Workspace (Trial)',
              slug: 'my-workspace',
              created_at: new Date().toISOString()
            } as any
          };
          orgs = [defaultOrg];
        }

        setOrganisations(orgs || []);

        if (orgs && orgs.length > 0) {
          setOrganisation(orgs[0].organisation as Organisation);
        }
      }
    } catch (err) {
      console.error('Auth init error:', err);
    }

    setLoading(false);

    return listenerCleanup;
  };

  const initCompleteRef = useRef(false);

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const init = async () => {
      unsubscribeAuth = await initAuth();
      await checkDatabase();
      initCompleteRef.current = true;
      await recoverAfterResume();
    };

    init();

    // Recover app state on tab return/focus.
    const recoverAfterResume = async () => {
      if (!initCompleteRef.current) {
        console.log('⏳ Skipping session check — initAuth not yet complete');
        return;
      }
      const sessionValid = await refreshSessionIfNeeded({ strict: false, timeoutMs: 7000 });
      if (!sessionValid) {
        console.warn('No valid session on tab return — skipping stale query refresh');
        return;
      }

      setTimeout(() => {
        queryClient.invalidateQueries({ type: 'active' });
      }, 150);
    };

    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        await recoverAfterResume();
      }
    };

    const handleWindowFocus = async () => {
      await recoverAfterResume();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleWindowFocus);

    // Auth state change listener — only re-fetch on TOKEN_REFRESHED (NOT INITIAL_SESSION)
    // INITIAL_SESSION fires on every page load and causes unnecessary query storm
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔄 Auth state changed:', event);
      
      // Only refetch when an existing token is silently refreshed
      if (event === 'TOKEN_REFRESHED') {
        if (session?.user) {
          setTimeout(() => {
            console.log('🔄 Token refreshed - invalidating stale queries...');
            markActiveQueriesStale();
          }, 300);
        }
      }
    });

    // Periodic session refresh check (every 5 minutes)
    // This handles the case where user stays on the same tab for long periods
    const sessionCheckInterval = setInterval(async () => {
      console.log('🔄 Periodic session check...');
      const sessionValid = await refreshSessionIfNeeded({ strict: false, timeoutMs: 7000 });
      
      if (!sessionValid) {
        console.warn('Session expired during periodic check, logging out...');
        handleLogout();
        clearInterval(sessionCheckInterval);
      }
    }, 5 * 60 * 1000); // Every 5 minutes

    return () => {
      unsubscribeAuth?.();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleWindowFocus);
      subscription.unsubscribe();
      clearInterval(sessionCheckInterval);
    };
  }, [handleLogout]);

  // Refresh memberships outside auth event callbacks to avoid supabase-js event loops / stuck queries.
  useEffect(() => {
    if (!user?.id) return;
    const now = Date.now();
    if (now - refreshMembershipsGateRef.current < 500) return;
    refreshMembershipsGateRef.current = now;
    refreshMemberships();
  }, [user?.id]);

  // Memoize AuthContext value to prevent cascade re-renders
  const authContextValue = useMemo(() => ({ 
    user, 
    organisation, 
    organisations, 
    selectedOrganisation: organisation,
    handleLogout,
    switchOrganisation: handleSelectOrganisation
  }), [user, organisation, organisations, handleLogout, handleSelectOrganisation]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner"></div>
      </div>
    );
  }

  if (location.pathname === '/onboarding' || location.pathname === '/test-onboarding') {
    const testUser: User = user || ({
      id: 'test_onboarding_user',
      email: 'onboarding.test@perfecterp.com',
      aud: 'authenticated',
      role: 'authenticated',
      created_at: new Date().toISOString(),
      email_confirmed_at: undefined,
      app_metadata: { provider: 'email' },
      user_metadata: { full_name: 'Test Onboarding User' }
    } as any);

    return (
      <Suspense fallback={<div>Loading onboarding...</div>}>
        <RequestAccessPage
          user={testUser}
          onCreateOrganisation={handleCreateOrganisation}
          onRefreshMemberships={refreshMemberships}
        />
      </Suspense>
    );
  }

  if (!user) {
    const path = location.pathname;
    const isAuthRoute = path === '/login' || path === '/signup' || path === '/callback';

    if (isAuthRoute) {
      const resolvedAuthView = path === '/callback' ? 'callback' : path === '/signup' ? 'signup' : 'login';
      return (
        <Suspense fallback={<div>Loading auth...</div>}>
          {resolvedAuthView === 'login' ? (
            <Login onLogin={() => navigate('/')} />
          ) : resolvedAuthView === 'signup' ? (
            <Signup onSignup={() => {}} />
          ) : (
            <AuthCallback />
          )}
        </Suspense>
      );
    }

    if (path === '/') {
      return <LandingPage />;
    }

    if (path.startsWith('/pricing') || path.startsWith('/help') || path.startsWith('/industries')) {
      window.location.href = path;
      return null;
    }

    window.location.href = '/';
    return null;
  }

  if (organisations.length === 0) {
    return (
      <Suspense fallback={<div>Loading access...</div>}>
        <RequestAccessPage
          user={user}
          onCreateOrganisation={handleCreateOrganisation}
          onRefreshMemberships={refreshMemberships}
        />
      </Suspense>
    );
  }

  if (!organisation) {
    return (
      <Suspense fallback={<div>Loading organisation...</div>}>
        <SelectOrganisation
          organisations={organisations}
          onSelect={handleSelectOrganisation}
          onCreateNew={handleCreateOrganisation}
        />
      </Suspense>
    );
  }

  const isEmbed = new URLSearchParams(window.location.search).get('embed') === 'true';

  if (isEmbed) {
    return (
      <AuthContext.Provider value={authContextValue}>
        <DateFormatProvider>
          <div className="embed-container bg-background min-h-screen w-full">
            <Suspense fallback={<PageSkeleton />}>
              {renderedPage}
            </Suspense>
          </div>
        </DateFormatProvider>
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={authContextValue}>
      <DateFormatProvider>
      <div className="app-container">

        <Suspense fallback={null}>
          <QuickAccessBar
            onNewQuote={handleNewQuote}
            onNewDC={handleNewDC}
            onHelp={handleHelp}
            onLogout={handleLogout}
            onMenuToggle={() => setMobileSidebarOpen(prev => !prev)}
            organisation={organisation}
            sidebarCollapsed={sidebarCollapsed}
          />
        </Suspense>
                 
        {/* Mobile backdrop - closes sidebar when clicked */}
        <div 
          className={`sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
        
        <Suspense fallback={null}>
          <Sidebar currentPath={currentPath} onNavigate={handleSidebarNavigate} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} mobileOpen={mobileSidebarOpen} />
        </Suspense>
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          {user && (!user.email_confirmed_at && !(user as any).confirmed_at) && (
            <div style={{
              background: 'linear-gradient(90deg, #fff9db 0%, #fff3bf 100%)',
              border: '1px solid #ffe066',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px',
              color: '#856404',
              marginBottom: '20px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
              width: '100%',
              boxSizing: 'border-box'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: '#ffe066',
                  fontWeight: 700,
                  fontSize: '13px',
                  color: '#856404',
                  flexShrink: 0
                }}>✉</span>
                <span>
                  <strong>Email verification pending</strong> — Please check your inbox (<strong>{user.email}</strong>) to verify your account. 
                  You have <strong>{getDaysRemaining(user.created_at)} days remaining</strong> in your trial grace period.
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                {resendMessage ? (
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#2b8a3e' }}>{resendMessage}</span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                    style={{
                      background: '#ffffff',
                      border: '1px solid #fab005',
                      borderRadius: '8px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      fontWeight: 600,
                      color: '#856404',
                      cursor: 'pointer',
                      boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                      transition: 'all 0.2s'
                    }}
                  >
                    {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                  </button>
                )}
              </div>
            </div>
          )}

          <Suspense fallback={<PageSkeleton />}>
            {renderedPage}
          </Suspense>
        </main>
      </div>

      {process.env.NODE_ENV === 'development' && <DynamicAgentation />}

      <AnimatePresence>
        {tourOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1200]"
          >
            <div className="absolute inset-0 bg-black/55" />
            {tourRect && (
              <motion.div
                key={tourStep}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.18 }}
                className="absolute rounded-3xl border-2 border-white/90 ring-4 ring-cyan-400/35 shadow-2xl pointer-events-none"
                style={{
                  top: Math.max(8, tourRect.top - 8),
                  left: Math.max(8, tourRect.left - 8),
                  width: tourRect.width + 16,
                  height: tourRect.height + 16,
                }}
              />
            )}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute bottom-6 left-1/2 w-[min(560px,calc(100vw-24px))] -translate-x-1/2 rounded-3xl border border-zinc-200 bg-white p-5 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-zinc-400">
                    Onboarding {tourStep + 1} / {tourSteps.length}
                  </div>
                  <h3 className="mt-2 text-lg font-semibold tracking-tight text-zinc-950">
                    {tourSteps[tourStep].title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-zinc-600">
                    {tourSteps[tourStep].body}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={completeTour}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
                >
                  Skip
                </button>
              </div>

              <div className="mt-5 flex items-center justify-between gap-3">
                <div className="text-xs text-zinc-400">
                  {tourStep === 2 ? 'The next step opens settings.' : 'Use Next to continue.'}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setTourStep((v) => Math.max(0, v - 1))}
                    disabled={tourStep === 0}
                    className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-zinc-50"
                  >
                    Back
                  </button>
                  {tourStep < tourSteps.length - 1 ? (
                    <button
                      type="button"
                      onClick={() => {
                        if (tourSteps[tourStep].action) tourSteps[tourStep].action();
                        setTourStep((v) => v + 1);
                      }}
                      className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Next
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={completeTour}
                      className="rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800"
                    >
                      Finish
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster />
      <ReactQueryDevtools initialIsOpen={false} />
      </DateFormatProvider>
    </AuthContext.Provider>
  );
}

