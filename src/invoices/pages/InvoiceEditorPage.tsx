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
      <div className="flex min-h-[420px] items-center justify-center rounded-[28px] border border-slate-200 bg-white">
        <div className="inline-flex items-center gap-3 text-[14px] text-slate-600">
          <Loader2 className="animate-spin" size={16} />
          Loading invoice...
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex h-[calc(100vh-132px)] max-w-[1400px] min-h-[720px] flex-col gap-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.26em] text-slate-400">
            Invoice Workspace
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">
            {isEditMode ? 'Edit invoice' : 'Create invoice'}
          </h1>
          <p className="mt-2 max-w-2xl text-[14px] leading-6 text-slate-500">
            Build the invoice from a source document, adjust inline rows, and let GST totals settle at the bottom.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <InvoiceStatusBadge status={getValues('status')} />
          <button
            type="button"
            onClick={handlePreviewPdf}
            disabled={!isEditMode || pdfAction !== null}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfAction === 'preview' ? <Loader2 className="animate-spin" size={15} /> : <Eye size={15} />}
            PDF preview
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!isEditMode || pdfAction !== null}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfAction === 'download' ? <Loader2 className="animate-spin" size={15} /> : <Download size={15} />}
            Download PDF
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            disabled={!isEditMode || pdfAction !== null}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfAction === 'print' ? <Loader2 className="animate-spin" size={15} /> : <Printer size={15} />}
            Print
          </button>
          <button
            type="button"
            onClick={handleEmailPdf}
            disabled={!isEditMode || pdfAction !== null}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pdfAction === 'email' ? <Loader2 className="animate-spin" size={15} /> : <Mail size={15} />}
            Email
          </button>
          <button
            type="button"
            onClick={() => navigate('/invoices')}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-4 py-2.5 text-[13px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            <X size={15} />
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? <Loader2 className="animate-spin" size={15} /> : <Save size={15} />}
            {isEditMode ? 'Save changes' : 'Create invoice'}
          </button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
        <div className="grid gap-4 border-b border-slate-200 px-5 py-5 md:grid-cols-2 xl:grid-cols-4">
          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Client</span>
            <select
              {...register('client_id')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
            {errors.client_id && <div className="text-[12px] text-rose-600">{errors.client_id.message}</div>}
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Source type</span>
            <select
              {...register('source_type')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="quotation">Quotation</option>
              <option value="challan">Delivery Challan</option>
              <option value="po">Client PO</option>
            </select>
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Source document</span>
            <select
              {...register('source_id')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select {getSourceLabel(selectedSourceType).toLowerCase()}</option>
              {(sourceOptionsQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label} - {option.sublabel}
                </option>
              ))}
            </select>
            {errors.source_id && <div className="text-[12px] text-rose-600">{errors.source_id.message}</div>}
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Template</span>
            <select
              {...register('template_id')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="">Select template</option>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
            {errors.template_id && <div className="text-[12px] text-rose-600">{errors.template_id.message}</div>}
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Status</span>
            <select
              {...register('status')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            >
              <option value="draft">Draft</option>
              <option value="final">Final</option>
            </select>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Mode</span>
            <div className="grid h-10 grid-cols-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setValue('mode', 'itemized', { shouldDirty: true, shouldValidate: false })}
                className={`rounded-[10px] text-[12px] font-semibold transition ${
                  selectedMode === 'itemized' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                }`}
              >
                Itemized
              </button>
              <button
                type="button"
                onClick={() => setValue('mode', 'lot', { shouldDirty: true, shouldValidate: false })}
                className={`rounded-[10px] text-[12px] font-semibold transition ${
                  selectedMode === 'lot' ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500'
                }`}
              >
                Lot
              </button>
            </div>
          </label>

          <label className="space-y-1.5">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Company state</span>
            <input
              {...register('company_state')}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-[13px] text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
              placeholder={DEFAULT_COMPANY_STATE}
            />
          </label>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="grid gap-5">
            {sourceDraftQuery.isFetching && selectedSourceId && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-[13px] text-slate-600">
                Loading source data from the selected {getSourceLabel(selectedSourceType).toLowerCase()}...
              </div>
            )}

            {(createInvoice.isError || updateInvoice.isError || invoiceQuery.isError) && (
              <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
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

            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50/60 px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Context</div>
                <div className="mt-3 grid gap-3 text-[13px] text-slate-600 sm:grid-cols-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Client state</div>
                    <div className="mt-1 font-medium text-slate-900">{clientState || 'Pending selection'}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Template type</div>
                    <div className="mt-1 font-medium capitalize text-slate-900">{getValues('template_type').replace('_', ' ')}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Source</div>
                    <div className="mt-1 font-medium text-slate-900">{getSourceLabel(selectedSourceType)}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] text-slate-400">Materials rows</div>
                    <div className="mt-1 font-medium text-slate-900">{watchedMaterials.length}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Keyboard flow</div>
                <div className="mt-3 space-y-2 text-[13px] text-slate-600">
                  <div>Use arrow keys or Enter to move across editable line-item cells.</div>
                  <div>Amounts update automatically from qty x rate.</div>
                  <button
                    type="button"
                    onClick={() => itemsFieldArray.append(selectedMode === 'lot' ? createLotItem() : createEmptyItem())}
                    className="mt-2 inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-[12px] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    <Plus size={14} />
                    Quick add row
                  </button>
                </div>
              </div>
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
  );
}
