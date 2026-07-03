import React from 'react';
import type { AeKpiData } from '../types';

const CARD_STYLE: React.CSSProperties = {
  background: '#fff',
  border: '1px solid #e4e4e7',
  borderRadius: '8px',
  padding: '16px 20px',
  flex: 1,
  minWidth: 140,
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  fontWeight: 600,
  color: '#71717a',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '4px',
};

const VALUE_STYLE: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 700,
  color: '#18181b',
};

export const KpiCards: React.FC<{ data: AeKpiData }> = ({ data }) => {
  const cards = [
    { label: 'Advances Total', value: data.advances_total },
    { label: 'Expenses Total', value: data.expenses_total },
    { label: 'Awaiting Payment', value: data.awaiting_payment },
    { label: 'Paid Out', value: data.paid_out },
    { label: 'Accrued', value: data.accrued },
    { label: 'Float Balances', value: data.float_balances },
  ];

  return (
    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {cards.map((c) => (
        <div key={c.label} style={CARD_STYLE}>
          <div style={LABEL_STYLE}>{c.label}</div>
          <div style={VALUE_STYLE}>₹{Number(c.value).toLocaleString('en-IN')}</div>
        </div>
      ))}
    </div>
  );
};
