import { useState, useEffect } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';

export default function QuickStockCheckList() {
  const navigate = useNavigate();
  const [checks, setChecks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    clientName: ''
  });

  useEffect(() => {
    loadChecks();
  }, []);

  const loadChecks = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('quick_checks')
        .select('*')
        .order('created_at', { ascending: false });

      if (filters.startDate) {
        query = query.gte('check_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('check_date', filters.endDate);
      }
      if (filters.clientName) {
        query = query.ilike('client_name', `%${filters.clientName}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      setChecks(data || []);
    } catch (err) {
      console.error('Error loading quick checks:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this stock check?')) return;
    try {
      await supabase.from('quick_checks').delete().eq('id', id);
      loadChecks();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const formatDate = (date) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('en-IN');
  };

  const getVariantBadge = (filter) => {
    const colors = {
      'Green': { bg: '#d1fae5', color: '#047857' },
      'Blue': { bg: '#dbeafe', color: '#1d4ed8' },
      'Non-Variant': { bg: '#fef3c7', color: '#b45309' },
      'All': { bg: '#f3f4f6', color: '#6b7280' }
    };
    const style = colors[filter] || colors['All'];
    return (
      <span style={{ background: style.bg, color: style.color, padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600 }}>
        {filter}
      </span>
    );
  };

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">Quick Stock Check</h1>
        <button className="btn btn-primary" onClick={() => navigate('/quick-stock-check/create')}>
          + New Stock Check
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
          <div className="form-group" style={{ margin: 0, minWidth: '200px' }}>
            <label className="form-label" style={{ fontSize: '11px', fontWeight: 600 }}>Client Name</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search client..."
              value={filters.clientName}
              onChange={(e) => setFilters({ ...filters, clientName: e.target.value })}
            />
          </div>
          <button className="btn btn-primary" onClick={loadChecks}>
            Search
          </button>
          <button className="btn btn-secondary" onClick={() => setFilters({ startDate: '', endDate: '', clientName: '' })}>
            Clear
          </button>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center' }}>Loading...</div>
        ) : checks.length === 0 ? (
          <div className="empty-state">
            <h3>No Stock Checks Found</h3>
            <p>Create your first quick stock check</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Check No</th>
                  <th>Date</th>
                  <th>Client Name</th>
                  <th>Variant Filter</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {checks.map(check => (
                  <tr key={check.id}>
                    <td>
                      <a
                        href={`#${check.id}`}
                        onClick={(e) => { e.preventDefault(); navigate(`/quick-stock-check/view?id=${check.id}`); }}
                        style={{ color: '#2563eb', fontWeight: 500 }}
                      >
                        {check.check_no}
                      </a>
                    </td>
                    <td>{formatDate(check.check_date)}</td>
                    <td>{check.client_name || '-'}</td>
                    <td>{getVariantBadge(check.variant_filter)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/quick-stock-check/view?id=${check.id}`)}
                        >
                          View
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          onClick={() => navigate(`/quick-stock-check/edit?id=${check.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="btn btn-sm btn-secondary"
                          style={{ color: '#dc2626' }}
                          onClick={() => handleDelete(check.id)}
                        >
                          Delete
                        </button>
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
