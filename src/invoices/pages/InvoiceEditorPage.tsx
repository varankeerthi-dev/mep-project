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

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
  
  :root {
    --bg-page: #ffffff;
    --bg-card: #ffffff;
    --bg-muted: #f5f5f5;
    --bg-hover: #fafafa;
    --border: #000000;
    --border-light: #e5e5e5;
    --text-primary: #000000;
    --text-secondary: #000000;
    --text-muted: #000000;
    --accent: #000000;
    --error: #000000;
  }
  
  .ie-page {
    font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: var(--bg-page);
    min-height: 100vh;
    color: #000000;
  }
  
  .ie-container {
    max-width: 1400px;
    margin: 0 auto;
    padding: 1rem;
  }
  
  /* Header */
  .ie-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 1rem;
    gap: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #000;
  }
  
  .ie-title {
    font-size: 1.25rem;
    font-weight: 700;
    color: #000;
    letter-spacing: -0.01em;
    margin: 0;
  }
  
  .ie-subtitle {
    font-size: 0.75rem;
    color: #000;
    margin-top: 0.25rem;
    opacity: 0.7;
  }
  
  .ie-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }
  
  .ie-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border: 1px solid #000;
    background: #fff;
    color: #000;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
    font-family: inherit;
  }
  
  .ie-btn:hover {
    background: #000;
    color: #fff;
  }
  
  .ie-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .ie-btn-primary {
    background: #000;
    color: #fff;
  }
  
  .ie-btn-primary:hover {
    background: #333;
  }
  
  /* Form Card */
  .ie-form {
    border: 1px solid #000;
    display: flex;
    flex-direction: column;
    height: calc(100vh - 140px);
    min-height: 600px;
  }
  
  /* Top Fields */
  .ie-fields {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 0.5rem;
    padding: 0.5rem;
    border-bottom: 1px solid #000;
  }
  
  @media (max-width: 1200px) {
    .ie-fields { grid-template-columns: repeat(2, 1fr); }
  }
  
  @media (max-width: 640px) {
    .ie-fields { grid-template-columns: 1fr; }
  }
  
  .ie-field {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .ie-label {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000;
  }
  
  .ie-input,
  .ie-select {
    width: 100%;
    padding: 0.25rem 0.375rem;
    border: 1px solid #000;
    font-size: 0.75rem;
    font-family: inherit;
    color: #000;
    background: #fff;
  }
  
  .ie-input:focus,
  .ie-select:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(0,0,0,0.1);
  }
  
  .ie-select {
    cursor: pointer;
  }
  
  .ie-error {
    font-size: 0.625rem;
    color: #000;
    font-weight: 600;
  }
  
  /* Mode Toggle */
  .ie-mode {
    display: grid;
    grid-template-columns: 1fr 1fr;
    border: 1px solid #000;
  }
  
  .ie-mode-btn {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    font-weight: 600;
    border: none;
    background: #fff;
    color: #000;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  
  .ie-mode-btn.active {
    background: #000;
    color: #fff;
  }
  
  /* Content Area */
  .ie-content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem;
  }
  
  .ie-section {
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    border: 1px solid #000;
  }
  
  .ie-section-title {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #000;
    margin-bottom: 0.5rem;
    padding-bottom: 0.25rem;
    border-bottom: 1px solid #000;
  }
  
  .ie-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }
  
  @media (max-width: 768px) {
    .ie-row { grid-template-columns: 1fr; }
  }
  
  .ie-info {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  
  .ie-info-label {
    font-size: 0.625rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    color: #000;
    opacity: 0.7;
  }
  
  .ie-info-value {
    font-size: 0.75rem;
    font-weight: 600;
    color: #000;
  }
  
  /* Loading */
  .ie-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 300px;
    border: 1px solid #000;
    font-size: 0.75rem;
    color: #000;
    gap: 0.5rem;
  }
  
  /* Alert */
  .ie-alert {
    padding: 0.375rem 0.5rem;
    border: 1px solid #000;
    font-size: 0.75rem;
    color: #000;
    margin-bottom: 0.5rem;
  }
  
  .ie-alert-error {
    font-weight: 600;
  }
  
  /* Quick Add */
  .ie-quick-add {
    margin-top: 0.5rem;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'ie-styles';
  if (!document.getElementById(styleId)) {
    const styleEl = document.createElement('style');
    styleEl.id = styleId;
    styleEl.textContent = styles;
    document.head.appendChild(styleEl);
  }
}

// ─── Component ─────────────────────────────────────────────────────────────────

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
      <div className="ie-page">
        <div className="ie-container">
          <div className="ie-loading">
            <Loader2 className="animate-spin" size={16} />
            Loading invoice...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ie-page">
      <div className="ie-container">
        <form onSubmit={onSubmit}>
          {/* Header */}
          <div className="ie-header">
            <div>
              <h1 className="ie-title">{isEditMode ? 'Edit Invoice' : 'Create Invoice'}</h1>
              <p className="ie-subtitle">
                Build invoice from source document. Adjust rows and let GST totals calculate automatically.
              </p>
            </div>
            
            <div className="ie-actions">
              <InvoiceStatusBadge status={getValues('status')} />
              <button type="button" onClick={handlePreviewPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn">
                {pdfAction === 'preview' ? <Loader2 className="animate-spin" size={14} /> : <Eye size={14} />}
                Preview
              </button>
              <button type="button" onClick={handleDownloadPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn">
                {pdfAction === 'download' ? <Loader2 className="animate-spin" size={14} /> : <Download size={14} />}
                Download
              </button>
              <button type="button" onClick={handlePrintPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn">
                {pdfAction === 'print' ? <Loader2 className="animate-spin" size={14} /> : <Printer size={14} />}
                Print
              </button>
              <button type="button" onClick={handleEmailPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn">
                {pdfAction === 'email' ? <Loader2 className="animate-spin" size={14} /> : <Mail size={14} />}
                Email
              </button>
              <button type="button" onClick={() => navigate('/invoices')} className="ie-btn">
                <X size={14} />
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="ie-btn ie-btn-primary">
                {isSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
                {isEditMode ? 'Save' : 'Create'}
              </button>
            </div>
          </div>

          {/* Form Card */}
          <div className="ie-form">
            {/* Top Fields */}
            <div className="ie-fields">
              <div className="ie-field">
                <label className="ie-label">Client</label>
                <select {...register('client_id')} className="ie-select">
                  <option value="">Select client</option>
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>{client.name}</option>
                  ))}
                </select>
                {errors.client_id && <div className="ie-error">{errors.client_id.message}</div>}
              </div>

              <div className="ie-field">
                <label className="ie-label">Source Type</label>
                <select {...register('source_type')} className="ie-select">
                  <option value="quotation">Quotation</option>
                  <option value="challan">Delivery Challan</option>
                  <option value="po">Client PO</option>
                </select>
              </div>

              <div className="ie-field">
                <label className="ie-label">Source Document</label>
                <select {...register('source_id')} className="ie-select">
                  <option value="">Select {getSourceLabel(selectedSourceType).toLowerCase()}</option>
                  {(sourceOptionsQuery.data ?? []).map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.label} - {option.sublabel}
                    </option>
                  ))}
                </select>
                {errors.source_id && <div className="ie-error">{errors.source_id.message}</div>}
              </div>

              <div className="ie-field">
                <label className="ie-label">Template</label>
                <select {...register('template_id')} className="ie-select">
                  <option value="">Select template</option>
                  {templates.map((template) => (
                    <option key={template.id} value={template.id}>{template.name}</option>
                  ))}
                </select>
                {errors.template_id && <div className="ie-error">{errors.template_id.message}</div>}
              </div>

              <div className="ie-field">
                <label className="ie-label">Status</label>
                <select {...register('status')} className="ie-select">
                  <option value="draft">Draft</option>
                  <option value="final">Final</option>
                </select>
              </div>

              <div className="ie-field">
                <label className="ie-label">Mode</label>
                <div className="ie-mode">
                  <button
                    type="button"
                    onClick={() => setValue('mode', 'itemized', { shouldDirty: true, shouldValidate: false })}
                    className={`ie-mode-btn ${selectedMode === 'itemized' ? 'active' : ''}`}
                  >
                    Itemized
                  </button>
                  <button
                    type="button"
                    onClick={() => setValue('mode', 'lot', { shouldDirty: true, shouldValidate: false })}
                    className={`ie-mode-btn ${selectedMode === 'lot' ? 'active' : ''}`}
                  >
                    Lot
                  </button>
                </div>
              </div>

              <div className="ie-field">
                <label className="ie-label">Company State</label>
                <input {...register('company_state')} className="ie-input" placeholder={DEFAULT_COMPANY_STATE} />
              </div>
            </div>

            {/* Content Area */}
            <div className="ie-content">
              {sourceDraftQuery.isFetching && selectedSourceId && (
                <div className="ie-alert">Loading source data from {getSourceLabel(selectedSourceType).toLowerCase()}...</div>
              )}

              {(createInvoice.isError || updateInvoice.isError || invoiceQuery.isError) && (
                <div className="ie-alert ie-alert-error">
                  {String(
                    (createInvoice.error as Error | null)?.message ??
                      (updateInvoice.error as Error | null)?.message ??
                      (invoiceQuery.error as Error | null)?.message ??
                      'Unable to save invoice.',
                  )}
                </div>
              )}

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

              {selectedMode === 'lot' && (
                <InvoiceMaterialsEditor
                  fields={materialsFieldArray.fields}
                  register={register}
                  append={materialsFieldArray.append}
                  remove={materialsFieldArray.remove}
                  materials={watchedMaterials}
                  productOptions={materialsQuery.data ?? []}
                  error={fieldErrorMessage(errors.materials)}
                />
              )}

              {/* Context Section */}
              <div className="ie-section">
                <div className="ie-section-title">Context</div>
                <div className="ie-row">
                  <div className="ie-info">
                    <div className="ie-info-label">Client State</div>
                    <div className="ie-info-value">{clientState || 'Pending'}</div>
                  </div>
                  <div className="ie-info">
                    <div className="ie-info-label">Template Type</div>
                    <div className="ie-info-value">{getValues('template_type').replace('_', ' ')}</div>
                  </div>
                  <div className="ie-info">
                    <div className="ie-info-label">Source</div>
                    <div className="ie-info-value">{getSourceLabel(selectedSourceType)}</div>
                  </div>
                  <div className="ie-info">
                    <div className="ie-info-label">Materials</div>
                    <div className="ie-info-value">{watchedMaterials.length}</div>
                  </div>
                </div>
                <div className="ie-quick-add">
                  <button
                    type="button"
                    onClick={() => itemsFieldArray.append(selectedMode === 'lot' ? createLotItem() : createEmptyItem())}
                    className="ie-btn"
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                </div>
              </div>
            </div>

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
          </div>
        </form>
      </div>
    </div>
  );
}
