// src/App.tsx
import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar';
import { supabase, getUserOrganisations, createOrganization, signOut } from './supabase';
import { queryClient } from './queryClient';
import LandingPage from './pages/LandingPage';
import { AuthContext, type AuthContextValue, type Organisation, type OrganisationMember } from './contexts/AuthContext';

export { useAuth } from './contexts/AuthContext';
export type { AuthContextValue, Organisation, OrganisationMember };

// --- ROUTE SECTIONS FOR AUTO-PRELOADING ---
// Group import factories by section for idle-time preloading
type ImportFactory = () => Promise<{ default: ComponentType<any> }>;

const ROUTE_SECTIONS: Record<string, ImportFactory[]> = {
  dc: [
    () => import('./pages/DCList'),
    () => import('./pages/CreateDC'),
    () => import('./pages/DCEdit'),
    () => import('./pages/DateWiseConsolidation'),
    () => import('./pages/MaterialWiseConsolidation'),
  ],
  'nb-dc': [
    () => import('./pages/NonBillableDCList'),
    () => import('./pages/CreateNonBillableDC'),
    () => import('./pages/NonBillableDCEdit'),
  ],
  quotation: [
    () => import('./pages/QuotationList'),
    () => import('./pages/CreateQuotation'),
    () => import('./pages/QuotationView'),
  ],
  store: [
    () => import('./pages/MaterialsList'),
    () => import('./pages/MaterialInward'),
    () => import('./pages/MaterialOutward'),
    () => import('./pages/StockTransfer'),
  ],
  reports: [
    () => import('./pages/Reports').then(m => ({ default: m.StockBalance })),
    () => import('./pages/Reports').then(m => ({ default: m.StockReport })),
    () => import('./pages/Reports').then(m => ({ default: m.PurchaseReport })),
    () => import('./pages/Reports').then(m => ({ default: m.SalesReport })),
  ],
  clients: [
    () => import('./pages/ClientList'),
    () => import('./pages/ClientManagement'),
    () => import('./pages/OrganizationManagement'),
    () => import('./pages/AcceptInvitation'),
  ],
  subcontractors: [
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorDashboard })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.CreateSubcontractor })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorView })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorEdit })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorAttendance })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorDailyLogs })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorPayments })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorInvoices })),
    () => import('./pages/Subcontractors').then(m => ({ default: m.SubcontractorDocuments })),

    () => import('./pages/SubcontractorWorkOrderProfessional').then(m => ({ default: m.WorkOrderList })),
    () => import('./pages/WorkOrderDetailView').then(m => ({ default: m.WorkOrderDetailView })),
  ],
  meetings: [
    () => import('./pages/Meetings').then(m => ({ default: m.MeetingsDashboard })),
    () => import('./pages/Meetings').then(m => ({ default: m.CreateMeeting })),
  ],
  'client-po': [
    () => import('./pages/POList'),
    () => import('./pages/CreatePO'),
    () => import('./pages/PODetails'),
  ],
  invoices: [
    () => import('./invoices/pages/InvoiceListPage'),
    () => import('./invoices/pages/InvoiceEditorPage'),
  ],
  boq: [
    () => import('./pages/BOQList'),
    () => import('./pages/BOQ'),
  ],
  settings: [
    () => import('./pages/Settings'),
    () => import('./pages/PrintSettings'),
    () => import('./pages/TemplateSettings'),
    () => import('./pages/DiscountSettings'),
    () => import('./pages/QuickQuoteSettings'),
    () => import('./pages/TransactionNumberSeries'),
    () => import('./pages/Organisation').then(m => ({ default: m.OrganisationSettings })),
    () => import('./pages/AccessControl'),
  ],
};

const lazyAny = (
  factory: () => Promise<{ default: ComponentType<any> }>
): LazyExoticComponent<ComponentType<any>> => lazy(factory);

// --- SKELETON LOADING COMPONENT ---
const PageSkeleton = () => (
  <div className="flex flex-col h-full animate-pulse">
    {/* Header skeleton */}
    <div className="h-16 bg-gray-100 border-b border-gray-200 flex items-center px-6">
      <div className="h-8 bg-gray-200 rounded w-1/4" />
      <div className="ml-auto flex gap-3">
        <div className="h-8 w-24 bg-gray-200 rounded" />
        <div className="h-8 w-24 bg-gray-200 rounded" />
      </div>
    </div>
    {/* Content skeleton */}
    <div className="flex-1 p-6">
      <div className="h-6 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-100 rounded w-2/3 mb-8" />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-32 bg-gray-100 rounded" />
        <div className="h-32 bg-gray-100 rounded" />
      </div>
      <div className="h-64 bg-gray-100 rounded" />
    </div>
  </div>
);

// Lazy load all pages
const CreateDC = lazyAny(() => import('./pages/CreateDC'));
const CreateNonBillableDC = lazyAny(() => import('./pages/CreateNonBillableDC'));
const DCList = lazyAny(() => import('./pages/DCList'));
const NonBillableDCList = lazyAny(() => import('./pages/NonBillableDCList'));
const DateWiseConsolidation = lazyAny(() => import('./pages/DateWiseConsolidation'));
const MaterialWiseConsolidation = lazyAny(() => import('./pages/MaterialWiseConsolidation'));
const DCConsolidation = lazyAny(() => import('./pages/DCConsolidation').then(m => ({ default: m.default })));
const MaterialsList = lazyAny(() => import('./pages/MaterialsList'));
const StockTransfer = lazyAny(() => import('./pages/StockTransfer'));
const TransactionNumberSeries = lazyAny(() => import('./pages/TransactionNumberSeries'));
const CreatePO = lazyAny(() => import('./pages/CreatePO'));
const POList = lazyAny(() => import('./pages/POList'));
const PODetails = lazyAny(() => import('./pages/PODetails'));
const InvoiceListPage = lazyAny(() => import('./invoices/pages/InvoiceListPage'));
const InvoiceEditorPage = lazyAny(() => import('./invoices/pages/InvoiceEditorPage'));
const LedgerDashboard = lazyAny(() => import('./ledger/LedgerDashboard'));
const ProjectList = lazyAny(() => import('./pages/ProjectList'));
const CreateProject = lazyAny(() => import('./pages/CreateProject'));
const AuthModule = import('./pages/Auth');
const Login = lazyAny(() => AuthModule.then(m => ({ default: m.Login })));
const Signup = lazyAny(() => AuthModule.then(m => ({ default: m.Signup })));
const AuthCallback = lazyAny(() => AuthModule.then(m => ({ default: m.AuthCallback })));
const SelectOrganisation = lazyAny(() => AuthModule.then(m => ({ default: m.SelectOrganisation })));
const RequestAccessPage = lazyAny(() => import('./pages/RequestAccess'));
const AccessControlPage = lazyAny(() => import('./pages/AccessControl'));
const OrganisationSettings = lazyAny(() => import('./pages/Organisation').then(m => ({ default: m.OrganisationSettings })));
const QuotationList = lazyAny(() => import('./pages/QuotationList'));
const CreateQuotation = lazyAny(() => import('./pages/CreateQuotation'));
const QuotationView = lazyAny(() => import('./pages/QuotationView'));
const TemplateSettings = lazyAny(() => import('./pages/TemplateSettings'));
const DiscountSettings = lazyAny(() => import('./pages/DiscountSettings'));
const QuickQuoteSettings = lazyAny(() => import('./pages/QuickQuoteSettings'));
const QuickStockCheckList = lazyAny(() => import('./pages/QuickStockCheckList'));
const QuickStockCheck = lazyAny(() => import('./pages/QuickStockCheck'));
const ProcurementList = lazyAny(() => import('./pages/ProcurementList'));
const ProcurementDetail = lazyAny(() => import('./pages/ProcurementDetail'));
const Projects = lazyAny(() => import('./pages/Projects'));

// Lazy load internally moved pages
const Dashboard = lazyAny(() => import('./pages/Dashboard'));
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
const Meetings = import('./pages/Meetings');
const MeetingsDashboard = lazyAny(() => Meetings.then(m => ({ default: m.MeetingsDashboard })));
const CreateMeeting = lazyAny(() => Meetings.then(m => ({ default: m.CreateMeeting })));
const ClientRequests = lazyAny(() => import('./pages/ClientRequests'));
const SiteVisits = lazyAny(() => import('./pages/SiteVisits').then(m => ({ default: m.SiteVisits })));
const SiteReport = lazyAny(() => import('./pages/SiteReport').then(m => ({ default: m.SiteReport })));
const ClientCommunication = lazyAny(() => import('./pages/ClientCommunication').then(m => ({ default: m.ClientCommunication })));
const Subcontractors = import('./pages/Subcontractors');
const SubcontractorDashboard = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorDashboard })));
const CreateSubcontractor = lazyAny(() => Subcontractors.then(m => ({ default: m.CreateSubcontractor })));
const SubcontractorView = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorView })));
const SubcontractorEdit = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorEdit })));
const SubcontractorAttendance = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorAttendance })));
const SubcontractorWorkOrders = lazyAny(() => import('./pages/SubcontractorWorkOrderProfessional').then(m => ({ default: m.WorkOrderList })));
const WorkOrderDetailView = lazyAny(() => import('./pages/WorkOrderDetailView').then(m => ({ default: m.WorkOrderDetailView })));
const SubcontractorDailyLogs = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorDailyLogs })));
const SubcontractorPayments = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorPayments })));
const SubcontractorInvoices = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorInvoices })));
const SubcontractorDocuments = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorDocuments })));

const Reports = import('./pages/Reports');
const StockBalance = lazyAny(() => Reports.then(m => ({ default: m.StockBalance })));
const StockReport = lazyAny(() => Reports.then(m => ({ default: m.StockReport })));
const PurchaseReport = lazyAny(() => Reports.then(m => ({ default: m.PurchaseReport })));
const SalesReport = lazyAny(() => Reports.then(m => ({ default: m.SalesReport })));
const ProjectManagementInternal = import('./pages/ProjectManagementInternal');
const SiteMaterials = lazyAny(() => ProjectManagementInternal.then(m => ({ default: m.SiteMaterials })));
const ToolsList = lazyAny(() => ProjectManagementInternal.then(m => ({ default: m.ToolsList })));
const PurchaseModule = lazyAny(() => import('./modules/Purchase/PurchaseModule'));
const BOQ = lazyAny(() => import('./pages/BOQ'));
const BOQList = lazyAny(() => import('./pages/BOQList'));
const IssueList = lazyAny(() => ProjectManagementInternal.then(m => ({ default: m.IssueList })));
const ClientComm = lazyAny(() => ProjectManagementInternal.then(m => ({ default: m.ClientComm })));
const Documents = lazyAny(() => ProjectManagementInternal.then(m => ({ default: m.Documents })));
const DCEdit = lazyAny(() => import('./pages/DCEdit'));
const NonBillableDCEdit = lazyAny(() => import('./pages/NonBillableDCEdit'));
const SettingsPage = lazyAny(() => import('./pages/Settings'));
const PrintSettings = lazyAny(() => import('./pages/PrintSettings'));
const DatabaseSetup = lazyAny(() => import('./pages/DatabaseSetup'));
const EmployeeCheckIn = lazyAny(() => import('./pages/EmployeeCheckIn'));
const HRAdminDashboard = lazyAny(() => import('./pages/HRAdminDashboard'));

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

export default function App() {
  const location = useLocation();
  const routerNavigate = useNavigate();
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'callback'>('login');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dbSetup, setDbSetup] = useState(false);
  const currentPath = `${location.pathname}${location.search}` || '/';

  // Use refs to avoid stale closures in event listeners
  const lastCheckRef = useRef(0);
  const isCheckingRef = useRef(false);
  const heartbeatAbortRef = useRef<AbortController | null>(null);
  // Stable ref to latest user so the focus handler never captures a stale closure
  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const navigate = useCallback((path?: string) => {
    routerNavigate(path || '/');
  }, [routerNavigate]);

  
  const handleSidebarNavigate = useCallback((path: string) => {
    navigate(path);
    setMobileSidebarOpen(false);
  }, [navigate]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  
  const renderedPage = useMemo(() => {
    const pathKey = (currentPath || '/').split('?')[0];
    
    switch (pathKey) {
      case '/': 
        return user ? <Dashboard onNavigate={navigate} /> : <LandingPage />;
      case '/login': 
        return user ? <Dashboard onNavigate={navigate} /> : <Login onLogin={() => {}} onSwitch={() => setAuthView('signup')} />;
      case '/dashboard': 
        return <Dashboard onNavigate={navigate} />;
      case '/projects': return <Projects />;
      case '/projects/new': return <CreateProject onSuccess={() => navigate('/projects')} onCancel={() => navigate('/projects')} />;
      case '/projects/edit': return <Projects />;
      case '/projects/daily-updates': return <Projects />;
      case '/projects/site-materials': return <Projects />;
      case '/todo': return <TodoList />;
      case '/remindme': return <RemindMe />;
      case '/approvals': return <Approvals />;
      case '/clients/new': return <CreateClient onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients/edit': return <CreateClientEdit onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients': return <ClientList />;
      case '/meetings': return <MeetingsDashboard onNavigate={navigate} />;
      case '/meetings/create': return <CreateMeeting onSuccess={() => navigate('/meetings')} onCancel={() => navigate('/meetings')} />;
      case '/meetings/edit': return <CreateMeeting onSuccess={() => navigate('/meetings')} onCancel={() => navigate('/meetings')} editMode={true} />;
      case '/site-visits': return <SiteVisits />;
      case '/site-reports': return <SiteReport />;
      case '/client-communication': return <ClientCommunication />;
      case '/subcontractors': return <SubcontractorDashboard onNavigate={navigate} />;
      case '/subcontractors/new': return <CreateSubcontractor onSuccess={() => navigate('/subcontractors')} onCancel={() => navigate('/subcontractors')} />;
      case '/subcontractors/view': return <SubcontractorView onNavigate={navigate} />;
      case '/subcontractors/edit': return <SubcontractorEdit onNavigate={navigate} />;
      case '/subcontractors/workorders': return <SubcontractorWorkOrders />;
      case '/subcontractors/attendance': return <SubcontractorAttendance />;
      case '/subcontractors/dailylogs': return <SubcontractorDailyLogs />;
      case '/subcontractors/payments': return <SubcontractorPayments />;
      case '/subcontractors/invoices': return <SubcontractorInvoices />;
      case '/subcontractors/documents': return <SubcontractorDocuments />;

      // Client PO
      case '/client-po': return <POList />;
      case '/client-po/create': return <CreatePO onSuccess={() => navigate('/client-po')} onCancel={() => navigate('/client-po')} />;
      // Sales
      case '/client-po/view': return <PODetails />;
      case '/quotation': return <QuotationList />;
      case '/quotation/create': return <CreateQuotation onSuccess={() => navigate('/quotation')} onCancel={() => navigate('/quotation')} />;
      case '/quotation/view': return <QuotationView />;
      case '/quotation/edit': return <CreateQuotation onSuccess={() => navigate('/quotation')} onCancel={() => navigate('/quotation')} editMode={true} />;
      case '/invoices': return <InvoiceListPage />;
      case '/invoices/create': return <InvoiceEditorPage />;
      case '/ledger': return <LedgerDashboard onNavigate={navigate} />;
      case '/boq': return <BOQList />;
      case '/boq/create': return <BOQ onSuccess={() => navigate('/boq')} onCancel={() => navigate('/boq')} />;
      case '/documents': return <Documents />;
      case '/issue': return <IssueList />;
      case '/purchase':
      case '/purchase/vendors':
      case '/purchase/orders':
      case '/purchase/bills':
      case '/purchase/debit-notes':
      case '/purchase/payments':
      case '/purchase/payment-queue':
        return <PurchaseModule />;
      // Inventory
      case '/procurement': return <ProcurementList />;
      case '/store/materials': return <MaterialsList />;
      case '/store/inward': return <MaterialInward />;
      case '/store/outward': return <MaterialOutward />;
      case '/store/transfer': return <StockTransfer />;
      case '/store/stock': return <StockBalance />;
      case '/quick-stock-check': return <QuickStockCheck />;
      // Delivery Challan
      case '/dc/create': return <CreateDC onCancel={() => navigate('/dc/list')} />;
      case '/dc/list': return <DCList />;
      case '/dc/consolidation': return <DCConsolidation />;
      case '/dc/consolidation/date': return <DateWiseConsolidation />;
      case '/dc/consolidation/material': return <MaterialWiseConsolidation />;
      case '/nb-dc/list': return <NonBillableDCList />;
      case '/nb-dc/create': return <CreateNonBillableDC onCancel={() => navigate('/nb-dc/list')} />;
      // Settings
      case '/settings': return <SettingsPage />;
      case '/settings/print': return <PrintSettings />;
      case '/settings/template': return <TemplateSettings />;
      case '/settings/discounts': return <DiscountSettings />;
      case '/settings/quick-quote': return <QuickQuoteSettings />;
      case '/settings/document-series': return <TransactionNumberSeries />;
      case '/settings/organisation': return <OrganisationSettings organisation={organisation} userId={user?.id} />;
      case '/settings/access-control': return <AccessControlPage />;
      default:
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
          const id = pathKey.split('/subcontractors/workorders/')[1];
          return <WorkOrderDetailView />;
        }
        return <Dashboard onNavigate={navigate} />;
    }
  }, [currentPath, navigate, user]);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setOrganisation(null);
    setOrganisations([]);
    setAuthView('login');
  };

  const handleSelectOrganisation = (org: Organisation) => {
    setOrganisation(org);
  };

  const handleCreateOrganisation = async (orgName: string) => {
    if (!user) return;

    const { data, error } = (await createOrganization(orgName, user.id)) as CreateOrganisationResult;
    if (error) {
      console.error('Create org error:', error);
      alert('Error creating organisation: ' + (error.message || 'Unknown error'));
      return;
    }
    if (data) {
      const { data: orgs } = await getUserOrganisations(user.id);
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
    try {
      const { data: { session } } = await supabase.auth.getSession();

      if (session?.user) {
        setUser(session.user);

        const { data: orgs } = await getUserOrganisations(session.user.id);
        setOrganisations(orgs || []);

        if (orgs && orgs.length > 0) {
          setOrganisation(orgs[0].organisation as Organisation);
        }
      }
    } catch (error) {
      console.error('Auth init error:', error);
    }

    setLoading(false);

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);

          const { data: orgs } = await getUserOrganisations(session.user.id);
          setOrganisations(orgs || []);

          if (orgs && orgs.length > 0) {
            setOrganisation(orgs[0].organisation as Organisation);
          }
        }

        if (event === 'SIGNED_OUT') {
          setUser(null);
          setOrganisation(null);
          setOrganisations([]);
        }
      }
    );

    return () => {
      listener?.subscription?.unsubscribe();
    };
  };

  useEffect(() => {
    let unsubscribeAuth: (() => void) | undefined;

    const init = async () => {
      unsubscribeAuth = await initAuth();
      await checkDatabase();
    };

    init();

    // --- SESSION HEARTBEAT ON TAB RETURN ---
    // Validates auth session when user returns to tab after extended absence.
    // React Query handles data freshness via refetchOnWindowFocus: 'always' + staleTime.
    // This only checks if the Supabase session is still valid (token not expired).
    const handleFocus = async () => {
      const now = Date.now();

      // Throttle: max once every 5 minutes
      if (now - lastCheckRef.current < 300000) return;

      // Prevent concurrent checks
      if (isCheckingRef.current) return;

      lastCheckRef.current = now;
      isCheckingRef.current = true;

      // Abort previous heartbeat if still running
      heartbeatAbortRef.current?.abort();
      heartbeatAbortRef.current = new AbortController();
      const ctrl = heartbeatAbortRef.current;

      try {
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
          const timer = setTimeout(() => reject(new Error('Session check timeout')), 5000);
          ctrl.signal.addEventListener('abort', () => {
            clearTimeout(timer);
            reject(new Error('Aborted'));
          });
        });

        const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]) as any;

        if (!error && session?.user) {
          if (userRef.current?.id !== session.user.id) {
            setUser(session.user);
          }
        }
      } catch {
        // Silently ignore — auth will refresh on next real interaction
      } finally {
        isCheckingRef.current = false;
        heartbeatAbortRef.current = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        if ('requestIdleCallback' in window) {
          requestIdleCallback(() => handleFocus(), { timeout: 2000 });
        } else {
          setTimeout(handleFocus, 100);
        }
      }
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', handleVisibility);

    return () => {
      unsubscribeAuth?.();
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleVisibility);
      heartbeatAbortRef.current?.abort();
    };
    // ⚠️ INTENTIONALLY empty deps [] — listeners must only be registered ONCE at mount.
    // We use refs (userRef, lastCheckRef, isCheckingRef) to read latest values without re-subscribing.
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (dbSetup) {
    return (
      <Suspense fallback={<div>Loading setup...</div>}>
        <DatabaseSetup />
      </Suspense>
    );
  }

  if (!user) {
    return (
      <Suspense fallback={<div>Loading auth...</div>}>
        {authView === 'login' ? (
          <Login onLogin={() => {}} onSwitch={() => setAuthView('signup')} />
        ) : authView === 'signup' ? (
          <Signup onSignup={() => setAuthView('login')} onSwitch={() => setAuthView('login')} />
        ) : (
          <AuthCallback />
        )}
      </Suspense>
    );
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

  return (
    <AuthContext.Provider value={{ 
      user, 
      organisation, 
      organisations, 
      selectedOrganisation: organisation,
      handleLogout,
      switchOrganisation: handleSelectOrganisation
    }}>
      <div className="app-container">
                
        {/* Mobile backdrop - closes sidebar when clicked */}
        <div 
          className={`sidebar-backdrop ${mobileSidebarOpen ? 'active' : ''}`}
          onClick={() => setMobileSidebarOpen(false)}
          aria-hidden="true"
        />
        
        <Sidebar currentPath={currentPath} onNavigate={handleSidebarNavigate} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} mobileOpen={mobileSidebarOpen} />
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Suspense fallback={<PageSkeleton />}>
            {renderedPage}
          </Suspense>
        </main>
      </div>
      <ReactQueryDevtools initialIsOpen={false} />
    </AuthContext.Provider>
  );
}