import { useState, useCallback, useRef } from 'react';
import { supabase } from '../../../supabase';
import { toast } from 'sonner';
import { withTimeout, isTimeoutError } from '../utils/promiseTimeout';
import { ApprovalIntegration } from '../../../approvals/integration';
import { buildQuotationItemPayload } from '../utils/quotationCalculations';

type QuoteSeriesCfg = {
  source: 'document_settings' | 'document_series';
  prefix: string;
  suffix: string;
  padding: number;
  nextNumber: number;
  legacyRow?: any;
};

type UseQuotationMutationsOptions = {
  organisation: { id: string; state?: string } | null | undefined;
  user: any;
  editId?: string | null;
  formData: any;
  items: any[];
  materials: any[];
  calculations: any;
  headerDiscounts: Record<string, number>;
  dcAllocations: any[];
  conversionInfoRef: React.MutableRefObject<{ type: string; sourceId: string } | null>;
  queryClient: any;
  skipDupeCheckRef: React.MutableRefObject<boolean>;
  ignoreDirtyRef: React.MutableRefObject<boolean>;
  navigate: (path: string, options?: any) => void;
  onSetItems: (items: any[]) => void;
  onSetOriginalItems: (items: any[]) => void;
  onSetFormData: (data: any) => void;
  onSetQuoteNoPreview: (no: string) => void;
  onSetIsDirty: (v: boolean) => void;
  onSetConfirmDialog: (v: any) => void;
  loadQuoteSeriesCfg: () => Promise<QuoteSeriesCfg | null>;
  buildQuoteNoFromCfg: (cfg: QuoteSeriesCfg) => string;
  fetchArcPricingForItems?: (clientId: string, itemIds: string[]) => Promise<any>;
};

type UseQuotationMutationsResult = {
  handleSave: (saveAndNew?: boolean, isAutosave?: boolean) => Promise<boolean>;
  saving: boolean;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'conflict' | 'error';
};

export function useQuotationMutations({
  organisation,
  user,
  editId,
  formData,
  items,
  materials,
  calculations,
  headerDiscounts,
  dcAllocations,
  conversionInfoRef,
  queryClient,
  skipDupeCheckRef,
  ignoreDirtyRef,
  navigate,
  onSetItems,
  onSetOriginalItems,
  onSetFormData,
  onSetQuoteNoPreview,
  onSetIsDirty,
  onSetConfirmDialog,
  loadQuoteSeriesCfg,
  buildQuoteNoFromCfg,
  fetchArcPricingForItems,
}: UseQuotationMutationsOptions): UseQuotationMutationsResult {
  const [saving, setSaving] = useState(false);
  const [saveStatus, _setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'conflict' | 'error'>('saved');

  const setSaveStatus = useCallback((v: typeof saveStatus) => {
    _setSaveStatus(v);
  }, []);

  const handleSave = useCallback(async (saveAndNewParam = false, isAutosaveParam = false) => {
    if (saving) return false;
    if (!organisation?.id) {
      setSaveStatus('error');
      if (!isAutosaveParam) {
        toast.error('Validation error', { description: 'Organisation ID is missing. Please refresh and try again.' });
      }
      return false;
    }
    if (!user?.id) {
      setSaveStatus('error');
      if (!isAutosaveParam) {
        toast.error('Validation error', { description: 'User session is missing. Please refresh and log in again.' });
      }
      return false;
    }
    if (!formData.client_id) {
      if (!isAutosaveParam) {
        toast.error('Validation error', { description: 'Please select a client.' });
      }
      return false;
    }

    const { z } = await import('zod');
    const dateValidationSchema = z.object({
      date: z.string().min(1, 'Quote date is required'),
      valid_till: z.string().nullable().optional(),
    }).refine((data) => {
      if (!data.date || !data.valid_till) return true;
      return new Date(data.valid_till) > new Date(data.date);
    }, {
      message: 'Valid Till date must be after the Quote date',
      path: ['valid_till'],
    });

    const dateResult = dateValidationSchema.safeParse({
      date: formData.date,
      valid_till: formData.valid_till,
    });

    if (!dateResult.success) {
      const errorMsg = dateResult.error.errors[0]?.message || 'Invalid date range';
      if (!isAutosaveParam) {
        toast.error(errorMsg);
      }
      return false;
    }

    const cleanItems = items.filter(item => item.item_id || item.description || item.is_header || item.is_subtotal || item.section === 'erection');
    if (cleanItems.length === 0) {
      if (!isAutosaveParam) {
        toast.error('Validation error', { description: 'Please add at least one item.' });
      }
      return false;
    }

    if (!isAutosaveParam && !skipDupeCheckRef.current) {
      const seen = new Map<string, any>();
      const dupes: any[] = [];
      cleanItems.forEach((item: any) => {
        if (!item.item_id || item.is_header || item.is_subtotal) return;
        const key = `${item.section || 'materials'}::${item.item_id}::${item.variant_id || ''}::${(item.make || '').toLowerCase()}`;
        if (seen.has(key)) {
          if (!dupes.includes(seen.get(key))) dupes.push(seen.get(key));
          dupes.push(item);
        } else {
          seen.set(key, item);
        }
      });
      if (dupes.length > 0) {
        const names = [...new Set(dupes.map((d: any) => {
          const mat = materials.find((m: any) => m.id === d.item_id);
          return d.description || mat?.display_name || mat?.name || 'Unnamed item';
        }))].slice(0, 5).join(', ');
        const extra = dupes.length > 5 ? ` and ${dupes.length - 5} more row(s)` : '';
        onSetConfirmDialog({
          title: 'Duplicate line items',
          description: `These items appear more than once in the same section: ${names}${extra}. Save anyway, or cancel to fix them first.`,
          confirmLabel: 'Save Anyway',
          onConfirm: () => {
            onSetConfirmDialog(null);
            skipDupeCheckRef.current = true;
            handleSave(saveAndNewParam, isAutosaveParam).finally(() => { skipDupeCheckRef.current = false; });
          },
        });
        return false;
      }
    }

    setSaving(true);
    setSaveStatus('saving');
    ignoreDirtyRef.current = true;
    try {
      let sessionValid = true;
      try {
        sessionValid = await withTimeout(supabase.auth.getSession(), 'checking active session', 8000);
      } catch (sessionCheckErr) {
        if (isTimeoutError(sessionCheckErr, 'checking active session')) {
          sessionValid = true;
        } else {
          throw sessionCheckErr;
        }
      }

      if (!sessionValid) {
        setSaveStatus('error');
        if (!isAutosaveParam) {
          toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
        }
        ignoreDirtyRef.current = false;
        setSaving(false);
        return false;
      }

      const needsApproval = !editId;
      let quotationId = editId;
      let seriesCfg: QuoteSeriesCfg | null = null;

      const rpcItems = cleanItems.map((item) => {
        const isErection = item.section === 'erection';
        return buildQuotationItemPayload(item, isErection);
      });

      const variantDiscounts = Object.fromEntries(
        Object.entries(headerDiscounts)
          .filter(([id]) => id !== 'erection')
          .map(([variantId, discPercent]) => [variantId, parseFloat(discPercent as any) || 0])
      );

      const termsConditions = (() => {
        if (formData.terms_conditions || formData.terms_text) {
          return {
            template_id: formData.terms_conditions?.id || null,
            custom_content: JSON.stringify(formData.terms_conditions || { text: formData.terms_text }),
            is_custom: true
          };
        }
        return null;
      })();

      // Single update_quotation call per edit save (previously called twice —
      // the second call's response is now reused from the first).
      let editRpcData: any = null;
      if (editId) {
        const { data: rpcRes, error: updateError } = await supabase.rpc('update_quotation', {
          p_quotation_id: editId,
          p_organisation_id: organisation.id,
          p_client_id: formData.client_id,
          p_project_id: formData.project_id || null,
          p_items: rpcItems,
          p_remarks: formData.remarks || null,
          p_payment_terms: formData.payment_terms || null,
          p_valid_till: formData.valid_till || null,
          p_billing_address: formData.billing_address || null,
          p_gstin: formData.gstin || null,
          p_state: formData.state || null,
          p_contact_no: formData.contact_no || null,
          p_reference: formData.reference || null,
          p_authorized_signatory_id: formData.authorized_signatory_id || null,
          p_revision_no: formData.revision_no || 1,
          p_revision_history: formData.revision_history || [],
          p_status: formData.status || 'Draft',
          p_negotiation_mode: !!formData.negotiation_mode,
          p_extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
          p_extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
          p_round_off: calculations.roundOff || 0,
          p_round_off_enabled: formData.round_off_enabled ?? true,
          p_include_erection_charges: !!formData.include_erection_charges,
          p_variant_discounts: variantDiscounts,
          p_terms_conditions: termsConditions,
        });

        if (updateError) throw updateError;
        editRpcData = rpcRes;
        quotationId = editId;
        onSetFormData(prev => ({ ...prev, id: quotationId }));
      } else {
        seriesCfg = await loadQuoteSeriesCfg();

        const seriesConfig = seriesCfg ? {
          source: seriesCfg.source,
          organisation_id: organisation.id,
          legacy_row_id: seriesCfg.legacyRow?.id || null,
          next_number: seriesCfg.nextNumber
        } : null;

        const { data: rpcData, error: rpcError } = await supabase.rpc('record_quotation', {
          p_organisation_id: organisation.id,
          p_client_id: formData.client_id,
          p_project_id: formData.project_id || null,
          p_items: rpcItems,
          p_remarks: formData.remarks || null,
          p_payment_terms: formData.payment_terms || null,
          p_valid_till: formData.valid_till || null,
          p_billing_address: formData.billing_address || null,
          p_gstin: formData.gstin || null,
          p_state: formData.state || null,
          p_contact_no: formData.contact_no || null,
          p_reference: formData.reference || null,
          p_authorized_signatory_id: formData.authorized_signatory_id || null,
          p_revision_no: formData.revision_no || 1,
          p_revision_history: formData.revision_history || [],
          p_status: 'Draft',
          p_negotiation_mode: !!formData.negotiation_mode,
          p_extra_discount_percent: parseFloat(formData.extra_discount_percent) || 0,
          p_extra_discount_amount: parseFloat(formData.extra_discount_amount) || 0,
          p_round_off: calculations.roundOff || 0,
          p_round_off_enabled: formData.round_off_enabled ?? true,
          p_include_erection_charges: !!formData.include_erection_charges,
          p_variant_discounts: variantDiscounts,
          p_terms_conditions: termsConditions,
          p_quotation_no: seriesCfg ? buildQuoteNoFromCfg(seriesCfg) : null,
          p_series_config: seriesConfig,
        });

        if (rpcError) throw rpcError;
        quotationId = rpcData.quotation_id;
        onSetFormData((prev: any) => ({ ...prev, id: quotationId }));
        if (rpcData.quotation_no) {
          onSetQuoteNoPreview(rpcData.quotation_no);
        }
      }

      const returnedItems = ((editRpcData as any)?.items || []).map((it: any) => ({
        id: it.id,
        created_at: it.created_at,
        updated_at: it.updated_at
      }));

      const idMap = new Map<string, string>();
      cleanItems.forEach((item, index) => {
        const saved = returnedItems[index];
        if (saved && String(item.id) !== String(saved.id)) {
          idMap.set(String(item.id), String(saved.id));
        }
      });

      const mappedSavedItems = returnedItems.map((saved, index) => {
        const originalItem = cleanItems[index];
        const mapped: any = {
          ...originalItem,
          id: saved.id,
          created_at: saved.created_at,
          updated_at: saved.updated_at
        };
        if (mapped.linked_material_id && idMap.has(String(mapped.linked_material_id))) {
          mapped.linked_material_id = idMap.get(String(mapped.linked_material_id));
        }
        return mapped;
      });
      onSetItems(mappedSavedItems);
      onSetOriginalItems(JSON.parse(JSON.stringify(mappedSavedItems)));

      if (!isAutosaveParam) {
        supabase.from('quotation_activity_log').insert({
          organisation_id: organisation.id,
          quotation_id: quotationId,
          event_type: editId ? 'edited' : 'created',
          summary: {
            items: cleanItems.filter((it: any) => !it.is_header && !it.is_subtotal).length,
            total: calculations.grandTotal || 0
          },
          created_by: user?.id || null
        }).then(({ error }: any) => {
          if (error) console.warn('Activity log write failed:', error.message);
        });
      }

      if (!isAutosaveParam && !editId && formData.project_id) {
        // @ts-ignore
        (window as any).postQuotationChannelCard?.(quotationId, 'created').catch((err: any) => {
          console.warn('Quotation channel post failed:', err?.message || err);
        });
      }

      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      queryClient.invalidateQueries({ queryKey: ['quotations', organisation?.id] });
      queryClient.invalidateQueries({ queryKey: ['quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation_items', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotation-terms', quotationId] });

      if (!isAutosaveParam && needsApproval && !editId && quotationId) {
        try {
          const approvalResult = await ApprovalIntegration.createQuotationApproval(
            quotationId,
            formData.client_name || 'Unknown Client',
            formData.quotation_no || 'QT-' + quotationId.slice(0, 8),
            calculations.grandTotal,
            'NORMAL'
          );
          if (approvalResult.success) {
            if (import.meta.env.DEV) console.log('Quotation approval created:', approvalResult.approvalId);
          } else if (approvalResult.error && !approvalResult.error.includes('No approval required')) {
            console.error('Failed to create approval request:', approvalResult.error);
            toast.error('Quotation saved but approval request failed', { description: approvalResult.error });
          }
        } catch (approvalError) {
          console.error('Error creating approval request:', approvalError);
          toast.error('Quotation saved but approval creation failed', { description: 'Approval can be requested later.' });
        }
      }

      onSetIsDirty(false);
      setSaveStatus('saved');

      if (isAutosaveParam) {
        if (!editId && quotationId) {
          navigate(`/quotation/edit?id=${quotationId}`, { replace: true });
        }
        ignoreDirtyRef.current = false;
        setSaving(false);
        return true;
      }

      if (saveAndNewParam) {
        toast.success('Quotation saved as draft!');
        ignoreDirtyRef.current = false;
        setSaving(false);
        return true;
      } else {
        navigate(`/quotation/view?id=${quotationId}`);
      }
      return true;
    } catch (err) {
      console.error('Error saving quotation:', err);
      const errMsg = (err as any)?.message || String(err || '');
      
      if (errMsg.includes('Save conflict') || /conflict/i.test(errMsg) || (err as any)?.code === '409') {
        setSaveStatus('conflict');
        if (!isAutosaveParam) {
          toast.error('Save conflict', {
            description: 'This quotation was modified by someone else. Please reload to see the latest version before saving again.'
          });
        }
      } else {
        setSaveStatus('error');
        if (!isAutosaveParam) {
          if (/session|jwt|token|refresh_token|invalid_grant|not authenticated|auth/i.test(errMsg)) {
            toast.error('Session expired', { description: 'Please refresh the page and log in again.' });
          } else {
            toast.error('Save failed', { description: errMsg });
          }
        }
      }
      return false;
    } finally {
      ignoreDirtyRef.current = false;
      setSaving(false);
    }
  }, [
    saving,
    organisation,
    user,
    editId,
    formData,
    items,
    materials,
    calculations,
    headerDiscounts,
    queryClient,
    loadQuoteSeriesCfg,
    buildQuoteNoFromCfg,
    fetchArcPricingForItems,
    onSetItems,
    onSetOriginalItems,
    onSetFormData,
    onSetQuoteNoPreview,
    onSetIsDirty,
    onSetConfirmDialog,
    setSaving,
    setSaveStatus,
    navigate,
    skipDupeCheckRef,
    ignoreDirtyRef,
  ]);

  return {
    handleSave,
    saving,
    saveStatus,
  };
}
