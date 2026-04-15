import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../supabase';
import { useNavigate } from 'react-router-dom';
import { formatDate, formatCurrency } from '../utils/formatters';
import { Plus, Search, Filter, FileText, TrendingUp, CheckCircle, Clock, XCircle, ChevronRight, Edit2, Trash2 } from 'lucide-react';
import { AppTable } from '../components/ui/AppTable';

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  .po-page {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    max-width: 1400px;
    margin: 0 auto;
    padding: 24px;
  }
  
  .po-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 1px solid #e5e5e5;
  }
  
  .po-title {
    font-size: 24px;
    font-weight: 600;
    color: #0a0a0a;
    margin: 0;
  }
  
  .po-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 6px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    border: none;
    font-family: inherit;
  }
  
  .po-btn-primary {
    background: #171717;
    color: white;
  }
  
  .po-btn-primary:hover {
    background: #262626;
  }
  
  .po-btn-secondary {
    background: white;
    color: #525252;
    border: 1px solid #e5e5e5;
  }
  
  .po-btn-secondary:hover {
    background: #fafafa;
    border-color: #d4d4d4;
  }
  
  .po-card {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    overflow: hidden;
  }
  
  .po-filters {
    display: flex;
    gap: 12px;
    padding: 16px;
    border-bottom: 1px solid #e5e5e5;
    background: #fafafa;
    flex-wrap: wrap;
  }
  
  .po-filter-group {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  
  .po-label {
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: #737373;
  }
  
  .po-input,
  .po-select {
    padding: 6px 10px;
    border: 1px solid #d4d4d4;
    border-radius: 6px;
    font-size: 13px;
    font-family: inherit;
    color: #171717;
    background: white;
    min-width: 140px;
  }
  
  .po-input:focus,
  .po-select:focus {
    outline: none;
    border-color: #a3a3a3;
    box-shadow: 0 0 0 3px rgba(0,0,0,0.05);
  }
  
  .po-stats {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-bottom: 24px;
  }
  
  @media (max-width: 1024px) {
    .po-stats { grid-template-columns: repeat(2, 1fr); }
  }
  
  @media (max-width: 640px) {
    .po-stats { grid-template-columns: 1fr; }
  }
  
  .po-stat-card {
    background: white;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    align-items: center;
    gap: 12px;
  }
  
  .po-stat-icon {
    width: 40px;
    height: 40px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .po-stat-content {
    flex: 1;
  }
  
  .po-stat-label {
    font-size: 12px;
    color: #737373;
    margin-bottom: 4px;
  }
  
  .po-stat-value {
    font-size: 20px;
    font-weight: 700;
    color: #171717;
  }
  
  .po-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  
  .po-table thead {
    background: #fafafa;
    border-bottom: 1px solid #e5e5e5;
  }
  
  .po-table th {
    padding: 10px 12px;
    text-align: left;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #737373;
  }
  
  .po-table td {
    padding: 12px;
    border-bottom: 1px solid #f0f0f0;
    vertical-align: middle;
  }
  
  .po-table tbody tr:hover {
    background: #fafafa;
  }
  
  .po-status {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
  }
  
  .po-status-open {
    background: #dbeafe;
    color: #1d4ed8;
  }
  
  .po-status-partial {
    background: #fef3c7;
    color: #b45309;
  }
  
  .po-status-closed {
    background: #d1fae5;
    color: #047857;
  }
  
  .po-actions {
    display: flex;
    gap: 6px;
  }
  
  .po-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: 1px solid #e5e5e5;
    border-radius: 4px;
    background: white;
    color: #737373;
    cursor: pointer;
    transition: all 0.15s;
  }
  
  .po-icon-btn:hover {
    background: #fafafa;
    border-color: #d4d4d4;
    color: #171717;
  }
  
  .po-icon-btn.danger:hover {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }
  
  .po-empty {
    padding: 48px;
    text-align: center;
    color: #737373;
  }
  
  .po-loading {
    padding: 48px;
    text-align: center;
    color: #737373;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'po-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

export default function POList() {
  const navigate = useNavigate();
  const [pos, setPos] = useState<any[]>([]);
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
        clients!inner(client_name)
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
      po.clients?.client_name?.toLowerCase().includes(searchLower)
    );
  });

  const getStatusBadge = (status: string) => {
    const classes: Record<string, string> = {
      'Open': 'po-status-open',
      'Partially Billed': 'po-status-partial',
      'Closed': 'po-status-closed'
    };
    return (
      <span className={`po-status ${classes[status] || 'po-status-open'}`}>
        {status === 'Partially Billed' && <Clock size={12} />}
        {status === 'Open' && <CheckCircle size={12} />}
        {status === 'Closed' && <CheckCircle size={12} />}
        {status}
      </span>
    );
  };

  const deletePO = async (id: string) => {
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

  const tableColumns = useMemo(() => [
    {
      header: 'Client',
      accessorKey: 'clients.client_name',
      cell: (info) => info.getValue() || '-'
    },
    {
      header: 'PO NO',
      accessorKey: 'po_number',
      cell: (info) => <span style={{ fontWeight: 600, color: '#171717' }}>{info.getValue()}</span>
    },
    {
      header: 'PO DATE',
      accessorKey: 'po_date',
      cell: (info) => formatDate(info.getValue())
    },
    {
      header: 'EXPIRY',
      accessorKey: 'po_expiry_date',
      cell: (info) => formatDate(info.getValue())
    },
    {
      header: 'TOTAL VALUE',
      accessorKey: 'po_total_value',
      cell: (info) => <span style={{ textAlign: 'right', fontWeight: 500 }}>₹{formatCurrency(info.getValue())}</span>
    },
    {
      header: 'UTILISED',
      accessorKey: 'po_utilized_value',
      cell: (info) => <span style={{ textAlign: 'right', color: '#737373' }}>₹{formatCurrency(info.getValue())}</span>
    },
    {
      header: 'BALANCE',
      accessorKey: 'po_available_value',
      cell: (info) => {
        const val = info.getValue();
        return (
          <span style={{
            textAlign: 'right',
            fontWeight: 600,
            color: val > 0 ? '#047857' : '#dc2626'
          }}>
            ₹{formatCurrency(val)}
          </span>
        );
      }
    },
    {
      header: 'STATUS',
      accessorKey: 'status',
      cell: (info) => getStatusBadge(info.getValue())
    },
    {
      header: 'Actions',
      accessorKey: 'actions',
      cell: ({ row }) => (
        <div className="po-actions" style={{ justifyContent: 'center' }}>
          <button
            className="po-icon-btn"
            onClick={() => navigate(`/client-po/create?id=${row.original.id}`)}
            title="Edit"
          >
            <Edit2 size={14} />
          </button>
          <button
            className="po-icon-btn danger"
            onClick={() => deletePO(row.original.id)}
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
          <button
            className="po-icon-btn"
            onClick={() => navigate(`/client-po/details?id=${row.original.id}`)}
            title="View"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )
    }
  ], [navigate, deletePO]);

  return (
    <div className="po-page">
      {/* Header */}
      <div className="po-header">
        <h1 className="po-title">Client Purchase Orders</h1>
        <button className="po-btn po-btn-primary" onClick={() => navigate('/client-po/create')}>
          <Plus size={16} />
          Create PO
        </button>
      </div>

      {/* Stats */}
      <div className="po-stats">
        <div className="po-stat-card">
          <div className="po-stat-icon" style={{ background: '#f0f9ff', color: '#0284c7' }}>
            <FileText size={20} />
          </div>
          <div className="po-stat-content">
            <div className="po-stat-label">Total POs</div>
            <div className="po-stat-value">{filteredPOs.length}</div>
          </div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon" style={{ background: '#dbeafe', color: '#1d4ed8' }}>
            <CheckCircle size={20} />
          </div>
          <div className="po-stat-content">
            <div className="po-stat-label">Open</div>
            <div className="po-stat-value" style={{ color: '#1d4ed8' }}>
              {filteredPOs.filter(p => p.status === 'Open').length}
            </div>
          </div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon" style={{ background: '#fef3c7', color: '#b45309' }}>
            <Clock size={20} />
          </div>
          <div className="po-stat-content">
            <div className="po-stat-label">Partially Billed</div>
            <div className="po-stat-value" style={{ color: '#b45309' }}>
              {filteredPOs.filter(p => p.status === 'Partially Billed').length}
            </div>
          </div>
        </div>
        <div className="po-stat-card">
          <div className="po-stat-icon" style={{ background: '#d1fae5', color: '#047857' }}>
            <TrendingUp size={20} />
          </div>
          <div className="po-stat-content">
            <div className="po-stat-label">Total Value</div>
            <div className="po-stat-value" style={{ color: '#047857' }}>
              ₹{formatCurrency(filteredPOs.reduce((sum, p) => sum + (p.po_total_value || 0), 0))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Card */}
      <div className="po-card">
        {/* Filters */}
        <div className="po-filters">
          <div className="po-filter-group">
            <label className="po-label">Search</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Search size={14} style={{ color: '#a3a3a3' }} />
              <input
                type="text"
                className="po-input"
                placeholder="PO number or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{ minWidth: '200px' }}
              />
            </div>
          </div>
          <div className="po-filter-group">
            <label className="po-label">Status</label>
            <select
              className="po-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">All Statuses</option>
              <option value="Open">Open</option>
              <option value="Partially Billed">Partially Billed</option>
              <option value="Closed">Closed</option>
            </select>
          </div>
          <div className="po-filter-group">
            <label className="po-label">From Date</label>
            <input
              type="date"
              className="po-input"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </div>
          <div className="po-filter-group">
            <label className="po-label">To Date</label>
            <input
              type="date"
              className="po-input"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="po-loading">Loading purchase orders...</div>
        ) : (
          <AppTable
            data={filteredPOs}
            columns={tableColumns}
            enableSorting={true}
            enablePagination={true}
            defaultPageSize={10}
            emptyMessage="No purchase orders found"
          />
        )}
      </div>
    </div>
  );
}
