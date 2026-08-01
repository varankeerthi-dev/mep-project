import React from 'react';
import { useSalesQuotesV2, useOpenSalesOrdersV2 } from '../api/useOperationsQueriesV2';
import { formatCurrency } from '../utils';

const CARD_BORDER = '#EEF2F6';
const ROW_BG = '#F1F5F9';
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

export const SalesZone: React.FC = () => {
  const quotes = useSalesQuotesV2();
  const orders = useOpenSalesOrdersV2();

  return (
    <div style={{ background: '#fff', border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 20, minHeight: 340, boxShadow: CARD_SHADOW }}>
      <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--ink)', margin: '0 0 16px' }}>Sales & Pipeline</h3>
      
      {/* Quotes to be Sent */}
      <div style={{ marginBottom: 24 }}>
        <h4 style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Quotes to be Sent</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Client / Project</th>
              <th style={{ textAlign: 'right', padding: '0 0 16px' }}>Value</th>
              <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Status</th>
              <th style={{ textAlign: 'right', padding: '0 0 16px' }}>Pending</th>
            </tr>
          </thead>
          <tbody>
            {quotes.isLoading ? (
              <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</td></tr>
            ) : quotes.data?.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No pending quotes</td></tr>
            ) : (
              quotes.data?.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.clientProject}</span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{formatCurrency(item.value)}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{
                      padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500,
                      background: item.statusType === 'Tech Approval' ? '#DBEAFE' : item.statusType === 'Pricing' ? '#FEF3C7' : '#F1F5F9',
                      color: item.statusType === 'Tech Approval' ? '#2563EB' : item.statusType === 'Pricing' ? '#D97706' : '#64748B'
                    }}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.pendingSince}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <ViewAllLink href="/sales/quotes" label="View all quotes →" />
      </div>

      {/* Open Sales Orders */}
      <div>
        <h4 style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 12px' }}>Open Sales Orders</h4>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ fontSize: 11, fontWeight: 500, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Client</th>
              <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Order #</th>
              <th style={{ textAlign: 'left', padding: '0 0 16px' }}>Date</th>
              <th style={{ textAlign: 'right', padding: '0 0 16px' }}>Value</th>
            </tr>
          </thead>
          <tbody>
            {orders.isLoading ? (
              <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>Loading...</td></tr>
            ) : orders.data?.length === 0 ? (
              <tr><td colSpan={4} style={{ padding: '24px 0', textAlign: 'center', color: 'var(--ink-faint)' }}>No open orders</td></tr>
            ) : (
              orders.data?.map((item, i) => (
                <tr key={item.id} style={{ background: i % 2 === 0 ? ROW_BG : 'transparent', borderRadius: 6 }}>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{item.client}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.orderNo}</span>
                  </td>
                  <td style={{ padding: '12px 8px' }}>
                    <span style={{ fontSize: 12, color: 'var(--ink-faint)' }}>{item.orderDate}</span>
                  </td>
                  <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--ink)' }}>{formatCurrency(item.value)}</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        <ViewAllLink href="/sales/orders" label="View all orders →" />
      </div>
    </div>
  );
};
