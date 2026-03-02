import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';

export default function POList() {
  const navigate = useNavigate();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  useEffect(() => {
    loadPOs();
  }, [statusFilter, dateFrom, dateTo]);

  const loadPOs = async () => {
    setLoading(true);
    let query = supabase
      .from('client_purchase_orders')
      .select(`
        *,
        client:clients(client_name)
      `)
      .order('created_at', { ascending: false });

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }
    if (dateFrom) {
      query = query.gte('po_date', dateFrom);
    }
    if (dateTo) {
      query = query.lte('po_date', dateTo);
    }

    const { data } = await query;
    setPos(data || []);
    setLoading(false);
  };

  const filteredPOs = pos.filter(po => {
    const searchLower = searchTerm.toLowerCase();
    return (
      po.po_number?.toLowerCase().includes(searchLower) ||
      po.client?.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status) => {
    const colors = {
      'Open': { bg: '#dbeafe', color: '#1d4ed8' },
      'Partially Billed': { bg: '#fef3c7', color: '#b45309' },
      'Closed': { bg: '#d1fae5', color: '#047857' }
    };
    const style = colors[status] || colors['Open'];
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

  const deletePO = async (id) => {
    if (!confirm('Are you sure you want to delete this PO?')) return;
    
    const { error } = await supabase
      .from('client_purchase_orders')
      .delete()
      .eq('id', id);
    
    if (error) {
      alert('Error deleting PO: ' + error.message);
    } else {
      loadPOs();
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Client Purchase Orders</h1>
        <button className="btn btn-primary" onClick={() => navigate('/client-po/create')}>
          + Create PO
        </button>
      </div>

      {/* Filters */}
      <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Search</label>
            <input
              type="text"
              className="form-input"
              placeholder="PO No / Client name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '150px' }}>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>Status</label>
            <select
              className="form-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={{ padding: '8px 12px' }}
            >
              <option value="">All Status</option>
              <option value="Open">Open</option>
              <option value="Partially Billed">Partially Billed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>From Date</label>
            <input
              type="date"
              className="form-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0, minWidth: '140px' }}>
            <label className="form-label" style={{ fontSize: '11px', marginBottom: '4px' }}>To Date</label>
            <input
              type="date"
              className="form-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              style={{ padding: '8px 12px' }}
            />
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '16px' }}>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total POs</div>
          <div style={{ fontSize: '24px', fontWeight: 700 }}>{filteredPOs.length}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Open</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8' }}>{filteredPOs.filter(p => p.status === 'Open').length}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Partially Billed</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#b45309' }}>{filteredPOs.filter(p => p.status === 'Partially Billed').length}</div>
        </div>
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Value</div>
          <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857' }}>₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_total_value || 0), 0))}</div>
        </div>
      </div>

      {/* PO Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table className="table" style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ minWidth: '120px' }}>PO No</th>
                <th style={{ minWidth: '150px' }}>Client</th>
                <th style={{ minWidth: '100px' }}>PO Date</th>
                <th style={{ minWidth: '100px' }}>Expiry</th>
                <th style={{ minWidth: '120px', textAlign: 'right' }}>Total Value</th>
                <th style={{ minWidth: '100px', textAlign: 'right' }}>Utilized</th>
                <th style={{ minWidth: '100px', textAlign: 'right' }}>Balance</th>
                <th style={{ minWidth: '130px' }}>Status</th>
                <th style={{ minWidth: '120px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px' }}>Loading...</td>
                </tr>
              ) : filteredPOs.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                    No purchase orders found
                  </td>
                </tr>
              ) : (
                filteredPOs.map(po => (
                  <tr 
                    key={po.id} 
                    style={{ cursor: 'pointer' }}
                    onClick={() => navigate(`/client-po/details?id=${po.id}`)}
                  >
                    <td style={{ fontWeight: 600 }}>{po.po_number}</td>
                    <td>{po.client?.client_name || '-'}</td>
                    <td>{formatDate(po.po_date)}</td>
                    <td>{formatDate(po.po_expiry_date)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 500 }}>₹{formatCurrency(po.po_total_value)}</td>
                    <td style={{ textAlign: 'right', color: '#6b7280' }}>₹{formatCurrency(po.po_utilized_value)}</td>
                    <td style={{ textAlign: 'right', fontWeight: 600, color: po.po_available_value > 0 ? '#047857' : '#dc2626' }}>
                      ₹{formatCurrency(po.po_available_value)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      {getStatusBadge(po.status)}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/client-po/create?id=${po.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => deletePO(po.id)}
                          style={{ background: '#fee2e2', color: '#dc2626', border: 'none' }}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
