import React from 'react';
import { Calendar, Power } from 'lucide-react';
import { 
  useProjectActivity, 
  useUpcomingPlanningShutdown 
} from '../api/useOperationsQueries';
import { ProgressBar } from './shared/ProgressBar';
import { IconChip } from './shared/IconChip';

export const ProjectsZone: React.FC = () => {
  const activity = useProjectActivity();
  const events = useUpcomingPlanningShutdown();

  return (
    <section className="mb-[36px]">
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[15px] font-semibold tracking-[0.3px] uppercase text-[var(--ink)]">
            Projects
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-[14px]">
        {/* Ongoing project activity */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Ongoing Project Activity
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{activity.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {activity.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              activity.data?.map(item => (
                <div key={item.id} className="p-[9px_16px] border-b border-[var(--surface-alt)] last:border-b-0">
                  <div className="flex justify-between mb-[5px]">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate pr-2">{item.name}</div>
                    <div className="font-mono text-[11px] text-[var(--brand-dark)] font-semibold">
                      {item.progress}%
                    </div>
                  </div>
                  <ProgressBar 
                    progress={item.progress} 
                    colorClass={!item.manager ? 'bg-[var(--warn)]' : 'bg-[var(--brand)]'} 
                  />
                  <div className="text-[10.5px] text-[var(--ink-faint)] mt-[4px] flex justify-between">
                    <span>Mgr: {item.manager || 'Unassigned'}</span>
                    <span>Next: {item.nextMilestone} ({item.date})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming planning & shutdown */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius)] shadow-[var(--shadow)] overflow-hidden flex flex-col">
          <div className="p-[12px_16px] border-b border-[var(--border)] flex items-center justify-between bg-white">
            <h3 className="text-[12.5px] font-semibold uppercase tracking-[0.4px] text-[var(--ink-soft)]">
              Upcoming Planning &amp; Shutdown
            </h3>
            <span className="font-mono text-[12px] text-[var(--ink-faint)]">{events.data?.length || 0}</span>
          </div>
          <div className="p-4 flex-1">
            {events.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : (
              events.data?.map(item => (
                <div key={item.id} className="p-[10px_16px] border-b border-[var(--surface-alt)] last:border-b-0 flex items-center gap-[10px]">
                  <IconChip 
                    icon={item.type === 'planning' ? <Calendar /> : <Power />} 
                    type={item.type === 'planning' ? 'info' : 'warn'} 
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-[12.5px] font-medium text-[var(--ink)] truncate">{item.title}</div>
                    <div className="text-[11px] text-[var(--ink-faint)] mt-[1px] truncate">{item.context}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
