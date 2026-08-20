import { memo, useMemo, useState } from 'react';
import { FileSearch, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSearchMeetingText } from '../hooks/useMeetings';
import type { MeetingSearchFilters } from '../types';

interface MeetingSearchPanelProps {
  projectId?: string;
  clientId?: string;
}

export const MeetingSearchPanel = memo(function MeetingSearchPanel({ projectId, clientId }: MeetingSearchPanelProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const filters = useMemo<MeetingSearchFilters>(() => ({
    query,
    projectId,
    clientId,
    includeDrafts: false,
    limit: 20,
  }), [query, projectId, clientId]);
  const { data: results = [], isFetching, error } = useSearchMeetingText(filters);

  return (
    <div className="card mb-6 p-5">
      <div className="flex items-start gap-3">
        <FileSearch size={20} className="mt-1 text-indigo-600" />
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold text-slate-900">Search meeting history</h2>
          <p className="mt-1 text-sm text-slate-500">
            Find decisions, discussion topics, action items, clients, projects, and linked work from finalized MOMs.
          </p>
          <div className="relative mt-3">
            <Search size={17} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search what was discussed..."
              className="w-full rounded-lg border border-slate-200 py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              aria-label="Search meeting history"
            />
          </div>

          {query.trim().length >= 2 && (
            <div className="mt-3">
              {isFetching ? (
                <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">Searching meeting history...</div>
              ) : error ? (
                <div className="rounded-lg bg-red-50 px-3 py-4 text-sm text-red-700">Search is temporarily unavailable.</div>
              ) : results.length === 0 ? (
                <div className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">No finalized MOMs match “{query}”.</div>
              ) : (
                <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {results.map((result) => (
                    <button
                      key={result.id}
                      type="button"
                      onClick={() => navigate(`/meetings/${result.meeting_id}/view`)}
                      className="block w-full px-4 py-3 text-left hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <span>{result.meeting_date}</span>
                        <span className="capitalize">{result.meeting_type}</span>
                        {result.client_name && <span>{result.client_name}</span>}
                        {result.project_name && <span>{result.project_name}</span>}
                        <span className="rounded bg-indigo-50 px-2 py-0.5 capitalize text-indigo-700">{result.source_type.replace('_', ' ')}</span>
                      </div>
                      <p className="mt-1 font-medium text-slate-900">{result.source_title || 'Meeting record'}</p>
                      <p className="mt-1 line-clamp-2 text-sm text-slate-600">{result.snippet}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default MeetingSearchPanel;
