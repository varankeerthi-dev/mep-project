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
  placeholder = 'Search client, project, reference…',
  className,
}: FollowupSearchProps) {
  return (
    <div className={cn('relative min-w-[250px] flex-1', className)}>
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-5 pr-8 text-sm leading-[25px] text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
          aria-label="Clear search"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
