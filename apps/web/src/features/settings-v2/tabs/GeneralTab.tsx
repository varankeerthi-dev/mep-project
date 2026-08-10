import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingToggle } from '../components/SettingToggle';
import { SettingRadioGroup } from '../components/SettingRadioGroup';
import { SettingSelect } from '../components/SettingSelect';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { GeneralConfigData } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganisationSettings } from '@/hooks/useOrganisationSettings';
import { DATE_FORMAT_OPTIONS, DEFAULT_DATE_FORMAT } from '@/lib/dateFormat';
import { Button } from '@/components/ui/button';

export interface GeneralTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const DEFAULT_GENERAL_DATA: GeneralConfigData = {
  round_off_enabled: true,
  auto_generate_item_codes: false,
  date_format: DEFAULT_DATE_FORMAT,
};

export const GeneralTab: React.FC<GeneralTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const { settings, updateSettings } = useOrganisationSettings();

  const orgDateFormat = settings?.date_format ?? DEFAULT_DATE_FORMAT;

  const initialData: GeneralConfigData = React.useMemo(
    () => ({ ...DEFAULT_GENERAL_DATA, date_format: orgDateFormat }),
    [orgDateFormat]
  );

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

    try {
      await updateSettings({ date_format: data.date_format });
    } catch (settingsError: any) {
      toast.error('Failed to save date format: ' + settingsError.message);
      throw settingsError;
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
    initialData,
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
            <Button variant="warning" size="sm" onClick={restoreDraft} >
              Restore Draft
            </Button>
            <Button variant="secondary" size="sm" onClick={dismissDraft} >
              Discard
            </Button>
          </div>
        </div>
      )}

      <SettingSection>
        <SettingRow
          label="Enable Round Off"
          description="When enabled, line item rates and totals after discount will be rounded to the nearest integer."
        >
          <SettingRadioGroup
            variant="segmented"
            options={[
              { label: 'Off', value: false },
              { label: 'On', value: true },
            ]}
            value={liveData.round_off_enabled}
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

        <SettingRow
          label="Date Format"
          description="How dates are displayed across the app. Changing this updates every screen immediately."
        >
          <SettingSelect
            options={DATE_FORMAT_OPTIONS}
            value={liveData.date_format}
            onChange={(value) => updateField('date_format', value)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
