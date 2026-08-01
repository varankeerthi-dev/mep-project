import React from 'react';
import { Activity, Clock, Truck } from 'lucide-react';
import { useLiveNow } from '../api/useOperationsQueries';
import { ProgressBar } from './shared/ProgressBar';
import { StatusBadge } from './shared/StatusBadge';
import { IconChip } from './shared/IconChip';

const emptyMessages = [
  'All done bro! ✨',
  'Nothin\' to see here! 😎',
  'Chill mode activated 🚀',
  'Nada, zilch, zero! 🎯',
];

export const LiveNowZone: React.FC = () => {
  const { siteCheckIns, manufacturingWIP, dispatch } = useLiveNow();
  const emptyMsg = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[18px]" style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Live Operations
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Site Check-ins */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white">
            <IconChip icon={<Activity />} type="info" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Site check-ins</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{siteCheckIns.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {siteCheckIns.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : siteCheckIns.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              siteCheckIns.data?.map(item => (
                <div key={item.id} className="flex items-center gap-3 p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="w-[34px] h-[34px] rounded-[10px] bg-[var(--brand-soft)] text-[var(--brand-dark)] flex items-center justify-center font-semibold text-[13px] shrink-0">
                    {item.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate">{item.name}</div>
                    <div className="text-[13px] font-medium text-[var(--ink-soft)] truncate">{item.location}</div>
                  </div>
                  <span className="text-[12px] text-[var(--ink-faint)] shrink-0">{item.time}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Manufacturing WIP */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white">
            <IconChip icon={<Clock />} type="warn" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Manufacturing WIP</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{manufacturingWIP.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {manufacturingWIP.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : manufacturingWIP.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              manufacturingWIP.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex justify-between mb-2">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate pr-2">{item.name}</div>
                    <div className={`text-[12px] font-semibold ${item.status === 'behind' ? 'text-[var(--warn)]' : 'text-[var(--brand-dark)]'}`}>
                      {item.progress}%
                    </div>
                  </div>
                  <ProgressBar 
                    progress={item.progress} 
                    colorClass={item.status === 'behind' ? 'bg-[var(--warn)]' : 'bg-[var(--brand)]'} 
                  />
                  <div className="text-[12px] text-[var(--ink-faint)] mt-1">{item.meta}</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Dispatch in transit */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white">
            <IconChip icon={<Truck />} type="brand" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Dispatch in transit</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{dispatch.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {dispatch.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : dispatch.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              dispatch.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0 flex justify-between items-center">
                  <div>
                    <div className="text-[14px] font-semibold text-[var(--ink)]">{item.dispatchId}</div>
                    <div className="text-[13px] font-medium text-[var(--ink-soft)] mt-1">{item.destination}</div>
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
