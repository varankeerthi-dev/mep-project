import React from 'react';
import { Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface SettingsSearchBarProps {
  query: string;
  onChange: (query: string) => void;
  placeholder?: string;
}

export const SettingsSearchBar: React.FC<SettingsSearchBarProps> = ({
  query,
  onChange,
  placeholder = 'Search settings (e.g., "GST", "prefix", "round off", "approval")...',
}) => {
  return (
    <div className="relative w-full max-w-md">
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400 pointer-events-none" />
      <input
        type="text"
        value={query}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-9 pr-8 py-1.5 bg-zinc-100/80 hover:bg-zinc-100 focus:bg-white border border-zinc-200 rounded-lg text-xs text-zinc-900 placeholder:text-zinc-400 outline-none transition-all focus:border-[#185FA5] focus:ring-2 focus:ring-[#185FA5]/20"
        style={{ fontSize: '12px' }}
      />
      {query && (
        <Button variant="ghost" size="default" type="button" onClick={() => onChange('')}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-zinc-400 hover:text-zinc-600 hover:bg-zinc-200/60 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </Button>
      )}
    </div>
  );
};
