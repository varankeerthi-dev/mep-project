import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import QuickAccessBar from './components/QuickAccessBar';
import { supabase, getUserOrganisations, createOrganisation, signOut, initStorageBuckets } from './supabase';
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
      initStorageBuckets().catch(() => {});
    };

    init();

    // Optimized heartbeat check - throttled and non-blocking
    const handleFocus = async () => {
      const now = Date.now();
      
      // Throttle: max once every 5 minutes
      if (now - lastCheckRef.current < 300000) return;
      
      // Prevent concurrent checks
      if (isCheckingRef.current) return;
      
      lastCheckRef.current = now;
      isCheckingRef.current = true;

      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          setUser(prev => {
            // Only update if user ID actually changed
            if (prev?.id !== session.user.id) return session.user;
            return prev;
          });
        }
      } catch (e) {
        console.warn('Heartbeat check failed', e);
      } finally {
        isCheckingRef.current = false;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Use requestIdleCallback if available to not block main thread
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
    };
  }, []);

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

    const { data, error } = (await createOrganisation(orgName, user.id)) as CreateOrganisationResult;
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

  const navigate = useCallback((path?: string) => {
    routerNavigate(path || '/');
  }, [routerNavigate]);

  const handleQuickAction = useCallback((action: QuickAction) => {
    switch (action) {
      case 'new-dc': navigate('/dc/create'); break;
      case 'daily-updates': navigate('/projects/daily-updates'); break;
      case 'approvals': navigate('/approvals'); break;
      case 'remind': navigate('/remindme'); break;
      case 'search': navigate('/dc/list'); break;
      case 'export': navigate('/dc/list'); break;
      default: break;
    }
  }, [navigate]);

  const handleSidebarNavigate = useCallback((path: string) => {
    navigate(path);
    setMobileSidebarOpen(false);
  }, [navigate]);

  const handleSidebarToggle = useCallback(() => {
    setSidebarCollapsed(prev => !prev);
  }, []);

  const handleMenuToggle = useCallback(() => {
    setMobileSidebarOpen(prev => !prev);
  }, []);

  const renderPage = useCallback((authUser: User | null, authOrg: Organisation | null) => {
    const pathKey = currentPath.split('?')[0];
    
    switch (pathKey) {
      case '/': 
        return authUser ? <Dashboard onNavigate={navigate} /> : <LandingPage />;
      case '/login': 
        return authUser ? <Dashboard onNavigate={navigate} /> : <Login onLogin={() => {}} onSwitch={() => setAuthView('signup')} />;
      case '/projects': return <Projects />;
      case '/projects/new': return <Projects />;
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
      case '/subcontractors/attendance': return <SubcontractorAttendance onNavigate={navigate} />;
      case '/subcontractors/workorders': return <SubcontractorWorkOrders onNavigate={navigate} />;
      case '/subcontractors/work-orders': return <WorkOrderDetailView onBack={() => navigate('/subcontractors/workorders')} />;
      case '/subcontractors/dailylogs': return <SubcontractorDailyLogs onNavigate={navigate} />;
      case '/subcontractors/payments': return <SubcontractorPayments onNavigate={navigate} />;
      case '/subcontractors/invoices': return <SubcontractorInvoices onNavigate={navigate} />;
      case '/subcontractors/documents': return <SubcontractorDocuments onNavigate={navigate} />;
      case '/client-requests': return <ClientRequests />;
      case '/quotation': return <QuotationList />;
      case '/quotation/create': return <CreateQuotation />;
      case '/quotation/edit': return <CreateQuotation />;
      case '/quotation/view': return <QuotationView />;
      case '/settings/discounts': return <DiscountSettings />;
      case '/boq': return <BOQList />;
      case '/boq/create': return <BOQ />;
      case '/issue': return <IssueList />;
      case '/client-comm': return <ClientComm />;
      case '/documents': return <Documents />;
      case '/store/materials': return <MaterialsList />;
      case '/store/inward': return <MaterialInward onSuccess={() => navigate('/store/stock')} onCancel={() => navigate('/store/stock')} />;
      case '/store/outward': return <MaterialOutward onSuccess={() => navigate('/store/stock')} onCancel={() => navigate('/store/stock')} />;
      case '/store/transfer': return <StockTransfer onCancel={() => navigate('/store/stock')} />;
      case '/store/stock': return <StockBalance />;
      case '/tools': return <ToolsList />;
      case '/purchase': return <PurchaseModule />;
      case '/dc/create': return <CreateDC onSuccess={() => navigate('/dc/list')} onCancel={() => navigate('/dc/list')} />;
      case '/dc/list': return <DCList />;
      case '/dc/consolidation/date': return <DateWiseConsolidation />;
      case '/dc/consolidation/material': return <MaterialWiseConsolidation />;
      case '/nb-dc/create': return <CreateNonBillableDC onSuccess={() => navigate('/nb-dc/list')} onCancel={() => navigate('/nb-dc/list')} />;
      case '/nb-dc/list': return <NonBillableDCList />;
      case '/reports/stock': return <StockReport />;
      case '/reports/purchase': return <PurchaseReport />;
      case '/reports/sales': return <SalesReport />;
      case '/settings': return <SettingsPage />;
      case '/settings/print': return <PrintSettings />;
      case '/settings/organisation': return <OrganisationSettings organisation={authOrg} userId={authUser?.id} />;
      case '/settings/document-series': return <TransactionNumberSeries />;
      case '/settings/template': return <TemplateSettings />;
      case '/settings/access-control': return <AccessControlPage />;
      case '/quick-stock-check': return <QuickStockCheckList />;
      case '/quick-stock-check/create': return <QuickStockCheck />;
      case '/quick-stock-check/edit': return <QuickStockCheck />;
      case '/quick-stock-check/view': return <QuickStockCheck />;
      case '/procurement': return <ProcurementList />;
      case '/procurement/detail': return <ProcurementDetail />;
      case '/client-po': return <POList />;
      case '/client-po/create': return <CreatePO />;
      case '/client-po/details': return <PODetails />;
      case '/invoices': return <InvoiceListPage />;
      case '/invoices/create': return <InvoiceEditorPage />;
      case '/invoices/edit': return <InvoiceEditorPage />;
      case '/ledger': return <LedgerDashboard />;
      case '/employee/checkin': return <EmployeeCheckIn />;
      case '/hr/dashboard': return <HRAdminDashboard />;
      default:
        if (pathKey.startsWith('/dc/edit/')) {
          const dcId = pathKey.split('/dc/edit/')[1];
          return <DCEdit dcId={dcId} onCancel={() => navigate('/dc/list')} />;
        }
        if (pathKey.startsWith('/nb-dc/edit/')) {
          const dcId = pathKey.split('/nb-dc/edit/')[1];
          return <NonBillableDCEdit dcId={dcId} onCancel={() => navigate('/nb-dc/list')} />;
        }
        return <Dashboard onNavigate={navigate} />;
    }
  }, [currentPath, navigate]);

  // Memoize rendered page with stable dependencies
  const renderedPage = useMemo(
    () => renderPage(user, organisation),
    [currentPath, user?.id, organisation?.id, renderPage]
  );

  // --- AUTO-PRELOAD: Current section routes on idle ---
  useEffect(() => {
    const pathKey = (currentPath || '').split('?')[0];
    const currentSection = pathKey.split('/')[1]; // 'dc', 'quotation', 'store', etc.
    
    const routesToPreload = ROUTE_SECTIONS[currentSection];
    if (!routesToPreload || routesToPreload.length === 0) return;

    // Use requestIdleCallback to preload when browser is idle
    const preloadSection = () => {
      routesToPreload.forEach(importFn => {
        // Preload but don't execute - just warm the cache
        importFn().catch(() => {});
      });
    };

    let handle: number | undefined;
    if ('requestIdleCallback' in window) {
      handle = requestIdleCallback(preloadSection, { timeout: 3000 });
    } else {
      // Fallback: delay preloading to not block initial render
      handle = window.setTimeout(preloadSection, 500) as unknown as number;
    }

    return () => {
      if (handle) {
        if ('cancelIdleCallback' in window) {
          cancelIdleCallback(handle);
        } else {
          clearTimeout(handle);
        }
      }
    };
  }, [currentPath]);

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
    <AuthContext.Provider value={{ user, organisation, organisations, handleLogout }}>
      <div className="app-container">
        <QuickAccessBar onQuickAction={handleQuickAction} organisation={organisation} onLogout={handleLogout} onMenuToggle={handleMenuToggle} />
        <Sidebar currentPath={currentPath} onNavigate={handleSidebarNavigate} collapsed={sidebarCollapsed} onToggle={handleSidebarToggle} mobileOpen={mobileSidebarOpen} />
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Suspense fallback={<PageSkeleton />}>
            {renderedPage}
          </Suspense>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
