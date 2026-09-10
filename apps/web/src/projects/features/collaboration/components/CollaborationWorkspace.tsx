// CollaborationWorkspace.tsx — multi-pane Slack-style layout.
//   [Project list rail] | [Open project chat #1] [Open project chat #2] ... | [Thread rail]
// Each project click in the left rail adds (or focuses) a center pane. The
// thread rail is anchored to the active project.
import { useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Hash, MessageSquare, X, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../../supabase';
import { ProjectListRail } from './ProjectListRail';
import { ProjectCollaborationTab } from './ProjectCollaborationTab';
import { ThreadRail } from './ThreadRail';
import { useEnsureChannel } from '../hooks';
import { useCollabStore } from '../store';

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

  const openProjectIds = useCollabStore((s) => s.openProjectIds);
  const activeProjectId = useCollabStore((s) => s.activeProjectId);
  const openProject = useCollabStore((s) => s.openProject);
  const setActiveProject = useCollabStore((s) => s.setActiveProject);
  const closeProject = useCollabStore((s) => s.closeProject);
  const threadCollapsed = useCollabStore((s) => s.threadCollapsed);
  const toggleThread = useCollabStore((s) => s.toggleThread);

  // Sync with URL projectId if present on mount/route change
  useEffect(() => {
    if (projectIdFromUrl && !openProjectIds.includes(projectIdFromUrl)) {
      openProject(projectIdFromUrl);
    }
  }, [projectIdFromUrl, openProject, openProjectIds]);

  // Map project id → display name for the open panes.
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

  const handleSelect = (id: string, name: string) => {
    // Open in store and update URL (deep-link) without clearing other open panes
    openProject(id);
    const next = new URLSearchParams(searchParams);
    next.set('tab', 'collaboration');
    next.set('projectId', id);
    if (name) next.set('projectName', name);
    setSearchParams(next);
  };

  const handleClosePane = (id: string) => {
    closeProject(id);
    // If the URL was pointing at the closed pane, update or clear it.
    if (projectIdFromUrl === id) {
      const remaining = openProjectIds.filter((x) => x !== id);
      const next = new URLSearchParams(searchParams);
      if (remaining.length > 0) {
        const nextActive = remaining[remaining.length - 1];
        next.set('projectId', nextActive);
        const nextName = nameById.get(nextActive);
        if (nextName) next.set('projectName', nextName);
      } else {
        next.delete('projectId');
        next.delete('projectName');
      }
      setSearchParams(next);
    }
  };

  const handleBackToList = () => {
    openProjectIds.forEach((id) => closeProject(id));
    const next = new URLSearchParams(searchParams);
    next.delete('projectId');
    next.delete('projectName');
    setSearchParams(next);
  };

  return (
    <div className="h-full flex bg-white overflow-hidden" data-testid="collab-workspace">
      {/* Panel 1: Left rail listing projects */}
      <ProjectListRail
        organisationId={organisationId}
        selectedProjectId={activeProjectId}
        onSelect={handleSelect}
      />
      {/* Center Panes: Panels 2 & 3 (and any further open chats) */}
      <div
        className="flex-1 min-w-0 flex h-full overflow-x-auto bg-gray-50/50"
        data-testid="collab-panes-strip"
      >
        {openProjectIds.length === 0 ? (
          <ProjectGrid organisationId={organisationId} onSelect={handleSelect} />
        ) : (
          openProjectIds.map((id) => (
            <ProjectPane
              key={id}
              projectId={id}
              projectName={nameById.get(id) || (id === projectIdFromUrl ? projectNameFromUrl : '') || 'Project'}
              isActive={id === activeProjectId}
              isSingle={openProjectIds.length === 1}
              onActivate={() => {
                setActiveProject(id);
                handleSelect(id, nameById.get(id) ?? projectNameFromUrl);
              }}
              onClose={() => handleClosePane(id)}
              onBackToList={handleBackToList}
            />
          ))
        )}
      </div>

      {/* Panel 4: Always-on / collapsible thread rail */}
      <div className="flex shrink-0">
        {activeProjectId ? (
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
      className={`shrink-0 border-r flex flex-col h-full bg-white transition-all ${
        isActive ? 'border-blue-400 shadow-sm' : 'border-gray-200'
      }`}
      style={{
        minWidth: 320,
        maxWidth: isSingle ? 850 : 540,
        flex: 1,
      }}
      data-testid="collab-pane"
      data-active={isActive ? 'true' : 'false'}
      onMouseDown={onActivate}
    >
      <div
        className={`flex items-center justify-between px-2 py-1.5 border-b text-[11px] ${
          isActive ? 'bg-blue-50' : 'bg-gray-50'
        }`}
      >
        <button
          type="button"
          onClick={onActivate}
          className="flex items-center gap-1 min-w-0 text-left"
          title={projectName}
        >
          <Hash className="h-3 w-3 text-gray-500 shrink-0" />
          <span className="font-semibold text-gray-800 truncate">{projectName}</span>
        </button>
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={onBackToList}
            className="p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
            aria-label="Close all panes"
            title="Close all panes"
          >
            <X className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded"
            aria-label={`Close ${projectName}`}
            title={`Close ${projectName}`}
            data-testid="collab-pane-close"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      </div>
      <div className="flex-1 min-h-0">
        {isLoading || !channel ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-[11px]" data-testid="collab-pane-loading">
            <Loader2 className="h-3 w-3 animate-spin mr-1" /> Loading…
          </div>
        ) : (
          <ProjectCollaborationTab projectId={projectId} />
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function ProjectGrid({
  organisationId,
  onSelect,
}: {
  organisationId: string;
  onSelect: (id: string, name: string) => void;
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
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm" data-testid="collab-grid-loading">
        Loading projects…
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6" data-testid="collab-project-grid">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2 mb-4 text-gray-500">
          <Hash className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-gray-700">Project channels</h2>
          <span className="text-xs">— pick one to start chatting</span>
        </div>
        {rows.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-10 border rounded">
            No projects in this organisation yet.
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
                  className="text-left border rounded-lg p-3 hover:border-blue-400 hover:bg-blue-50/50 transition"
                  data-testid="collab-grid-card"
                >
                  <div className="text-sm font-semibold text-gray-800 truncate">{label}</div>
                  <div className="text-[10px] uppercase tracking-wide text-gray-500 mt-1">
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
  collapsed,
  onToggleCollapsed,
}: {
  projectId: string;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}) {
  if (collapsed) {
    return (
      <aside
        className="w-10 shrink-0 border-l bg-white flex flex-col items-center pt-2"
        data-testid="collab-thread-rail-collapsed"
      >
        <button
          type="button"
          onClick={onToggleCollapsed}
          className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
          aria-label="Open thread panel"
          title="Open thread panel"
        >
          <MessageSquare className="h-4 w-4" />
        </button>
      </aside>
    );
  }
  return (
    <div className="relative">
      <button
        type="button"
        onClick={onToggleCollapsed}
        className="absolute top-2 right-2 z-10 p-1 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded"
        aria-label="Close thread panel"
        title="Close thread panel"
        data-testid="collab-thread-close"
      >
        <X className="h-4 w-4" />
      </button>
      <ThreadLane projectId={projectId} />
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
      className="w-80 shrink-0 border-l bg-white flex flex-col h-full"
      data-testid="collab-thread-rail-empty"
    >
      <div className="px-4 py-3 border-b flex items-center gap-2">
        <MessageSquare className="h-4 w-4 text-gray-500" />
        <h3 className="text-sm font-semibold">Thread</h3>
      </div>
      <div className="flex-1 flex items-center justify-center text-center px-6 text-sm text-gray-500">
        Open a project to view its threads.
      </div>
    </aside>
  );
}

export default CollaborationWorkspace;
