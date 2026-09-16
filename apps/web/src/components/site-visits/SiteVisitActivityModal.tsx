import React from 'react';
import { format, parseISO } from 'date-fns';
import { Activity, X } from 'lucide-react';

export interface SiteVisitActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  loading: boolean;
  logs: any[];
}

export const SiteVisitActivityModal: React.FC<SiteVisitActivityModalProps> = ({
  isOpen,
  onClose,
  loading,
  logs,
}) => {
  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', zIndex: 9999,
    }}>
      <div style={{
        background: '#fff', borderRadius: '12px',
        width: '95%', maxWidth: '650px', maxHeight: '80vh',
        overflowY: 'auto', boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px', borderBottom: '1px solid #f0f0f0',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#171717', margin: 0 }}>
            <Activity size={16} style={{ marginRight: '8px', verticalAlign: 'middle', color: '#6b7280' }} />
            Activity Log
          </h3>
          <button onClick={onClose}
            style={{ padding: '6px', border: 'none', background: 'transparent', color: '#a3a3a3', cursor: 'pointer', borderRadius: '50%' }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ padding: '20px' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-zinc-500">
              <Activity size={24} />
              <p className="text-sm font-medium">No activity recorded yet</p>
            </div>
          ) : (
            <div style={{ position: 'relative' }}>
              {logs.map((log: any, idx: number) => (
                <div key={log.id || idx} style={{ display: 'flex', gap: '12px', paddingBottom: idx < logs.length - 1 ? '16px' : 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                    <div style={{
                      width: '10px', height: '10px', borderRadius: '50%',
                      background: log.event_type?.includes('created') ? '#16a34a' :
                        log.event_type?.includes('updated') ? '#3b82f6' :
                        log.event_type?.includes('deleted') ? '#ef4444' : '#6b7280',
                      flexShrink: 0, marginTop: '4px',
                    }} />
                    {idx < logs.length - 1 && (
                      <div style={{ width: '1px', flex: 1, background: '#e5e7eb', marginTop: '4px' }} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: '#171717', margin: 0 }}>
                        {log.title || 'Activity'}
                      </p>
                      <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', marginLeft: '8px' }}>
                        {log.created_at ? format(parseISO(log.created_at), 'dd MMM HH:mm') : ''}
                      </span>
                    </div>
                    {log.description && (
                      <p style={{ fontSize: '12px', color: '#6b7280', margin: '2px 0 0 0', lineHeight: 1.4 }}>
                        {log.description}
                      </p>
                    )}
                    {log.actor_name && (
                      <p style={{ fontSize: '11px', color: '#9ca3af', margin: '2px 0 0 0' }}>
                        by {log.actor_name}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
