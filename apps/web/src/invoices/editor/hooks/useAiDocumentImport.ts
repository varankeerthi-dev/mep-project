import { useState } from 'react';
import type { UseFormReturn } from 'react-hook-form';
import { supabase } from '@/supabase';
import { toast } from 'sonner';
import { createLotItem, type InvoiceEditorFormValues } from '../../ui-utils';

export type AiDocumentImport = ReturnType<typeof useAiDocumentImport>;

/**
 * AI document parser integration: import success (header + line items) and
 * undo/rollback of the last import session.
 */
export function useAiDocumentImport(params: {
  form: UseFormReturn<InvoiceEditorFormValues>;
  user?: { id?: string } | null;
  materials: any[];
}) {
  const { form, user, materials } = params;

  const [isParserOpen, setIsParserOpen] = useState(false);
  const [activeImportSessionId, setActiveImportSessionId] = useState<string | null>(null);
  const [preImportHeader, setPreImportHeader] = useState<any>(null);

  const handleImportSuccess = (data: any) => {
    setPreImportHeader({
      client_id: form.getValues('client_id'),
      invoice_date: form.getValues('invoice_date'),
      invoice_no: form.getValues('invoice_no'),
      po_number: form.getValues('po_number')
    });

    if (data.header.party_id) form.setValue('client_id', data.header.party_id);
    if (data.header.date) form.setValue('invoice_date', data.header.date);
    if (data.header.reference_number) form.setValue('invoice_no', data.header.reference_number);
    if (data.header.po_reference) form.setValue('po_number', data.header.po_reference);

    const newItems = data.items.map((item: any) => {
      const matchedMaterial = materials?.find((m: any) => m.id === item.material_id);
      return {
        description: item.product_name,
        hsn_code: item.hsn_code || matchedMaterial?.hsn_code || '',
        qty: item.qty,
        rate: item.rate,
        amount: item.rate * item.qty,
        discount_percent: 0,
        meta_json: {
          tax_percent: item.tax_percent,
          uom: item.uom,
          make: '',
          variant: '',
          base_rate: item.rate,
          material_id: item.material_id,
          variant_id: null,
          is_service: false,
          imported_from_import_id: data.reviewSessionId
        }
      };
    });

    const currentItems = form.getValues('items') || [];
    const filteredCurrent = currentItems.filter(i => i.description || i.meta_json?.material_id);
    form.setValue('items', [...filteredCurrent, ...newItems]);

    setActiveImportSessionId(data.reviewSessionId);
  };

  const handleUndoImport = async () => {
    if (!activeImportSessionId) return;
    try {
      const { error } = await supabase
        .from('document_review_sessions')
        .update({
          status: 'ROLLED_BACK',
          rolled_back_at: new Date().toISOString(),
          rolled_back_by_user_id: user?.id,
          rollback_reason: 'User clicked Undo Import banner button'
        })
        .eq('id', activeImportSessionId);

      if (error) throw error;

      if (preImportHeader) {
        if (preImportHeader.client_id !== undefined) form.setValue('client_id', preImportHeader.client_id);
        if (preImportHeader.invoice_date !== undefined) form.setValue('invoice_date', preImportHeader.invoice_date);
        if (preImportHeader.invoice_no !== undefined) form.setValue('invoice_no', preImportHeader.invoice_no);
        if (preImportHeader.po_number !== undefined) form.setValue('po_number', preImportHeader.po_number);
      }

      const currentItems = form.getValues('items') || [];
      const remainingItems = currentItems.filter(item => item.meta_json?.imported_from_import_id !== activeImportSessionId);
      form.setValue('items', remainingItems.length > 0 ? remainingItems : [createLotItem()]);

      setActiveImportSessionId(null);
      setPreImportHeader(null);
      toast.success('AI Import undone successfully. Form restored.');
    } catch (e: any) {
      toast.error(`Undo failed: ${e.message}`);
    }
  };

  return { isParserOpen, setIsParserOpen, activeImportSessionId, handleImportSuccess, handleUndoImport };
}