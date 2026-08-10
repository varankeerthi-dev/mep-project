import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { OrganisationInfoData } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export interface OrganisationTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const DEFAULT_ORG_DATA: OrganisationInfoData = {
  name: 'Antigravity Engineering Solutions',
  gstin: '27AAAAA0000A1Z5',
  pan: 'AAAAA0000A',
  logo_url: '',
  address_line1: 'Plot 42, Industrial Estate, Phase II',
  address_line2: 'Chakan MIDC',
  city_state_pincode: 'Pune, Maharashtra - 410501',
  phone: '+91 98765 43210',
  email: 'contact@mep-project.com',
};

export const OrganisationTab: React.FC<OrganisationTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const handleSave = async (data: OrganisationInfoData) => {
    if (!orgId) return;
    const { error } = await supabase
      .from('organisations')
      .update({
        name: data.name,
        gstin: data.gstin,
        pan: data.pan,
        address: `${data.address_line1}, ${data.address_line2}, ${data.city_state_pincode}`,
        phone: data.phone,
        email: data.email,
      })
      .eq('id', orgId);

    if (error && error.code !== 'PGRST204') {
      toast.error('Failed to save organisation details: ' + error.message);
      throw error;
    }

    toast.success('Organisation details saved successfully');
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
  } = useUnsavedChanges<OrganisationInfoData>({
    initialData: DEFAULT_ORG_DATA,
    onSave: handleSave,
    storageKey: `settings_v2_draft_org_${orgId || 'default'}`,
  });

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
            <Button variant="warning" size="default" onClick={restoreDraft} >
              Restore Draft
            </Button>
            <Button variant="secondary" size="default" onClick={dismissDraft} >
              Discard
            </Button>
          </div>
        </div>
      )}

      <SettingSection
        title="Organisation Identity & Tax Information"
        description="Company details printed on official financial documents and vouchers"
      >
        <SettingRow label="Organisation Name" required>
          <SettingInput
            value={liveData.name}
            onChange={(val) => updateField('name', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="GSTIN Number" description="15-character GST identification number">
          <SettingInput
            value={liveData.gstin}
            onChange={(val) => updateField('gstin', val)}
            placeholder="e.g. 27AAAAA0000A1Z5"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="PAN Number" description="10-character Permanent Account Number">
          <SettingInput
            value={liveData.pan}
            onChange={(val) => updateField('pan', val)}
            placeholder="e.g. AAAAA0000A"
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>

      <SettingSection
        title="Address & Contact Details"
        description="Registered office address and primary contact details"
      >
        <SettingRow label="Address Line 1">
          <SettingInput
            value={liveData.address_line1}
            onChange={(val) => updateField('address_line1', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Address Line 2">
          <SettingInput
            value={liveData.address_line2}
            onChange={(val) => updateField('address_line2', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="City / State / Pincode">
          <SettingInput
            value={liveData.city_state_pincode}
            onChange={(val) => updateField('city_state_pincode', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Phone">
          <SettingInput
            value={liveData.phone}
            onChange={(val) => updateField('phone', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Email">
          <SettingInput
            type="email"
            value={liveData.email}
            onChange={(val) => updateField('email', val)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
