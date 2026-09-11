import React, { useMemo, useEffect } from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { SettingSelect } from '../components/SettingSelect';
import { SettingToggle } from '../components/SettingToggle';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { ToolsConfigData, SettingsTabContract } from '../types';
import { toast } from '@/lib/logger';
import { useAuth } from '@/contexts/AuthContext';
import { useOrganisationSettings } from '@/hooks/useOrganisationSettings';
import { Button } from '@/components/ui/button';

export interface ToolsTabProps {
  onDirtyChange?: (isDirty: boolean) => void;
  onRegisterSave?: (saveFn: () => Promise<void>, discardFn: () => void) => void;
  onRegisterContract?: (contract: SettingsTabContract<ToolsConfigData>) => void;
}

const DEFAULT_TOOLS_DATA: ToolsConfigData = {
  default_location: 'Warehouse',
  stock_alerts_enabled: true,
  min_stock_level: 5,
  default_pdf_template: 'classic',
  show_make_column: true,
  show_hsn_column: true,
};

const LOCATION_OPTIONS = [
  { label: 'Warehouse', value: 'Warehouse' },
  { label: 'Main Office', value: 'Main Office' },
  { label: 'Central Store', value: 'Central Store' },
  { label: 'Regional Hub', value: 'Regional Hub' },
];

const TEMPLATE_OPTIONS = [
  { label: 'Classic Template', value: 'classic' },
  { label: 'ProGrid Template', value: 'progrid' },
];

export const ToolsTab: React.FC<ToolsTabProps> = ({
  onDirtyChange,
  onRegisterSave,
  onRegisterContract,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const { settings, updateSettings, isLoading } = useOrganisationSettings();

  const initialData: ToolsConfigData = useMemo(() => {
    const toolsSettings = settings?.tools || {};
    return {
      default_location: toolsSettings.default_location || DEFAULT_TOOLS_DATA.default_location,
      stock_alerts_enabled: toolsSettings.stock_alerts_enabled !== undefined 
        ? Boolean(toolsSettings.stock_alerts_enabled) 
        : DEFAULT_TOOLS_DATA.stock_alerts_enabled,
      min_stock_level: typeof toolsSettings.min_stock_level === 'number' 
        ? toolsSettings.min_stock_level 
        : DEFAULT_TOOLS_DATA.min_stock_level,
      default_pdf_template: toolsSettings.default_pdf_template || DEFAULT_TOOLS_DATA.default_pdf_template,
      show_make_column: toolsSettings.show_make_column !== undefined 
        ? Boolean(toolsSettings.show_make_column) 
        : DEFAULT_TOOLS_DATA.show_make_column,
      show_hsn_column: toolsSettings.show_hsn_column !== undefined 
        ? Boolean(toolsSettings.show_hsn_column) 
        : DEFAULT_TOOLS_DATA.show_hsn_column,
    };
  }, [settings?.tools]);

  const handleSave = async (data: ToolsConfigData) => {
    if (!orgId) {
      toast.error('No organisation active');
      return;
    }

    try {
      await updateSettings({ tools: data });
      toast.success('Tools & Equipment preferences saved successfully');
    } catch (error: any) {
      toast.error('Failed to save tools settings: ' + (error?.message || 'Unknown error'));
      throw error;
    }
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
    getContract,
  } = useUnsavedChanges<ToolsConfigData>({
    initialData,
    onSave: handleSave,
    storageKey: `settings_v2_draft_tools_${orgId || 'default'}`,
  });

  // Notify parent shell
  useEffect(() => {
    onDirtyChange?.(hasChanges);
  }, [hasChanges, onDirtyChange]);

  useEffect(() => {
    onRegisterSave?.(save, discard);
  }, [save, discard, onRegisterSave]);

  useEffect(() => {
    onRegisterContract?.(getContract());
  }, [getContract, onRegisterContract]);

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs text-zinc-400">
        Loading tools preferences...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {draftAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-amber-900">
          <span>We found unsaved changes from your previous session.</span>
          <div className="flex items-center gap-2">
            <Button variant="warning" size="sm" onClick={restoreDraft}>
              Restore Draft
            </Button>
            <Button variant="secondary" size="sm" onClick={dismissDraft}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* General Configuration */}
      <SettingSection
        title="General & Inventory Rules"
        description="Configure default storage assignments, stock alert thresholds, and automated monitoring for tools and equipment."
      >
        <SettingRow
          label="Organisation"
          description="Active organisation owning this tool catalog."
        >
          <span className="text-xs font-semibold text-zinc-700">
            {organisation?.name || 'Default Organisation'}
          </span>
        </SettingRow>

        <SettingRow
          label="Default Tools Location"
          description="Primary warehouse or depot automatically assigned to newly registered equipment."
        >
          <SettingSelect
            options={LOCATION_OPTIONS}
            value={liveData.default_location}
            onChange={(val) => updateField('default_location', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Low Stock Alerts"
          description="Notify site and warehouse managers when available tool inventory dips below minimum threshold."
        >
          <SettingToggle
            checked={liveData.stock_alerts_enabled}
            onChange={(checked) => updateField('stock_alerts_enabled', checked)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Minimum Stock Level"
          description="Quantity threshold that triggers a restock recommendation or low-stock warning."
        >
          <SettingInput
            type="number"
            value={liveData.min_stock_level}
            onChange={(val) => updateField('min_stock_level', Math.max(0, parseInt(val, 10) || 0))}
            disabled={isSaving}
            className="w-32"
          />
        </SettingRow>
      </SettingSection>

      {/* PDF & Documentation Templates */}
      <SettingSection
        title="Template & Print Layouts"
        description="Customize document columns, layout presets, and legal identifiers on tool delivery challans and equipment issue notes."
      >
        <SettingRow
          label="Default PDF Template"
          description="Standard layout format used when generating tool issue receipts and return challans."
        >
          <SettingSelect
            options={TEMPLATE_OPTIONS}
            value={liveData.default_pdf_template}
            onChange={(val) => updateField('default_pdf_template', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Show 'Make / Tool Source' Column"
          description="Include manufacturer and source origin branding in printed tool challans."
        >
          <SettingToggle
            checked={liveData.show_make_column}
            onChange={(checked) => updateField('show_make_column', checked)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Show 'HSN Code' Column"
          description="Print HSN / SAC classification codes for equipment billing and GST auditing."
        >
          <SettingToggle
            checked={liveData.show_hsn_column}
            onChange={(checked) => updateField('show_hsn_column', checked)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
