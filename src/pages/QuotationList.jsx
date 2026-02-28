import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

const QUOTATION_STATUSES = ['Draft', 'Sent', 'Under Negotiation', 'Approved', 'Rejected', 'Converted', 'Cancelled', 'Expired'];

export default function QuotationList() {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingKey, setProcessingKey] = useState('');
  const [openMenuId, setOpenMenuId] = useState(null);
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

  useEffect(() => {
    const onDocClick = (e) => {
      if (!e.target.closest('.quotation-row-menu')) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

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
      const updatedData = data.map((q) => {
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

    setProcessingKey(`delete-${id}`);
    try {
      await deleteQuotation(id);
      await loadQuotations();
    } catch (err) {
      alert('Error deleting quotation: ' + err.message);
    } finally {
      setProcessingKey('');
      setOpenMenuId(null);
    }
  };

  const handleConvertFromList = async (quotation, convertType) => {
    if (quotation.status === 'Converted') {
      alert('Quotation is already converted.');
      return;
    }
    if (quotation.status === 'Cancelled') {
      alert('Cancelled quotation cannot be converted.');
      return;
    }

    const typeLabel = convertType === 'invoice' ? 'Invoice' : 'Proforma Invoice';
    if (!confirm(`Convert this quotation to ${typeLabel}?`)) return;

    setProcessingKey(`convert-${convertType}-${quotation.id}`);
    try {
      await updateQuotation(quotation.id, { status: 'Converted' });
      alert(`Quotation marked as Converted to ${typeLabel}.`);
      await loadQuotations();
    } catch (err) {
      alert(`Error converting to ${typeLabel}: ${err.message}`);
    } finally {
      setProcessingKey('');
      setOpenMenuId(null);
    }
  };

  const handleQuickCheckStock = async (quotationId) => {
    setProcessingKey(`quick-${quotationId}`);
    try {
      const { data: quotation, error: quotationError } = await supabase
        .from('quotation_header')
        .select(`
          id,
          date,
          client:clients(client_name),
          items:quotation_items(item_id, variant_id, qty)
        `)
        .eq('id', quotationId)
        .single();

      if (quotationError) throw quotationError;

      const quoteItems = (quotation?.items || []).filter((i) => i.item_id);
      if (quoteItems.length === 0) {
        alert('No items found in this quotation for stock check.');
        return;
      }

      const { data: warehouses, error: warehouseError } = await supabase
        .from('warehouses')
        .select('id')
        .eq('is_active', true);
      if (warehouseError) throw warehouseError;

      const itemIds = [...new Set(quoteItems.map((i) => i.item_id))];
      const { data: stockRows, error: stockError } = await supabase
        .from('item_stock')
        .select('item_id, company_variant_id, warehouse_id, current_stock')
        .in('item_id', itemIds);
      if (stockError) throw stockError;

      const { data: existingChecks } = await supabase
        .from('quick_checks')
        .select('check_no')
        .order('created_at', { ascending: false })
        .limit(1);

      let checkNo = 'QC-0001';
      if (existingChecks && existingChecks.length > 0) {
        const lastNum = parseInt(existingChecks[0].check_no.replace(/[^0-9]/g, ''), 10);
        checkNo = `QC-${String((lastNum || 0) + 1).padStart(4, '0')}`;
      }

      const { data: quickCheck, error: quickCheckError } = await supabase
        .from('quick_checks')
        .insert({
          check_no: checkNo,
          client_name: quotation.client?.client_name || '',
          check_date: quotation.date || new Date().toISOString().split('T')[0],
          variant_filter: 'All'
        })
        .select('id')
        .single();
      if (quickCheckError) throw quickCheckError;

      const snapshotWarehouseIds = (warehouses || []).map((w) => w.id);
      const quickCheckItems = quoteItems.map((qItem) => {
        const warehouseSnapshot = {};
        snapshotWarehouseIds.forEach((wid) => { warehouseSnapshot[wid] = 0; });

        const matchingStock = (stockRows || []).filter((s) => {
          if (s.item_id !== qItem.item_id) return false;
          if (qItem.variant_id) return s.company_variant_id === qItem.variant_id;
          return true;
        });

        let totalAvailable = 0;
        matchingStock.forEach((s) => {
          const qty = parseFloat(s.current_stock) || 0;
          warehouseSnapshot[s.warehouse_id] = (warehouseSnapshot[s.warehouse_id] || 0) + qty;
          totalAvailable += qty;
        });

        const qtyRequired = parseFloat(qItem.qty) || 0;
        return {
          quick_check_id: quickCheck.id,
          item_id: qItem.item_id,
          company_variant_id: qItem.variant_id || null,
          qty_required: qtyRequired,
          warehouse_snapshot: warehouseSnapshot,
          total_available: totalAvailable,
          pending_qty: Math.max(0, qtyRequired - totalAvailable)
        };
      });

      if (quickCheckItems.length > 0) {
        const { error: quickCheckItemsError } = await supabase
          .from('quick_check_items')
          .insert(quickCheckItems);
        if (quickCheckItemsError) throw quickCheckItemsError;
      }

      navigate(`/quick-stock-check/view?id=${quickCheck.id}`);
    } catch (err) {
      console.error('Error creating quick stock check:', err);
      alert('Error creating quick stock check: ' + err.message);
    } finally {
      setProcessingKey('');
      setOpenMenuId(null);
    }
  };

  const getStatusBadge = (status) => {
    const colors = {
      Draft: { bg: '#f3f4f6', color: '#6b7280' },
      Sent: { bg: '#dbeafe', color: '#1d4ed8' },
      'Under Negotiation': { bg: '#fef3c7', color: '#b45309' },
      Approved: { bg: '#d1fae5', color: '#047857' },
      Rejected: { bg: '#fee2e2', color: '#dc2626' },
      Converted: { bg: '#dbeafe', color: '#1e40af' },
      Cancelled: { bg: '#fee2e2', color: '#991b1b' },
      Expired: { bg: '#f3f4f6', color: '#9ca3af' }
    };
    const style = colors[status] || colors.Draft;
    return (
      <span
        style={{
          background: style.bg,
          color: style.color,
          padding: '4px 10px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 600
        }}
      >
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
              {clients.map((c) => (
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
              {projects.map((p) => (
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
              {QUOTATION_STATUSES.map((s) => (
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
                  <th>Quick Check Stock</th>
                  <th>Actions</th>
                  <th>Menu</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => (
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
                      <button
                        className="btn btn-sm btn-secondary"
                        disabled={processingKey === `quick-${q.id}`}
                        onClick={() => handleQuickCheckStock(q.id)}
                      >
                        {processingKey === `quick-${q.id}` ? 'Checking...' : 'Quick Check'}
                      </button>
                    </td>
                    <td>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => navigate(`/quotation/view?id=${q.id}`)}
                        title="View"
                      >
                        View
                      </button>
                    </td>
                    <td>
                      <div className="quotation-row-menu" style={{ position: 'relative' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(openMenuId === q.id ? null : q.id);
                          }}
                        >
                          ...
                        </button>
                        {openMenuId === q.id && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: '100%',
                              zIndex: 20,
                              background: '#fff',
                              border: '1px solid #e5e7eb',
                              borderRadius: '8px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                              minWidth: '220px',
                              padding: '6px'
                            }}
                          >
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }}
                              disabled={q.status === 'Converted' || q.status === 'Cancelled'}
                              onClick={() => navigate(`/quotation/edit?id=${q.id}`)}
                            >
                              Edit
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }}
                              disabled={processingKey === `convert-invoice-${q.id}` || q.status === 'Converted' || q.status === 'Cancelled'}
                              onClick={() => handleConvertFromList(q, 'invoice')}
                            >
                              Convert to Invoice
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ width: '100%', justifyContent: 'flex-start', marginBottom: '4px' }}
                              disabled={processingKey === `convert-proforma-${q.id}` || q.status === 'Converted' || q.status === 'Cancelled'}
                              onClick={() => handleConvertFromList(q, 'proforma')}
                            >
                              Convert to Proforma
                            </button>
                            <button
                              className="btn btn-sm btn-secondary"
                              style={{ width: '100%', justifyContent: 'flex-start', color: '#dc2626' }}
                              disabled={processingKey === `delete-${q.id}` || q.status !== 'Draft'}
                              onClick={() => handleDelete(q.id, q.status)}
                            >
                              Delete
                            </button>
                          </div>
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
