// ChannelHeader.tsx — compact channel header: name + badges, member stack, filter
// pills, in-channel search and the channel actions menu (RBAC-gated).
import { useState } from 'react';
import {
  Archive,
  Lock,
  LogOut,
  MoreHorizontal,
  Search,
  Trash2,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useCollabStore } from '../store';
import { useAuth } from '../../../../contexts/AuthContext';
import {
  useClearChannelMessages,
  useLeaveChannel,
  useArchiveChannel,
  useChannelMembers,
} from '../hooks';
import { UserAvatar } from './UserAvatar';
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
  /** When the channel is docked as a pane, renders the pane-close control. */
  onClose?: () => void;
  closeTestId?: string;
}

export function ChannelHeader({
  channel,
  onSearch,
  searchOpen,
  searchTerm,
  onClose,
  closeTestId,
}: Props) {
  const { user } = useAuth();
  const filter = useCollabStore((s) => s.filter);
  const setFilter = useCollabStore((s) => s.setFilter);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'clear' | 'leave' | 'archive' | null>(null);

  const membersQuery = useChannelMembers(channel.id);
  const clearMessages = useClearChannelMessages(channel.id);
  const leave = useLeaveChannel();
  const archive = useArchiveChannel();

  const isPrivate = channel.visibility === 'private';

  // RBAC checks
  const currentMember = membersQuery.data?.find((m) => m.user_id === user?.id);
  const isAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';
  const isOwner = currentMember?.role === 'owner';

  // Check if user is the only owner
  const ownerCount = membersQuery.data?.filter((m) => m.role === 'owner').length ?? 0;
  const isOnlyOwner = isOwner && ownerCount <= 1;

  const members = membersQuery.data ?? [];

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
    <div className="shrink-0 bg-white border-b border-slate-200" data-testid="collab-channel-header">
      {/* Row 1 — channel identity */}
      <div className="h-11 px-3 flex items-center justify-between gap-2 border-b border-slate-100">
        <div className="flex items-center gap-1.5 min-w-0">
          {isPrivate ? (
            <Lock className="h-3.5 w-3.5 text-slate-500 shrink-0" />
          ) : (
            <span className="text-slate-500 font-semibold shrink-0">#</span>
          )}
          <span className="font-bold text-slate-900 text-sm truncate">{channel.name}</span>
          {channel.channel_type === 'general' ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded font-medium border border-blue-200 shrink-0">
              Org
            </span>
          ) : isPrivate ? (
            <span className="text-[10px] px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded font-medium border border-slate-200 shrink-0">
              Private
            </span>
          ) : null}
          {channel.is_archived && (
            <span className="text-[10px] px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-medium shrink-0">
              Archived
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Member stack */}
          {members.length > 0 && (
            <div
              className="flex items-center"
              title={`${members.length} member${members.length === 1 ? '' : 's'}`}
              data-testid="collab-header-members"
            >
              {members.slice(0, 3).map((m, idx) => (
                <span
                  key={m.user_id}
                  className="rounded-full ring-2 ring-white"
                  style={{ marginLeft: idx === 0 ? 0 : -8 }}
                >
                  <UserAvatar
                    name={m.full_name}
                    avatarUrl={m.avatar_url}
                    userId={m.user_id}
                    size="xs"
                    fallbackType="face"
                  />
                </span>
              ))}
              <span className="ml-1.5 text-[11px] text-slate-500">{members.length}</span>
            </div>
          )}

          {onClose && (
            <button
              type="button"
              // The docked pane wrapper activates (and therefore re-opens) its pane
              // on click, so the close control must not let the event reach it.
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                onClose();
              }}
              className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
              aria-label={`Close #${channel.name}`}
              title={`Close #${channel.name}`}
              data-testid={closeTestId ?? 'collab-pane-close'}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2 — filters, search, actions */}
      <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-slate-50/70 border-b border-slate-100">
        <div className="flex items-center gap-1 overflow-x-auto py-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
              className={`shrink-0 px-2 py-0.5 rounded-full text-[11px] whitespace-nowrap transition ${
                filter === f.value
                  ? 'bg-collab-active text-white font-medium shadow-xs'
                  : 'text-slate-600 hover:bg-slate-200/70'
              }`}
              aria-pressed={filter === f.value}
              data-testid={`collab-filter-${f.value}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          <button
            type="button"
            onClick={() => onSearch(searchOpen ? '' : ' ')}
            className="p-1 hover:text-slate-700 rounded transition"
            aria-label="Toggle search"
            title="Search messages"
            data-testid="collab-search-toggle"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="p-1 hover:text-slate-700 rounded transition"
              aria-label="Channel options"
              title="Channel options"
              data-testid="channel-menu-btn"
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-slate-200 rounded-lg shadow-lg p-1 z-50 min-w-[180px] text-xs">
                {isAdmin && (
                  <MenuItem
                    icon={Trash2}
                    label="Delete conversation"
                    tone="danger"
                    onClick={() => {
                      setConfirmAction('clear');
                      setMenuOpen(false);
                    }}
                    testId="channel-menu-clear"
                  />
                )}
                {!isOnlyOwner && (
                  <MenuItem
                    icon={LogOut}
                    label="Leave channel"
                    tone="warn"
                    onClick={() => {
                      setConfirmAction('leave');
                      setMenuOpen(false);
                    }}
                    testId="channel-menu-leave"
                  />
                )}
                {isOwner && (
                  <MenuItem
                    icon={Archive}
                    label="Delete channel"
                    tone="danger"
                    onClick={() => {
                      setConfirmAction('archive');
                      setMenuOpen(false);
                    }}
                    testId="channel-menu-archive"
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {searchOpen && (
        <div className="px-3 py-1.5 border-b border-slate-100 bg-white">
          <div className="relative flex items-center">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              autoFocus
              value={searchTerm}
              onChange={(e) => onSearch(e.target.value)}
              placeholder={`Search in #${channel.name}…`}
              className="w-full rounded border border-slate-300 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-slate-500"
              data-testid="collab-search-input"
            />
          </div>
        </div>
      )}

      {/* Confirmation dialogs */}
      {confirmAction && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setConfirmAction(null)}
        >
          <div
            className="bg-white rounded-xl shadow-xl p-4 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-sm font-semibold text-gray-900 mb-2">
              {confirmAction === 'clear' && 'Delete all messages?'}
              {confirmAction === 'leave' && 'Leave this channel?'}
              {confirmAction === 'archive' && 'Delete this channel?'}
            </h3>
            <p className="text-xs text-gray-600 mb-4">
              {confirmAction === 'clear' &&
                'This will permanently delete all messages in this channel. This action cannot be undone.'}
              {confirmAction === 'leave' &&
                'You will no longer have access to this channel. You can rejoin if invited again.'}
              {confirmAction === 'archive' &&
                'This channel will be archived and hidden from all members. This action cannot be undone.'}
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
                {clearMessages.isPending || leave.isPending || archive.isPending
                  ? 'Processing…'
                  : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  tone,
  testId,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  tone: 'danger' | 'warn';
  testId?: string;
}) {
  const toneClass =
    tone === 'danger'
      ? 'hover:bg-red-50 hover:text-red-700 [&>svg]:text-red-500'
      : 'hover:bg-orange-50 hover:text-orange-700 [&>svg]:text-orange-500';
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2 px-2.5 py-1.5 text-slate-700 w-full text-left rounded transition ${toneClass}`}
      data-testid={testId}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span>{label}</span>
    </button>
  );
}
