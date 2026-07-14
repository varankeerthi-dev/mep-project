import React from 'react';
import { AlertTriangle, Clock, Activity } from 'lucide-react';
import { 
  useBlockingWork, 
  useProformaAdvancePending,
  useDueToday,
  usePayablesList,
  useReceivablesList
} from '../api/useOperationsQueries';
import { IconChip } from './shared/IconChip';
import { ProgressBar } from './shared/ProgressBar';
import { AccordionRow } from './shared/AccordionRow';
import { formatCurrency } from '../utils';

export const FinancialPulseZone: React.FC = () => {
  const blockingWork = useBlockingWork();
  const proformaAdvance = useProformaAdvancePending();
  const dueToday = useDueToday();
  const payables = usePayablesList();
  const receivables = useReceivablesList();

  return (
    <section className="mb-[36px]">
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[15px] font-semibold tracking-[0.3px] uppercase text-[var(--ink)]">
            Financial Pulse
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] mb-[14px]">
        {/* Blocking Work */}
        <div className="border border-[var(--alert)] rounded-[var(--radius)] bg-[var(--surface)] shadow-[var(--shadow)] overflow-hidden">
          <div className="p-[12px_16px] border-b border-[var(--border)] bg-[var(--alert-soft)] flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              <AlertTriangle className="w-[15px] h-[15px] text-[var(--alert)] shrink-0" />
              <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--alert)]">
                Blocking Work
              </h3>
            </div>
            <span className="font-mono text-[12px] text-[var(--alert)]">{blockingWork.data?.length || 0}</span>
          </div>
          <div className="p-4">
            {blockingWork.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : blockingWork.data?.length === 0 ? (
              <div className="p-4 text-[13px] text-[var(--ink-soft)]">No blocking work.</div>
            ) : (
              blockingWork.data?.map(item => (
                <div key={item.id} className="p-[13px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="flex justify-between items-start mb-[8px] gap-[10px]">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--ink)]">{item.project}</div>
                      <div className="text-[11.5px] text-[var(--ink-faint)] mt-[1px]">{item.context}</div>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-white bg-[var(--alert)] p-[3px_8px] rounded-[20px] shrink-0 whitespace-nowrap">
                      Stopped — Payment pending
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--ink-soft)] mb-[6px]">
                    <div><span className="text-[var(--ink-faint)] mr-1">Work started:</span> {item.workStarted}</div>
                    <div><span className="text-[var(--ink-faint)] mr-1">Stopped since:</span> {item.stoppedSince} ({item.daysStopped}d)</div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--ink-faint)] mt-2">
                    <span>Pending amount:</span>
                    <span className="font-mono font-semibold text-[var(--alert)] text-[12px]">{formatCurrency(item.pendingAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Proforma / advance pending */}
        <div className="border border-[var(--warn)] rounded-[var(--radius)] bg-[var(--surface)] shadow-[var(--shadow)] overflow-hidden">
          <div className="p-[12px_16px] border-b border-[var(--border)] bg-[var(--warn-soft)] flex items-center justify-between">
            <div className="flex items-center gap-[8px]">
              <Clock className="w-[15px] h-[15px] text-[var(--warn)] shrink-0" />
              <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--warn)]">
                Proforma / Advance Pending
              </h3>
            </div>
            <span className="font-mono text-[12px] text-[var(--warn)]">{proformaAdvance.data?.length || 0}</span>
          </div>
          <div className="p-4">
            {proformaAdvance.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : proformaAdvance.data?.length === 0 ? (
              <div className="p-4 text-[13px] text-[var(--ink-soft)]">No pending advances.</div>
            ) : (
              proformaAdvance.data?.map(item => (
                <div key={item.id} className="p-[13px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="flex justify-between items-start mb-[8px] gap-[10px]">
                    <div>
                      <div className="text-[13px] font-semibold text-[var(--ink)]">{item.client}</div>
                      <div className="text-[11.5px] text-[var(--ink-faint)] mt-[1px]">{item.context} | {item.poDate}</div>
                    </div>
                    <div className="font-mono text-[10px] font-semibold text-[var(--warn)] bg-[var(--warn-soft)] p-[3px_8px] rounded-[20px] shrink-0 whitespace-nowrap">
                      {item.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-[10px] mb-[6px]">
                    <ProgressBar 
                      progress={item.receivedPct} 
                      colorClass="bg-[var(--info)]"
                      heightClass="h-[7px]"
                      className="flex-1"
                    />
                    <div className="font-mono text-[11px] font-semibold text-[var(--ink-soft)] shrink-0 w-[70px] text-right">
                      {item.terms}
                    </div>
                  </div>
                  <div className="flex justify-between text-[11px] text-[var(--ink-faint)]">
                    <span>Days since PO: {item.daysSincePO}</span>
                    <span className="font-mono font-semibold text-[var(--warn)] text-[12px]">{formatCurrency(item.pendingAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Due Today / Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px] mb-[14px]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden lg:col-span-2 flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] bg-white flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Due Today / Upcoming (7 Days)
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{dueToday.data?.length || 0}</span>
          </div>
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2">
            {dueToday.isLoading ? (
              <div className="col-span-2 p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              dueToday.data?.map(item => (
                <div key={item.id} className="flex items-center gap-[11px] p-[10px_16px] border-b border-r border-[var(--surface-alt)]">
                  <IconChip 
                    icon={<Activity />} 
                    type={item.isUpcoming ? 'info' : 'alert'} 
                    size="md" 
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{item.description}</div>
                    <div className="text-[11px] text-[var(--ink-faint)] mt-[1px]">{item.subLabel}</div>
                  </div>
                  <div className="font-mono font-semibold text-[12.5px] shrink-0 text-[var(--ink)]">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Payables / Receivables Accordions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] bg-white flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Payables
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{payables.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {payables.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              payables.data?.map(item => <AccordionRow key={item.id} item={item} />)
            )}
          </div>
        </div>
        
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] bg-white flex items-center justify-between">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Receivables
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{receivables.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {receivables.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              receivables.data?.map(item => <AccordionRow key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
