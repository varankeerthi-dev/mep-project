import { useState, useEffect, useMemo, useRef, createContext, useContext, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import QuickAccessBar from './components/QuickAccessBar';
import { supabase, getCurrentUser, onAuthStateChange, getUserOrganisations, createOrganisation, signOut, initStorageBuckets } from './supabase';

// Lazy load all pages
const CreateDC = lazy(() => import('./pages/CreateDC'));
const CreateNonBillableDC = lazy(() => import('./pages/CreateNonBillableDC'));
const DCList = lazy(() => import('./pages/DCList'));
const NonBillableDCList = lazy(() => import('./pages/NonBillableDCList'));
const DateWiseConsolidation = lazy(() => import('./pages/DateWiseConsolidation'));
const MaterialWiseConsolidation = lazy(() => import('./pages/MaterialWiseConsolidation'));
const MaterialsList = lazy(() => import('./pages/MaterialsList'));
const StockTransfer = lazy(() => import('./pages/StockTransfer'));
const TransactionNumberSeries = lazy(() => import('./pages/TransactionNumberSeries'));
const CreatePO = lazy(() => import('./pages/CreatePO'));
const POList = lazy(() => import('./pages/POList'));
const PODetails = lazy(() => import('./pages/PODetails'));
const ProjectList = lazy(() => import('./pages/ProjectList'));
const CreateProject = lazy(() => import('./pages/CreateProject'));
const AuthModule = import('./pages/Auth');
const Login = lazy(() => AuthModule.then(m => ({ default: m.Login })));
const Signup = lazy(() => AuthModule.then(m => ({ default: m.Signup })));
const AuthCallback = lazy(() => AuthModule.then(m => ({ default: m.AuthCallback })));
const SelectOrganisation = lazy(() => AuthModule.then(m => ({ default: m.SelectOrganisation })));
const OrganisationSettings = lazy(() => import('./pages/Organisation').then(m => ({ default: m.OrganisationSettings })));
const QuotationList = lazy(() => import('./pages/QuotationList'));
const CreateQuotation = lazy(() => import('./pages/CreateQuotation'));
const QuotationView = lazy(() => import('./pages/QuotationView'));
const TemplateSettings = lazy(() => import('./pages/TemplateSettings'));
const DiscountSettings = lazy(() => import('./pages/DiscountSettings'));
const QuickStockCheckList = lazy(() => import('./pages/QuickStockCheckList'));
const QuickStockCheck = lazy(() => import('./pages/QuickStockCheck'));

// Lazy load internally moved pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const DailyUpdates = lazy(() => import('./pages/DailyUpdates'));
const TodoList = lazy(() => import('./pages/TodoList'));
const RemindMe = lazy(() => import('./pages/RemindMe'));
const Approvals = lazy(() => import('./pages/Approvals'));
const ClientManagement = import('./pages/ClientManagement');
const CreateClient = lazy(() => ClientManagement.then(m => ({ default: m.CreateClient })));
const CreateClientEdit = lazy(() => ClientManagement.then(m => ({ default: m.CreateClientEdit })));
const ClientList = lazy(() => import('./pages/ClientList'));
const MaterialInward = lazy(() => import('./pages/MaterialInward'));
const MaterialOutward = lazy(() => import('./pages/MaterialOutward'));
const Meetings = import('./pages/Meetings');
const MeetingsDashboard = lazy(() => Meetings.then(m => ({ default: m.MeetingsDashboard })));
const CreateMeeting = lazy(() => Meetings.then(m => ({ default: m.CreateMeeting })));
const ClientRequests = lazy(() => import('./pages/ClientRequests'));
const SiteVisits = import('./pages/SiteVisits');
const SiteVisitsDashboard = lazy(() => SiteVisits.then(m => ({ default: m.SiteVisitsDashboard })));
const SiteVisitEdit = lazy(() => SiteVisits.then(m => ({ default: m.SiteVisitEdit })));
const CreateSiteVisit = lazy(() => SiteVisits.then(m => ({ default: m.CreateSiteVisit })));
const Subcontractors = import('./pages/Subcontractors');
const SubcontractorDashboard = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorDashboard })));
const CreateSubcontractor = lazy(() => Subcontractors.then(m => ({ default: m.CreateSubcontractor })));
const SubcontractorView = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorView })));
const SubcontractorEdit = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorEdit })));
const SubcontractorAttendance = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorAttendance })));
const SubcontractorWorkOrders = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorWorkOrders })));
const SubcontractorDailyLogs = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorDailyLogs })));
const SubcontractorPayments = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorPayments })));
const SubcontractorInvoices = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorInvoices })));
const SubcontractorDocuments = lazy(() => Subcontractors.then(m => ({ default: m.SubcontractorDocuments })));
const Reports = import('./pages/Reports');
const StockBalance = lazy(() => Reports.then(m => ({ default: m.StockBalance })));
const StockReport = lazy(() => Reports.then(m => ({ default: m.StockReport })));
const PurchaseReport = lazy(() => Reports.then(m => ({ default: m.PurchaseReport })));
const SalesReport = lazy(() => Reports.then(m => ({ default: m.SalesReport })));
const ProjectManagementInternal = import('./pages/ProjectManagementInternal');
const SiteMaterials = lazy(() => ProjectManagementInternal.then(m => ({ default: m.SiteMaterials })));
const ToolsList = lazy(() => ProjectManagementInternal.then(m => ({ default: m.ToolsList })));
const BOQ = lazy(() => ProjectManagementInternal.then(m => ({ default: m.BOQ })));
const IssueList = lazy(() => ProjectManagementInternal.then(m => ({ default: m.IssueList })));
const ClientComm = lazy(() => ProjectManagementInternal.then(m => ({ default: m.ClientComm })));
const Documents = lazy(() => ProjectManagementInternal.then(m => ({ default: m.Documents })));
const DCEdit = lazy(() => import('./pages/DCEdit'));
const NonBillableDCEdit = lazy(() => import('./pages/NonBillableDCEdit'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const PrintSettings = lazy(() => import('./pages/PrintSettings'));
const DatabaseSetup = lazy(() => import('./pages/DatabaseSetup'));

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

function getCurrentPathFromLocation() {
  const hashPath = window.location.hash.slice(1);
  if (hashPath) return hashPath;
  const path = `${window.location.pathname}${window.location.search}`;
  return path || '/';
}

function installLocationChangeListener() {
  if (typeof window === 'undefined') return;
  if (window.__mepLocationPatched) return;

  const originalPushState = window.history.pushState;
  const originalReplaceState = window.history.replaceState;

  window.history.pushState = function patchedPushState(...args) {
    const result = originalPushState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
    return result;
  };

  window.history.replaceState = function patchedReplaceState(...args) {
    const result = originalReplaceState.apply(this, args);
    window.dispatchEvent(new Event('locationchange'));
    return result;
  };

  window.__mepLocationPatched = true;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('login');
  const [currentPath, setCurrentPath] = useState('/');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [dbSetup, setDbSetup] = useState(false);

  const checkDatabase = async () => {
    try {
      const { error } = await supabase.from('projects').select('id').limit(1);
      if (error) setDbSetup(true);
    } catch (e) {
      setDbSetup(true);
    }
  };

  const initAuth = async () => {
    const { user: currentUser } = await getCurrentUser();
    
    if (currentUser) {
      setUser(currentUser);
      const { data: orgs } = await getUserOrganisations(currentUser.id);
      setOrganisations(orgs || []);
      
      if (orgs && orgs.length > 0) {
        setOrganisation(orgs[0].organisation);
      }
    }
    
    setLoading(false);

    onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        setUser(session.user);
        const { data: orgs } = await getUserOrganisations(session.user.id);
        setOrganisations(orgs || []);
        
        if (orgs && orgs.length > 0) {
          setOrganisation(orgs[0].organisation);
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
        setOrganisation(null);
        setOrganisations([]);
      }
    });
  };

  useEffect(() => {
    checkDatabase();
    initAuth();
    initStorageBuckets();

    // Session Heartbeat: Optimized to prevent excessive state triggers
    let lastCheck = 0;
    const handleFocus = async () => {
      const now = Date.now();
      if (now - lastCheck < 300000) return; // Only check every 5 minutes max
      
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        if (!error && session?.user) {
          // Only update state if identity actually changed or token was refreshed
          if (session.user.id !== user?.id) {
            setUser(session.user);
          }
        }
      } catch (e) {
        console.warn('Heartbeat check failed', e);
      }
      lastCheck = now;
    };

    window.addEventListener('focus', handleFocus);
    window.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') handleFocus();
    });

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('visibilitychange', handleFocus);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    await signOut();
    setUser(null);
    setOrganisation(null);
    setOrganisations([]);
    setAuthView('login');
  };

  const handleSelectOrganisation = (org) => {
    setOrganisation(org);
  };

  const handleCreateOrganisation = async (orgName) => {
    const { data, error } = await createOrganisation(orgName, user.id);
    if (error) {
      console.error('Create org error:', error);
      alert('Error creating organisation: ' + error.message);
      return;
    }
    if (data) {
      const { data: orgs } = await getUserOrganisations(user.id);
      setOrganisations(orgs || []);
      setOrganisation(orgs?.[0]?.organisation);
    }
  };

  const navigate = (path) => {
    const nextPath = path || '/';
    setCurrentPath(nextPath);
    if (`${window.location.pathname}${window.location.search}` !== nextPath || window.location.hash) {
      window.history.pushState({}, '', nextPath);
    }
    window.dispatchEvent(new Event('locationchange'));
  };

  const handleQuickAction = (action) => {
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

  useEffect(() => {
    const syncPathFromLocation = () => {
      setCurrentPath(getCurrentPathFromLocation());
    };

    installLocationChangeListener();
    syncPathFromLocation();
    window.addEventListener('hashchange', syncPathFromLocation);
    window.addEventListener('popstate', syncPathFromLocation);
    window.addEventListener('locationchange', syncPathFromLocation);
    return () => {
      window.removeEventListener('hashchange', syncPathFromLocation);
      window.removeEventListener('popstate', syncPathFromLocation);
      window.removeEventListener('locationchange', syncPathFromLocation);
    };
  }, []);

  const renderPage = (authUser, authOrg) => {
    const pathKey = currentPath.split('?')[0]
    switch (pathKey) {
      case '/': return <Dashboard onNavigate={navigate} />;
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
      case '/site-visits': return <SiteVisitsDashboard onNavigate={navigate} />;
      case '/site-visits/new': return <CreateSiteVisit onSuccess={() => navigate('/site-visits')} onCancel={() => navigate('/site-visits')} />;
      case '/site-visits/edit': {
        const params = new URLSearchParams(currentPath.split('?')[1] || '')
        const id = params.get('id')
        return <SiteVisitEdit editId={id} onSuccess={() => navigate('/site-visits')} onCancel={() => navigate('/site-visits')} />
      }
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
      case '/boq': return <BOQ />;
      case '/issue': return <IssueList />;
      case '/client-comm': return <ClientComm />;
      case '/documents': return <Documents />;
      case '/store/materials': return <MaterialsList />;
      case '/store/inward': return <MaterialInward onSuccess={() => navigate('/store/stock')} onCancel={() => navigate('/store/inward')} />;
      case '/store/outward': return <MaterialOutward onSuccess={() => navigate('/store/stock')} onCancel={() => navigate('/store/outward')} />;
      case '/store/transfer': return <StockTransfer onCancel={() => navigate('/store/transfer')} />;
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

  const renderedPage = useMemo(() => renderPage(user, organisation), [currentPath, user?.id, organisation?.id]);

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
