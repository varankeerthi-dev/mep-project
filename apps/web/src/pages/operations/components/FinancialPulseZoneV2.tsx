import React from 'react';
import { useProformaAdvanceV2, useOverdueReceivables } from '../api/useOperationsQueriesV2';
import { formatCurrency } from '../utils';

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

export const FinancialPulseZone: React.FC = () => {
  const proforma = useProformaAdvanceV2();
  const receivables = useOverdueReceivables();

  return (
    <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 340, boxShadow: CARD_SHADOW }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>Financial Pulse</h3>
      
      {/* Proforma / Advance Pending */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Proforma / Advance Pending</h4>
          <a href="/finance/proforma" style={{ fontSize: 11, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none' }}>
            View all →
          </a>
        </div>
        
        {proforma.isLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</div>
        ) : proforma.data?.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No pending proformas</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {proforma.data?.map((item) => (
              <div key={item.id} style={{ padding: 16, background: '#F8FAFC', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.company}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: '#FEF3C7', color: '#D97706', fontSize: 11, fontWeight: 500 }}>
                    {item.advancePercentage}% Received
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>PO Value</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{formatCurrency(item.poValue)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>Advance</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{formatCurrency(item.advanceReceived)}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>Pending</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#DC2626' }}>{formatCurrency(item.pendingAmount)}</span>
                  </div>
                </div>
                
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: 'var(--ink-faint)' }}>Recovery</span>
                    <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink)' }}>{item.advancePercentage}%</span>
                  </div>
                  <div style={{ width: '100%', height: 6, background: '#E2E8F0', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${item.advancePercentage}%`, height: '100%', background: '#F59E0B', borderRadius: 3 }}></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Overdue Receivables */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h4 style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Overdue Receivables</h4>
          <a href="/finance/receivables" style={{ fontSize: 11, fontWeight: 500, color: 'var(--brand)', textDecoration: 'none' }}>
            View all →
          </a>
        </div>
        
        {receivables.isLoading ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</div>
        ) : receivables.data?.length === 0 ? (
          <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No overdue receivables</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {receivables.data?.map((item) => (
              <div key={item.id} style={{ padding: 16, background: '#F8FAFC', borderRadius: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.company}</span>
                  <span style={{ padding: '2px 8px', borderRadius: 4, background: '#FEF2F2', color: '#DC2626', fontSize: 11, fontWeight: 500 }}>
                    {item.daysOverdue} days overdue
                  </span>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>Invoice</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.invoice}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>Due Date</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.dueDate}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)', display: 'block', marginBottom: 2 }}>Amount</span>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#DC2626' }}>{formatCurrency(item.amount)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      
      <ViewAllLink href="/finance" label="View all financials →" />
    </div>
  );
};
