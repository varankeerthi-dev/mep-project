import React from 'react';
import { Clock, User, Tag, Mail, Phone, ArrowRight, Plus, XCircle } from 'lucide-react';
import { useLeadHistory } from '../../../hooks/use-leads';

interface LeadHistoryTabProps {
  leadId: string;
}

const ACTION_ICONS: Record<string, React.ReactNode> = {
  'created': <Plus size={14} />,
  'status_changed': <ArrowRight size={14} />,
  'field_changed': <Tag size={14} />,
  'note_added': <Clock size={14} />,
  'assigned': <User size={14} />,
  'converted': <ArrowRight size={14} />,
};

const ACTION_LABELS: Record<string, string> = {
  'created': 'Lead created',
  'status_changed': 'Status changed',
  'field_changed': 'Field updated',
  'note_added': 'Note added',
  'assigned': 'Lead assigned',
  'converted': 'Lead converted',
};

export const LeadHistoryTab: React.FC<LeadHistoryTabProps> = ({ leadId }) => {
  const { data: history = [], isLoading } = useLeadHistory(leadId);

  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center', color: '#9ca3af', fontSize: '13px' }}>
        Loading history...
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Clock size={24} style={{ color: '#d1d5db', marginBottom: '8px' }} />
        <div style={{ fontSize: '13px', color: '#9ca3af' }}>No history recorded yet</div>
        <div style={{ fontSize: '11px', color: '#d1d5db', marginTop: '4px' }}>
          Changes to this lead will appear here
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        position: 'absolute',
        left: '15px',
        top: '8px',
        bottom: '8px',
        width: '2px',
        background: '#e5e7eb',
      }} />
      {history.map((entry) => (
        <div key={entry.id} style={{ display: 'flex', gap: '12px', marginBottom: '16px', position: 'relative' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: '#f3f4f6',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6b7280',
            flexShrink: 0,
            zIndex: 1,
          }}>
            {ACTION_ICONS[entry.action] || <Clock size={14} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: '#18181b' }}>
                {ACTION_LABELS[entry.action] || entry.action}
              </span>
              <span style={{ fontSize: '11px', color: '#9ca3af' }}>
                {new Date(entry.created_at).toLocaleString()}
              </span>
            </div>
            {entry.field_name && (
              <div style={{ fontSize: '11px', color: '#6b7280', marginBottom: '2px' }}>
                Field: <strong>{entry.field_name}</strong>
                {entry.old_value && entry.new_value && (
                  <span>
                    {' '}— <span style={{ color: '#dc2626', textDecoration: 'line-through' }}>{entry.old_value}</span>
                    {' '}→ <span style={{ color: '#059669' }}>{entry.new_value}</span>
                  </span>
                )}
              </div>
            )}
            {entry.notes && (
              <div style={{
                fontSize: '11px',
                color: '#374151',
                background: '#f9fafb',
                padding: '6px 10px',
                borderRadius: '4px',
                marginTop: '4px',
              }}>
                {entry.notes}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
