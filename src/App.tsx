// src/App.tsx
import { useState, useEffect, useMemo, useCallback, lazy, Suspense, useRef } from 'react';
import type { ComponentType, LazyExoticComponent } from 'react';
import type { User } from '@supabase/supabase-js';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import Sidebar from './components/Sidebar';
import { supabase, getUserOrganisations, createOrganization, signOut } from './supabase';
import { queryClient, refreshSessionIfNeeded } from './queryClient';
import LandingPage from './pages/LandingPage';
import { AuthContext, type AuthContextValue, type Organisation, type OrganisationMember } from './contexts/AuthContext';

export { useAuth } from './contexts/AuthContext';
export type { AuthContextValue, Organisation, OrganisationMember };

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
const ProformaListPage = lazyAny(() => import('./proforma-invoices/pages/ProformaListPage'));
const ProformaEditorPage = lazyAny(() => import('./proforma-invoices/pages/ProformaEditorPage'));
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
  const queryClient = useQueryClient();
  const [user, setUser] = useState<User | null>(null);
  const [organisation, setOrganisation] = useState<Organisation | null>(null);
  const [organisations, setOrganisations] = useState<OrganisationMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState<'login' | 'signup' | 'callback'>('login');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dbSetup, setDbSetup] = useState(false);
  const currentPath = `${location.pathname}${location.search}` || '/';
  const tokenInvalidateGateRef = useRef(0);
  const refreshMembershipsGateRef = useRef(0);

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
      case '/proforma-invoices': return <ProformaListPage />;
      case '/proforma-invoices/create': return <ProformaEditorPage />;
      case '/proforma-invoices/edit': return <ProformaEditorPage />;
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

  const handleLogout = useCallback(async () => {
    await signOut();
    setUser(null);
    setOrganisation(null);
    setOrganisations([]);
    setAuthView('login');
  }, []);

  const handleSelectOrganisation = useCallback((org: Organisation) => {
    setOrganisation(org);
  }, []);

  const handleCreateOrganisation = async (orgName: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      alert('Session expired. Please sign in again.');
      return;
    }

    const { data, error } = (await createOrganization(orgName, session.user.id)) as CreateOrganisationResult;
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
      (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          setUser(session.user);
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

    // Recover app state on tab return/focus.
    const recoverAfterResume = async () => {
      const sessionValid = await refreshSessionIfNeeded({ strict: false, timeoutMs: 7000 });
      if (!sessionValid) {
        console.warn('Session expired, logging out...');
        handleLogout();
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
    <AuthContext.Provider value={authContextValue}>
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
