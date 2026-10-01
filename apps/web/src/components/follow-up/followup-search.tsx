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
          className="h-[30px] w-full rounded-lg border border-slate-200 bg-white pl-3 pr-10 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-500/60 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition shadow-2xs"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          // 32px box + a 4px pseudo-element bleed on each side = a 40px hit
          // area without inflating the 30px field or its layout.
          className="absolute right-0 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 transition-[transform,color,background-color] duration-150 hover:bg-slate-100 hover:text-slate-700 active:scale-[0.96] after:absolute after:-inset-1 after:content-['']"
          aria-label="Clear search"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
