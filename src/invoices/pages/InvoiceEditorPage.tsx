import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Loader2, Mail, Plus, Printer, Save, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabase';
import { mapInvoiceSourceToDraft } from '../api';
import { InvoiceItemsEditor } from '../components/InvoiceItemsEditor';
import { InvoiceMaterialsEditor } from '../components/InvoiceMaterialsEditor';
import { InvoiceSummaryFooter } from '../components/InvoiceSummaryFooter';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { useCreateInvoice, useInvoice, useInvoiceTemplates, useUpdateInvoice } from '../hooks';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import {
  InvoiceEditorSchema,
  type InvoiceClientOption,
  type InvoiceEditorFormValues,
  type InvoiceMaterialOption,
  type InvoiceSourceOption,
  DEFAULT_COMPANY_STATE,
  calculateDraftTotals,
  composeInvoiceInput,
  createEmptyInvoiceFormValues,
  createEmptyItem,
  createEmptyMaterial,
  createLotItem,
  formatDate,
  getSourceLabel,
  getTemplateExtraColumnLabel,
  getTemplateTypeFromTemplate,
  invoiceToFormValues,
} from '../ui-utils';

function queryParam(search: string, key: string) {
  return new URLSearchParams(search).get(key);
}

function fieldErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  return undefined;
}

async function loadClientOptions(): Promise<InvoiceClientOption[]> {
  const { data, error } = await supabase.from('clients').select('*');
  if (error) throw error;

  return (data ?? [])
    .map((client: any) => ({
      id: String(client.id),
      name: String(client.name ?? client.client_name ?? 'Unnamed client'),
      state: client.state ?? null,
      gst_number: client.gst_number ?? client.gstin ?? null,
      default_template_id: client.default_template_id ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadMaterialOptions(): Promise<InvoiceMaterialOption[]> {
  const { data, error } = await supabase.from('materials').select('id, name, display_name, hsn_code');
  if (error) throw error;

  return (data ?? [])
    .map((material: any) => ({
      id: String(material.id),
      name: String(material.display_name ?? material.name ?? 'Unnamed material'),
      hsn_code: material.hsn_code ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadSourceOptions(sourceType: InvoiceEditorFormValues['source_type']): Promise<InvoiceSourceOption[]> {
  if (sourceType === 'quotation') {
    const { data, error } = await supabase
      .from('quotation_header')
      .select('id, quotation_no, reference, date, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      label: row.quotation_no ?? row.reference ?? `Quotation ${String(row.id).slice(0, 6)}`,
      sublabel: `Issued ${formatDate(row.date ?? row.created_at)}`,
    }));
  }

  if (sourceType === 'challan') {
    const { data, error } = await supabase
      .from('delivery_challans')
      .select('id, dc_number, dc_date, client_name, created_at')
      .order('created_at', { ascending: false })
      .limit(100);
    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      id: String(row.id),
      label: row.dc_number ?? `DC ${String(row.id).slice(0, 6)}`,
      sublabel: `${row.client_name ?? 'Unknown client'} - ${formatDate(row.dc_date ?? row.created_at)}`,
    }));
  }

  const { data, error } = await supabase
    .from('client_purchase_orders')
    .select('id, po_number, po_date, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    label: row.po_number ?? `PO ${String(row.id).slice(0, 6)}`,
    sublabel: `Issued ${formatDate(row.po_date ?? row.created_at)}`,
  }));
}

export default function InvoiceEditorPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const invoiceId = queryParam(location.search, 'id');
  const isEditMode = Boolean(invoiceId);
  const [pdfAction, setPdfAction] = useState<'preview' | 'download' | 'print' | 'email' | null>(null);

  const form = useForm<InvoiceEditorFormValues>({
    resolver: zodResolver(InvoiceEditorSchema),
    defaultValues: createEmptyInvoiceFormValues(),
    mode: 'onSubmit',
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    formState: { errors },
  } = form;

  const itemsFieldArray = useFieldArray({ control, name: 'items' });
  const materialsFieldArray = useFieldArray({ control, name: 'materials' });

  const selectedClientId = useWatch({ control, name: 'client_id' });
  const selectedTemplateId = useWatch({ control, name: 'template_id' });
  const selectedSourceType = useWatch({ control, name: 'source_type' });
  const selectedSourceId = useWatch({ control, name: 'source_id' });
  const selectedMode = useWatch({ control, name: 'mode' });
  const watchedItems = useWatch({ control, name: 'items' }) ?? [];
  const watchedMaterials = useWatch({ control, name: 'materials' }) ?? [];
  const companyState = useWatch({ control, name: 'company_state' }) ?? DEFAULT_COMPANY_STATE;
  const clientState = useWatch({ control, name: 'client_state' }) ?? null;

  const invoiceQuery = useInvoice(invoiceId ?? undefined);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice(invoiceId ?? '');
  const templatesQuery = useInvoiceTemplates();
  const clientsQuery = useQuery({
    queryKey: ['invoice-ui', 'clients'],
    queryFn: loadClientOptions,
    staleTime: 5 * 60 * 1000,
  });
  const materialsQuery = useQuery({
    queryKey: ['invoice-ui', 'materials'],
    queryFn: loadMaterialOptions,
    staleTime: 5 * 60 * 1000,
  });
  const sourceOptionsQuery = useQuery({
    queryKey: ['invoice-ui', 'sources', selectedSourceType],
    queryFn: () => loadSourceOptions(selectedSourceType),
    staleTime: 2 * 60 * 1000,
  });
  const sourceDraftQuery = useQuery({
    queryKey: ['invoice-ui', 'source-draft', selectedSourceType, selectedSourceId, selectedMode, companyState],
    queryFn: () =>
      mapInvoiceSourceToDraft(selectedSourceType, selectedSourceId, {
        companyState: companyState || DEFAULT_COMPANY_STATE,
        mode: selectedMode,
      }),
    enabled: Boolean(selectedSourceType && selectedSourceId),
    staleTime: 0,
  });

  const initialSourceKeyRef = useRef<string>('');
  const hydratedSourceKeyRef = useRef<string>('');
  const loadedInvoiceIdRef = useRef<string>('');

  const clients = clientsQuery.data ?? [];
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const templates = templatesQuery.data ?? [];
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const totals = useMemo(
    () =>
      calculateDraftTotals({
        items: watchedItems,
        company_state: companyState,
        client_state: clientState,
      }),
    [companyState, clientState, watchedItems],
  );

  useEffect(() => {
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

  useEffect(() => {
    if (!invoiceQuery.data || loadedInvoiceIdRef.current === invoiceQuery.data.id) return;

    loadedInvoiceIdRef.current = invoiceQuery.data.id ?? '';
    reset(invoiceToFormValues(invoiceQuery.data));
    initialSourceKeyRef.current = `${invoiceQuery.data.source_type}:${invoiceQuery.data.source_id}`;
    hydratedSourceKeyRef.current = `${invoiceQuery.data.source_type}:${invoiceQuery.data.source_id}:${invoiceQuery.data.mode}`;
  }, [invoiceQuery.data, reset]);

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

  useEffect(() => {
    const templateType = getTemplateTypeFromTemplate(selectedTemplate);
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

  useEffect(() => {
    if (!sourceDraftQuery.data || !selectedSourceId) return;

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

  const customColumnLabel = getTemplateExtraColumnLabel(selectedTemplate, watchedItems);
  const showCustomColumn = getValues('template_type') === 'client_custom';
  const isSaving = createInvoice.isPending || updateInvoice.isPending;

  const onSubmit = handleSubmit(async (values) => {
    const payload = composeInvoiceInput(values, totals);

    if (values.mode === 'lot' && (payload.materials ?? []).length === 0) {
      form.setError('materials', {
        type: 'manual',
        message: 'Add at least one material row for lot invoices.',
      });
      return;
    }

    if (isEditMode && invoiceId) {
      await updateInvoice.mutateAsync(payload);
    } else {
      await createInvoice.mutateAsync(payload);
    }

    navigate('/invoices');
  });

  const handlePreviewPdf = async () => {
    if (!invoiceId) return;

    setPdfAction('preview');
    try {
      await previewInvoicePDF(invoiceId);
    } finally {
      setPdfAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceId) return;

    setPdfAction('download');
    try {
      await downloadInvoicePDF(invoiceId);
    } finally {
      setPdfAction(null);
    }
  };

  const handlePrintPdf = async () => {
    if (!invoiceId) return;

    setPdfAction('print');
    try {
      await printInvoicePDF(invoiceId);
    } finally {
      setPdfAction(null);
    }
  };

  const handleEmailPdf = async () => {
    if (!invoiceId) return;

    setPdfAction('email');
    try {
      await emailInvoicePDF(invoiceId);
    } finally {
      setPdfAction(null);
    }
  };

  if (isEditMode && invoiceQuery.isLoading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', color: '#525252' }}>
          <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={20} />
          Loading invoice...
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "'Inter', system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      maxWidth: '1400px',
      margin: '0 auto',
      padding: '16px'
    }}>
      {/* Compact Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '16px',
        paddingBottom: '12px',
        borderBottom: '1px solid #e5e5e5'
      }}>
        <h1 style={{ 
          fontSize: '20px', 
          fontWeight: 600, 
          color: '#0a0a0a',
          margin: 0
        }}>
          {isEditMode ? 'Edit Invoice' : 'New Invoice'}
        </h1>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' }}>
          <InvoiceStatusBadge status={getValues('status')} />
          
          {/* Small box buttons */}
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={!isEditMode || pdfAction !== null}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: pdfAction !== null ? 'not-allowed' : 'pointer',
              opacity: pdfAction !== null ? 0.5 : 1,
              transition: 'all 0.15s'
            }}
            title="Preview PDF"
          >
            {pdfAction === 'preview' ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Eye size={14} />}
          </button>
          
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!isEditMode || pdfAction !== null}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: pdfAction !== null ? 'not-allowed' : 'pointer',
              opacity: pdfAction !== null ? 0.5 : 1,
              transition: 'all 0.15s'
            }}
            title="Download PDF"
          >
            {pdfAction === 'download' ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Download size={14} />}
          </button>
          
          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={!isEditMode || pdfAction !== null}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: pdfAction !== null ? 'not-allowed' : 'pointer',
              opacity: pdfAction !== null ? 0.5 : 1,
              transition: 'all 0.15s'
            }}
            title="Print"
          >
            {pdfAction === 'print' ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Printer size={14} />}
          </button>
          
          <button
            type="button"
            onClick={handleEmailPdf}
            disabled={!isEditMode || pdfAction !== null}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              cursor: pdfAction !== null ? 'not-allowed' : 'pointer',
              opacity: pdfAction !== null ? 0.5 : 1,
              transition: 'all 0.15s'
            }}
            title="Email"
          >
            {pdfAction === 'email' ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Mail size={14} />}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 12px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              background: '#fff',
              color: '#525252',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            <X size={14} />
            Cancel
          </button>
          
          <button
            type="submit"
            form="invoice-form"
            disabled={isSaving}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 14px',
              border: 'none',
              borderRadius: '4px',
              background: '#171717',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 600,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.6 : 1,
              transition: 'all 0.15s'
            }}
          >
            {isSaving ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Save size={14} />}
            {isEditMode ? 'Save' : 'Create'}
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form id="invoice-form" onSubmit={onSubmit}>
        {/* Top Fields - 4 Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Client *
            </label>
            <select
              {...register('client_id')}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
            {errors.client_id && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                {errors.client_id.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Source Type
            </label>
            <select
              {...register('source_type')}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="quotation">Quotation</option>
              <option value="challan">Delivery Challan</option>
              <option value="po">Client PO</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Source Document
            </label>
            <select
              {...register('source_id')}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select {getSourceLabel(selectedSourceType).toLowerCase()}</option>
              {(sourceOptionsQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
            {errors.source_id && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                {errors.source_id.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Template
            </label>
            <select
              {...register('template_id')}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>{template.name}</option>
              ))}
            </select>
            {errors.template_id && (
              <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                {errors.template_id.message}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Status
            </label>
            <select
              {...register('status')}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer'
              }}
            >
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Mode
            </label>
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              overflow: 'hidden'
            }}>
              <button
                type="button"
                onClick={() => setValue('mode', 'itemized', { shouldDirty: true, shouldValidate: false })}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedMode === 'itemized' ? '#171717' : '#fff',
                  color: selectedMode === 'itemized' ? '#fff' : '#525252',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Itemized
              </button>
              <button
                type="button"
                onClick={() => setValue('mode', 'lot', { shouldDirty: true, shouldValidate: false })}
                style={{
                  padding: '6px 10px',
                  fontSize: '12px',
                  fontWeight: 600,
                  border: 'none',
                  background: selectedMode === 'lot' ? '#171717' : '#fff',
                  color: selectedMode === 'lot' ? '#fff' : '#525252',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                Lot
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{
              fontSize: '11px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              color: '#737373'
            }}>
              Company State
            </label>
            <input
              {...register('company_state')}
              placeholder={DEFAULT_COMPANY_STATE}
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#171717',
                background: '#fff'
              }}
            />
          </div>
        </div>

        {/* Alerts */}
        {sourceDraftQuery.isFetching && selectedSourceId && (
          <div style={{
            padding: '8px 12px',
            background: '#f5f5f5',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#525252',
            marginBottom: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} />
            Loading source data...
          </div>
        )}

        {(createInvoice.isError || updateInvoice.isError || invoiceQuery.isError) && (
          <div style={{
            padding: '8px 12px',
            background: '#fef2f2',
            border: '1px solid #fecaca',
            borderRadius: '4px',
            fontSize: '12px',
            color: '#dc2626',
            marginBottom: '12px',
            fontWeight: 500
          }}>
            {String(
              (createInvoice.error as Error | null)?.message ??
                (updateInvoice.error as Error | null)?.message ??
                (invoiceQuery.error as Error | null)?.message ??
                'Unable to save invoice.',
            )}
          </div>
        )}

        {/* Invoice Items Editor - Compact Excel Style */}
        <InvoiceItemsEditor
          fields={itemsFieldArray.fields}
          items={watchedItems}
          register={register}
          append={itemsFieldArray.append}
          remove={itemsFieldArray.remove}
          mode={selectedMode}
          showCustomColumn={showCustomColumn}
          extraColumnLabel={customColumnLabel}
          error={fieldErrorMessage(errors.items)}
        />

        {/* Materials Editor - Compact Excel Style */}
        {selectedMode === 'lot' && (
          <div style={{ marginTop: '16px' }}>
            <InvoiceMaterialsEditor
              fields={materialsFieldArray.fields}
              register={register}
              append={materialsFieldArray.append}
              remove={materialsFieldArray.remove}
              materials={watchedMaterials}
              productOptions={materialsQuery.data ?? []}
              error={fieldErrorMessage(errors.materials)}
            />
          </div>
        )}

        {/* Context Panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '12px',
          marginTop: '16px',
          padding: '12px',
          background: '#f5f5f5',
          borderRadius: '4px',
          border: '1px solid #e5e5e5'
        }}>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#737373',
              marginBottom: '2px'
            }}>
              Client State
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {clientState || 'Pending'}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#737373',
              marginBottom: '2px'
            }}>
              Template Type
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717', textTransform: 'capitalize' }}>
              {getValues('template_type').replace('_', ' ')}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#737373',
              marginBottom: '2px'
            }}>
              Source
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {getSourceLabel(selectedSourceType)}
            </div>
          </div>
          <div>
            <div style={{
              fontSize: '10px',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
              color: '#737373',
              marginBottom: '2px'
            }}>
              Materials
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {watchedMaterials.length}
            </div>
          </div>
        </div>

        {/* Invoice Summary Footer */}
        <InvoiceSummaryFooter
          subtotal={totals.subtotal}
          cgst={totals.cgst}
          sgst={totals.sgst}
          igst={totals.igst}
          total={totals.total}
          interstate={totals.interstate}
          companyState={companyState}
          clientState={clientState}
        />
      </form>
    </div>
  );
}
