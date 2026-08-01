import React from 'react';
import { useNeedsAttentionV2 } from '../api/useOperationsQueriesV2';
import { formatCurrency } from '../utils';

const CARD_SHADOW = '0 1px 3px rgba(15,23,42,.05), 0 8px 24px rgba(15,23,42,.06)';

export const NeedsAttentionZone: React.FC = () => {
  const { data: items, isLoading } = useNeedsAttentionV2();

  return (
    <section>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--ink)', margin: 0 }}>Needs Attention</h2>
          {items && items.length > 0 && (
            <span style={{
              padding: '2px 8px', borderRadius: 9999,
              background: '#FEF2F2', color: '#DC2626',
              fontSize: 11, fontWeight: 600
            }}>
              {items.length}
            </span>
          )}
        </div>
        <a href="/alerts" style={{ fontSize: 13, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
          View all alerts
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="9 18 15 12 9 6"></polyline>
          </svg>
        </a>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {[1, 2, 3].map((i) => (
            <div key={i} style={{ flex: 'none', width: 320, height: 190, background: '#F1F5F9', borderRadius: 12 }}></div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
          {items?.map((item) => (
            <div
              key={item.id}
              style={{
                flex: 'none', width: 320, background: '#fff',
                border: '1px solid #EEF2F6', borderRadius: 12,
                padding: 20, cursor: 'pointer',
                boxShadow: CARD_SHADOW,
                transition: 'box-shadow 0.2s'
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 16px 40px rgba(15,23,42,.10)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = CARD_SHADOW; }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <span style={{
                  padding: '3px 8px', borderRadius: 6,
                  fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
                  background: item.type === 'alert' ? '#FEF2F2' : item.type === 'warn' ? '#FFFBEB' : '#EFF6FF',
                  color: item.type === 'alert' ? '#DC2626' : item.type === 'warn' ? '#D97706' : '#2563EB'
                }}>
                  {item.tagLabel}
                </span>
              </div>
              
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--ink)', margin: '0 0 4px' }}>{item.title}</h3>
              <p style={{ fontSize: 13, color: 'var(--ink-soft)', margin: '0 0 12px' }}>{item.context}</p>
              
              {item.amount && (
                <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 12px' }}>
                  {formatCurrency(item.amount)}
                </p>
              )}
              
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {item.owner && (
                    <>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: 'var(--brand)', color: '#fff',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, fontWeight: 600
                      }}>
                        {item.owner.initials}
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{item.owner.name}</span>
                    </>
                  )}
                </div>
                {item.statusBadge && (
                  <span style={{
                    padding: '2px 8px', borderRadius: 9999,
                    fontSize: 11, fontWeight: 500,
                    background: item.statusBadge.type === 'Today' ? '#DCFCE7' : '#F1F5F9',
                    color: item.statusBadge.type === 'Today' ? '#16A34A' : '#64748B'
                  }}>
                    {item.statusBadge.text}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
