// AttachmentPreview.tsx — small preview of a staged attachment before send.
import { X, Loader2, AlertCircle } from 'lucide-react';
import type { StagedAttachment } from '../types';

interface Props {
  attachments: StagedAttachment[];
  onRemove: (id: string) => void;
}

export function AttachmentPreview({ attachments, onRemove }: Props) {
  if (attachments.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-2 mb-2" data-testid="collab-attachment-staging">
      {attachments.map((a) => (
        <div
          key={a.id}
          className="relative group flex items-center gap-2 bg-gray-50 border rounded px-2 py-1.5 text-xs max-w-[200px]"
        >
          {a.previewUrl && a.file.type.startsWith('image/') ? (
            <img
              src={a.previewUrl}
              alt={a.file.name}
              className="h-8 w-8 object-cover rounded"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-gray-200 flex items-center justify-center text-[10px] text-gray-500">
              {a.file.type.split('/')[1]?.toUpperCase().slice(0, 4) ?? 'FILE'}
            </div>
          )}
          <div className="truncate">
            <div className="truncate font-medium">{a.file.name}</div>
            <div className="text-gray-500">{(a.file.size / 1024).toFixed(1)} KB</div>
          </div>
          {a.uploaded ? null : a.failed ? (
            <AlertCircle className="h-3.5 w-3.5 text-red-500" aria-label="Upload failed" />
          ) : (
            <Loader2 className="h-3.5 w-3.5 text-gray-400 animate-spin" aria-label="Uploading" />
          )}
          <button
            type="button"
            onClick={() => onRemove(a.id)}
            className="absolute -top-1.5 -right-1.5 bg-white border rounded-full p-0.5 text-gray-500 hover:text-red-600"
            aria-label="Remove attachment"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  );
}
