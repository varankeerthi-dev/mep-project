import { useState, useEffect, useRef } from 'react';
import { X, Activity } from 'lucide-react';

import { formatCurrency } from '../ui-utils';

interface ActivityLogDrawerProps {
  open: boolean;
  onClose: () => void;
  userName?: string;
  invoice: any; // Type it broadly or use InvoiceWithRelations
  payments: any[];
}

export default function ActivityLogDrawer({ open, onClose, userName, invoice, payments }: ActivityLogDrawerProps) {
  const [slideIn, setSlideIn] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

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

  // Generate activities dynamically
  const activities = [];

  if (invoice) {
    const createdDate = invoice.created_at || new Date().toISOString();
    activities.push({
      date: formatObjDate(createdDate),
      time: formatObjTime(createdDate),
      details: `${displayName} created the invoice`,
      timestamp: new Date(createdDate).getTime()
    });

    if (invoice.status !== 'draft') {
      activities.push({
        date: formatObjDate(createdDate),
        time: formatObjTime(createdDate),
        details: `Invoice approved - by ${displayName}`,
        timestamp: new Date(createdDate).getTime() + 1000 // slightly after creation
      });
    }
  }

  if (payments && payments.length > 0) {
    payments.forEach(p => {
      const pDate = p.created_at || p.receipt_date || new Date().toISOString();
      activities.push({
        date: formatObjDate(pDate),
        time: formatObjTime(pDate),
        details: `Payment entered - ${formatCurrency(p.amount)} - by ${displayName}`,
        timestamp: new Date(pDate).getTime()
      });
    });
  }

  // Sort chronologically
  activities.sort((a, b) => a.timestamp - b.timestamp);

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
          width: '400px',
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
              Activity Log
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
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            {activities.length === 0 && (
              <div style={{ color: '#6b7280', fontSize: '14px' }}>No activities found.</div>
            )}
            {activities.map((activity, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'flex-start' }}>
                <div style={{ 
                  width: '140px', 
                  flexShrink: 0, 
                  color: '#6b7280', 
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px'
                }}>
                  <span style={{ fontWeight: 500, color: '#374151' }}>{activity.date}</span>
                  <span>{activity.time}</span>
                </div>
                
                {/* Timeline separator */}
                <div style={{ 
                  position: 'relative', 
                  margin: '0 20px', 
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center',
                  alignSelf: 'stretch'
                }}>
                  <div style={{ 
                    width: '10px', 
                    height: '10px', 
                    borderRadius: '50%', 
                    background: '#d1d5db',
                    marginTop: '4px',
                    zIndex: 1
                  }} />
                  {idx < activities.length - 1 && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '14px', 
                      bottom: '-36px', 
                      width: '2px', 
                      background: '#e5e7eb' 
                    }} />
                  )}
                </div>

                <div style={{ flex: 1, color: '#111827', fontSize: '14px', paddingTop: '2px' }}>
                  {activity.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
