import React from 'react';
import { AlertTriangle, X } from 'lucide-react';

export interface UnsavedChangesDialogProps {
  isOpen: boolean;
  tabLabel?: string;
  onSaveAndProceed: () => void;
  onDiscardAndProceed: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export const UnsavedChangesDialog: React.FC<UnsavedChangesDialogProps> = ({
  isOpen,
  tabLabel,
  onSaveAndProceed,
  onDiscardAndProceed,
  onCancel,
  isSaving = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
      <div
        className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-zinc-200 animate-in fade-in zoom-in-95 duration-150"
        style={{ borderRadius: '12px' }}
      >
        {/* Header */}
        <div className="px-6 pt-5 pb-4 flex items-start justify-between border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-zinc-900">
                Unsaved Changes
              </h3>
              <p className="text-xs text-zinc-500 mt-0.5">
                You have unsaved edits {tabLabel ? `in "${tabLabel}"` : ''}.
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          <p className="text-xs text-zinc-600 leading-relaxed">
            What would you like to do before switching sections? If you discard,
            all changes made since your last save will be lost.
          </p>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 bg-zinc-50/80 border-t border-zinc-100 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium text-zinc-600 hover:bg-zinc-200/60 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onDiscardAndProceed}
            disabled={isSaving}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors cursor-pointer"
          >
            Discard & Proceed
          </button>
          <button
            type="button"
            onClick={onSaveAndProceed}
            disabled={isSaving}
            className="px-4 py-1.5 rounded-md text-xs font-medium text-white shadow-xs transition-colors cursor-pointer"
            style={{
              backgroundColor: '#185FA5',
              padding: '6px 14px',
              fontSize: '12px',
            }}
          >
            {isSaving ? 'Saving...' : 'Save & Proceed'}
          </button>
        </div>
      </div>
    </div>
  );
};
