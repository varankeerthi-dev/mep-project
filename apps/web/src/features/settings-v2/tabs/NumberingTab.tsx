import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { SettingToggle } from '../components/SettingToggle';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { DocumentNumberSeries } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface NumberingTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

interface NumberingState {
  prevent_duplicate: boolean;
  series: Record<string, DocumentNumberSeries>;
}

const DEFAULT_SERIES: Record<string, DocumentNumberSeries> = {
  QUOTATION: { id: '1', doc_type: 'QUOTATION', label: 'Quotation', prefix: 'QT-', start_number: 1, padding: 4, suffix: '-26', prevent_duplicate: true },
  INVOICE: { id: '2', doc_type: 'INVOICE', label: 'Invoice', prefix: 'INV-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
  PURCHASE_ORDER: { id: '3', doc_type: 'PURCHASE_ORDER', label: 'Purchase Order', prefix: 'PO-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
  DELIVERY_CHALLAN: { id: '4', doc_type: 'DELIVERY_CHALLAN', label: 'Delivery Challan', prefix: 'DC-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
  NON_BILLABLE_DC: { id: '5', doc_type: 'NON_BILLABLE_DC', label: 'Non-Billable DC', prefix: 'NDC-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
  PAYMENT_RECEIPT: { id: '6', doc_type: 'PAYMENT_RECEIPT', label: 'Payment Receipt', prefix: 'RCT-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
  VENDOR_CODE: { id: '7', doc_type: 'VENDOR_CODE', label: 'Vendor Code', prefix: 'VEN-', start_number: 1, padding: 4, suffix: '', prevent_duplicate: true },
};

const DEFAULT_NUMBERING_STATE: NumberingState = {
  prevent_duplicate: true,
  series: DEFAULT_SERIES,
};

export const NumberingTab: React.FC<NumberingTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const handleSave = async (data: NumberingState) => {
    if (!orgId) return;

    // Save global setting
    await supabase.from('settings').upsert({
      organisation_id: orgId,
      key: 'prevent_duplicate_numbers',
      value: String(data.prevent_duplicate),
    }, { onConflict: 'organisation_id,key' });

    // Save document series rows
    const rows = Object.values(data.series).map((s) => ({
      organisation_id: orgId,
      doc_type: s.doc_type,
      prefix: s.prefix,
      next_number: s.start_number,
      number_length: s.padding,
      suffix: s.suffix,
    }));

    const { error } = await supabase
      .from('document_settings')
      .upsert(rows, { onConflict: 'organisation_id,doc_type' });

    if (error && error.code !== 'PGRST204') {
      toast.error('Failed to save document numbering series: ' + error.message);
      throw error;
    }

    toast.success('Document numbering series saved successfully');
  };

  const {
    liveData,
    hasChanges,
    isSaving,
    draftAvailable,
    updateField,
    updateMultiple,
    discard,
    save,
    restoreDraft,
    dismissDraft,
  } = useUnsavedChanges<NumberingState>({
    initialData: DEFAULT_NUMBERING_STATE,
    onSave: handleSave,
    storageKey: `settings_v2_draft_numbering_${orgId || 'default'}`,
  });

  React.useEffect(() => {
    onDirtyChange(hasChanges);
  }, [hasChanges, onDirtyChange]);

  React.useEffect(() => {
    onRegisterSave(save, discard);
  }, [save, discard, onRegisterSave]);

  const updateDocSeries = (docType: string, field: keyof DocumentNumberSeries, val: any) => {
    const current = liveData.series[docType];
    if (!current) return;
    const updatedSeries = {
      ...liveData.series,
      [docType]: {
        ...current,
        [field]: val,
      },
    };
    updateField('series', updatedSeries);
  };

  const getPreview = (s: DocumentNumberSeries) => {
    const padded = String(s.start_number || 1).padStart(Number(s.padding || 4), '0');
    return `${s.prefix || ''}${padded}${s.suffix || ''}`;
  };

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
        title="Document Numbering Series"
        description="Configure automated prefix, start numbers, and zero padding for all transaction types"
      >
        <div className="space-y-6 divide-y divide-zinc-100">
          {Object.values(liveData.series).map((s) => (
            <div key={s.doc_type} className="pt-4 first:pt-0 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-900 uppercase tracking-wide">
                  {s.label}
                </span>
                <span className="text-xs font-mono font-semibold bg-zinc-100 text-[#185FA5] px-2.5 py-1 rounded border border-zinc-200">
                  Preview: {getPreview(s)}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                    Prefix
                  </label>
                  <SettingInput
                    value={s.prefix}
                    onChange={(val) => updateDocSeries(s.doc_type, 'prefix', val)}
                    placeholder="e.g. QT-"
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                    Start Number
                  </label>
                  <SettingInput
                    type="number"
                    value={s.start_number}
                    onChange={(val) => updateDocSeries(s.doc_type, 'start_number', Number(val) || 1)}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                    Pad Zeros (Digits)
                  </label>
                  <SettingInput
                    type="number"
                    value={s.padding}
                    onChange={(val) => updateDocSeries(s.doc_type, 'padding', Math.min(10, Math.max(1, Number(val) || 4)))}
                    disabled={isSaving}
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-semibold text-zinc-500 uppercase mb-1">
                    Suffix
                  </label>
                  <SettingInput
                    value={s.suffix}
                    onChange={(val) => updateDocSeries(s.doc_type, 'suffix', val)}
                    placeholder="e.g. -26"
                    disabled={isSaving}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </SettingSection>

      <SettingSection
        title="Global Validation Rules"
        description="Integrity rules across all generated transaction numbers"
      >
        <SettingRow
          label="Prevent Duplicate Document Numbers"
          description="Warn and prevent users from creating a document if the reference number has already been assigned."
        >
          <SettingToggle
            checked={liveData.prevent_duplicate}
            onChange={(checked) => updateField('prevent_duplicate', checked)}
            disabled={isSaving}
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
