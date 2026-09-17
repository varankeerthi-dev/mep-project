import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type FollowupSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

export function FollowupSearch({
  value,
  onChange,
  placeholder = 'Search...',
  className,
}: FollowupSearchProps) {
  return (
    <div className={cn('relative w-36 sm:w-40 shrink-0', className)}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[30px] w-full rounded-lg border border-slate-200 bg-white pl-3 pr-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition shadow-2xs"
      />
      {!value && (
        <kbd className="absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-[9px] text-slate-400 font-mono border border-slate-200 px-1 py-0.5 rounded bg-slate-50">
          ⌘K
        </kbd>
      )}
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
