import { useMemo, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hash, MessageSquare, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { CollabModuleRail } from './CollabModuleRail';
import { ProjectListRail } from './ProjectListRail';
import { ProjectCollaborationTab } from './ProjectCollaborationTab';
import { ThreadRail } from './ThreadRail';
import { useEnsureChannel, useCompanyChannel } from '../hooks';
import { useCollabStore } from '../store';
import type { Channel } from '../types';

interface Props {
  organisationId: string;
}

interface PickerRow {
  id: string;
  project_name: string | null;
  name: string | null;
  status: string | null;
}

export function CollaborationWorkspace({ organisationId }: Props) {
  const [searchParams, setSearchParams] = useSearchParams();
  const projectIdFromUrl = searchParams.get('projectId');
  const projectNameFromUrl = searchParams.get('projectName') ?? '';
  const channelFromUrl = searchParams.get('channel');

  const openProjectIds = useCollabStore((s) => s.openProjectIds);
  const activeProjectId = useCollabStore((s) => s.activeProjectId);
  const isCompanyChannelOpen = useCollabStore((s) => s.isCompanyChannelOpen);
  const activeScope = useCollabStore((s) => s.activeScope);
  const activeCompanyChannelName = useCollabStore((s) => s.activeCompanyChannelName);

  const openProject = useCollabStore((s) => s.openProject);
  const setActiveProject = useCollabStore((s) => s.setActiveProject);
  const closeProject = useCollabStore((s) => s.closeProject);
  const openCompanyChannel = useCollabStore((s) => s.openCompanyChannel);
  const closeCompanyChannel = useCollabStore((s) => s.closeCompanyChannel);
  const setActiveScope = useCollabStore((s) => s.setActiveScope);

  const threadCollapsed = useCollabStore((s) => s.threadCollapsed);
  const toggleThread = useCollabStore((s) => s.toggleThread);

  const lastHandledUrlProjectRef = useRef<string | null>(null);
  const lastClosedProjectRef = useRef<string | null>(null);
  // The "default to #general" fallback is a first-entry convenience only. It must
  // not re-run when search params change, otherwise closing a pane reopens one.
  const didDefaultOpenRef = useRef(false);

  // Auto-resolve the organisation's #general channel (the rail lists all company
  // channels; this guarantees the canonical one exists).
  useCompanyChannel(organisationId, 'general');

  // The company pane / thread rail are bound to whichever company channel is
  // active, which is no longer always #general.
  const { data: activeCompanyChannel } = useCompanyChannel(
    organisationId,
    activeCompanyChannelName || 'general',
  );

  // Sync with URL on mount / route change
  useEffect(() => {
    if (projectIdFromUrl) {
      if (projectIdFromUrl === lastClosedProjectRef.current) {
        return;
      }
      if (projectIdFromUrl !== lastHandledUrlProjectRef.current) {
        lastHandledUrlProjectRef.current = projectIdFromUrl;
        const currentOpen = useCollabStore.getState().openProjectIds;
        if (!currentOpen.includes(projectIdFromUrl)) {
          openProject(projectIdFromUrl);
        }
      }
    } else {
      lastHandledUrlProjectRef.current = null;
      // If no project specified from URL, default to #general company channel —
      // once per mount, so that closing the last pane leaves the workspace closed
      // (it shows the project picker) instead of springing back open.
      if (didDefaultOpenRef.current) return;
      didDefaultOpenRef.current = true;
      const s = useCollabStore.getState();
      if (!s.isCompanyChannelOpen && s.openProjectIds.length === 0) {
        openCompanyChannel(channelFromUrl || 'general');
      }
    }
  }, [projectIdFromUrl, channelFromUrl, openProject, openCompanyChannel]);

  // Map project id → display name for open panes
  const { data: projectRows } = useQuery({
    queryKey: ['collab', 'open-pane-names', organisationId],
    queryFn: async (): Promise<PickerRow[]> => {
      if (!organisationId) return [];
      const { data } = await supabase
        .from('projects')
        .select('id, project_name, name, status')
        .eq('organisation_id', organisationId);
      return (data ?? []) as PickerRow[];
    },
    enabled: !!organisationId,
    staleTime: 60 * 1000,
  });

  const nameById = useMemo(() => {
    const m = new Map<string, string>();
    for (const r of projectRows ?? []) {
      m.set(r.id, r.project_name ?? r.name ?? 'Untitled');
    }
    return m;
  }, [projectRows]);

  const handleSelectProject = (id: string, name: string) => {
    lastClosedProjectRef.current = null;
    openProject(id);
    lastHandledUrlProjectRef.current = id;
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'collaboration');
    next.set('projectId', id);
    if (name) next.set('projectName', name);
    next.delete('channel');
    setSearchParams(next, { replace: true });
  };

  const handleSelectCompany = (name = 'general') => {
    openCompanyChannel(name);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'collaboration');
    next.set('channel', name);
    setSearchParams(next, { replace: true });
  };

  const handleCloseProjectPane = (id: string) => {
    lastClosedProjectRef.current = id;
    const currentOpen = useCollabStore.getState().openProjectIds;
    const currentActive = useCollabStore.getState().activeProjectId;
    const remaining = currentOpen.filter((x) => x !== id);

    closeProject(id);

    const next = new URLSearchParams(searchParams);
    if (remaining.length > 0) {
      const nextActive =
        id === currentActive
          ? remaining[remaining.length - 1]
          : currentActive && remaining.includes(currentActive)
          ? currentActive
          : remaining[remaining.length - 1];

      next.set('projectId', nextActive);
      const nextName = nameById.get(nextActive);
      if (nextName) next.set('projectName', nextName);
      lastHandledUrlProjectRef.current = nextActive;
    } else {
      next.delete('projectId');
      next.delete('projectName');
      lastHandledUrlProjectRef.current = null;
      if (isCompanyChannelOpen) {
        next.set('channel', activeCompanyChannelName || 'general');
      }
    }
    setSearchParams(next, { replace: true });
  };

  const handleCloseCompanyPane = () => {
    closeCompanyChannel();
    const next = new URLSearchParams(searchParams);
    next.delete('channel');
    setSearchParams(next, { replace: true });
  };

  const handleBackToList = () => {
    lastClosedProjectRef.current = null;
    openProjectIds.forEach((id) => closeProject(id));
    closeCompanyChannel();
    lastHandledUrlProjectRef.current = null;
    // Closing everything is a deliberate act — don't let the first-entry default
    // pull #general straight back open.
    didDefaultOpenRef.current = true;
    const next = new URLSearchParams(searchParams);
    next.delete('projectId');
    next.delete('projectName');
    next.delete('channel');
    setSearchParams(next, { replace: true });
  };

  const totalPanesCount = (isCompanyChannelOpen ? 1 : 0) + openProjectIds.length;
  const isSingle = totalPanesCount === 1;

  return (
    <div
      className="h-full flex flex-col bg-collab-canvas overflow-hidden"
      data-testid="collab-workspace"
    >
      {/* Sticky module bar across the top of the workspace */}
      <CollabModuleRail />

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Panel 1: contextual sidebar listing company channels + projects */}
        <ProjectListRail
          organisationId={organisationId}
          selectedProjectId={activeScope === 'project' ? activeProjectId : null}
          isCompanyActive={activeScope === 'company'}
          onSelect={handleSelectProject}
          onSelectCompany={handleSelectCompany}
        />

        {/* Center Panes: Panels 2 & 3 (and any further open chats) */}
        <div
          className="flex-1 min-w-0 flex h-full overflow-x-auto bg-collab-canvas collab-scroll"
          data-testid="collab-panes-strip"
        >
        {totalPanesCount === 0 ? (
          <ProjectGrid
            organisationId={organisationId}
            onSelect={handleSelectProject}
            onSelectCompany={handleSelectCompany}
          />
        ) : (
          <>
            {isCompanyChannelOpen && (
              <CompanyPane
                channel={activeCompanyChannel}
                channelName={activeCompanyChannelName || 'general'}
                isActive={activeScope === 'company'}
                isSingle={isSingle}
                onActivate={() => {
                  setActiveScope('company');
                  handleSelectCompany(activeCompanyChannelName || 'general');
                }}
                onClose={handleCloseCompanyPane}
              />
            )}
            {openProjectIds.map((id) => (
              <ProjectPane
                key={id}
                projectId={id}
                projectName={nameById.get(id) || (id === projectIdFromUrl ? projectNameFromUrl : '') || 'Project'}
                isActive={activeScope === 'project' && id === activeProjectId}
                isSingle={isSingle}
                onActivate={() => {
                  setActiveProject(id);
                  handleSelectProject(id, nameById.get(id) ?? projectNameFromUrl);
                }}
                onClose={() => handleCloseProjectPane(id)}
                onBackToList={handleBackToList}
              />
            ))}
          </>
        )}
        </div>

        {/* Panel 4: Always-on / collapsible thread rail */}
        <div className="flex shrink-0">
          {activeScope === 'company' && activeCompanyChannel ? (
            <CenterThreadSlot
              channelId={activeCompanyChannel.id}
              collapsed={threadCollapsed}
              onToggleCollapsed={toggleThread}
            />
          ) : activeScope === 'project' && activeProjectId ? (
            <CenterThreadSlot
              projectId={activeProjectId}
              collapsed={threadCollapsed}
              onToggleCollapsed={toggleThread}
            />
          ) : (
            <EmptyThreadRail />
          )}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CompanyPane({
  channel,
  channelName = 'general',
  isActive,
  isSingle,
  onActivate,
  onClose,
}: {
  /** Already resolved by the parent, so pane and thread rail share one row. */
  channel: Channel | undefined;
  channelName?: string;
  isActive: boolean;
  isSingle?: boolean;
  onActivate: () => void;
  onClose: () => void;
}) {
  const isLoading = !channel;

  return (
    <section
      className={`shrink-0 flex flex-col h-full bg-white border-r border-slate-300 border-t-2 transition-colors ${
        isActive ? 'border-t-collab-active' : 'border-t-transparent'
      }`}
      style={{
        minWidth: 340,
        flex: isSingle ? '1 1 auto' : '1 1 340px',
        maxWidth: isSingle ? undefined : 620,
      }}
      data-testid="collab-pane-company"
      data-active={isActive ? 'true' : 'false'}
      onClick={() => {
        if (!isActive) onActivate();
      }}
    >
      <div className="flex-1 min-h-0">
        {isLoading || !channel ? (
          <div
            className="h-full flex flex-col bg-white"
            data-testid="collab-pane-loading"
          >
            <PaneSkeleton channelName={channelName} />
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…
            </div>
          </div>
        ) : (
          <ProjectCollaborationTab
            projectId={null}
            initialChannel={channel}
            onClose={onClose}
            closeTestId="collab-company-pane-close"
          />
        )}
      </div>
    </section>
  );
}

/** Static header placeholder shown while the channel row is being fetched. */
function PaneSkeleton({ channelName }: { channelName: string }) {
  return (
    <div className="shrink-0 bg-white border-b border-slate-200">
      <div className="h-11 px-3 flex items-center gap-1.5">
        <Hash className="h-3.5 w-3.5 text-slate-400" />
        <span className="font-bold text-slate-900 text-sm truncate">{channelName}</span>
      </div>
      <div className="px-3 py-1.5 bg-slate-50/70 border-b border-slate-100 h-7" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function ProjectPane({
  projectId,
  projectName,
  isActive,
  isSingle,
  onActivate,
  onClose,
  onBackToList,
}: {
  projectId: string;
  projectName: string;
  isActive: boolean;
  isSingle?: boolean;
  onActivate: () => void;
  onClose: () => void;
  onBackToList: () => void;
}) {
  const { data: channel, isLoading } = useEnsureChannel(projectId);

  return (
    <section
      className={`shrink-0 flex flex-col h-full bg-white border-r border-slate-300 border-t-2 transition-colors ${
        isActive ? 'border-t-collab-active' : 'border-t-transparent'
      }`}
      style={{
        minWidth: 340,
        flex: isSingle ? '1 1 auto' : '1 1 340px',
        maxWidth: isSingle ? undefined : 620,
      }}
      data-testid="collab-pane"
      data-active={isActive ? 'true' : 'false'}
      onClick={() => {
        if (!isActive) onActivate();
      }}
    >
      <div className="flex-1 min-h-0">
        {isLoading || !channel ? (
          <div
            className="h-full flex flex-col bg-white"
            data-testid="collab-pane-loading"
          >
            <PaneSkeleton channelName={projectName} />
            <div className="flex-1 flex items-center justify-center text-slate-400 text-[11px]">
              <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…
            </div>
          </div>
        ) : (
          <ProjectCollaborationTab
            projectId={projectId}
            onClose={onClose}
            closeTestId="collab-pane-close"
          />
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ProjectGrid({
  organisationId,
  onSelect,
  onSelectCompany,
}: {
  organisationId: string;
  onSelect: (id: string, name: string) => void;
  onSelectCompany?: (name?: string) => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['collab', 'rail', 'projects-grid', organisationId],
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

  const rows = data ?? [];

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-400 text-sm" data-testid="collab-grid-loading">
        Loading projects…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 collab-scroll" data-testid="collab-project-grid">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-slate-500">
          <Hash className="h-4 w-4 text-collab-accent" />
          <h2 className="text-sm font-semibold text-slate-800">Project channels</h2>
          <span className="text-xs">— pick one to start chatting</span>
        </div>
        {rows.length === 0 ? (
          <div
            className="text-sm text-slate-500 text-center py-10 rounded-lg border border-slate-200 bg-white"
            data-testid="collab-grid-empty"
          >
            <p className="font-medium text-slate-700">No projects in this organisation yet.</p>
            <p className="text-xs text-slate-500 mt-1">
              You can still chat in company channels and create tasks.
            </p>
            {onSelectCompany && (
              <button
                type="button"
                onClick={() => onSelectCompany('general')}
                className="mt-4 px-3 py-1.5 bg-collab-accent text-white rounded text-xs font-medium hover:bg-collab-accent-deep transition inline-flex items-center gap-1.5"
              >
                <Hash className="h-3.5 w-3.5" />
                Open #general channel
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
            {rows.map((p) => {
              const label = p.project_name ?? p.name ?? 'Untitled';
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onSelect(p.id, label)}
                  className="text-left border border-slate-200 rounded-lg p-3 hover:border-collab-accent hover:bg-blue-50/50 transition bg-white"
                  data-testid="collab-grid-card"
                >
                  <div className="text-sm font-semibold text-slate-800 truncate">{label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-slate-500 mt-1">
                    {p.status ?? '—'}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function CenterThreadSlot({
  projectId,
  channelId,
  collapsed,
  onToggleCollapsed,
}: {
  projectId?: string;
  channelId?: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  if (collapsed) {
    return (
      <aside
        className="w-10 shrink-0 border-l border-slate-200 bg-white flex flex-col items-center pt-2"
        data-testid="collab-thread-rail-collapsed"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
          aria-label="Open thread panel"
          title="Open thread panel"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </aside>
    );
  }
  return (
    <div className="relative h-full">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute top-3.5 right-2 z-10 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded"
        aria-label="Close thread panel"
        title="Close thread panel"
        data-testid="collab-thread-close"
      >
        <X className="h-4 w-4" />
      </button>
      {channelId ? (
        <ThreadRail channelId={channelId} />
      ) : projectId ? (
        <ThreadLane projectId={projectId} />
      ) : null}
    </div>
  );
}

function ThreadLane({ projectId }: { projectId: string }) {
  const { data: channel } = useEnsureChannel(projectId);
  if (!channel) return null;
  return <ThreadRail channelId={channel.id} />;
}

function EmptyThreadRail() {
  return (
    <aside
      className="w-80 shrink-0 border-l border-slate-200 bg-white flex flex-col h-full"
      data-testid="collab-thread-rail-empty"
    >
      <div className="h-11 px-3 border-b border-slate-200 flex items-center gap-2 shrink-0">
        <MessageSquare className="h-3.5 w-3.5 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-900">Thread</h3>
      </div>
      <div className="flex-1 flex items-center justify-center text-center px-6 text-xs text-slate-400">
        Select a message in a channel to view its thread.
      </div>
    </aside>
  );
}

export default CollaborationWorkspace;
