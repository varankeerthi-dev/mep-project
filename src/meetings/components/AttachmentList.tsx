import { useCallback, memo } from 'react';
import { X, FileText, Image, File } from 'lucide-react';

interface Attachment {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number;
  file_path?: string;
}

interface AttachmentListProps {
  attachments: File[];
  existingAttachments?: Attachment[];
  onRemove: (index: number) => void;
  onRemoveExisting?: (id: string) => void;
  readonly?: boolean;
}

const FILE_ICONS: Record<string, React.ReactNode> = {
  'application/pdf': <FileText size={16} className="text-red-500" />,
  'image/jpeg': <Image size={16} className="text-blue-500" />,
  'image/png': <Image size={16} className="text-blue-500" />,
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getFileIcon(fileType: string) {
  return FILE_ICONS[fileType] || <File size={16} className="text-slate-400" />;
}

export const AttachmentList = memo(function AttachmentList({
  attachments,
  existingAttachments = [],
  onRemove,
  onRemoveExisting,
  readonly = false,
}: AttachmentListProps) {
  const hasAttachments = attachments.length > 0 || existingAttachments.length > 0;
  
  return (
    <div className="space-y-2">
      {/* Existing Attachments from Server */}
      {existingAttachments.map((attachment) => (
        <div
          key={attachment.id}
          className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-200"
        >
          <div className="flex items-center gap-3">
            {getFileIcon(attachment.file_type)}
            <div>
              <div className="text-sm font-medium text-slate-800">
                {attachment.file_name}
              </div>
              <div className="text-xs text-slate-500">
                {formatFileSize(attachment.file_size)}
              </div>
            </div>
          </div>
          {!readonly && onRemoveExisting && (
            <button
              type="button"
              onClick={() => onRemoveExisting(attachment.id)}
              className="p-1.5 hover:bg-red-100 text-red-600 rounded"
              title="Remove attachment"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      
      {/* New Attachments (Files) */}
      {attachments.map((file, index) => (
        <div
          key={`file-${index}`}
          className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-200"
        >
          <div className="flex items-center gap-3">
            {getFileIcon(file.type)}
            <div>
              <div className="text-sm font-medium text-slate-800">
                {file.name}
              </div>
              <div className="text-xs text-slate-500">
                {formatFileSize(file.size)}
              </div>
            </div>
          </div>
          {!readonly && (
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="p-1.5 hover:bg-red-100 text-red-600 rounded"
              title="Remove attachment"
            >
              <X size={16} />
            </button>
          )}
        </div>
      ))}
      
      {!hasAttachments && (
        <div className="text-center py-4 text-sm text-slate-500">
          No attachments yet
        </div>
      )}
    </div>
  );
});

export default AttachmentList;