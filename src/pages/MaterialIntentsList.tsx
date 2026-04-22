import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useAuth } from '../App';
import { Search, MoreVertical, Eye, Edit, FileText, Package, ChevronDown, ChevronRight } from 'lucide-react';
import { getAllIntents, MaterialIntent } from '../material-intents/api';

const STATUS_COLORS = {
  'Pending': '#6b7280',
  'Approved': '#3b82f6',
  'Partial': '#f59e0b',
  'Received': '#22c55e',
  'Rejected': '#ef4444',
  'Assigned': '#8b5cf6',
  'In Transit': '#06b6d4',
  'Fulfilled': '#10b981',
};

interface MaterialIntentsListProps {
  organisationId: string;
}

export default function MaterialIntentsList({ organisationId }: MaterialIntentsListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data: intents = [], isLoading } = useQuery({
    queryKey: ['allMaterialIntents', organisationId],
    queryFn: () => getAllIntents(organisationId),
    enabled: !!organisationId,
  });

  const filteredIntents = intents.filter(intent => {
    const matchesSearch = 
      intent.item_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intent.indent_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      intent.projects?.project_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || intent.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const toggleRow = (intentId: string) => {
    const newExpanded = new Set(expandedRows);
    if (newExpanded.has(intentId)) {
      newExpanded.delete(intentId);
    } else {
      newExpanded.add(intentId);
    }
    setExpandedRows(newExpanded);
  };

  const statusOptions = [
    { value: 'all', label: 'All Status' },
    { value: 'Pending', label: 'Pending' },
    { value: 'Approved', label: 'Approved' },
    { value: 'Assigned', label: 'Assigned' },
    { value: 'In Transit', label: 'In Transit' },
    { value: 'Fulfilled', label: 'Fulfilled' },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 600, marginBottom: '8px' }}>All Material Intents</h1>
        <p style={{ color: '#6b7280', fontSize: '14px' }}>View and manage material intents across all projects</p>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
          <input
            type="text"
            placeholder="Search by item, indent number, or project..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 12px 10px 40px',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={{
            padding: '10px 12px',
            border: '1px solid #e5e7eb',
            borderRadius: '6px',
            fontSize: '14px',
            background: 'white',
          }}
        >
          {statusOptions.map(opt => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>Loading...</div>
      ) : filteredIntents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          <Package size={48} style={{ color: '#d1d5db', marginBottom: '12px' }} />
          <p>No material intents found</p>
        </div>
      ) : (
        <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '8px', overflow: 'hidden' }}>
          {/* Table Header */}
          <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 120px 120px 120px 200px 100px', gap: '16px', padding: '12px 16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
            <div></div>
            <div>Project</div>
            <div>Indent No</div>
            <div>Request Date</div>
            <div>Status</div>
            <div>Stores Remarks</div>
            <div>Actions</div>
          </div>

          {/* Table Body */}
          {filteredIntents.map((intent) => (
            <div key={intent.id}>
              {/* Main Row */}
              <div 
                style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '40px 1fr 120px 120px 120px 200px 100px', 
                  gap: '16px', 
                  padding: '12px 16px', 
                  borderBottom: '1px solid #f3f4f6',
                  alignItems: 'center',
                  fontSize: '14px',
                  cursor: 'pointer',
                  '&:hover': { background: '#f9fafb' },
                }}
                onClick={() => toggleRow(intent.id)}
              >
                <div style={{ display: 'flex', justifyContent: 'center' }}>
                  {expandedRows.has(intent.id) ? <ChevronDown size={18} color="#6b7280" /> : <ChevronRight size={18} color="#6b7280" />}
                </div>
                <div style={{ fontWeight: 500 }}>{intent.projects?.project_name || '-'}</div>
                <div style={{ fontFamily: 'monospace', fontSize: '13px' }}>{intent.indent_number || `IND-${intent.id.slice(0, 8)}`}</div>
                <div style={{ color: '#6b7280', fontSize: '13px' }}>
                  {intent.required_date ? new Date(intent.required_date).toLocaleDateString() : '-'}
                </div>
                <div>
                  <span style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    fontSize: '12px',
                    fontWeight: 500,
                    background: STATUS_COLORS[intent.status] + '20',
                    color: STATUS_COLORS[intent.status],
                  }}>
                    {intent.status}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#6b7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {intent.stores_remarks || '-'}
                </div>
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                    title="View"
                  >
                    <Eye size={16} color="#6b7280" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                    title="Edit"
                  >
                    <Edit size={16} color="#6b7280" />
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); }}
                    style={{ padding: '6px', border: '1px solid #e5e7eb', borderRadius: '4px', background: 'white', cursor: 'pointer' }}
                    title="More"
                  >
                    <MoreVertical size={16} color="#6b7280" />
                  </button>
                </div>
              </div>

              {/* Expanded Row - Material Details */}
              {expandedRows.has(intent.id) && (
                <div style={{ padding: '16px', background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                  <div style={{ marginBottom: '12px', fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                    Material Details
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', fontSize: '13px' }}>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Item</div>
                      <div style={{ fontWeight: 500 }}>{intent.item_name}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Variant</div>
                      <div>{intent.variant_name || '-'}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Requested Qty</div>
                      <div style={{ fontWeight: 500 }}>{intent.requested_qty} {intent.uom}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Received Qty</div>
                      <div>{intent.received_qty} {intent.uom}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Reserved Qty</div>
                      <div style={{ color: '#8b5cf6' }}>{intent.reserved_qty || 0} {intent.uom}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>In Transit Qty</div>
                      <div style={{ color: '#06b6d4' }}>{intent.in_transit_qty || 0} {intent.uom}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Pending Qty</div>
                      <div style={{ color: '#f59e0b' }}>{intent.pending_qty} {intent.uom}</div>
                    </div>
                    <div>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Priority</div>
                      <div>{intent.priority}</div>
                    </div>
                  </div>
                  {intent.notes && (
                    <div style={{ marginTop: '12px', fontSize: '13px' }}>
                      <div style={{ color: '#6b7280', marginBottom: '4px' }}>Notes</div>
                      <div>{intent.notes}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
