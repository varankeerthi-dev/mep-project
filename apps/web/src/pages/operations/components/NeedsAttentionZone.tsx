import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useNeedsAttention } from '../api/useOperationsQueries';
import { LinkOut } from './shared/LinkOut';
import { formatCurrency } from '../utils';

const emptyMessages = [
  'All done bro! ✨',
  'Chill mode activated 😎',
  'Smooth sailin\' ahead 🏄',
  'Zero drama zone 🙌',
];

export const NeedsAttentionZone: React.FC = () => {
  const { data: items, isLoading } = useNeedsAttention();
  const emptyMsg = emptyMessages[Math.floor(Math.random() * emptyMessages.length)];

  return (
    <section>
      <div className="flex items-baseline justify-between mb-5">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[18px]" style={{ fontWeight: 650, letterSpacing: '-0.01em', color: 'var(--ink)' }}>
            Needs Attention
          </h2>
          <span className="text-[12px] text-[var(--ink-faint)] bg-[var(--surface-alt)] px-2 py-[2px] rounded-[999px]">
            {items?.length || 0}
          </span>
        </div>
      </div>

      <div className="flex gap-5 overflow-x-auto pb-[6px] scrollbar-thin">
        {isLoading ? (
          <div className="flex gap-5">
            <div className="flex-none w-[320px] h-[180px] bg-[var(--surface-alt)] animate-pulse rounded-[var(--radius-lg)]"></div>
            <div className="flex-none w-[320px] h-[180px] bg-[var(--surface-alt)] animate-pulse rounded-[var(--radius-lg)]"></div>
          </div>
        ) : items?.length === 0 ? (
          <div className="flex items-center justify-center w-full h-[120px] bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] ops-card">
            <span className="text-[15px] font-medium text-[var(--ink-soft)]">{emptyMsg}</span>
          </div>
        ) : (
          items?.map(item => (
            <div 
              key={item.id} 
              className="flex-none w-[320px] h-[180px] bg-[var(--surface)] rounded-[var(--radius-lg)] border border-[var(--border)] p-5 ops-card flex flex-col"
            >
              <div className="flex items-center gap-2 mb-2">
                {item.type === 'alert'
                  ? <AlertCircle size={18} className="text-[var(--alert)] shrink-0" />
                  : <AlertTriangle size={18} className="text-[var(--warn)] shrink-0" />
                }
                <span className={`text-[10px] font-semibold tracking-[0.5px] uppercase ${
                  item.type === 'alert' ? 'text-[var(--alert)]' : 'text-[var(--warn)]'
                }`}>
                  {item.tagLabel}
                </span>
              </div>
              <h3 className="text-[15px] font-semibold mb-1 leading-[1.3] text-[var(--ink)]">
                {item.title}
              </h3>
              <p className="text-[13px] font-medium text-[var(--ink-soft)] mb-auto">
                {item.context}
              </p>
              
              <div className="flex items-center justify-between mt-auto pt-2">
                <div className="font-semibold text-[14px] text-[var(--ink)]">
                  {formatCurrency(item.amount)}
                </div>
                <div className={`text-[12px] font-medium ${item.type === 'alert' ? 'text-[var(--alert)]' : 'text-[var(--warn)]'}`}>
                  {item.days} {item.days === 1 ? 'day' : 'days'}
                </div>
                <LinkOut to={item.link} label="View" />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
};
