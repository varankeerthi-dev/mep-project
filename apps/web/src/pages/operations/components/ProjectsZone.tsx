import React from 'react';
import { Activity, Calendar, Power } from 'lucide-react';
import { 
  useProjectActivity, 
  useUpcomingPlanningShutdown 
} from '../api/useOperationsQueries';
import { IconChip } from './shared/IconChip';
import { ProgressBar } from './shared/ProgressBar';

const emptyMessages = [
  'All done bro! ✨',
  'Catchin\' up on sleep 💤',
  'Zero drama zone 🙌',
  'Smooth sailin\' ahead 🏄',
];

export const ProjectsZone: React.FC = () => {
  const activity = useProjectActivity();
  const events = useUpcomingPlanningShutdown();
  const emptyMsg = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[18px]" style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Projects
          </h2>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Ongoing project activity */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white">
            <IconChip icon={<Activity />} type="brand" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Ongoing Project Activity</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{activity.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {activity.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : activity.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              activity.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0">
                  <div className="flex justify-between mb-2">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate pr-2">{item.name}</div>
                    <div className="text-[12px] text-[var(--brand-dark)] font-semibold">
                      {item.progress}%
                    </div>
                  </div>
                  <ProgressBar 
                    progress={item.progress} 
                    colorClass={!item.manager ? 'bg-[var(--warn)]' : 'bg-[var(--brand)]'} 
                    heightClass="h-[6px]"
                  />
                  <div className="text-[12px] text-[var(--ink-faint)] mt-2 flex justify-between">
                    <span>Mgr: {item.manager || 'Unassigned'}</span>
                    <span>Next: {item.nextMilestone} ({item.date})</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Upcoming planning & shutdown */}
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[var(--radius-lg)] shadow-[var(--shadow)] overflow-hidden flex flex-col ops-card">
          <div className="p-4 border-b border-[var(--border)] flex items-center gap-3 bg-white">
            <IconChip icon={<Calendar />} type="purple" />
            <h3 className="text-[15px] font-semibold text-[var(--ink)]">Upcoming Planning &amp; Shutdown</h3>
            <span className="ml-auto text-[12px] text-[var(--ink-faint)]">{events.data?.length || 0}</span>
          </div>
          <div className="p-5 flex-1">
            {events.isLoading ? (
              <div className="p-4 text-center text-[var(--ink-soft)]">Loading...</div>
            ) : events.data?.length === 0 ? (
              <div className="flex items-center justify-center h-full min-h-[100px] text-[14px] text-[var(--ink-soft)]">{emptyMsg}</div>
            ) : (
              events.data?.map(item => (
                <div key={item.id} className="p-4 border-b border-[var(--border)] last:border-b-0 flex items-center gap-3">
                  <IconChip 
                    icon={item.type === 'planning' ? <Calendar /> : <Power />} 
                    type={item.type === 'planning' ? 'info' : 'warn'} 
                    size="md"
                  />
                  <div className="min-w-0">
                    <div className="text-[14px] font-semibold text-[var(--ink)] truncate">{item.title}</div>
                    <div className="text-[13px] font-medium text-[var(--ink-faint)] mt-[1px] truncate">{item.context}</div>
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


