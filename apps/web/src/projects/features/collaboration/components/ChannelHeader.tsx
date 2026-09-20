// ChannelHeader.tsx — channel name + filter pills + search entry + channel menu.
import { useState } from 'react';
import { Hash, Search, MoreHorizontal, Trash2, LogOut, Archive } from 'lucide-react';
import { useCollabStore } from '../store';
import { useAuth } from '../../../../contexts/AuthContext';
import { useClearChannelMessages, useLeaveChannel, useArchiveChannel, useChannelMembers } from '../hooks';
import type { Channel, CollaborationFilter } from '../types';

const FILTERS: { value: CollaborationFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'mentions', label: 'Mentions' },
  { value: 'files', label: 'Files' },
  { value: 'photos', label: 'Photos' },
];

interface Props {
  channel: Channel;
  onSearch: (term: string) => void;
  searchOpen: boolean;
  searchTerm: string;
}

export function ChannelHeader({ channel, onSearch, searchOpen, searchTerm }: Props) {
  const { user } = useAuth();
  const filter = useCollabStore((s) => s.filter);
  const setFilter = useCollabStore((s) => s.setFilter);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'leave' | 'archive' | null>(null);

  const membersQuery = useChannelMembers(channel.id);
  const clearMessages = useClearChannelMessages(channel.id);
  const leave = useLeaveChannel();
  const archive = useArchiveChannel();

  // RBAC checks
  const currentMember = membersQuery.data?.find(m => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const isOwner = currentMember?.role === 'owner';

  // Check if user is the only owner
  const ownerCount = membersQuery.data?.filter(m => m.role === 'owner').length ?? 0;
  const isOnlyOwner = isOwner && ownerCount <= 1;

  const handleClearMessages = async () => {
    try {
      await clearMessages.mutateAsync();
      setMenuOpen(false);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Failed to clear messages:', err);
    }
  };

  const handleLeave = async () => {
    try {
      await leave.mutateAsync(channel.id);
      setMenuOpen(false);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Failed to leave channel:', err);
    }
  };

  const handleArchive = async () => {
    try {
      await archive.mutateAsync(channel.id);
      setMenuOpen(false);
      setConfirmAction(null);
    } catch (err: any) {
      console.error('Failed to archive channel:', err);
    }
  };

  return (
    <div className="border-b bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition font-medium ${
                filter === f.value
                  ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {f.label}
            </button>
          ))}
          {channel.is_archived && (
            <span className="text-[11px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full border border-slate-200">
              Archived
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => onSearch(searchOpen ? '' : ' ')}
            className="text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 transition"
            aria-label="Toggle search"
            title="Search messages"
          >
            <Search className="h-4 w-4" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="text-slate-500 hover:text-slate-800 p-1.5 rounded-md hover:bg-slate-100 transition"
              aria-label="Channel options"
              title="Channel options"
              data-testid="channel-menu-btn"
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-50 min-w-[180px]">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction('clear');
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-50 text-slate-700 hover:text-red-700 w-full text-left rounded transition"
                    data-testid="channel-menu-clear"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span>Delete conversation</span>
                  </button>
                )}
                {!isOnlyOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction('leave');
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-orange-50 text-slate-700 hover:text-orange-700 w-full text-left rounded transition"
                    data-testid="channel-menu-leave"
                  >
                    <LogOut className="h-3.5 w-3.5 text-orange-500 shrink-0" />
                    <span>Leave channel</span>
                  </button>
                )}
                {isOwner && (
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmAction('archive');
                      setMenuOpen(false);
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-red-50 text-slate-700 hover:text-red-700 w-full text-left rounded transition"
                    data-testid="channel-menu-archive"
                  >
                    <Archive className="h-3.5 w-3.5 text-red-500 shrink-0" />
                    <span>Delete channel</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      {searchOpen && (
        <input
          autoFocus
          value={searchTerm}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search messages…"
          className="mt-2 w-full rounded border border-slate-200 px-3 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      )}
      {/* Confirmation Dialogs */}
      {confirmAction && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setConfirmAction(null)}>
          <div className="bg-white rounded-lg shadow-xl p-4 max-w-sm w-full mx-4" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {confirmAction === 'clear' && 'Delete all messages?'}
              {confirmAction === 'leave' && 'Leave this channel?'}
              {confirmAction === 'archive' && 'Delete this channel?'}
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              {confirmAction === 'clear' && 'This will permanently delete all messages in this channel. This action cannot be undone.'}
              {confirmAction === 'leave' && 'You will no longer have access to this channel. You can rejoin if invited again.'}
              {confirmAction === 'archive' && 'This channel will be archived and hidden from all members. This action cannot be undone.'}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmAction === 'clear') handleClearMessages();
                  if (confirmAction === 'leave') handleLeave();
                  if (confirmAction === 'archive') handleArchive();
                }}
                disabled={clearMessages.isPending || leave.isPending || archive.isPending}
                className="px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
              >
                {clearMessages.isPending || leave.isPending || archive.isPending ? 'Processing…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
