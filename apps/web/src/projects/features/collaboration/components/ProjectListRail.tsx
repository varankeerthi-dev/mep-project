// ProjectListRail.tsx — left rail for the collaboration workspace.
// Lists company channels (including #general) and all projects in the user's org.
import { useMemo, useState } from 'react';
import { Hash, Loader2, Search, Building2, Folder, Lock, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { useCollabStore } from '../store';
import { useCompanyChannel, useCompanyChannels } from '../hooks';
import { CreateChannelDialog } from './CreateChannelDialog';
import { normalizeChannelName } from '../schemas';
import type { Channel } from '../types';

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
  isCompanyActive?: boolean;
  onSelectCompany?: (name?: string) => void;
}

export function ProjectListRail({
  organisationId,
  selectedProjectId,
  onSelect,
  isCompanyActive = false,
  onSelectCompany,
}: Props) {
  const openProject = useCollabStore((s) => s.openProject);
  const openProjectIds = useCollabStore((s) => s.openProjectIds);
  const openCompanyChannel = useCollabStore((s) => s.openCompanyChannel);
  const isCompanyChannelOpen = useCollabStore((s) => s.isCompanyChannelOpen);
  const activeCompanyChannelName = useCollabStore((s) => s.activeCompanyChannelName);

  // Auto-resolve / create org's primary #general channel
  const { data: generalChannel } = useCompanyChannel(organisationId, 'general');
  const { data: fetchedChannels } = useCompanyChannels(organisationId);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  // #general is always listed first; the rest alphabetically. RLS already hides
  // private channels the user is not a member of, so whatever arrives is
  // legitimately visible.
  const companyChannels = useMemo(() => {
    const list: Channel[] = [...(fetchedChannels ?? [])];
    if (generalChannel && !list.some((c) => c.id === generalChannel.id)) {
      list.unshift(generalChannel);
    }
    return list.sort((a, b) => {
      const aGeneral = a.channel_type === 'general' ? 0 : 1;
      const bGeneral = b.channel_type === 'general' ? 0 : 1;
      if (aGeneral !== bGeneral) return aGeneral - bGeneral;
      return a.name.localeCompare(b.name);
    });
  }, [fetchedChannels, generalChannel]);
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

  const handleCompanyClick = (name: string) => {
    openCompanyChannel(name);
    onSelectCompany?.(name);
  };

  return (
    <aside
      className="w-64 shrink-0 border-r bg-gray-50 flex flex-col h-full"
      data-testid="collab-project-rail"
    >
      {/* 1. Company Channels Section */}
      <div className="p-3 border-b bg-white">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Building2 className="h-3.5 w-3.5 text-blue-600" />
            <span>Company</span>
          </div>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="p-1 text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded transition"
            aria-label="Create channel"
            title="Create channel"
            data-testid="collab-create-channel-btn"
          >
            <Plus className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="space-y-0.5 max-h-64 overflow-y-auto" data-testid="collab-company-channel-list">
          {companyChannels.length === 0 && (
            <p className="px-2 py-1 text-[11px] text-gray-400">Loading channels…</p>
          )}
          {companyChannels.map((ch) => {
            const isGeneral = ch.channel_type === 'general';
            const isPrivate = ch.visibility === 'private';
            const isSelected =
              normalizeChannelName(activeCompanyChannelName || 'general') ===
              normalizeChannelName(ch.name);
            const isActive = isCompanyActive && isSelected;
            const isOpen = isCompanyChannelOpen && isSelected && !isActive;
            return (
              <button
                key={ch.id}
                type="button"
                onClick={() => handleCompanyClick(ch.name)}
                className={`w-full text-left px-2.5 py-2 text-sm flex items-center justify-between rounded-md transition ${
                  isActive
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : isOpen
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-700 hover:bg-gray-100'
                }`}
                data-testid={`collab-company-channel-${ch.id}`}
                data-channel-name={ch.name}
                data-active={isActive ? 'true' : 'false'}
                title={ch.description ?? `#${ch.name}`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  {isPrivate ? (
                    <Lock
                      className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                  ) : (
                    <Hash
                      className={`h-4 w-4 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`}
                    />
                  )}
                  <span className="truncate">{ch.name}</span>
                </div>
                {isGeneral ? (
                  <span className="text-[10px] bg-blue-100/60 text-blue-700 px-1.5 py-0.5 rounded font-medium shrink-0">
                    Org
                  </span>
                ) : isPrivate ? (
                  <span className="text-[10px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium shrink-0">
                    Private
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>

      {createOpen && (
        <CreateChannelDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          existingChannelNames={companyChannels.map((c) => c.name)}
          onCreated={(channel) => handleCompanyClick(channel.name)}
        />
      )}

      {/* 2. Projects Section */}
      <div className="p-3 border-b bg-white">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          <Folder className="h-3.5 w-3.5 text-gray-500" />
          <span>Projects</span>
        </div>
        <div className="relative">
          <Search className="h-3.5 w-3.5 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="w-full text-sm border rounded pl-7 pr-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
            data-testid="collab-rail-search"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        ) : data && data.length === 0 ? (
          <div className="text-center px-4 py-8" data-testid="collab-no-projects-notice">
            <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-2.5">
              <Building2 className="h-5 w-5" />
            </div>
            <p className="text-xs font-semibold text-gray-700">No projects yet</p>
            <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
              You can still chat in company channels and create tasks.
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-400 p-3 text-center">No matches.</div>
        ) : (
          <ul className="py-1">
            {filtered.map((p) => {
              const label = p.project_name ?? p.name ?? 'Untitled';
              const isOpen = openProjectIds.includes(p.id);
              const isActive = !isCompanyActive && selectedProjectId === p.id;
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
                        ? 'bg-blue-50 text-blue-700'
                        : isOpen
                        ? 'bg-gray-100 text-gray-900'
                        : 'text-gray-800'
                    }`}
                    data-testid="collab-rail-item"
                    data-active={isActive ? 'true' : 'false'}
                    data-open={isOpen ? 'true' : 'false'}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <Hash className={`h-3.5 w-3.5 shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-400'}`} />
                      <span className="font-medium truncate">{label}</span>
                    </div>
                    {p.status && (
                      <span className="text-[10px] uppercase tracking-wide text-gray-500 pl-5">{p.status}</span>
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
