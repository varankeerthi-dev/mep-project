import { useState, useEffect, createContext, useContext } from 'react';
import Sidebar from './components/Sidebar';
import QuickAccessBar from './components/QuickAccessBar';
import CreateDC from './pages/CreateDC';
import DCList from './pages/DCList';
import DateWiseConsolidation from './pages/DateWiseConsolidation';
import MaterialWiseConsolidation from './pages/MaterialWiseConsolidation';
import MaterialsList from './pages/MaterialsList';
import StockTransfer from './pages/StockTransfer';
import TransactionNumberSeries from './pages/TransactionNumberSeries';
import CreatePO from './pages/CreatePO';
import POList from './pages/POList';
import PODetails from './pages/PODetails';
import ProjectList from './pages/ProjectList';
import CreateProject from './pages/CreateProject';
import { Login, Signup, AuthCallback, SelectOrganisation } from './pages/Auth';
import { OrganisationSettings } from './pages/Organisation';
import QuotationList from './pages/QuotationList';
import CreateQuotation from './pages/CreateQuotation';
import QuotationView from './pages/QuotationView';
import TemplateSettings from './pages/TemplateSettings';
import QuickStockCheckList from './pages/QuickStockCheckList';
import QuickStockCheck from './pages/QuickStockCheck';
import { supabase, getCurrentUser, onAuthStateChange, getUserOrganisations, createOrganisation, signOut, initStorageBuckets } from './supabase';

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export default function App() {
  const [user, setUser] = useState(null);
  const [organisation, setOrganisation] = useState(null);
  const [organisations, setOrganisations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [authView, setAuthView] = useState('login');
  const [currentPath, setCurrentPath] = useState('/');
  const [editingVisit, setEditingVisit] = useState(null);

  useEffect(() => {
    const handleEditVisit = (e) => {
      setEditingVisit(e.detail);
    };
    window.addEventListener('edit-visit', handleEditVisit);
    return () => window.removeEventListener('edit-visit', handleEditVisit);
  }, []);
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
  }, []);

  const handleLogin = async (user) => {
    setUser(user);
    const { data: orgs } = await getUserOrganisations(user.id);
    setOrganisations(orgs || []);
    
    if (orgs && orgs.length > 0) {
      setOrganisation(orgs[0].organisation);
    }
  };

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

  const handleQuickAction = (action) => {
    switch (action) {
      case 'new-dc': setCurrentPath('/dc/create'); break;
      case 'daily-updates': setCurrentPath('/projects/daily-updates'); break;
      case 'approvals': setCurrentPath('/approvals'); break;
      case 'remind': setCurrentPath('/remindme'); break;
      case 'search': setCurrentPath('/dc/list'); break;
      case 'export': setCurrentPath('/dc/list'); break;
      default: break;
    }
  };

  const navigate = (path) => {
    if (path.includes('/edit') && path.includes('?')) {
      setCurrentPath(path);
    } else {
      const pathWithoutQuery = path.split('?')[0];
      setCurrentPath(pathWithoutQuery);
    }
  };

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) {
      if (hash.includes('/edit?') && hash.includes('id=')) {
        setCurrentPath(hash);
      } else {
        setCurrentPath(hash.split('?')[0]);
      }
    }
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
      case '/dc/edit':
        if (currentPath.startsWith('/dc/edit/')) {
          const dcId = currentPath.split('/dc/edit/')[1];
          return <DCEdit dcId={dcId} onCancel={() => navigate('/dc/list')} />;
        }
        return <DCList />;
      case '/dc/list': return <DCList />;
      case '/dc/consolidation/date': return <DateWiseConsolidation />;
      case '/dc/consolidation/material': return <MaterialWiseConsolidation />;
      case '/reports/stock': return <StockReport />;
      case '/reports/purchase': return <PurchaseReport />;
      case '/reports/sales': return <SalesReport />;
      case '/settings': return <SettingsPage />;
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
      default: return <DCList />;
    }
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (dbSetup) {
    return <DatabaseSetup />;
  }

  if (!user) {
    switch (authView) {
      case 'signup':
        return <Signup onSignup={handleLogin} />;
      case 'callback':
        return <AuthCallback onAuth={handleLogin} />;
      default:
        return <Login onLogin={handleLogin} />;
    }
  }

  if (!organisation && organisations.length === 0) {
    return (
      <SelectOrganisation
        organisations={[]}
        onSelect={handleSelectOrganisation}
        onCreateNew={handleCreateOrganisation}
      />
    );
  }

  if (!organisation && organisations.length > 0) {
    return (
      <SelectOrganisation
        organisations={organisations}
        onSelect={handleSelectOrganisation}
        onCreateNew={handleCreateOrganisation}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ user, organisation, handleLogout }}>
      <div className="app-container">
        <QuickAccessBar onQuickAction={handleQuickAction} organisation={organisation} onLogout={handleLogout} onMenuToggle={() => setMobileSidebarOpen(!mobileSidebarOpen)} />
        <Sidebar currentPath={currentPath} onNavigate={(path) => { navigate(path); setMobileSidebarOpen(false); }} collapsed={sidebarCollapsed} onToggle={() => setSidebarCollapsed(!sidebarCollapsed)} mobileOpen={mobileSidebarOpen} />
        <main className={`main-content ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>{renderPage(user, organisation)}</main>
      </div>
    </AuthContext.Provider>
  );
}

function DatabaseSetup() {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f8f9fa' }}>
      <div className="card" style={{ maxWidth: '600px' }}>
        <h2>Database Setup Required</h2>
        <p>Please run the SQL scripts in Supabase SQL Editor to create tables.</p>
        <div style={{ marginTop: '20px' }}>
          <h4>Required SQL Files:</h4>
          <ul>
            <li>database-setup.sql</li>
            <li>database-tables.sql</li>
            <li>database-auth.sql (NEW - for auth & organisations)</li>
          </ul>
        </div>
        <div style={{ marginTop: '20px' }}>
          <button onClick={() => window.location.reload()} className="btn btn-primary">
            Refresh After Setup
          </button>
        </div>
      </div>
    </div>
  );
}

function Dashboard({ onNavigate }) {
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Dashboard</h1></div>
      <div className="quick-actions-bar">
        <button className="quick-action-btn primary" onClick={() => onNavigate('/dc/create')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Create DC
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('/clients/new')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/><line x1="20" y1="8" x2="20" y2="14"/><line x1="23" y1="11" x2="17" y2="11"/></svg>
          Add Client
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('/store/materials')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
          Add Material
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('/todo')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          To Do List
        </button>
        <button className="quick-action-btn" onClick={() => onNavigate('/projects/daily-updates')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          Daily Updates
        </button>
      </div>
    </div>
  );
}

function DailyUpdates() {
  const [updates, setUpdates] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ project_id: '', update_date: new Date().toISOString().split('T')[0], description: '', images: [] });

  const loadUpdates = async () => { const { data } = await supabase.from('daily_updates').select('*, project:projects(name)').order('update_date', { ascending: false }); setUpdates(data || []); };

  useEffect(() => { loadUpdates(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await supabase.from('daily_updates').insert({ project_id: formData.project_id || null, update_date: formData.update_date, description: formData.description });
    setShowForm(false); loadUpdates();
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Updates</h1><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add Update'}</button></div>
      {showForm && (
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}><option value="">Select Project</option></select></div>
              <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.update_date} onChange={e => setFormData({...formData, update_date: e.target.value})} /></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Upload Pictures</label><input type="file" className="form-input" multiple accept="image/*" /></div>
            <div className="form-group"><label className="form-label">Upload Documents (PDF)</label><input type="file" className="form-input" multiple accept="application/pdf" /></div>
            <button type="submit" className="btn btn-primary">Submit</button>
          </form>
        </div>
      )}
      <div className="card">
        {updates.length === 0 ? <div className="empty-state"><h3>No Updates</h3></div> : (
          <div className="table-container"><table className="table"><thead><tr><th>Date</th><th>Project</th><th>Description</th></tr></thead><tbody>{updates.map(u => (<tr key={u.id}><td>{u.update_date}</td><td>{u.project?.name || '-'}</td><td>{u.description}</td></tr>))}</tbody></table></div>
        )}
      </div>
    </div>
  );
}

function SiteMaterials() { return <div><div className="page-header"><h1 className="page-title">Site Materials</h1></div><div className="card"><div className="empty-state"><h3>Site Materials</h3><p>Manage materials at project site</p></div></div></div>; }
function TodoList() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  useEffect(() => { supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); }, []);
  const addTodo = async () => { if (!newTodo.trim()) return; await supabase.from('todos').insert({ title: newTodo, status: 'pending' }); setNewTodo(''); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  const toggleTodo = async (id, status) => { await supabase.from('todos').update({ status: status === 'pending' ? 'completed' : 'pending' }).eq('id', id); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  const deleteTodo = async (id) => { await supabase.from('todos').delete().eq('id', id); supabase.from('todos').select('*').order('created_at', { ascending: false }).then(({ data }) => setTodos(data || [])); };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">To Do List</h1></div>
      <div className="card">
        <div className="todo-input-container">
          <input 
            type="text" 
            className="todo-input" 
            value={newTodo} 
            onChange={e => setNewTodo(e.target.value)} 
            placeholder="Add a new task..." 
            onKeyPress={e => e.key === 'Enter' && addTodo()}
          />
          <button className="btn btn-primary" onClick={addTodo}>Add Task</button>
        </div>
        {todos.length === 0 ? (
          <div className="empty-state">
            <h3>No tasks yet</h3>
            <p>Add your first task above</p>
          </div>
        ) : (
          <div className="todo-list">
            {todos.map(todo => (
              <div key={todo.id} className="todo-item">
                <div 
                  className={`todo-checkbox ${todo.status === 'completed' ? 'checked' : ''}`}
                  onClick={() => toggleTodo(todo.id, todo.status)}
                >
                  {todo.status === 'completed' && (
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                </div>
                <span className={`todo-text ${todo.status === 'completed' ? 'completed' : ''}`}>
                  {todo.title}
                </span>
                <button className="todo-delete" onClick={() => deleteTodo(todo.id)}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="3 6 5 6 21 6"/>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function RemindMe() {
  const [reminders, setReminders] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', remind_date: '', description: '' });
  useEffect(() => { supabase.from('reminders').select('*').order('remind_date', { ascending: true }).then(({ data }) => setReminders(data || [])); }, []);
  const handleSubmit = async (e) => { e.preventDefault(); await supabase.from('reminders').insert(formData); setShowForm(false); setFormData({ title: '', remind_date: '', description: '' }); supabase.from('reminders').select('*').order('remind_date', { ascending: true }).then(({ data }) => setReminders(data || [])); };
  return (
    <div>
      <div className="page-header"><h1 className="page-title">Remind Me</h1><button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add'}</button></div>
      {showForm && (<div className="card"><form onSubmit={handleSubmit}><div className="form-group"><label className="form-label">Title</label><input type="text" className="form-input" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} required /></div><div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.remind_date} onChange={e => setFormData({...formData, remind_date: e.target.value})} required /></div><div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div><button type="submit" className="btn btn-primary">Save</button></form></div>)}
      <div className="card">{reminders.length === 0 ? <div className="empty-state"><h3>No Reminders</h3></div> : (<div className="table-container"><table className="table"><thead><tr><th>Title</th><th>Date</th><th>Description</th></tr></thead><tbody>{reminders.map(r => (<tr key={r.id}><td>{r.title}</td><td>{r.remind_date}</td><td>{r.description || '-'}</td></tr>))}</tbody></table></div>)}</div>
    </div>
  );
}

function Approvals() { return <div><div className="page-header"><h1 className="page-title">Approvals</h1></div><div className="card"><div className="empty-state"><h3>Approvals</h3><p>View pending approvals</p></div></div></div>; }

function CreateClientEdit({ onSuccess, onCancel }) {
  const [clientData, setClientData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] || '');
    const clientId = params.get('id');
    if (clientId) {
      loadClient(clientId);
    }
  }, []);

  const loadClient = async (id) => {
    const { data } = await supabase.from('clients').select('*').eq('id', id).single();
    setClientData(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;

  return <CreateClient editMode={true} clientData={clientData} onSuccess={onSuccess} onCancel={onCancel} />;
}

function CreateClient({ onSuccess, onCancel, editMode, clientData }) {
  const [formData, setFormData] = useState(clientData || { 
    client_name: '', address1: '', address2: '', state: '', city: '', pincode: '',
    gstin: '', contact: '', email: '', vendor_no: '', remarks: '', category: 'Active',
    contact_person: '', contact_designation: '', contact_person_email: '',
    contact_person_2: '', contact_designation_2: '', contact_person_2_contact: '', contact_person_2_email: '',
    purchase_person: '', purchase_designation: '', purchase_contact: '', purchase_email: '',
    about_client: ''
  });
  const [gstError, setGstError] = useState('');
  const [shippingAddresses, setShippingAddresses] = useState([]);
  const [showShippingForm, setShowShippingForm] = useState(false);
  const [newShipping, setNewShipping] = useState({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });

  const indianStates = [
    'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
    'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
    'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
    'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
    'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
    'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
    'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
  ];

  const gstStateCodes = {
    '01': 'Jammu and Kashmir', '02': 'Himachal Pradesh', '03': 'Punjab', '04': 'Chandigarh',
    '05': 'Uttarakhand', '06': 'Haryana', '07': 'Delhi', '08': 'Rajasthan',
    '09': 'Uttar Pradesh', '10': 'Bihar', '11': 'Sikkim', '12': 'Arunachal Pradesh',
    '13': 'Nagaland', '14': 'Manipur', '15': 'Mizoram', '16': 'Tripura',
    '17': 'Meghalaya', '18': 'Assam', '19': 'West Bengal', '20': 'Jharkhand',
    '21': 'Odisha', '22': 'Chhattisgarh', '23': 'Madhya Pradesh', '24': 'Gujarat',
    '25': 'Maharashtra', '26': 'Karnataka', '27': 'Goa', '28': 'Lakshadweep',
    '29': 'Kerala', '30': 'Tamil Nadu', '31': 'Puducherry', '32': 'Andaman and Nicobar Islands',
    '33': 'Telangana', '34': 'Andhra Pradesh', '35': 'Ladakh'
  };

  useEffect(() => {
    if (editMode && clientData?.id) {
      loadShippingAddresses(clientData.id);
    }
  }, [editMode, clientData?.id]);

  const loadShippingAddresses = async (clientId) => {
    const { data } = await supabase.from('client_shipping_addresses').select('*').eq('client_id', clientId).order('created_at', { ascending: false });
    setShippingAddresses(data || []);
  };

  const handleGstChange = (e) => {
    const value = e.target.value.toUpperCase();
    if (value.length <= 15) {
      setFormData({ ...formData, gstin: value });
      if (value.length >= 2) {
        const stateCode = value.substring(0, 2);
        const detectedState = gstStateCodes[stateCode];
        if (detectedState) setFormData(prev => ({ ...prev, gstin: value, state: detectedState }));
      }
      if (value.length > 0 && value.length < 15) setGstError('GSTIN must be exactly 15 characters');
      else setGstError('');
    }
  };

  const copyBillingToShipping = () => {
    setNewShipping({
      ...newShipping,
      address_line1: formData.address1 || '',
      address_line2: formData.address2 || '',
      city: formData.city || '',
      state: formData.state || '',
      pincode: formData.pincode || ''
    });
    setShowShippingForm(true);
  };

  const addShippingAddress = async () => {
    if (!editMode || !clientData?.id) {
      alert('Please save client first before adding shipping addresses');
      return;
    }
    const { error } = await supabase.from('client_shipping_addresses').insert({
      client_id: clientData.id,
      ...newShipping
    });
    if (error) {
      alert('Error: ' + error.message);
    } else {
      setNewShipping({ address_name: '', address_line1: '', address_line2: '', city: '', state: '', pincode: '', gstin: '', contact: '', is_default: false });
      setShowShippingForm(false);
      loadShippingAddresses(clientData.id);
    }
  };

  const deleteShippingAddress = async (id) => {
    if (!confirm('Delete this shipping address?')) return;
    await supabase.from('client_shipping_addresses').delete().eq('id', id);
    loadShippingAddresses(clientData.id);
  };

  const copyToShipping = () => {
    setFormData({
      ...formData,
      ship_address1: formData.address1,
      ship_address2: formData.address2,
      ship_state: formData.state,
      ship_city: '',
      ship_pincode: '',
      shipping_address: `${formData.address1 || ''} ${formData.address2 || ''}`.trim()
    });
    setShowShipping(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.gstin && formData.gstin.length !== 15) {
      alert('GSTIN must be exactly 15 characters');
      return;
    }
    
    if (editMode && clientData?.id) {
      const { error } = await supabase.from('clients').update(formData).eq('id', clientData.id);
      if (error) {
        alert('Error: ' + error.message);
        return;
      }
      alert('Client updated successfully!');
    } else {
      const clientId = 'CLT-' + Date.now().toString().slice(-6);
      const { error } = await supabase.from('clients').insert({ ...formData, client_id: clientId });
      if (error) {
        alert('Error: ' + error.message);
        return;
      }
      alert('Client saved successfully!');
    }
    onSuccess();
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">{editMode ? 'Edit Client' : 'Create Client'}</h1></div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Category</label><select className="form-select" value={formData.category || 'Active'} onChange={e => setFormData({...formData, category: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option><option value="Prospect">Prospect</option></select></div>
          </div>
          
          {/* Contact Persons Section */}
          <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '8px', marginBottom: '16px' }}>
            <div style={{ fontWeight: '600', marginBottom: '8px', color: '#475569' }}>Contact Person 1</div>
            <div className="form-row" style={{ marginBottom: '8px' }}>
              <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person || ''} onChange={e => setFormData({...formData, contact_person: e.target.value})} placeholder="Name" /></div>
              <div className="form-group"><label className="form-label">Designation</label><input type="text" className="form-input" value={formData.contact_designation || ''} onChange={e => setFormData({...formData, contact_designation: e.target.value})} placeholder="e.g. Manager" /></div>
              <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.contact || ''} onChange={e => setFormData({...formData, contact: e.target.value})} placeholder="Phone" /></div>
              <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.contact_person_email || ''} onChange={e => setFormData({...formData, contact_person_email: e.target.value})} placeholder="email@example.com" /></div>
            </div>
            <div className="form-row" style={{ marginBottom: '8px' }}>
              <div className="form-group"><input type="text" className="form-input" value={formData.contact_person_2 || ''} onChange={e => setFormData({...formData, contact_person_2: e.target.value})} placeholder="Contact Person 2" /></div>
              <div className="form-group"><input type="text" className="form-input" value={formData.contact_designation_2 || ''} onChange={e => setFormData({...formData, contact_designation_2: e.target.value})} placeholder="Designation" /></div>
              <div className="form-group"><input type="text" className="form-input" value={formData.contact_person_2_contact || ''} onChange={e => setFormData({...formData, contact_person_2_contact: e.target.value})} placeholder="Phone" /></div>
              <div className="form-group"><input type="email" className="form-input" value={formData.contact_person_2_email || ''} onChange={e => setFormData({...formData, contact_person_2_email: e.target.value})} placeholder="Email" /></div>
            </div>
            <div className="form-row" style={{ marginBottom: '0' }}>
              <div className="form-group"><input type="text" className="form-input" value={formData.purchase_person || ''} onChange={e => setFormData({...formData, purchase_person: e.target.value})} placeholder="Contact Person 3" /></div>
              <div className="form-group"><input type="text" className="form-input" value={formData.purchase_designation || ''} onChange={e => setFormData({...formData, purchase_designation: e.target.value})} placeholder="Designation" /></div>
              <div className="form-group"><input type="text" className="form-input" value={formData.purchase_contact || ''} onChange={e => setFormData({...formData, purchase_contact: e.target.value})} placeholder="Phone" /></div>
              <div className="form-group"><input type="email" className="form-input" value={formData.purchase_email || ''} onChange={e => setFormData({...formData, purchase_email: e.target.value})} placeholder="Email" /></div>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label">GST IN</label>
              <input 
                type="text" 
                className="form-input" 
                value={formData.gstin || ''} 
                onChange={handleGstChange}
                placeholder="15 characters (e.g., 27AABCU9603R1ZM)"
                maxLength={15}
              />
              {gstError && <span style={{ color: '#dc3545', fontSize: '12px' }}>{gstError}</span>}
            </div>
            <div className="form-group"><label className="form-label">Vendor No</label><input type="text" className="form-input" value={formData.vendor_no} onChange={e => setFormData({...formData, vendor_no: e.target.value})} /></div>
          </div>
          
          {/* Billing & Shipping Address - Split Screen */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            {/* Billing Address */}
            <div style={{ background: '#f0fdf4', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0' }}>
              <div style={{ fontWeight: '600', marginBottom: '8px', color: '#166534' }}>Billing Address</div>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Address Line 1</label><input type="text" className="form-input" value={formData.address1} onChange={e => setFormData({...formData, address1: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Address Line 2</label><input type="text" className="form-input" value={formData.address2} onChange={e => setFormData({...formData, address2: e.target.value})} /></div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">State</label>
                  <select className="form-select" value={formData.state || ''} onChange={e => setFormData({...formData, state: e.target.value})}>
                    <option value="">Select State</option>
                    {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                  </select>
                </div>
                <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={formData.city || ''} onChange={e => setFormData({...formData, city: e.target.value})} /></div>
                <div className="form-group"><label className="form-label">Pincode</label><input type="text" className="form-input" value={formData.pincode || ''} onChange={e => setFormData({...formData, pincode: e.target.value})} /></div>
              </div>
            </div>
            
            {/* Shipping Addresses */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div style={{ fontWeight: '600', color: '#475569' }}>Shipping Addresses</div>
                <button type="button" className="btn btn-secondary" onClick={copyBillingToShipping} style={{ whiteSpace: 'nowrap' }}>Copy Billing</button>
              </div>
              
              {shippingAddresses.length > 0 && (
                <div style={{ display: 'grid', gap: '8px' }}>
                  {shippingAddresses.map(addr => (
                    <div key={addr.id} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <div>
                          <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '13px' }}>{addr.address_name || 'Address'} {addr.is_default && <span style={{ background: '#dbeafe', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontSize: '11px' }}>Default</span>}</div>
                          <div style={{ color: '#64748b', fontSize: '12px', marginTop: '4px' }}>{addr.address_line1} {addr.address_line2}</div>
                          <div style={{ color: '#64748b', fontSize: '12px' }}>{addr.city}, {addr.state} - {addr.pincode}</div>
                        </div>
                        <button type="button" onClick={() => deleteShippingAddress(addr.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '4px' }}>✕</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {showShippingForm && (
                <div style={{ background: '#f0f9ff', padding: '12px', borderRadius: '8px', border: '1px solid #bae6fd', marginTop: '8px' }}>
                  <div style={{ fontWeight: '600', marginBottom: '8px', color: '#0369a1' }}>Add Shipping Address</div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Address Name</label><input type="text" className="form-input" value={newShipping.address_name} onChange={e => setNewShipping({...newShipping, address_name: e.target.value})} placeholder="e.g. Main Office" /></div>
                    <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={newShipping.contact} onChange={e => setNewShipping({...newShipping, contact: e.target.value})} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group"><label className="form-label">Address Line 1</label><input type="text" className="form-input" value={newShipping.address_line1} onChange={e => setNewShipping({...newShipping, address_line1: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">Address Line 2</label><input type="text" className="form-input" value={newShipping.address_line2} onChange={e => setNewShipping({...newShipping, address_line2: e.target.value})} /></div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">State</label>
                      <select className="form-select" value={newShipping.state} onChange={e => setNewShipping({...newShipping, state: e.target.value})}>
                        <option value="">Select State</option>
                        {indianStates.map(state => (<option key={state} value={state}>{state}</option>))}
                      </select>
                    </div>
                    <div className="form-group"><label className="form-label">City</label><input type="text" className="form-input" value={newShipping.city} onChange={e => setNewShipping({...newShipping, city: e.target.value})} /></div>
                    <div className="form-group"><label className="form-label">Pincode</label><input type="text" className="form-input" value={newShipping.pincode} onChange={e => setNewShipping({...newShipping, pincode: e.target.value})} /></div>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                    <button type="button" className="btn btn-primary" onClick={addShippingAddress}>Save Address</button>
                    <button type="button" className="btn btn-secondary" onClick={() => setShowShippingForm(false)}>Cancel</button>
                  </div>
                </div>
              )}
              
              {!showShippingForm && shippingAddresses.length === 0 && (
                <button type="button" className="btn btn-primary" onClick={() => setShowShippingForm(true)} style={{ marginTop: '8px' }}>+ Add Shipping</button>
              )}
            </div>
          </div>
          
          <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={formData.remarks} onChange={e => setFormData({...formData, remarks: e.target.value})} /></div>
          <div className="form-group"><label className="form-label">About Client</label><textarea className="form-textarea" value={formData.about_client || ''} onChange={e => setFormData({...formData, about_client: e.target.value})} placeholder="Additional information about the client..." /></div>
          <div style={{ display: 'flex', gap: '12px' }}><button type="submit" className="btn btn-primary">{editMode ? 'Update' : 'Submit'}</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
        </form>
      </div>
    </div>
  );
}

function ClientList() {
  const [clients, setClients] = useState([]);
  const [filter, setFilter] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  const loadClients = async () => {
    let query = supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (filter !== 'All') {
      query = query.eq('category', filter);
    }
    const { data } = await query;
    setClients(data || []);
  };

  useEffect(() => { loadClients(); }, [filter]);

  const deleteClient = async (id) => { if (confirm('Delete this client?')) { await supabase.from('clients').delete().eq('id', id); loadClients(); }};

  const filteredClients = clients.filter(c => 
    c.client_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.client_id?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.contact?.includes(searchTerm)
  );

  const getCategoryColor = (category) => {
    if (category === 'Active') return '#d4edda';
    if (category === 'Inactive') return '#f8d7da';
    return '#fff3cd';
  };

  const getCategoryTextColor = (category) => {
    if (category === 'Active') return '#155724';
    if (category === 'Inactive') return '#721c24';
    return '#856404';
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client List</h1>
        <button className="btn btn-primary" onClick={() => window.location.hash = '/clients/new'}>+ Add Client</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${filter === 'All' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('All')}>All</button>
          <button className={`btn ${filter === 'Active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('Active')}>Active</button>
          <button className={`btn ${filter === 'Inactive' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('Inactive')}>Inactive</button>
          <button className={`btn ${filter === 'Prospect' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('Prospect')}>Prospect</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search clients..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px' }}
            />
          </div>
        </div>
      </div>

      <div className="card">
        {filteredClients.length === 0 ? <div className="empty-state"><h3>No Clients</h3></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Client ID</th><th>Client Name</th><th>Category</th><th>Contact</th><th>Email</th><th>GSTIN</th><th>State</th><th>Actions</th></tr></thead>
              <tbody>{filteredClients.map(c => (
                <tr key={c.id}>
                  <td>{c.client_id}</td>
                  <td>{c.client_name}</td>
                  <td>
                    <span style={{ 
                      padding: '4px 8px', 
                      borderRadius: '4px', 
                      background: getCategoryColor(c.category),
                      color: getCategoryTextColor(c.category),
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}>
                      {c.category || 'Active'}
                    </span>
                  </td>
                  <td>{c.contact || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.gstin || '-'}</td>
                  <td>{c.state || '-'}</td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => window.location.hash = `/clients/edit?id=${c.id}`}>Edit</button>
                    <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => deleteClient(c.id)}>Delete</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ToolsList() { return <div><div className="page-header"><h1 className="page-title">Tools</h1></div><div className="card"><div className="empty-state"><h3>Tools</h3><p>Monitoring tools</p></div></div></div>; }
function BOQ() { return <div><div className="page-header"><h1 className="page-title">BOQ</h1></div><div className="card"><div className="empty-state"><h3>BOQ</h3></div></div></div>; }
function IssueList() { return <div><div className="page-header"><h1 className="page-title">Issue</h1></div><div className="card"><div className="empty-state"><h3>Issues</h3></div></div></div>; }
function ClientComm() { return <div><div className="page-header"><h1 className="page-title">Client Communication</h1></div><div className="card"><div className="empty-state"><h3>Client Communication</h3></div></div></div>; }
function Documents() { return <div><div className="page-header"><h1 className="page-title">Documents</h1></div><div className="card"><div className="empty-state"><h3>Documents</h3></div></div></div>; }

function MaterialInward({ onCancel }) {
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [projects, setProjects] = useState([]);
  const [pricing, setPricing] = useState({});
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteData, setPasteData] = useState('');
  const [formData, setFormData] = useState({ 
    invoice_date: '',
    received_date: new Date().toISOString().split('T')[0], 
    vendor_name: '', 
    invoice_no: '', 
    warehouse_id: '', 
    default_variant_id: '',
    received_by: '',
    acknowledged_by: '',
    remarks: '',
    supply_type: 'WAREHOUSE',
    project_id: ''
  });
  const [items, setItems] = useState([
    { id: 1, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false }
  ]);
  const [nextId, setNextId] = useState(2);
  
  useEffect(() => { loadData(); }, []);
  
  const loadData = async () => {
    const [mat, wh, varData, priceData, projData] = await Promise.all([
      supabase.from('materials').select('id, item_code, display_name, name, unit, uses_variant, sale_price').order('name'),
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('company_variants').select('*').order('variant_name'),
      supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price'),
      supabase.from('projects').select('id, name').order('name')
    ]);
    setMaterials(mat.data || []);
    setWarehouses(wh.data || []);
    setVariants(varData.data || []);
    setProjects(projData.data || []);
    
    const priceMap = {};
    priceData?.forEach(p => {
      if (!priceMap[p.item_id]) priceMap[p.item_id] = {};
      priceMap[p.item_id][p.company_variant_id] = p.sale_price;
    });
    setPricing(priceMap);
  };

  const getMaterial = (id) => materials.find(m => m.id === id);
  
  const getRate = (itemId, variantId) => {
    if (variantId && pricing[itemId]?.[variantId]) {
      return pricing[itemId][variantId];
    }
    const mat = getMaterial(itemId);
    return mat?.sale_price || 0;
  };

  const addItem = () => {
    setItems([...items, { id: nextId, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false }]);
    setNextId(nextId + 1);
  };

  const removeItem = (id) => {
    setItems(items.filter(i => i.id !== id));
  };

  const updateItem = (id, field, value) => {
    setItems(items.map(item => {
      if (item.id !== id) return item;
      
      const updates = { [field]: value };
      
      if (field === 'item_id' && value) {
        const mat = getMaterial(value);
        updates.uses_variant = mat?.uses_variant || false;
        const effectiveVariantId = updates.uses_variant ? (formData.default_variant_id || '') : '';
        updates.variant_id = effectiveVariantId;
        updates.rate = getRate(value, effectiveVariantId || null);
      }
      
      if (field === 'variant_id' && item.item_id) {
        updates.rate = getRate(item.item_id, value || null);
      }
      
      if (field === 'supply_type') {
        updates.project_id = value === 'DIRECT_SUPPLY' ? item.project_id : '';
      }
      
      if ((field === 'quantity' || field === 'rate') || (field === 'variant_id' && item.item_id)) {
        const qty = field === 'quantity' ? parseFloat(value) || 0 : parseFloat(item.quantity) || 0;
        const rate = field === 'rate' ? parseFloat(value) || 0 : parseFloat(item.rate) || 0;
        updates.amount = qty * rate;
      }
      
      const qty = parseFloat(updates.quantity !== undefined ? updates.quantity : item.quantity) || 0;
      const variantId = updates.variant_id !== undefined ? updates.variant_id : item.variant_id;
      const usesVar = updates.uses_variant !== undefined ? updates.uses_variant : item.uses_variant;
      const supplyType = updates.supply_type !== undefined ? updates.supply_type : item.supply_type;
      const projId = updates.project_id !== undefined ? updates.project_id : item.project_id;
      const hasVariantMissing = usesVar && !variantId;
      const hasProjectMissing = supplyType === 'DIRECT_SUPPLY' && !projId;
      updates.valid = !!(item.item_id || updates.item_id) && qty > 0 && !hasVariantMissing && !hasProjectMissing;
      
      return { ...item, ...updates };
    }));
  };

  const handleDefaultVariantChange = (variantId) => {
    setFormData({ ...formData, default_variant_id: variantId });
    setItems(items.map(item => {
      if (!item.item_id) return item;
      if (!item.uses_variant) return item;
      return { ...item, variant_id: variantId, rate: getRate(item.item_id, variantId || null) };
    }));
  };

  const validateForm = () => {
    if (!formData.received_date) {
      alert('Please enter Received Date');
      return false;
    }
    if (!formData.vendor_name) {
      alert('Please enter Vendor');
      return false;
    }
    if (!formData.invoice_no) {
      alert('Please enter Invoice No');
      return false;
    }
    if (!formData.received_by) {
      alert('Please enter Received By');
      return false;
    }
    
    for (const item of items) {
      if (!item.item_id) continue;
      
      const itemSupplyType = item.supply_type || formData.supply_type;
      
      if (itemSupplyType === 'WAREHOUSE' && !formData.warehouse_id) {
        alert('Please select Warehouse for WAREHOUSE supply type');
        return false;
      }
      if (itemSupplyType === 'DIRECT_SUPPLY' && !item.project_id) {
        alert(`Project is required for DIRECT SUPPLY item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
      if (item.uses_variant && !item.variant_id) {
        alert(`Variant is required for item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
      if (!item.quantity || parseFloat(item.quantity) <= 0) {
        alert(`Invalid quantity for item: ${getMaterial(item.item_id)?.display_name || getMaterial(item.item_id)?.name}`);
        return false;
      }
    }
    
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    const validItems = items.filter(i => i.valid);
    if (validItems.length === 0) {
      alert('Please add at least one valid item');
      return;
    }

    try {
      const { data: inward, error } = await supabase.from('material_inward').insert({
        invoice_date: formData.invoice_date || null,
        received_date: formData.received_date,
        vendor_name: formData.vendor_name,
        invoice_no: formData.invoice_no,
        warehouse_id: formData.warehouse_id || null,
        variant_id: formData.default_variant_id || null,
        received_by: formData.received_by,
        acknowledged_by: formData.acknowledged_by || null,
        remarks: formData.remarks || null,
        supply_type: formData.supply_type,
        project_id: formData.project_id || null
      }).select().single();
      
      if (error) throw error;

      for (const item of validItems) {
        const mat = getMaterial(item.item_id);
        if (!mat) continue;
        
        const itemSupplyType = item.supply_type || formData.supply_type;
        const itemWarehouseId = itemSupplyType === 'WAREHOUSE' ? formData.warehouse_id : null;
        const itemProjectId = itemSupplyType === 'DIRECT_SUPPLY' ? item.project_id : null;
        const itemVariantId = item.uses_variant && item.variant_id ? item.variant_id : null;
        const qty = parseFloat(item.quantity);
        const rate = parseFloat(item.rate);
        const materialName = mat.display_name || mat.name || 'Unknown Item';

        const insertData = {
          inward_id: inward.id,
          material_id: item.item_id,
          material_name: materialName,
          unit: mat.unit || 'nos',
          quantity: qty,
          rate: rate,
          amount: qty * rate,
          warehouse_id: itemWarehouseId,
          variant_id: itemVariantId,
          supply_type: itemSupplyType,
          project_id: itemProjectId
        };

        const { error: itemError } = await supabase.from('material_inward_items').insert(insertData);
        if (itemError) throw itemError;

        if (itemSupplyType === 'WAREHOUSE' && itemWarehouseId) {
          const { data: existing } = await supabase.from('item_stock')
            .select('*')
            .eq('item_id', item.item_id)
            .eq('company_variant_id', itemVariantId)
            .eq('warehouse_id', itemWarehouseId)
            .single();

          if (existing) {
            await supabase.from('item_stock')
              .update({ current_stock: (parseFloat(existing.current_stock) || 0) + qty, updated_at: new Date().toISOString() })
              .eq('id', existing.id);
          } else {
            await supabase.from('item_stock').insert({
              item_id: item.item_id,
              company_variant_id: itemVariantId,
              warehouse_id: itemWarehouseId,
              current_stock: qty
            });
          }
        }
      }

      alert('Material inward submitted successfully!');
      setItems([{ id: 1, item_id: '', variant_id: '', quantity: '', rate: '', amount: 0, uses_variant: false, supply_type: 'WAREHOUSE', project_id: '', valid: false }]);
      setFormData({ 
        invoice_date: '', 
        received_date: new Date().toISOString().split('T')[0], 
        vendor_name: '', 
        invoice_no: '', 
        warehouse_id: '', 
        default_variant_id: '',
        received_by: '',
        acknowledged_by: '',
        remarks: '',
        supply_type: 'WAREHOUSE',
        project_id: ''
      });
    } catch (err) {
      alert('Error saving: ' + err.message);
    }
  };

  const totalQty = items.filter(i => i.valid).reduce((sum, i) => sum + (parseFloat(i.quantity) || 0), 0);
  const totalAmount = items.filter(i => i.valid).reduce((sum, i) => sum + (i.amount || 0), 0);

  const activeVariants = variants.filter(v => v.variant_name !== 'No Variant');

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Material Inward</h1>
        <button className="btn btn-secondary" onClick={() => setShowPasteModal(true)}>📋 Paste From Excel</button>
      </div>

      <div className="card" style={{ padding: '0', overflow: 'hidden' }}>
        <div style={{ 
          background: '#f8f9fa', 
          padding: '16px 20px', 
          borderBottom: '1px solid #e0e0e0',
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          alignItems: 'flex-end',
          position: 'sticky',
          top: 0,
          zIndex: 10
        }}>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice Date</label>
            <input type="date" className="form-input" value={formData.invoice_date} onChange={e => setFormData({...formData, invoice_date: e.target.value})} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Received Date *</label>
            <input type="date" className="form-input" value={formData.received_date} onChange={e => setFormData({...formData, received_date: e.target.value})} />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '160px' }}>
            <label className="form-label">Vendor *</label>
            <input type="text" className="form-input" value={formData.vendor_name} onChange={e => setFormData({...formData, vendor_name: e.target.value})} placeholder="Vendor name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Invoice No *</label>
            <input type="text" className="form-input" value={formData.invoice_no} onChange={e => setFormData({...formData, invoice_no: e.target.value})} placeholder="Invoice #" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label">Warehouse *</label>
            <select className="form-select" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})}>
              <option value="">Select</option>
              {warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label">Default Variant</label>
            <select className="form-select" value={formData.default_variant_id} onChange={e => handleDefaultVariantChange(e.target.value)}>
              <option value="">Select</option>
              {activeVariants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Received By *</label>
            <input type="text" className="form-input" value={formData.received_by} onChange={e => setFormData({...formData, received_by: e.target.value})} placeholder="Name" />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '130px' }}>
            <label className="form-label">Acknowledged By</label>
            <input type="text" className="form-input" value={formData.acknowledged_by} onChange={e => setFormData({...formData, acknowledged_by: e.target.value})} placeholder="Name" />
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: '40px' }}>#</th>
                <th style={{ minWidth: '180px' }}>Item</th>
                <th style={{ width: '90px' }}>Type</th>
                <th style={{ width: '120px' }}>Variant</th>
                <th style={{ width: '150px' }}>Project</th>
                <th style={{ width: '70px' }}>Qty</th>
                <th style={{ width: '80px' }}>Rate</th>
                <th style={{ width: '90px' }}>Amount</th>
                <th style={{ width: '40px' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, index) => {
                const mat = getMaterial(item.item_id);
                const itemSupplyType = item.supply_type || formData.supply_type;
                return (
                  <tr key={item.id} style={{ background: !item.valid && item.item_id ? '#fff3cd' : 'transparent' }}>
                    <td style={{ textAlign: 'center', color: '#666' }}>{index + 1}</td>
                    <td>
                      <select 
                        value={item.item_id} 
                        onChange={e => updateItem(item.id, 'item_id', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                      >
                        <option value="">Select Item</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.display_name || m.name}</option>
                        ))}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.supply_type || formData.supply_type} 
                        onChange={e => updateItem(item.id, 'supply_type', e.target.value)}
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', fontSize: '12px' }}
                      >
                        <option value="WAREHOUSE">Warehouse</option>
                        <option value="DIRECT_SUPPLY">Direct</option>
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.variant_id || ''} 
                        onChange={e => updateItem(item.id, 'variant_id', e.target.value)}
                        disabled={!item.uses_variant}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          borderRadius: '4px', 
                          border: '1px solid #ddd',
                          background: item.uses_variant ? '#fff' : '#f5f5f5',
                          fontSize: '12px'
                        }}
                      >
                        <option value="">{item.uses_variant ? 'Select' : 'N/A'}</option>
                        {activeVariants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}
                      </select>
                    </td>
                    <td>
                      <select 
                        value={item.project_id || ''} 
                        onChange={e => updateItem(item.id, 'project_id', e.target.value)}
                        disabled={itemSupplyType !== 'DIRECT_SUPPLY'}
                        style={{ 
                          width: '100%', 
                          padding: '6px', 
                          borderRadius: '4px', 
                          border: '1px solid #ddd',
                          background: itemSupplyType === 'DIRECT_SUPPLY' ? '#fff' : '#f5f5f5',
                          fontSize: '12px'
                        }}
                      >
                        <option value="">{itemSupplyType === 'DIRECT_SUPPLY' ? 'Select Project' : 'N/A'}</option>
                        {projects.map(p => (<option key={p.id} value={p.id}>{p.name}</option>))}
                      </select>
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={item.quantity} 
                        onChange={e => updateItem(item.id, 'quantity', e.target.value)}
                        placeholder="0" 
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }}
                      />
                    </td>
                    <td>
                      <input 
                        type="number" 
                        value={item.rate} 
                        onChange={e => updateItem(item.id, 'rate', e.target.value)}
                        placeholder="0" 
                        step="0.01"
                        style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', textAlign: 'right', fontSize: '12px' }}
                      />
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: '600', padding: '6px', fontSize: '12px' }}>
                      ₹{item.amount.toFixed(2)}
                    </td>
                    <td>
                      {items.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => removeItem(item.id)}
                          style={{ background: 'none', border: 'none', color: '#dc3545', cursor: 'pointer', fontSize: '18px' }}
                        >
                          ×
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <button 
          type="button"
          onClick={addItem}
          style={{ 
            margin: '12px 20px', 
            padding: '8px 16px', 
            background: '#fff', 
            border: '1px dashed #3498db', 
            borderRadius: '4px', 
            color: '#3498db',
            cursor: 'pointer'
          }}
        >
          + Add Row
        </button>

        <div style={{ 
          background: '#f0f7ff', 
          padding: '12px 20px', 
          borderTop: '2px solid #3498db',
          display: 'flex',
          gap: '40px',
          justifyContent: 'flex-end',
          position: 'sticky',
          bottom: 0
        }}>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Qty:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>{totalQty.toFixed(2)}</strong>
          </div>
          <div>
            <span style={{ color: '#666', marginRight: '8px' }}>Total Amount:</span>
            <strong style={{ fontSize: '18px', color: '#333' }}>₹{totalAmount.toFixed(2)}</strong>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
        <button type="button" className="btn btn-primary" onClick={handleSubmit}>Submit Inward</button>
        <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
      </div>

      {showPasteModal && (
        <div className="modal-overlay open" onClick={() => setShowPasteModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '600px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h2>Paste From Excel</h2>
              <button onClick={() => setShowPasteModal(false)} style={{ background: 'none', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            <p style={{ color: '#666', marginBottom: '12px' }}>
              Format: <strong>Item Name | Quantity | Rate (optional)</strong>
            </p>
            <textarea 
              value={pasteData}
              onChange={e => setPasteData(e.target.value)}
              placeholder="Item Name&#9;Quantity&#9;Rate&#10;Ball Valve&#9;100&#9;250"
              style={{ width: '100%', height: '200px', padding: '12px', fontFamily: 'monospace', border: '1px solid #ddd', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
              <button className="btn btn-primary" onClick={() => setShowPasteModal(false)}>Import</button>
              <button className="btn btn-secondary" onClick={() => setShowPasteModal(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MaterialOutward({ onSuccess, onCancel }) {
  const [materials, setMaterials] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [variants, setVariants] = useState([]);
  const [formData, setFormData] = useState({ outward_date: new Date().toISOString().split('T')[0], project_id: '', remarks: '', warehouse_id: '', variant_id: '' });
  const [items, setItems] = useState([{ item_id: '', quantity: '' }]);
  
  const loadData = async () => {
    const [mat, wh, varData] = await Promise.all([
      supabase.from('materials').select('id, display_name, name').eq('is_active', true).order('name'),
      supabase.from('warehouses').select('*').order('name'),
      supabase.from('company_variants').select('*').eq('is_active', true).order('variant_name')
    ]);
    setMaterials(mat.data || []);
    setWarehouses(wh.data || []);
    setVariants(varData.data || []);
  };

  useEffect(() => { loadData(); }, []);

  const addItem = () => setItems([...items, { item_id: '', quantity: '' }]);
  const updateItem = (i, field, val) => { const n = [...items]; n[i][field] = val; setItems(n); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.warehouse_id) { alert('Please select a warehouse'); return; }
    if (!formData.variant_id) { alert('Please select a variant'); return; }
    
    const { data: outward } = await supabase.from('material_outward').insert(formData).select().single();
    
    for (const item of items.filter(i => i.item_id)) {
      const qty = parseFloat(item.quantity) || 0;
      
      await supabase.from('material_outward_items').insert({
        outward_id: outward.id,
        material_id: item.item_id,
        variant_id: formData.variant_id,
        warehouse_id: formData.warehouse_id,
        quantity: qty
      });
      
      const { data: existing } = await supabase.from('item_stock').select('*').eq('item_id', item.item_id).eq('company_variant_id', formData.variant_id).eq('warehouse_id', formData.warehouse_id).single();
      
      if (existing) {
        const newStock = Math.max(0, (existing.current_stock || 0) - qty);
        await supabase.from('item_stock').update({ current_stock: newStock, updated_at: new Date().toISOString() }).eq('id', existing.id);
      }
    }
    onSuccess();
  };

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Material Outward</h1></div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={formData.outward_date} onChange={e => setFormData({...formData, outward_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Warehouse *</label><select className="form-select" value={formData.warehouse_id} onChange={e => setFormData({...formData, warehouse_id: e.target.value})} required><option value="">Select Warehouse</option>{warehouses.map(w => (<option key={w.id} value={w.id}>{w.warehouse_name || w.name}</option>))}</select></div>
            <div className="form-group"><label className="form-label">Variant *</label><select className="form-select" value={formData.variant_id} onChange={e => setFormData({...formData, variant_id: e.target.value})} required><option value="">Select Variant</option>{variants.map(v => (<option key={v.id} value={v.id}>{v.variant_name}</option>))}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Project</label><select className="form-select" value={formData.project_id} onChange={e => setFormData({...formData, project_id: e.target.value})}><option value="">Select Project</option></select></div>
          </div>
          <div className="form-group">
            <label className="form-label">Items</label>
            <div className="item-list">
              <div className="item-row header"><span>Item</span><span>Qty</span><span></span></div>
              {items.map((item, i) => (
                <div className="item-row" key={i}>
                  <select value={item.item_id} onChange={e => updateItem(i, 'item_id', e.target.value)}><option value="">Select Item</option>{materials.map(m => (<option key={m.id} value={m.id}>{m.display_name || m.name}</option>))}</select>
                  <input type="number" value={item.quantity} onChange={e => updateItem(i, 'quantity', e.target.value)} placeholder="Qty" />
                  <span className="delete-btn" onClick={() => setItems(items.filter((_, idx) => idx !== i))}>×</span>
                </div>
              ))}
            </div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={addItem} style={{marginTop:'12px'}}>+ Add Item</button>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}><button type="submit" className="btn btn-primary">Submit</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
        </form>
      </div>
    </div>
  );
}

function StockBalance() { return <div><div className="page-header"><h1 className="page-title">Stock Balance</h1></div><div className="card"><div className="empty-state"><h3>Stock Balance</h3></div></div></div>; }
function StockReport() { return <div><div className="page-header"><h1 className="page-title">Stock Report</h1></div><div className="card"><div className="empty-state"><h3>Stock Report</h3></div></div></div>; }

function DCEdit({ dcId, onCancel }) {
  const [editDC, setEditDC] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDC();
  }, [dcId]);

  const loadDC = async () => {
    const { data } = await supabase.from('delivery_challans').select('*').eq('id', dcId).single();
    setEditDC(data);
    setLoading(false);
  };

  if (loading) return <div>Loading...</div>;
  if (!editDC) return <div>DC not found</div>;

  return <CreateDC editDC={editDC} onSuccess={() => onCancel()} onCancel={onCancel} />;
}
function PurchaseReport() { return <div><div className="page-header"><h1 className="page-title">Purchase Report</h1></div><div className="card"><div className="empty-state"><h3>Purchase Report</h3></div></div></div>; }
function SalesReport() { return <div><div className="page-header"><h1 className="page-title">Sales Report</h1></div><div className="card"><div className="empty-state"><h3>Sales Report</h3></div></div></div>; }

function SettingsPage() {
  const { user, organisation, handleLogout } = useAuth();
  const [users, setUsers] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ emp_name: '', email: '', role: 'Assistant' });

  useEffect(() => { supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const empId = 'EMP-' + Date.now().toString().slice(-6);
    await supabase.from('users').insert({ ...formData, emp_id: empId });
    setShowForm(false); setFormData({ emp_name: '', email: '', role: 'Assistant' });
    supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || []));
  };

  const deleteUser = async (id) => { if (confirm('Delete this user?')) { await supabase.from('users').delete().eq('id', id); supabase.from('users').select('*').order('created_at', { ascending: false }).then(({ data }) => setUsers(data || [])); }};

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Settings</h1></div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Account</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px' }}>
          <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: '#3498db', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 'bold' }}>
            {(user?.email || '?').charAt(0).toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 'bold' }}>{user?.email}</div>
            <div style={{ color: '#666', fontSize: '14px' }}>{organisation?.name}</div>
          </div>
        </div>
        <button onClick={handleLogout} className="btn btn-secondary">Sign Out</button>
      </div>
      
      <div className="card" style={{ marginBottom: '20px' }}>
        <h3 className="card-title">Organisation Settings</h3>
        <p>Manage your organisation details and members</p>
        <a href="#/settings/organisation" className="btn btn-primary" onClick={(e) => { e.preventDefault(); window.location.hash = '/settings/organisation'; }}>Manage Organisation</a>
      </div>

      <div className="card">
        <div className="page-header" style={{ marginBottom: '16px' }}>
          <h3 className="card-title" style={{ margin: 0 }}>User Access Rights</h3>
          <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ Add User'}</button>
        </div>
        
        {showForm && (
          <div className="card" style={{ marginBottom: '16px' }}>
            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="form-group"><label className="form-label">Employee Name *</label><input type="text" className="form-input" value={formData.emp_name} onChange={e => setFormData({...formData, emp_name: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Email *</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} required /></div>
                <div className="form-group"><label className="form-label">Role *</label><select className="form-select" value={formData.role} onChange={e => setFormData({...formData, role: e.target.value})}><option value="Admin">Admin</option><option value="Engineer">Engineer</option><option value="Manager">Manager</option><option value="Assistant">Assistant</option><option value="Stores">Stores</option><option value="Site Engineer">Site Engineer</option></select></div>
              </div>
              <button type="submit" className="btn btn-primary">Save User</button>
            </form>
          </div>
        )}

        <div className="table-container">
          <table className="table">
            <thead><tr><th>Emp ID</th><th>Emp Name</th><th>Email</th><th>Role</th><th>Actions</th></tr></thead>
            <tbody>{users.map(u => (<tr key={u.id}><td>{u.emp_id}</td><td>{u.emp_name}</td><td>{u.email}</td><td>{u.role}</td><td><button className="btn btn-sm btn-secondary" onClick={() => deleteUser(u.id)}>Delete</button></td></tr>))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MeetingsDashboard({ onNavigate }) {
  const [meetings, setMeetings] = useState([])
  const [filter, setFilter] = useState('upcoming')
  const [viewMode, setViewMode] = useState('list')

  const loadMeetings = async () => {
    let query = supabase.from('meetings').select('*').order('meeting_date', { ascending: true })
    if (filter === 'upcoming') {
      query = query.gte('meeting_date', new Date().toISOString().split('T')[0]).eq('status', 'upcoming')
    } else if (filter === 'completed') {
      query = query.eq('status', 'completed')
    } else if (filter === 'cancelled') {
      query = query.eq('status', 'cancelled')
    }
    const { data } = await query
    setMeetings(data || [])
  }

  useEffect(() => { loadMeetings() }, [filter])

  const updateStatus = async (id, status) => {
    await supabase.from('meetings').update({ status }).eq('id', id)
    loadMeetings()
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Meetings</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/meetings/create')}>+ Create Meeting</button>
      </div>

      <div className="card" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <button className={`btn ${filter === 'upcoming' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('upcoming')}>Upcoming</button>
          <button className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('completed')}>Completed</button>
          <button className={`btn ${filter === 'cancelled' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('cancelled')}>Cancelled</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>List View</button>
            <button className={`btn ${viewMode === 'calendar' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('calendar')}>Calendar View</button>
          </div>
        </div>

        {meetings.length === 0 ? (
          <div className="empty-state"><h3>No Meetings</h3></div>
        ) : viewMode === 'list' ? (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Date</th><th>Time</th><th>Client</th><th>Location</th><th>Description</th><th>Participants</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{meetings.map(m => (
                <tr key={m.id}>
                  <td>{m.meeting_date}</td>
                  <td>{m.meeting_time || '-'}</td>
                  <td>{m.client_name}</td>
                  <td>{m.location || '-'}</td>
                  <td>{m.description || '-'}</td>
                  <td>{m.participants || '-'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: m.status === 'upcoming' ? '#d1ecf1' : m.status === 'completed' ? '#d4edda' : '#f8d7da', color: m.status === 'upcoming' ? '#0c5460' : m.status === 'completed' ? '#155724' : '#721c24' }}>{m.status}</span></td>
                  <td>
                    {m.status === 'upcoming' && (
                      <>
                        <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(m.id, 'completed')}>Mark Complete</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => updateStatus(m.id, 'cancelled')}>Cancel</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '16px' }}>
            {meetings.map(m => (
              <div key={m.id} className="card" style={{ padding: '16px' }}>
                <div style={{ fontWeight: 'bold', marginBottom: '8px' }}>{m.client_name}</div>
                <div style={{ fontSize: '14px', color: '#666' }}>{m.meeting_date} {m.meeting_time}</div>
                <div style={{ fontSize: '14px' }}>{m.location}</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>{m.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CreateMeeting({ onSuccess, onCancel }) {
  const [formData, setFormData] = useState({
    client_name: '',
    meeting_date: new Date().toISOString().split('T')[0],
    meeting_time: '',
    description: '',
    location: '',
    participants: ''
  })

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase.from('meetings').insert(formData)
    if (error) { alert('Error: ' + error.message); return }
    onSuccess()
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Create Meeting</h1></div>
      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Meeting Date *</label><input type="date" className="form-input" value={formData.meeting_date} onChange={e => setFormData({...formData, meeting_date: e.target.value})} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Meeting Time</label><input type="time" className="form-input" value={formData.meeting_time} onChange={e => setFormData({...formData, meeting_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location} onChange={e => setFormData({...formData, location: e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Participants</label><input type="text" className="form-input" value={formData.participants} onChange={e => setFormData({...formData, participants: e.target.value})} placeholder="Comma separated names" /></div>
          <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
          <div style={{ display: 'flex', gap: '12px' }}><button type="submit" className="btn btn-primary">Save Meeting</button><button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button></div>
        </form>
      </div>
    </div>
  )
}

function ClientRequests() {
  const [requests, setRequests] = useState([])
  const [showForm, setShowForm] = useState(false)
  const [formData, setFormData] = useState({ client_name: '', subject: '', request_date: new Date().toISOString().split('T')[0], description: '', priority: 'medium' })

  const loadRequests = async () => {
    const { data } = await supabase.from('client_requests').select('*').order('request_date', { ascending: false })
    setRequests(data || [])
  }

  useEffect(() => { loadRequests() }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    await supabase.from('client_requests').insert(formData)
    setShowForm(false)
    setFormData({ client_name: '', subject: '', request_date: new Date().toISOString().split('T')[0], description: '', priority: 'medium' })
    loadRequests()
  }

  const updateStatus = async (id, status) => {
    await supabase.from('client_requests').update({ status }).eq('id', id)
    loadRequests()
  }

  const getPriorityColor = (p) => {
    if (p === 'high') return '#f8d7da'
    if (p === 'medium') return '#fff3cd'
    return '#d4edda'
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client Requests</h1>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>{showForm ? 'Cancel' : '+ New Request'}</button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom: '20px' }}>
          <form onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Client Name *</label><input type="text" className="form-input" value={formData.client_name} onChange={e => setFormData({...formData, client_name: e.target.value})} required /></div>
              <div className="form-group"><label className="form-label">Subject *</label><input type="text" className="form-input" value={formData.subject} onChange={e => setFormData({...formData, subject: e.target.value})} required /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label className="form-label">Request Date</label><input type="date" className="form-input" value={formData.request_date} onChange={e => setFormData({...formData, request_date: e.target.value})} /></div>
              <div className="form-group"><label className="form-label">Priority</label><select className="form-select" value={formData.priority} onChange={e => setFormData({...formData, priority: e.target.value})}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></div>
            </div>
            <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} /></div>
            <button type="submit" className="btn btn-primary">Submit Request</button>
          </form>
        </div>
      )}

      <div className="card">
        {requests.length === 0 ? <div className="empty-state"><h3>No Client Requests</h3></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Date</th><th>Client</th><th>Subject</th><th>Priority</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{requests.map(r => (
                <tr key={r.id}>
                  <td>{r.request_date}</td>
                  <td>{r.client_name}</td>
                  <td>{r.subject}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: getPriorityColor(r.priority) }}>{r.priority}</span></td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: r.status === 'pending' ? '#fff3cd' : '#d4edda' }}>{r.status}</span></td>
                  <td>
                    {r.status === 'pending' && (
                      <button className="btn btn-sm btn-secondary" onClick={() => updateStatus(r.id, 'resolved')}>Mark Resolved</button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function SiteVisitsDashboard({ onNavigate }) {
  const [visits, setVisits] = useState([])
  const [clients, setClients] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [viewMode, setViewMode] = useState('list')

  const loadData = async () => {
    const { data: clientsData } = await supabase.from('clients').select('*').order('client_name')
    setClients(clientsData || [])
    
    let query = supabase.from('site_visits').select('*, client:clients(client_name)').order('visit_date', { ascending: false })
    
    if (filter === 'pending') {
      query = query.eq('status', 'Pending')
    } else if (filter === 'completed') {
      query = query.eq('status', 'Completed')
    } else if (filter === 'this_month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      query = query.gte('visit_date', startOfMonth.toISOString().split('T')[0])
    }
    
    const { data } = await query
    setVisits(data || [])
  }

  useEffect(() => { loadData() }, [filter])

  const getStatusColor = (status) => {
    if (status === 'Pending') return '#fff3cd'
    if (status === 'Quote to be Sent') return '#cce5ff'
    if (status === 'Offer Submitted') return '#d4edda'
    if (status === 'Completed') return '#155724'
    return '#e2e3e5'
  }

  const filteredVisits = visits.filter(v => {
    const clientName = v.client?.client_name?.toLowerCase() || ''
    return clientName.includes(searchTerm.toLowerCase()) || v.site_address?.toLowerCase().includes(searchTerm.toLowerCase())
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Site Visits</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/site-visits/new')}>+ New Visit</button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('pending')}>Pending</button>
          <button className={`btn ${filter === 'this_month' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('this_month')}>This Month</button>
          <button className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('completed')}>Completed</button>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input 
              type="text" 
              className="form-input" 
              placeholder="Search visits..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ width: '250px' }}
            />
            <button className={`btn ${viewMode === 'list' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('list')}>List</button>
            <button className={`btn ${viewMode === 'card' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setViewMode('card')}>Card</button>
          </div>
        </div>
      </div>

      <div className="card">
        {filteredVisits.length === 0 ? <div className="empty-state"><h3>No Site Visits</h3></div> : viewMode === 'list' ? (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Date</th><th>Client</th><th>Site Address</th><th>Visited By</th><th>Next Step</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filteredVisits.map(v => (
                <tr key={v.id}>
                  <td>{v.visit_date}</td>
                  <td>{v.client?.client_name || '-'}</td>
                  <td>{v.site_address || '-'}</td>
                  <td>{v.visited_by || v.engineer_name || '-'}</td>
                  <td>{v.next_step || '-'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: getStatusColor(v.status), fontSize: '12px' }}>{v.status}</span></td>
                  <td><button className="btn btn-sm btn-secondary" onClick={() => onNavigate('/site-visits/edit?id=' + v.id)}>Edit</button></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
            {filteredVisits.map(v => (
              <div key={v.id} className="card" style={{ padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 'bold' }}>{v.client?.client_name || '-'}</span>
                  <span style={{ padding: '2px 8px', borderRadius: '4px', background: getStatusColor(v.status), fontSize: '11px' }}>{v.status}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#666', marginBottom: '4px' }}>{v.visit_date} {v.visit_time}</div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Address:</strong> {v.site_address || '-'}</div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Visited By:</strong> {v.visited_by || v.engineer_name || '-'}</div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Purpose:</strong> {v.purpose_of_visit || '-'}</div>
                <div style={{ fontSize: '13px', marginBottom: '4px' }}><strong>Next Step:</strong> {v.next_step || '-'}</div>
                <div style={{ fontSize: '13px', marginBottom: '8px' }}><strong>Follow Up:</strong> {v.follow_up_date || '-'}</div>
                <div style={{ fontSize: '13px', marginBottom: '12px' }}><strong>Measurements:</strong> {v.measurements ? v.measurements.substring(0, 50) + '...' : '-'}</div>
                <button className="btn btn-sm btn-secondary" onClick={() => onNavigate('/site-visits/edit?id=' + v.id)}>Edit</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SiteVisitEdit({ editId, onSuccess, onCancel }) {
  const [visitData, setVisitData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    console.log('SiteVisitEdit: received editId', editId)
    if (editId) {
      supabase.from('site_visits').select('*').eq('id', editId).single()
        .then(({ data, error }) => {
          if (error) {
            console.error('Supabase fetch error:', error)
            setVisitData(null) 
          } else if (data) {
            setVisitData(data)
          } else {
            console.log('Supabase returned no data for id:', editId)
            setVisitData(null) 
          }
          setLoading(false)
        })
        .catch(err => {
          console.error('Unhandled fetch exception:', err)
          setVisitData(null)
          setLoading(false)
        })
    } else {
      console.log('SiteVisitEdit: no editId found')
      setLoading(false)
    }
  }, [editId])

  if (loading) return <div style={{ padding: '20px' }}>Loading...</div>
  if (!visitData) return <div style={{ padding: '20px' }}>Visit not found. <button onClick={() => window.location.hash = '#/site-visits'}>Go back</button></div>

  return <CreateSiteVisit onSuccess={onSuccess} onCancel={onCancel} editMode={true} visitData={visitData} />
}

function CreateSiteVisit({ onSuccess, onCancel, editMode, visitData: propVisitData }) {
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState(propVisitData || {
    client_id: '',
    visit_date: new Date().toISOString().split('T')[0],
    visit_time: '',
    out_time: '',
    engineer_name: '',
    visited_by: '',
    purpose_of_visit: '',
    site_address: '',
    location: '',
    measurements: '',
    discussion_points: '',
    follow_up_date: '',
    next_step: 'Quote to be Sent',
    status: 'Pending'
  })
  const [saving, setSaving] = useState(false)
  const [photos, setPhotos] = useState([])
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { 
    loadClients()
  }, [])

  useEffect(() => {
    if (propVisitData?.id) {
      loadExistingPhotos(propVisitData.id)
      loadExistingDocuments(propVisitData.id)
    }
  }, [propVisitData?.id])

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('*').order('client_name')
    setClients(data || [])
  }

  const loadExistingPhotos = async (visitId) => {
    const { data } = await supabase.from('site_visit_photos').select('*').eq('site_visit_id', visitId)
    if (data) setPhotos(data)
  }

  const loadExistingDocuments = async (visitId) => {
    const { data } = await supabase.from('site_visit_documents').select('*').eq('site_visit_id', visitId)
    if (data) setDocuments(data)
  }

  const compressImage = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = (event) => {
        const img = new Image()
        img.src = event.target.result
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const maxSize = 1920
          let width = img.width
          let height = img.height
          
          if (width > height && width > maxSize) {
            height = (height * maxSize) / width
            width = maxSize
          } else if (height > maxSize) {
            width = (width * maxSize) / height
            height = maxSize
          }
          
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          ctx.drawImage(img, 0, 0, width, height)
          
          let quality = 0.8
          let dataUrl = canvas.toDataURL('image/jpeg', quality)
          
          while (dataUrl.length > 1500000 && quality > 0.2) {
            quality -= 0.1
            dataUrl = canvas.toDataURL('image/jpeg', quality)
          }
          
          resolve(dataUrl)
        }
      }
    })
  }

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files)
    setUploading(true)
    
    for (const file of files) {
      try {
        let fileData
        
        if (file.size > 1200 * 1024) {
          const compressed = await compressImage(file)
          const base64Data = compressed.split(',')[1]
          fileData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0))
        } else {
          const arrayBuffer = await file.arrayBuffer()
          fileData = new Uint8Array(arrayBuffer)
        }
        
        const fileName = `photo_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        const { data, error } = await supabase.storage
          .from('site-visit-photos')
          .upload(fileName, fileData, { contentType: 'image/jpeg' })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('site-visit-photos').getPublicUrl(fileName)
          setPhotos(prev => [...prev, { photo_url: urlData.publicUrl, description: '' }])
        }
      } catch (err) {
        console.log('Photo upload skipped:', err.message)
      }
    }
    setUploading(false)
  }

  const handleDocumentUpload = async (e) => {
    const files = Array.from(e.target.files)
    setUploading(true)
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileName = `doc_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        
        const { data, error } = await supabase.storage
          .from('site-visit-documents')
          .upload(fileName, uint8Array, { contentType: file.type })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('site-visit-documents').getPublicUrl(fileName)
          setDocuments(prev => [...prev, { document_name: file.name, document_url: urlData.publicUrl, document_type: file.type }])
        }
      } catch (err) {
        console.log('Document upload skipped:', err.message)
      }
    }
    setUploading(false)
  }

  const removePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index))
  }

  const removeDocument = (index) => {
    setDocuments(prev => prev.filter((_, i) => i !== index))
  }

  const handleClientChange = (clientId) => {
    const client = clients.find(c => c.id === clientId)
    setFormData({
      ...formData,
      client_id: clientId,
      site_address: client?.address1 || ''
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    
    try {
      const dataToSave = {
        client_id: formData.client_id || null,
        visit_date: formData.visit_date,
        visit_time: formData.visit_time || null,
        out_time: formData.out_time || null,
        engineer_name: formData.engineer_name || null,
        visited_by: formData.visited_by || null,
        purpose_of_visit: formData.purpose_of_visit || null,
        site_address: formData.site_address || null,
        location: formData.location || null,
        measurements: formData.measurements || null,
        discussion_points: formData.discussion_points || null,
        follow_up_date: formData.follow_up_date || null,
        next_step: formData.next_step || 'Quote to be Sent',
        status: formData.status || 'Pending'
      }
      
      let visitId = propVisitData?.id || window.visitData?.id
      
      if (editMode && visitId) {
        const { error } = await supabase.from('site_visits').update(dataToSave).eq('id', visitId)
        if (error) throw error
      } else {
        const { data, error } = await supabase.from('site_visits').insert(dataToSave).select().single()
        if (error) throw error
        visitId = data?.id
      }
      
      if (visitId && photos.length > 0) {
        for (const photo of photos) {
          if (!photo.id && photo.photo_url) {
            await supabase.from('site_visit_photos').insert({
              site_visit_id: visitId,
              photo_url: photo.photo_url,
              description: photo.description || ''
            }).catch(() => {})
          }
        }
      }
      
      if (visitId && documents.length > 0) {
        for (const doc of documents) {
          if (!doc.id && doc.document_url) {
            await supabase.from('site_visit_documents').insert({
              site_visit_id: visitId,
              document_name: doc.document_name,
              document_url: doc.document_url,
              document_type: doc.document_type
            }).catch(() => {})
          }
        }
      }
      
      alert(editMode ? 'Site visit updated successfully!' : 'Site visit saved successfully!')
      onSuccess()
    } catch (err) {
      alert('Error: ' + err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">{editMode ? 'Edit Site Visit' : 'New Site Visit'}</h1></div>
      <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Client *</label>
              <select className="form-select" value={formData.client_id || ''} onChange={e => handleClientChange(e.target.value)} required>
                <option value="">Select Client</option>
                {clients.map(c => (<option key={c.id} value={c.id}>{c.client_name}</option>))}
              </select>
            </div>
            <div className="form-group"><label className="form-label">Visit Date *</label><input type="date" className="form-input" value={formData.visit_date || ''} onChange={e => setFormData({...formData, visit_date: e.target.value})} required /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">In Time</label><input type="time" className="form-input" value={formData.visit_time || ''} onChange={e => setFormData({...formData, visit_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Out Time</label><input type="time" className="form-input" value={formData.out_time || ''} onChange={e => setFormData({...formData, out_time: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Engineer</label><input type="text" className="form-input" value={formData.engineer_name || ''} onChange={e => setFormData({...formData, engineer_name: e.target.value})} placeholder="Engineer name" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Visited By</label><input type="text" className="form-input" value={formData.visited_by || ''} onChange={e => setFormData({...formData, visited_by: e.target.value})} placeholder="Who visited" /></div>
            <div className="form-group"><label className="form-label">Purpose</label><input type="text" className="form-input" value={formData.purpose_of_visit || ''} onChange={e => setFormData({...formData, purpose_of_visit: e.target.value})} placeholder="Reason for visit" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Site Address</label><input type="text" className="form-input" value={formData.site_address || ''} onChange={e => setFormData({...formData, site_address: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Location</label><input type="text" className="form-input" value={formData.location || ''} onChange={e => setFormData({...formData, location: e.target.value})} placeholder="Google Maps link" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Measurements</label><textarea className="form-textarea" value={formData.measurements || ''} onChange={e => setFormData({...formData, measurements: e.target.value})} rows={2} placeholder="Site measurements" /></div>
            <div className="form-group"><label className="form-label">Discussion</label><textarea className="form-textarea" value={formData.discussion_points || ''} onChange={e => setFormData({...formData, discussion_points: e.target.value})} rows={2} placeholder="Discussion with client" /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Follow Up</label><input type="date" className="form-input" value={formData.follow_up_date || ''} onChange={e => setFormData({...formData, follow_up_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Next Step</label>
              <select className="form-select" value={formData.next_step || 'Quote to be Sent'} onChange={e => setFormData({...formData, next_step: e.target.value})}>
                <option value="Quote to be Sent">Quote to be Sent</option>
                <option value="Offer Submitted">Offer Submitted</option>
                <option value="Follow up Required">Follow up Required</option>
                <option value="Client Approval Pending">Client Approval Pending</option>
                <option value="Order Pending">Order Pending</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
            <div className="form-group"><label className="form-label">Status</label>
              <select className="form-select" value={formData.status || 'Pending'} onChange={e => setFormData({...formData, status: e.target.value})}>
                <option value="Pending">Pending</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Photos</label><input type="file" className="form-input" accept="image/*" multiple onChange={handlePhotoUpload} disabled={uploading} /></div>
            <div className="form-group"><label className="form-label">Documents</label><input type="file" className="form-input" accept=".pdf,.doc,.docx,.xls,.xlsx" multiple onChange={handleDocumentUpload} disabled={uploading} /></div>
          </div>
          {photos.length > 0 && (<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>{photos.map((p, i) => (<div key={i} style={{ position: 'relative', width: '60px', height: '60px' }}><img src={p.photo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '4px' }} /><button type="button" onClick={() => removePhoto(i)} style={{ position: 'absolute', top: '-5px', right: '-5px', background: 'red', color: 'white', border: 'none', borderRadius: '50%', width: '18px', height: '18px', cursor: 'pointer' }}>×</button></div>))}</div>)}
          {documents.length > 0 && (<div style={{ marginBottom: '12px' }}>{documents.map((d, i) => (<div key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 8px', background: '#f5f5f5', borderRadius: '4px', marginRight: '8px', marginBottom: '4px' }}><span style={{ fontSize: '12px' }}>{d.document_name}</span><button type="button" onClick={() => removeDocument(i)} style={{ background: 'red', color: 'white', border: 'none', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer', fontSize: '10px' }}>×</button></div>))}</div>)}
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editMode ? 'Update' : 'Save')}</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ============== SUB-CONTRACTOR MODULE ==============

function SubcontractorDashboard({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [filter, setFilter] = useState('all')
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => { loadData() }, [filter])

  const loadData = async () => {
    let query = supabase.from('subcontractors').select('*').order('created_at', { ascending: false })
    if (filter === 'active') query = query.eq('status', 'Active')
    else if (filter === 'inactive') query = query.eq('status', 'Inactive')
    const { data } = await query
    setSubcontractors(data || [])
  }

  const filtered = subcontractors.filter(s => s.company_name?.toLowerCase().includes(searchTerm.toLowerCase()))

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Sub-Contractors</h1>
        <button className="btn btn-primary" onClick={() => onNavigate('/subcontractors/new')}>+ Add Sub-Contractor</button>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('all')}>All</button>
          <button className={`btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('active')}>Active</button>
          <button className={`btn ${filter === 'inactive' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setFilter('inactive')}>Inactive</button>
          <input type="text" className="form-input" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} style={{ width: '200px', marginLeft: 'auto' }} />
        </div>
      </div>
      <div className="card">
        {filtered.length === 0 ? <div className="empty-state"><h3>No Sub-Contractors</h3></div> : (
          <div className="table-container">
            <table className="table">
              <thead><tr><th>Company</th><th>Contact Person</th><th>Phone</th><th>Nature of Work</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>{filtered.map(s => (
                <tr key={s.id}>
                  <td>{s.company_name}</td>
                  <td>{s.contact_person || '-'}</td>
                  <td>{s.phone || '-'}</td>
                  <td>{s.nature_of_work || '-'}</td>
                  <td><span style={{ padding: '4px 8px', borderRadius: '4px', background: s.status === 'Active' ? '#d4edda' : '#f8d7da', fontSize: '12px' }}>{s.status}</span></td>
                  <td>
                    <button className="btn btn-sm btn-secondary" onClick={() => { window.subToView = s; onNavigate('/subcontractors/view?id=' + s.id) }}>View</button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

function CreateSubcontractor({ onSuccess, onCancel, editMode, subData }) {
  const [formData, setFormData] = useState(subData || {
    company_name: '', contact_person: '', phone: '', email: '', address: '', state: '', gstin: '',
    nature_of_work: '', internal_remarks: '', nda_signed: false, contract_signed: false,
    nda_date: '', contract_date: '', status: 'Active'
  })
  const [saving, setSaving] = useState(false)

  const indianStates = ['Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal', 'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry']

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    try {
      if (editMode && subData?.id) {
        await supabase.from('subcontractors').update(formData).eq('id', subData.id)
      } else {
        await supabase.from('subcontractors').insert(formData)
      }
      onSuccess()
    } catch (err) { alert('Error: ' + err.message) }
    setSaving(false)
  }

  return (
    <div>
      <div className="page-header"><h1 className="page-title">{editMode ? 'Edit' : 'Add'} Sub-Contractor</h1></div>
      <div className="card" style={{ maxHeight: 'calc(100vh - 200px)', overflowY: 'auto' }}>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Company Name *</label><input type="text" className="form-input" value={formData.company_name} onChange={e => setFormData({...formData, company_name: e.target.value})} required /></div>
            <div className="form-group"><label className="form-label">Contact Person</label><input type="text" className="form-input" value={formData.contact_person} onChange={e => setFormData({...formData, contact_person: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Phone</label><input type="text" className="form-input" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} /></div>
            <div className="form-group"><label className="form-label">Email</label><input type="email" className="form-input" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} /></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">State</label><select className="form-select" value={formData.state} onChange={e => setFormData({...formData, state: e.target.value})}><option value="">Select</option>{indianStates.map(st => <option key={st} value={st}>{st}</option>)}</select></div>
            <div className="form-group"><label className="form-label">GSTIN</label><input type="text" className="form-input" value={formData.gstin} onChange={e => setFormData({...formData, gstin: e.target.value.toUpperCase()})} maxLength={15} /></div>
          </div>
          <div className="form-group"><label className="form-label">Address</label><textarea className="form-textarea" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} rows={2} /></div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Nature of Work</label><input type="text" className="form-input" value={formData.nature_of_work} onChange={e => setFormData({...formData, nature_of_work: e.target.value})} placeholder="e.g., Electrical, Plumbing, HVAC" /></div>
            <div className="form-group"><label className="form-label">Status</label><select className="form-select" value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})}><option value="Active">Active</option><option value="Inactive">Inactive</option></select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label"><input type="checkbox" checked={formData.nda_signed} onChange={e => setFormData({...formData, nda_signed: e.target.checked})} /> NDA Signed</label><input type="date" className="form-input" value={formData.nda_date} onChange={e => setFormData({...formData, nda_date: e.target.value})} /></div>
            <div className="form-group"><label className="form-label"><input type="checkbox" checked={formData.contract_signed} onChange={e => setFormData({...formData, contract_signed: e.target.checked})} /> Contract Signed</label><input type="date" className="form-input" value={formData.contract_date} onChange={e => setFormData({...formData, contract_date: e.target.value})} /></div>
          </div>
          <div className="form-group"><label className="form-label">Internal Remarks</label><textarea className="form-textarea" value={formData.internal_remarks} onChange={e => setFormData({...formData, internal_remarks: e.target.value})} rows={2} /></div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : (editMode ? 'Update' : 'Save')}</button>
            <button type="button" className="btn btn-secondary" onClick={onCancel}>Cancel</button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SubcontractorView({ onNavigate }) {
  const [sub, setSub] = useState(null)
  const [activeTab, setActiveTab] = useState('details')
  const [workOrders, setWorkOrders] = useState([])
  const [attendance, setAttendance] = useState([])
  const [dailyLogs, setDailyLogs] = useState([])
  const [payments, setPayments] = useState([])
  const [invoices, setInvoices] = useState([])

  useEffect(() => {
    const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id')
    if (id) {
      supabase.from('subcontractors').select('*').eq('id', id).single().then(({ data }) => setSub(data))
      supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', id).then(({ data }) => setWorkOrders(data || []))
      supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', id).order('attendance_date', { ascending: false }).then(({ data }) => setAttendance(data || []))
      supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', id).order('log_date', { ascending: false }).then(({ data }) => setDailyLogs(data || []))
      supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', id).order('payment_date', { ascending: false }).then(({ data }) => setPayments(data || []))
      supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', id).order('invoice_date', { ascending: false }).then(({ data }) => setInvoices(data || []))
    }
  }, [])

  if (!sub) return <div style={{ padding: '20px' }}>Loading...</div>

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{sub.company_name}</h1>
        <button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>← Back</button>
      </div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button className={`btn ${activeTab === 'details' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('details')}>Details</button>
          <button className={`btn ${activeTab === 'workorders' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('workorders')}>Work Orders ({workOrders.length})</button>
          <button className={`btn ${activeTab === 'attendance' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('attendance')}>Attendance ({attendance.length})</button>
          <button className={`btn ${activeTab === 'dailylogs' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('dailylogs')}>Daily Logs ({dailyLogs.length})</button>
          <button className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('payments')}>Payments ({payments.length})</button>
          <button className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`} onClick={() => setActiveTab('invoices')}>Invoices ({invoices.length})</button>
        </div>
      </div>
      <div className="card">
        {activeTab === 'details' && (
          <div>
            <div className="form-row"><div className="form-group"><label className="form-label">Contact Person</label><div>{sub.contact_person || '-'}</div></div><div className="form-group"><label className="form-label">Phone</label><div>{sub.phone || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Email</label><div>{sub.email || '-'}</div></div><div className="form-group"><label className="form-label">GSTIN</label><div>{sub.gstin || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Nature of Work</label><div>{sub.nature_of_work || '-'}</div></div><div className="form-group"><label className="form-label">State</label><div>{sub.state || '-'}</div></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">Address</label><div>{sub.address || '-'}</div></div><div className="form-group"><label className="form-label">Status</label><span style={{ padding: '4px 8px', borderRadius: '4px', background: sub.status === 'Active' ? '#d4edda' : '#f8d7da' }}>{sub.status}</span></div></div>
            <div className="form-row"><div className="form-group"><label className="form-label">NDA Signed</label><div>{sub.nda_signed ? 'Yes' : 'No'} {sub.nda_date && `(${sub.nda_date})`}</div></div><div className="form-group"><label className="form-label">Contract Signed</label><div>{sub.contract_signed ? 'Yes' : 'No'} {sub.contract_date && `(${sub.contract_date})`}</div></div></div>
            <div className="form-group"><label className="form-label">Internal Remarks</label><div>{sub.internal_remarks || '-'}</div></div>
            <button className="btn btn-primary" style={{ marginTop: '12px' }} onClick={() => { window.subToEdit = sub; onNavigate('/subcontractors/edit?id=' + sub.id) }}>Edit</button>
          </div>
        )}
        {activeTab === 'workorders' && (
          <div>{workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'attendance' && (
          <div>{attendance.length === 0 ? <p>No Attendance Records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{attendance.map(a => <tr key={a.id}><td>{a.attendance_date}</td><td>{a.workers_count}</td><td>{a.supervisor_name}</td><td>{a.remarks}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'dailylogs' && (
          <div>{dailyLogs.length === 0 ? <p>No Daily Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th></tr></thead><tbody>{dailyLogs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'payments' && (
          <div>{payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td></tr>)}</tbody></table>}</div>
        )}
        {activeTab === 'invoices' && (
          <div>{invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}</div>
        )}
      </div>
    </div>
  )
}

function SubcontractorEdit({ onNavigate }) {
  const [sub, setSub] = useState(null)
  useEffect(() => {
    const id = new URLSearchParams(window.location.hash.split('?')[1] || '').get('id')
    if (id) supabase.from('subcontractors').select('*').eq('id', id).single().then(({ data }) => setSub(data))
  }, [])
  if (!sub) return <div>Loading...</div>
  return <CreateSubcontractor onSuccess={() => onNavigate('/subcontractors')} onCancel={() => onNavigate('/subcontractors')} editMode={true} subData={sub} />
}

function SubcontractorAttendance({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workers, setWorkers] = useState(1)
  const [supervisor, setSupervisor] = useState('')
  const [remarks, setRemarks] = useState('')
  const [records, setRecords] = useState([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const saveAttendance = async () => {
    if (!subId) return alert('Select Sub-Contractor')
    await supabase.from('subcontractor_attendance').insert({ subcontractor_id: subId, attendance_date: date, workers_count: workers, supervisor_name: supervisor, remarks })
    alert('Saved!')
    loadRecords()
  }

  const loadRecords = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_attendance').select('*').eq('subcontractor_id', subId).order('attendance_date', { ascending: false })
      setRecords(data || [])
    }
  }

  useEffect(() => { if (subId) loadRecords() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Attendance</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">No. of Workers</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Supervisor</label><input type="text" className="form-input" value={supervisor} onChange={e => setSupervisor(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveAttendance}>Save Attendance</button>
      </div>
      <div className="card">
        <h3>Attendance Records</h3>
        {records.length === 0 ? <p>No records</p> : <table className="table"><thead><tr><th>Date</th><th>Workers</th><th>Supervisor</th><th>Remarks</th></tr></thead><tbody>{records.map(r => <tr key={r.id}><td>{r.attendance_date}</td><td>{r.workers_count}</td><td>{r.supervisor_name}</td><td>{r.remarks}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

function SubcontractorWorkOrders({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [woNo, setWoNo] = useState('')
  const [desc, setDesc] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [value, setValue] = useState('')
  const [workOrders, setWorkOrders] = useState([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const saveWO = async () => {
    if (!subId || !woNo) return alert('Required fields missing')
    await supabase.from('subcontractor_work_orders').insert({ subcontractor_id: subId, work_order_no: woNo, work_description: desc, start_date: startDate, end_date: endDate, contract_value: value, status: 'Pending' })
    alert('Saved!')
    loadWOs()
  }

  const loadWOs = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).order('created_at', { ascending: false })
      setWorkOrders(data || [])
    }
  }

  useEffect(() => { if (subId) loadWOs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Work Orders</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">WO Number *</label><input type="text" className="form-input" value={woNo} onChange={e => setWoNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Work Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Start Date</label><input type="date" className="form-input" value={startDate} onChange={e => setStartDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">End Date</label><input type="date" className="form-input" value={endDate} onChange={e => setEndDate(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Contract Value</label><input type="number" className="form-input" value={value} onChange={e => setValue(e.target.value)} /></div>
        </div>
        <button className="btn btn-primary" onClick={saveWO}>Save Work Order</button>
      </div>
      <div className="card">
        {workOrders.length === 0 ? <p>No Work Orders</p> : <table className="table"><thead><tr><th>WO No</th><th>Description</th><th>Start</th><th>End</th><th>Value</th><th>Status</th></tr></thead><tbody>{workOrders.map(wo => <tr key={wo.id}><td>{wo.work_order_no}</td><td>{wo.work_description}</td><td>{wo.start_date}</td><td>{wo.end_date}</td><td>₹{wo.contract_value}</td><td>{wo.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

function SubcontractorDailyLogs({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState([])
  const [woId, setWoId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [workDone, setWorkDone] = useState('')
  const [delays, setDelays] = useState('')
  const [safety, setSafety] = useState('')
  const [workers, setWorkers] = useState(1)
  const [remarks, setRemarks] = useState('')
  const [logs, setLogs] = useState([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  useEffect(() => { if (subId) supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).then(({ data }) => setWorkOrders(data || [])) }, [subId])

  const saveLog = async () => {
    if (!subId || !date) return alert('Required')
    await supabase.from('subcontractor_daily_logs').insert({ subcontractor_id: subId, work_order_id: woId || null, log_date: date, work_done: workDone, delays: delays, safety_incidents: safety, workers_count: workers, remarks })
    alert('Saved!')
    loadLogs()
  }

  const loadLogs = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_daily_logs').select('*').eq('subcontractor_id', subId).order('log_date', { ascending: false })
      setLogs(data || [])
    }
  }

  useEffect(() => { if (subId) loadLogs() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Daily Logs</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Workers Count</label><input type="number" className="form-input" value={workers} onChange={e => setWorkers(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Work Done</label><input type="text" className="form-input" value={workDone} onChange={e => setWorkDone(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Delays/Issues</label><input type="text" className="form-input" value={delays} onChange={e => setDelays(e.target.value)} placeholder="Any delays or issues" /></div>
          <div className="form-group"><label className="form-label">Safety Incidents</label><input type="text" className="form-input" value={safety} onChange={e => setSafety(e.target.value)} placeholder="Any safety incidents" /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveLog}>Save Log</button>
      </div>
      <div className="card">
        {logs.length === 0 ? <p>No Logs</p> : <table className="table"><thead><tr><th>Date</th><th>Work Done</th><th>Delays</th><th>Safety</th><th>Workers</th></tr></thead><tbody>{logs.map(l => <tr key={l.id}><td>{l.log_date}</td><td>{l.work_done}</td><td>{l.delays}</td><td>{l.safety_incidents}</td><td>{l.workers_count}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

function SubcontractorPayments({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [mode, setMode] = useState('Cash')
  const [refNo, setRefNo] = useState('')
  const [desc, setDesc] = useState('')
  const [payments, setPayments] = useState([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const savePayment = async () => {
    if (!subId || !amount) return alert('Required')
    await supabase.from('subcontractor_payments').insert({ subcontractor_id: subId, amount, payment_date: date, payment_mode: mode, reference_no: refNo, description: desc })
    alert('Saved!')
    loadPayments()
  }

  const loadPayments = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_payments').select('*').eq('subcontractor_id', subId).order('payment_date', { ascending: false })
      setPayments(data || [])
    }
  }

  useEffect(() => { if (subId) loadPayments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Payments</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={date} onChange={e => setDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Payment Mode</label><select className="form-select" value={mode} onChange={e => setMode(e.target.value)}><option>Cash</option><option>Bank Transfer</option><option>Cheque</option><option>UPI</option></select></div>
          <div className="form-group"><label className="form-label">Ref No</label><input type="text" className="form-input" value={refNo} onChange={e => setRefNo(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Description</label><textarea className="form-textarea" value={desc} onChange={e => setDesc(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={savePayment}>Save Payment</button>
      </div>
      <div className="card">
        {payments.length === 0 ? <p>No Payments</p> : <table className="table"><thead><tr><th>Date</th><th>Amount</th><th>Mode</th><th>Ref No</th><th>Description</th></tr></thead><tbody>{payments.map(p => <tr key={p.id}><td>{p.payment_date}</td><td>₹{p.amount}</td><td>{p.payment_mode}</td><td>{p.reference_no}</td><td>{p.description}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

function SubcontractorInvoices({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [workOrders, setWorkOrders] = useState([])
  const [woId, setWoId] = useState('')
  const [invNo, setInvNo] = useState('')
  const [invDate, setInvDate] = useState(new Date().toISOString().split('T')[0])
  const [amount, setAmount] = useState('')
  const [remarks, setRemarks] = useState('')
  const [invoices, setInvoices] = useState([])

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  useEffect(() => { if (subId) supabase.from('subcontractor_work_orders').select('*').eq('subcontractor_id', subId).then(({ data }) => setWorkOrders(data || [])) }, [subId])

  const saveInvoice = async () => {
    if (!subId || !invNo || !amount) return alert('Required')
    await supabase.from('subcontractor_invoices').insert({ subcontractor_id: subId, work_order_id: woId || null, invoice_no: invNo, invoice_date: invDate, amount, status: 'Pending', remarks })
    alert('Saved!')
    loadInvoices()
  }

  const loadInvoices = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_invoices').select('*').eq('subcontractor_id', subId).order('invoice_date', { ascending: false })
      setInvoices(data || [])
    }
  }

  useEffect(() => { if (subId) loadInvoices() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Invoices</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Sub-Contractor</label><select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}><option value="">Select</option>{subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Invoice No *</label><input type="text" className="form-input" value={invNo} onChange={e => setInvNo(e.target.value)} /></div>
          <div className="form-group"><label className="form-label">Date</label><input type="date" className="form-input" value={invDate} onChange={e => setInvDate(e.target.value)} /></div>
        </div>
        <div className="form-row">
          <div className="form-group"><label className="form-label">Work Order</label><select className="form-select" value={woId} onChange={e => setWoId(e.target.value)}><option value="">Select</option>{workOrders.map(wo => <option key={wo.id} value={wo.id}>{wo.work_order_no}</option>)}</select></div>
          <div className="form-group"><label className="form-label">Amount</label><input type="number" className="form-input" value={amount} onChange={e => setAmount(e.target.value)} /></div>
        </div>
        <div className="form-group"><label className="form-label">Remarks</label><textarea className="form-textarea" value={remarks} onChange={e => setRemarks(e.target.value)} rows={2} /></div>
        <button className="btn btn-primary" onClick={saveInvoice}>Save Invoice</button>
      </div>
      <div className="card">
        {invoices.length === 0 ? <p>No Invoices</p> : <table className="table"><thead><tr><th>Invoice No</th><th>Date</th><th>Amount</th><th>Status</th></tr></thead><tbody>{invoices.map(i => <tr key={i.id}><td>{i.invoice_no}</td><td>{i.invoice_date}</td><td>₹{i.amount}</td><td>{i.status}</td></tr>)}</tbody></table>}
      </div>
    </div>
  )
}

function SubcontractorDocuments({ onNavigate }) {
  const [subcontractors, setSubcontractors] = useState([])
  const [subId, setSubId] = useState('')
  const [documents, setDocuments] = useState([])
  const [uploading, setUploading] = useState(false)

  useEffect(() => { supabase.from('subcontractors').select('*').order('company_name').then(({ data }) => setSubcontractors(data || [])) }, [])

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files)
    if (!subId) return alert('Select Sub-Contractor first')
    setUploading(true)
    
    for (const file of files) {
      try {
        const arrayBuffer = await file.arrayBuffer()
        const uint8Array = new Uint8Array(arrayBuffer)
        const fileName = `sub_${Date.now()}_${file.name.replace(/\s+/g, '_')}`
        
        const { data, error } = await supabase.storage
          .from('subcontractor-documents')
          .upload(fileName, uint8Array, { contentType: file.type })
        
        if (!error && data) {
          const { data: urlData } = supabase.storage.from('subcontractor-documents').getPublicUrl(fileName)
          await supabase.from('subcontractor_documents').insert({
            subcontractor_id: subId,
            document_name: file.name,
            document_url: urlData.publicUrl,
            document_type: file.type
          })
        }
      } catch (err) {
        console.log('Upload error:', err.message)
      }
    }
    setUploading(false)
    loadDocuments()
  }

  const loadDocuments = async () => {
    if (subId) {
      const { data } = await supabase.from('subcontractor_documents').select('*').eq('subcontractor_id', subId).order('created_at', { ascending: false })
      setDocuments(data || [])
    }
  }

  useEffect(() => { if (subId) loadDocuments() }, [subId])

  return (
    <div>
      <div className="page-header"><h1 className="page-title">Documents</h1><button className="btn btn-secondary" onClick={() => onNavigate('/subcontractors')}>Back</button></div>
      <div className="card" style={{ marginBottom: '16px' }}>
        <div className="form-group">
          <label className="form-label">Select Sub-Contractor</label>
          <select className="form-select" value={subId} onChange={e => setSubId(e.target.value)}>
            <option value="">Select</option>
            {subcontractors.map(s => <option key={s.id} value={s.id}>{s.company_name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Upload Documents</label>
          <input type="file" className="form-input" multiple onChange={handleUpload} disabled={uploading} />
        </div>
        {uploading && <p>Uploading...</p>}
      </div>
      <div className="card">
        {documents.length === 0 ? <p>No Documents</p> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '12px' }}>
            {documents.map(doc => (
              <div key={doc.id} style={{ padding: '12px', border: '1px solid #ddd', borderRadius: '8px', background: '#f9f9f9' }}>
                <div style={{ fontWeight: '500', marginBottom: '8px', wordBreak: 'break-word' }}>{doc.document_name}</div>
                <a href={doc.document_url} target="_blank" rel="noopener noreferrer" style={{ color: '#007bff', fontSize: '13px' }}>View Document</a>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
