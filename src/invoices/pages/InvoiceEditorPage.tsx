import { useEffect, useMemo, useRef, useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { Download, Eye, Loader2, Mail, Plus, Printer, Save, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/supabase';
import { mapInvoiceSourceToDraft, generateInvoiceNumber, loadClientPOs, incrementInvoiceNumber } from '../api';
import { InvoiceItemsEditor } from '../components/InvoiceItemsEditor';
import { InvoiceMaterialsEditor } from '../components/InvoiceMaterialsEditor';
import { InvoiceSummaryFooter } from '../components/InvoiceSummaryFooter';
import { InvoiceStatusBadge } from '../components/InvoiceStatusBadge';
import { AddShippingAddressModal } from '../components/AddShippingAddressModal';
import POLineItemsSelector from '../components/POLineItemsSelector';
import QuotationLineItemsSelector from '../components/QuotationLineItemsSelector';
import ProformaLineItemsSelector from '../components/ProformaLineItemsSelector';
import { useCreateInvoice, useInvoice, useInvoiceTemplates, useUpdateInvoice } from '../hooks';
import { downloadInvoicePDF, emailInvoicePDF, previewInvoicePDF, printInvoicePDF } from '../pdf';
import type { InvoiceEditorFormValues, InvoiceClientOption, InvoiceMaterialOption, ClientShippingAddress } from './ui-utils';
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
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

async function loadMaterialOptions(organisationId: string): Promise<InvoiceMaterialOption[]> {
  const { data: materialsData, error: materialsError } = await supabase.from('materials').select('id, name, display_name, hsn_code, make, unit, sale_price, material, size').eq('organisation_id', organisationId);
  if (materialsError) throw materialsError;

  // Fetch variant pricing data (CreateQuotation-style: use variant id from pricing rows)
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

  // Build pricing map: material_id -> array of { variant_id, make, sale_price, variant_name }
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

  console.log('Materials data:', materialsData);
  console.log('Variant pricing map:', pricingMap);

  return (materialsData ?? [])
    .map((material: any) => {
      const materialVariants = pricingMap[material.id] || [];
      // If no variants, use material's own data
      if (materialVariants.length === 0) {
        return {
          id: String(material.id),
          name: String(material.display_name ?? material.name ?? 'Unnamed material'),
          display_name: material.display_name,
          hsn_code: material.hsn_code ?? null,
          make: material.make || material.material || null,
          unit: material.unit || 'nos',
          sale_price: material.sale_price || null,
          variants: [],
        };
      }

      // Use first variant as default
      const firstVariant = materialVariants[0];
      return {
        id: String(material.id),
        name: String(material.display_name ?? material.name ?? 'Unnamed material'),
        display_name: material.display_name,
        hsn_code: material.hsn_code ?? null,
        make: firstVariant.make || null,
        unit: material.unit || 'nos',
        sale_price: firstVariant.sale_price || null,
        variants: materialVariants,
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

  // For POs, use the same working pattern as ProformaEditorPage
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

  // If no client selected, return empty array
  return [];
}

export default function InvoiceEditorPage() {
  const { organisation } = useAuth();
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

  // PO line items selector handlers
  const handlePOSelection = () => {
    if (selectedSourceType === 'po' && selectedSourceId && poDetailsQuery.data) {
      setIsPOSelectorOpen(true);
    }
  };

  const handlePOLineItemsApply = (selectedItems: any[]) => {
    setIsApplyingPOItems(true);

    // Convert selected PO line items to invoice items
    const invoiceItems = selectedItems.map(item => {
      const poRate = item.rate_per_unit;
      return {
        id: undefined,
        item_id: null,
        description: item.description,
        hsn_code: item.hsn_sac_code || null,
        qty: item.quantity,
        rate: poRate, // Final rate (no discount applied for PO items)
        discount_percent: 0, // No discount for PO items
        amount: item.full_amount,
        tax_percent: item.gst_percentage,
        meta_json: {
          tax_percent: item.gst_percentage,
          uom: item.unit || 'Nos',
          item_code: item.item_code || null,
          po_line_item_id: item.id,
          original_quantity: item.original_quantity,
          base_rate: poRate, // PO rate goes to base_rate field
          rate_after_discount: poRate, // No discount, so rate_after_discount = base_rate
        },
      };
    });

    // Clear existing items first, then add new ones
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
      
      // Clear any focus and prevent cursor from landing in rate field
      setTimeout(() => {
        setIsApplyingPOItems(false);
        // Clear all active elements
        if (document.activeElement instanceof HTMLElement) {
          document.activeElement.blur();
        }
        // Remove focus from any input fields
        const allInputs = document.querySelectorAll('input');
        allInputs.forEach(input => {
          if (input instanceof HTMLElement) {
            input.blur();
          }
        });
        // Focus on body to completely remove focus
        document.body.focus();
      }, 100);
    }, 50);
  };

  const handlePOSelectorClose = () => {
    setIsPOSelectorOpen(false);
  };

  // Quotation line items selector handlers
  const handleQuotationSelection = () => {
    if (selectedSourceType === 'quotation' && selectedSourceId && quotationDetailsQuery.data) {
      setIsQuotationSelectorOpen(true);
    }
  };

  const handleQuotationItemsApply = (selectedItems: any[]) => {
    setIsApplyingQuotationItems(true);

    // Convert selected quotation items to invoice items
    const invoiceItems = selectedItems.map(item => {
      const qtRate = item.rate;
      return {
        id: undefined,
        item_id: item.item_id || null,
        description: item.description,
        hsn_code: item.hsn_code || null,
        qty: item.qty,
        rate: qtRate, // Final rate (no discount initially)
        discount_percent: item.discount_percent || 0, // Keep original discount
        amount: item.line_total || (item.qty * qtRate),
        tax_percent: item.tax_percent || 18,
        meta_json: {
          tax_percent: item.tax_percent || 18,
          uom: item.uom || 'Nos',
          base_rate: qtRate,
          rate_after_discount: qtRate - (qtRate * (item.discount_percent || 0) / 100),
          quotation_item_id: item.id,
          original_qty: item.qty,
        },
      };
    });

    // Clear existing items first, then add new ones
    itemsFieldArray.remove();
    setTimeout(() => {
      invoiceItems.forEach((item, index) => {
        if (index === 0) {
          itemsFieldArray.replace([item]);
        } else {
          itemsFieldArray.append(item);
        }
      });

      setSelectedQuotationItems(selectedItems);
      setIsQuotationSelectorOpen(false);

      // Clear any focus and prevent cursor from landing in rate field
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

  const handleQuotationSelectorClose = () => {
    setIsQuotationSelectorOpen(false);
  };

  // Proforma line items selector handlers
  const handleProformaSelection = () => {
    if (selectedSourceType === 'proforma' && selectedSourceId && proformaDetailsQuery.data) {
      setIsProformaSelectorOpen(true);
    }
  };

  const handleProformaItemsApply = (selectedItems: any[]) => {
    setIsApplyingProformaItems(true);

    // Convert selected proforma items to invoice items
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
        },
      };
    });

    // Clear existing items first, then add new ones
    itemsFieldArray.remove();
    setTimeout(() => {
      invoiceItems.forEach((item, index) => {
        if (index === 0) {
          itemsFieldArray.replace([item]);
        } else {
          itemsFieldArray.append(item);
        }
      });

      setSelectedProformaItems(selectedItems);
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

  const handleProformaSelectorClose = () => {
    setIsProformaSelectorOpen(false);
  };

  const form = useForm<InvoiceEditorFormValues>({
    resolver: zodResolver(InvoiceEditorSchema),
    defaultValues: createEmptyInvoiceFormValues((organisation?.state as string | null | undefined) || null),
    mode: 'onSubmit',
  });

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
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
  const companyState = useWatch({ control, name: 'company_state' }) ?? DEFAULT_COMPANY_STATE;
  const clientState = useWatch({ control, name: 'client_state' }) ?? null;
  const selectedShippingAddressId = useWatch({ control, name: 'shipping_address_id' }) ?? null;

  const { errors } = formState;

  const invoiceQuery = useInvoice(invoiceId ?? undefined);
  const duplicateInvoiceQuery = useInvoice(duplicateFrom ?? undefined);
  const createInvoice = useCreateInvoice();
  const updateInvoice = useUpdateInvoice(invoiceId ?? '');
  const templatesQuery = useInvoiceTemplates();
  const clientsQuery = useQuery({
    queryKey: ['invoice-ui', 'clients', organisation?.id],
    queryFn: () => loadClientOptions(organisation?.id!),
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });
  const materialsQuery = useQuery({
    queryKey: ['invoice-ui', 'materials', organisation?.id],
    queryFn: () => loadMaterialOptions(organisation?.id!),
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });

  const warehousesQuery = useWarehouses();
  const { data: variantRows = [] } = useVariants();

  const itemVariantIdsMapQuery = useQuery({
    queryKey: ['invoice-ui', 'item-variant-ids', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return {};

      // First get org-scoped material IDs to filter pricing rows
      const { data: orgMaterials } = await supabase
        .from('materials')
        .select('id')
        .eq('organisation_id', organisation.id);
      const orgMaterialIds = new Set((orgMaterials ?? []).map((m: any) => m.id));

      const { data, error } = await supabase
        .from('item_variant_pricing')
        .select('item_id, company_variant_id, make');

      if (error) throw error;

      const map: Record<string, string[]> = {};
      const makesMap: Record<string, string[]> = {};
      (data ?? []).forEach((row: any) => {
        if (!row?.item_id) return;
        // Only include pricing for materials belonging to this organisation
        if (!orgMaterialIds.has(row.item_id)) return;

        if (row.company_variant_id) {
          if (!map[row.item_id]) map[row.item_id] = [];
          if (!map[row.item_id].includes(row.company_variant_id)) {
            map[row.item_id].push(row.company_variant_id);
          }
        }

        const make = (row.make || '').trim();
        if (make) {
          if (!makesMap[row.item_id]) makesMap[row.item_id] = [];
          if (!makesMap[row.item_id].includes(make)) {
            makesMap[row.item_id].push(make);
          }
        }
      });
      return { variantIdsMap: map, makesMap };
    },
    enabled: !!organisation?.id,
    staleTime: 5 * 60 * 1000,
  });

  const stockQuery = useQuery({
    queryKey: ['item-stock', organisation?.id],
    queryFn: async () => {
      if (!organisation?.id) return [];
      const { data, error } = await supabase
        .from('item_stock')
        .select('item_id, warehouse_id, company_variant_id, current_stock')
        .eq('organisation_id', organisation.id);
      if (error) throw error;
      return data || [];
    },
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
  });

  const shippingAddressesQuery = useQuery({
    queryKey: ['invoice-ui', 'shipping-addresses', selectedClientId, organisation?.id],
    queryFn: () => loadClientShippingAddresses(selectedClientId, organisation?.id!),
    enabled: Boolean(selectedClientId && organisation?.id),
    staleTime: 5 * 60 * 1000,
  });

  const clientDetailsQuery = useQuery({
    queryKey: ['invoice-ui', 'client-details', selectedClientId, organisation?.id],
    queryFn: () => loadClientDetails(selectedClientId, organisation?.id!),
    enabled: Boolean(selectedClientId && organisation?.id),
    staleTime: 5 * 60 * 1000,
  });

  const selectedShippingAddress = useMemo(() => {
    // If "Same as billing" is selected, create address from client details
    if (selectedShippingAddressId === '' && clientDetailsQuery.data) {
      const client = clientDetailsQuery.data;
      return {
        id: 'same-as-billing',
        address_line1: client.address1 || '',
        address_line2: client.address2 || '',
        city: client.city || '',
        state: client.state || '',
        pincode: client.pincode || '',
        contact_person: client.contact || '',
        contact_phone: client.email || '',
        is_default: false,
      };
    }
    
    // Otherwise, return selected shipping address
    if (!selectedShippingAddressId || !shippingAddressesQuery.data) return null;
    return shippingAddressesQuery.data.find(addr => addr.id === selectedShippingAddressId) || null;
  }, [selectedShippingAddressId, shippingAddressesQuery.data, clientDetailsQuery.data]);

  const sourceOptionsQuery = useQuery({
    queryKey: ['invoice-ui', 'sources', selectedSourceType, selectedClientId, organisation?.id],
    queryFn: () => loadSourceOptions(selectedSourceType, organisation?.id!, selectedClientId),
    enabled: !!organisation?.id,
    staleTime: 2 * 60 * 1000,
  });
  const sourceDraftQuery = useQuery({
    queryKey: ['invoice-ui', 'source-draft', selectedSourceType, selectedSourceId, selectedMode, companyState, organisation?.id],
    queryFn: () =>
      mapInvoiceSourceToDraft(selectedSourceType, selectedSourceId, organisation?.id!, {
        companyState: companyState || DEFAULT_COMPANY_STATE,
        mode: selectedMode,
      }),
    enabled: Boolean(selectedSourceType && selectedSourceId && organisation?.id),
    staleTime: 0,
  });

  // PO details query for line items selector
  const poDetailsQuery = useQuery({
    queryKey: ['po-details', selectedSourceId, organisation?.id],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'po') return null;

      // Load PO header
      const { data: header, error: headerError } = await supabase
        .from('client_purchase_orders')
        .select('id, po_number, po_total_value, po_utilized_value, po_available_value')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisation?.id)
        .single();

      if (headerError) throw headerError;

      // Load PO line items
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
    enabled: Boolean(selectedSourceId && selectedSourceType === 'po' && organisation?.id),
    staleTime: 0,
  });

  // Quotation details query for line items selector
  const quotationDetailsQuery = useQuery({
    queryKey: ['quotation-details', selectedSourceId, organisation?.id],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'quotation') return null;

      // Load quotation header
      const { data: header, error: headerError } = await supabase
        .from('quotation_header')
        .select('id, quotation_no, grand_total, status')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisation?.id)
        .single();

      if (headerError) throw headerError;

      // Load quotation items
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
    enabled: Boolean(selectedSourceId && selectedSourceType === 'quotation' && organisation?.id),
    staleTime: 2 * 60 * 1000, // Longer stale time for quotation data
  });

  // Proforma details query for line items selector
  const proformaDetailsQuery = useQuery({
    queryKey: ['proforma-details', selectedSourceId, organisation?.id],
    queryFn: async () => {
      if (!selectedSourceId || selectedSourceType !== 'proforma') return null;

      // Load proforma header
      const { data: header, error: headerError } = await supabase
        .from('proforma_invoices')
        .select('id, proforma_no, grand_total, billing_status')
        .eq('id', selectedSourceId)
        .eq('organisation_id', organisation?.id)
        .single();

      if (headerError) throw headerError;

      // Load proforma items
      const { data: items, error: itemsError } = await supabase
        .from('proforma_items')
        .select('*')
        .eq('proforma_id', selectedSourceId);

      if (itemsError) throw itemsError;

      return {
        header: {
          proforma_no: header.proforma_no,
          grand_total: Number(header.grand_total || 0),
          billing_status: header.billing_status
        },
        items: items || []
      };
    },
    enabled: Boolean(selectedSourceId && selectedSourceType === 'proforma' && organisation?.id),
    staleTime: 0,
  });

  const initialSourceKeyRef = useRef<string>('');
  const hydratedSourceKeyRef = useRef<string>('');
  const loadedInvoiceIdRef = useRef<string>('');
  const conversionInfoRef = useRef<{ type: ConversionType; sourceId: string } | null>(null);

  // Conversion query
  const conversionQuery = useConvertDocument(convertFrom!, sourceId!);

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

  const [enableRoundOff, setEnableRoundOff] = useState(false);

  const totals = useMemo(
    () =>
      calculateDraftTotals({
        items: watchedItems,
        company_state: companyState,
        client_state: clientState,
      }, enableRoundOff),
    [companyState, clientState, watchedItems, enableRoundOff],
  );

  // Validation for PO-based invoices
  const poValidation = useMemo(() => {
    if (selectedSourceType !== 'po' || !selectedSourceId) return { isValid: true, message: '' };
    
    const selectedPO = sourceOptionsQuery.data?.find(po => po.id === selectedSourceId);
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
  }, [selectedSourceType, selectedSourceId, sourceOptionsQuery.data, totals.total]);

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

  // Load conversion data when converting from another document
  useEffect(() => {
    if (!isConverting || !conversionQuery.data) return;

    // Store conversion info for status update on save
    conversionInfoRef.current = {
      type: convertFrom!,
      sourceId: sourceId!,
    };

    const convertedData = conversionQuery.data.data as any;

    // Pre-fill form with converted data
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
    setValue('company_state', convertedData.company_state || organisation?.state || null, {
      shouldDirty: false,
      shouldValidate: false,
    });
    setValue('client_state', convertedData.client_state || null, {
      shouldDirty: false,
      shouldValidate: false,
    });

    // Pre-fill items
    if (convertedData.items && convertedData.items.length > 0) {
      itemsFieldArray.replace(convertedData.items.map((item: any) => createEmptyItem(item)));
    }

    // Pre-fill materials if present
    if (convertedData.materials && convertedData.materials.length > 0) {
      materialsFieldArray.replace(convertedData.materials.map((material: any) => createEmptyMaterial(material)));
    }
  }, [isConverting, conversionQuery.data, convertFrom, sourceId, setValue, itemsFieldArray, materialsFieldArray, organisation?.state]);

  // Load duplication data when creating from existing invoice
  useEffect(() => {
    if (!isDuplicating || !duplicateInvoiceQuery.data) return;

    const sourceInvoice = duplicateInvoiceQuery.data;
    const duplicatedFormValues = invoiceToFormValues(sourceInvoice);

    // Clear invoice-specific fields for new invoice
    duplicatedFormValues.invoice_no = '';
    duplicatedFormValues.status = 'draft';

    // Pre-fill form with duplicated data using reset for proper form state
    reset({
      ...duplicatedFormValues,
      invoice_no: '',
      status: 'draft',
      invoice_date: new Date().toISOString().split('T')[0],
    });
  }, [isDuplicating, duplicateInvoiceQuery.data, reset]);

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

  // Extract all useWatch calls to component level to avoid hook rule violations
  const defaultWarehouseId = useWatch({ control, name: 'default_warehouse_id' });
  useEffect(() => {
    const defaultWh = defaultWarehouseId;
    if (!defaultWh) return;
    
    const items = useWatch({ control, name: 'items' });
    items.forEach((item, idx) => {
      if (item.meta_json?.material_id && !item.meta_json?.warehouse_id) {
        setValue(`items.${idx}.meta_json.warehouse_id`, defaultWh);
      }
    });
  }, [defaultWarehouseId]);

  console.log('InvoiceEditorPage - fields:', itemsFieldArray.fields.length, 'watchedItems:', watchedItems.length);

  const onSubmit = handleSubmit(async (values) => {
    let invoiceNo = values.invoice_no;
    let seriesId: string | null = null;

    // Clear any previous root errors
    form.clearErrors('root');

    // Check PO validation first
    if (!poValidation.isValid) {
      form.setError('root', {
        type: 'validation',
        message: poValidation.message,
      });
      return;
    }

    // Debug: Log form values before validation
    console.log('Form values before validation:', values);
    console.log('Items being validated:', values.items);

    // Validate all items have proper rates
    const invalidItems = values.items.filter((item, index) => {
      const rate = Number(item.rate);
      const qty = Number(item.qty);
      const isValid = !isNaN(rate) && rate >= 0 && !isNaN(qty) && qty > 0;
      console.log(`Item ${index}: rate=${rate}, qty=${qty}, valid=${isValid}`);
      return !isValid;
    });

    if (invalidItems.length > 0) {
      console.log('Invalid items found:', invalidItems);
      form.setError('root', {
        type: 'validation',
        message: 'Please ensure all items have valid quantity (greater than 0) and rate (not negative).',
      });
      return;
    }

    if (!isEditMode && !invoiceNo && organisation?.id) {
      const result = await generateInvoiceNumber(organisation.id);
      invoiceNo = result.invoiceNo;
      seriesId = result.seriesId;
    }

    const payload = composeInvoiceInput({
      ...values,
      invoice_no: invoiceNo || null,
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
        await updateInvoice.mutateAsync(payload);
      } else {
        const result = await createInvoice.mutateAsync(payload);
        newInvoiceId = result.id;
        if (seriesId && organisation?.id) {
          incrementInvoiceNumber(seriesId, organisation.id).then();
        }
      }

      // Update source document status if this was a conversion
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

      // Update quotation status if converted from quotation
      if (selectedSourceType === 'quotation' && selectedSourceId && newInvoiceId) {
        // Check if all items were billed or only some
        const allQuotationItems = quotationDetailsQuery.data?.items || [];
        const billedItems = values.items.filter(item => item.meta_json?.quotation_item_id);

        const newStatus = billedItems.length === allQuotationItems.length ? 'converted' : 'partially converted';

        await supabase
          .from('quotation_header')
          .update({
            conversion_status: newStatus,
            status: newStatus === 'converted' ? 'Converted' : 'Partially Converted'
          })
          .eq('id', selectedSourceId);

        // Also update the invoice to reference the quotation
        await supabase
          .from('invoices')
          .update({ quotation_id: selectedSourceId })
          .eq('id', newInvoiceId);
      }

      // Update proforma billing status if converted from proforma
      if (selectedSourceType === 'proforma' && selectedSourceId && newInvoiceId) {
        // Check if all items were billed or only some
        const allProformaItems = proformaDetailsQuery.data?.items || [];
        const billedItems = values.items.filter(item => item.meta_json?.proforma_item_id);

        const newStatus = billedItems.length === allProformaItems.length ? 'fully billed' : 'partially billed';

        await supabase
          .from('proforma_invoices')
          .update({
            billing_status: newStatus
          })
          .eq('id', selectedSourceId);

        // Also update the invoice to reference the proforma
        await supabase
          .from('invoices')
          .update({ proforma_id: selectedSourceId })
          .eq('id', newInvoiceId);
      }

      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save invoice:', error);
      alert('Failed to save invoice: ' + (error as Error).message);
    }
  }, (errors) => {
    // Custom error handling - don't get stuck in validation loop
    console.error('Form validation errors found:', Object.keys(errors));
    
    // Show user-friendly error message
    if (errors.items || errors.client_id || errors.root) {
      form.setError('root', {
        type: 'validation',
        message: 'Please fix validation errors before saving.',
      });
    }
  });

  const handlePreviewPdf = async () => {
    // ...
    if (!invoiceId) {
      alert('Please save the invoice first before previewing.');
      return;
    }

    setPdfAction('preview');
    try {
      await previewInvoicePDF(invoiceId);
    } catch (error) {
      console.error('Failed to preview PDF:', error);
      alert('Failed to preview PDF: ' + (error as Error).message);
    } finally {
      setPdfAction(null);
    }
  };

  const handleDownloadPdf = async () => {
    if (!invoiceId) {
      alert('Please save the invoice first before downloading.');
      return;
    }

    setPdfAction('download');
    try {
      await downloadInvoicePDF(invoiceId);
    } catch (error) {
      console.error('Failed to download PDF:', error);
      alert('Failed to download PDF: ' + (error as Error).message);
    } finally {
      setPdfAction(null);
    }
  };

  const handlePrintPdf = async () => {
    if (!invoiceId) {
      alert('Please save the invoice first before printing.');
      return;
    }

    setPdfAction('print');
    try {
      await printInvoicePDF(invoiceId);
    } catch (error) {
      console.error('Failed to print PDF:', error);
      alert('Failed to print PDF: ' + (error as Error).message);
    } finally {
      setPdfAction(null);
    }
  };

  const handleSaveAsDraft = handleSubmit(async (values) => {
    const payload = composeInvoiceInput({
      ...values,
      invoice_no: null, // Drafts don't have invoice numbers
      status: 'draft',
    }, totals);

    try {
      if (isEditMode && invoiceId) {
        await updateInvoice.mutateAsync(payload);
      } else {
        await createInvoice.mutateAsync(payload);
      }
      navigate('/invoices');
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('Failed to save draft: ' + (error as Error).message);
    }
  });

  const handleEmailPdf = async () => {
    if (!invoiceId) return;

    setPdfAction('email');
    try {
      await emailInvoicePDF(invoiceId);
    } finally {
      setPdfAction(null);
    }
  };

  if ((isEditMode && invoiceQuery.isLoading) || (isDuplicating && duplicateInvoiceQuery.isLoading)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', color: '#525252' }}>
          <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={20} />
          {isDuplicating ? 'Loading invoice for duplication...' : 'Loading invoice...'}
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
          {isEditMode ? 'Edit Invoice' : isDuplicating ? 'Create Invoice from Existing' : 'New Invoice'}
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
            Cancel
          </button>
        </div>
      </div>

      {/* Main Form */}
      <form id="invoice-form" onSubmit={onSubmit} style={{ marginBottom: '16px' }}>
        {/* Header - 5 Column Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '12px',
          marginBottom: '16px'
        }}>
          {/* Column 1-2: Client with Address Section */}
          <div style={{ gridColumn: 'span 2', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Client Dropdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                Client
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

            {/* Address Section - Compact 2-column grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '8px'
            }}>
              {/* Billing Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{
                  fontSize: '10px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.04em',
                  color: '#737373'
                }}>
                  Billing
                </label>
                <div style={{
                  padding: '8px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '6px',
                  fontSize: '11px',
                  color: '#525252',
                  background: '#f9fafb',
                  minHeight: '100px',
                  whiteSpace: 'pre-line'
                }}>
                  {clientDetailsQuery.data ? (
                    <>
                      {clientDetailsQuery.data.gst_number && (
                        <span style={{ display: 'block', fontSize: '10px', color: '#737373', marginBottom: '4px' }}>
                          GSTIN: {clientDetailsQuery.data.gst_number}
                        </span>
                      )}
                      {clientDetailsQuery.data.address1 && (
                        <span style={{ display: 'block' }}>
                          Address: {clientDetailsQuery.data.address1}
                          {clientDetailsQuery.data.address2 && `, ${clientDetailsQuery.data.address2}`}
                        </span>
                      )}
                      {clientDetailsQuery.data.city && clientDetailsQuery.data.state && clientDetailsQuery.data.pincode && (
                        <span style={{ display: 'block' }}>
                          {clientDetailsQuery.data.city}, {clientDetailsQuery.data.state} - {clientDetailsQuery.data.pincode}
                        </span>
                      )}
                    </>
                  ) : (
                    <span style={{ color: '#a3a3a3', fontSize: '10px' }}>Select client</span>
                  )}
                </div>
              </div>

              {/* Shipping Address */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <label style={{
                    fontSize: '10px',
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    color: '#737373'
                  }}>
                    Shipping
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsShippingAddressModalOpen(true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '2px 6px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '4px',
                      background: '#fff',
                      color: '#171717',
                      cursor: 'pointer',
                      fontSize: '10px',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f5f5f5';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#fff';
                    }}
                    title="Add new shipping address"
                  >
                    <Plus size={12} />
                  </button>
                </div>
                <select
                  {...register('shipping_address_id')}
                  style={{
                    width: '100%',
                    padding: '4px 8px',
                    border: '1px solid #d4d4d4',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: '#171717',
                    background: '#fff',
                    cursor: 'pointer'
                  }}
                >
                  <option value="">Same as billing</option>
                  {(shippingAddressesQuery.data ?? []).map((addr) => (
                    <option key={addr.id} value={addr.id}>
                      {addr.address_line1}, {addr.city} {addr.is_default && '(Default)'}
                    </option>
                  ))}
                </select>
                {selectedShippingAddress && (
                  <div style={{
                    padding: '6px',
                    border: '1px solid #e5e5e5',
                    borderRadius: '4px',
                    fontSize: '10px',
                    color: '#525252',
                    background: '#fafafa',
                    whiteSpace: 'pre-line'
                  }}>
                    {selectedShippingAddress.address_line1}
                    {selectedShippingAddress.address_line2 && `, ${selectedShippingAddress.address_line2}`}
                    <br />
                    {selectedShippingAddress.city}, {selectedShippingAddress.state} - {selectedShippingAddress.pincode}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 3: Invoice No + PO Number */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Invoice No */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                Invoice No
              </label>
              <input
                {...register('invoice_no')}
                placeholder="Auto-generated"
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
              {errors.invoice_no && (
                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                  {errors.invoice_no.message}
                </span>
              )}
            </div>

            {/* PO Number */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                PO Number
              </label>
              <input
                {...register('po_number')}
                placeholder="Enter PO number"
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

          {/* Column 4: Invoice Date + PO Date */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Invoice Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                Invoice Date
              </label>
              <input
                type="date"
                {...register('invoice_date')}
                style={{
                  width: '100%',
                  maxWidth: '140px',
                  padding: '6px 10px',
                  border: '1px solid #d4d4d4',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#171717',
                  background: '#fff'
                }}
              />
            </div>

            {/* PO Date */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                PO Date
              </label>
              <input
                type="date"
                {...register('po_date')}
                style={{
                  width: '100%',
                  maxWidth: '140px',
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

          {/* Column 5: Source Type + Source Document */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {/* Source Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <label style={{
                fontSize: '11px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
                color: '#737373'
              }}>
                Source
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
                <option value="direct">Direct</option>
                <option value="quotation">Quotation</option>
                <option value="challan">Delivery Challan</option>
                <option value="po">Client PO</option>
              </select>
            </div>

            {/* Source Document */}
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
              {selectedSourceType === 'direct' ? (
                <div style={{
                  width: '100%',
                  padding: '6px 10px',
                  border: '1px solid #e5e5e5',
                  borderRadius: '4px',
                  fontSize: '13px',
                  color: '#737373',
                  background: '#f5f5f5'
                }}>
                  Direct Invoice (No source)
                </div>
              ) : (
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
              )}
              {errors.source_id && (
                <span style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                  {errors.source_id.message}
                </span>
              )}

              {/* PO Line Items Selector Button */}
              {selectedSourceType === 'po' && selectedSourceId && poDetailsQuery.data && (
                <button
                  type="button"
                  onClick={handlePOSelection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    border: '1px solid #059669',
                    borderRadius: '4px',
                    backgroundColor: '#f0fdf4',
                    color: '#059669',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginTop: '8px'
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#525252' }}>📄</span>
                  Select PO Line Items
                </button>
              )}

              {/* Quotation Items Selector Button */}
              {selectedSourceType === 'quotation' && selectedSourceId && quotationDetailsQuery.data && (
                <button
                  type="button"
                  onClick={handleQuotationSelection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    border: '1px solid #059669',
                    borderRadius: '4px',
                    backgroundColor: '#f0fdf4',
                    color: '#059669',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginTop: '8px'
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#525252' }}>📄</span>
                  Select Quotation Items
                </button>
              )}

              {/* Proforma Items Selector Button */}
              {selectedSourceType === 'proforma' && selectedSourceId && proformaDetailsQuery.data && (
                <button
                  type="button"
                  onClick={handleProformaSelection}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '6px 12px',
                    border: '1px solid #059669',
                    borderRadius: '4px',
                    backgroundColor: '#f0fdf4',
                    color: '#059669',
                    fontSize: '12px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    marginTop: '8px'
                  }}
                >
                  <span style={{ fontSize: '14px', color: '#525252' }}>📄</span>
                  Select Proforma Items
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Template, Status, Mode, Company State - 4 Column Grid */}
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
              Client State
            </label>
            <input
              {...register('client_state')}
              placeholder={clientState || 'Select client to view state'}
              readOnly
              style={{
                width: '100%',
                padding: '6px 10px',
                border: '1px solid #d4d4d4',
                borderRadius: '4px',
                fontSize: '13px',
                color: '#525252',
                background: '#f5f5f5',
                cursor: 'not-allowed'
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

        {/* Stock & Warehouse Panel */}
        <div style={{ 
          border: '1px solid #e5e5e5', 
          borderRadius: '4px', 
          marginBottom: '16px',
          background: '#fafafa'
        }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '8px 12px',
            borderBottom: '1px solid #e5e5e5',
            cursor: 'pointer',
            userSelect: 'none'
          }} onClick={() => setWarehousePanelOpen(!warehousePanelOpen)}>
            <span style={{ 
              fontSize: '12px', 
              fontWeight: 600, 
              color: '#171717' 
            }}>
              Stock & Warehouse
            </span>
            <span style={{ 
              fontSize: '10px', 
              color: '#737373' 
            }}>
              {warehousePanelOpen ? '▼' : '▶'}
            </span>
          </div>
          
          {warehousePanelOpen && (
            <div style={{ padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: '#525252', 
                    marginBottom: '4px', 
                    display: 'block' 
                  }}>
                    Default Warehouse
                  </label>
                  <select
                    {...register('default_warehouse_id')}
                    style={{
                      width: '100%',
                      padding: '6px 8px',
                      border: '1px solid #d4d4d4',
                      borderRadius: '2px',
                      fontSize: '12px',
                      background: '#fff',
                      color: '#525252'
                    }}
                  >
                    <option value="">Select warehouse</option>
                    {warehousesQuery.data?.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        {wh.warehouse_name || wh.name}
                      </option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ 
                    fontSize: '11px', 
                    fontWeight: 600, 
                    color: '#525252', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '4px' 
                  }}>
                    <input
                      type="checkbox"
                      {...register('deduct_stock_on_finalize')}
                      style={{ width: '14px', height: '14px' }}
                    />
                    Deduct stock on finalize
                  </label>
                  
                  {useWatch({ control, name: 'deduct_stock_on_finalize' }) && (
                    <label style={{ 
                      fontSize: '11px', 
                      fontWeight: 600, 
                      color: '#525252', 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '4px',
                      marginLeft: '16px'
                    }}>
                      <input
                        type="checkbox"
                        {...register('allow_insufficient_stock')}
                        style={{ width: '14px', height: '14px' }}
                      />
                      Allow insufficient stock
                    </label>
                  )}
                </div>
              </div>
              
              {/* Stock Summary */}
              <div style={{ 
                fontSize: '11px', 
                color: '#525252', 
                padding: '8px', 
                background: '#f5f5f5', 
                borderRadius: '2px',
                border: '1px solid #e5e5e5'
              }}>
                {(() => {
                  const materialItems = watchedItems.filter(item => item.meta_json?.material_id && !item.meta_json?.is_service);
                  const serviceItems = watchedItems.filter(item => item.meta_json?.is_service);
                  const descriptionOnlyItems = watchedItems.filter(item => !item.meta_json?.material_id);
                  
                  return `${materialItems.length} material items · ${serviceItems.length} service items · ${descriptionOnlyItems.length} description-only`;
                })()}
              </div>
            </div>
          )}
        </div>

        {/* Invoice Items Editor - Compact Excel Style */}
        <InvoiceItemsEditor
          fields={itemsFieldArray.fields}
          items={watchedItems}
          register={register}
          append={itemsFieldArray.append}
          remove={itemsFieldArray.remove}
          move={itemsFieldArray.move}
          mode={selectedMode}
          showCustomColumn={showCustomColumn}
          extraColumnLabel={customColumnLabel}
          error={fieldErrorMessage(errors.items)}
          productOptions={materialsQuery.data ?? []}
          setValue={setValue}
          formState={formState}
          isApplyingPOItems={isApplyingPOItems}
          warehouses={warehousesQuery.data ?? []}
          stockRows={stockQuery.data ?? []}
          defaultWarehouseId={useWatch({ control, name: 'default_warehouse_id' })}
          variantOptions={variantRows.map((v: any) => ({ id: String(v.id), variant_name: String(v.variant_name || '') }))}
          itemVariantIdsMap={itemVariantIdsMapQuery.data?.variantIdsMap ?? {}}
          itemMakesMap={itemVariantIdsMapQuery.data?.makesMap ?? {}}
        />

        {/* Materials Editor - Compact Excel Style */}
        {selectedMode === 'lot' && (
          <div style={{ marginTop: '16px' }}>
            <InvoiceMaterialsEditor
              fields={materialsFieldArray.fields}
              register={register}
              append={materialsFieldArray.append}
              remove={materialsFieldArray.remove}
              warehouses={warehousesQuery.data ?? []}
              defaultWarehouseId={useWatch({ control, name: 'default_warehouse_id' })}
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
          roundOff={totals.roundOff}
          enableRoundOff={enableRoundOff}
          onToggleRoundOff={() => setEnableRoundOff(!enableRoundOff)}
        />
      </form>

      {/* Sticky Action Buttons */}
      <div style={{
        position: 'sticky',
        bottom: '0',
        left: '0',
        right: '0',
        background: '#fff',
        borderTop: '1px solid #e5e5e5',
        padding: '16px',
        marginTop: '16px',
        display: 'flex',
        gap: '12px',
        justifyContent: 'flex-end',
        zIndex: 100
      }}>
        <button
          type="button"
          onClick={handleSaveAsDraft}
          disabled={isSaving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: '1px solid #d4d4d4',
            borderRadius: '4px',
            background: '#fff',
            color: '#525252',
            fontSize: '13px',
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.6 : 1,
            transition: 'all 0.15s'
          }}
        >
          {isSaving ? <Loader2 style={{ animation: 'spin 1s linear infinite' }} size={14} /> : <Save size={14} />}
          Save as Draft
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={isSaving}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 20px',
            border: 'none',
            borderRadius: '4px',
            background: '#171717',
            color: '#fff',
            fontSize: '13px',
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

      {/* Add Shipping Address Modal */}
      {selectedClientId && (
        <AddShippingAddressModal
          isOpen={isShippingAddressModalOpen}
          onClose={() => setIsShippingAddressModalOpen(false)}
          clientId={selectedClientId}
          onSuccess={() => {
            shippingAddressesQuery.refetch();
          }}
        />
      )}

      {/* PO Line Items Selector Popup */}
      {isPOSelectorOpen && poDetailsQuery.data && (
        <POLineItemsSelector
          isOpen={isPOSelectorOpen}
          onClose={handlePOSelectorClose}
          poHeader={poDetailsQuery.data.header}
          lineItems={poDetailsQuery.data.lineItems}
          onApply={handlePOLineItemsApply}
        />
      )}

      {isQuotationSelectorOpen && quotationDetailsQuery.data && (
        <QuotationLineItemsSelector
          isOpen={isQuotationSelectorOpen}
          onClose={handleQuotationSelectorClose}
          quotationHeader={quotationDetailsQuery.data.header}
          items={quotationDetailsQuery.data.items}
          onApply={handleQuotationItemsApply}
        />
      )}

      {isProformaSelectorOpen && proformaDetailsQuery.data && (
        <ProformaLineItemsSelector
          isOpen={isProformaSelectorOpen}
          onClose={handleProformaSelectorClose}
          proformaHeader={proformaDetailsQuery.data.header}
          items={proformaDetailsQuery.data.items}
          onApply={handleProformaItemsApply}
        />
      )}
    </div>
  );
}
