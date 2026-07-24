import React from 'react';
import { CheckCircle2, CloudLightning, AlertTriangle, Loader2 } from 'lucide-react';

interface SaveStatusIndicatorProps {
  status: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
}

export function SaveStatusIndicator({ status }: SaveStatusIndicatorProps) {
  switch (status) {
    case 'saved':
      return (
        <div className="flex items-center gap-1.5 text-emerald-600 bg-emerald-50 px-2 py-1 rounded text-xs font-semibold select-none animate-in fade-in duration-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Saved to cloud</span>
        </div>
      );
    case 'saving':
      return (
        <div className="flex items-center gap-1.5 text-zinc-500 bg-zinc-100 px-2 py-1 rounded text-xs font-semibold select-none animate-in fade-in duration-200">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          <span>Saving changes...</span>
        </div>
      );
    case 'unsaved':
      return (
        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 px-2 py-1 rounded text-xs font-semibold select-none animate-in fade-in duration-200">
          <CloudLightning className="w-3.5 h-3.5" />
          <span>Unsaved changes</span>
        </div>
      );
    case 'conflict':
      return (
        <div className="flex items-center gap-1.5 text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded text-xs font-semibold select-none animate-in shake duration-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Conflict: Edit Outdated</span>
        </div>
      );
    case 'error':
      return (
        <div className="flex items-center gap-1.5 text-rose-600 bg-rose-50 border border-rose-200 px-2 py-1 rounded text-xs font-semibold select-none animate-in fade-in duration-200">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Save failed</span>
        </div>
      );
    default:
      return null;
  }
}
