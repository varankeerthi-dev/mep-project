import { useState, useEffect, useMemo, useCallback, createContext, useContext, lazy, Suspense } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import QuickAccessBar from './components/QuickAccessBar';
import { supabase, getUserOrganisations, createOrganisation, signOut, initStorageBuckets } from './supabase';
import LandingPage from './pages/LandingPage';

const lazyAny = (
  factory: () => Promise<{ default: ComponentType<any> }>
): LazyExoticComponent<ComponentType<any>> => lazy(factory);

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
const ProjectList = lazyAny(() => import('./pages/ProjectList'));
const CreateProject = lazyAny(() => import('./pages/CreateProject'));
const AuthModule = import('./pages/Auth');
const Login = lazyAny(() => AuthModule.then(m => ({ default: m.Login })));
const Signup = lazyAny(() => AuthModule.then(m => ({ default: m.Signup })));
const AuthCallback = lazyAny(() => AuthModule.then(m => ({ default: m.AuthCallback })));
const SelectOrganisation = lazyAny(() => AuthModule.then(m => ({ default: m.SelectOrganisation })));
const OrganisationSettings = lazyAny(() => import('./pages/Organisation').then(m => ({ default: m.OrganisationSettings })));
const QuotationList = lazyAny(() => import('./pages/QuotationList'));
const CreateQuotation = lazyAny(() => import('./pages/CreateQuotation'));
const QuotationView = lazyAny(() => import('./pages/QuotationView'));
const TemplateSettings = lazyAny(() => import('./pages/TemplateSettings'));
const DiscountSettings = lazyAny(() => import('./pages/DiscountSettings'));
const QuickStockCheckList = lazyAny(() => import('./pages/QuickStockCheckList'));
const QuickStockCheck = lazyAny(() => import('./pages/QuickStockCheck'));

// Lazy load internally moved pages
const Dashboard = lazyAny(() => import('./pages/Dashboard'));
const DailyUpdates = lazyAny(() => import('./pages/DailyUpdates'));
const TodoList = lazyAny(() => import('./pages/TodoList'));
const RemindMe = lazyAny(() => import('./pages/RemindMe'));
const Approvals = lazyAny(() => import('./pages/Approvals'));
const ClientManagement = import('./pages/ClientManagement');
const CreateClient = lazyAny(() => ClientManagement.then(m => ({ default: m.CreateClient })));
const CreateClientEdit = lazyAny(() => ClientManagement.then(m => ({ default: m.CreateClientEdit })));
const ClientList = lazyAny(() => import('./pages/ClientList'));
const MaterialInward = lazyAny(() => import('./pages/MaterialInward'));
const MaterialOutward = lazyAny(() => import('./pages/MaterialOutward'));
const Meetings = import('./pages/Meetings');
const MeetingsDashboard = lazyAny(() => Meetings.then(m => ({ default: m.MeetingsDashboard })));
const CreateMeeting = lazyAny(() => Meetings.then(m => ({ default: m.CreateMeeting })));
const ClientRequests = lazyAny(() => import('./pages/ClientRequests'));
const SiteVisits = lazyAny(() => import('./pages/SiteVisits').then(m => ({ default: m.SiteVisits })));
const ClientCommunication = lazyAny(() => import('./pages/ClientCommunication').then(m => ({ default: m.ClientCommunication })));
const Subcontractors = import('./pages/Subcontractors');
const SubcontractorDashboard = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorDashboard })));
const CreateSubcontractor = lazyAny(() => Subcontractors.then(m => ({ default: m.CreateSubcontractor })));
const SubcontractorView = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorView })));
const SubcontractorEdit = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorEdit })));
const SubcontractorAttendance = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorAttendance })));
const SubcontractorWorkOrders = lazyAny(() => Subcontractors.then(m => ({ default: m.SubcontractorWorkOrders })));
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

type Organisation = {
  id?: string;
  name?: string;
  [key: string]: unknown;
};

type OrganisationMember = {
  organisation?: Organisation | null;
  organisation_id?: string | null;
  [key: string]: unknown;
};

type CreateOrganisationResult = {
  data?: Organisation | null;
  error?: { message?: string } | null;
};

type AuthContextValue = {
  user: User | null;
  organisation: Organisation | null;
  organisations: OrganisationMember[];
  handleLogout: () => Promise<void>;
};

type QuickAction =
  | 'new-dc'
  | 'daily-updates'
  | 'approvals'
  | 'remind'
  | 'search'
  | 'export';

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthContext provider');
  }
  return ctx;
}

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

  const checkDatabase = async () => {
    try {
      const { error } = await supabase.from('projects').select('id').limit(1);
      // Only treat "table/schema missing" as DB setup required.
      // Transient network/auth/RLS issues should not force the app into setup mode.
      if (error) {
        const message = String(error.message || '');
        const code = String(error.code || '');
        const looksLikeMissingTable =
          code === '42P01' || // postgres undefined_table
          /does not exist/i.test(message) ||
          /schema cache/i.test(message);
        if (looksLikeMissingTable) setDbSetup(true);
      }
    } catch (e) {
      // Don't assume DB is missing on unexpected runtime errors.
      console.warn('Database check failed (non-fatal):', e);
    }
  };

  const initAuth = async (): Promise<(() => void) | undefined> => {
    try {
      // IMPORTANT: wait for session restoration
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
  let lastCheck = 0;

  const init = async () => {
    unsubscribeAuth = await initAuth();
    await checkDatabase();
    initStorageBuckets().catch(() => {});
  };

  init();

  const handleFocus = async () => {
    const now = Date.now();
    if (now - lastCheck < 300000) return;
    lastCheck = now;

    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (!error && session?.user) {
        // Use functional update to avoid reading stale user from closure
        setUser(prev => {
          if (prev?.id !== session.user.id) return session.user;
          return prev;
        });
      }
    } catch (e) {
      console.warn('Heartbeat check failed', e);
    }
  };

  const handleVisibility = () => {
    if (document.visibilityState === 'visible') {
      handleFocus();
    }
  };

  window.addEventListener('focus', handleFocus);
  window.addEventListener('visibilitychange', handleVisibility);

  return () => {
    unsubscribeAuth?.();
    window.removeEventListener('focus', handleFocus);
    window.removeEventListener('visibilitychange', handleVisibility);
  };
}, []); // ← Empty deps. No more re-runs on user change.

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

  const navigate = useCallback((path?: string) => {
    routerNavigate(path || '/');
  }, [routerNavigate]);

  const handleQuickAction = (action: QuickAction) => {
    switch (action) {
      case 'new-dc': navigate('/dc/create'); break;
      case 'daily-updates': navigate('/projects/daily-updates'); break;
      case 'approvals': navigate('/approvals'); break;
      case 'remind': navigate('/remindme'); break;
      case 'search': navigate('/dc/list'); break;
      case 'export': navigate('/dc/list'); break;
      default: break;
    }
  };

  const renderPage = (authUser: User | null, authOrg: Organisation | null) => {
    const pathKey = currentPath.split('?')[0]
    switch (pathKey) {
      case '/': return <LandingPage />;
      case '/login': return <Login onLogin={() => {}} onSwitch={() => setAuthView('signup')} />;
      case '/projects/new': return <CreateProject onSuccess={() => navigate('/projects')} onCancel={() => navigate('/projects')} />;
      case '/projects/edit': return <CreateProject />;
      case '/projects': return <ProjectList />;
      case '/projects/daily-updates': return <DailyUpdates />;
      case '/projects/site-materials': return <SiteMaterials />;
      case '/todo': return <TodoList />;
      case '/remindme': return <RemindMe />;
      case '/approvals': return <Approvals />;
      case '/clients/new': return <CreateClient onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients/edit': return <CreateClientEdit onSuccess={() => navigate('/clients')} onCancel={() => navigate('/clients')} />;
      case '/clients': return <ClientList />;
      case '/meetings': return <MeetingsDashboard onNavigate={navigate} />;
      case '/meetings/create': return <CreateMeeting onSuccess={() => navigate('/meetings')} onCancel={() => navigate('/meetings')} />;
      case '/meetings/edit': return <CreateMeeting onSuccess={() => navigate('/meetings')} onCancel={() => navigate('/meetings')} editMode={true} />;
      case '/site-visits':
        return <SiteVisits />
      case '/client-communication':
        return <ClientCommunication />
      case '/subcontractors': return <SubcontractorDashboard onNavigate={navigate} />;
      case '/subcontractors/new': return <CreateSubcontractor onSuccess={() => navigate('/subcontractors')} onCancel={() => navigate('/subcontractors')} />;
      case '/subcontractors/view': return <SubcontractorView onNavigate={navigate} />;
      case '/subcontractors/edit': return <SubcontractorEdit onNavigate={navigate} />;
      case '/subcontractors/attendance': return <SubcontractorAttendance onNavigate={navigate} />;
      case '/subcontractors/workorders': return <SubcontractorWorkOrders onNavigate={navigate} />;
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
      case '/quick-stock-check': return <QuickStockCheckList />;
      case '/quick-stock-check/create': return <QuickStockCheck />;
      case '/quick-stock-check/edit': return <QuickStockCheck />;
      case '/quick-stock-check/view': return <QuickStockCheck />;
      case '/client-po': return <POList />;
      case '/client-po/create': return <CreatePO />;
      case '/client-po/details': return <PODetails />;
      default:
        // Handle dynamic routes
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
  };

  const renderedPage = useMemo(
    () => renderPage(user, organisation),
    [currentPath, user?.id, organisation?.id]
  );

  // Prefetch heavier routes when user is already in the Quotation area.
  // This keeps UI the same but reduces delay when navigating to create/edit.
  useEffect(() => {
    const pathKey = (currentPath || '').split('?')[0];
    if (pathKey === '/quotation') {
      import('./pages/CreateQuotation').catch(() => {});
    }
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

  if (organisations.length === 0 || !organisation) {
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
        <QuickAccessBar onQuickAction={handleQuickAction} organisation={organisation} onLogout={handleLogout} onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <Sidebar currentPath={currentPath} onNavigate={(path) => { navigate(path); setMobileSidebarOpen(false); }} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} mobileOpen={mobileSidebarOpen} />
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
          <Suspense fallback={
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
              <div className="loading-spinner">Loading page...</div>
            </div>
          }>
            {renderedPage}
          </Suspense>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
