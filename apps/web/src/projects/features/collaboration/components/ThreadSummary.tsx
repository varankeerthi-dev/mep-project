// ThreadSummary.tsx — "N replies" + open button under a root message.
import { useQuery } from '@tanstack/react-query';
import { MessageSquare } from 'lucide-react';
import { useCollabStore } from '../store';
import { fetchThread } from '../api';

interface Props {
  messageId: string;
  channelId: string;
}

export function ThreadSummary({ messageId, channelId }: Props) {
  const setOpen = useCollabStore((s) => s.setOpenThread);
  const { data } = useQuery({
    queryKey: ['collab', 'thread', 'count', messageId],
    queryFn: () => fetchThread(messageId),
    staleTime: 30 * 1000,
  });
  const count = data?.length ?? 0;
  if (count === 0) return null;
  return (
    <button
      type="button"
      onClick={() => setOpen(messageId)}
      className="ml-1 mt-1 text-xs text-blue-600 hover:underline flex items-center gap-1"
      data-testid="collab-thread-summary"
    >
      <MessageSquare className="h-3 w-3" />
      {count} {count === 1 ? 'reply' : 'replies'}
    </button>
  );
}
