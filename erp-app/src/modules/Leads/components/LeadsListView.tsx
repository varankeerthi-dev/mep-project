import React, { useState, useMemo } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLeads, useLeadStatuses, useLeadIndustries } from '../../../hooks/use-leads';
import type { Lead, LeadStatus } from '../../../types/leads';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { LeadCreateForm } from './LeadCreateForm';
import { Plus, Search, Filter, ChevronDown } from 'lucide-react';

const STATUS_COLORS: Record<string, string> = {
  'Attempted to Contact': '#F59E0B',
  'Contact in Future': '#3B82F6',
  'Contacted': '#10B981',
  'Not Contacted': '#6B7280',
  'Pre-Qualified': '#8B5CF6',
  'Not Qualified': '#EF4444',
  'Junk Lead': '#DC2626',
  'Lost Lead': '#991B1B',
  'New': '#3B82F6',
  'Qualified': '#10B981',
  'Converted': '#059669',
  'Disqualified': '#EF4444',
  'On Hold': '#F59E0B',
};

export const LeadsListView: React.FC = () => {
  const { data: leads = [], isLoading } = useLeads();
  const { data: statuses = [] } = useLeadStatuses();
  const { data: industries = [] } = useLeadIndustries();
  const { organisation } = useAuth();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const sources = useMemo(() => {
    const s = new Set(leads.map(l => l.source));
    return Array.from(s);
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(lead => {
      if (search) {
        const q = search.toLowerCase();
        if (!lead.contact_name.toLowerCase().includes(q) &&
            !lead.company_name.toLowerCase().includes(q) &&
            !lead.contact_email.toLowerCase().includes(q) &&
            !lead.contact_phone.includes(q)) return false;
      }
      if (statusFilter !== 'all' && lead.status !== statusFilter && lead.lead_status?.name !== statusFilter) return false;
      if (sourceFilter !== 'all' && lead.source !== sourceFilter) return false;
      return true;
    });
  }, [leads, search, statusFilter, sourceFilter]);

  const getStatusColor = (lead: Lead): string => {
    if (lead.lead_status?.color) return lead.lead_status.color;
    return STATUS_COLORS[lead.status] || '#6B7280';
  };

  const getStatusName = (lead: Lead): string => {
    return lead.lead_status?.name || lead.status;
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search leads..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                padding: '6px 12px 6px 32px',
                fontSize: '12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                width: '260px',
                outline: 'none',
              }}
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              border: '1px solid #d1d5db',
              borderRadius: '6px',
              background: showFilters ? '#f3f4f6' : '#fff',
              color: '#374151',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <Filter size={13} />
            Filters
          </button>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          style={{
            padding: '6px 14px',
            fontSize: '12px',
            fontWeight: 600,
            background: '#185FA5',
            border: '1px solid #185FA5',
            color: '#fff',
            borderRadius: '6px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <Plus size={14} />
          New Lead
        </button>
      </div>

      {showFilters && (
        <div className="flex gap-3 mb-4 p-3 bg-white border border-zinc-200 rounded-lg">
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Status</label>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="all">All Statuses</option>
              {statuses.map(s => (
                <option key={s.id} value={s.name}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151', display: 'block', marginBottom: '4px' }}>Source</label>
            <select
              value={sourceFilter}
              onChange={e => setSourceFilter(e.target.value)}
              style={{ padding: '4px 8px', fontSize: '12px', border: '1px solid #d1d5db', borderRadius: '4px' }}
            >
              <option value="all">All Sources</option>
              {sources.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12 text-zinc-400" style={{ fontSize: '13px' }}>Loading leads...</div>
      ) : filteredLeads.length === 0 ? (
        <div className="text-center py-12">
          <div style={{ fontSize: '13px', color: '#9ca3af', marginBottom: '8px' }}>No leads found</div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '6px 14px',
              fontSize: '12px',
              color: '#185FA5',
              background: 'transparent',
              border: '1px solid #185FA5',
              borderRadius: '6px',
              cursor: 'pointer',
            }}
          >
            Create your first lead
          </button>
        </div>
      ) : (
        <div className="bg-white border border-zinc-200 rounded-lg overflow-hidden">
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#f8f9fa', borderBottom: '1px solid #e5e7eb' }}>
                <Th>Contact</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th>Source</Th>
                <Th>Industry</Th>
                <Th>Value</Th>
                <Th>Owner</Th>
                <Th>Created</Th>
              </tr>
            </thead>
            <tbody>
              {filteredLeads.map(lead => (
                <tr
                  key={lead.id}
                  onClick={() => setSelectedLead(lead)}
                  style={{
                    borderBottom: '1px solid #f3f4f6',
                    cursor: 'pointer',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#f9fafb')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#18181b' }}>{lead.contact_name}</div>
                    <div style={{ fontSize: '11px', color: '#6b7280' }}>{lead.contact_email}</div>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#374151' }}>{lead.company_name}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        fontSize: '11px',
                        fontWeight: 500,
                        borderRadius: '4px',
                        color: '#fff',
                        background: getStatusColor(lead),
                      }}
                    >
                      {getStatusName(lead)}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{lead.source}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{lead.industry?.name || '-'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', fontWeight: 600, color: '#059669' }}>
                    {lead.estimated_value ? `₹${(lead.estimated_value / 100000).toFixed(1)}L` : '-'}
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '12px', color: '#6b7280' }}>{lead.owner_name || 'Unassigned'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '11px', color: '#9ca3af' }}>
                    {new Date(lead.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {}}
        />
      )}

      {showCreateModal && (
        <LeadCreateForm
          onClose={() => setShowCreateModal(false)}
          onCreated={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
};

const Th: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <th
    style={{
      padding: '8px 12px',
      fontSize: '11px',
      fontWeight: 600,
      color: '#374151',
      textAlign: 'left',
      whiteSpace: 'nowrap',
    }}
  >
    {children}
  </th>
);
