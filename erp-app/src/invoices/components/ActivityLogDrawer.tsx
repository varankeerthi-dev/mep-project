import { useState, useEffect, useRef } from 'react';
import { X, Activity, Loader2 } from 'lucide-react';
import { useItemHistory } from '../../hooks/use-item-history';
import { useAuth } from '../../App';
import { formatCurrency } from '../ui-utils';

interface ActivityLogDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  invoice: any; 
  payments: any[];
}

export default function ActivityLogDrawer({ open, onClose, userName, invoice, payments }: ActivityLogDrawerProps) {
  const { organisation } = useAuth();
  const [slideIn, setSlideIn] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Fetch real logs from database
  const { data: dbLogs, isLoading: logsLoading } = useItemHistory(
    organisation?.id,
    'invoice',
    invoice?.id
  );

  useEffect(() => {
    if (open) {
      setSlideIn(true);
    } else {
      setSlideIn(false);
    }
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open, onClose]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && open) {
        onClose();
      }
    };
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [open, onClose]);

  if (!open) return null;

  const displayName = userName || 'Unknown User';

  // Format date helper: dd-mm-yyyy
  const formatObjDate = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    return `${d.getDate().toString().padStart(2, '0')}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getFullYear()}`;
  };

  // Format time helper: 00:00 a.m/p.m
  const formatObjTime = (dateString: string) => {
    if (!dateString) return '';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return '';
    let hours = d.getHours();
    const minutes = d.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'p.m.' : 'a.m.';
    hours = hours % 12;
    hours = hours ? hours : 12; // the hour '0' should be '12'
    return `${hours.toString().padStart(2, '0')}:${minutes} ${ampm}`;
  };

  // Combine dynamic logs with database logs
  const activities: any[] = [];

  // 1. Initial Creation (always from invoice object)
  if (invoice) {
    const createdDate = invoice.created_at || new Date().toISOString();
    activities.push({
      date: formatObjDate(createdDate),
      time: formatObjTime(createdDate),
      details: `${displayName} created the invoice`,
      timestamp: new Date(createdDate).getTime(),
      type: 'creation'
    });
  }

  // 2. Payments (from payments prop)
  if (payments && payments.length > 0) {
    payments.forEach(p => {
      const pDate = p.created_at || p.receipt_date || new Date().toISOString();
      activities.push({
        date: formatObjDate(pDate),
        time: formatObjTime(pDate),
        details: `Payment entered - ${formatCurrency(p.amount)} - by ${displayName}`,
        timestamp: new Date(pDate).getTime(),
        type: 'payment'
      });
    });
  }

  // 3. Database Logs (Edits, Status changes, etc.)
  if (dbLogs) {
    dbLogs.forEach(log => {
      // Show relevant invoice events from the activity log table
      const relevantTypes = ['invoice_edited', 'invoice_finalized', 'invoice_reminder_sent', 'invoice_escalation_changed'];
      if (relevantTypes.includes(log.event_type) || log.title === 'Finalized Invoice Edited') {
        activities.push({
          date: formatObjDate(log.created_at),
          time: formatObjTime(log.created_at),
          details: `${log.title}: ${log.description}`,
          timestamp: new Date(log.created_at).getTime(),
          type: 'db_event',
          actor: log.actor_name
        });
      }
    });
  }

  // Deduplicate and sort chronologically
  const uniqueActivities = Array.from(new Map(activities.map(a => [`${a.timestamp}-${a.details}`, a])).values());
  uniqueActivities.sort((a, b) => b.timestamp - a.timestamp); // Newest first

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0, 0, 0, 0.4)',
        transition: 'opacity 0.3s ease',
        opacity: slideIn ? 1 : 0,
      }}
    >
      <div
        ref={drawerRef}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          maxWidth: '100vw',
          background: '#fff',
          boxShadow: '-4px 0 20px rgba(0, 0, 0, 0.1)',
          transform: slideIn ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.3s ease',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '24px',
          borderBottom: '1px solid #e5e7eb',
          background: '#fafafa'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Activity size={20} color="#6b7280" />
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#111827' }}>
              Activity History
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              background: 'transparent',
              border: 'none',
              borderRadius: '6px',
              color: '#6b7280',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = '#e5e7eb'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '32px 24px' }}>
          {logsLoading ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280' }}>
              <Loader2 className="animate-spin" size={16} />
              <span style={{ fontSize: '14px' }}>Loading history...</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              {uniqueActivities.length === 0 && (
                <div style={{ color: '#6b7280', fontSize: '14px' }}>No activities found.</div>
              )}
              {uniqueActivities.map((activity, idx) => (
                <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <div style={{ 
                    width: '120px', 
                    flexShrink: 0, 
                    color: '#6b7280', 
                    fontSize: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '2px'
                  }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>{activity.date}</span>
                    <span>{activity.time}</span>
                  </div>
                  
                  {/* Timeline separator */}
                  <div style={{ 
                    position: 'relative', 
                    margin: '0 16px', 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    alignSelf: 'stretch'
                  }}>
                    <div style={{ 
                      width: '8px', 
                      height: '8px', 
                      borderRadius: '50%', 
                      background: activity.type === 'creation' ? '#10b981' : '#d1d5db',
                      marginTop: '4px',
                      zIndex: 1
                    }} />
                    {idx < uniqueActivities.length - 1 && (
                      <div style={{ 
                        position: 'absolute', 
                        top: '12px', 
                        bottom: '-36px', 
                        width: '1.5px', 
                        background: '#e5e7eb' 
                      }} />
                    )}
                  </div>

                  <div style={{ flex: 1, paddingTop: '1px' }}>
                    <div style={{ color: '#111827', fontSize: '13px', fontWeight: 500, lineHeight: 1.4 }}>
                      {activity.details}
                    </div>
                    {activity.actor && (
                      <div style={{ color: '#6b7280', fontSize: '11px', marginTop: '2px' }}>
                        by {activity.actor}
                      </div>
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
}
