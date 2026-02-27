import { useState, useEffect } from 'react';
import { supabase } from '../supabase';

export default function ProjectList() {
  const [projects, setProjects] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState('list');
  const [selectedProject, setSelectedProject] = useState(null);
  const [financialSummary, setFinancialSummary] = useState(null);
  const [projectPOs, setProjectPOs] = useState([]);
  const [projectInvoices, setProjectInvoices] = useState([]);
  const [projectExpenses, setProjectExpenses] = useState([]);
  const [projectPayments, setProjectPayments] = useState([]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [projectsRes, clientsRes] = await Promise.all([
        supabase
          .from('projects')
          .select('*, client:clients(client_name)')
          .order('created_at', { ascending: false }),
        supabase
          .from('clients')
          .select('id, client_name')
          .order('client_name')
      ]);
      
      setProjects(projectsRes.data || []);
      setClients(clientsRes.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const loadProjectDetails = async (project) => {
    setSelectedProject(project);
    setViewMode('detail');
    setFinancialSummary(null);

    try {
      const [posResult, invoicesResult, expensesResult, paymentsResult] = await Promise.all([
        supabase.from('client_purchase_orders').select('*').eq('project_id', project.id),
        supabase.from('project_invoices').select('*').eq('project_id', project.id).order('invoice_date', { ascending: false }),
        supabase.from('project_expenses').select('*').eq('project_id', project.id).order('expense_date', { ascending: false }),
        supabase.from('project_payments').select('*').eq('project_id', project.id).order('payment_date', { ascending: false })
      ]);

      setProjectPOs(posResult.data || []);
      setProjectInvoices(invoicesResult.data || []);
      setProjectExpenses(expensesResult.data || []);
      setProjectPayments(paymentsResult.data || []);

      calculateFinancialSummary(
        posResult.data || [], 
        invoicesResult.data || [], 
        expensesResult.data || [], 
        paymentsResult.data || []
      );
    } catch (err) {
      console.error('Error loading project details:', err);
      alert('Error loading project details');
    }
  };

  const calculateFinancialSummary = (pos, invoices, expenses, payments) => {
    const totalPOValue = pos.reduce((sum, po) => sum + (parseFloat(po.po_total_value) || 0), 0);
    const totalInvoiceValue = invoices.reduce((sum, inv) => sum + (parseFloat(inv.total_amount) || 0), 0);
    const totalPaymentReceived = payments.reduce((sum, pay) => sum + (parseFloat(pay.payment_amount) || 0), 0);
    const totalExpense = expenses.reduce((sum, exp) => sum + (parseFloat(exp.amount) || 0), 0);
    const outstandingAmount = totalInvoiceValue - totalPaymentReceived;
    const profit = totalInvoiceValue - totalExpense;
    const poBalance = totalPOValue - totalInvoiceValue;

    setFinancialSummary({
      total_po_value: totalPOValue,
      total_invoice_value: totalInvoiceValue,
      total_payment_received: totalPaymentReceived,
      total_expense: totalExpense,
      outstanding_amount: outstandingAmount,
      profit: profit,
      po_balance: poBalance
    });
  };

  const deleteProject = async (id) => {
    try {
      const [posRes, invoicesRes, expensesRes, paymentsRes] = await Promise.all([
        supabase.from('client_purchase_orders').select('id').eq('project_id', id),
        supabase.from('project_invoices').select('id').eq('project_id', id),
        supabase.from('project_expenses').select('id').eq('project_id', id),
        supabase.from('project_payments').select('id').eq('project_id', id)
      ]);

      if ((posRes.data?.length > 0) || (invoicesRes.data?.length > 0) || (expensesRes.data?.length > 0) || (paymentsRes.data?.length > 0)) {
        alert('Cannot delete project: Related records exist');
        return;
      }

      if (confirm('Are you sure you want to delete this project?')) {
        const { error } = await supabase.from('projects').delete().eq('id', id);
        if (error) throw error;
        loadData();
      }
    } catch (err) {
      console.error('Error deleting project:', err);
      alert('Error deleting project: ' + err.message);
    }
  };

  const checkPORequiredWarning = (project) => {
    return project.po_required && project.po_status !== 'Received' && project.po_status !== 'Not Required';
  };

  const filteredProjects = projects.filter(p =>
    (p.project_name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.project_code || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.client?.client_name || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusColor = (status) => {
    const colors = {
      'Draft': { bg: '#f3f4f6', color: '#6b7280' },
      'Active': { bg: '#dbeafe', color: '#1d4ed8' },
      'Execution Completed': { bg: '#fef3c7', color: '#b45309' },
      'Financially Closed': { bg: '#d1fae5', color: '#047857' },
      'Closed': { bg: '#f3f4f6', color: '#374151' }
    };
    return colors[status] || colors['Draft'];
  };

  const getPOStatusColor = (status) => {
    const colors = {
      'Not Required': { bg: '#d1fae5', color: '#047857' },
      'Pending': { bg: '#fef3c7', color: '#b45309' },
      'Received': { bg: '#dbeafe', color: '#1d4ed8' }
    };
    return colors[status] || colors['Pending'];
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>;
  }

  if (viewMode === 'detail' && selectedProject) {
    return (
      <ProjectDetailView
        project={selectedProject}
        financialSummary={financialSummary}
        projectPOs={projectPOs}
        projectInvoices={projectInvoices}
        projectExpenses={projectExpenses}
        projectPayments={projectPayments}
        onBack={() => { setViewMode('list'); setSelectedProject(null); }}
        onEdit={() => window.location.hash = `/projects/edit?id=${selectedProject.id}`}
      />
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Projects</h1>
        <button className="btn btn-primary" onClick={() => window.location.hash = '/projects/new'}>
          + New Project
        </button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <input
            type="text"
            className="form-input"
            placeholder="Search projects..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ maxWidth: '300px' }}
          />
        </div>
      </div>

      <div className="card">
        {filteredProjects.length === 0 ? (
          <div className="empty-state">
            <h3>No Projects Found</h3>
            <p>Create your first project to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Project Code</th>
                  <th>Project Name</th>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Est. Value</th>
                  <th>PO Status</th>
                  <th>Status</th>
                  <th>Completion</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredProjects.map(p => {
                  const statusStyle = getStatusColor(p.status);
                  const poStatusStyle = getPOStatusColor(p.po_status);
                  const showWarning = checkPORequiredWarning(p);
                  return (
                    <tr key={p.id}>
                      <td>{p.project_code || '-'}</td>
<td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span
                              style={{ cursor: 'pointer', color: '#2563eb', fontWeight: 500 }}
                              onClick={() => loadProjectDetails(p)}
                            >
                              {p.project_name || 'Unnamed Project'}
                            </span>
                          {showWarning && (
                            <span style={{
                              background: '#fee2e2',
                              color: '#dc2626',
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: 600
                            }}>
                              PO Required
                            </span>
                          )}
                        </div>
                      </td>
                      <td>{p.client?.client_name || '-'}</td>
                      <td>{p.project_type || '-'}</td>
                      <td>{p.project_estimated_value ? formatCurrency(p.project_estimated_value) : '-'}</td>
                      <td>
                        <span style={{
                          background: poStatusStyle.bg,
                          color: poStatusStyle.color,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {p.po_status || 'Pending'}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          background: statusStyle.bg,
                          color: statusStyle.color,
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}>
                          {p.status || 'Draft'}
                        </span>
                      </td>
                      <td>{p.completion_percentage || 0}%</td>
                      <td>
                        <button className="btn btn-sm btn-secondary" onClick={() => loadProjectDetails(p)}>View</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px' }} onClick={() => window.location.hash = `/projects/edit?id=${p.id}`}>Edit</button>
                        <button className="btn btn-sm btn-secondary" style={{ marginLeft: '4px', color: '#dc2626' }} onClick={() => deleteProject(p.id)}>Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function ProjectDetailView({ project, financialSummary, projectPOs, projectInvoices, projectExpenses, projectPayments, onBack, onEdit }) {
  const [activeTab, setActiveTab] = useState('summary');

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? '-' : d.toLocaleDateString();
  };

  const getStatusColor = (status) => {
    const colors = {
      'Draft': { bg: '#f3f4f6', color: '#6b7280' },
      'Active': { bg: '#dbeafe', color: '#1d4ed8' },
      'Execution Completed': { bg: '#fef3c7', color: '#b45309' },
      'Financially Closed': { bg: '#d1fae5', color: '#047857' },
      'Closed': { bg: '#f3f4f6', color: '#374151' }
    };
    return colors[status] || colors['Draft'];
  };

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button className="btn btn-secondary" onClick={onBack}>← Back</button>
          <div>
            <h1 className="page-title" style={{ margin: 0 }}>{project.project_name}</h1>
            <span style={{ color: '#6b7280', fontSize: '14px' }}>{project.project_code}</span>
          </div>
        </div>
        <button className="btn btn-primary" onClick={onEdit}>Edit Project</button>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        <button
          className={`btn ${activeTab === 'summary' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('summary')}
        >
          Summary
        </button>
        <button
          className={`btn ${activeTab === 'pos' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('pos')}
        >
          POs ({projectPOs.length})
        </button>
        <button
          className={`btn ${activeTab === 'invoices' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('invoices')}
        >
          Invoices ({projectInvoices.length})
        </button>
        <button
          className={`btn ${activeTab === 'payments' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('payments')}
        >
          Payments ({projectPayments.length})
        </button>
        <button
          className={`btn ${activeTab === 'expenses' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setActiveTab('expenses')}
        >
          Expenses ({projectExpenses.length})
        </button>
      </div>

      {activeTab === 'summary' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Commercial Summary</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Project Code</span>
                  <span style={{ fontWeight: 500 }}>{project.project_code || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Project Name</span>
                  <span style={{ fontWeight: 500 }}>{project.project_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Client</span>
                  <span style={{ fontWeight: 500 }}>{project.client?.client_name || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Project Type</span>
                  <span style={{ fontWeight: 500 }}>{project.project_type || '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Estimated Value</span>
                  <span style={{ fontWeight: 500 }}>{project.project_estimated_value ? formatCurrency(project.project_estimated_value) : '-'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>PO Required</span>
                  <span style={{ fontWeight: 500 }}>{project.po_required ? 'Yes' : 'No'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#6b7280' }}>PO Status</span>
                  <span style={{ fontWeight: 500 }}>{project.po_status || 'Pending'}</span>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Execution Summary</h3>
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Status</span>
                  <span style={{
                    background: getStatusColor(project.status).bg,
                    color: getStatusColor(project.status).color,
                    padding: '4px 12px',
                    borderRadius: '12px',
                    fontSize: '12px',
                    fontWeight: 600
                  }}>
                    {project.status || 'Draft'}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Start Date</span>
                  <span style={{ fontWeight: 500 }}>{formatDate(project.start_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Expected End Date</span>
                  <span style={{ fontWeight: 500 }}>{formatDate(project.expected_end_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Actual End Date</span>
                  <span style={{ fontWeight: 500 }}>{formatDate(project.actual_end_date)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #e5e7eb' }}>
                  <span style={{ color: '#6b7280' }}>Completion</span>
                  <span style={{ fontWeight: 500 }}>{project.completion_percentage || 0}%</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#6b7280' }}>Remarks</span>
                  <span style={{ fontWeight: 500, maxWidth: '200px', textAlign: 'right' }}>{project.remarks || '-'}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginTop: 0, marginBottom: '16px', fontSize: '16px', color: '#374151' }}>Financial Summary</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
              <div style={{ background: '#eff6ff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total PO Value</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8' }}>
                  {formatCurrency(financialSummary?.total_po_value)}
                </div>
              </div>
              <div style={{ background: '#fef3c7', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Invoice Value</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309' }}>
                  {formatCurrency(financialSummary?.total_invoice_value)}
                </div>
              </div>
              <div style={{ background: '#dcfce7', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Payment Received</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857' }}>
                  {formatCurrency(financialSummary?.total_payment_received)}
                </div>
              </div>
              <div style={{ background: '#fee2e2', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Expense</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626' }}>
                  {formatCurrency(financialSummary?.total_expense)}
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginTop: '16px' }}>
              <div style={{ background: '#f3f4f6', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Outstanding Amount</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary?.outstanding_amount > 0 ? '#dc2626' : '#047857' }}>
                  {formatCurrency(financialSummary?.outstanding_amount)}
                </div>
              </div>
              <div style={{ background: '#f0fdf4', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Profit</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary?.profit >= 0 ? '#047857' : '#dc2626' }}>
                  {formatCurrency(financialSummary?.profit)}
                </div>
              </div>
              <div style={{ background: '#f5f3ff', padding: '16px', borderRadius: '8px', textAlign: 'center' }}>
                <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>PO Balance</div>
                <div style={{ fontSize: '24px', fontWeight: 700, color: financialSummary?.po_balance >= 0 ? '#7c3aed' : '#dc2626' }}>
                  {formatCurrency(financialSummary?.po_balance)}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {activeTab === 'pos' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Purchase Orders</h3>
            <button className="btn btn-primary" onClick={() => window.location.hash = `/client-po/create?project_id=${project.id}`}>
              + Create PO
            </button>
          </div>
          {projectPOs.length === 0 ? (
            <div className="empty-state"><p>No POs found</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>PO Number</th>
                  <th>PO Date</th>
                  <th>Total Value</th>
                  <th>Utilized</th>
                  <th>Available</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectPOs.map(po => (
                  <tr key={po.id}>
                    <td>{po.po_number}</td>
                    <td>{formatDate(po.po_date)}</td>
                    <td>{formatCurrency(po.po_total_value)}</td>
                    <td>{formatCurrency(po.po_utilized_value)}</td>
                    <td>{formatCurrency(po.po_available_value)}</td>
                    <td>{po.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'invoices' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Invoices</h3>
            <button className="btn btn-primary" onClick={() => window.location.hash = `/projects/invoice/new?project_id=${project.id}`}>
              + Create Invoice
            </button>
          </div>
          {projectInvoices.length === 0 ? (
            <div className="empty-state"><p>No invoices found</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Invoice Number</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Tax</th>
                  <th>Total</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {projectInvoices.map(inv => (
                  <tr key={inv.id}>
                    <td>{inv.invoice_number}</td>
                    <td>{formatDate(inv.invoice_date)}</td>
                    <td>{formatCurrency(inv.invoice_amount)}</td>
                    <td>{formatCurrency(inv.tax_amount)}</td>
                    <td>{formatCurrency(inv.total_amount)}</td>
                    <td>{inv.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'payments' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Payments</h3>
            <button className="btn btn-primary" onClick={() => window.location.hash = `/projects/payment/new?project_id=${project.id}`}>
              + Record Payment
            </button>
          </div>
          {projectPayments.length === 0 ? (
            <div className="empty-state"><p>No payments found</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Payment Number</th>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Mode</th>
                  <th>Reference</th>
                </tr>
              </thead>
              <tbody>
                {projectPayments.map(pay => (
                  <tr key={pay.id}>
                    <td>{pay.payment_number}</td>
                    <td>{formatDate(pay.payment_date)}</td>
                    <td>{formatCurrency(pay.payment_amount)}</td>
                    <td>{pay.payment_mode}</td>
                    <td>{pay.reference_number || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'expenses' && (
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0 }}>Expenses</h3>
            <button className="btn btn-primary" onClick={() => window.location.hash = `/projects/expense/new?project_id=${project.id}`}>
              + Add Expense
            </button>
          </div>
          {projectExpenses.length === 0 ? (
            <div className="empty-state"><p>No expenses found</p></div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {projectExpenses.map(exp => (
                  <tr key={exp.id}>
                    <td>{formatDate(exp.expense_date)}</td>
                    <td>{exp.expense_type}</td>
                    <td>{exp.description || '-'}</td>
                    <td>{exp.vendor_name || '-'}</td>
                    <td>{formatCurrency(exp.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
