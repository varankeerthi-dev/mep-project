// ProjectListRail.tsx — tier-2 contextual sidebar for the collaboration workspace.
// Dark channel tree: company channels + projects, with the workspace switcher on top
// and the signed-in user's card pinned to the bottom.
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  Folder,
  Loader2,
  Lock,
  Plus,
  Search,
  Settings,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { useAuth } from '../../../../contexts/AuthContext';
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

/** Project status → sidebar badge (ACTIVE green, everything else amber). */
function StatusBadge({ status }: { status: string | null }) {
  if (!status) return null;
  const normalized = status.toLowerCase();
  const isActive = normalized === 'active' || normalized === 'in_progress' || normalized === 'ongoing';
  return (
    <span
      className={`text-[9px] font-semibold tracking-wider uppercase shrink-0 ${
        isActive ? 'text-emerald-400' : 'text-amber-400'
      }`}
    >
      {normalized.replace(/_/g, ' ')}
    </span>
  );
}

export function ProjectListRail({
  organisationId,
  selectedProjectId,
  onSelect,
  isCompanyActive = false,
  onSelectCompany,
}: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();

  const openProject = useCollabStore((s) => s.openProject);
  const openProjectIds = useCollabStore((s) => s.openProjectIds);
  const openCompanyChannel = useCollabStore((s) => s.openCompanyChannel);
  const isCompanyChannelOpen = useCollabStore((s) => s.isCompanyChannelOpen);
  const activeCompanyChannelName = useCollabStore((s) => s.activeCompanyChannelName);

  // Auto-resolve / create the org's primary #general channel
  const { data: generalChannel } = useCompanyChannel(organisationId, 'general');
  const { data: fetchedChannels } = useCompanyChannels(organisationId);

  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [channelsExpanded, setChannelsExpanded] = useState(true);
  const [projectsExpanded, setProjectsExpanded] = useState(true);

  const displayName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'You';
  const avatarUrl: string | null = user?.user_metadata?.avatar_url ?? null;
  const initials = displayName
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

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
      className="w-60 shrink-0 bg-collab-sidebar border-r border-collab-line flex flex-col justify-between text-collab-muted text-[13px] select-none collab-scroll-dark overflow-y-auto"
      data-testid="collab-project-rail"
    >
      <div className="flex flex-col">
        {/* Section: company channels — the organisation identity lives in the app's
            own sticky header, so this sidebar starts straight at the channel tree. */}
        <div className="mt-2 px-2">
          <div className="flex items-center justify-between px-2 py-1 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setChannelsExpanded((v) => !v)}
              className="flex items-center gap-1 hover:text-slate-200"
              aria-expanded={channelsExpanded}
            >
              <ChevronDown
                className={`h-2.5 w-2.5 transition-transform ${channelsExpanded ? '' : '-rotate-90'}`}
              />
              <span>Channels</span>
            </button>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="p-0.5 hover:text-white rounded"
              title="Create channel"
              aria-label="Create channel"
              data-testid="collab-create-channel-btn"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {channelsExpanded && (
            <nav
              className="mt-1 space-y-0.5"
              data-testid="collab-company-channel-list"
              aria-label="Company channels"
            >
              {companyChannels.length === 0 && (
                <p className="px-2 py-1 text-[11px] text-slate-500">Loading channels…</p>
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
                    className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-1.5 transition ${
                      isActive
                        ? 'bg-collab-active text-white font-medium shadow-sm'
                        : isOpen
                        ? 'bg-collab-hover text-slate-100'
                        : 'text-slate-300 hover:bg-collab-hover hover:text-white'
                    }`}
                    data-testid={`collab-company-channel-${ch.id}`}
                    data-channel-name={ch.name}
                    data-active={isActive ? 'true' : 'false'}
                    title={ch.description ?? `#${ch.name}`}
                  >
                    <span className="flex items-center gap-1.5 min-w-0">
                      {isPrivate ? (
                        <Lock
                          className={`h-3 w-3 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}
                        />
                      ) : (
                        <span
                          className={`shrink-0 font-medium ${
                            isActive ? 'text-white' : 'text-slate-400'
                          }`}
                        >
                          #
                        </span>
                      )}
                      <span className="truncate">{ch.name}</span>
                    </span>
                    {isGeneral ? (
                      <span className="text-[10px] px-1.5 py-px bg-blue-500/20 text-blue-400 rounded border border-blue-500/30 shrink-0">
                        Org
                      </span>
                    ) : isPrivate ? (
                      <span className="text-[9px] px-1 bg-slate-800 text-slate-400 rounded shrink-0">
                        Private
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </nav>
          )}
        </div>

        {/* Section: projects */}
        <div className="mt-4 px-2 pb-2">
          <div className="flex items-center justify-between px-2 py-1 text-slate-400 text-xs font-semibold uppercase tracking-wider">
            <button
              type="button"
              onClick={() => setProjectsExpanded((v) => !v)}
              className="flex items-center gap-1 hover:text-slate-200"
              aria-expanded={projectsExpanded}
            >
              <ChevronDown
                className={`h-2.5 w-2.5 transition-transform ${projectsExpanded ? '' : '-rotate-90'}`}
              />
              <span>Projects</span>
            </button>
            <button
              type="button"
              onClick={() => navigate('/projects')}
              className="p-0.5 hover:text-white rounded"
              title="All projects"
              aria-label="All projects"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          {projectsExpanded && (
            <>
              <div className="px-2 my-1.5">
                <div className="relative flex items-center">
                  <Search
                    className="h-3 w-3 text-slate-500 absolute left-2 pointer-events-none"
                    aria-hidden="true"
                  />
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search projects…"
                    className="w-full bg-collab-rail text-xs text-slate-200 placeholder-slate-500 pl-6 pr-2 py-1 rounded border border-collab-line focus:border-slate-500 focus:outline-none"
                    data-testid="collab-rail-search"
                    aria-label="Search projects"
                  />
                </div>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-6 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : data && data.length === 0 ? (
                <div className="text-center px-4 py-6" data-testid="collab-no-projects-notice">
                  <div className="w-9 h-9 rounded-full bg-blue-500/15 text-blue-400 flex items-center justify-center mx-auto mb-2">
                    <Folder className="h-4 w-4" />
                  </div>
                  <p className="text-xs font-semibold text-slate-300">No projects yet</p>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    You can still chat in company channels and create tasks.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-xs text-slate-500 p-3 text-center">No matches.</div>
              ) : (
                <nav className="space-y-0.5" aria-label="Project channels">
                  {filtered.map((p) => {
                    const label = p.project_name ?? p.name ?? 'Untitled';
                    const isOpen = openProjectIds.includes(p.id);
                    const isActive = !isCompanyActive && selectedProjectId === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          openProject(p.id);
                          onSelect(p.id, label);
                        }}
                        className={`w-full text-left px-2 py-1 rounded flex items-center justify-between gap-1.5 transition ${
                          isActive
                            ? 'bg-collab-active text-white font-medium shadow-sm'
                            : isOpen
                            ? 'bg-collab-hover text-slate-100'
                            : 'text-slate-300 hover:bg-collab-hover hover:text-white'
                        }`}
                        data-testid="collab-rail-item"
                        data-active={isActive ? 'true' : 'false'}
                        data-open={isOpen ? 'true' : 'false'}
                        title={label}
                      >
                        <span className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={`shrink-0 font-medium ${
                              isActive ? 'text-white' : 'text-slate-400'
                            }`}
                          >
                            #
                          </span>
                          <span className="truncate">{label}</span>
                        </span>
                        <StatusBadge status={p.status} />
                      </button>
                    );
                  })}
                </nav>
              )}
            </>
          )}
        </div>
      </div>

      {/* Signed-in user card */}
      <div className="p-2.5 bg-[#17181c] border-t border-collab-line flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="relative shrink-0">
            <span className="w-7 h-7 rounded-full overflow-hidden border border-blue-600 flex items-center justify-center bg-slate-800 text-[10px] font-semibold text-slate-200">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                initials || '·'
              )}
            </span>
            <span
              className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full ring-2 ring-[#17181c]"
              aria-hidden="true"
            />
          </span>
          <div className="min-w-0">
            <div className="text-xs font-semibold text-white leading-tight truncate">
              {displayName}
            </div>
            <div className="text-[10px] text-slate-400 leading-none">Available</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings-v2')}
          className="text-slate-400 hover:text-white p-1 shrink-0"
          title="Preferences"
          aria-label="Preferences"
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      {createOpen && (
        <CreateChannelDialog
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          existingChannelNames={companyChannels.map((c) => c.name)}
          onCreated={(channel) => handleCompanyClick(channel.name)}
        />
      )}
    </aside>
  );
}
