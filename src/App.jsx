import { useState, useEffect, useMemo, useRef, createContext, useContext, lazy, Suspense } from 'react';
import Sidebar from './components/Sidebar';
import QuickAccessBar from './components/QuickAccessBar';
import { supabase, onAuthStateChange, getUserOrganisations, createOrganisation, signOut, initStorageBuckets } from './supabase';

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
const BOQ = lazy(() => import('./pages/BOQ'));
const BOQList = lazy(() => import('./pages/BOQList'));
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
  
  // FIX #1: Add a key to force component remount on navigation
  const [mountKey, setMountKey] = useState(0);

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
      console.error('DB check error:', e);
    }
  };

  useEffect(() => {
    installLocationChangeListener();
    checkDatabase();
    
    const unsubscribe = onAuthStateChange(async (session) => {
      const usr = session?.user || null;
      setUser(usr);
      
      if (usr) {
        const orgs = await getUserOrganisations(usr.id);
        setOrganisations(orgs);
        
        const savedOrgId = localStorage.getItem('selected_organisation_id');
        let selectedOrg = null;
        
        if (savedOrgId) selectedOrg = orgs.find(o => o.id === savedOrgId);
        if (!selectedOrg && orgs.length > 0) selectedOrg = orgs[0];
        
        if (selectedOrg) await initStorageBuckets(selectedOrg.id);
        setOrganisation(selectedOrg);
      } else {
        setOrganisations([]);
        setOrganisation(null);
      }
      
      setLoading(false);
    });

    const handleLocationChange = () => {
      const newPath = getCurrentPathFromLocation();
      setCurrentPath(newPath);
      // FIX #2: Increment mount key to force fresh component mount
      setMountKey(prev => prev + 1);
    };

    window.addEventListener('locationchange', handleLocationChange);
    window.addEventListener('popstate', handleLocationChange);
    handleLocationChange();

    return () => {
      window.removeEventListener('locationchange', handleLocationChange);
      window.removeEventListener('popstate', handleLocationChange);
      unsubscribe();
    };
  }, []);

  const handleSelectOrganisation = async (orgId) => {
    const org = organisations.find(o => o.id === orgId);
    if (org) {
      await initStorageBuckets(org.id);
      setOrganisation(org);
      localStorage.setItem('selected_organisation_id', org.id);
    }
  };

  const handleCreateOrganisation = async (orgName) => {
    if (!user) return;
    const org = await createOrganisation(user.id, orgName);
    if (org) {
      await initStorageBuckets(org.id);
      setOrganisations([...organisations, org]);
      setOrganisation(org);
      localStorage.setItem('selected_organisation_id', org.id);
    }
  };

  const handleLogout = async () => {
    await signOut();
    localStorage.removeItem('selected_organisation_id');
    navigate('/');
  };

  const navigate = (path) => {
    const nextPath = path || '/';
    const current = `${window.location.pathname}${window.location.search}`;
    
    if (current !== nextPath || window.location.hash) {
      window.history.pushState({}, '', nextPath);
      window.dispatchEvent(new Event('locationchange'));
    }
  };

  const handleQuickAction = (action) => {
    if (action === 'new-quotation') navigate('/quotation/create');
    else if (action === 'new-project') navigate('/projects/new');
    else if (action === 'new-client') navigate('/clients/new');
    else if (action === 'new-dc') navigate('/dc/create');
  };

  const authUser = user;
  const authOrg = organisation;

  const renderPage = (user, organisation) => {
    const pathKey = (currentPath || '').split('?')[0];
    
    switch (pathKey) {
      case '/':
      case '/dashboard': return <Dashboard onNavigate={navigate} />;
      case '/projects': return <ProjectList />;
      case '/projects/new': return <CreateProject onCancel={() => navigate('/projects')} />;
      case '/projects/daily-updates': return <DailyUpdates />;
      case '/projects/site-materials': return <SiteMaterials />;
      case '/todo': return <TodoList />;
      case '/reminders': return <RemindMe />;
      case '/approvals': return <Approvals />;
      case '/clients/new': return <CreateClient onCancel={() => navigate('/clients')} />;
      case '/clients/edit': {
        const params = new URLSearchParams(currentPath.split('?')[1] || '')
        const id = params.get('id')
        return <CreateClientEdit editId={id} onCancel={() => navigate('/clients')} />
      }
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
      case '/boq': return <BOQList />;
      case '/boq/create': return <BOQ />;
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

  // FIX #3: Use mountKey in dependencies to force re-render on navigation
  // Also include user and organisation objects (not just IDs) to detect ALL changes
  const renderedPage = useMemo(
    () => renderPage(user, organisation), 
    [currentPath, mountKey, user, organisation]
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
          {/* FIX #4: Add key prop to Suspense to force fresh mount on navigation */}
          <Suspense 
            key={mountKey}
            fallback={
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
                <div className="loading-spinner">Loading page...</div>
              </div>
            }
          >
            {renderedPage}
          </Suspense>
        </main>
      </div>
    </AuthContext.Provider>
  );
}
