// Composer.tsx — text + attachment + mention composer.
import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import { Send, Paperclip, Image as ImageIcon, Mic, X } from 'lucide-react';
import { useAuth } from '../../../../contexts/AuthContext';
import { useCollabStore } from '../store';
import { useSendMessage } from '../hooks';
import { AttachmentPreview } from './AttachmentPreview';
import { uploadAttachment, addAttachment } from '../api';
import type { StagedAttachment } from '../types';
import { AttachmentMetaSchema, MessageDraftSchema } from '../schemas';

interface Props {
  channelId: string;
  parentMessageId?: string | null;
  replyHintName?: string;
  onCancelReply?: () => void;
}

export function Composer({ channelId, parentMessageId, replyHintName, onCancelReply }: Props) {
  const { organisation } = useAuth();
  const orgId = organisation?.id ?? '';
  const send = useSendMessage(channelId);
  const [text, setText] = useState('');
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const stagedRef = useRef<StagedAttachment[]>([]);
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const setDraft = useCollabStore((s) => s.setDraft);
  const clearDraft = useCollabStore((s) => s.clearDraft);

  const draftKey = useMemo(
    () => `${channelId}:${parentMessageId ?? 'root'}`,
    [channelId, parentMessageId],
  );

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

  const submit = useCallback(async () => {
    try {
      const draft = MessageDraftSchema.parse({
        text: text.trim(),
        parentMessageId: parentMessageId ?? null,
        mentions: [],
        linkedEntities: [],
      });
      await Promise.all(
        staged.filter((s) => !s.uploaded && !s.failed).map(uploadStaged),
      );
      const saved = await send.mutateAsync(draft);
      // For every successfully uploaded attachment, create the DB row that
      // links the file in storage to the just-created message. We do this
      // best-effort: a failed attachment row does not delete the message.
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
              // attachment row failed; the file exists in storage and
              // the message exists. A follow-up sweep can reconcile.
            }
          }),
      );
      staged.forEach((s) => {
        if (s.previewUrl) URL.revokeObjectURL(s.previewUrl);
      });
      setText('');
      setStaged([]);
      clearDraft(draftKey);
    } catch {
      setDraft(draftKey, { text, attachments: staged, parentMessageId: parentMessageId ?? null });
    }
  }, [text, parentMessageId, staged, send, clearDraft, setDraft, draftKey, uploadStaged]);

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (canSend) submit();
    }
  };

  return (
    <div className="border-t bg-white px-3 py-2" data-testid="collab-composer">
      {parentMessageId && (
        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
          <span>Replying in thread{replyHintName ? ` to ${replyHintName}` : ''}</span>
          {onCancelReply && (
            <button type="button" onClick={onCancelReply} className="ml-auto text-gray-500 hover:text-gray-800">
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      )}

      <AttachmentPreview attachments={staged} onRemove={removeStaged} />

      <div className="flex items-end gap-2">
        <textarea
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setDraft(draftKey, { text: e.target.value, attachments: staged, parentMessageId: parentMessageId ?? null });
          }}
          onKeyDown={onKey}
          rows={1}
          placeholder={parentMessageId ? 'Reply…' : 'Message…'}
          className="flex-1 resize-none rounded border px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 max-h-40"
          data-testid="collab-composer-textarea"
        />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-800"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 text-gray-500 hover:text-gray-800"
            aria-label="Attach photo"
          >
            <ImageIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => { /* voice note — Phase 2 */ }}
            className="p-2 text-gray-300 cursor-not-allowed"
            aria-label="Record voice (coming soon)"
            disabled
            title="Voice note — coming soon"
          >
            <Mic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={!canSend}
            className="p-2 text-blue-600 disabled:text-gray-300"
            aria-label="Send"
            data-testid="collab-composer-send"
          >
            <Send className="h-4 w-4" />
          </button>
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
