import React from 'react';
import { Save, RotateCcw, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
          <Button variant="secondary" size="xs" type="button" onClick={onDiscard} disabled={isSaving} >
            <RotateCcw className="w-3.5 h-3.5 text-zinc-500" />
            Discard Changes
          </Button>
          <Button variant="default" size="default" type="button" onClick={onSave} disabled={isSaving} style={{ backgroundColor: '#185FA5', padding: '6px 14px', fontSize: '12px', fontWeight: 500, borderRadius: '6px', }} onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = '#0C447C')
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = '#185FA5')
            }
          >
            <Save className="w-3.5 h-3.5 text-white" />
            {isSaving ? 'Saving Changes...' : 'Save Changes'}
          </Button>
        </div>
      </div>
    </div>
  );
};
