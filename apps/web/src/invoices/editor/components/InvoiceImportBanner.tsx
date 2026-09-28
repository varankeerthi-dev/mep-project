import { RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface InvoiceImportBannerProps {
  visible: boolean;
  onUndo: () => void;
}

export function InvoiceImportBanner({ visible, onUndo }: InvoiceImportBannerProps) {
  if (!visible) return null;

  return (
    <div className="bg-indigo-900/40 border border-indigo-800/60 text-indigo-200 px-6 py-3 rounded-lg flex items-center justify-between text-xs font-semibold mb-4 animate-in slide-in-from-top">
      <div className="flex items-center gap-2">
        <span className="bg-indigo-50/20 text-indigo-300 px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider">AI Imported</span>
        <span>All line items and header values were filled using the AI Document Parser.</span>
      </div>
      <Button variant="default" size="sm" type="button" onClick={onUndo}>
        <RotateCcw className="w-3.5 h-3.5" />
        Undo Import
      </Button>
    </div>
  );
}