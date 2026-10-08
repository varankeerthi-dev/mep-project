import { useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { UseFormReturn } from 'react-hook-form';
import { supabase } from '@/supabase';
import { mapInvoiceSourceToDraft } from '../../api';
import { useConvertDocument } from '../../../conversions/hooks';
import type { ConversionType } from '../../../conversions/types';
import {
  DEFAULT_COMPANY_STATE,
  createEmptyItem,
  createEmptyMaterial,
  formatDate,
  formatCurrency,
  type InvoiceEditorFormValues,
  type InvoiceSourceOption,
} from '../../ui-utils';

export type FieldArrayLike = {
  replace: (value: any[]) => void;
  remove: () => void;
  append: (value: any) => void;
};

async function loadSourceOptions(
  sourceType: InvoiceEditorFormValues['source_type'],
  organisationId: string,
  clientId?: string,
): Promise<InvoiceSourceOption[]> {
  if (sourceType === 'direct') {
    return [];
  }

  if (sourceType === 'quotation') {
    const { data, error } = await supabase
      .from('quotation_header')
      .select('id, quotation_no, reference, date, created_at')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      label: row.quotation_no ?? row.reference ?? `Quotation ${String(row.id).slice(0, 6)}`,
      sublabel: `Issued ${formatDate(row.date ?? row.created_at)}`,
    }));
  }

  if ((sourceType as string) === 'proforma') {
    const { data, error } = await supabase
      .from('proforma_invoices')
      .select('id, pi_number, total, created_at, billing_status')
      .eq('organisation_id', organisationId)
      .in('status', ['sent', 'accepted'])
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      label: row.pi_number ?? `Proforma ${String(row.id).slice(0, 6)}`,
      sublabel: `Total: ₹${formatCurrency(Number(row.total ?? 0))} | ${row.billing_status ?? 'pending'}`,
    }));
  }

  if (sourceType === 'challan') {
    const { data, error } = await supabase
      .from('delivery_challans')
      .select('id, dc_number, dc_date, client_name, created_at')
      .eq('organisation_id', organisationId)
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      label: row.dc_number ?? `DC ${String(row.id).slice(0, 6)}`,
      sublabel: `${row.client_name ?? 'Unknown client'} - ${formatDate(row.dc_date ?? row.created_at)}`,
    }));
  }

  // PO branch is matched explicitly rather than by a catch-all.
  if (sourceType === 'po') {
    if (!clientId) return [];

    const { data, error } = await supabase
      .from('client_purchase_orders')
      .select('*')
      .eq('client_id', clientId)
      .eq('organisation_id', organisationId)
      .in('status', ['Open', 'Partially Billed'])
      .gt('po_available_value', 0)
      .order('po_date', { ascending: false });

    if (error) {
      console.error('Error fetching client POs:', error);
      return [];
    }

    return (data || []).map((row: any) => ({
      id: String(row.id),
      label: row.po_number ?? `PO ${String(row.id).slice(0, 6)}`,
      sublabel: `Issued ${formatDate(row.po_date ?? row.created_at)} | Total: ₹${formatCurrency(row.po_total_value)} | Available: ₹${formatCurrency(row.po_available_value)}`,
      po_total_value: Number(row.po_total_value) || 0,
      po_available_value: Number(row.po_available_value) || 0,
    }));
  }

  // Unreachable for a validated source_type. Returning nothing is safer than
  // guessing which source the caller meant.
  return [];
}

export type InvoiceSourceState = ReturnType<typeof useInvoiceSource>;

/**
 * Source-document layer for the V2 invoice editor: source options/details,
 * source-draft and conversion hydration, and PO overbilling validation.
 */
export function useInvoiceSource(params: {
  organisationId?: string;
  organisationState?: string | null;
  selectedClientId?: string;
  selectedSourceType: InvoiceEditorFormValues['source_type'];
  selectedSourceId?: string;
  selectedMode: InvoiceEditorFormValues['mode'];
  companyState: string | null;
  totals: { total: number };
  convertFrom: ConversionType | null;
  convertSourceId: string | null;
  isConverting: boolean;
  isEditMode: boolean;
  initialSourceKeyRef: React.MutableRefObject<string>;
  hydratedSourceKeyRef: React.MutableRefObject<string>;
  form: UseFormReturn<InvoiceEditorFormValues>;
  itemsFieldArray: FieldArrayLike;
  materialsFieldArray: FieldArrayLike;
}) {
  const {
    organisationId,
    organisationState,
    selectedClientId,
    selectedSourceType,
    selectedSourceId,
    selectedMode,
    companyState,
    totals,
    convertFrom,
    convertSourceId,
    isConverting,
    isEditMode,
    initialSourceKeyRef,
    hydratedSourceKeyRef,
    form,
    itemsFieldArray,
    materialsFieldArray,
  } = params;

  const { setValue } = form;

  const sourcesQuery = useQuery({
    queryKey: ['invoice-sources', selectedSourceType, organisationId, selectedClientId],
    queryFn: () => loadSourceOptions(selectedSourceType, organisationId!, selectedClientId),
    enabled: Boolean(organisationId),
    staleTime: 2 * 60 * 1000,
  });

  const sourceDraftQuery = useQuery({
    queryKey: ['invoice-ui', 'source-draft', selectedSourceType, selectedSourceId, selectedMode, companyState, organisationId],
    queryFn: () =>
      mapInvoiceSourceToDraft(selectedSourceType, selectedSourceId!, organisationId!, {
        companyState: companyState || DEFAULT_COMPANY_STATE,
        mode: selectedMode,
      }),
    enabled: Boolean(selectedSourceType && selectedSourceId && organisationId),
    staleTime: 0,
  });

  const poDetailsQuery = useQuery({
    queryKey: ['po-details', selectedSourceId, organisationId],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'po') return null;

      const { data: header, error: headerError } = await supabase
        .from('client_purchase_orders')
        .select('id, po_number, po_total_value, po_utilized_value, po_available_value')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisationId)
        .single();

      if (headerError) throw headerError;

      const { data: lineItems, error: lineItemsError } = await supabase
        .from('po_line_items')
        .select('*')
        .eq('po_id', selectedSourceId)
        .order('line_order', { ascending: true });

      if (lineItemsError) throw lineItemsError;

      return {
        header: {
          po_number: header.po_number,
          po_total_value: Number(header.po_total_value || 0),
          po_utilized_value: Number(header.po_utilized_value || 0),
          po_available_value: Number(header.po_available_value || 0)
        },
        lineItems: lineItems || []
      };
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'po' && organisationId),
    staleTime: 0,
  });

  const quotationDetailsQuery = useQuery({
    queryKey: ['quotation-details', selectedSourceId, organisationId],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'quotation') return null;

      const { data: header, error: headerError } = await supabase
        .from('quotation_header')
        .select('id, quotation_no, grand_total, status')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisationId)
        .single();

      if (headerError) throw headerError;

      const { data: items, error: itemsError } = await supabase
        .from('quotation_items')
        .select('*')
        .eq('quotation_id', selectedSourceId);

      if (itemsError) throw itemsError;

      return {
        header: {
          quotation_no: header.quotation_no,
          grand_total: Number(header.grand_total || 0),
          status: header.status
        },
        items: items || []
      };
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'quotation' && organisationId),
    staleTime: 2 * 60 * 1000,
  });

  const proformaDetailsQuery = useQuery({
    queryKey: ['proforma-details', selectedSourceId, organisationId],
    queryFn: async () => {
      if (!selectedSourceId || (selectedSourceType as string) !== 'proforma') return null;

      const { data: header, error: headerError } = await supabase
        .from('proforma_invoices')
        .select('id, pi_number, total, billing_status')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisationId)
        .single();

      if (headerError) throw headerError;

      const { data: items, error: itemsError } = await supabase
        .from('proforma_items')
        .select('*')
        .eq('proforma_id', selectedSourceId)
        .eq('organisation_id', organisationId)
        .order('sort_order', { ascending: true });

      if (itemsError) throw itemsError;

      return {
        header: {
          proforma_no: header.pi_number,
          grand_total: Number(header.total || 0),
          billing_status: header.billing_status
        },
        items: items || []
      };
    },
    enabled: Boolean(selectedSourceId && (selectedSourceType as string) === 'proforma' && organisationId),
    staleTime: 0,
  });

  const conversionQuery = useConvertDocument(convertFrom!, convertSourceId!);

  // ── Source-draft hydration: pre-fill header + lines when a source is chosen ──
  useEffect(() => {
    if (!sourceDraftQuery.data || !selectedSourceId) return;

    if (isConverting) return;

    const key = `${selectedSourceType}:${selectedSourceId}:${selectedMode}`;
    const isInitialEditSource = isEditMode && `${selectedSourceType}:${selectedSourceId}` === initialSourceKeyRef.current;

    if (hydratedSourceKeyRef.current === key || isInitialEditSource) return;

    hydratedSourceKeyRef.current = key;

    setValue('client_id', sourceDraftQuery.data.client_id, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('client_state', sourceDraftQuery.data.client_state ?? null, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue('mode', sourceDraftQuery.data.mode, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('template_type', sourceDraftQuery.data.template_type, {
      shouldDirty: true,
      shouldValidate: false,
    });

    itemsFieldArray.replace(sourceDraftQuery.data.items.map((item) => createEmptyItem(item)));
    materialsFieldArray.replace(sourceDraftQuery.data.materials.map((material) => createEmptyMaterial(material)));
  }, [
    isEditMode,
    itemsFieldArray,
    materialsFieldArray,
    selectedMode,
    selectedSourceId,
    selectedSourceType,
    setValue,
    sourceDraftQuery.data,
  ]);

  // ── Conversion hydration: populate form when creating from another document ──
  const conversionAppliedRef = useRef(false);
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);

  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;
    if (conversionAppliedRef.current) return;

    conversionAppliedRef.current = true;

    conversionInfoRef.current = {
      type: convertFrom!,
      sourceId: convertSourceId!,
    };

    const convertedData = conversionQuery.data.data as any;

    setValue('client_id', convertedData.client_id, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('source_type', convertedData.source_type, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('source_id', convertedData.source_id, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('template_type', convertedData.template_type, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('mode', convertedData.mode, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('invoice_date', convertedData.invoice_date, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('po_number', convertedData.po_number || null, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('po_date', convertedData.po_date || null, {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('remarks', convertedData.remarks || '', {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('terms_text', convertedData.terms || '', {
      shouldDirty: true,
      shouldValidate: false,
    });
    setValue('company_state', convertedData.company_state || organisationState || DEFAULT_COMPANY_STATE, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue('client_state', convertedData.client_state || null, {
      shouldDirty: false,
      shouldValidate: false,
    });

    if (convertedData.items && convertedData.items.length > 0) {
      itemsFieldArray.replace(convertedData.items.map((item: any) => createEmptyItem(item)));
    }

    if (convertedData.materials && convertedData.materials.length > 0) {
      materialsFieldArray.replace(convertedData.materials.map((material: any) => createEmptyMaterial(material)));
    }
  }, [isConverting, conversionQuery.data, convertFrom, convertSourceId, setValue, itemsFieldArray, materialsFieldArray, organisationState]);

  // ── PO overbilling validation ──
  const poValidation = useMemo(() => {
    if (selectedSourceType !== 'po' || !selectedSourceId) return { isValid: true, message: '' };

    const selectedPO = sourcesQuery.data?.find(po => po.id === selectedSourceId);
    if (!selectedPO) return { isValid: true, message: '' };

    const poTotalValue = selectedPO.po_total_value || 0;
    const invoiceTotalValue = totals.total || 0;

    if (invoiceTotalValue > poTotalValue) {
      return {
        isValid: false,
        message: `Invoice total (₹${formatCurrency(invoiceTotalValue)}) cannot exceed PO total (₹${formatCurrency(poTotalValue)})`
      };
    }

    return { isValid: true, message: '' };
  }, [selectedSourceType, selectedSourceId, sourcesQuery.data, totals.total]);

  return {
    sourcesQuery,
    sourceDraftQuery,
    poDetailsQuery,
    quotationDetailsQuery,
    proformaDetailsQuery,
    conversionQuery,
    poValidation,
    conversionInfoRef,
  };
}
