import React from 'react';
import { 
  useSalesQuotes, 
  useOpenSalesOrders, 
  useConfirmedAwaitingPO,
  useUpcomingEvents
} from '../api/useOperationsQueries';
import { StatusBadge } from './shared/StatusBadge';
import { formatCurrency } from '../utils';

const emptyMessages = [
  'All done bro! ✨',
  'Chill mode activated 😎',
  'Nothin\' to see here! 🙌',
  'Smooth sailin\' ahead 🏄',
  'Zero drama zone 🎯',
];

export const SalesZone: React.FC = () => {
  const quotes = useSalesQuotes();
  const openOrders = useOpenSalesOrders();
  const awaitingPO = useConfirmedAwaitingPO();
  const upcoming = useUpcomingEvents();
  const emptyMsg = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[18px]" style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Sales
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Quotes to be sent */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Quotes to be sent</h3>
            <span className="text-[12px] text-[var(--ink-faint)]">{quotes.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {quotes.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : quotes.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              quotes.data?.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-[10px] p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate">{item.client}</div>
                    <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px] truncate">{item.context}</div>
                  </div>
                  <div className="flex flex-col items-end gap-[3px] shrink-0">
                    <StatusBadge type={item.badgeType} label={item.badgeLabel} />
                    <span className="text-[12px] text-[var(--ink-faint)]">{item.daysSince}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open sales orders */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Open sales orders</h3>
            <span className="text-[12px] text-[var(--ink-faint)]">{openOrders.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="text-left text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Client</th>
                  <th className="text-left text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Order#</th>
                  <th className="text-right text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.isLoading ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
                ) : openOrders.data?.length === 0 ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[14px] text-[var(--ink-soft)]">{emptyMsg}</td></tr>
                ) : (
                  openOrders.data?.map(item => (
                    <tr key={item.id}>
                      <td className="p-[14px_16px] border-b border-[var(--border)] font-semibold text-[14px] text-[var(--ink)]">{item.client}</td>
                      <td className="p-[14px_16px] border-b border-[var(--border)] text-[13px] font-medium text-[var(--ink-faint)]">{item.orderNo}</td>
                      <td className="p-[14px_16px] border-b border-[var(--border)] font-semibold text-[14px] text-right text-[var(--ink)]">{formatCurrency(item.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmed - awaiting official PO */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Confirmed — Awaiting PO</h3>
            <span className="text-[12px] text-[var(--ink-faint)]">{awaitingPO.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[14px]">
              <thead>
                <tr>
                  <th className="text-left text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Client</th>
                  <th className="text-left text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Wait</th>
                  <th className="text-right text-[12px] font-semibold text-[var(--ink-faint)] p-[14px_16px] bg-[var(--surface-alt)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {awaitingPO.isLoading ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
                ) : awaitingPO.data?.length === 0 ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[14px] text-[var(--ink-soft)]">{emptyMsg}</td></tr>
                ) : (
                  awaitingPO.data?.map(item => (
                    <tr key={item.id}>
                      <td className="p-[14px_16px] border-b border-[var(--border)] font-semibold text-[14px] text-[var(--ink)]">{item.client}</td>
                      <td className="p-[14px_16px] border-b border-[var(--border)] text-[13px] font-medium text-[var(--warn)]">{item.daysWaiting}d</td>
                      <td className="p-[14px_16px] border-b border-[var(--border)] font-semibold text-[14px] text-right text-[var(--ink)]">{formatCurrency(item.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upcoming visits & production */}
      <div className="mt-5 bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden ops-card">
        <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-white">
          <h3 className="text-[15px] font-semibold text-[var(--ink)]">Upcoming Visits &amp; Production (Next 7 Days)</h3>
          <span className="text-[12px] text-[var(--ink-faint)]">{upcoming.data?.length || 0}</span>
        </div>
        <div className="p-5 overflow-x-auto">
          <table className="w-full border-collapse text-[14px]">
            <tbody>
              {upcoming.isLoading ? (
                <tr><td className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
              ) : upcoming.data?.length === 0 ? (
                <tr><td className="text-center p-4 text-[14px] text-[var(--ink-soft)]">{emptyMsg}</td></tr>
              ) : (
                upcoming.data?.map(item => (
                  <tr key={item.id}>
                    <td className="p-[14px_16px] border-b border-[var(--border)] font-semibold text-[14px] text-[var(--ink)] w-1/2">{item.title}</td>
                    <td className="p-[14px_16px] border-b border-[var(--border)] text-[13px] font-medium text-[var(--ink-faint)]">{item.meta}</td>
                    <td className="p-[14px_16px] border-b border-[var(--border)] text-right">
                      <StatusBadge 
                        type={item.type === 'visit' ? 'info' : 'brand'} 
                        label={item.tag} 
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
};
