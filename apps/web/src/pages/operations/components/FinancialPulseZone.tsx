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

const emptyMessages = [
  'All done bro! ✨',
  'Chill mode activated 😎',
  'Smooth sailin\' ahead 🏄',
  'Nada, zilch, zero! 🎯',
  'All clear, captain! 🫡',
];

export const FinancialPulseZone: React.FC = () => {
  const blockingWork = useBlockingWork();
  const proformaAdvance = useProformaAdvancePending();
  const dueToday = useDueToday();
  const payables = usePayablesList();
  const receivables = useReceivablesList();
  const emptyMsg = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[18px]" style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Finance
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Blocking Work */}
        <div className="border border-[var(--alert)] rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow)] overflow-hidden ops-card">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--alert-soft)] flex items-center gap-3">
            <IconChip icon={<AlertTriangle />} type="alert" />
            <h3 className="text-[15px] font-semibold text-[var(--alert)]">Blocking Work</h3>
            <span className="ml-auto text-[12px] text-[var(--alert)]">{blockingWork.data?.length || 0}</span>
          </div>
          <div className="p-5">
            {blockingWork.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : blockingWork.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              blockingWork.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex justify-between items-start mb-2 gap-[10px]">
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--ink)]">{item.project}</div>
                      <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px]">{item.context}</div>
                    </div>
                    <div className="text-[11px] font-semibold text-white bg-[var(--alert)] px-[10px] h-[22px] flex items-center rounded-[999px] shrink-0 whitespace-nowrap">
                      Stopped
                    </div>
                  </div>
                  <div className="flex justify-between text-[12px] text-[var(--ink-soft)] mb-2">
                    <div><span className="text-[var(--ink-faint)] mr-1">Work started:</span> {item.workStarted}</div>
                    <div><span className="text-[var(--ink-faint)] mr-1">Stopped:</span> {item.stoppedSince} ({item.daysStopped}d)</div>
                  </div>
                  <div className="flex justify-between text-[12px] text-[var(--ink-faint)]">
                    <span>Pending amount:</span>
                    <span className="font-semibold text-[var(--alert)] text-[14px]">{formatCurrency(item.pendingAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Proforma / advance pending */}
        <div className="rounded-[var(--radius-lg)] bg-[var(--surface)] shadow-[var(--shadow)] overflow-hidden ops-card">
          <div className="p-4 border-b border-[var(--border)] bg-[var(--warn-soft)] flex items-center gap-3">
            <IconChip icon={<Clock />} type="warn" />
            <h3 className="text-[15px] font-semibold text-[var(--warn)]">Advance Pending</h3>
            <span className="ml-auto text-[12px] text-[var(--warn)]">{proformaAdvance.data?.length || 0}</span>
          </div>
          <div className="p-5">
            {proformaAdvance.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : proformaAdvance.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              proformaAdvance.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex justify-between items-start mb-2 gap-[10px]">
                    <div>
                      <div className="text-[14px] font-semibold text-[var(--ink)]">{item.client}</div>
                      <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px]">{item.context} | {item.poDate}</div>
                    </div>
                    <div className="text-[11px] font-semibold text-[var(--warn)] bg-[var(--warn-soft)] px-[10px] h-[22px] flex items-center rounded-[999px] shrink-0 whitespace-nowrap">
                      {item.status}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mb-2">
                    <ProgressBar 
                      progress={item.receivedPct} 
                      colorClass="bg-[var(--info)]"
                      heightClass="h-[6px]"
                      className="flex-1"
                    />
                    <div className="text-[12px] font-semibold text-[var(--ink-soft)] shrink-0 w-[70px] text-left">
                      {item.terms}
                    </div>
                  </div>
                  <div className="flex justify-between text-[12px] text-[var(--ink-faint)]">
                    <span>Days since PO: {item.daysSincePO}</span>
                    <span className="font-semibold text-[var(--warn)] text-[14px] text-right">{formatCurrency(item.pendingAmount)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Due Today / Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden lg:col-span-2 flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] bg-white flex items-center gap-3">
            <IconChip icon={<Activity />} type="info" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Due Today / Upcoming (7 Days)</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{dueToday.data?.length || 0}</span>
          </div>
          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 text-left">
            {dueToday.isLoading ? (
              <div className="col-span-2 p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : dueToday.data?.length === 0 ? (
              <div className="col-span-2 flex items-center justify-center h-full min-h-[80px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              dueToday.data?.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-4 border-b border-r border-[var(--border)]">
                  <IconChip icon={<Activity />} type={item.isUpcoming ? 'info' : 'alert'} />
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate">{item.description}</div>
                    <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px]">{item.subLabel}</div>
                  </div>
                  <div className="font-semibold text-[14px] shrink-0 text-[var(--ink)]">
                    {formatCurrency(item.amount)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Payables / Receivables Accordions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] bg-white flex items-center gap-3">
            <IconChip icon={<Activity />} type="purple" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Payables</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{payables.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {payables.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : payables.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              payables.data?.map(item => <AccordionRow key={item.id} item={item} />)
            )}
          </div>
        </div>
        
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] bg-white flex items-center gap-3">
            <IconChip icon={<Activity />} type="success" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Receivables</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{receivables.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {receivables.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : receivables.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              receivables.data?.map(item => <AccordionRow key={item.id} item={item} />)
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
