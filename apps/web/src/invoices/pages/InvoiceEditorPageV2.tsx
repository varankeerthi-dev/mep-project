import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Loader2, Mail, Plus, Printer, Save, X, FileText, RotateCcw, User, Briefcase } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AiDocumentParserModal } from '@/components/AiDocumentParserModal';
import { toast } from 'sonner';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabase';
import {
  DocumentActionBar,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
} from '@/components/document-editor';
import { mapInvoiceSourceToDraft, generateInvoiceNumber, loadClientPOs, incrementInvoiceNumber } from '../api';
import { InvoiceItemsEditor } from '../components/InvoiceItemsEditor';
import { InvoiceMaterialsEditor } from '../components/InvoiceMaterialsEditor';
import { InvoiceSummaryFooter } from '../components/InvoiceSummaryFooter';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { DocumentConversionChain } from '../../components/DocumentConversionChain';
import { RevisionBadge } from '../../components/RevisionBadge';
import { RevisionHistoryDialog } from '../../components/RevisionHistoryDialog';
import { RevisionReasonDialog } from '../../components/RevisionReasonDialog';
import { ArcPricingToggle, ArcPricingStatusBadge } from '@/components/ArcPricingToggle';
import { ArcConfirmationDialog, type ArcPricingItem } from '@/components/ArcConfirmationDialog';
import { fetchArcPricingForItems } from '@/lib/arc-pricing';
import { AddShippingAddressModal } from '../components/AddShippingAddressModal';
import POLineItemsSelector from '../components/POLineItemsSelector';
import { updatePoLineItemBilling, extractInvoicePoItems } from '../../lib/poBillingUtils';
import QuotationLineItemsSelector from '../components/QuotationLineItemsSelector';
import ProformaLineItemsSelector from '../components/ProformaLineItemsSelector';
import { useCreateInvoice, useInvoice, useInvoiceTemplates, useUpdateInvoice } from '../hooks';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import type { InvoiceEditorFormValues, InvoiceClientOption, InvoiceMaterialOption, ClientShippingAddress } from '../ui-utils';
import { useWarehouses } from '@/hooks/useWarehouses';
import { useVariants } from '@/hooks/useVariants';
import {
  InvoiceEditorSchema,
  type InvoiceSourceOption,
  DEFAULT_COMPANY_STATE,
  calculateDraftTotals,
  composeInvoiceInput,
  createEmptyInvoiceFormValues,
  createEmptyItem,
  createEmptyMaterial,
  createLotItem,
  formatDate,
  formatCurrency,
  getSourceLabel,
  getTemplateExtraColumnLabel,
  getTemplateTypeFromTemplate,
  invoiceToFormValues,
} from '../ui-utils';
import { useConvertDocument, useConversionStatus, getSourceTableName } from '../../conversions/hooks';
import type { ConversionType } from '../../conversions/types';
import { Button } from '@/components/ui/button';

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

async function loadClientOptions(organisationId: string): Promise<InvoiceClientOption[]> {
  const { data, error } = await supabase.from('clients').select('*').eq('organisation_id', organisationId);
  if (error) throw error;

  return (data ?? [])
    .map((client: any) => ({
      id: String(client.id),
      name: String(client.name ?? client.client_name ?? 'Unnamed client'),
      state: client.state ?? null,
      gst_number: client.gst_number ?? client.gstin ?? null,
      default_template_id: client.default_template_id ?? null,
      discount_type: client.discount_type ?? null,
      standard_pricelist_id: client.standard_pricelist_id ?? null,
      custom_discounts: client.custom_discounts ?? {},
      discount_profile_id: client.discount_profile_id ?? null,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadMaterialOptions(organisationId: string): Promise<InvoiceMaterialOption[]> {
  const { data: materialsData, error: materialsError } = await supabase.from('materials').select('id, name, display_name, hsn_code, make, unit, sale_price, material, size, item_classification, material_units(unit_name, conversion_factor)').eq('organisation_id', organisationId);
  if (materialsError) throw materialsError;

  const { data: variantPricingData, error: pricingError } = await supabase
    .from('item_variant_pricing')
    .select('item_id, company_variant_id, make, sale_price')
    .in('item_id', (materialsData ?? []).map(m => m.id));

  if (pricingError) {
    console.warn('Failed to fetch variant pricing:', pricingError);
  }

  const variantIds = Array.from(
    new Set((variantPricingData ?? []).map((row: any) => row.company_variant_id).filter(Boolean))
  );

  const variantNameMap: Record<string, string> = {};
  if (variantIds.length > 0) {
    const { data: variantRows } = await supabase
      .from('company_variants')
      .select('id, variant_name')
      .in('id', variantIds);
    (variantRows ?? []).forEach((row: any) => {
      variantNameMap[row.id] = row.variant_name || '';
    });
  }

  const pricingMap: Record<string, { variant_id: string | null; make: string; sale_price: number; variant_name: string | null }[]> = {};
  (variantPricingData ?? []).forEach((row: any) => {
    if (!pricingMap[row.item_id]) {
      pricingMap[row.item_id] = [];
    }
    pricingMap[row.item_id].push({
      variant_id: row.company_variant_id || null,
      make: row.make || '',
      sale_price: row.sale_price || 0,
      variant_name: row.company_variant_id ? (variantNameMap[row.company_variant_id] || null) : null,
    });
  });

  return (materialsData ?? [])
    .map((material: any) => {
      const materialVariants = pricingMap[material.id] || [];
      if (materialVariants.length === 0) {
        return {
          id: String(material.id),
          name: String(material.display_name ?? material.name ?? 'Unnamed material'),
          display_name: material.display_name,
          hsn_code: material.hsn_code ?? null,
          make: material.make || material.material || null,
          unit: material.unit || 'nos',
          sale_price: material.sale_price || null,
          item_classification: material.item_classification || null,
          variants: [],
          material_units: material.material_units || [],
        };
      }

      const firstVariant = materialVariants[0];
      return {
        id: String(material.id),
        name: String(material.display_name ?? material.name ?? 'Unnamed material'),
        display_name: material.display_name,
        hsn_code: material.hsn_code ?? null,
        make: firstVariant.make || null,
        unit: material.unit || 'nos',
        sale_price: firstVariant.sale_price || null,
        item_classification: material.item_classification || null,
        variants: materialVariants,
        material_units: material.material_units || [],
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadClientShippingAddresses(clientId: string, organisationId: string): Promise<ClientShippingAddress[]> {
  const { data, error } = await supabase
    .from('client_shipping_addresses')
    .select('*')
    .eq('client_id', clientId)
    .eq('organisation_id', organisationId)
    .order('is_default', { ascending: false });
  
  if (error) throw error;

  return (data ?? []).map((addr: any) => ({
    id: String(addr.id),
    address_line1: addr.address_line1,
    address_line2: addr.address_line2,
    city: addr.city,
    state: addr.state,
    pincode: addr.pincode,
    contact_person: addr.contact_person,
    contact_phone: addr.contact_phone,
    is_default: addr.is_default,
  }));
}

async function loadClientDetails(clientId: string, organisationId: string) {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name, gst_number, state, city, address1, address2, pincode, contact, email')
    .eq('id', clientId)
    .eq('organisation_id', organisationId)
    .single();
  
  if (error) throw error;
  return data;
}

async function loadSourceOptions(sourceType: InvoiceEditorFormValues['source_type'], organisationId: string, clientId?: string): Promise<InvoiceSourceOption[]> {
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

  if (clientId) {
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

  return [];
}

/**
 * InvoiceEditorPageV2 — Modernized Invoice Creator & Editor V2
 * 
 * Implements the unified CreateQuotationV2 layout system (DocumentActionBar,
 * 3-column HeaderFormGrid, QuotationItemsTable visual design, SummaryFooter) while
 * preserving 100% of underlying fields, calculations, queries, and state.
 */
export default function InvoiceEditorPageV2() {
  const { user, organisation } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const invoiceId = queryParam(location.search, 'id');
  const isEditMode = Boolean(invoiceId);
  const convertFrom = queryParam(location.search, 'convertFrom') as ConversionType | null;
  const sourceId = queryParam(location.search, 'sourceId');
  const isConverting = Boolean(convertFrom && sourceId && !isEditMode);
  const duplicateFrom = queryParam(location.search, 'from');
  const isDuplicating = Boolean(duplicateFrom && !isEditMode);
  const [pdfAction, setPdfAction] = useState<'preview' | 'download' | 'print' | 'email' | null>(null);
  const [isShippingAddressModalOpen, setIsShippingAddressModalOpen] = useState(false);
  const [isPOSelectorOpen, setIsPOSelectorOpen] = useState(false);
  const [selectedPOLineItems, setSelectedPOLineItems] = useState<any[]>([]);
  const [isApplyingPOItems, setIsApplyingPOItems] = useState(false);
  const [isQuotationSelectorOpen, setIsQuotationSelectorOpen] = useState(false);
  const [selectedQuotationItems, setSelectedQuotationItems] = useState<any[]>([]);
  const [isApplyingQuotationItems, setIsApplyingQuotationItems] = useState(false);
  const [isProformaSelectorOpen, setIsProformaSelectorOpen] = useState(false);
  const [selectedProformaItems, setSelectedProformaItems] = useState<any[]>([]);
  const [isApplyingProformaItems, setIsApplyingProformaItems] = useState(false);
  const [warehousePanelOpen, setWarehousePanelOpen] = useState(false);

  const [useArcPricing, setUseArcPricing] = useState(false);
  const [arcPricingMap, setArcPricingMap] = useState<Record<string, any>>({});
  const [arcPricingConfirmOpen, setArcPricingConfirmOpen] = useState(false);
  const [pendingArcEnabled, setPendingArcEnabled] = useState(false);

  // ── Revision Management ──
  const [invoiceRevisionNo, setInvoiceRevisionNo] = useState(1);
  const [invoiceRevisionHistory, setInvoiceRevisionHistory] = useState<any[]>([]);
  const [invoiceRevisionReason, setInvoiceRevisionReason] = useState('');
  const [invoiceRevisionDialogOpen, setInvoiceRevisionDialogOpen] = useState(false);
  const [invoiceReasonDialogOpen, setInvoiceReasonDialogOpen] = useState(false);
  const [pendingInvoiceSave, setPendingInvoiceSave] = useState<boolean>(false);

  const conversionQuery = useConvertDocument(
    convertFrom || 'quotation-to-invoice',
    sourceId || ''
  );
  
  const { isConverted: isAlreadyConverted } = useConversionStatus(
    convertFrom || 'quotation-to-invoice',
    sourceId || ''
  );

  const conversionRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);
  useEffect(() => {
    if (isConverting && conversionQuery.data) {
      conversionRef.current = { type: convertFrom!, sourceId: sourceId! };
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId]);

  const existingInvoiceQuery = useInvoice(invoiceId ?? undefined);
  const duplicateInvoiceQuery = useInvoice(duplicateFrom ?? undefined);
  const templatesQuery = useInvoiceTemplates();
  const warehousesQuery = useWarehouses();
  const variantsQuery = useVariants();
  const createInvoiceMutation = useCreateInvoice();
  const updateInvoiceMutation = useUpdateInvoice();

  const form = useForm<InvoiceEditorFormValues>({
    resolver: zodResolver(InvoiceEditorSchema),
    defaultValues: createEmptyInvoiceFormValues(),
  });

  const {
    control,
    handleSubmit,
    setValue,
    reset,
    formState: { errors },
  } = form;

  const selectedSourceType = useWatch({ control, name: 'source_type' });
  const selectedSourceId = useWatch({ control, name: 'source_id' });
  const selectedClientId = useWatch({ control, name: 'client_id' });
  const selectedTemplateId = useWatch({ control, name: 'invoice_template_id' });
  const selectedCompanyState = useWatch({ control, name: 'company_state' });
  const selectedClientState = useWatch({ control, name: 'client_state' });
  const formValues = useWatch({ control });

  const itemsFieldArray = useFieldArray({ control, name: 'items' });
  const materialsFieldArray = useFieldArray({ control, name: 'materials' });

  const clientsQuery = useQuery({
    queryKey: ['invoice-clients', organisation?.id],
    queryFn: () => loadClientOptions(organisation!.id),
    enabled: Boolean(organisation?.id),
  });

  const materialsQuery = useQuery({
    queryKey: ['invoice-materials', organisation?.id],
    queryFn: () => loadMaterialOptions(organisation!.id),
    enabled: Boolean(organisation?.id),
  });

  const shippingAddressesQuery = useQuery({
    queryKey: ['invoice-client-shipping-addresses', selectedClientId, organisation?.id],
    queryFn: () => loadClientShippingAddresses(selectedClientId, organisation!.id),
    enabled: Boolean(selectedClientId && organisation?.id),
  });

  const sourcesQuery = useQuery({
    queryKey: ['invoice-sources', selectedSourceType, organisation?.id, selectedClientId],
    queryFn: () => loadSourceOptions(selectedSourceType, organisation!.id, selectedClientId),
    enabled: Boolean(organisation?.id && selectedSourceType !== 'direct'),
  });

  const poDetailsQuery = useQuery({
    queryKey: ['client-po-details', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'po') return null;
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('*')
        .eq('id', selectedSourceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'po'),
  });

  const quotationDetailsQuery = useQuery({
    queryKey: ['quotation-details-for-invoice', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'quotation') return null;
      const { data, error } = await supabase
        .from('quotation_header')
        .select('*, items:quotation_items(*)')
        .eq('id', selectedSourceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'quotation'),
  });

  const proformaDetailsQuery = useQuery({
    queryKey: ['proforma-details-for-invoice', selectedSourceId],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'proforma') return null;
      const { data, error } = await supabase
        .from('proforma_invoices')
        .select('*, items:proforma_invoice_items(*)')
        .eq('id', selectedSourceId)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'proforma'),
  });

  const handlePOSelection = () => {
    if (selectedSourceType === 'po' && selectedSourceId && poDetailsQuery.data) {
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
      setSelectedPOLineItems(selectedItems);
      setIsPOSelectorOpen(false);
      setTimeout(() => setIsApplyingPOItems(false), 100);
    }, 50);
  };

  useEffect(() => {
    if (isEditMode && existingInvoiceQuery.data) {
      const invoiceData = existingInvoiceQuery.data;
      const values = invoiceToFormValues(invoiceData);
      reset(values);
      setInvoiceRevisionNo((invoiceData as any).revision_no ?? 1);
      setInvoiceRevisionHistory((invoiceData as any).revision_history ?? []);
    } else if (isDuplicating && duplicateInvoiceQuery.data) {
      const values = invoiceToFormValues(duplicateInvoiceQuery.data);
      values.invoice_number = '';
      reset(values);
    }
  }, [isEditMode, existingInvoiceQuery.data, isDuplicating, duplicateInvoiceQuery.data, reset]);

  const selectedTemplate = useMemo(() => {
    const list = templatesQuery.data ?? [];
    return list.find((item) => item.id === selectedTemplateId) ?? list[0] ?? null;
  }, [templatesQuery.data, selectedTemplateId]);

  const templateType = useMemo(() => getTemplateTypeFromTemplate(selectedTemplate), [selectedTemplate]);

  const totals = useMemo(() => {
    return calculateDraftTotals(formValues as InvoiceEditorFormValues, templateType);
  }, [formValues, templateType]);

  const onSubmit = async (values: InvoiceEditorFormValues) => {
    if (!organisation?.id) return;
    try {
      const payload = composeInvoiceInput(values, organisation.id, user?.id);
      if (isEditMode && invoiceId) {
        await updateInvoiceMutation.mutateAsync({ id: invoiceId, data: payload });
        toast.success('Invoice updated successfully');
      } else {
        await createInvoiceMutation.mutateAsync(payload);
        toast.success('Invoice created successfully');
      }
      navigate('/invoices');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save invoice');
    }
  };

  const isSubmitting = createInvoiceMutation.isPending || updateInvoiceMutation.isPending;

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh' }}>
      {/* ── Document Action Bar ───────────────────────────────── */}
      <DocumentActionBar
        title={isEditMode ? `Edit Invoice` : 'New Invoice'}
        statusBadge={
          isEditMode && existingInvoiceQuery.data ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <InvoiceStatusBadge status={(existingInvoiceQuery.data as any).status} />
              {invoiceRevisionNo > 1 && <RevisionBadge revisionNo={invoiceRevisionNo} />}
            </div>
          ) : undefined
        }
        fixed={{ top: 32, left: 220 }}
        leftActions={
          <>
            {invoiceId && <DocumentConversionChain documentType="invoice" documentId={invoiceId} />}
          </>
        }
        rightActions={
          <>
            <Button variant="outline" size="sm" type="button" onClick={() => navigate('/invoices')} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button size="sm" type="button" onClick={() => form.handleSubmit(onSubmit)()} disabled={isSubmitting}>
              {isSubmitting ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
              {isEditMode ? 'Update Invoice' : 'Save Invoice'}
            </Button>
          </>
        }
      />

      <div style={{ paddingTop: '84px', paddingLeft: '16px', paddingRight: '16px', paddingBottom: '32px', maxWidth: '1400px', margin: '0 auto' }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          {/* ── 3-Column Header Grid Layout ────────────────────────── */}
          <HeaderFormGrid columns={3}>
            {/* Card 1: Client & Party Info */}
            <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client Details">
              <HeaderField label="Client" required labelWidth="100px" error={fieldErrorMessage(errors.client_id)}>
                <select
                  className="form-select"
                  style={sharedStyles.inputStyle}
                  {...form.register('client_id')}
                >
                  <option value="">Select client</option>
                  {(clientsQuery.data ?? []).map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </HeaderField>

              <HeaderField label="GSTIN" labelWidth="100px">
                <input
                  type="text"
                  className="form-input"
                  style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }}
                  value={selectedClientState || 'N/A'}
                  readOnly
                  placeholder="Client GSTIN"
                />
              </HeaderField>
            </HeaderCard>

            {/* Card 2: Document Metadata */}
            <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Invoice Details">
              <HeaderField label="Invoice No" required labelWidth="100px" error={fieldErrorMessage(errors.invoice_number)}>
                <input
                  type="text"
                  className="form-input"
                  style={sharedStyles.inputStyle}
                  {...form.register('invoice_number')}
                  placeholder="INV-0001"
                />
              </HeaderField>

              <HeaderField label="Invoice Date" required labelWidth="100px">
                <CustomDatePicker
                  value={formValues.issue_date || new Date().toISOString().split('T')[0]}
                  onChange={(date) => setValue('issue_date', date)}
                  inputStyle={sharedStyles.inputStyle}
                />
              </HeaderField>

              <HeaderField label="Due Date" labelWidth="100px">
                <CustomDatePicker
                  value={formValues.due_date || ''}
                  onChange={(date) => setValue('due_date', date)}
                  inputStyle={sharedStyles.inputStyle}
                />
              </HeaderField>

              <HeaderField label="Payment Terms" labelWidth="100px">
                <select
                  className="form-select"
                  style={sharedStyles.inputStyle}
                  {...form.register('payment_terms')}
                >
                  <option value="Net 30 Days">Net 30 Days</option>
                  <option value="Net 15 Days">Net 15 Days</option>
                  <option value="Due on Receipt">Due on Receipt</option>
                  <option value="50% Advance">50% Advance</option>
                </select>
              </HeaderField>
            </HeaderCard>

            {/* Card 3: Source & Commercial Terms */}
            <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Reference & Terms">
              <HeaderField label="Source Type" labelWidth="100px">
                <select
                  className="form-select"
                  style={sharedStyles.inputStyle}
                  {...form.register('source_type')}
                >
                  <option value="direct">Direct Invoice</option>
                  <option value="quotation">From Quotation</option>
                  <option value="challan">From Delivery Challan</option>
                  <option value="po">From Client PO</option>
                </select>
              </HeaderField>

              {selectedSourceType !== 'direct' && (
                <HeaderField label="Select Source" labelWidth="100px">
                  <select
                    className="form-select"
                    style={sharedStyles.inputStyle}
                    {...form.register('source_id')}
                    onChange={(e) => {
                      setValue('source_id', e.target.value);
                      if (selectedSourceType === 'po') handlePOSelection();
                    }}
                  >
                    <option value="">Select source document</option>
                    {(sourcesQuery.data ?? []).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </HeaderField>
              )}

              <HeaderField label="Remarks" labelWidth="100px">
                <textarea
                  className="form-input"
                  style={{ ...sharedStyles.inputStyle, minHeight: '36px', resize: 'vertical' }}
                  {...form.register('notes')}
                  placeholder="Terms & notes..."
                />
              </HeaderField>
            </HeaderCard>
          </HeaderFormGrid>

          {/* ── Line Items Editor ───────────────────────────────── */}
          <div style={{ marginTop: '24px', background: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0', padding: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#0f172a', margin: 0 }}>Invoice Items</h3>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => itemsFieldArray.append(createEmptyItem())}
              >
                <Plus size={14} className="mr-1" /> Add Line Item
              </Button>
            </div>

            <InvoiceItemsEditor
              form={form}
              materials={materialsQuery.data ?? []}
            />
          </div>

          {/* ── Summary Footer ─────────────────────────────────── */}
          <InvoiceSummaryFooter
            totals={totals}
            form={form}
          />
        </form>
      </div>

      {/* ── Modals & Selectors ── */}
      {isPOSelectorOpen && (
        <POLineItemsSelector
          poId={selectedSourceId}
          isOpen={isPOSelectorOpen}
          onClose={() => setIsPOSelectorOpen(false)}
          onApply={handlePOLineItemsApply}
        />
      )}
    </div>
  );
}
