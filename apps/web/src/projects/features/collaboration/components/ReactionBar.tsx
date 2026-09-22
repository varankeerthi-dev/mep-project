// ReactionBar.tsx — grouped emoji chips with toggle behaviour + quick add.
import { useState } from 'react';
import { Plus } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useAddReaction, useRemoveReaction } from '../hooks';
import type { Reaction } from '../types';

interface Props {
  messageId: string;
  reactions: Reaction[];
  channelId?: string;
}

const QUICK_EMOJI: readonly string[] = ['👍', '✅', '👀', '🎯', '🔥', '🙌'];

export function ReactionBar({ messageId, reactions, channelId }: Props) {
  const { user } = useAuth();
  const addR = useAddReaction(channelId);
  const delR = useRemoveReaction(channelId);
  const [pickerOpen, setPickerOpen] = useState(false);

  if (reactions.length === 0) return null;

  // Group by emoji.
  const groups = new Map<string, Reaction[]>();
  for (const r of reactions) {
    const arr = groups.get(r.emoji) ?? [];
    arr.push(r);
    groups.set(r.emoji, arr);
  }

  return (
    <div className="mt-1.5 flex items-center flex-wrap gap-1" data-testid="collab-reactions">
      {Array.from(groups.entries()).map(([emoji, list]) => {
        const mine = list.some((r) => r.user_id === user?.id);
        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (mine) delR.mutate({ messageId, emoji });
              else addR.mutate({ messageId, emoji });
            }}
            className={`inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-[11px] transition ${
              mine
                ? 'bg-blue-50 border-blue-300 text-slate-800'
                : 'bg-slate-100 hover:bg-slate-200 border-slate-200 text-slate-700'
            }`}
            aria-label={`${emoji} ${list.length}`}
            aria-pressed={mine}
          >
            <span>{emoji}</span>
            <span className="font-semibold text-[10px] text-slate-800">{list.length}</span>
          </button>
        );
      })}

      <div className="relative">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setPickerOpen((v) => !v);
          }}
          className="w-6 h-5 rounded-full border border-dashed border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600 text-[10px] inline-flex items-center justify-center transition"
          aria-label="Add reaction"
          title="Add reaction"
          data-testid="collab-reaction-add"
        >
          <Plus className="h-3 w-3" />
        </button>
        {pickerOpen && (
          <div className="absolute left-0 bottom-full mb-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1 flex gap-0.5 z-20">
            {QUICK_EMOJI.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="px-1.5 py-0.5 hover:bg-slate-100 rounded text-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  addR.mutate({ messageId, emoji });
                  setPickerOpen(false);
                }}
              >
                {emoji}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
