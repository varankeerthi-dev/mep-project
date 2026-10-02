import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { Download, Eye, FileText, Loader2, Mail, Plus, Printer, Save } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { ChecklistConfirmationDialog } from '../../features/document-checklists/ChecklistConfirmationDialog';
import { useDocumentChecklistGate } from '../../features/document-checklists/useDocumentChecklistGate';
import { Button } from '@/components/ui/button';
import { AiDocumentParserModal } from '@/components/AiDocumentParserModal';
import { TermsConditionsDrawer } from '@/components/TermsConditionsDrawer';
import {
  DocumentActionBar,
  DocumentEditorShell,
  DocumentLineItemsSurface,
} from '@/components/document-editor';
import { ArcConfirmationDialog } from '@/components/ArcConfirmationDialog';
import { DocumentConversionChain } from '../../components/DocumentConversionChain';
import { RevisionBadge } from '../../components/RevisionBadge';
import { RevisionHistoryDialog } from '../../components/RevisionHistoryDialog';
import { RevisionReasonDialog } from '../../components/RevisionReasonDialog';
import { AddShippingAddressModal } from '../components/AddShippingAddressModal';
import { InvoiceItemsEditor } from '../components/InvoiceItemsEditor';
import { InvoiceMaterialsEditor } from '../components/InvoiceMaterialsEditor';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { InvoiceSummaryFooter } from '../components/InvoiceSummaryFooter';
import POLineItemsSelector from '../components/POLineItemsSelector';
import QuotationLineItemsSelector from '../components/QuotationLineItemsSelector';
import ProformaLineItemsSelector from '../components/ProformaLineItemsSelector';
import { useInvoice } from '../hooks';
import { getInvoiceTerms } from '../api';
import {
  InvoiceEditorSchema,
  calculateDraftTotals,
  createEmptyInvoiceFormValues,
  createEmptyItem,
  flattenInvoiceTermsText,
  getTemplateExtraColumnLabel,
  getSourceLabel,
  type InvoiceEditorFormValues,
} from '../ui-utils';
import type { ConversionType } from '../../conversions/types';
import { useAiDocumentImport } from '../editor/hooks/useAiDocumentImport';
import { useInvoiceEditorData } from '../editor/hooks/useInvoiceEditorData';
import { useInvoiceSource } from '../editor/hooks/useInvoiceSource';
import { useInvoiceFormSync } from '../editor/hooks/useInvoiceFormSync';
import { useSaveInvoice } from '../editor/hooks/useSaveInvoice';
import { runInvoiceV2ChecklistAction } from '../editor/invoiceV2ChecklistAction';
import { InvoiceHeaderCards, fieldErrorMessage } from '../editor/components/InvoiceHeaderCards';
import { InvoiceImportBanner } from '../editor/components/InvoiceImportBanner';

/**
 * InvoiceEditorPageV2 — Modernized Invoice Creator & Editor V2.
 *
 * Thin orchestrator: the DocumentEditorShell layout plus feature hooks
 * extracted from the V1 editor (data, sources, form sync, save, AI import).
 */
export default function InvoiceEditorPageV2() {
  const { user, organisation } = useAuth();
  const checklistGate = useDocumentChecklistGate();
  const location = useLocation();
  const navigate = useNavigate();
  const invoiceId = new URLSearchParams(location.search).get('id') ?? undefined;
  const isEditMode = Boolean(invoiceId);
  const convertFrom = new URLSearchParams(location.search).get('convertFrom') as ConversionType | null;
  const convertSourceId = new URLSearchParams(location.search).get('sourceId');
  const isConverting = Boolean(convertFrom && convertSourceId && !isEditMode);
  const duplicateFrom = new URLSearchParams(location.search).get('from');
  const isDuplicating = Boolean(duplicateFrom && !isEditMode);

  // ── Form ──
  const form = useForm<InvoiceEditorFormValues>({
    resolver: zodResolver(InvoiceEditorSchema),
    defaultValues: createEmptyInvoiceFormValues((organisation?.state as string | null | undefined) || null),
    mode: 'onSubmit',
  });

  const {
    control,
    register,
    handleSubmit,
    setValue,
    watch,
    getValues,
    formState,
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
  const companyState = useWatch({ control, name: 'company_state' }) ?? null;
  const clientState = useWatch({ control, name: 'client_state' }) ?? null;
  const selectedShippingAddressId = useWatch({ control, name: 'shipping_address_id' }) ?? null;
  const defaultWarehouseId = useWatch({ control, name: 'default_warehouse_id' });

  const { errors } = formState;

  // ── Local UI state ──
  const [pdfAction, setPdfAction] = useState<'preview' | 'download' | 'print' | 'email' | null>(null);
  const [isShippingAddressModalOpen, setIsShippingAddressModalOpen] = useState(false);
  const [isPOSelectorOpen, setIsPOSelectorOpen] = useState(false);
  const [isApplyingPOItems, setIsApplyingPOItems] = useState(false);
  const [isQuotationSelectorOpen, setIsQuotationSelectorOpen] = useState(false);
  const [isApplyingQuotationItems, setIsApplyingQuotationItems] = useState(false);
  const [isProformaSelectorOpen, setIsProformaSelectorOpen] = useState(false);
  const [isApplyingProformaItems, setIsApplyingProformaItems] = useState(false);
  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  const [, setPendingArcEnabled] = useState(false);
  const [enableRoundOff, setEnableRoundOff] = useState(false);
  const [isTermsDrawerOpen, setIsTermsDrawerOpen] = useState(false);
  const [pendingTermsTemplate, setPendingTermsTemplate] = useState<any>(null);

  // ── Revision Management ──
  const [invoiceRevisionNo, setInvoiceRevisionNo] = useState(1);
  const [invoiceRevisionHistory, setInvoiceRevisionHistory] = useState<any[]>([]);
  const [invoiceRevisionReason, setInvoiceRevisionReason] = useState('');
  const [invoiceRevisionDialogOpen, setInvoiceRevisionDialogOpen] = useState(false);
  const [invoiceReasonDialogOpen, setInvoiceReasonDialogOpen] = useState(false);
  const [, setPendingInvoiceSave] = useState(false);

  // ── Hydration refs ──
  const loadedInvoiceIdRef = useRef<string>('');
  const initialSourceKeyRef = useRef<string>('');
  const hydratedSourceKeyRef = useRef<string>('');

  // ── Existing / duplicate invoice queries ──
  const existingInvoiceQuery = useInvoice(invoiceId ?? null);
  const duplicateInvoiceQuery = useInvoice(duplicateFrom ?? null);

  const prefetchInvoicePdf = useCallback(() => {
    import('../pdf');
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      prefetchInvoicePdf();
    }, 2500);
    return () => clearTimeout(timer);
  }, [prefetchInvoicePdf]);

  // ── Feature hooks ──
  const editorData = useInvoiceEditorData({
    organisationId: organisation?.id,
    selectedClientId,
    selectedShippingAddressId,
    watchedItems,
    useArcPricing,
  });

  // ── Derived selections & totals ──
  const clients = editorData.clientsQuery.data ?? [];
  const selectedClient = useMemo(
    () => clients.find((client) => client.id === selectedClientId) ?? null,
    [clients, selectedClientId],
  );

  const templates = editorData.templatesQuery.data ?? [];
  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedTemplateId) ?? null,
    [selectedTemplateId, templates],
  );

  const selectedClientAddress = useMemo(() => {
    if (selectedClient) {
      return [selectedClient.address1, selectedClient.address2, selectedClient.city, selectedClient.state, selectedClient.pincode]
        .filter(Boolean)
        .join(', ');
    }
    return '';
  }, [selectedClient]);

  const totals = useMemo(
    () =>
      calculateDraftTotals({
        items: watchedItems,
        company_state: companyState,
        client_state: clientState,
      }, enableRoundOff),
    [companyState, clientState, watchedItems, enableRoundOff],
  );

  const customColumnLabel = getTemplateExtraColumnLabel(selectedTemplate, watchedItems);
  const showCustomColumn = getValues('template_type') === 'client_custom';

  const source = useInvoiceSource({
    organisationId: organisation?.id,
    organisationState: (organisation?.state as string | null | undefined) ?? null,
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
  });

  const save = useSaveInvoice({
    form,
    invoiceId,
    isEditMode,
    organisationId: organisation?.id,
    organisationName: organisation?.name,
    runChecklist: checklistGate.run,
    totals,
    watchedItems,
    poValidation: source.poValidation,
    selectedSourceType,
    selectedSourceId,
    quotationItems: source.quotationDetailsQuery.data?.items ?? [],
    proformaItems: source.proformaDetailsQuery.data?.items ?? [],
    conversionInfoRef: source.conversionInfoRef,
    existingInvoice: existingInvoiceQuery.data,
    pendingTermsTemplate,
    revision: {
      invoiceRevisionNo,
      invoiceRevisionHistory,
      invoiceRevisionReason,
      setInvoiceRevisionNo,
      setInvoiceRevisionHistory,
      setInvoiceRevisionReason,
    },
  });

  const runChecklistAction = async <T,>(action: () => T | Promise<T>) => {
    const result = await runInvoiceV2ChecklistAction({
      organisationId: organisation?.id,
      runChecklist: checklistGate.run,
      action,
    });
    if (result.kind === 'failed') {
      toast.error('Checklist verification failed. Nothing was saved.', { description: result.error });
    } else if (result.kind === 'incomplete') {
      toast.error('Complete every required checklist item before continuing.');
    }
    return result;
  };

  const formSync = useInvoiceFormSync({
    form,
    user,
    isEditMode,
    isDuplicating,
    isConverting,
    existingInvoice: existingInvoiceQuery.data,
    duplicateInvoice: duplicateInvoiceQuery.data,
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
    setHeaderDiscounts: editorData.setHeaderDiscounts,
    organisationId: organisation?.id,
    setPendingTermsTemplate,
    revision: {
      setInvoiceRevisionNo,
      setInvoiceRevisionHistory,
      setInvoiceRevisionReason,
    },
  });

  const aiImport = useAiDocumentImport({
    form,
    user,
    materials: editorData.materialsQuery.data ?? [],
  });

  // ── Terms & Conditions draft state ──
  const watchedTermsText = useWatch({ control, name: 'terms_text' }) ?? '';

  // ── Load saved terms when editing ──
  const termsLoadedRef = useRef(false);
  useEffect(() => {
    if (!isEditMode || !invoiceId || !organisation?.id || termsLoadedRef.current) return;
    termsLoadedRef.current = true;
    getInvoiceTerms(invoiceId, organisation.id)
      .then((row) => {
        if (!row?.custom_content) {
          setPendingTermsTemplate(null);
          return;
        }
        let parsed: any = row.custom_content;
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch { parsed = { text: parsed }; }
        }
        if (parsed && typeof parsed === 'object' && Array.isArray((parsed as any).sections)) {
          setPendingTermsTemplate(parsed);
          setValue('terms_template_id', (parsed as any).id ?? row.template_id ?? null, { shouldDirty: false });
        }
        setValue('terms_text', flattenInvoiceTermsText(parsed), { shouldDirty: false });
      })
      .catch((err) => console.warn('Failed to load invoice terms:', err));
  }, [isEditMode, invoiceId, organisation?.id, setValue]);

  // ── Source line-item selection handlers ──
  const handlePOSelection = () => {
    if (selectedSourceType === 'po' && selectedSourceId && source.poDetailsQuery.data) {
      setIsPOSelectorOpen(true);
    }
  };

  const handlePOLineItemsApply = (selectedItems: any[]) => {
    setIsApplyingPOItems(true);

    const invoiceItems = selectedItems.map(item => {
      const poRate = item.rate_per_unit;
      return {
        id: undefined,
        item_id: null,
        description: item.description,
        hsn_code: item.hsn_sac_code || null,
        qty: item.quantity,
        rate: poRate,
        discount_percent: 0,
        amount: item.full_amount,
        tax_percent: item.gst_percentage,
        meta_json: {
          tax_percent: item.gst_percentage,
          uom: item.unit || 'Nos',
          item_code: item.item_code || null,
          po_line_item_id: item.id,
          po_id: selectedSourceId || null,
          original_quantity: item.original_quantity,
          original_rate: item.original_rate || item.rate_per_unit,
          base_rate: poRate,
          rate_after_discount: poRate,
          material_id: item.item_id || null,
          variant_id: item.variant_id || null,
          make: item.make || null,
          overbilling_reason: item.overbilling_reason || null,
        },
      };
    });

    itemsFieldArray.remove();
    setTimeout(() => {
      invoiceItems.forEach((item, index) => {
        if (index === 0) {
          itemsFieldArray.replace([item]);
        } else {
          itemsFieldArray.append(item);
        }
      });

      setIsPOSelectorOpen(false);

      setTimeout(() => {
        setIsApplyingPOItems(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => {
          if (input instanceof HTMLElement) {
            input.blur();
          }
        });
        document.body.focus();
      }, 100);
    }, 50);
  };

  const handleQuotationSelection = () => {
    if (selectedSourceType === 'quotation' && selectedSourceId && source.quotationDetailsQuery.data) {
      setIsQuotationSelectorOpen(true);
    }
  };

  const handleQuotationItemsApply = (selectedItems: any[]) => {
    setIsApplyingQuotationItems(true);

    const invoiceItems = selectedItems.map(item => {
      const qtRate = item.rate;
      return {
        id: undefined,
        item_id: item.item_id || null,
        description: item.description,
        hsn_code: item.hsn_code || null,
        qty: item.qty,
        rate: qtRate,
        discount_percent: item.discount_percent || 0,
        amount: item.line_total || (item.qty * qtRate),
        tax_percent: item.tax_percent || 18,
        meta_json: {
          tax_percent: item.tax_percent || 18,
          uom: item.uom || 'Nos',
          base_rate: qtRate,
          rate_after_discount: qtRate - (qtRate * (item.discount_percent || 0) / 100),
          quotation_item_id: item.id,
          original_qty: item.qty,
          material_id: item.item_id || null,
          variant_id: item.variant_id || null,
          make: item.make || null,
        },
      };
    });

    itemsFieldArray.remove();
    setTimeout(() => {
      invoiceItems.forEach((item, index) => {
        if (index === 0) {
          itemsFieldArray.replace([item]);
        } else {
          itemsFieldArray.append(item);
        }
      });

      setIsQuotationSelectorOpen(false);

      setTimeout(() => {
        setIsApplyingQuotationItems(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => {
          if (input instanceof HTMLElement) {
            input.blur();
          }
        });
        document.body.focus();
      }, 100);
    }, 50);
  };

  const handleProformaSelection = () => {
    if ((selectedSourceType as string) === 'proforma' && selectedSourceId && source.proformaDetailsQuery.data) {
      setIsProformaSelectorOpen(true);
    }
  };

  const handleProformaItemsApply = (selectedItems: any[]) => {
    setIsApplyingProformaItems(true);

    const invoiceItems = selectedItems.map(item => {
      const pfRate = item.rate;
      return {
        id: undefined,
        item_id: item.item_id || null,
        description: item.description,
        hsn_code: item.hsn_code || null,
        qty: item.qty,
        rate: pfRate,
        discount_percent: item.discount_percent || 0,
        amount: item.line_total || (item.qty * pfRate),
        tax_percent: item.tax_percent || 18,
        meta_json: {
          tax_percent: item.tax_percent || 18,
          uom: item.uom || 'Nos',
          base_rate: pfRate,
          rate_after_discount: pfRate - (pfRate * (item.discount_percent || 0) / 100),
          proforma_item_id: item.id,
          original_qty: item.qty,
          material_id: item.item_id || null,
          variant_id: item.variant_id || null,
          make: item.make || null,
        },
      };
    });

    itemsFieldArray.remove();
    setTimeout(() => {
      invoiceItems.forEach((item, index) => {
        if (index === 0) {
          itemsFieldArray.replace([item]);
        } else {
          itemsFieldArray.append(item);
        }
      });

      setIsProformaSelectorOpen(false);

      setTimeout(() => {
        setIsApplyingProformaItems(false);
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => {
          if (input instanceof HTMLElement) {
            input.blur();
          }
        });
        document.body.focus();
      }, 100);
    }, 50);
  };

  // ── Draft save (with revision-reason gate on edit) ──
  const handleSaveAsDraft = handleSubmit(async (values) => {
    if (isEditMode && invoiceId) {
      setPendingInvoiceSave(true);
      setInvoiceReasonDialogOpen(true);
      return;
    }

    await runChecklistAction(() => save.executeInvoiceDraftSave(values));
  });

  // ── PDF actions ──
  const handlePreviewPdf = async () => {
    if (!invoiceId) {
      toast.error('Please save the invoice first before previewing.');
      return;
    }

    setPdfAction('preview');
    try {
      const { previewInvoicePDF } = await import('../pdf');
      await previewInvoicePDF(invoiceId);
    } catch (error: any) {
      toast.error(`Failed to preview PDF: ${error.message}`);
    } finally {
      setPdfAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceId) {
      toast.error('Please save the invoice first before downloading.');
      return;
    }

    setPdfAction('download');
    try {
      const { downloadInvoicePDF } = await import('../pdf');
      await downloadInvoicePDF(invoiceId);
    } catch (error: any) {
      toast.error(`Failed to download PDF: ${error.message}`);
    } finally {
      setPdfAction(null);
    }
  };

  const handlePrintPdf = async () => {
    if (!invoiceId) {
      toast.error('Please save the invoice first before printing.');
      return;
    }

    setPdfAction('print');
    try {
      const { printInvoicePDF } = await import('../pdf');
      await printInvoicePDF(invoiceId);
    } catch (error: any) {
      toast.error(`Failed to print PDF: ${error.message}`);
    } finally {
      setPdfAction(null);
    }
  };

  const handleEmailPdf = async () => {
    if (!invoiceId) {
      toast.error('Please save the invoice first before emailing.');
      return;
    }

    setPdfAction('email');
    try {
      const { emailInvoicePDF } = await import('../pdf');
      await emailInvoicePDF(invoiceId);
    } catch (error: any) {
      toast.error(`Failed to email PDF: ${error.message}`);
    } finally {
      setPdfAction(null);
    }
  };

  if ((isEditMode && existingInvoiceQuery.isLoading) || (isDuplicating && duplicateInvoiceQuery.isLoading)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', color: '#525252' }}>
          <Loader2 size={20} className="animate-spin" />
          {isDuplicating ? 'Loading invoice for duplication...' : 'Loading invoice...'}
        </div>
      </div>
    );
  }

  return (
    <DocumentEditorShell
      actionBar={
        <DocumentActionBar
          title={isEditMode ? `Edit ${existingInvoiceQuery.data?.invoice_no || 'Invoice'}` : isDuplicating ? 'Create Invoice from Existing' : 'New Invoice'}
          statusBadge={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <InvoiceStatusBadge status={getValues('status') as any} />
              <RevisionBadge revisionNo={invoiceRevisionNo} onClick={() => setInvoiceRevisionDialogOpen(true)} />
            </div>
          }
          fixed={{ top: 32, left: 220 }}
          leftActions={
            <>
              <Button variant="outline" size="icon-xs" type="button" onClick={() => aiImport.setIsParserOpen(true)} title="Import PDF/Image">
                <FileText size={14} />
              </Button>
              {invoiceId && (
                <DocumentConversionChain documentType="invoice" documentId={invoiceId} />
              )}
            </>
          }
          rightActions={
            <>
              <Button variant="outline" size="icon-xs" type="button" onMouseEnter={prefetchInvoicePdf} onFocus={prefetchInvoicePdf} onClick={handlePreviewPdf} disabled={!isEditMode || pdfAction !== null} title={pdfAction === 'preview' ? 'Preparing PDF...' : 'Preview PDF'}>
                {pdfAction === 'preview' ? <Loader2 size={14} className="animate-spin" /> : <Eye size={14} />}
              </Button>
              <Button variant="outline" size="icon-xs" type="button" onMouseEnter={prefetchInvoicePdf} onFocus={prefetchInvoicePdf} onClick={handleDownloadPdf} disabled={!isEditMode || pdfAction !== null} title={pdfAction === 'download' ? 'Preparing PDF...' : 'Download PDF'}>
                {pdfAction === 'download' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              </Button>
              <Button variant="outline" size="icon-xs" type="button" onMouseEnter={prefetchInvoicePdf} onFocus={prefetchInvoicePdf} onClick={handlePrintPdf} disabled={!isEditMode || pdfAction !== null} title={pdfAction === 'print' ? 'Preparing PDF...' : 'Print'}>
                {pdfAction === 'print' ? <Loader2 size={14} className="animate-spin" /> : <Printer size={14} />}
              </Button>
              <Button variant="outline" size="icon-xs" type="button" onMouseEnter={prefetchInvoicePdf} onFocus={prefetchInvoicePdf} onClick={handleEmailPdf} disabled={!isEditMode || pdfAction !== null} title={pdfAction === 'email' ? 'Preparing PDF...' : 'Email'}>
                {pdfAction === 'email' ? <Loader2 size={14} className="animate-spin" /> : <Mail size={14} />}
              </Button>
              <Button variant="outline" size="sm" type="button" onClick={() => navigate('/invoices')} disabled={save.isSaving}>
                Cancel
              </Button>
              <Button variant="secondary" size="sm" type="button" onClick={handleSaveAsDraft} disabled={save.isSaving || checklistGate.isBusy}>
                {save.isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Save as Draft
              </Button>
              <Button size="sm" type="button" onClick={() => (document.getElementById('invoice-form') as HTMLFormElement | null)?.requestSubmit()} disabled={save.isSaving || checklistGate.isBusy}>
                {save.isSaving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
                {isEditMode ? 'Update Invoice' : 'Create Invoice'}
              </Button>
            </>
          }
        />
      }
    >
      <ChecklistConfirmationDialog
        policy={checklistGate.policy}
        policyChanged={checklistGate.policyChanged}
        onContinue={checklistGate.continueWith}
        onCancel={checklistGate.cancel}
      />
      <form id="invoice-form" onSubmit={save.onSubmit}>
        <InvoiceImportBanner
          visible={Boolean(aiImport.activeImportSessionId)}
          onUndo={aiImport.handleUndoImport}
        />

        <InvoiceHeaderCards
          form={form}
          errors={errors as Record<string, any>}
          clients={clients}
          selectedClient={selectedClient}
          selectedClientAddress={selectedClientAddress}
          selectedClientState={selectedClient?.state}
          templates={templates.map((t) => ({ id: t.id, name: t.name }))}
          warehouses={editorData.warehousesQuery.data ?? []}
          variantRows={editorData.variantRows}
          shippingAddresses={editorData.shippingAddressesQuery.data ?? []}
          invoiceNo={getValues('invoice_no')}
          disableShipping={!selectedClientId}
          headerDiscounts={editorData.headerDiscounts}
          onDiscountInputChange={(variantId, value) => editorData.setHeaderDiscounts(prev => ({ ...prev, [variantId]: value }))}
          onHeaderDiscountChange={formSync.handleHeaderDiscountChange}
          arcPricing={{
            enabled: useArcPricing,
            map: editorData.arcPricingMap,
            totalItems: watchedItems.length,
            clientId: selectedClientId,
            onToggle: (enabled) => {
              if (enabled && watchedItems.length > 0) {
                setPendingArcEnabled(true);
                setArcPricingConfirmOpen(true);
              } else {
                setUseArcPricing(enabled);
                setPendingArcEnabled(false);
                if (!enabled) editorData.setArcPricingMap({});
              }
            },
          }}
          onOpenAddShipping={() => setIsShippingAddressModalOpen(true)}
        />

        {selectedSourceType !== 'direct' && (
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
              {getSourceLabel(selectedSourceType)}:
            </label>
            <select
              {...register('source_id')}
              style={{
                flex: 1,
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#171717',
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              <option value="">Select {getSourceLabel(selectedSourceType)}</option>
              {(source.sourcesQuery.data ?? []).map((option) => (
                <option key={option.id} value={option.id}>{option.label}</option>
              ))}
            </select>
            {(selectedSourceType === 'po' || selectedSourceType === 'quotation' || (selectedSourceType as string) === 'proforma') && selectedSourceId && (
              <Button
                variant="default"
                size="sm"
                type="button"
                onClick={selectedSourceType === 'po' ? handlePOSelection : selectedSourceType === 'quotation' ? handleQuotationSelection : handleProformaSelection}
              >
                Select Lines
              </Button>
            )}
            {source.sourceDraftQuery.isLoading && (
              <span style={{ fontSize: '11px', color: '#737373' }}>Loading {getSourceLabel(selectedSourceType)} details...</span>
            )}
          </div>
        )}

        {errors.root && (
          <div
            style={{
              padding: '12px',
              marginBottom: '16px',
              border: '1px solid #dc2626',
              borderRadius: '4px',
              background: '#fef2f2',
              color: '#dc2626',
              fontSize: '13px',
            }}
          >
            {errors.root.message}
          </div>
        )}

        <DocumentLineItemsSurface
          title="Line Items"
          actions={
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => itemsFieldArray.append(createEmptyItem())}
              >
                <Plus size={14} className="mr-1" /> Add Line Item
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePOSelection}
                disabled={selectedSourceType !== 'po' || !selectedSourceId || !source.poDetailsQuery.data}
                title="Select multiple lines from the selected purchase order"
              >
                <Plus size={14} className="mr-1" /> Add Multiple Items
              </Button>
            </>
          }
        >
          <InvoiceItemsEditor
            fields={itemsFieldArray.fields}
            items={watchedItems}
            register={register}
          append={itemsFieldArray.append}
          insert={itemsFieldArray.insert}
          remove={itemsFieldArray.remove}
          move={itemsFieldArray.move}
            mode={selectedMode}
            showCustomColumn={showCustomColumn}
            extraColumnLabel={customColumnLabel}
            error={fieldErrorMessage(errors.items)}
            productOptions={editorData.materialsQuery.data ?? []}
            setValue={setValue}
            formState={formState}
            isApplyingPOItems={isApplyingPOItems}
            warehouses={editorData.warehousesQuery.data ?? []}
            stockRows={editorData.stockQuery.data ?? []}
            defaultWarehouseId={defaultWarehouseId}
            variantOptions={editorData.variantRows.map((v: any) => ({ id: String(v.id), variant_name: String(v.variant_name || '') }))}
            itemVariantIdsMap={editorData.itemVariantIdsMapQuery.data?.variantIdsMap ?? {}}
            itemMakesMap={editorData.itemVariantIdsMapQuery.data?.makesMap ?? {}}
            useArcPricing={useArcPricing}
            arcPricingMap={editorData.arcPricingMap}
            headerDiscounts={editorData.headerDiscounts}
            discountCategoryMap={editorData.discountCategoryMap}
          />
        </DocumentLineItemsSurface>

        {selectedMode === 'lot' && (
          <div style={{ marginTop: '16px' }}>
            <InvoiceMaterialsEditor
              fields={materialsFieldArray.fields}
              register={register}
              append={materialsFieldArray.append}
              remove={materialsFieldArray.remove}
              materials={watchedMaterials}
              productOptions={editorData.materialsQuery.data ?? []}
              setValue={setValue}
              watch={watch}
              warehouses={editorData.warehousesQuery.data ?? []}
              defaultWarehouseId={defaultWarehouseId}
            />
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
            marginTop: '16px',
            padding: '12px',
            background: '#f5f5f5',
            borderRadius: '4px',
            border: '1px solid #e5e5e5',
          }}
        >
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', marginBottom: '2px' }}>
              Client State
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {clientState || 'Pending'}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', marginBottom: '2px' }}>
              Template Type
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717', textTransform: 'capitalize' }}>
              {getValues('template_type').replace('_', ' ')}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', marginBottom: '2px' }}>
              Source
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {getSourceLabel(selectedSourceType)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: '#737373', marginBottom: '2px' }}>
              Materials
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#171717' }}>
              {watchedMaterials.length}
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
          roundOff={totals.roundOff}
          enableRoundOff={enableRoundOff}
          onToggleRoundOff={() => setEnableRoundOff(!enableRoundOff)}
        />

        <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '12px' }}>
          <label style={{ fontSize: '11px', fontWeight: 600, color: '#374151' }}>
            Authorized Signatory:
          </label>
          <select
            {...register('authorized_signatory_id')}
            style={{
              minWidth: '220px',
              padding: '6px 10px',
              border: '1px solid #d4d4d4',
              borderRadius: '4px',
              fontSize: '12px',
              color: '#171717',
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <option value="">Select Signatory...</option>
            {((organisation as any)?.signatures || []).map((sig: any) => (
              <option key={String(sig.id)} value={String(sig.id)}>{sig.name}</option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginTop: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
              Notes & Remarks:
            </label>
            <textarea
              {...register('remarks')}
              rows={4}
              placeholder="Enter internal notes or additional instructions..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#171717',
                background: '#fff',
                resize: 'vertical',
              }}
            />
          </div>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: '#374151' }}>
                Terms & Conditions:
              </label>
              <Button variant="outline" size="sm" type="button" onClick={() => setIsTermsDrawerOpen(true)}>
                {watchedTermsText ? 'Edit' : 'Add'}
              </Button>
            </div>
            <textarea
              {...register('terms_text')}
              rows={4}
              placeholder="Type terms & conditions here, or use the drawer to add from a template..."
              style={{
                width: '100%',
                padding: '8px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '12px',
                color: '#171717',
                background: '#fff',
                resize: 'vertical',
              }}
            />
          </div>
        </div>
      </form>

      {/* ── Modals & Selectors ── */}
      <ArcConfirmationDialog
        open={arcPricingConfirmOpen}
        onClose={() => {
          setArcPricingConfirmOpen(false);
          setPendingArcEnabled(false);
        }}
        onApplyAll={() => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
        }}
        onApplySelected={(_itemIds) => {
          setUseArcPricing(true);
          setArcPricingConfirmOpen(false);
        }}
        items={watchedItems.map((item: any, index: number) => ({
          id: item.id || `item-${index}`,
          description: item.meta_json?.material_name || item.description || `Item ${index + 1}`,
          currentRate: Number(item.rate) || 0,
          arcRate: editorData.arcPricingMap[item.meta_json?.material_id]?.[0]?.arc_rate || null,
          hasArcRate: Boolean(editorData.arcPricingMap[item.meta_json?.material_id]?.length > 0),
          variantId: item.meta_json?.variant_id,
          materialId: item.meta_json?.material_id,
        }))}
      />

      {selectedClientId && (
        <AddShippingAddressModal
          isOpen={isShippingAddressModalOpen}
          onClose={() => setIsShippingAddressModalOpen(false)}
          clientId={selectedClientId}
          onSuccess={() => {
            editorData.shippingAddressesQuery.refetch();
          }}
        />
      )}

      {isPOSelectorOpen && source.poDetailsQuery.data && (
        <POLineItemsSelector
          isOpen={isPOSelectorOpen}
          onClose={() => setIsPOSelectorOpen(false)}
          poHeader={source.poDetailsQuery.data.header}
          lineItems={source.poDetailsQuery.data.lineItems}
          onApply={handlePOLineItemsApply}
        />
      )}

      {isQuotationSelectorOpen && source.quotationDetailsQuery.data && (
        <QuotationLineItemsSelector
          isOpen={isQuotationSelectorOpen}
          onClose={() => setIsQuotationSelectorOpen(false)}
          quotationHeader={source.quotationDetailsQuery.data.header}
          items={source.quotationDetailsQuery.data.items}
          onApply={handleQuotationItemsApply}
        />
      )}

      {isProformaSelectorOpen && source.proformaDetailsQuery.data && (
        <ProformaLineItemsSelector
          isOpen={isProformaSelectorOpen}
          onClose={() => setIsProformaSelectorOpen(false)}
          proformaHeader={source.proformaDetailsQuery.data.header}
          items={source.proformaDetailsQuery.data.items}
          onApply={handleProformaItemsApply}
        />
      )}

      {/* AI Document Parser Modal */}
      <AiDocumentParserModal
        isOpen={aiImport.isParserOpen}
        onClose={() => aiImport.setIsParserOpen(false)}
        documentType="Invoice"
        currentHeaderValues={{
          party_id: selectedClientId,
          party_name: clients.find((c) => c.id === selectedClientId)?.name || '',
          date: getValues('invoice_date'),
          reference_number: getValues('invoice_no')
        }}
        onImport={aiImport.handleImportSuccess}
      />

      {/* Revision Reason Dialog */}
      <RevisionReasonDialog
        open={invoiceReasonDialogOpen}
        onClose={() => {
          setInvoiceReasonDialogOpen(false);
          setPendingInvoiceSave(false);
        }}
        onConfirm={async (reason) => {
          setInvoiceReasonDialogOpen(false);
          const result = await runChecklistAction(async () => {
            setInvoiceRevisionReason(reason);
            await save.saveInvoiceCurrentRevision(reason);
            setPendingInvoiceSave(false);
            // Re-trigger the save after revision snapshot.
            await save.executeInvoiceDraftSave(getValues());
          });
          if (result.kind !== 'completed') setPendingInvoiceSave(false);
        }}
        currentRevisionNo={invoiceRevisionNo}
        documentNumber={getValues('invoice_no') || 'INV-0001'}
      />

      {/* Revision History Dialog */}
      <RevisionHistoryDialog
        open={invoiceRevisionDialogOpen}
        onClose={() => setInvoiceRevisionDialogOpen(false)}
        revisionHistory={invoiceRevisionHistory}
        currentRevisionNo={invoiceRevisionNo}
        currentTotal={totals?.total || 0}
        documentNumber={getValues('invoice_no') || 'INV-0001'}
      />

      {/* Terms & Conditions Drawer */}
      <TermsConditionsDrawer
        isOpen={isTermsDrawerOpen}
        onClose={() => setIsTermsDrawerOpen(false)}
        initialTemplate={pendingTermsTemplate}
        onSave={(terms) => {
          setPendingTermsTemplate(terms);
          setValue('terms_text', flattenInvoiceTermsText(terms), { shouldDirty: true });
          setValue('terms_template_id', terms?.id ?? null, { shouldDirty: true });
        }}
      />
    </DocumentEditorShell>
  );
}
