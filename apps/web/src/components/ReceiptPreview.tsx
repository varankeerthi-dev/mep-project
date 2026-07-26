// ============================================
// RECEIPT PREVIEW COMPONENT
// Shows receipt thumbnail with expand-to-full-view
// ============================================
import { useState } from 'react';
import { FileText, ExternalLink, X, Download } from 'lucide-react';

interface ReceiptPreviewProps {
  url: string;
  fileName?: string;
  size?: 'sm' | 'md' | 'lg';
  showActions?: boolean;
}

const sizeClasses = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

export default function ReceiptPreview({
  url,
  fileName,
  size = 'sm',
  showActions = true,
}: ReceiptPreviewProps) {
  const [expanded, setExpanded] = useState(false);
  const isImage = /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(url);
  const isPDF = /\.pdf$/i.test(url);

  if (!url) return null;

  return (
    <>
      {/* Thumbnail */}
      <div
        className={`relative ${sizeClasses[size]} shrink-0 cursor-pointer overflow-hidden rounded-lg border border-zinc-200 bg-zinc-50 transition-all hover:shadow-md group`}
        onClick={() => setExpanded(true)}
      >
        {isImage ? (
          <img
            src={url}
            alt={fileName || 'Receipt'}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <FileText size={size === 'sm' ? 14 : 20} className="text-zinc-400" />
          </div>
        )}
        {showActions && (
          <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
            <ExternalLink size={12} className="text-white" />
          </div>
        )}
      </div>

      {/* Expanded View */}
      {expanded && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-auto rounded-xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <span className="text-sm font-medium text-zinc-700 truncate">
                {fileName || 'Receipt'}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
                >
                  <Download size={12} />
                  Download
                </a>
                <button
                  onClick={() => setExpanded(false)}
                  className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="p-4">
              {isImage ? (
                <img
                  src={url}
                  alt={fileName || 'Receipt'}
                  className="max-h-[70vh] rounded-lg object-contain"
                />
              ) : isPDF ? (
                <iframe
                  src={url}
                  className="h-[70vh] w-[600px] rounded-lg border border-zinc-200"
                  title={fileName || 'Receipt'}
                />
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg bg-zinc-50">
                  <div className="text-center">
                    <FileText size={32} className="mx-auto mb-2 text-zinc-300" />
                    <p className="text-sm text-zinc-500">Preview not available</p>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
                    >
                      Open file <ExternalLink size={12} />
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
