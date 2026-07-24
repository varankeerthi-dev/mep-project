import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingToggle } from '../components/SettingToggle';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { GeneralConfigData } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface GeneralTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const DEFAULT_GENERAL_DATA: GeneralConfigData = {
  round_off_enabled: true,
  auto_generate_item_codes: false,
};

export const GeneralTab: React.FC<GeneralTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const handleSave = async (data: GeneralConfigData) => {
    if (!orgId) return;
    const { error } = await supabase
      .from('organisations')
      .update({
        round_off_enabled: data.round_off_enabled,
      })
      .eq('id', orgId);

    if (error && error.code !== 'PGRST204') {
      toast.error('Failed to save general settings: ' + error.message);
      throw error;
    }

    toast.success('General settings saved successfully');
  };

  const {
    liveData,
    hasChanges,
    isSaving,
    draftAvailable,
    updateField,
    discard,
    save,
    restoreDraft,
    dismissDraft,
  } = useUnsavedChanges<GeneralConfigData>({
    initialData: DEFAULT_GENERAL_DATA,
    onSave: handleSave,
    storageKey: `settings_v2_draft_general_${orgId || 'default'}`,
  });

  // Notify parent shell of dirty state and save/discard handles
  React.useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  React.useEffect(() => {
    onRegisterSave(save, discard);
  }, [save, discard, onRegisterSave]);

  return (
    <div className="space-y-6">
      {draftAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center justify-between text-xs text-amber-900">
          <span>We found unsaved changes from your previous session.</span>
          <div className="flex items-center gap-2">
            <button
              onClick={restoreDraft}
              className="px-2.5 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-700 transition-colors"
            >
              Restore Draft
            </button>
            <button
              onClick={dismissDraft}
              className="px-2.5 py-1 bg-zinc-200 text-zinc-700 rounded font-medium hover:bg-zinc-300 transition-colors"
            >
              Discard
            </button>
          </div>
        </div>
      )}

      <SettingSection
        title="General Configuration"
        description="Configure application-wide defaults and rounding behaviors"
      >
        <SettingRow
          label="Enable Round Off"
          description="When enabled, line item rates and totals after discount will be rounded to the nearest integer."
        >
          <SettingToggle
            checked={liveData.round_off_enabled}
            onChange={(checked) => updateField('round_off_enabled', checked)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Auto-generate Item Codes"
          description="Automatically assign unique SKU / Item codes to new inventory items based on category prefixes."
        >
          <SettingToggle
            checked={liveData.auto_generate_item_codes}
            onChange={(checked) => updateField('auto_generate_item_codes', checked)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
