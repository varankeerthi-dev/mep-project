import React from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { SettingSelect } from '../components/SettingSelect';
import { SettingToggle } from '../components/SettingToggle';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges';
import { DocumentNumberSeries } from '../types';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';

export interface NumberingTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

interface FinancialYearState {
  format: string;
  start_month: number;
  current: string;
}

interface NumberingState {
  prevent_duplicate: boolean;
  series: Record<string, DocumentNumberSeries>;
  financial_year: FinancialYearState;
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

const FY_FORMATS = ['FY24-25', 'FY2024-25', '2024-25', '2024_25'];

function generateFyOptions(format: string, startMonth: number): string[] {
  const currentYear = new Date().getFullYear();
  const options: string[] = [];
  for (let i = -2; i <= 3; i++) {
    const year = currentYear + i;
    const nextYear = year + 1;
    const yearStr = year.toString();
    const nextYearStr = nextYear.toString().slice(-2);
    let fy: string;
    switch (format) {
      case 'FY24-25':
        fy = `FY${yearStr.slice(-2)}-${nextYearStr}`;
        break;
      case 'FY2024-25':
        fy = `FY${yearStr}-${nextYearStr}`;
        break;
      case '2024_25':
        fy = `${yearStr}_${nextYearStr}`;
        break;
      default:
        fy = `${yearStr}-${nextYearStr}`;
    }
    options.push(fy);
  }
  return options;
}

export const NumberingTab: React.FC<NumberingTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const orgFy = organisation as any;
  const DEFAULT_FINANCIAL_YEAR: FinancialYearState = {
    format: orgFy?.financial_year_format || 'FY24-25',
    start_month: typeof orgFy?.financial_year_start_month === 'number' ? orgFy.financial_year_start_month : 4,
    current: orgFy?.current_financial_year || 'FY24-25',
  };

  const DEFAULT_NUMBERING_STATE: NumberingState = {
    prevent_duplicate: true,
    series: DEFAULT_SERIES,
    financial_year: DEFAULT_FINANCIAL_YEAR,
  };

  const handleSave = async (data: NumberingState) => {
    if (!orgId) return;

    // Save global duplicate-prevention flag
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

    // Save financial year settings on the organisation row
    try {
      const { error: orgErr } = await supabase
        .from('organisations')
        .update({
          financial_year_format: data.financial_year.format,
          financial_year_start_month: data.financial_year.start_month,
          current_financial_year: data.financial_year.current,
          updated_at: new Date().toISOString(),
        })
        .eq('id', orgId);

      if (orgErr) {
        toast.error('Saved numbering, but failed to save financial year: ' + orgErr.message);
      }
    } catch (e: any) {
      toast.error('Failed to save financial year: ' + e.message);
    }

    toast.success('Document numbering series saved successfully');
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

  const updateFinancialYear = (field: keyof FinancialYearState, val: any) => {
    const next: FinancialYearState = { ...liveData.financial_year, [field]: val };
    if (field === 'format' || field === 'start_month') {
      const opts = generateFyOptions(next.format, next.start_month);
      if (!opts.includes(next.current)) {
        next.current = opts[Math.floor(opts.length / 2)] || opts[0];
      }
    }
    updateField('financial_year', next);
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

      <SettingSection
        title="Financial Year Settings"
        description="Defines how financial years are labelled and which FY is active for ledger and reporting."
      >
        <SettingRow
          label="FY Format"
          description="Display format for the financial year in reports"
        >
          <SettingSelect
            options={FY_FORMATS}
            value={liveData.financial_year.format}
            onChange={(val) => updateFinancialYear('format', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="FY Start Month"
          description={liveData.financial_year.start_month === 1 ? 'Jan–Dec (Calendar Year)' : 'Apr–Mar (Indian FY)'}
        >
          <SettingSelect
            options={[
              { value: '1', label: 'January (Calendar Year)' },
              { value: '4', label: 'April (Indian FY)' },
            ]}
            value={String(liveData.financial_year.start_month)}
            onChange={(val) => updateFinancialYear('start_month', Number(val))}
            disabled={isSaving}
          />
        </SettingRow>

        <SettingRow
          label="Current Financial Year"
          description="Active FY used in ledger calculations"
        >
          <SettingSelect
            options={generateFyOptions(liveData.financial_year.format, liveData.financial_year.start_month)}
            value={liveData.financial_year.current}
            onChange={(val) => updateFinancialYear('current', val)}
            disabled={isSaving}
          />
        </SettingRow>

        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Note: Opening balances are calculated from these settings. Changing the financial year after data entry may affect ledger reports.
        </p>
      </SettingSection>
    </div>
  );
};
