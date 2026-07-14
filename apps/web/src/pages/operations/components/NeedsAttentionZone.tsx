import React from 'react';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import { useNeedsAttention } from '../api/useOperationsQueries';
import { LinkOut } from './shared/LinkOut';
import { formatCurrency } from '../utils';

export const NeedsAttentionZone: React.FC = () => {
  const { data: items, isLoading } = useNeedsAttention();

  return (
    <section className="mb-[36px]">
      <div className="flex items-baseline justify-between mb-[14px]">
        <div className="flex items-center gap-[10px]">
          <h2 className="font-display text-[15px] font-semibold tracking-[0.3px] uppercase text-[var(--ink)]">
            Needs Attention
          </h2>
          <span className="font-mono text-[12px] text-[var(--ink-faint)] bg-[var(--surface-alt)] px-2 py-[2px] rounded-[20px]">
            {items?.length || 0}
          </span>
        </div>
      </div>

      <div className="flex gap-[12px] overflow-x-auto pb-[6px] scrollbar-thin">
        {isLoading ? (
          <div className="flex gap-[12px]">
            <div className="flex-none w-[264px] h-[140px] bg-[var(--surface-alt)] animate-pulse rounded-[var(--radius)]"></div>
            <div className="flex-none w-[264px] h-[140px] bg-[var(--surface-alt)] animate-pulse rounded-[var(--radius)]"></div>
            <div className="flex-none w-[264px] h-[140px] bg-[var(--surface-alt)] animate-pulse rounded-[var(--radius)]"></div>
          </div>
        ) : items?.length === 0 ? (
          <div className="text-[14px] text-[var(--ink-soft)]">No immediate items need attention.</div>
        ) : (
          items?.map(item => (
            <div 
              key={item.id} 
              className="flex-none w-[264px] bg-[var(--surface)] rounded-[var(--radius)] border border-[var(--border)] p-[14px_16px] shadow-[var(--shadow)]"
            >
              <div 
                className={`font-mono text-[10px] font-semibold tracking-[0.5px] uppercase mb-[6px] flex items-center gap-[5px] ${
                  item.type === 'alert' ? 'text-[var(--alert)]' : 'text-[var(--warn)]'
                }`}
              >
                {item.type === 'alert' ? <AlertCircle size={12} /> : <AlertTriangle size={12} />}
                {item.tagLabel}
              </div>
              <h3 className="text-[13.5px] font-semibold mb-[4px] leading-[1.3] text-[var(--ink)]">
                {item.title}
              </h3>
              <p className="text-[12px] text-[var(--ink-soft)] mb-[10px]">
                {item.context}
              </p>
              
              <div className="flex items-center justify-between">
                <div className="font-mono font-semibold text-[13px] text-[var(--ink)]">
                  {formatCurrency(item.amount)}
                </div>
                <div className={`text-[11px] font-medium ${item.type === 'alert' ? 'text-[var(--alert)]' : 'text-[var(--warn)]'}`}>
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
