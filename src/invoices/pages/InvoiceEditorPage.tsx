import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Loader2, Mail, Plus, Printer, Save, X, ChevronRight, Sparkles } from 'lucide-react';
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
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
  
  :root {
    --bg-primary: #fafafa;
    --bg-card: #ffffff;
    --bg-elevated: #f5f5f5;
    --bg-muted: #eeeeee;
    --text-primary: #0a0a0a;
    --text-secondary: #525252;
    --text-muted: #737373;
    --border-light: #e5e5e5;
    --border-medium: #d4d4d4;
    --border-strong: #a3a3a3;
    --accent: #171717;
    --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
    --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1);
    --shadow-lg: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1);
    --shadow-xl: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
    --radius-sm: 0.5rem;
    --radius-md: 0.75rem;
    --radius-lg: 1rem;
    --radius-xl: 1.5rem;
    --radius-2xl: 2rem;
    --radius-full: 9999px;
  }
  
  .ie-page {
    font-family: 'Space Grotesk', system-ui, sans-serif;
    background: var(--bg-primary);
    min-height: 100vh;
    color: var(--text-primary);
    background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 400 400' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E");
    background-blend-mode: soft-light;
    background-size: 200px 200px;
  }
  
  .ie-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }
  
  @media (max-width: 768px) {
    .ie-container { padding: 1rem; }
  }
  
  /* Animations */
  @keyframes fadeSlideUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  
  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }
  
  .ie-animate-in {
    animation: fadeSlideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  
  .ie-animate-delay-1 { animation-delay: 0.1s; }
  .ie-animate-delay-2 { animation-delay: 0.2s; }
  .ie-animate-delay-3 { animation-delay: 0.3s; }
  
  /* Header */
  .ie-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    margin-bottom: 2.5rem;
    gap: 2rem;
  }
  
  .ie-header-left {
    flex: 1;
  }
  
  .ie-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.75rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 1rem;
    padding: 0.375rem 0.875rem;
    background: var(--bg-card);
    border-radius: var(--radius-full);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-sm);
  }
  
  .ie-title {
    font-size: 3rem;
    font-weight: 700;
    color: var(--text-primary);
    letter-spacing: -0.03em;
    line-height: 1;
    margin: 0 0 0.75rem 0;
  }
  
  @media (max-width: 768px) {
    .ie-title { font-size: 2rem; }
  }
  
  .ie-subtitle {
    font-size: 1rem;
    color: var(--text-secondary);
    line-height: 1.6;
    max-width: 480px;
  }
  
  .ie-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.625rem;
    align-items: center;
  }
  
  .ie-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    border-radius: var(--radius-full);
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    border: none;
    font-family: inherit;
    white-space: nowrap;
  }
  
  .ie-btn-secondary {
    background: var(--bg-card);
    color: var(--text-primary);
    border: 1.5px solid var(--border-medium);
    box-shadow: var(--shadow-sm);
  }
  
  .ie-btn-secondary:hover {
    background: var(--bg-elevated);
    border-color: var(--text-primary);
    box-shadow: var(--shadow-md);
    transform: translateY(-2px);
  }
  
  .ie-btn-primary {
    background: var(--accent);
    color: white;
    box-shadow: var(--shadow-md);
  }
  
  .ie-btn-primary:hover {
    background: #262626;
    box-shadow: var(--shadow-lg);
    transform: translateY(-2px);
  }
  
  .ie-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
  
  /* Main Card */
  .ie-card {
    background: var(--bg-card);
    border-radius: var(--radius-2xl);
    border: 1px solid var(--border-light);
    box-shadow: var(--shadow-xl);
    overflow: hidden;
  }
  
  /* Top Section */
  .ie-top-section {
    padding: 1.5rem 2rem;
    background: linear-gradient(135deg, var(--bg-card) 0%, var(--bg-elevated) 100%);
    border-bottom: 1px solid var(--border-light);
  }
  
  .ie-fields-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1.5rem;
  }
  
  @media (max-width: 1024px) {
    .ie-fields-grid { grid-template-columns: repeat(2, 1fr); }
  }
  
  @media (max-width: 640px) {
    .ie-fields-grid { grid-template-columns: 1fr; }
  }
  
  .ie-field-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  
  .ie-field-label {
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }
  
  .ie-field-label-required::after {
    content: '*';
    color: var(--text-primary);
  }
  
  .ie-input,
  .ie-select {
    width: 100%;
    padding: 0.75rem 1rem;
    background: var(--bg-card);
    border: 2px solid var(--border-light);
    border-radius: var(--radius-lg);
    font-size: 0.9375rem;
    font-family: inherit;
    color: var(--text-primary);
    transition: all 0.2s ease;
  }
  
  .ie-input:focus,
  .ie-select:focus {
    outline: none;
    border-color: var(--text-primary);
    box-shadow: 0 0 0 4px rgba(0, 0, 0, 0.05);
  }
  
  .ie-select {
    cursor: pointer;
    appearance: none;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23525252' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 1rem center;
    padding-right: 2.5rem;
  }
  
  .ie-error-text {
    font-size: 0.75rem;
    font-weight: 600;
    color: #dc2626;
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  /* Mode Toggle */
  .ie-mode-toggle {
    display: grid;
    grid-template-columns: 1fr 1fr;
    background: var(--bg-muted);
    border-radius: var(--radius-full);
    padding: 0.25rem;
    border: 2px solid var(--border-light);
  }
  
  .ie-mode-btn {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    background: transparent;
    color: var(--text-muted);
    cursor: pointer;
    transition: all 0.3s ease;
    border-radius: var(--radius-full);
    font-family: inherit;
  }
  
  .ie-mode-btn.active {
    background: var(--bg-card);
    color: var(--text-primary);
    box-shadow: var(--shadow-sm);
  }
  
  /* Content Area */
  .ie-content {
    padding: 2rem;
    min-height: 400px;
  }
  
  @media (max-width: 768px) {
    .ie-content { padding: 1rem; }
  }
  
  .ie-alert {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem 1.25rem;
    border-radius: var(--radius-lg);
    font-size: 0.875rem;
    margin-bottom: 1.5rem;
    animation: fadeSlideUp 0.4s ease;
  }
  
  .ie-alert-info {
    background: var(--bg-elevated);
    border: 1px solid var(--border-light);
    color: var(--text-secondary);
  }
  
  .ie-alert-error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #dc2626;
    font-weight: 500;
  }
  
  /* Context Panel */
  .ie-context {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 1rem;
    margin-top: 2rem;
    padding: 1.5rem;
    background: var(--bg-elevated);
    border-radius: var(--radius-xl);
    border: 1px solid var(--border-light);
  }
  
  @media (max-width: 1024px) {
    .ie-context { grid-template-columns: repeat(2, 1fr); }
  }
  
  @media (max-width: 640px) {
    .ie-context { grid-template-columns: 1fr; }
  }
  
  .ie-context-item {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  
  .ie-context-label {
    font-size: 0.625rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }
  
  .ie-context-value {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--text-primary);
    font-family: 'JetBrains Mono', monospace;
  }
  
  .ie-quick-add {
    margin-top: 1.5rem;
    display: flex;
    justify-content: center;
  }
  
  /* Loading */
  .ie-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 1rem;
  }
  
  .ie-loading-text {
    font-size: 1rem;
    color: var(--text-muted);
    font-weight: 500;
  }
  
  /* Section Title */
  .ie-section-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: var(--text-muted);
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 2px solid var(--border-light);
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }
`;

if (typeof document !== 'undefined') {
  const styleId = 'ie-styles-v2';
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
          <div className="ie-loading ie-animate-in">
            <Loader2 className="animate-spin" size={32} />
            <div className="ie-loading-text">Loading invoice...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="ie-page">
      <div className="ie-container">
        {/* Header */}
        <div className="ie-header ie-animate-in">
          <div className="ie-header-left">
            <div className="ie-eyebrow">
              <Sparkles size={14} />
              Invoice Workspace
            </div>
            <h1 className="ie-title">{isEditMode ? 'Edit Invoice' : 'Create Invoice'}</h1>
            <p className="ie-subtitle">
              Build the invoice from a source document, adjust inline rows, and let GST totals settle at the bottom.
            </p>
          </div>
          
          <div className="ie-actions">
            <InvoiceStatusBadge status={getValues('status')} />
            <button type="button" onClick={handlePreviewPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn ie-btn-secondary">
              {pdfAction === 'preview' ? <Loader2 className="animate-spin" size={16} /> : <Eye size={16} />}
              Preview
            </button>
            <button type="button" onClick={handleDownloadPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn ie-btn-secondary">
              {pdfAction === 'download' ? <Loader2 className="animate-spin" size={16} /> : <Download size={16} />}
              Download
            </button>
            <button type="button" onClick={handlePrintPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn ie-btn-secondary">
              {pdfAction === 'print' ? <Loader2 className="animate-spin" size={16} /> : <Printer size={16} />}
              Print
            </button>
            <button type="button" onClick={handleEmailPdf} disabled={!isEditMode || pdfAction !== null} className="ie-btn ie-btn-secondary">
              {pdfAction === 'email' ? <Loader2 className="animate-spin" size={16} /> : <Mail size={16} />}
              Email
            </button>
            <button type="button" onClick={() => navigate('/invoices')} className="ie-btn ie-btn-secondary">
              <X size={16} />
              Cancel
            </button>
            <button type="submit" form="invoice-form" disabled={isSaving} className="ie-btn ie-btn-primary">
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              {isEditMode ? 'Save Changes' : 'Create Invoice'}
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="ie-card ie-animate-in ie-animate-delay-1">
          <form id="invoice-form" onSubmit={onSubmit}>
            {/* Top Fields Section */}
            <div className="ie-top-section">
              <div className="ie-fields-grid">
                <div className="ie-field-group">
                  <label className="ie-field-label ie-field-label-required">Client</label>
                  <select {...register('client_id')} className="ie-select">
                    <option value="">Select client</option>
                    {clients.map((client) => (
                      <option key={client.id} value={client.id}>{client.name}</option>
                    ))}
                  </select>
                  {errors.client_id && <div className="ie-error-text">{errors.client_id.message}</div>}
                </div>

                <div className="ie-field-group">
                  <label className="ie-field-label">Source Type</label>
                  <select {...register('source_type')} className="ie-select">
                    <option value="quotation">Quotation</option>
                    <option value="challan">Delivery Challan</option>
                    <option value="po">Client PO</option>
                  </select>
                </div>

                <div className="ie-field-group">
                  <label className="ie-field-label">Source Document</label>
                  <select {...register('source_id')} className="ie-select">
                    <option value="">Select {getSourceLabel(selectedSourceType).toLowerCase()}</option>
                    {(sourceOptionsQuery.data ?? []).map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label} — {option.sublabel}
                      </option>
                    ))}
                  </select>
                  {errors.source_id && <div className="ie-error-text">{errors.source_id.message}</div>}
                </div>

                <div className="ie-field-group">
                  <label className="ie-field-label">Template</label>
                  <select {...register('template_id')} className="ie-select">
                    <option value="">Select template</option>
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                  {errors.template_id && <div className="ie-error-text">{errors.template_id.message}</div>}
                </div>

                <div className="ie-field-group">
                  <label className="ie-field-label">Status</label>
                  <select {...register('status')} className="ie-select">
                    <option value="draft">Draft</option>
                    <option value="final">Final</option>
                  </select>
                </div>

                <div className="ie-field-group">
                  <label className="ie-field-label">Mode</label>
                  <div className="ie-mode-toggle">
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

                <div className="ie-field-group">
                  <label className="ie-field-label">Company State</label>
                  <input {...register('company_state')} className="ie-input" placeholder={DEFAULT_COMPANY_STATE} />
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="ie-content">
              {sourceDraftQuery.isFetching && selectedSourceId && (
                <div className="ie-alert ie-alert-info">
                  <Loader2 className="animate-spin" size={16} />
                  Loading source data from the selected {getSourceLabel(selectedSourceType).toLowerCase()}...
                </div>
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

              <div className="ie-section-title">
                <ChevronRight size={16} />
                Line Items
              </div>

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
                <>
                  <div className="ie-section-title" style={{ marginTop: '2rem' }}>
                    <ChevronRight size={16} />
                    Materials
                  </div>
                  <InvoiceMaterialsEditor
                    fields={materialsFieldArray.fields}
                    register={register}
                    append={materialsFieldArray.append}
                    remove={materialsFieldArray.remove}
                    materials={watchedMaterials}
                    productOptions={materialsQuery.data ?? []}
                    error={fieldErrorMessage(errors.materials)}
                  />
                </>
              )}

              {/* Context Panel */}
              <div className="ie-context">
                <div className="ie-context-item">
                  <div className="ie-context-label">Client State</div>
                  <div className="ie-context-value">{clientState || 'Pending'}</div>
                </div>
                <div className="ie-context-item">
                  <div className="ie-context-label">Template Type</div>
                  <div className="ie-context-value">{getValues('template_type').replace('_', ' ')}</div>
                </div>
                <div className="ie-context-item">
                  <div className="ie-context-label">Source</div>
                  <div className="ie-context-value">{getSourceLabel(selectedSourceType)}</div>
                </div>
                <div className="ie-context-item">
                  <div className="ie-context-label">Materials</div>
                  <div className="ie-context-value">{watchedMaterials.length}</div>
                </div>
              </div>

              <div className="ie-quick-add">
                <button
                  type="button"
                  onClick={() => itemsFieldArray.append(selectedMode === 'lot' ? createLotItem() : createEmptyItem())}
                  className="ie-btn ie-btn-secondary"
                >
                  <Plus size={16} />
                  Quick Add Row
                </button>
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
          </form>
        </div>
      </div>
    </div>
  );
}
