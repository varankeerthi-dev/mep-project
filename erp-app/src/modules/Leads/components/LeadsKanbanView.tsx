import React, { useState, useMemo, useCallback } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useLeads, useLeadStatuses, useUpdateLead } from '../../../hooks/use-leads';
import type { Lead, LeadStatus } from '../../../types/leads';
import { LeadDetailDrawer } from './LeadDetailDrawer';
import { Plus } from 'lucide-react';

export const LeadsKanbanView: React.FC = () => {
  const { data: leads = [] } = useLeads();
  const { data: statuses = [] } = useLeadStatuses();
  const updateLead = useUpdateLead();
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [dragOverStatus, setDragOverStatus] = useState<string | null>(null);

  const openStatuses = statuses.filter(s => s.category === 'open');
  const closedStatuses = statuses.filter(s => s.category !== 'open');

  const STATUS_ORDER = useMemo(() => {
    const map = new Map<string, number>();
    statuses.forEach((s, i) => map.set(s.id, i));
    return map;
  }, [statuses]);

  const leadsByStatus = useMemo(() => {
    const map = new Map<string, Lead[]>();
    statuses.forEach(s => map.set(s.id, []));
    leads.forEach(lead => {
      const statusId = lead.lead_status_id || '';
      const existing = map.get(statusId) || [];
      existing.push(lead);
      map.set(statusId, existing);
    });
    return map;
  }, [leads, statuses]);

  const handleDragStart = useCallback((e: React.DragEvent, lead: Lead) => {
    e.dataTransfer.setData('text/plain', lead.id);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    setDragOverStatus(statusId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverStatus(null);
  }, []);

  const handleDrop = useCallback(async (e: React.DragEvent, statusId: string) => {
    e.preventDefault();
    setDragOverStatus(null);
    const leadId = e.dataTransfer.getData('text/plain');
    if (!leadId) return;
    try {
      await updateLead.mutateAsync({ id: leadId, patch: { lead_status_id: statusId } });
    } catch (err) {
      console.error('Failed to move lead:', err);
    }
  }, [updateLead]);

  const renderColumn = (status: LeadStatus) => {
    const columnLeads = leadsByStatus.get(status.id) || [];
    const isDragOver = dragOverStatus === status.id;

    return (
      <div
        key={status.id}
        onDragOver={(e) => handleDragOver(e, status.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, status.id)}
        style={{
          minWidth: '260px',
          maxWidth: '260px',
          background: isDragOver ? '#f0f7ff' : '#f3f4f6',
          borderRadius: '8px',
          padding: '8px',
          transition: 'background 0.15s',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '4px 8px 8px',
            borderBottom: `2px solid ${status.color}`,
            marginBottom: '8px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: status.color,
            }} />
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#18181b' }}>{status.name}</span>
            <span style={{
              fontSize: '11px',
              color: '#6b7280',
              background: '#e5e7eb',
              padding: '1px 6px',
              borderRadius: '10px',
            }}>
              {columnLeads.length}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', minHeight: '60px' }}>
          {columnLeads.map(lead => (
            <div
              key={lead.id}
              draggable
              onDragStart={(e) => handleDragStart(e, lead)}
              onClick={() => setSelectedLead(lead)}
              style={{
                background: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                padding: '10px 12px',
                cursor: 'pointer',
                boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              }}
            >
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#18181b', marginBottom: '4px' }}>
                {lead.contact_name}
              </div>
              {lead.company_name && (
                <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '4px' }}>
                  {lead.company_name}
                </div>
              )}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {lead.estimated_value > 0 ? (
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>
                    ₹{(lead.estimated_value / 100000).toFixed(1)}L
                  </span>
                ) : (
                  <span />
                )}
                {lead.owner_name && (
                  <span style={{
                    fontSize: '10px',
                    color: '#9ca3af',
                    padding: '1px 6px',
                    background: '#f3f4f6',
                    borderRadius: '4px',
                  }}>
                    {lead.owner_name}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div style={{ overflowX: 'auto', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
          {openStatuses.map(renderColumn)}
        </div>
        {closedStatuses.length > 0 && (
          <>
            <div style={{
              fontSize: '11px',
              fontWeight: 600,
              color: '#6b7280',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              marginTop: '24px',
              marginBottom: '8px',
            }}>
              Closed / Lost
            </div>
            <div style={{ display: 'flex', gap: '12px', minWidth: 'max-content' }}>
              {closedStatuses.map(renderColumn)}
            </div>
          </>
        )}
      </div>

      {selectedLead && (
        <LeadDetailDrawer
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdate={() => {}}
        />
      )}
    </div>
  );
};
