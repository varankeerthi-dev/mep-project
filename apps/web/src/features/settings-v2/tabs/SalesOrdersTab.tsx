import React, { useState, useEffect, useRef } from 'react';
import { SettingSection } from '../components/SettingSection';
import { SettingRow } from '../components/SettingRow';
import { SettingInput } from '../components/SettingInput';
import { toast } from '@/lib/logger';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

export interface SalesOrdersTabProps {
  onDirtyChange: (isDirty: boolean) => void;
  onRegisterSave: (saveFn: () => Promise<void>, discardFn: () => void) => void;
}

const DEFAULT_PAYMENT_TERMS = 'Net 30 Days';

// Sales Orders defaults: small key-value settings surfaced here so users can
// add/edit them without code changes. Stored in the shared settings table.
export const SalesOrdersTab: React.FC<SalesOrdersTabProps> = ({
  onDirtyChange,
  onRegisterSave,
}) => {
  const { organisation } = useAuth();
  const orgId = organisation?.id;

  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [originalTerms, setOriginalTerms] = useState(DEFAULT_PAYMENT_TERMS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!orgId) return;
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('settings')
          .select('value')
          .eq('organisation_id', orgId)
          .eq('key', 'so_default_payment_terms')
          .maybeSingle();
        if (!error && data?.value) {
          setPaymentTerms(data.value);
          setOriginalTerms(data.value);
        }
      } catch (e) {
        console.warn('Unable to load sales order settings:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [orgId]);

  const dirty = paymentTerms !== originalTerms;
  useEffect(() => {
    onDirtyChange(dirty);
  }, [dirty, onDirtyChange]);

  const handleSave = async () => {
    if (!orgId) return;
    const { error } = await supabase.from('settings').upsert({
      organisation_id: orgId,
      key: 'so_default_payment_terms',
      value: paymentTerms.trim() || DEFAULT_PAYMENT_TERMS,
    }, { onConflict: 'organisation_id,key' });
    if (error) {
      toast.error('Failed to save sales order settings: ' + error.message);
      throw error;
    }
    setOriginalTerms(paymentTerms.trim() || DEFAULT_PAYMENT_TERMS);
    toast.success('Sales order settings saved successfully');
  };

  const handleDiscard = () => {
    setPaymentTerms(originalTerms);
  };

  const saveRef = useRef(handleSave);
  saveRef.current = handleSave;
  const discardRef = useRef(handleDiscard);
  discardRef.current = handleDiscard;

  useEffect(() => {
    onRegisterSave(
      async () => saveRef.current(),
      () => discardRef.current()
    );
  }, [onRegisterSave]);

  if (loading) {
    return <div className="flex items-center justify-center py-12 text-sm text-zinc-500">Loading...</div>;
  }

  return (
    <div className="space-y-3">
      <SettingSection
        title="Sales Order Defaults"
        description="Prefilled on every new sales order; editable per order"
      >
        <SettingRow
          label="Default Payment Terms"
          description="Used when creating a sales order without a quotation"
        >
          <SettingInput
            value={paymentTerms}
            onChange={(val) => setPaymentTerms(val)}
            placeholder="e.g. Net 30 Days"
          />
        </SettingRow>
      </SettingSection>
    </div>
  );
};
