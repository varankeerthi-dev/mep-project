import React from 'react';
import { Save, RotateCcw, AlertCircle } from 'lucide-react';

export interface SettingsGlobalSaveBarProps {
  hasChanges: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
  tabLabel?: string;
}

export const SettingsGlobalSaveBar: React.FC<SettingsGlobalSaveBarProps> = ({
  hasChanges,
  isSaving,
  onSave,
  onDiscard,
  tabLabel,
}) => {
  if (!hasChanges) return null;

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-zinc-200 px-8 py-3.5 shadow-lg flex items-center justify-between transition-all duration-300 animate-in slide-in-from-bottom-4"
      style={{
        boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
      }}
    >
      <div className="flex items-center gap-2.5 max-w-7xl mx-auto w-full justify-between">
        <div className="flex items-center gap-2 text-xs text-amber-900 bg-amber-50 border border-amber-200/80 px-3 py-1.5 rounded-md font-medium">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>
            You have unsaved changes {tabLabel ? `in ${tabLabel}` : ''}.
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSaving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-zinc-700 bg-zinc-100 hover:bg-zinc-200 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
            style={{ fontSize: '12px' }}
          >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
            Discard Changes
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="flex items-center gap-1.5 text-white rounded-md font-medium shadow-xs transition-all cursor-pointer disabled:opacity-50"
            style={{
              backgroundColor: '#185FA5',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 500,
              borderRadius: '6px',
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = '#0C447C')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = '#185FA5')
            }
          >
            <Save className="w-3.5 h-3.5 text-white" />
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
};
