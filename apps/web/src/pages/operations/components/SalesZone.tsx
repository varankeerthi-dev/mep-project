import React from 'react';
import { 
  useSalesQuotes, 
  useOpenSalesOrders, 
  useConfirmedAwaitingPO,
  useUpcomingEvents
} from '../api/useOperationsQueries';
import { StatusBadge } from './shared/StatusBadge';
import { formatCurrency } from '../utils';

export const SalesZone: React.FC = () => {
  const quotes = useSalesQuotes();
  const openOrders = useOpenSalesOrders();
  const awaitingPO = useConfirmedAwaitingPO();
  const upcoming = useUpcomingEvents();

  return (
    <section className="mb-[36px]">
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[15px] font-semibold tracking-[0.3px] uppercase text-[var(--ink)]">
            Sales &amp; Pipeline
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px]">
        {/* Quotes to be sent */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Quotes to be sent
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{quotes.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {quotes.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              quotes.data?.map(item => (
                <div key={item.id} className="flex items-center justify-between gap-[10px] p-[10px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{item.client}</div>
                    <div className="text-[11px] text-[var(--ink-faint)] mt-[1px] truncate">{item.context}</div>
                  </div>
                  <div className="flex flex-col items-end gap-[3px] shrink-0">
                    <StatusBadge type={item.badgeType} label={item.badgeLabel} />
                    <span className="text-[10px] text-[var(--ink-faint)] font-mono">{item.daysSince}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Open sales orders */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Open sales orders
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{openOrders.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Client</th>
                  <th className="text-left text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Order#</th>
                  <th className="text-right text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {openOrders.isLoading ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
                ) : (
                  openOrders.data?.map(item => (
                    <tr key={item.id}>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-medium text-[var(--ink)]">{item.client}</td>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] text-[11.5px] text-[var(--ink-faint)]">{item.orderNo}</td>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-mono font-semibold text-right text-[var(--ink)]">{formatCurrency(item.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Confirmed - awaiting official PO */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Confirmed — Awaiting PO
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{awaitingPO.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1 overflow-x-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead>
                <tr>
                  <th className="text-left text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Client</th>
                  <th className="text-left text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Wait</th>
                  <th className="text-right text-[10.5px] uppercase tracking-[0.4px] text-[var(--ink-faint)] font-semibold p-[8px_16px] bg-[var(--surface-alt)]">Value</th>
                </tr>
              </thead>
              <tbody>
                {awaitingPO.isLoading ? (
                  <tr><td colSpan={3} className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
                ) : (
                  awaitingPO.data?.map(item => (
                    <tr key={item.id}>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-medium text-[var(--ink)]">{item.client}</td>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-mono text-[11px] text-[var(--warn)]">{item.daysWaiting}d</td>
                      <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-mono font-semibold text-right text-[var(--ink)]">{formatCurrency(item.value)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Upcoming visits & production */}
      <div className="mt-[14px] bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden">
        <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
          <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
            Upcoming Visits &amp; Production (Next 7 Days)
          </h3>
          <span className="font-mono text-[12px] text-[var(--ink-faint)]">{upcoming.data?.length || 0}</span>
        </div>
        <div className="p-4 overflow-x-auto">
          <table className="w-full border-collapse text-[12.5px]">
            <tbody>
              {upcoming.isLoading ? (
                <tr><td className="text-center p-4 text-[var(--ink-soft)]">Loading...</td></tr>
              ) : (
                upcoming.data?.map(item => (
                  <tr key={item.id}>
                    <td className="p-[9px_16px] border-b border-[var(--surface-alt)] font-medium text-[var(--ink)] w-1/2">{item.title}</td>
                    <td className="p-[9px_16px] border-b border-[var(--surface-alt)] text-[11px] text-[var(--ink-faint)]">{item.meta}</td>
                    <td className="p-[9px_16px] border-b border-[var(--surface-alt)] text-right">
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
