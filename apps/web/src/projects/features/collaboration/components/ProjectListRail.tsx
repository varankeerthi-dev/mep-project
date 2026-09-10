// ProjectListRail.tsx — left rail for the collaboration workspace.
// Lists all projects in the user's org (RLS-scoped). Click to open in the
// multi-pane area (or focus an already-open pane).
import { useState } from 'react';
import { Hash, Loader2, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { useCollabStore } from '../store';

interface PickerRow {
  id: string;
  project_name: string | null;
  name: string | null;
  status: string | null;
}

interface Props {
  organisationId: string;
  selectedProjectId: string | null;
  onSelect: (id: string, name: string) => void;
}

export function ProjectListRail({ organisationId, selectedProjectId, onSelect }: Props) {
  const openProject = useCollabStore((s) => s.openProject);
  const openProjectIds = useCollabStore((s) => s.openProjectIds);
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['collab', 'rail', 'projects', organisationId],
    queryFn: async (): Promise<PickerRow[]> => {
      if (!organisationId) return [];
      const { data: rows } = await supabase
        .from('projects')
        .select('id, project_name, name, status')
        .eq('organisation_id', organisationId)
        .order('project_name');
      return (rows ?? []) as PickerRow[];
    },
    enabled: !!organisationId,
    staleTime: 60 * 1000,
  });

  const filtered = (data ?? []).filter((p) =>
    (p.project_name ?? p.name ?? '').toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <aside
      className="w-64 shrink-0 border-r bg-gray-50 flex flex-col h-full"
      data-testid="collab-project-rail"
    >
      <div className="p-3 border-b bg-white">
        <div className="flex items-center gap-2 mb-2">
          <Hash className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold">Projects</h2>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full text-sm border rounded pl-7 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
            data-testid="collab-rail-search"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-500 p-3 text-center">
            {data && data.length === 0 ? 'No projects in this organisation yet.' : 'No matches.'}
          </div>
        ) : (
          <ul className="py-1">
            {filtered.map((p) => {
              const label = p.project_name ?? p.name ?? 'Untitled';
              const isOpen = openProjectIds.includes(p.id);
              const isActive = selectedProjectId === p.id;
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => {
                      openProject(p.id);
                      onSelect(p.id, label);
                    }}
                    className={`w-full text-left px-3 py-2 text-sm flex flex-col gap-0.5 hover:bg-gray-100 ${
                      isActive
                        ? 'bg-blue-50 text-blue-700 border-l-2 border-blue-600'
                        : isOpen
                          ? 'bg-gray-100 text-gray-900 border-l-2 border-gray-300'
                          : 'text-gray-800'
                    }`}
                    data-testid="collab-rail-item"
                    data-active={isActive ? 'true' : 'false'}
                    data-open={isOpen ? 'true' : 'false'}
                  >
                    <span className="font-medium truncate">{label}</span>
                    {p.status && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500">{p.status}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </aside>
  );
}
