// Composer.tsx — text + attachment + mention + emoji composer.
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, Mic, X, Smile, AtSign, Plus, CheckSquare, Link2 } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCollabStore } from '../store';
import { useSendMessage, useChannelMembers } from '../hooks';
import { AttachmentPreview } from './AttachmentPreview';
import { uploadAttachment, addAttachment, type MemberSummary } from '../api';
import { buildAttachmentPath } from '../utils';
import { UserAvatar } from './UserAvatar';
import type { StagedAttachment } from '../types';
import { AttachmentMetaSchema, MessageDraftSchema } from '../schemas';

interface Props {
  channelId: string;
  parentMessageId?: string | null;
  replyHintName?: string;
  onCancelReply?: () => void;
  /** Channel display name, used for the "Message #channel…" placeholder. */
  channelName?: string;
}

const EMOJI_GROUPS = [
  {
    name: 'Status',
    emojis: ['👍', '✅', '❌', '⚠️', '🚨', '📌', '🎯', '⏳', '🚀', '🏗️'],
  },
  {
    name: 'Team',
    emojis: ['👏', '🙌', '🤝', '🔥', '💡', '👀', '💬', '⭐', '💯', '📋'],
  },
  {
    name: 'Expressions',
    emojis: ['😊', '😄', '😅', '😂', '🤔', '🙏', '💪', '👌', '✌️', '🎉'],
  },
];

export function Composer({
  channelId,
  parentMessageId,
  replyHintName,
  onCancelReply,
  channelName,
}: Props) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';
  const send = useSendMessage(channelId);
  const membersQuery = useChannelMembers(channelId);

  const [text, setText] = useState('');
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const stagedRef = useRef<StagedAttachment[]>([]);

  // Mention State
  const [mentionOpen, setMentionOpen] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionMatchStart, setMentionMatchStart] = useState(-1);
  const [mentionSelectedIndex, setMentionSelectedIndex] = useState(0);
  const [selectedMentions, setSelectedMentions] = useState<Map<string, string>>(new Map()); // id -> name

  // Emoji Popover State
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const emojiPickerRef = useRef<HTMLDivElement | null>(null);

  // Plus Action Menu State
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);
  const plusMenuRef = useRef<HTMLDivElement | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);

  const setDraft = useCollabStore((s) => s.setDraft);
  const clearDraft = useCollabStore((s) => s.clearDraft);
  const openTaskCreate = useCollabStore((s) => s.openTaskCreate);

  // Auto-resize textarea to fit content without scrollbars
  const adjustHeight = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    if (!el.value.trim()) {
      el.style.height = '40px';
    } else {
      el.style.height = `${Math.min(Math.max(el.scrollHeight, 40), 140)}px`;
    }
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [text, adjustHeight]);

  useEffect(() => {
    stagedRef.current = staged;
  }, [staged]);

  useEffect(() => {
    return () => {
      stagedRef.current.forEach((p) => {
        if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
      });
    };
  }, []);

  // Close emoji picker or plus menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setEmojiPickerOpen(false);
      }
      if (plusMenuRef.current && !plusMenuRef.current.contains(e.target as Node)) {
        setPlusMenuOpen(false);
      }
    };
    if (emojiPickerOpen || plusMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [emojiPickerOpen, plusMenuOpen]);

  const draftKey = useMemo(
    () => `${channelId}:${parentMessageId ?? 'root'}`,
    [channelId, parentMessageId],
  );

  const filteredMembers = useMemo(() => {
    const q = mentionQuery.toLowerCase().trim();
    const all = membersQuery.data ?? [];
    if (!q) return all.slice(0, 8);
    return all
      .filter((m) => (m.full_name ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [membersQuery.data, mentionQuery]);

  const stageFiles = useCallback((files: FileList | null) => {
    if (!files || !orgId) return;
    const newStaged: StagedAttachment[] = [];
    for (const f of Array.from(files)) {
      const localId = crypto.randomUUID();
      const previewUrl = f.type.startsWith('image/') ? URL.createObjectURL(f) : undefined;
      newStaged.push({ id: localId, file: f, uploaded: false, failed: false, previewUrl });
    }
    setStaged((prev) => [...prev, ...newStaged]);
  }, [orgId]);

  const uploadStaged = useCallback(async (sa: StagedAttachment) => {
    if (!orgId) return;
    try {
      AttachmentMetaSchema.parse({
        file_name: sa.file.name,
        file_size: sa.file.size,
        mime_type: sa.file.type || 'application/octet-stream',
      });
    } catch {
      setStaged((prev) => prev.map((p) => (p.id === sa.id ? { ...p, failed: true } : p)));
      return;
    }
    const pendingPath = buildAttachmentPath({
      organisationId: orgId,
      channelId,
      messageId: 'pending',
      fileName: sa.file.name,
    });
    try {
      const { path } = await uploadAttachment('project-collab-attachments', pendingPath, sa.file);
      setStaged((prev) => prev.map((p) => (p.id === sa.id ? { ...p, uploaded: true, storagePath: path } : p)));
    } catch {
      setStaged((prev) => prev.map((p) => (p.id === sa.id ? { ...p, failed: true } : p)));
    }
  }, [orgId, channelId]);

  const removeStaged = useCallback((id: string) => {
    setStaged((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== id);
    });
  }, []);

  const canSend = text.trim().length > 0 && !send.isPending;

  const selectMember = useCallback((member: MemberSummary) => {
    const rawName = member.full_name?.trim() || 'user';
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, mentionMatchStart);
    const after = text.slice(cursor);
    const inserted = rawName.includes(' ') ? `@[${rawName}] ` : `@${rawName} `;
    const newText = before + inserted + after;
    setText(newText);
    setSelectedMentions((prev) => new Map(prev).set(member.user_id, rawName));
    setMentionOpen(false);
    setDraft(draftKey, { text: newText, attachments: staged, parentMessageId: parentMessageId ?? null });
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = before.length + inserted.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [text, mentionMatchStart, setDraft, draftKey, staged, parentMessageId]);

  const insertEmoji = useCallback((emoji: string) => {
    const cursor = textareaRef.current?.selectionStart ?? text.length;
    const before = text.slice(0, cursor);
    const after = text.slice(cursor);
    const newText = before + emoji + after;
    setText(newText);
    setEmojiPickerOpen(false);
    setDraft(draftKey, { text: newText, attachments: staged, parentMessageId: parentMessageId ?? null });
    setTimeout(() => {
      if (textareaRef.current) {
        const newPos = cursor + emoji.length;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(newPos, newPos);
      }
    }, 0);
  }, [text, setDraft, draftKey, staged, parentMessageId]);

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setText(val);
    setDraft(draftKey, { text: val, attachments: staged, parentMessageId: parentMessageId ?? null });

    const cursor = e.target.selectionStart;
    const beforeCursor = val.slice(0, cursor);
    const lastAt = beforeCursor.lastIndexOf('@');
    if (lastAt !== -1 && (lastAt === 0 || /[\s\n]/.test(beforeCursor[lastAt - 1]))) {
      const query = beforeCursor.slice(lastAt + 1);
      if (!query.includes('\n') && query.length <= 25) {
        setMentionOpen(true);
        setMentionQuery(query);
        setMentionMatchStart(lastAt);
        setMentionSelectedIndex(0);
        return;
      }
    }
    setMentionOpen(false);
  };

  const submit = useCallback(async () => {
    try {
      // Gather active mentions present in the message text
      const validMentions: string[] = [];
      selectedMentions.forEach((name, id) => {
        if (text.includes(`@${name}`) || text.includes(`@[${name}]`)) {
          validMentions.push(id);
        }
      });

      const draft = MessageDraftSchema.parse({
        text: text.trim(),
        parentMessageId: parentMessageId ?? null,
        mentions: validMentions,
        linkedEntities: [],
      });

      await Promise.all(
        staged.filter((s) => !s.uploaded && !s.failed).map(uploadStaged),
      );
      const saved = await send.mutateAsync(draft);

      await Promise.all(
        staged
          .filter((s) => s.uploaded && s.storagePath)
          .map(async (s) => {
            try {
              await addAttachment({
                messageId: saved.id,
                storageBucket: 'project-collab-attachments',
                storagePath: s.storagePath!,
                fileName: s.file.name,
                fileSize: s.file.size,
                mimeType: s.file.type || null,
                width: null,
                height: null,
                durationMs: null,
              });
            } catch {
              // best-effort
            }
          }),
      );
      staged.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      setText('');
      setStaged([]);
      setSelectedMentions(new Map());
      setMentionOpen(false);
      clearDraft(draftKey);
    } catch {
      setDraft(draftKey, { text, attachments: staged, parentMessageId: parentMessageId ?? null });
    }
  }, [text, parentMessageId, selectedMentions, staged, send, clearDraft, setDraft, draftKey, uploadStaged]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionOpen && filteredMembers.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setMentionSelectedIndex((i) => (i + 1) % filteredMembers.length);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setMentionSelectedIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length);
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        selectMember(filteredMembers[mentionSelectedIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setMentionOpen(false);
        return;
      }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submit();
    }
  };

  return (
    <div className="shrink-0 border-t border-slate-200 bg-white p-2 relative" data-testid="collab-composer">
      {/* Mention Autocomplete Dropdown */}
      {mentionOpen && filteredMembers.length > 0 && (
        <div
          className="absolute bottom-full left-3 mb-1 w-64 bg-white border rounded-lg shadow-xl overflow-hidden z-30"
          data-testid="collab-mention-popup"
        >
          <div className="px-3 py-1.5 bg-gray-50 border-b text-[11px] font-semibold text-gray-500 flex items-center gap-1.5">
            <AtSign className="h-3 w-3 text-blue-600" />
            <span>Mention team member</span>
          </div>
          <ul className="max-h-48 overflow-y-auto py-1">
            {filteredMembers.map((m, idx) => {
              const isSelected = idx === mentionSelectedIndex;
              const name = m.full_name || 'Team member';
              return (
                <li key={m.user_id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      selectMember(m);
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      selectMember(m);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 transition ${
                      isSelected ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-800 hover:bg-gray-50'
                    }`}
                  >
                    <UserAvatar
                      name={m.full_name}
                      avatarUrl={m.avatar_url}
                      userId={m.user_id}
                      size="xs"
                      fallbackType="face"
                    />
                    <span className="truncate flex-1">{name}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="px-2.5 py-1 border-t bg-gray-50/70 text-[10px] text-gray-400">
            Use ↑↓ to navigate · ↵ or Tab to select · Esc to dismiss
          </div>
        </div>
      )}

      {/* Emoji Picker Popover */}
      {emojiPickerOpen && (
        <div
          ref={emojiPickerRef}
          className="absolute bottom-full right-3 mb-1 w-72 bg-white border rounded-lg shadow-xl p-2.5 z-30"
          data-testid="collab-emoji-picker"
        >
          <div className="flex items-center justify-between pb-1.5 mb-2 border-b text-xs font-semibold text-gray-600">
            <span>Add reaction emoji</span>
            <button
              type="button"
              onClick={() => setEmojiPickerOpen(false)}
              className="text-gray-400 hover:text-gray-700"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            {EMOJI_GROUPS.map((group) => (
              <div key={group.name}>
                <div className="text-[10px] uppercase font-bold text-gray-400 mb-1 tracking-wider">
                  {group.name}
                </div>
                <div className="grid grid-cols-5 gap-1">
                  {group.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        insertEmoji(emoji);
                      }}
                      onClick={(e) => {
                        e.preventDefault();
                        insertEmoji(emoji);
                      }}
                      className="p-1.5 hover:bg-blue-50 rounded text-lg transition flex items-center justify-center hover:scale-110 active:scale-95"
                      title={emoji}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {parentMessageId && (
        <div className="flex items-center gap-2 text-[11px] text-slate-500 mb-1 px-1">
          <span>Replying in thread{replyHintName ? ` to ${replyHintName}` : ''}</span>
          {onCancelReply && (
            <button type="button" onClick={onCancelReply} className="ml-auto text-gray-500 hover:text-gray-800">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <AttachmentPreview attachments={staged} onRemove={removeStaged} />

      {/* Text entry card with bottom toolbar */}
      <div className="border border-slate-300 rounded-lg bg-white shadow-2xs focus-within:border-slate-500 transition-colors overflow-hidden">
        <textarea
          ref={textareaRef}
          value={text}
          onChange={handleTextChange}
          onKeyDown={onKey}
          rows={2}
          placeholder={
            parentMessageId
              ? 'Reply… (use @ to mention)'
              : channelName
              ? `Message #${channelName}…`
              : 'Message…'
          }
          className="w-full resize-none px-2.5 pt-2 pb-1 text-[13px] text-slate-800 placeholder-slate-400 focus:outline-none border-none bg-transparent max-h-36 overflow-y-auto block leading-relaxed"
          style={{ minHeight: '44px' }}
          data-testid="collab-composer-textarea"
        />

        <div className="bg-slate-50 px-2 py-1 flex items-center justify-between border-t border-slate-100">
          <div className="flex items-center gap-0.5">
            {/* Plus Action Menu (+ Add) */}
            <div className="relative" ref={plusMenuRef}>
              <button
                type="button"
                onClick={() => setPlusMenuOpen((v) => !v)}
                className={`p-1.5 rounded transition ${
                  plusMenuOpen
                    ? 'text-blue-600 bg-blue-100'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/70'
                }`}
                aria-label="Add attachment or task"
                title="Add… (Task, File, ERP Record)"
                data-testid="collab-composer-plus"
              >
                <Plus className="h-4 w-4" />
              </button>

              {plusMenuOpen && (
                <div className="absolute bottom-full left-0 mb-1.5 bg-white border border-gray-200 rounded-lg shadow-lg p-1 z-30 min-w-[160px] text-xs">
                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      openTaskCreate({
                        channelId,
                        title: text.trim() || undefined,
                      });
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-blue-50 text-slate-700 hover:text-blue-700 w-full text-left font-medium transition cursor-pointer"
                    data-testid="collab-composer-menu-task"
                  >
                    <CheckSquare className="h-4 w-4 text-blue-600 shrink-0" />
                    <span>Task</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gray-100 text-slate-700 w-full text-left transition cursor-pointer"
                  >
                    <Paperclip className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>File</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      cameraInputRef.current?.click();
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gray-100 text-slate-700 w-full text-left transition cursor-pointer"
                  >
                    <ImageIcon className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>Photo</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setPlusMenuOpen(false);
                      const el = textareaRef.current;
                      if (el) {
                        setText((prev) => prev + (prev.length > 0 && !prev.endsWith(' ') ? ' @' : '@'));
                        el.focus();
                      }
                    }}
                    className="flex items-center gap-2 px-2.5 py-1.5 rounded hover:bg-gray-100 text-slate-700 w-full text-left transition cursor-pointer"
                  >
                    <Link2 className="h-4 w-4 text-slate-500 shrink-0" />
                    <span>ERP Record / @ Link</span>
                  </button>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setEmojiPickerOpen((v) => !v)}
              className={`p-1.5 rounded hover:bg-slate-200/70 transition ${
                emojiPickerOpen
                  ? 'text-blue-600 bg-blue-100'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
              aria-label="Insert emoji"
              title="Insert emoji"
              data-testid="collab-composer-emoji"
            >
              <Smile className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
              aria-label="Attach file"
              title="Attach file"
            >
              <Paperclip className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => cameraInputRef.current?.click()}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/70 rounded transition"
              aria-label="Attach photo"
              title="Attach photo"
            >
              <ImageIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => { /* voice note — Phase 2 */ }}
              className="p-1.5 text-slate-300 cursor-not-allowed"
              aria-label="Record voice (coming soon)"
              disabled
              title="Voice note — coming soon"
            >
              <Mic className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 select-none hidden sm:inline">
              @ mention
            </span>
            <button
              type="button"
              onClick={submit}
              disabled={!canSend}
              className={`w-6 h-6 rounded transition flex items-center justify-center ${
                canSend
                  ? 'bg-collab-send text-white hover:bg-collab-send-hover shadow-xs active:scale-95'
                  : 'bg-slate-100 text-slate-300 cursor-not-allowed'
              }`}
              aria-label="Send"
              title={canSend ? 'Send message (Enter)' : 'Type a message to send'}
              data-testid="collab-composer-send"
            >
              <Send className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => stageFiles(e.target.files)}
      />
      <input
        ref={cameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => stageFiles(e.target.files)}
      />
    </div>
  );
}
