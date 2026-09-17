import { X, Search } from 'lucide-react';
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
  placeholder = 'Search client, project, reference…',
  className,
}: FollowupSearchProps) {
  return (
    <div className={cn('relative w-52 sm:w-60 flex-shrink-0', className)}>
      <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-400 pointer-events-none" />
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-[25px] w-full rounded border border-slate-300 bg-white pl-6.5 pr-8 text-[11px] leading-none text-slate-900 placeholder-slate-400 focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 transition shadow-xs"
      />
      {!value && (
        <kbd className="absolute right-1 top-1/2 -translate-y-1/2 pointer-events-none text-[8.5px] leading-none text-slate-500 font-mono border border-slate-300 px-1 py-0.5 rounded bg-slate-100">
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
