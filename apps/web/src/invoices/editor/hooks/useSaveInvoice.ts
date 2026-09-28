import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { UseFormReturn } from 'react-hook-form';
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import { useCreateInvoice, useUpdateInvoice } from '../../hooks';
import { deleteInvoiceTerms, generateInvoiceNumber, incrementInvoiceNumber, saveInvoiceTerms } from '../../api';
import { getSourceTableName, useConversionStatus } from '../../../conversions/hooks';
import type { ConversionType } from '../../../conversions/types';
import {
  composeInvoiceInput,
  formatCurrency,
  type InvoiceEditorFormValues,
} from '../../ui-utils';
import { extractInvoicePoItems, updatePoLineItemBilling } from '../../../lib/poBillingUtils';

export type InvoiceSave = ReturnType<typeof useSaveInvoice>;

type RevisionState = {
  invoiceRevisionNo: number;
  invoiceRevisionHistory: any[];
  invoiceRevisionReason: string;
  setInvoiceRevisionNo: (value: number) => void;
  setInvoiceRevisionHistory: (value: any[]) => void;
  setInvoiceRevisionReason: (value: string) => void;
};

/** Recursively collect every zod/RHF `message` from a nested errors object. */
function collectErrorMessages(node: unknown, out: string[]): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach((entry) => collectErrorMessages(entry, out));
    return;
  }
  const record = node as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message) {
    out.push(record.message);
    return;
  }
  Object.values(record).forEach((value) => collectErrorMessages(value, out));
}

/**
 * Save orchestration for the V2 invoice editor: final save with all source
 * side-effects, draft save, and revision snapshot management.
 */
export function useSaveInvoice(params: {
  form: UseFormReturn<InvoiceEditorFormValues>;
  invoiceId?: string;
  isEditMode: boolean;
  organisationId?: string;
  organisationName?: string;
  totals: { subtotal: number; cgst: number; sgst: number; igst: number; total: number };
  watchedItems: any[];
  poValidation: { isValid: boolean; message: string };
  selectedSourceType: InvoiceEditorFormValues['source_type'];
  selectedSourceId?: string;
  quotationItems: any[];
  proformaItems: any[];
  conversionInfoRef: React.MutableRefObject<{ type: ConversionType; sourceId: string } | null>;
  existingInvoice?: any;
  pendingTermsTemplate?: any;
  revision: RevisionState;
}) {
  const {
    form,
    invoiceId,
    isEditMode,
    organisationId,
    organisationName,
    totals,
    watchedItems,
    poValidation,
    selectedSourceType,
    selectedSourceId,
    quotationItems,
    proformaItems,
    conversionInfoRef,
    existingInvoice,
    pendingTermsTemplate,
    revision,
  } = params;

  const navigate = useNavigate();
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice(invoiceId ?? '');

  // ── Revision Management: Save current invoice revision snapshot before bumping ──
  const saveInvoiceCurrentRevision = useCallback(async (reason: string): Promise<boolean> => {
    if (!invoiceId || !organisationId) return false;
    const currentRevNo = revision.invoiceRevisionNo || 1;
    const newRevNo = currentRevNo + 1;
    const revisionSnapshot = {
      revision_no: currentRevNo,
      saved_at: new Date().toISOString(),
      reason: reason || '',
      items: watchedItems.map(item => ({ ...item })),
      header: {
        subtotal: totals.subtotal,
        total: totals.total,
        cgst: totals.cgst,
        sgst: totals.sgst,
        igst: totals.igst,
      },
    };
    const newHistory = [...(revision.invoiceRevisionHistory || []), revisionSnapshot];
    try {
      const { error } = await supabase
        .from('invoices')
        .update({
          revision_no: newRevNo,
          revision_history: newHistory,
          revision_reason: reason || revision.invoiceRevisionReason,
        })
        .eq('id', invoiceId);
      if (error) throw error;
      revision.setInvoiceRevisionNo(newRevNo);
      revision.setInvoiceRevisionHistory(newHistory);
      revision.setInvoiceRevisionReason(reason || revision.invoiceRevisionReason);
      return true;
    } catch (err) {
      console.error('Error saving invoice revision:', err);
      return false;
    }
  }, [invoiceId, organisationId, revision, watchedItems, totals]);

  // ── Terms & Conditions sync (separate table; single writer) ──
  const syncInvoiceTerms = async (targetInvoiceId: string, values: any) => {
    if (!organisationId) return;
    const text = (values.terms_text || '').trim();
    try {
      if (!pendingTermsTemplate && !text) {
        await deleteInvoiceTerms(targetInvoiceId, organisationId);
        return;
      }
      await saveInvoiceTerms({
        invoiceId: targetInvoiceId,
        organisationId,
        templateId: pendingTermsTemplate?.id ?? values.terms_template_id ?? null,
        isCustom: !pendingTermsTemplate?.id,
        customContent: pendingTermsTemplate ?? { text },
      });
    } catch (termsError) {
      console.warn('Failed to sync invoice terms:', termsError);
      toast.error('Invoice saved, but terms & conditions failed to save.');
    }
  };

  // ── Draft save ──
  const executeInvoiceDraftSave = async (values: any) => {
    const payload = composeInvoiceInput({
      ...values,
      invoice_no: null,
      status: 'draft',
    }, totals);

    try {
      if (isEditMode && invoiceId) {
        await updateInvoice.mutateAsync(payload);
        await syncInvoiceTerms(invoiceId, values);
      } else {
        const created: any = await createInvoice.mutateAsync(payload);
        if (created?.id) {
          await syncInvoiceTerms(created.id, values);
        }
      }
      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast.error('Failed to save draft: ' + (error as Error).message);
    }
  };

  // ── Final save ──
  const onSubmit = form.handleSubmit(async (values) => {
    let invoiceNo = values.invoice_no;
    let seriesId: string | null = null;

    form.clearErrors('root');

    if (!poValidation.isValid) {
      form.setError('root', {
        type: 'validation',
        message: poValidation.message,
      });
      return;
    }

    const invalidItems = values.items.filter((item) => {
      if (item.is_header || item.is_subtotal) return false;
      const rate = Number(item.rate);
      const qty = Number(item.qty);
      const isValid = !isNaN(rate) && rate >= 0 && !isNaN(qty) && qty > 0;
      return !isValid;
    });

    if (invalidItems.length > 0) {
      form.setError('root', {
        type: 'validation',
        message: 'Please ensure all items have valid quantity (greater than 0) and rate (not negative).',
      });
      return;
    }

    if (!isEditMode && !invoiceNo && organisationId) {
      const result = await generateInvoiceNumber(organisationId);
      invoiceNo = result.invoiceNo;
      seriesId = result.seriesId;
    }

    const payload = composeInvoiceInput({
      ...values,
      invoice_no: invoiceNo || null,
      status: 'final',
    }, totals);

    if (values.mode === 'lot' && (payload.materials ?? []).length === 0) {
      form.setError('materials', {
        type: 'manual',
        message: 'Add at least one material row for lot invoices.',
      });
      return;
    }

    try {
      let newInvoiceId: string | null = null;
      if (isEditMode && invoiceId) {
        // Log the edit if it's already final
        if (existingInvoice?.status === 'final') {
          try {
            await supabase.from('follow_up_activity_log').insert({
              organisation_id: organisationId,
              event_type: 'invoice_edited',
              tab_source: 'invoice',
              title: 'Finalized Invoice Edited',
              description: `Invoice ${existingInvoice.invoice_no} was updated after finalization. Total changed from ${formatCurrency(existingInvoice.total)} to ${formatCurrency(payload.total)}.`,
              actor_name: organisationName || 'Authorized User',
              reference_id: invoiceId,
              reference_label: existingInvoice.invoice_no,
              metadata: {
                action: 'EDIT_FINALIZED',
                old_total: existingInvoice.total,
                new_total: payload.total,
                edit_timestamp: new Date().toISOString()
              }
            });
          } catch (logError) {
            console.warn('Failed to log invoice edit:', logError);
          }
        }
        await updateInvoice.mutateAsync(payload);
      } else {
        const result: any = await createInvoice.mutateAsync(payload);
        newInvoiceId = result?.id ?? null;
        if (seriesId && organisationId) {
          incrementInvoiceNumber(seriesId, organisationId).then();
        }
      }

      if (conversionInfoRef.current && newInvoiceId) {
        const { type, sourceId } = conversionInfoRef.current;
        const { status } = useConversionStatus(type);
        const tableName = getSourceTableName(type);

        await supabase
          .from(tableName)
          .update({
            status,
            converted_to_id: newInvoiceId,
            converted_to_type: 'invoice',
          })
          .eq('id', sourceId);
      }

      if (selectedSourceType === 'quotation' && selectedSourceId && newInvoiceId) {
        const allQuotationItems = quotationItems || [];
        const billedItems = values.items.filter(item => item.meta_json?.quotation_item_id);

        const newStatus = billedItems.length === allQuotationItems.length ? 'converted' : 'partially converted';

        await supabase
          .from('quotation_header')
          .update({
            conversion_status: newStatus,
            status: newStatus === 'converted' ? 'Converted' : 'Partially Converted'
          })
          .eq('id', selectedSourceId);

        await supabase
          .from('invoices')
          .update({ quotation_id: selectedSourceId })
          .eq('id', newInvoiceId);
      }

      if ((selectedSourceType as string) === 'proforma' && selectedSourceId && newInvoiceId) {
        const allProformaItems = proformaItems || [];
        const billedItems = values.items.filter(item => item.meta_json?.proforma_item_id);

        const newStatus = billedItems.length === allProformaItems.length ? 'fully billed' : 'partially billed';

        await supabase
          .from('proforma_invoices')
          .update({
            billing_status: newStatus
          })
          .eq('id', selectedSourceId);

        await supabase
          .from('invoices')
          .update({ proforma_id: selectedSourceId })
          .eq('id', newInvoiceId);
      }

      // Update PO line item billing after successful save (first creation only)
      if (newInvoiceId) {
        try {
          const poItems = extractInvoicePoItems(values.items);
          if (poItems.length > 0) {
            await updatePoLineItemBilling({
              organisationId: organisationId!,
              sourceType: 'invoice',
              sourceId: newInvoiceId,
              items: poItems,
            });
          }
        } catch (billingError) {
          console.error('Failed to update PO billing:', billingError);
        }
      }

      if (isEditMode && invoiceId) {
        await syncInvoiceTerms(invoiceId, values);
      } else if (newInvoiceId) {
        await syncInvoiceTerms(newInvoiceId, values);
      }

      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save invoice:', error);
      toast.error('Failed to save invoice: ' + (error as Error).message);
    }
  }, (errors) => {
    const messages: string[] = [];
    collectErrorMessages(errors, messages);
    const unique = Array.from(new Set(messages));
    console.error('Form validation errors:', unique);

    const summary = unique.length > 0
      ? unique.slice(0, 4).join(' ')
      : 'Please fix validation errors before saving.';
    form.setError('root', {
      type: 'validation',
      message: summary,
    });
    toast.error(summary);
  });

  const isSaving = createInvoice.isPending || updateInvoice.isPending;

  return { onSubmit, executeInvoiceDraftSave, saveInvoiceCurrentRevision, isSaving };
}