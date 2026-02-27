import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const QUOTATION_STATUSES = ['Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

export default function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    clientId: '',
    status: '',
    projectId: ''
  });
  const [clients, setClients] = useState([]);
  const [projects, setProjects] = useState([]);

  useEffect(() => {
    loadData();
    loadClients();
    loadProjects();
  }, []);

  useEffect(() => {
    loadQuotations();
  }, [filters]);

  const loadData = async () => {
    await loadQuotations();
  };

  const loadClients = async () => {
    const { data } = await supabase.from('clients').select('id, client_name').order('client_name');
    setClients(data || []);
  };

  const loadProjects = async () => {
    const { data } = await supabase.from('projects').select('id, project_name, project_code').order('project_name');
    setProjects(data || []);
  };

  const loadQuotations = async () => {
    setLoading(true);
    try {
      const queryFilters = {};
      if (filters.clientId) queryFilters.clientId = filters.clientId;
      if (filters.projectId) queryFilters.projectId = filters.projectId;
      if (filters.status) queryFilters.status = filters.status;
      if (filters.startDate) queryFilters.startDate = filters.startDate;
      if (filters.endDate) queryFilters.endDate = filters.endDate;

      const data = await fetchQuotations(queryFilters);
      
      const today = new Date().toISOString().split('T')[0];
      const updatedData = data.map(q => {
        if (q.status === 'Draft' && q.valid_till && q.valid_till < today) {
          return { ...q, status: 'Expired' };
        }
        return q;
      });
      
      setQuotations(updatedData);
    } catch (err) {
      console.error('Error loading quotations:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, status) => {
    if (status !== 'Draft') {
      alert('Only Draft quotations can be deleted. You can cancel it instead.');
      return;
    }
    if (!confirm('Are you sure you want to delete this quotation?')) return;
    
    try {
      await deleteQuotation(id);
      loadQuotations();
    } catch (err) {
      alert('Error deleting quotation: ' + err.message);
    }
  };

  const handleCancel = async (id) => {
    if (!confirm('Are you sure you want to cancel this quotation?')) return;
    
    try {
      await updateQuotation(id, { status: 'Cancelled' });
      loadQuotations();
    } catch (err) {
      alert('Error cancelling quotation: ' + err.message);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      'Draft': { bg: '#f3f4f6', color: '#6b7280' },
      'Sent': { bg: '#dbeafe', color: '#1d4ed8' },
      'Under Negotiation': { bg: '#fef3c7', color: '#b45309' },
      'Approved': { bg: '#d1fae5', color: '#047857' },
      'Rejected': { bg: '#fee2e2', color: '#dc2626' },
      'Converted': { bg: '#dbeafe', color: '#1e40af' },
      'Cancelled': { bg: '#fee2e2', color: '#991b1b' },
      'Expired': { bg: '#f3f4f6', color: '#9ca3af' }
    };
    const style = colors[status] || colors['Draft'];
    return (
      <span style={{ 
        background: style.bg, 
        color: style.color, 
        padding: '4px 10px', 
        borderRadius: '12px',
        fontSize: '12px',
        fontWeight: 600
      }}>
        {status}
      </span>
    );
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount || 0);
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN');
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quotation List</h1>
        <button className="btn btn-primary" onClick={() => navigate('/quotation/create')}>
          + Create Quotation
        </button>
      </div>

      <div className="card" style={{ marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>From Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>To Date</label>
            <input
              type="date"
              className="form-input"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Client</label>
            <select
              className="form-select"
              value={filters.clientId}
              onChange={(e) => setFilters({ ...filters, clientId: e.target.value })}
            >
              <option value="">All Clients</option>
              {clients.map(c => (
                <option key={c.id} value={c.id}>{c.client_name}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '180px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Project</label>
            <select
              className="form-select"
              value={filters.projectId}
              onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
            >
              <option value="">All Projects</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.project_name || p.project_code}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Status</label>
            <select
              className="form-select"
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">All Status</option>
              {QUOTATION_STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <button 
            className="btn btn-secondary"
            onClick={() => setFilters({ startDate: '', endDate: '', clientId: '', status: '', projectId: '' })}
          >
            Clear
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : quotations.length === 0 ? (
          <div className="empty-state">
            <h3>No Quotations Found</h3>
            <p>Create your first quotation to get started</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Quotation No</th>
                  <th>Date</th>
                  <th>Client</th>
                  <th>Project</th>
                  <th>Grand Total</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map(q => (
                  <tr key={q.id}>
                    <td>
                      <a 
                        href={`#${q.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/quotation/view?id=${q.id}`); }}
                        style={{ color: '#2563eb', fontWeight: 500 }}
                      >
                        {q.quotation_no}
                      </a>
                    </td>
                    <td>{formatDate(q.date)}</td>
                    <td>{q.client?.client_name || '-'}</td>
                    <td>{q.project?.project_name || '-'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(q.grand_total)}</td>
                    <td>{getStatusBadge(q.status)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        <button 
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/quotation/view?id=${q.id}`)}
                          title="View"
                        >
                          View
                        </button>
                        {q.status !== 'Converted' && q.status !== 'Cancelled' && (
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => navigate(`/quotation/edit?id=${q.id}`)}
                            title="Edit"
                          >
                            Edit
                          </button>
                        )}
                        {q.status === 'Draft' && (
                          <>
                            <button 
                              className="btn btn-sm btn-secondary"
                              onClick={() => handleDelete(q.id, q.status)}
                              title="Delete"
                              style={{ color: '#dc2626' }}
                            >
                              Delete
                            </button>
                          </>
                        )}
                        {q.status !== 'Cancelled' && q.status !== 'Converted' && q.status !== 'Draft' && (
                          <button 
                            className="btn btn-sm btn-secondary"
                            onClick={() => handleCancel(q.id)}
                            title="Cancel"
                            style={{ color: '#dc2626' }}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

async function fetchQuotations(filters = {}) {
  const { supabase } = await import('../supabase');
  let query = supabase
    .from('quotation_header')
    .select(`
      *,
      client:clients(id, client_name, gstin, state),
      project:projects(id, project_name),
      items:quotation_items(*)
    `)
    .order('created_at', { ascending: false });

  if (filters.clientId) query = query.eq('client_id', filters.clientId);
  if (filters.projectId) query = query.eq('project_id', filters.projectId);
  if (filters.status) query = query.eq('status', filters.status);
  if (filters.startDate) query = query.gte('date', filters.startDate);
  if (filters.endDate) query = query.lte('date', filters.endDate);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function updateQuotation(id, updates) {
  const { supabase } = await import('../supabase');
  const { data, error } = await supabase
    .from('quotation_header')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function deleteQuotation(id) {
  const { supabase } = await import('../supabase');
  const { error } = await supabase
    .from('quotation_header')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return { success: true };
}
