import React from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
          <Button variant="secondary" size="default" onClick={onCancel} >
            <X className="w-4 h-4" />
          </Button>
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
          <Button variant="secondary" size="xs" type="button" onClick={onCancel} disabled={isSaving} >
            Cancel
          </Button>
          <Button variant="destructive" size="xs" type="button" onClick={onDiscardAndProceed} disabled={isSaving} >
            Discard & Proceed
          </Button>
          <Button variant="default" size="xs" type="button" onClick={onSaveAndProceed} disabled={isSaving} style={{ backgroundColor: '#185FA5', padding: '6px 14px', fontSize: '12px', }} >
            {isSaving ? 'Saving...' : 'Save & Proceed'}
          </Button>
        </div>
      </div>
    </div>
  );
};
