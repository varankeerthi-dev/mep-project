import React from 'react';
import { Activity, Clock, Truck } from 'lucide-react';
import { useLiveNow } from '../api/useOperationsQueries';
import { IconChip } from './shared/IconChip';
import { ProgressBar } from './shared/ProgressBar';
import { StatusBadge } from './shared/StatusBadge';

export const LiveNowZone: React.FC = () => {
  const { siteCheckIns, manufacturingWIP, dispatch } = useLiveNow();

  return (
    <section className="mb-[36px]">
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[15px] font-semibold tracking-[0.3px] uppercase text-[var(--ink)]">
            Live Now
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-[14px]">
        {/* Site Check-ins */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)] flex items-center gap-[8px]">
              <IconChip icon={<Activity />} type="info" />
              Site check-ins
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{siteCheckIns.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {siteCheckIns.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              siteCheckIns.data?.map(item => (
                <div key={item.id} className="flex items-center gap-[10px] p-[9px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="w-[26px] h-[26px] rounded-full bg-[var(--brand-soft)] text-[var(--brand-dark)] flex items-center justify-center font-display font-semibold text-[11px] shrink-0">
                    {item.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{item.name}</div>
                    <div className="text-[11px] text-[var(--ink-faint)] truncate">{item.location}</div>
                  </div>
                  <div className="font-mono text-[10.5px] text-[var(--ink-faint)] shrink-0 flex items-center gap-2">
                    <span className="w-[6px] h-[6px] rounded-full bg-[var(--brand)] shrink-0 animate-[operations-pulse_1.8s_ease-in-out_infinite]" />
                    {item.time}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Manufacturing WIP */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)] flex items-center gap-[8px]">
              <IconChip icon={<Clock />} type="warn" />
              Manufacturing WIP
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{manufacturingWIP.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {manufacturingWIP.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              manufacturingWIP.data?.map(item => (
                <div key={item.id} className="p-[9px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="flex justify-between mb-[5px]">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate pr-2">{item.name}</div>
                    <div className={`font-mono text-[11px] font-semibold ${item.status === 'behind' ? 'text-[var(--warn)]' : 'text-[var(--brand-dark)]'}`}>
                      {item.progress}%
                    </div>
                  </div>
                  <ProgressBar 
                    progress={item.progress} 
                    colorClass={item.status === 'behind' ? 'bg-[var(--warn)]' : 'bg-[var(--brand)]'} 
                  />
                  <div className="text-[10.5px] text-[var(--ink-faint)] mt-[4px]">{item.meta}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dispatch in transit */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)] flex items-center gap-[8px]">
              <IconChip icon={<Truck />} type="brand" />
              Dispatch in transit
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{dispatch.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {dispatch.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              dispatch.data?.map(item => (
                <div key={item.id} className="p-[9px_16px] border-b border-[var(--surface-alt)] last:border-b-0 flex justify-between items-center">
                  <div>
                    <div className="font-mono text-[11px] font-semibold text-[var(--ink)]">{item.dispatchId}</div>
                    <div className="text-[11.5px] text-[var(--ink-soft)] mt-[2px]">{item.destination}</div>
                  </div>
                  <StatusBadge type={item.badgeType} label={item.timeBadge} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
