import React, { useMemo, useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { SettingSelect } from '../components/SettingSelect';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { OrganisationInfoData } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Upload, Trash2, Building, ImageIcon } from 'lucide-react';

export interface OrganisationTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand',
  'Karnataka', 'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur',
  'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Punjab',
  'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Puducherry'
].map(s => ({ label: s, value: s }));

const EMPTY_ORG_DATA: OrganisationInfoData = {
  name: '',
  gstin: '',
  pan: '',
  tan: '',
  msme_no: '',
  website: '',
  state: 'Maharashtra',
  logo_url: '',
  address_line1: '',
  address_line2: '',
  city_state_pincode: '',
  phone: '',
  email: '',
};

export const OrganisationTab: React.FC<OrganisationTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);

  // Fetch real live organisation row from Supabase
  const { data: orgData, isLoading } = useQuery({
    queryKey: ['organisation_details', orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organisations')
        .select('*')
        .eq('id', orgId!)
        .single();
      if (error && error.code !== 'PGRST204') throw error;
      return data;
    },
  });

  const dbData: OrganisationInfoData = useMemo(() => {
    const raw = orgData || organisation || {};
    const fullAddress = (raw.address as string) || '';
    const parts = fullAddress.split(',').map((s) => s.trim());
    return {
      name: (raw.name as string) || '',
      gstin: (raw.gstin as string) || '',
      pan: (raw.pan as string) || '',
      tan: (raw.tan as string) || '',
      msme_no: (raw.msme_no as string) || '',
      website: (raw.website as string) || '',
      state: (raw.state as string) || 'Maharashtra',
      logo_url: (raw.logo_url as string) || '',
      address_line1: parts[0] || '',
      address_line2: parts[1] || '',
      city_state_pincode: parts.slice(2).join(', ') || '',
      phone: (raw.phone as string) || '',
      email: (raw.email as string) || '',
    };
  }, [orgData, organisation]);

  // Purge any stale draft that contained obsolete hardcoded demo data
  useEffect(() => {
    const key = `settings_v2_draft_org_${orgId || 'default'}`;
    const stored = localStorage.getItem(key);
    if (stored && stored.includes('Antigravity Engineering Solutions')) {
      localStorage.removeItem(key);
    }
  }, [orgId]);

  const handleSave = async (data: OrganisationInfoData) => {
    if (!orgId) return;
    const addressParts = [
      data.address_line1,
      data.address_line2,
      data.city_state_pincode,
    ]
      .filter(Boolean)
      .join(', ');

    const { error } = await supabase
      .from('organisations')
      .update({
        name: data.name,
        gstin: data.gstin,
        pan: data.pan,
        tan: data.tan,
        msme_no: data.msme_no,
        website: data.website,
        state: data.state,
        logo_url: data.logo_url,
        address: addressParts,
        phone: data.phone,
        email: data.email,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orgId);

    if (error && error.code !== 'PGRST204') {
      toast.error('Failed to save organisation details: ' + error.message);
      throw error;
    }

    queryClient.invalidateQueries({ queryKey: ['organisation_details', orgId] });
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
    initialData: dbData,
    onSave: handleSave,
    storageKey: `settings_v2_draft_org_${orgId || 'default'}`,
  });

  React.useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  React.useEffect(() => {
    onRegisterSave(save, discard);
  }, [save, discard, onRegisterSave]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !orgId) return;
    try {
      setUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_logo.${fileExt}`;
      const filePath = `${orgId}/logos/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('organisation-assets')
        .upload(filePath, file, { upsert: true });

      if (uploadError) {
        // Try creating bucket if not exists
        await supabase.storage.createBucket('organisation-assets', {
          public: true,
          fileSizeLimit: 5242880,
        });
        const { error: retryError } = await supabase.storage
          .from('organisation-assets')
          .upload(filePath, file, { upsert: true });
        if (retryError) throw retryError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from('organisation-assets').getPublicUrl(filePath);

      updateField('logo_url', publicUrl);
      toast.success('Logo uploaded successfully');
    } catch (err: any) {
      console.error('Logo upload error:', err);
      toast.error('Failed to upload logo: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (isLoading && !orgData && !organisation) {
    return (
      <div className="py-12 text-center text-sm text-zinc-400">
        Loading organisation data...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {draftAvailable && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 flex items-center justify-between text-xs text-amber-900">
          <span>We found unsaved changes from your previous session.</span>
          <div className="flex items-center gap-2">
            <Button variant="warning" size="default" onClick={restoreDraft}>
              Restore Draft
            </Button>
            <Button variant="secondary" size="default" onClick={dismissDraft}>
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Branding & Logo */}
      <SettingSection
        title="Organisation Identity & Branding"
        description="Company name and official logo displayed across vouchers, invoices, and reports"
      >
        <SettingRow label="Organisation Name" required>
          <SettingInput
            value={liveData.name}
            onChange={(val) => updateField('name', val)}
            placeholder="e.g. My Company Private Limited"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Company Logo"
          description="Square or horizontal PNG/JPG/SVG, max 5MB"
        >
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 rounded-lg border border-zinc-200 bg-zinc-50 flex items-center justify-center overflow-hidden shrink-0">
              {liveData.logo_url ? (
                <img
                  src={liveData.logo_url}
                  alt="Organisation Logo"
                  className="w-full h-full object-contain p-1"
                />
              ) : (
                <Building className="w-8 h-8 text-zinc-300" />
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="cursor-pointer">
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded-md border border-zinc-300 transition-colors">
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? 'Uploading...' : 'Upload New Logo'}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                  disabled={uploading || isSaving}
                />
              </label>
              {liveData.logo_url && (
                <button
                  type="button"
                  onClick={() => updateField('logo_url', '')}
                  className="inline-flex items-center gap-1 text-xs text-rose-600 hover:text-rose-700 w-fit cursor-pointer"
                >
                  <Trash2 className="w-3 h-3" /> Remove logo
                </button>
              )}
            </div>
          </div>
        </SettingRow>
      </SettingSection>

      {/* Tax & Registration */}
      <SettingSection
        title="Tax & Legal Registrations"
        description="Statutory identifiers used for GST compliance, invoicing, and tax filings"
      >
        <SettingRow
          label="GSTIN Number"
          description="15-character Goods and Services Tax Identification Number"
        >
          <SettingInput
            value={liveData.gstin}
            onChange={(val) => updateField('gstin', val.toUpperCase())}
            placeholder="e.g. 27AAAAA0000A1Z5"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="PAN Number"
          description="10-character Permanent Account Number"
        >
          <SettingInput
            value={liveData.pan}
            onChange={(val) => updateField('pan', val.toUpperCase())}
            placeholder="e.g. AAAAA0000A"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="TAN Number" description="Tax Deduction Account Number">
          <SettingInput
            value={liveData.tan}
            onChange={(val) => updateField('tan', val.toUpperCase())}
            placeholder="e.g. PNEA12345B"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="MSME / Udyam Number"
          description="Micro, Small & Medium Enterprises registration"
        >
          <SettingInput
            value={liveData.msme_no}
            onChange={(val) => updateField('msme_no', val)}
            placeholder="e.g. UDYAM-MH-12-0001234"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Registered State">
          <SettingSelect
            options={INDIAN_STATES}
            value={liveData.state}
            onChange={(val) => updateField('state', val)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>

      {/* Address & Contact */}
      <SettingSection
        title="Address & Contact Details"
        description="Registered office address and primary contact details for communication"
      >
        <SettingRow label="Address Line 1">
          <SettingInput
            value={liveData.address_line1}
            onChange={(val) => updateField('address_line1', val)}
            placeholder="Premises / Building / Street name"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Address Line 2">
          <SettingInput
            value={liveData.address_line2}
            onChange={(val) => updateField('address_line2', val)}
            placeholder="Area / Landmark / Industrial Estate"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="City / Pincode">
          <SettingInput
            value={liveData.city_state_pincode}
            onChange={(val) => updateField('city_state_pincode', val)}
            placeholder="e.g. Pune, 411001"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Primary Phone">
          <SettingInput
            value={liveData.phone}
            onChange={(val) => updateField('phone', val)}
            placeholder="e.g. +91 98765 43210"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Primary Email">
          <SettingInput
            type="email"
            value={liveData.email}
            onChange={(val) => updateField('email', val)}
            placeholder="e.g. info@company.com"
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow label="Official Website">
          <SettingInput
            value={liveData.website}
            onChange={(val) => updateField('website', val)}
            placeholder="e.g. https://www.company.com"
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
