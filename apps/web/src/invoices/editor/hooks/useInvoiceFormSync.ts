import { useCallback, useEffect, useRef } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import {
  createEmptyItem,
  createLotItem,
  flattenInvoiceTermsText,
  getTemplateTypeFromTemplate,
  invoiceToFormValues,
  type InvoiceEditorFormValues,
} from '../../ui-utils';
import { getInvoiceTerms } from '../../api';
import type { FieldArrayLike } from './useInvoiceSource';

export type InvoiceFormSync = ReturnType<typeof useInvoiceFormSync>;

/**
 * Keeps the invoice form in sync with its inputs: existing/duplicate invoice
 * hydration, derived amounts, autofills and mode/template-driven item resets.
 */
export function useInvoiceFormSync(params: {
  form: UseFormReturn<InvoiceEditorFormValues>;
  user?: { user_metadata?: { full_name?: string } } | null;
  isEditMode: boolean;
  isDuplicating: boolean;
  isConverting: boolean;
  existingInvoice?: any;
  duplicateInvoice?: any;
  selectedClient: { state?: string | null; default_template_id?: string | null } | null;
  selectedTemplate?: { id?: string; layout_json?: any } | null;
  selectedMode: InvoiceEditorFormValues['mode'];
  watchedItems: any[];
  defaultWarehouseId?: string | null;
  enableRoundOff: boolean;
  itemsFieldArray: FieldArrayLike;
  materialsFieldArray: FieldArrayLike;
  loadedInvoiceIdRef: React.MutableRefObject<string>;
  initialSourceKeyRef: React.MutableRefObject<string>;
  hydratedSourceKeyRef: React.MutableRefObject<string>;
  setHeaderDiscounts: (updater: (prev: Record<string, number>) => Record<string, number>) => void;
  organisationId?: string;
  setPendingTermsTemplate: (value: any) => void;
  revision: {
    setInvoiceRevisionNo: (value: number) => void;
    setInvoiceRevisionHistory: (value: any[]) => void;
    setInvoiceRevisionReason: (value: string) => void;
  };
}) {
  const {
    form,
    user,
    isEditMode,
    isDuplicating,
    isConverting,
    existingInvoice,
    duplicateInvoice,
    selectedClient,
    selectedTemplate,
    selectedMode,
    watchedItems,
    defaultWarehouseId,
    enableRoundOff,
    itemsFieldArray,
    materialsFieldArray,
    loadedInvoiceIdRef,
    initialSourceKeyRef,
    hydratedSourceKeyRef,
    setHeaderDiscounts,
    organisationId,
    setPendingTermsTemplate,
    revision,
  } = params;

  const { reset, setValue, getValues } = form;
  const lastItemsSnapshotRef = useRef<string>('');

  // ── Auto amount sync (qty × rate) ──
  useEffect(() => {
    const snapshot = JSON.stringify(watchedItems.map((i: any) => ({ q: i.qty, r: i.rate, a: i.amount })));
    if (snapshot === lastItemsSnapshotRef.current) return;
    lastItemsSnapshotRef.current = snapshot;

    watchedItems.forEach((item, index) => {
      const amount = Number(((Number(item.qty) || 0) * (Number(item.rate) || 0)).toFixed(2));
      if ((item.amount ?? 0) !== amount) {
        setValue(`items.${index}.amount`, amount, {
          shouldDirty: false,
          shouldValidate: false,
        });
      }
    });
  }, [setValue, watchedItems]);

  // ── Prepared-by autofill ──
  useEffect(() => {
    if (!isEditMode && !isDuplicating && !isConverting && user?.user_metadata?.full_name) {
      setValue('prepared_by', user.user_metadata.full_name);
    }
  }, [isEditMode, isDuplicating, isConverting, user, setValue]);

  // ── Hydrate form when an existing invoice loads ──
  useEffect(() => {
    if (!existingInvoice || loadedInvoiceIdRef.current === existingInvoice.id) return;

    loadedInvoiceIdRef.current = existingInvoice.id ?? '';
    reset(invoiceToFormValues(existingInvoice));
    revision.setInvoiceRevisionNo(existingInvoice.revision_no ?? 1);
    revision.setInvoiceRevisionHistory(existingInvoice.revision_history ?? []);
    revision.setInvoiceRevisionReason(existingInvoice.revision_reason ?? '');
    initialSourceKeyRef.current = `${existingInvoice.source_type}:${existingInvoice.source_id}`;
    hydratedSourceKeyRef.current = `${existingInvoice.source_type}:${existingInvoice.source_id}:${existingInvoice.mode}`;
  }, [existingInvoice, reset]);

  // ── Hydrate form when duplicating ──
  useEffect(() => {
    if (!isDuplicating || !duplicateInvoice) return;

    const duplicatedFormValues = invoiceToFormValues(duplicateInvoice);

    duplicatedFormValues.invoice_no = '';
    duplicatedFormValues.status = 'draft';

    reset({
      ...duplicatedFormValues,
      invoice_no: '',
      status: 'draft',
      invoice_date: new Date().toISOString().split('T')[0],
    });

    // Carry over saved terms (remarks/signatory already ride along in form values).
    if (duplicateInvoice.id) {
      getInvoiceTerms(duplicateInvoice.id, organisationId)
        .then((row) => {
          if (!row?.custom_content) {
            setPendingTermsTemplate(null);
            return;
          }
          let parsed: any = row.custom_content;
          if (typeof parsed === 'string') {
            try { parsed = JSON.parse(parsed); } catch { parsed = { text: parsed }; }
          }
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.sections)) {
            setPendingTermsTemplate(parsed);
            setValue('terms_template_id', parsed.id ?? row.template_id ?? null, { shouldDirty: false });
          }
          setValue('terms_text', flattenInvoiceTermsText(parsed), { shouldDirty: false });
        })
        .catch((err) => console.warn('Failed to carry over invoice terms:', err));
    }
  }, [isDuplicating, duplicateInvoice, reset]);

  // ── Sync client state + default template ──
  useEffect(() => {
    if (!selectedClient) return;

    setValue('client_state', selectedClient.state ?? null, {
      shouldDirty: false,
      shouldValidate: false,
    });

    if (!getValues('template_id') && selectedClient.default_template_id) {
      setValue('template_id', selectedClient.default_template_id, {
        shouldDirty: false,
        shouldValidate: false,
      });
    }
  }, [getValues, selectedClient, setValue]);

  // ── Sync template type / mode from selected template ──
  useEffect(() => {
    const templateType = getTemplateTypeFromTemplate(selectedTemplate as any);
    if (!templateType) return;

    if (getValues('template_type') !== templateType) {
      setValue('template_type', templateType, {
        shouldDirty: true,
        shouldValidate: false,
      });
    }

    if (templateType === 'lot' && getValues('mode') !== 'lot') {
      setValue('mode', 'lot', {
        shouldDirty: true,
        shouldValidate: false,
      });
    }
  }, [getValues, selectedTemplate, setValue]);

  // ── Lot mode keeps a single lot item; itemized mode keeps at least one item ──
  useEffect(() => {
    if (selectedMode === 'lot') {
      const currentItems = getValues('items');
      if (currentItems.length !== 1) {
        const firstDescription = currentItems[0]?.description?.trim() || 'As per PO';
        itemsFieldArray.replace([createLotItem(firstDescription)]);
      }
      return;
    }

    if (getValues('items').length === 0) {
      itemsFieldArray.replace([createEmptyItem()]);
    }

    if (getValues('materials').length > 0) {
      materialsFieldArray.replace([]);
    }
  }, [getValues, itemsFieldArray, materialsFieldArray, selectedMode]);

  // ── Propagate default warehouse to item rows without one ──
  useEffect(() => {
    if (!defaultWarehouseId) return;

    watchedItems.forEach((item: any, idx: number) => {
      if (item.meta_json?.material_id && !item.meta_json?.warehouse_id) {
        setValue(`items.${idx}.meta_json.warehouse_id`, defaultWarehouseId);
      }
    });
  }, [defaultWarehouseId, watchedItems, setValue]);

  // ── Apply a header discount to every item of the matching variant ──
  const handleHeaderDiscountChange = useCallback((variantId: string, newValue: number) => {
    setHeaderDiscounts(prev => ({ ...prev, [variantId]: newValue }));

    const items = getValues('items');
    items.forEach((item, index) => {
      const itemVariantId = item.meta_json?.variant_id;
      if (itemVariantId === variantId) {
        setValue(`items.${index}.discount_percent`, newValue, { shouldDirty: true });

        const baseRate = Number(item.meta_json?.base_rate || 0);
        const rateAfterDiscount = baseRate - (baseRate * newValue / 100);
        const roundedRate = enableRoundOff ? Math.round(rateAfterDiscount) : rateAfterDiscount;

        setValue(`items.${index}.rate`, roundedRate, { shouldDirty: true });
        setValue(`items.${index}.meta_json.rate_after_discount`, roundedRate, { shouldDirty: true });

        const qty = Number(item.qty || 0);
        const amount = Number((qty * roundedRate).toFixed(2));
        setValue(`items.${index}.amount`, amount, { shouldDirty: true });
      }
    });
  }, [enableRoundOff, getValues, setValue, setHeaderDiscounts]);

  return { handleHeaderDiscountChange };
}