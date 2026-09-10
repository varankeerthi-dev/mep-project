// ChannelHeader.tsx — channel name + filter pills + search entry.
import { Hash, Search } from 'lucide-react';
import { useCollabStore } from '../store';
import type { Channel, CollaborationFilter } from '../types';

const FILTERS: { value: CollaborationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'files', label: 'Files' },
  { value: 'photos', label: 'Photos' },
];

interface Props {
  channel: Channel;
  onSearch: (term: string) => void;
  searchOpen: boolean;
  searchTerm: string;
}

export function ChannelHeader({ channel, onSearch, searchOpen, searchTerm }: Props) {
  const filter = useCollabStore((s) => s.filter);
  const setFilter = useCollabStore((s) => s.setFilter);

  return (
    <div className="border-b bg-white px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <Hash className="h-4 w-4 text-gray-500 shrink-0" />
          <h2 className="font-semibold truncate">{channel.name}</h2>
          {channel.is_archived && (
            <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">Archived — read only</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => onSearch(searchOpen ? '' : ' ')}
          className="text-gray-500 hover:text-gray-800 p-1"
          aria-label="Toggle search"
        >
          <Search className="h-4 w-4" />
        </button>
      </div>
      {searchOpen && (
        <input
          autoFocus
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search messages…"
          className="mt-2 w-full rounded border px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            className={`text-xs px-2.5 py-1 rounded-full border transition ${
              filter === f.value
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}
