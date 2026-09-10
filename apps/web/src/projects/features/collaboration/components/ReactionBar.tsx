// ReactionBar.tsx — shows grouped emoji counts with toggle behaviour.
import { useAuth } from '../../../../contexts/AuthContext';
import { useAddReaction, useRemoveReaction } from '../hooks';
import type { Reaction } from '../types';

interface Props {
  messageId: string;
  reactions: Reaction[];
}

export function ReactionBar({ messageId, reactions }: Props) {
  const { user } = useAuth();
  const addR = useAddReaction(null);
  const delR = useRemoveReaction(null);

  if (reactions.length === 0) return null;

  // Group by emoji.
  const groups = new Map<string, Reaction[]>();
  for (const r of reactions) {
    const arr = groups.get(r.emoji) ?? [];
    arr.push(r);
    groups.set(r.emoji, arr);
  }

  return (
    <div className="mt-1 flex flex-wrap gap-1" data-testid="collab-reactions">
      {Array.from(groups.entries()).map(([emoji, list]) => {
        const mine = list.some((r) => r.user_id === user?.id);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => {
              if (mine) delR.mutate({ messageId, emoji });
              else addR.mutate({ messageId, emoji });
            }}
            className={`text-xs px-1.5 py-0.5 rounded-full border ${
              mine ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200 hover:bg-gray-50'
            }`}
            aria-label={`${emoji} ${list.length}`}
          >
            <span className="mr-1">{emoji}</span>
            <span className="text-gray-700">{list.length}</span>
          </button>
        );
      })}
    </div>
  );
}
