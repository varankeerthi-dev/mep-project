import React from 'react';
import { useUpcomingVisits } from '../api/useOperationsQueriesV2';

const CARD_BORDER = '#EEF2F6';
const CARD_SHADOW = '0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)';

const ViewAllLink: React.FC<{ href: string; label: string }> = ({ href, label }) => (
  <a href={href} style={{
    display: 'block', textAlign: 'center', marginTop: 16, paddingTop: 12,
    borderTop: '1px solid #EEF2F6',
    fontSize: 12, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none'
  }}>
    {label}
  </a>
);

const EmptyState: React.FC<{ icon: React.ReactNode; title: string; sub: string }> = ({ icon, title, sub }) => (
  <div style={{ padding: '40px 0', textAlign: 'center' }}>
    <div style={{ marginBottom: 12, color: 'var(--ink-faint)' }}>{icon}</div>
    <p style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)', margin: '0 0 4px' }}>{title}</p>
    <p style={{ fontSize: 12, color: 'var(--ink-faint)', margin: 0 }}>{sub}</p>
  </div>
);

export const UpcomingVisitsZone: React.FC = () => {
  const visits = useUpcomingVisits();

  return (
    <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 340, boxShadow: CARD_SHADOW }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>Upcoming Visits</h3>
      
      {visits.isLoading ? (
        <EmptyState
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
          title="Loading visits..."
          sub="Fetching your schedule."
        />
      ) : visits.data?.length === 0 ? (
        <EmptyState
          icon={<svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>}
          title="No upcoming visits"
          sub="Your schedule is clear."
        />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {visits.data?.map((item) => (
            <div key={item.id} style={{ display: 'flex', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: 'var(--brand)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 600
                }}>
                  {item.date}
                </div>
                <span style={{ fontSize: 10, color: 'var(--ink-faint)', marginTop: 4 }}>{item.dayOfWeek}</span>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.company}</span>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                    background: item.status === 'Today' ? '#DCFCE7' : item.status === 'Tomorrow' ? '#DBEAFE' : '#F1F5F9',
                    color: item.status === 'Today' ? '#16A34A' : item.status === 'Tomorrow' ? '#2563EB' : '#64748B'
                  }}>
                    {item.status}
                  </span>
                </div>
                <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 8px' }}>{item.visitType}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{
                    width: 20, height: 20, borderRadius: '50%',
                    background: '#E2E8F0', color: 'var(--ink)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 9, fontWeight: 500
                  }}>
                    {item.assignedTo.initials}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.assignedTo.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>•</span>
                  <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.time}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      
      <ViewAllLink href="/calendar" label="View calendar →" />
    </div>
  );
};
