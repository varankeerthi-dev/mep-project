import { memo } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface KanbanGroupByOption<TKey extends string = string> {
  key: TKey;
  label: string;
}

export interface KanbanGroupBySelectProps<TKey extends string = string> {
  value: TKey;
  onChange: (value: TKey) => void;
  options: KanbanGroupByOption<TKey>[];
  label?: string;
  className?: string;
  disabled?: boolean;
}

/**
 * Reusable Group By Selector Dropdown for Kanban boards.
 * Accessible with native select overlay, styled with unified typography.
 */
export const KanbanGroupBySelect = memo(function KanbanGroupBySelect<TKey extends string = string>({
  value,
  onChange,
  options,
  label = 'Group',
  className,
  disabled = false,
}: KanbanGroupBySelectProps<TKey>) {
  const currentOption = options.find((o) => o.key === value);
  const displayLabel = currentOption ? currentOption.label : value;

  return (
    <div
      className={cn(
        'relative inline-flex items-center gap-1.5 h-[30px] rounded-lg border border-slate-200 bg-white px-2.5 text-xs text-slate-700 shadow-2xs hover:border-slate-300 hover:bg-slate-50 transition cursor-pointer select-none group shrink-0',
        disabled && 'opacity-60 cursor-not-allowed pointer-events-none',
        className
      )}
    >
      <span className="text-slate-400 font-normal">{label}:</span>
      <span className="font-bold text-slate-800 capitalize truncate max-w-[120px]">
        {displayLabel}
      </span>
      <ChevronDown className="h-3.5 w-3.5 text-slate-400 shrink-0 group-hover:text-slate-600 transition-colors ml-0.5" />
      <select
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value as TKey)}
        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
      >
        {options.map((opt) => (
          <option key={opt.key} value={opt.key}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}) as <TKey extends string = string>(props: KanbanGroupBySelectProps<TKey>) => React.ReactElement;
