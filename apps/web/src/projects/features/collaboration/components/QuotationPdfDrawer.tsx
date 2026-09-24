// QuotationPdfDrawer.tsx - side drawer showing a quotation PDF next to the
// channel, so the approver reads the document while typing comments inline.
// Collapses to a slim rail (minimize) so the channel gets full width back;
// expanding or the card's View PDF button reopens it.
import { X, ExternalLink, Minus, FileText, ChevronLeft } from 'lucide-react';
import { useCollabStore } from '../store';

export function QuotationPdfDrawer() {
  const quotationId = useCollabStore((s) => s.pdfDrawerQuotationId);
  const minimized = useCollabStore((s) => s.pdfDrawerMinimized);
  const closePdfDrawer = useCollabStore((s) => s.closePdfDrawer);
  const toggleMinimized = useCollabStore((s) => s.togglePdfDrawerMinimized);

  if (!quotationId) return null;

  const embedUrl = `/quotation/view?id=${quotationId}&embed=true`;

  if (minimized) {
    return (
      <div
        className="fixed inset-y-0 right-0 z-[200] w-12 bg-white border-l border-zinc-200 shadow-2xl flex flex-col items-center py-3 gap-2"
        data-testid="collab-pdf-drawer-minimized"
      >
        <button
          type="button"
          onClick={toggleMinimized}
          title="Expand PDF preview"
          className="p-2 text-zinc-600 hover:text-zinc-900 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <FileText className="h-4 w-4 text-zinc-400" />
        <button
          type="button"
          onClick={closePdfDrawer}
          title="Close preview"
          className="mt-auto p-2 text-zinc-500 hover:text-zinc-800 rounded-md hover:bg-zinc-100 transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-y-0 right-0 z-[200] w-full max-w-xl bg-white border-l border-zinc-200 shadow-2xl flex flex-col"
      data-testid="collab-pdf-drawer"
    >
      <div className="flex items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 shrink-0 bg-white">
        <div className="text-sm font-bold text-zinc-900">Quotation PDF</div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={toggleMinimized}
            title="Minimize preview"
            className="p-1.5 text-zinc-500 hover:text-zinc-800 rounded hover:bg-zinc-100 transition-colors"
          >
            <Minus className="h-4 w-4" />
          </button>
          <a
            href={embedUrl}
            target="_blank"
            rel="noreferrer"
            title="Open in new tab"
            className="p-1.5 text-zinc-500 hover:text-zinc-800 rounded hover:bg-zinc-100 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          <button
            type="button"
            onClick={closePdfDrawer}
            title="Close preview"
            className="p-1.5 text-zinc-500 hover:text-zinc-800 rounded hover:bg-zinc-100 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
      <iframe
        src={embedUrl}
        className="flex-1 w-full border-none bg-zinc-100"
        title="Quotation PDF preview"
      />
    </div>
  );
}
