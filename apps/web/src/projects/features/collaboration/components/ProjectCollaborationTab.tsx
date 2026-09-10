// ProjectCollaborationTab.tsx — root of the collaboration feature inside a project.
// Note: the always-on thread rail is mounted by CollaborationWorkspace,
// so this component only owns the channel + chat + composer for the active project.
import { useEffect, useState } from 'react';
import { ChannelHeader } from './ChannelHeader';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { useEnsureChannel, useSearchMessages } from '../hooks';
import { useRealtimeChannel } from '../useRealtimeChannel';
import { useCollabStore } from '../store';
import { Loader2 } from 'lucide-react';

interface Props {
  projectId: string;
}

export function ProjectCollaborationTab({ projectId }: Props) {
  const channelQuery = useEnsureChannel(projectId);
  const channel = channelQuery.data;
  const [searchTerm, setSearchTerm] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const resetForProject = useCollabStore((s) => s.resetForProject);

  // Reset transient UI when project changes.
  useEffect(() => {
    resetForProject(projectId);
  }, [projectId, resetForProject]);

  useRealtimeChannel(channel?.id ?? null);

  const search = useSearchMessages(channel?.id ?? null, searchTerm.trim());
  const inSearchMode = searchOpen && searchTerm.trim().length > 0;

  if (channelQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500" data-testid="collab-loading">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }
  if (channelQuery.error || !channel) {
    return (
      <div className="h-full flex items-center justify-center text-sm text-red-600" data-testid="collab-error">
        Could not open project channel. Check your access and try again.
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white" data-testid="collab-root">
      <ChannelHeader
        channel={channel}
        onSearch={(v) => {
          if (v === '') setSearchOpen(false);
          else setSearchOpen(true);
          setSearchTerm(v.trim());
        }}
        searchOpen={searchOpen}
        searchTerm={searchTerm}
      />

      {inSearchMode ? (
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2" data-testid="collab-search-results">
          {search.isLoading && <div className="text-sm text-gray-500">Searching…</div>}
          {search.data?.length === 0 && <div className="text-sm text-gray-500">No results.</div>}
          {search.data?.map((m) => (
            <div key={m.id} className="text-sm border-b pb-1.5">
              <div className="text-xs text-gray-500">{new Date(m.created_at).toLocaleString()}</div>
              <div className="text-gray-800 whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>
      ) : (
        <MessageList channelId={channel.id} />
      )}

      <Composer channelId={channel.id} />

    </div>
  );
}
