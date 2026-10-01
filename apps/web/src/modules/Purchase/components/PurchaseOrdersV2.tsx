/**
 * PurchaseOrdersV2 — Create Purchase Order.
 *
 * Feature sources:
 *   - V1 (PurchaseOrders.tsx): the business feature set — header fields,
 *     material picker, vendor pricing, totals, validation, actions.
 *   - CreateQuotation: UI/UX — the shared document-editor shell, the action
 *     bar, and the row behaviours (drag reorder, move-to, section header rows,
 *     sub-total rows, row action menu).
 *
 * V1 defects are reproduced as features but FIXED in V2, never copied:
 *   1. GST was counted twice (an 18% line billed 36%) because cgst+sgst+igst were
 *      all populated from one rate. Here the server derives exactly one of
 *      CGST+SGST or IGST from place-of-supply.
 *   2. item.total_amount was set to the pre-tax value while the header total was
 *      post-tax, so lines never summed to the document total. Lines are post-tax.
 *   3. Payment Terms were captured then discarded. Written to terms_conditions.
 *   4. Make and Variant were captured then discarded. Persisted.
 *   5. Discount % was unbounded, so >100% produced negative totals. Clamped 0-100.
 *   6. A negative rate blocked the save with no visible message. Now rendered.
 *   7. editId was read but never loaded, so opening a PO rendered a blank form
 *      and saving it overwrote the stored draft. Now loads the PO and its items.
 *   8. No delivery-date >= PO-date rule. Enforced.
 *
 * NOT fixed here: permission gating. The RBAC catalog has no purchase_orders.*
 * keys (those strings exist only in DB RLS policies), so there is no client-side
 * key to check. Adding catalog keys is Phase 3 work; a UI-only gate would be
 * decorative and misleading.
 *
 * Writes go through one atomic RPC. No multi-step client writes.
 * V1 is untouched.
 */
import { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  Plus, Trash2, Save, Loader2, Send, Search, X, User, FileText, Truck,
  Percent, ArrowUpDown, MoreHorizontal, Heading, GripVertical, Package, Paperclip, Columns3,
  MapPin, ChevronDown, Copy, History,
} from 'lucide-react';

import { supabase } from '../../../supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { toast } from '@/lib/logger';
import { formatCurrency } from '../../../utils/formatters';
import { withSessionCheck } from '../../../queryClient';
import {
  DocumentActionBar,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
  SummaryFooter,
  DocumentEditorShell,
  DocumentLineItemsSurface,
} from '../../../components/document-editor';
import {
  calculateLineItem,
  calculatePurchaseOrderTotals,
  buildPurchaseOrderItemPayload,
  extractBillableLines,
  round2,
  type PurchaseOrderItem,
} from './poCalculations';
import {
  usePurchaseMaterials,
  useVendorPricing,
  effectiveRate,
  effectiveDiscount,
  defaultRateFor,
  filterMaterials,
  normalizeUnit,
  type PickerMaterial,
} from './poMaterials';
import { logPoActivity, listPoActivity, poAuditActionLabel, type PoAuditEntry } from './poAudit';
import {
  useDiscountCategories,
  useMaterialCategories,
  useVendorVariants,
  clampCategoryDiscount,
} from './poDiscount';
import {
  useVendorShippingAddresses,
  formatVendorAddressBlock,
  addressShortLabel,
} from './poVendor';
import { AddVendorShippingAddressModal } from './VendorShippingAddressModal';
import { MaterialHistoryDrawer } from './MaterialHistoryDrawer';
import { SaveStatusIndicator } from '../../../pages/CreateQuotation/components/SaveStatusIndicator';
import { InlineDescriptionCell } from '../../../components/InlineDescriptionCell';
import { UnitDropdownSelect } from '../../../components/UnitDropdownSelect';
import { TermsConditionsDrawer } from '../../../components/TermsConditionsDrawer';
import {
  PO_DEFAULT_COLUMN_SETTINGS,
  PO_TOGGLEABLE_COLUMNS,
  mergeColumnSettings,
  isColumnVisible,
  columnLabel,
  type PoColumnSettings,
  type PoColumnKey,
} from './poColumns';

const TAX_OPTIONS = [0, 5, 12, 18, 28];
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type Row = PurchaseOrderItem & { _key: string };

const blankRow = (): Row => ({
  _key: crypto.randomUUID(),
  description: '',
  hsn_code: '',
  qty: 1,
  uom: 'Nos',
  rate: 0,
  discount_percent: 0,
  tax_percent: 18,
});

export default function PurchaseOrdersV2() {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const orgId = organisation?.id;
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  /** Set when this editor was opened via Duplicate, so the save is logged as such. */
  const [duplicateSourcePo, setDuplicateSourcePo] = useState<string | null>(null);

  // ---- header state -------------------------------------------------------
  const [vendorId, setVendorId] = useState('');
  const [vendorState, setVendorState] = useState('');
  const [companyState, setCompanyState] = useState('');
  const [poDate, setPoDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [projectId, setProjectId] = useState('');
  const [referenceNo, setReferenceNo] = useState('');
  const [deliveryLocation, setDeliveryLocation] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const [termsConditions, setTermsConditions] = useState('');
  const [authorizedSignatoryId, setAuthorizedSignatoryId] = useState('');
  const [extraDiscountPercent, setExtraDiscountPercent] = useState('0');
  const [extraDiscountAmount, setExtraDiscountAmount] = useState('0');
  const [roundOffEnabled, setRoundOffEnabled] = useState(false);
  /**
   * Header-level discount percentage per discount category ("Pricing Rules",
   * CreateQuotation pattern). Every line whose material carries that category
   * inherits the value until its own discount cell is edited.
   */
  const [headerDiscounts, setHeaderDiscounts] = useState<Record<string, number>>({});
  const [columnSettings, setColumnSettings] = useState<PoColumnSettings>(PO_DEFAULT_COLUMN_SETTINGS);
  const [columnsOpen, setColumnsOpen] = useState(false);
  /** Fixed position of the Columns panel, captured from the button at open. */
  const [columnsPos, setColumnsPos] = useState<{ top: number; right: number } | null>(null);
  const columnsBtnRef = useRef<HTMLButtonElement | null>(null);

  // A scroll or resize moves the button out from under a fixed panel, so the
  // panel closes instead of floating detached.
  useEffect(() => {
    if (!columnsOpen) return;
    const close = () => setColumnsOpen(false);
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [columnsOpen]);
  /** Save-status pill in the action bar (CreateQuotation's SaveStatusIndicator). */
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('unsaved');
  /** Vendor search box; mirrors CreateQuotation's client search dropdown. */
  const [vendorSearch, setVendorSearch] = useState<string | null>(null);
  const [vendorDropdownOpen, setVendorDropdownOpen] = useState(false);
  const [vendorTouched, setVendorTouched] = useState(false);
  /** Delivery-address modal (the "shipping address module" for vendors). */
  const [shippingModalOpen, setShippingModalOpen] = useState(false);
  /** Header-level default variant/make; reprices every compatible line. */
  const [defaultVariantId, setDefaultVariantId] = useState('');
  const [defaultMake, setDefaultMake] = useState('');
  /** Terms library drawer. */
  const [termsDrawerOpen, setTermsDrawerOpen] = useState(false);
  /** Which row's in-cell item search is open (one at a time). */
  const [itemSearchRowKey, setItemSearchRowKey] = useState<string | null>(null);
  const [itemSearchQuery, setItemSearchQuery] = useState('');
  /** Fixed position of the item-search panel, captured from the input. */
  const [itemSearchPos, setItemSearchPos] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!itemSearchRowKey) return;
    const close = () => { setItemSearchRowKey(null); setItemSearchPos(null); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, [itemSearchRowKey]);

  const openItemSearch = (key: string, el: HTMLElement | null, query = '') => {
    setItemSearchRowKey(key);
    setItemSearchQuery(query);
    if (el) {
      const r = el.getBoundingClientRect();
      setItemSearchPos({ top: r.bottom + 2, left: r.left, width: Math.max(r.width, 240) });
    }
  };
  /** Authorized-signatory dropdown beside the Grand Total. */
  const [sigDropdownOpen, setSigDropdownOpen] = useState(false);
  /** Material whose purchase history drawer is open (null = closed). */
  const [historyMaterial, setHistoryMaterial] = useState<{ id: string; name: string } | null>(null);
  const [currency, setCurrency] = useState('INR');
  const [exchangeRate, setExchangeRate] = useState('1');

  const [rows, setRows] = useState<Row[]>([blankRow()]);
  const [poNumberPreview, setPoNumberPreview] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savedPoId, setSavedPoId] = useState<string | null>(editId);
  const [moveToKey, setMoveToKey] = useState<string | null>(null);
  const [moveToValue, setMoveToValue] = useState('');
  const [rowMenuKey, setRowMenuKey] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState('');
  const [staged, setStaged] = useState<Record<string, number>>({});
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { materials } = usePurchaseMaterials();

  const billableRows = useMemo(() => extractBillableLines(rows), [rows]);
  const lineMaterialIds = useMemo(
    () => [...new Set(billableRows.map(r => String(r.item_id || '')).filter(Boolean))],
    [billableRows],
  );
  const { pricingByMaterial } = useVendorPricing(orgId, vendorId, lineMaterialIds);

  // Discount categories + variant pricing, keyed off the same material set.
  const { categories, categoryById } = useDiscountCategories(orgId);
  const materialCategories = useMaterialCategories(orgId, lineMaterialIds);
  const { variants: variantOptions, makes: vendorMakes, pricingByVariant } = useVendorVariants(
    orgId, vendorId, lineMaterialIds,
  );
  const { addresses: vendorAddresses, tableMissing: vendorAddrTableMissing, setAddresses: setVendorAddresses } =
    useVendorShippingAddresses(orgId, vendorId);

  const visible = useCallback(
    (key: PoColumnKey) => isColumnVisible(columnSettings, key),
    [columnSettings],
  );

  const toggleColumn = (key: PoColumnKey) => {
    setColumnSettings(prev => ({
      ...prev,
      optional: { ...prev.optional, [key]: !(prev.optional?.[key] !== false) },
    }));
  };

  /**
   * The discount a line should carry: its material's category discount unless
   * the user has overridden that line's own cell. Mirrors
   * CreateQuotation/index.tsx:1269-1284.
   */
  const categoryDiscountFor = useCallback((row: Row): number => {
    const catId = row.discount_category_id
      || (row.item_id ? materialCategories[row.item_id]?.discountCategoryId : null)
      || null;
    if (!catId) return 0;
    return headerDiscounts[catId] ?? Number(categoryById[catId]?.default_discount_percent ?? 0);
  }, [headerDiscounts, categoryById, materialCategories]);

  // ---- master data --------------------------------------------------------
  const { data: vendors = [] } = useQuery({
    queryKey: ['po-v2-vendors', orgId],
    queryFn: withSessionCheck(async () => {
      if (!orgId) return [];
      // purchase_vendors uses `status`, not `is_active` (verified against live).
      // Contact/address/payment columns drive the Vendor card details, the same
      // way CreateQuotation renders client contact/address/GSTIN.
      const { data, error } = await supabase
        .from('purchase_vendors')
        .select('id, company_name, state, gstin, contact_person, phone, email, address, pincode, payment_terms')
        .eq('organisation_id', orgId)
        .eq('status', 'Active')
        .order('company_name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ['po-v2-projects', orgId],
    queryFn: withSessionCheck(async () => {
      if (!orgId) return [];
      const { data, error } = await supabase
        .from('projects')
        .select('id, project_name')
        .eq('organisation_id', orgId)
        .order('project_name');
      if (error) throw error;
      return data || [];
    }),
    enabled: !!orgId,
    staleTime: 60_000,
  });

  // Column visibility comes from the org's Purchase Order document template,
  // the same source CreateQuotation reads (index.tsx:289-291). Absent template
  // falls back to PO_DEFAULT_COLUMN_SETTINGS.
  const { data: poTemplate } = useQuery({
    queryKey: ['po-v2-template', orgId],
    queryFn: withSessionCheck(async () => {
      if (!orgId) return null;
      const { data, error } = await supabase
        .from('document_templates')
        .select('id, column_settings')
        .eq('document_type', 'Purchase Order')
        .or(`organisation_id.eq.${orgId},organisation_id.is.null`)
        .eq('is_default', true)
        .limit(1)
        .maybeSingle();
      if (error) return null;
      return data as any;
    }),
    enabled: !!orgId,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (poTemplate) setColumnSettings(mergeColumnSettings((poTemplate as any).column_settings));
  }, [poTemplate]);

  const signatures: any[] = (organisation as any)?.signatures || [];

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('organisations')
        .select('state')
        .eq('id', orgId)
        .maybeSingle();
      if (!cancelled && data?.state) setCompanyState(String(data.state));
    })();
    return () => { cancelled = true; };
  }, [orgId]);

  // ---- permissions --------------------------------------------------------
  // NOTE: the RBAC catalog (rbac/permission-catalog.ts) has no
  // purchase_orders.* keys — those strings exist only inside the DB RLS
  // policies. So there is no client-side permission key to gate this form on.
  // Enforcing here would be decorative, which is exactly the H-5 finding
  // (a "Restricted access" affordance with no server-side counterpart).
  // The real gate is RLS on purchase_orders / purchase_order_items; the
  // server RPCs re-check org membership on every call.
  // Permission gating for this module is Phase 3 work (add catalog keys,
  // then enforce). Not faked here.

  // ---- calculations -------------------------------------------------------
  const totals = useMemo(
    () => calculatePurchaseOrderTotals({
      items: rows,
      extraDiscountPercent: parseFloat(extraDiscountPercent) || 0,
      extraDiscountAmount: parseFloat(extraDiscountAmount) || 0,
      roundOffEnabled,
      vendorState,
      companyState,
    }),
    [rows, extraDiscountPercent, extraDiscountAmount, roundOffEnabled, vendorState, companyState]
  );

  const totalInr = useMemo(
    () => round2(totals.grandTotal * (parseFloat(exchangeRate) || 1)),
    [totals.grandTotal, exchangeRate]
  );

  const onVendorChange = (id: string) => {
    setVendorId(id);
    const v = vendors.find((x: any) => x.id === id);
    setVendorState(v?.state || '');
    setVendorSearch(null);
    setVendorDropdownOpen(false);
    setVendorTouched(false);
    setErrors(e => ({ ...e, vendor_id: '' }));
    setIsDirty(true);
  };

  const selectedVendor = vendors.find((x: any) => x.id === vendorId) || null;
  const vendorDisplayAddress = selectedVendor
    ? [selectedVendor.address, [selectedVendor.state, selectedVendor.pincode].filter(Boolean).join(' ')].filter(Boolean).join(', ')
    : '';

  /**
   * Header-level default variant. Re-prices every line whose material carries
   * that variant, exactly like CreateQuotation's Default variant control
   * (QuotationHeaderForm.tsx:384-408). Lines without the variant are untouched.
   */
  const applyDefaultVariant = (newVariantId: string) => {
    setDefaultVariantId(newVariantId);
    if (!newVariantId) return;
    setRows(prev => prev.map(r => {
      if (r.is_header || r.is_subtotal || !r.item_id) return r;
      const vRow = pricingByVariant[r.item_id]?.[newVariantId];
      if (!vRow) return r;
      const newRate = Number(vRow.base_rate ?? r.rate ?? 0);
      const catId = r.discount_category_id
        || materialCategories[r.item_id]?.discountCategoryId || null;
      const catDisc = catId
        ? (headerDiscounts[catId] ?? Number(categoryById[catId]?.default_discount_percent ?? 0))
        : 0;
      return {
        ...r,
        variant_id: newVariantId,
        rate: newRate,
        discount_percent: catDisc,
        is_override: false,
        make: vRow.make || r.make,
      };
    }));
    setIsDirty(true);
  };

  /** Header-level default make. Re-tags every billable line; rates untouched. */
  const applyDefaultMake = (make: string) => {
    setDefaultMake(make);
    if (!make) return;
    setRows(prev => prev.map(r => {
      if (r.is_header || r.is_subtotal) return r;
      return { ...r, make };
    }));
    setIsDirty(true);
  };

  /** Flatten a terms template into the textarea text (invoice-editor pattern). */
  const flattenTermsTemplate = (tpl: any): string => {
    if (!tpl) return '';
    if (typeof tpl === 'string') return tpl;
    const lines: string[] = [];
    for (const s of tpl.sections || []) {
      if (s?.title) lines.push(String(s.title));
      for (const it of s?.items || []) {
        if (it?.content) lines.push(`- ${String(it.content)}`);
      }
    }
    return lines.join('\n');
  };

  // ---- row operations -----------------------------------------------------
  const applyMaterial = (row: Row, material: PickerMaterial) => {
    const pricing = pricingByMaterial[material.id];
    const rate = effectiveRate(material, pricing);
    const pricingDisc = effectiveDiscount(pricing);
    const catId = materialCategories[material.id]?.discountCategoryId || null;
    const catDisc = catId
      ? (headerDiscounts[catId] ?? Number(categoryById[catId]?.default_discount_percent ?? 0))
      : null;
    setRows(prev => prev.map(r => {
      if (r._key !== row._key) return r;
      return {
        ...r,
        item_id: material.id,
        // Description is NEVER auto-filled from the material name. The name
        // renders as the row label; the description is user text created
        // through the pen-icon editor (CreateQuotation pattern). Filling it
        // here is what made every line parrot its item name.
        description: r.description || '',
        hsn_code: material.hsn_code || '',
        // The stored unit is normalised onto the dropdown's labels, so the
        // cell shows the item's own unit instead of a blank select.
        uom: normalizeUnit(r.uom && r.uom !== 'Nos' ? r.uom : material.unit),
        // Only fill when untouched, so a manual edit is never discarded.
        rate: r.rate ? r.rate : rate,
        make: r.make || pricing?.make || material.make || '',
        variant_id: r.variant_id || pricing?.variant_id || null,
        discount_category_id: catId,
        // Category discount seeds the line; an explicit per-line edit overrides.
        discount_percent: r.discount_percent || pricingDisc || catDisc || 0,
        is_override: r.is_override || false,
        tax_percent: material.gst_rate != null ? Number(material.gst_rate) : r.tax_percent,
      };
    }));
    setIsDirty(true);
  };

  const addRow = (afterKey?: string) => {
    const fresh = blankRow();
    setRows(prev => {
      if (!afterKey) return [...prev, fresh];
      const i = prev.findIndex(r => r._key === afterKey);
      if (i < 0) return [...prev, fresh];
      return [...prev.slice(0, i + 1), fresh, ...prev.slice(i + 1)];
    });
    setIsDirty(true);
  };

  /** Duplicate a line directly below it, with a fresh key (CreateQuotation parity). */
  const duplicateRow = (key: string) => {
    setRows(prev => {
      const i = prev.findIndex(r => r._key === key);
      if (i < 0) return prev;
      const copy: Row = { ...prev[i], _key: crypto.randomUUID() };
      return [...prev.slice(0, i + 1), copy, ...prev.slice(i + 1)];
    });
    setIsDirty(true);
  };

  const addSectionHeader = (afterKey: string) => {
    const header: Row = {
      _key: crypto.randomUUID(),
      is_header: true,
      description: '',
    };
    setRows(prev => {
      const i = prev.findIndex(r => r._key === afterKey);
      if (i < 0) return [...prev, header];
      return [...prev.slice(0, i + 1), header, ...prev.slice(i + 1)];
    });
    setIsDirty(true);
  };

  const addSubtotal = (afterKey: string) => {
    const row: Row = {
      _key: crypto.randomUUID(),
      is_subtotal: true,
      subtotal_label: 'Sub-total:',
    };
    setRows(prev => {
      const i = prev.findIndex(r => r._key === afterKey);
      if (i < 0) return [...prev, row];
      return [...prev.slice(0, i + 1), row, ...prev.slice(i + 1)];
    });
    setIsDirty(true);
  };

  const removeRow = (key: string) => {
    setRows(prev => (prev.length === 1 ? [blankRow()] : prev.filter(r => r._key !== key)));
    setIsDirty(true);
  };

  /** Insert a section heading at the end of the line items (CreateQuotation toolbar). */
  const appendSectionHeader = () => {
    setRows(prev => [
      ...prev.filter(r => !r.is_header && !r.is_subtotal ? r : r),
      { _key: crypto.randomUUID(), description: '', is_header: true, qty: 0, rate: 0, discount_percent: 0, tax_percent: 0 },
    ]);
    setIsDirty(true);
  };

  /** Insert a sub-total row at the end; it totals the lines above it. */
  const appendSubtotal = () => {
    setRows(prev => [
      ...prev,
      {
        _key: crypto.randomUUID(), description: 'Sub-total:', subtotal_label: 'Sub-total:',
        is_subtotal: true, qty: 0, rate: 0, discount_percent: 0, tax_percent: 0,
      },
    ]);
    setIsDirty(true);
  };

  const updateRow = (key: string, patch: Partial<Row>) => {
    setRows(prev => prev.map(r => {
      if (r._key !== key) return r;
      const next = { ...r, ...patch };
      // Typing in the line's own discount cell overrides the category discount
      // for that line only. Reverting it to the category value clears the flag
      // so the line follows the header again (CreateQuotation index.tsx:1277-1284).
      if ('discount_percent' in patch) {
        const inherited = categoryDiscountFor(r);
        next.is_override = Number(patch.discount_percent ?? 0) !== inherited;
      }
      return next;
    }));
    setIsDirty(true);
  };

  /**
   * Apply a header "Pricing Rules" discount. Every line carrying that category
   * follows it unless the line was individually overridden.
   */
  const setHeaderDiscount = (catId: string, rawValue: number) => {
    const cat = categoryById[catId];
    const value = clampCategoryDiscount(cat, rawValue);
    setHeaderDiscounts(prev => ({ ...prev, [catId]: value }));
    setRows(prev => prev.map(r => {
      if (r.is_header || r.is_subtotal) return r;
      const rowCat = r.discount_category_id
        || (r.item_id ? materialCategories[r.item_id]?.discountCategoryId : null);
      if (rowCat !== catId || r.is_override) return r;
      return { ...r, discount_percent: value };
    }));
    setIsDirty(true);
  };

  const confirmMoveTo = () => {
    const target = parseInt(moveToValue, 10);
    const billableIdx = rows.filter(r => !r.is_header && !r.is_subtotal).length;
    if (!target || target < 1 || target > billableIdx + 1) {
      toast.error(`Enter a line number between 1 and ${billableIdx + 1}.`);
      return;
    }
    setRows(prev => {
      const list = [...prev];
      const from = list.findIndex(r => r._key === moveToKey);
      if (from < 0) return prev;
      const [moved] = list.splice(from, 1);
      let seen = 0;
      let to = list.length;
      for (let i = 0; i < list.length; i++) {
        if (!list[i].is_header && !list[i].is_subtotal) {
          seen++;
          if (seen === target) { to = i; break; }
        }
      }
      list.splice(to, 0, moved);
      return list;
    });
    setMoveToKey(null);
    setMoveToValue('');
    setIsDirty(true);
  };

  // ---- drag (quotation parity) -------------------------------------------
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setRows(prev => {
      const from = prev.findIndex(r => r._key === active.id);
      const to = prev.findIndex(r => r._key === over.id);
      if (from < 0 || to < 0) return prev;
      const list = [...prev];
      const [moved] = list.splice(from, 1);
      list.splice(to, 0, moved);
      return list;
    });
    setIsDirty(true);
  };

  // ---- material picker ----------------------------------------------------
  const filteredMaterials = useMemo(
    () => filterMaterials(materials, pickerQuery),
    [materials, pickerQuery]
  );

  const stageMaterial = (m: PickerMaterial) => {
    setStaged(prev => ({ ...prev, [m.id]: (prev[m.id] || 0) + 1 }));
  };
  const unstageMaterial = (m: PickerMaterial) => {
    setStaged(prev => {
      const n = (prev[m.id] || 0) - 1;
      const next = { ...prev };
      if (n <= 0) delete next[m.id]; else next[m.id] = n;
      return next;
    });
  };

  const commitStaged = () => {
    const ids = Object.keys(staged);
    if (ids.length === 0) return;
    setRows(prev => {
      const next = [...prev];
      for (const id of ids) {
        const material = materials.find(m => m.id === id);
        if (!material) continue;
        const pricing = pricingByMaterial[id];
        const disc = effectiveDiscount(pricing);
        const catId = materialCategories[id]?.discountCategoryId || null;
        const catDisc = catId
          ? (headerDiscounts[catId] ?? Number(categoryById[catId]?.default_discount_percent ?? 0))
          : 0;
        for (let n = 0; n < (staged[id] || 1); n++) {
          next.push({
            _key: crypto.randomUUID(),
            item_id: material.id,
            // No auto-filled description — see applyMaterial note.
            description: '',
            hsn_code: material.hsn_code || '',
            qty: 1,
            uom: normalizeUnit(material.unit),
            rate: effectiveRate(material, pricing) || defaultRateFor(material),
            make: pricing?.make || material.make || '',
            variant_id: pricing?.variant_id || null,
            discount_category_id: catId,
            // A per-line vendor discount outranks the header category discount.
            discount_percent: disc ?? catDisc ?? 0,
            is_override: false,
            tax_percent: material.gst_rate != null ? Number(material.gst_rate) : 18,
          });
        }
      }
      return next;
    });
    setStaged({});
    setPickerOpen(false);
    setPickerQuery('');
    setIsDirty(true);
  };

  const stagedCount = Object.values(staged).reduce((a, b) => a + b, 0);

  // ---- validation ---------------------------------------------------------
  const validate = (): boolean => {
    const e: Record<string, string> = {};
    if (!vendorId) e['vendor_id'] = 'Please select a vendor';
    if (!poDate) e['po_date'] = 'PO date is required';
    if (deliveryDate && poDate && deliveryDate < poDate) {
      e['delivery_date'] = 'Delivery date cannot be earlier than the PO date';
    }
    if (currency !== 'INR' && !(parseFloat(exchangeRate) > 0)) {
      e['exchange_rate'] = 'Exchange rate must be greater than zero';
    }
    const billable = rows.filter(r => !r.is_header && !r.is_subtotal);
    if (billable.length === 0) e['items'] = 'At least one item is required';
    billable.forEach((r, i) => {
      // A material row is named by its material; a free-text row must carry
      // its own description. Description itself is optional pen-icon text.
      if (!r.item_id && !String(r.description || '').trim()) e[`row.${r._key}.description`] = 'Select a material or enter a description';
      if (!(parseFloat(String(r.qty)) > 0)) e[`row.${r._key}.qty`] = 'Quantity must be greater than 0';
      if (parseFloat(String(r.rate)) < 0) e[`row.${r._key}.rate`] = 'Rate cannot be negative';
      const dp = parseFloat(String(r.discount_percent)) || 0;
      if (dp < 0 || dp > 100) e[`row.${r._key}.discount_percent`] = 'Discount must be between 0 and 100';
    });
    setErrors(e);
    if (Object.keys(e).length > 0) {
      toast.error('Please fix the highlighted fields before saving.');
      return false;
    }
    return true;
  };

  // Keep the action-bar pill honest: any dirty edit after a save/error flips it
  // back to unsaved. Saving states are set explicitly by handleSave/Submit.
  useEffect(() => {
    if (isDirty) setSaveStatus((prev) => (prev === 'saving' ? prev : 'unsaved'));
  }, [isDirty]);

  // ---- duplicate: prefill from a source PO (V1 parity) ---------------------
  // The list clones header + items into sessionStorage, then navigates here with
  // ?duplicate=1. Nothing is written until Save, and the server allocates a new
  // PO number — V1 re-derived the number on the client and could collide.
  const isDuplicate = searchParams.get('duplicate') === '1';
  useEffect(() => {
    if (!isDuplicate) return;
    const raw = sessionStorage.getItem('po-v2-duplicate-source');
    if (!raw) { navigate('/purchase/orders-v2'); return; }
    try {
      const payload = JSON.parse(raw);
      const h = payload.header || {};
      setVendorId(h.vendor_id || '');
      setCurrency(h.currency || 'INR');
      setExchangeRate(String(h.exchange_rate ?? 1));
      setDeliveryLocation(h.delivery_location || '');
      setReferenceNo(h.reference_no || '');
      setTermsConditions(h.terms_conditions || '');
      setInternalNotes(h.internal_notes || '');
      setProjectId(h.project_id || '');
      setAuthorizedSignatoryId(h.authorized_signatory_id || '');
      setAttachmentUrl(h.attachment_url || '');
      // A new PO, dated today, with its own delivery date.
      setPoDate(new Date().toISOString().split('T')[0]);
      setDeliveryDate('');

      const cloned: Row[] = (payload.items || []).map((it: any) => ({
        _key: crypto.randomUUID(),
        item_id: it.item_id,
        variant_id: it.variant_id || null,
        description: it.description || it.item_name || '',
        hsn_code: it.hsn_code || '',
        qty: Number(it.quantity ?? 1),
        uom: normalizeUnit(it.unit),
        rate: Number(it.rate ?? 0),
        discount_percent: Number(it.discount_percent ?? 0),
        discount_category_id: it.discount_category_id || null,
        is_override: false,
        tax_percent:
          Number(it.cgst_percent ?? 0) * 2 + Number(it.sgst_percent ?? 0)
          || Number(it.igst_percent ?? 0) || 0,
        make: it.make || '',
        variant: it.variant || '',
        notes: it.notes || '',
      }));
      setRows(cloned.length ? cloned : [blankRow()]);
      setSavedPoId(null);           // force a create, never an update
      setPoNumberPreview('');
      setIsDirty(true);
      setDuplicateSourcePo(payload.poId as string | undefined);
      sessionStorage.removeItem('po-v2-duplicate-source');
      toast.info(`Duplicated from ${payload.poNumber}. Review and save as a new order.`);
    } catch {
      sessionStorage.removeItem('po-v2-duplicate-source');
      navigate('/purchase/orders-v2');
    }
  }, [isDuplicate, navigate]);

  // ---- unsaved-changes guard (V1 parity: PurchaseOrders.tsx:261) -----------
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isDirty]);

  // In-app navigation away from a dirty editor would otherwise silently discard
  // the whole document. V1 guarded the browser unload only.
  useEffect(() => {
    if (!isDirty) return;
    const confirmLeave = (e: MouseEvent) => {
      const anchor = e.target as HTMLElement | null;
      const link = anchor?.closest?.('a');
      if (link && !link.getAttribute('href')?.startsWith('#')) {
        if (!window.confirm('You have unsaved changes. Leave without saving?')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };
    document.addEventListener('click', confirmLeave, true);
    return () => document.removeEventListener('click', confirmLeave, true);
  }, [isDirty]);

  // ---- edit: load an existing draft ---------------------------------------
  // Without this, opening /purchase/orders-v2?id=<uuid> renders a blank form and
  // saving it OVERWRITES the stored PO via update_purchase_order_draft. Data loss.
  // Only Draft rows are editable; everything else is read-only here, which
  // matches V1 (handleEditPO refused to edit a non-draft PO).
  const [loadingExisting, setLoadingExisting] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!editId || !orgId) return;
    let cancelled = false;

    (async () => {
      setLoadingExisting(true);
      setLoadError(null);
      try {
        const { data: po, error: poErr } = await supabase
          .from('purchase_orders')
          .select(
            'id, vendor_id, po_date, delivery_date, project_id, reference_no, ' +
            'delivery_location, internal_notes, terms_conditions, authorized_signatory_id, ' +
            'currency, exchange_rate, attachment_url, status, approval_status, ' +
            'extra_discount_percent, extra_discount_amount, round_off, round_off_enabled'
          )
          .eq('id', editId)
          .eq('organisation_id', orgId)
          .maybeSingle();
        if (poErr) throw poErr;
        if (cancelled) return;
        if (!po) {
          setLoadError('That purchase order no longer exists.');
          setLoadingExisting(false);
          return;
        }

        const { data: items, error: itErr } = await supabase
          .from('purchase_order_items')
          .select(
            'id, item_id, variant_id, item_code, item_name, description, hsn_code, quantity, unit, ' +
            'rate, discount_percent, cgst_percent, sgst_percent, igst_percent, ' +
            'make, variant, notes, sr, expected_delivery_date'
          )
          .eq('po_id', editId)
          .eq('organisation_id', orgId)
          .order('sr', { ascending: true });
        if (itErr) throw itErr;
        if (cancelled) return;

        // discount_category_id and the extra-discount / round-off columns all
        // ship in 20260929000004, which may not be applied yet. Read them in
        // separate queries so a not-yet-migrated database still loads instead
        // of failing the whole editor.
        let catByItem: Record<string, string> = {};
        try {
          const { data: withCats } = await supabase
            .from('purchase_order_items')
            .select('id, discount_category_id')
            .eq('po_id', editId)
            .eq('organisation_id', orgId);
          for (const r of (withCats || []) as any[]) {
            if (r.discount_category_id) catByItem[r.id] = r.discount_category_id;
          }
        } catch {
          // Column absent — lines load without their category badge.
        }
        if (cancelled) return;

        // The extra-discount / round-off columns ship in 20260929000004, which is
        // not applied yet. Select them separately so a not-yet-migrated database
        // still loads instead of failing the whole editor.
        let discountFields: Record<string, any> = {};
        try {
          const { data: extra } = await supabase
            .from('purchase_orders')
            .select('extra_discount_percent, extra_discount_amount, round_off, round_off_enabled')
            .eq('id', editId)
            .eq('organisation_id', orgId)
            .maybeSingle();
          if (extra) discountFields = extra as Record<string, any>;
        } catch {
          // Columns absent — leave defaults. Not a hard failure.
        }
        if (cancelled) return;

        setVendorId(po.vendor_id || '');
        setPoDate(po.po_date || '');
        setDeliveryDate(po.delivery_date || '');
        setProjectId(po.project_id || '');
        setReferenceNo(po.reference_no || '');
        setDeliveryLocation(po.delivery_location || '');
        setInternalNotes(po.internal_notes || '');
        setTermsConditions(po.terms_conditions || '');
        setAuthorizedSignatoryId(po.authorized_signatory_id || '');
        setCurrency(po.currency || 'INR');
        setExchangeRate(String(po.exchange_rate ?? 1));
        setAttachmentUrl(po.attachment_url || '');
        setExtraDiscountPercent(String(discountFields.extra_discount_percent ?? 0));
        setExtraDiscountAmount(String(discountFields.extra_discount_amount ?? 0));
        setRoundOffEnabled(!!discountFields.round_off_enabled);

        const loaded: Row[] = (items || []).map((it: any) => ({
          _key: crypto.randomUUID(),
          item_id: it.item_id,
          variant_id: it.variant_id || null,
          description: it.description || it.item_name || '',
          hsn_code: it.hsn_code || '',
          qty: Number(it.quantity ?? 1),
          uom: normalizeUnit(it.unit),
          rate: Number(it.rate ?? 0),
          discount_percent: Number(it.discount_percent ?? 0),
          discount_category_id: catByItem[it.id] || null,
          is_override: false,
          // Reconstruct the single combined rate the row was saved with: the DB
          // stores the split (cgst+sgst) or igst, never both.
          tax_percent: Number(it.cgst_percent ?? 0) * 2
            + Number(it.sgst_percent ?? 0)
            || Number(it.igst_percent ?? 0)
            || 0,
          make: it.make || '',
          variant: it.variant || '',
          notes: it.notes || '',
        }));
        setRows(loaded.length ? loaded : [blankRow()]);
        setSavedPoId(po.id);
        setIsDirty(false);
        setSaveStatus('saved');
        setLoadingExisting(false);
      } catch (e: any) {
        if (cancelled) return;
        setLoadError(e?.message || 'Failed to load the purchase order.');
        setLoadingExisting(false);
      }
    })();

    return () => { cancelled = true; };
  }, [editId, orgId]);

  // ---- activity timeline --------------------------------------------------
  // Reads purchase_audit_log, not the empty po_activity_log V1 used.
  const [showActivity, setShowActivity] = useState(false);
  const { data: activity = [] } = useQuery({
    queryKey: ['po-v2-activity', orgId, savedPoId],
    queryFn: withSessionCheck(async () => {
      if (!orgId || !savedPoId) return [] as PoAuditEntry[];
      return listPoActivity(orgId, savedPoId);
    }),
    enabled: !!orgId && !!savedPoId && showActivity,
    staleTime: 15_000,
  });

  // ---- save ---------------------------------------------------------------
  const uploadAttachment = async (file: File): Promise<string | null> => {
    const ext = file.name.split('.').pop();
    const path = `po-attachments/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('attachments').upload(path, file);
    if (error) {
      toast.warning('Attachment upload failed. The purchase order will be saved without it.');
      return null;
    }
    const { data } = supabase.storage.from('attachments').getPublicUrl(path);
    return data?.publicUrl || null;
  };

  const saveMutation = useMutation({
    mutationFn: withSessionCheck(async (mode: 'create' | 'update' = 'create') => {
      const payloadItems = rows
        .filter(r => !r.is_header && !r.is_subtotal)
        .filter(r => r.item_id || String(r.description || '').trim().length > 0)
        .map(r => {
          // item_name is the MATERIAL name (what the line is); description is
          // the pen-icon user text (what the line says). They split here.
          const mat = r.item_id ? materials.find(m => m.id === r.item_id) : undefined;
          const matName = mat ? (mat.display_name || mat.name) : '';
          return buildPurchaseOrderItemPayload({ ...r, item_name: matName || r.description } as Row);
        });

      let attachmentUrlFinal = attachmentUrl;
      if (attachment) attachmentUrlFinal = await uploadAttachment(attachment);

      const common = {
        p_organisation_id: orgId,
        p_vendor_id: vendorId,
        p_po_date: poDate || null,
        p_delivery_date: deliveryDate || null,
        p_reference_no: referenceNo || null,
        p_terms_conditions: termsConditions || null,
        p_delivery_location: deliveryLocation || null,
        p_internal_notes: internalNotes || null,
        p_currency: currency,
        p_exchange_rate: parseFloat(exchangeRate) || 1,
        p_project_id: projectId || null,
        p_authorized_signatory_id: authorizedSignatoryId || null,
        p_extra_discount_percent: parseFloat(extraDiscountPercent) || 0,
        p_extra_discount_amount: parseFloat(extraDiscountAmount) || 0,
        p_round_off_enabled: roundOffEnabled,
        p_items: payloadItems,
      };

      // Stable per-session key: a double-click or retry replays instead of
      // creating a second PO. Regenerated after a successful save.
      const idempotencyKey = sessionStorage.getItem('po-v2-idempotency-key')
        || (() => { const k = crypto.randomUUID(); sessionStorage.setItem('po-v2-idempotency-key', k); return k; })();

      const isUpdate = !!savedPoId;
      const { data, error } = isUpdate
        ? await supabase.rpc('update_purchase_order_draft', { p_po_id: savedPoId, ...common })
        : await supabase.rpc('record_purchase_order', {
            ...common, p_status: 'Draft', p_idempotency_key: idempotencyKey,
          });

      if (error) throw error;

      const newPoId = (data as any)?.po_id;
      if (attachmentUrlFinal && !isUpdate && newPoId) {
        await supabase.from('purchase_orders')
          .update({ attachment_url: attachmentUrlFinal })
          .eq('id', newPoId);
      }

      if (orgId && newPoId) {
        const fromDuplicate = !isUpdate && !!duplicateSourcePo;
        await logPoActivity({
          organisationId: orgId,
          poId: newPoId,
          actorId: user?.id ?? null,
          action: fromDuplicate ? 'DUPLICATE' : isUpdate ? 'UPDATE' : 'CREATE',
          description: fromDuplicate
            ? `Duplicated from ${duplicateSourcePo}.`
            : isUpdate
              ? 'Draft updated.'
              : `Draft created with ${payloadItems.length} line${payloadItems.length === 1 ? '' : 's'}.`,
          details: {
            po_number: (data as any)?.po_number || null,
            total_amount: (data as any)?.total_amount ?? null,
            line_count: payloadItems.length,
            duplicated_from: duplicateSourcePo || null,
          },
        });
      }
      return data as any;
    }),
    onSuccess: async (data: any) => {
      sessionStorage.removeItem('po-v2-idempotency-key');
      setPoNumberPreview(data?.po_number || '');
      setSavedPoId(data?.po_id || null);
      setDuplicateSourcePo(null);
      setAttachment(null);
      setIsDirty(false);
      setErrors({});
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
    },
  });

  const submitMutation = useMutation({
    mutationFn: withSessionCheck(async (poId: string) => {
      const { data, error } = await supabase.rpc('submit_purchase_order_for_approval', {
        p_po_id: poId,
        p_organisation_id: orgId,
      });
      if (error) throw error;
      if (orgId) {
        await logPoActivity({
          organisationId: orgId,
          poId,
          actorId: user?.id ?? null,
          action: 'SUBMIT',
          description: 'Submitted for approval.',
          details: { po_number: (data as any)?.po_number || null },
        });
      }
      return data as any;
    }),
    onSuccess: async (_data: any, submittedPoId: string) => {
      await queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      await queryClient.invalidateQueries({ queryKey: ['po-v2-activity', orgId, submittedPoId] });
    },
  });

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    setSaveStatus('saving');
    try {
      const result = await saveMutation.mutateAsync(savedPoId ? 'update' : 'create');
      setSaveStatus('saved');
      toast.success(result?.idempotent_replayed
        ? `Purchase Order ${result.po_number} was already saved.`
        : `Purchase Order ${result?.po_number} saved as Draft.`);
    } catch (err: any) {
      setSaveStatus('error');
      toast.error(err?.message ?? 'Failed to save purchase order.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSaveStatus('saving');
    try {
      let poId = savedPoId;
      if (!poId) poId = (await saveMutation.mutateAsync('create'))?.po_id;
      if (!poId) throw new Error('Purchase order could not be saved.');
      const result = await submitMutation.mutateAsync(poId);
      setSaveStatus('saved');
      toast.success(result?.already_submitted
        ? `Purchase Order ${result.po_number} was already submitted.`
        : `Purchase Order ${result?.po_number} submitted for approval.`);
      navigate('/purchase/orders-v2');
    } catch (err: any) {
      setSaveStatus('error');
      toast.error(err?.message ?? 'Failed to submit for approval.');
    } finally {
      setSubmitting(false);
    }
  };

  const busy = saving || submitting;
  const maySave = !busy;
  const taxGroupRows = Object.keys(totals.taxGroups).map(Number).sort((a, b) => a - b);
  const billableCount = rows.filter(r => !r.is_header && !r.is_subtotal).length;
  /** Total rendered <td> count, so header/sub-total colSpans stay correct when columns are hidden. */
  const colCount = 2
    + (visible('description') ? 1 : 0)
    + (visible('hsn_code') ? 1 : 0)
    + (visible('make') ? 1 : 0)
    + (visible('variant') ? 1 : 0)
    + 2                                        // qty, uom
    + (visible('rate') ? 1 : 0)
    + (visible('discount_category') ? 1 : 0)
    + (visible('discount_percent') ? 1 : 0)
    + (visible('rate_after_discount') ? 1 : 0)
    + (visible('tax_percent') ? 1 : 0)
    + (visible('line_total') ? 1 : 0)
    + 1;                                       // row actions

  if (loadingExisting) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '48px', justifyContent: 'center', color: '#6b7280', fontSize: '14px' }}>
        <Loader2 size={16} className="animate-spin" /> Loading purchase order…
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: '32px' }}>
        <div style={{ padding: '12px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#991B1B', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{ flex: 1 }}>{loadError}</span>
            <button type="button" onClick={() => navigate('/purchase/orders-v2')} style={{ padding: '4px 10px', border: '1px solid #FCA5A5', borderRadius: '4px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>
            Back to list
          </button>
        </div>
      </div>
    );
  }

  return (
    <DocumentEditorShell
      contentStyle={{ paddingBottom: '16px' }}
      actionBar={
        <DocumentActionBar
          title={editId ? 'Edit Purchase Order' : 'Create Purchase Order'}
          subtitle={poNumberPreview ? `PO No. ${poNumberPreview}` : undefined}
          isDirty={isDirty}
          fixed={{ top: 32, left: 220 }}
          statusBadge={<SaveStatusIndicator status={saveStatus} />}
          rightActions={
            <>
              <button
                type="button"
                onClick={() => navigate('/purchase/orders-v2')}
                disabled={busy}
                style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 500, color: '#374151', cursor: busy ? 'wait' : 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!maySave}
                style={{ padding: '6px 14px', border: '1px solid #1e3a8a', borderRadius: '6px', background: '#fff', fontSize: '13px', fontWeight: 500, color: '#1e3a8a', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: maySave ? 'pointer' : 'not-allowed', opacity: maySave ? 1 : 0.5 }}
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                {saving ? 'Saving...' : 'Save Draft'}
              </button>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!maySave}
                style={{ padding: '6px 14px', border: '1px solid #1e3a8a', borderRadius: '6px', background: '#1e3a8a', fontSize: '13px', fontWeight: 600, color: '#fff', display: 'inline-flex', alignItems: 'center', gap: '6px', cursor: maySave ? 'pointer' : 'not-allowed', opacity: maySave ? 1 : 0.5 }}
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {submitting ? 'Submitting...' : 'Submit for Approval'}
              </button>
            </>
          }
        />
      }
    >
      <HeaderFormGrid columns={3}>

        <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Vendor">
          <HeaderField label="Vendor" required labelWidth="100px">
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="form-input"
                style={{ ...sharedStyles.inputStyle, borderColor: errors['vendor_id'] ? '#ef4444' : undefined, backgroundColor: errors['vendor_id'] ? '#fef2f2' : undefined }}
                placeholder="Search or select vendor..."
                value={vendorSearch !== null ? vendorSearch : (selectedVendor?.company_name || '')}
                onChange={(e) => { setVendorSearch(e.target.value); setVendorDropdownOpen(true); }}
                onClick={() => setVendorDropdownOpen(true)}
                onFocus={() => setVendorDropdownOpen(true)}
                onBlur={() => {
                  setTimeout(() => {
                    setVendorSearch(null);
                    setVendorTouched(true);
                    setVendorDropdownOpen(false);
                  }, 200);
                }}
              />
              {vendorDropdownOpen && (
                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: '#fff', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                  {vendors
                    .filter((v: any) => !vendorSearch || (v.company_name || '').toLowerCase().includes(vendorSearch.toLowerCase()))
                    .map((v: any) => (
                      <div
                        key={v.id}
                        onMouseDown={(e) => { e.preventDefault(); onVendorChange(v.id); }}
                        style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                      >
                        {v.company_name}
                        {v.gstin ? <span style={{ color: '#9ca3af' }}> ({v.gstin})</span> : null}
                      </div>
                    ))}
                  {vendors.filter((v: any) => !vendorSearch || (v.company_name || '').toLowerCase().includes(vendorSearch.toLowerCase())).length === 0 && (
                    <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No vendors found</div>
                  )}
                </div>
              )}
            </div>
          </HeaderField>
          {errors['vendor_id'] && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#e11d48' }}>{errors['vendor_id']}</p>}
          {vendorTouched && !vendorId && !errors['vendor_id'] && (
            <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#e11d48' }}>Please select a vendor from the list.</p>
          )}
          {selectedVendor && (
            <>
              {(selectedVendor.contact_person || selectedVendor.phone) && (
                <HeaderField label="Contact" labelWidth="100px">
                  <div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', minHeight: '32px', lineHeight: 1.4, fontSize: '12px' }}>
                    {[selectedVendor.contact_person, selectedVendor.phone].filter(Boolean).join(' · ')}
                  </div>
                </HeaderField>
              )}
              {vendorDisplayAddress && (
                <HeaderField label="Address" labelWidth="100px">
                  <div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: 1.4, fontSize: '12px' }}>
                    {vendorDisplayAddress}
                  </div>
                </HeaderField>
              )}
              {selectedVendor.gstin && (
                <HeaderField label="GSTIN" labelWidth="100px">
                  <div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', minHeight: '32px', lineHeight: 1.4, fontSize: '12px' }}>
                    {selectedVendor.gstin}
                  </div>
                </HeaderField>
              )}
              <HeaderField label="Delivery" labelWidth="100px">
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {vendorAddresses.length > 0 && (
                      <select
                        className="form-select"
                        style={{ ...sharedStyles.inputStyle, flex: 1, minWidth: 0, width: 'auto' }}
                        defaultValue=""
                        onChange={(e) => {
                          const addr = vendorAddresses.find(a => a.id === e.target.value);
                          if (addr) {
                            setDeliveryLocation(formatVendorAddressBlock(addr));
                            setIsDirty(true);
                          }
                          e.target.value = '';
                        }}
                      >
                        <option value="" disabled>Select saved delivery address...</option>
                        {vendorAddresses.map(a => (
                          <option key={a.id} value={a.id}>{addressShortLabel(a)}</option>
                        ))}
                      </select>
                    )}
                    <button
                      type="button"
                      title="Add delivery address"
                      aria-label="Add delivery address"
                      onClick={() => {
                        if (!vendorId) { toast.error('Select a vendor first.'); return; }
                        if (vendorAddrTableMissing) {
                          toast.error('Delivery addresses need migration 20260929000005, which is not applied yet.');
                          return;
                        }
                        setShippingModalOpen(true);
                      }}
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', flexShrink: 0, border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#2563eb', cursor: 'pointer' }}
                    >
                      <MapPin size={14} />
                    </button>
                  </div>
                  <textarea
                    className="form-input"
                    style={{ ...sharedStyles.inputStyle, minHeight: '52px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }}
                    value={deliveryLocation}
                    onChange={(e) => { setDeliveryLocation(e.target.value); setIsDirty(true); }}
                    placeholder="Delivery location / site"
                  />
                </div>
              </HeaderField>
            </>
          )}
          <HeaderField label="Project" labelWidth="100px">
            <select className="form-select" style={sharedStyles.inputStyle} value={projectId} onChange={(e) => { setProjectId(e.target.value); setIsDirty(true); }}>
              <option value="">Select project</option>
              {projects.map((p: any) => <option key={p.id} value={p.id}>{p.project_name}</option>)}
            </select>
          </HeaderField>
          <HeaderField label="Ref No" labelWidth="100px">
            <input type="text" className="form-input" style={sharedStyles.inputStyle} value={referenceNo} onChange={(e) => { setReferenceNo(e.target.value); setIsDirty(true); }} placeholder="Vendor reference / RFQ" />
          </HeaderField>
        </HeaderCard>

        <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
          <HeaderField label="PO Number" labelWidth="100px">
            <input type="text" className="form-input" style={{ ...sharedStyles.inputStyle, background: '#f3f4f6' }} value={poNumberPreview} readOnly placeholder="Assigned on save" />
          </HeaderField>
          <HeaderField label="PO Date" required labelWidth="100px">
            <CustomDatePicker value={poDate} onChange={(v) => { setPoDate(v); setIsDirty(true); }} inputStyle={{ ...sharedStyles.inputStyle, border: errors['po_date'] ? '1px solid #f43f5e' : undefined }} />
          </HeaderField>
          {errors['po_date'] && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#e11d48' }}>{errors['po_date']}</p>}
          <HeaderField label="Delivery" labelWidth="100px">
            <CustomDatePicker value={deliveryDate} onChange={(v) => { setDeliveryDate(v); setIsDirty(true); }} inputStyle={{ ...sharedStyles.inputStyle, border: errors['delivery_date'] ? '1px solid #f43f5e' : undefined }} minDate={poDate} />
          </HeaderField>
          {errors['delivery_date'] && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#e11d48' }}>{errors['delivery_date']}</p>}
          <HeaderField label="Currency" labelWidth="100px">
            <select className="form-select" style={sharedStyles.inputStyle} value={currency} onChange={(e) => { setCurrency(e.target.value); if (e.target.value === 'INR') setExchangeRate('1'); setIsDirty(true); }}>
              {['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </HeaderField>
          {currency !== 'INR' && (
            <HeaderField label="Exch. Rate" required labelWidth="100px">
              <input type="number" step="0.0001" min="0" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right', border: errors['exchange_rate'] ? '1px solid #f43f5e' : undefined }} value={exchangeRate} onChange={(e) => { setExchangeRate(e.target.value); setIsDirty(true); }} />
            </HeaderField>
          )}
          {errors['exchange_rate'] && <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#e11d48' }}>{errors['exchange_rate']}</p>}
        </HeaderCard>

        {/* Third header column: Pricing. CreateQuotation's third column holds
            Project + Pricing + Pricing Rules (Discount Categories)
            (QuotationHeaderForm.tsx:450-541); the PO's discount/rounding and
            category rules live here, not below the line items. */}
        <HeaderCard icon={<Percent size={14} style={{ color: '#2563eb' }} />} title="Pricing">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <HeaderField label="Addl Disc %" labelWidth="100px">
              <input type="number" step="0.01" min="0" max="100" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={extraDiscountPercent} onChange={(e) => { setExtraDiscountPercent(e.target.value); setIsDirty(true); }} title="Additional discount on the order total, applied after all line discounts. Shows as 'Additional Discount' in the totals." />
            </HeaderField>
            <HeaderField label="Addl Disc Amt" labelWidth="100px">
              <input type="number" step="0.01" min="0" className="form-input" style={{ ...sharedStyles.inputStyle, textAlign: 'right' }} value={extraDiscountAmount} onChange={(e) => { setExtraDiscountAmount(e.target.value); setIsDirty(true); }} title="Additional flat discount on the order total, applied after all line discounts." />
            </HeaderField>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '8px' }}>
            <HeaderField label="Def. Variant" labelWidth="100px">
              <select
                className="form-select"
                style={sharedStyles.inputStyle}
                value={defaultVariantId}
                onChange={(e) => applyDefaultVariant(e.target.value)}
                title="Re-price every line carrying this variant"
              >
                <option value="">Standard</option>
                {variantOptions.map(v => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
            </HeaderField>
            <HeaderField label="Def. Make" labelWidth="100px">
              <select
                className="form-select"
                style={sharedStyles.inputStyle}
                value={defaultMake}
                onChange={(e) => applyDefaultMake(e.target.value)}
                title="Set the make on every line"
              >
                <option value="">—</option>
                {vendorMakes.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </HeaderField>
          </div>
          <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
            Pricing Rules (Discount Categories)
          </div>
          {categories.length === 0 ? (
            <p style={{ margin: 0, fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
              No discount categories visible for this organisation.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {categories.map(cat => {
                const current = headerDiscounts[cat.id] ?? Number(cat.default_discount_percent ?? 0);
                const affected = rows.filter(r => {
                  if (r.is_header || r.is_subtotal) return false;
                  const rowCat = r.discount_category_id
                    || (r.item_id ? materialCategories[r.item_id]?.discountCategoryId : null);
                  return rowCat === cat.id;
                }).length;
                return (
                  <div
                    key={cat.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '4px', minHeight: '30px' }}
                  >
                    <span
                      title={cat.name}
                      style={{ fontWeight: 600, fontSize: '12px', color: '#374151', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                    >
                      {cat.name}
                    </span>
                    <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                      {affected} line{affected === 1 ? '' : 's'}
                    </span>
                    {cat.max_discount_percent != null && (
                      <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        max {Number(cat.max_discount_percent)}%
                      </span>
                    )}
                    <input
                      type="number" min={Number(cat.min_discount_percent ?? 0)} max={Number(cat.max_discount_percent ?? 100)} step="0.01"
                      className="form-input"
                      style={{ ...sharedStyles.inputStyle, width: 64, textAlign: 'right', fontWeight: 700 }}
                      value={current}
                      onChange={(e) => setHeaderDiscount(cat.id, parseFloat(e.target.value) || 0)}
                      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                    />
                    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 600 }}>%</span>
                  </div>
                );
              })}
            </div>
          )}
        </HeaderCard>
      </HeaderFormGrid>

      {errors['items'] && (
        <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#e11d48' }}>{errors['items']}</p>
      )}

      <DocumentLineItemsSurface
        title={`Line Items (${billableCount})`}
        actions={
          <>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Package size={13} /> Multiple Items
            </button>
            <button
              type="button"
              onClick={() => appendSectionHeader()}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Insert a section heading row above the line items"
            >
              <Plus size={13} /> Add Section Header
            </button>
            <button
              type="button"
              onClick={() => appendSubtotal()}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
              title="Insert a sub-total row that totals the lines above it"
            >
              <Plus size={13} /> Add Sub-total
            </button>
            <div>
              <button
                type="button"
                ref={columnsBtnRef}
                onClick={(e) => {
                  if (!columnsOpen) {
                    const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setColumnsPos({ top: r.bottom + 4, right: Math.max(8, window.innerWidth - r.right) });
                  }
                  setColumnsOpen(v => !v);
                }}
                style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: columnsOpen ? '#f3f4f6' : '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                aria-expanded={columnsOpen}
              >
                <Columns3 size={13} /> Columns
              </button>
              {columnsOpen && columnsPos && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }} onClick={() => setColumnsOpen(false)} />
                  {/* Fixed, not absolute: the toolbar sits inside containers that
                      clip overflow, which swallowed the panel. Coordinates come
                      from the button rect at open time; any scroll closes it. */}
                  <div style={{ position: 'fixed', top: columnsPos.top, right: columnsPos.right, zIndex: 9001, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.10)', padding: '6px', minWidth: 190, maxHeight: 320, overflowY: 'auto' }}>
                    <p style={{ margin: '2px 4px 6px', fontSize: '10px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Show columns
                    </p>
                    {PO_TOGGLEABLE_COLUMNS.map(key => (
                      <label
                        key={key}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', fontSize: '12px', color: '#374151', cursor: 'pointer', borderRadius: '4px' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = '#f3f4f6'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                      >
                        <input
                          type="checkbox"
                          checked={visible(key)}
                          onChange={() => toggleColumn(key)}
                          style={{ cursor: 'pointer' }}
                        />
                        {columnLabel(columnSettings, key)}
                      </label>
                    ))}
                    <div style={{ borderTop: '1px solid #f3f4f6', margin: '6px 0 4px' }} />
                    <button
                      type="button"
                      onClick={() => setColumnSettings(PO_DEFAULT_COLUMN_SETTINGS)}
                      style={{ width: '100%', padding: '5px 6px', fontSize: '11px', color: '#2563eb', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', borderRadius: '4px' }}
                    >
                      Reset to default
                    </button>
                  </div>
                </>
              )}
            </div>
            <button
              type="button"
              onClick={() => addRow()}
              style={{ padding: '6px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
            >
              <Plus size={13} /> Add Row
            </button>
          </>
        }
      >
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={rows.map(r => r._key)} strategy={verticalListSortingStrategy}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ background: '#1e3a8a', color: 'white' }}>
                    <th style={{ padding: '8px', width: 28 }} />
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 34 }}>#</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, minWidth: 220 }}>
                      {columnLabel(columnSettings, 'description')}
                    </th>
                    {visible('hsn_code') && (
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 84 }}>
                        {columnLabel(columnSettings, 'hsn_code')}
                      </th>
                    )}
                    {visible('make') && (
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 96 }}>
                        {columnLabel(columnSettings, 'make')}
                      </th>
                    )}
                    {visible('variant') && (
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 110 }}>
                        {columnLabel(columnSettings, 'variant')}
                      </th>
                    )}
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 74 }}>QTY</th>
                    <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 78 }}>UNIT</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 92 }}>
                      {columnLabel(columnSettings, 'rate')}
                    </th>
                    {visible('discount_category') && (
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 700, width: 116 }}>
                        {columnLabel(columnSettings, 'discount_category')}
                      </th>
                    )}
                    {visible('discount_percent') && (
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 76 }}>
                        {columnLabel(columnSettings, 'discount_percent')}
                      </th>
                    )}
                    {visible('rate_after_discount') && (
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 96 }}>
                        {columnLabel(columnSettings, 'rate_after_discount')}
                      </th>
                    )}
                    {visible('tax_percent') && (
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 74 }}>
                        {columnLabel(columnSettings, 'tax_percent')}
                      </th>
                    )}
                    {visible('line_total') && (
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700, width: 108 }}>
                        {columnLabel(columnSettings, 'line_total')}
                      </th>
                    )}
                    <th style={{ padding: '8px', width: 96 }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    if (row.is_header) {
                      return (
                        <tr key={row._key} style={{ background: '#eef2ff' }}>
                          <td colSpan={colCount} style={{ padding: '8px 12px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <Heading size={14} style={{ color: '#1e3a8a', flexShrink: 0 }} />
                              <input
                                type="text"
                                style={{ ...sharedStyles.inputStyle, fontWeight: 700, color: '#1e3a8a', flex: 1, background: 'transparent', border: '1px solid transparent' }}
                                value={row.description || ''}
                                onChange={(e) => updateRow(row._key, { description: e.target.value })}
                                placeholder="Section header (e.g. Civil Work)..."
                              />
                              <button type="button" onClick={() => removeRow(row._key)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} aria-label="Remove section">
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }
                    if (row.is_subtotal) {
                      return (
                        <tr key={row._key} style={{ background: '#fef9c3', borderTop: '2px solid #eab308' }}>
                          <td colSpan={colCount - 2} style={{ padding: '6px 12px' }}>
                            <input
                              type="text"
                              style={{ ...sharedStyles.inputStyle, fontWeight: 600, background: 'transparent', border: '1px solid transparent', width: 160 }}
                              value={row.subtotal_label || ''}
                              onChange={(e) => updateRow(row._key, { subtotal_label: e.target.value })}
                            />
                          </td>
                          <td style={{ padding: '6px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 700 }}>
                            {formatCurrency(totals.subtotalByKey[row._key] || 0)}
                          </td>
                          <td style={{ padding: '6px', textAlign: 'center' }}>
                            <button type="button" onClick={() => removeRow(row._key)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} aria-label="Remove sub-total">
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <SortableRow key={row._key} id={row._key}>
                        <td style={{ padding: '4px', textAlign: 'center' }}>
                          <span style={{ cursor: 'grab', color: '#94a3b8', display: 'inline-block' }} aria-label="Drag to reorder">
                            <GripVertical size={13} />
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontSize: '11px', textAlign: 'center', color: '#94a3b8' }}>
                          {rows.slice(0, index).filter(r => !r.is_header && !r.is_subtotal).length + 1}
                        </td>
                        <td style={{ padding: '4px 8px', position: 'relative' }}>
                          {(() => {
                            // CreateQuotation pattern (QuotationItemsTable.tsx:590-717):
                            // a searchable in-cell material picker; the picked
                            // material's name renders as a label with the
                            // category badge and HSN, an inline description
                            // sits underneath, and a hover × clears the linkage
                            // so a replacement can be picked.
                            const mat = row.item_id ? materials.find(m => m.id === row.item_id) : undefined;
                            const catId = row.discount_category_id
                              || (row.item_id ? materialCategories[row.item_id]?.discountCategoryId : null)
                              || null;
                            const catName = catId ? (categoryById[catId]?.name || materialCategories[row.item_id]?.discountCategoryName) : null;
                            const name = mat ? (mat.display_name || mat.name) : null;
                            const hsn = row.hsn_code || mat?.hsn_code || '';
                            const searchOpen = itemSearchRowKey === row._key;
                            const searchResults = filterMaterials(materials, itemSearchQuery).slice(0, 8);
                            return (
                              <div
                                onMouseEnter={(e) => {
                                  const x = e.currentTarget.querySelector('[data-clear-item]') as HTMLElement | null;
                                  if (x) { x.style.opacity = '1'; x.style.transform = 'scale(1.05)'; }
                                }}
                                onMouseLeave={(e) => {
                                  const x = e.currentTarget.querySelector('[data-clear-item]') as HTMLElement | null;
                                  if (x) { x.style.opacity = '0'; x.style.transform = 'scale(1)'; }
                                }}
                              >
                                {name && (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px', minWidth: 0 }}>
                                    <span
                                      style={{
                                        fontSize: '12px', fontWeight: 600, color: '#1e293b',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                      }}
                                      title={name}
                                    >
                                      {name}
                                    </span>
                                    <button
                                      type="button"
                                      data-clear-item
                                      title="Clear item and select replacement"
                                      onClick={() => {
                                        updateRow(row._key, {
                                          item_id: null, variant_id: null, hsn_code: '',
                                          description: '', discount_category_id: null,
                                          make: '', rate: 0, discount_percent: 0, is_override: false,
                                        });
                                        setItemSearchRowKey(row._key);
                                        setItemSearchQuery('');
                                        setItemSearchPos(null);
                                      }}
                                      style={{
                                        marginLeft: 'auto', padding: '1px 6px', fontSize: '12px',
                                        background: '#dc2626', color: '#fff', border: 'none',
                                        borderRadius: '4px', cursor: 'pointer', opacity: 0,
                                        transition: 'opacity 0.15s', flexShrink: 0,
                                      }}
                                    >
                                      ×
                                    </button>
                                  </div>
                                )}
                                {!name && (
                                  <div style={{ position: 'relative', marginBottom: '2px' }}>
                                    <input
                                      type="text"
                                      className="form-input"
                                      style={{ ...sharedStyles.inputStyle, paddingRight: '22px' }}
                                      placeholder="Search materials..."
                                      value={searchOpen ? itemSearchQuery : ''}
                                      onFocus={(e) => openItemSearch(row._key, e.currentTarget, '')}
                                      onChange={(e) => openItemSearch(row._key, e.currentTarget, e.target.value)}
                                      onBlur={() => setTimeout(() => setItemSearchRowKey((k) => (k === row._key ? null : k)), 200)}
                                    />
                                    <Search size={12} style={{ position: 'absolute', right: 7, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
                                  </div>
                                )}
                                {searchOpen && itemSearchPos && (
                                  <div style={{ position: 'fixed', top: itemSearchPos.top, left: itemSearchPos.left, width: itemSearchPos.width, zIndex: 9001, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)', maxHeight: '220px', overflowY: 'auto', marginTop: '2px' }}>
                                    {searchResults.length === 0 && (
                                      <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>
                                        No materials match. Type a description below instead.
                                      </div>
                                    )}
                                    {searchResults.map((m) => (
                                      <div
                                        key={m.id}
                                        onMouseDown={(e) => {
                                          e.preventDefault();
                                          applyMaterial(row, m);
                                          setItemSearchRowKey(null);
                                          setItemSearchQuery('');
                                          setItemSearchPos(null);
                                        }}
                                        style={{ padding: '6px 10px', cursor: 'pointer', borderBottom: '1px solid #f3f4f6' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                                      >
                                        <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b' }}>{m.display_name || m.name}</div>
                                        <div style={{ fontSize: '10px', color: '#9ca3af' }}>
                                          {[m.hsn_code, m.make, m.unit].filter(Boolean).join(' · ')}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {(row.item_id || row.description) ? (
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                                    {catName && (
                                      <span
                                        title={`Discount category: ${catName}`}
                                        style={{
                                          padding: '1px 6px', fontSize: '10px', fontWeight: 600,
                                          letterSpacing: '0.04em', color: '#00476E', background: '#CCE5FF',
                                          borderRadius: '4px', whiteSpace: 'nowrap', flexShrink: 0,
                                        }}
                                      >
                                        {catName}
                                      </span>
                                    )}
                                    {hsn && (
                                      <span style={{ fontSize: '11px', color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 }}>
                                        HSN: {hsn}
                                      </span>
                                    )}
                                    <div style={{ flex: 1, minWidth: 0, marginTop: '-4px' }}>
                                      <InlineDescriptionCell
                                        materialName={name || ''}
                                        description={row.description}
                                        onSave={(desc) => updateRow(row._key, { description: desc })}
                                      />
                                    </div>
                                  </div>
                                ) : (
                                  <div style={{ marginTop: '2px' }}>
                                    <InlineDescriptionCell
                                      materialName=""
                                      description={row.description}
                                      onSave={(desc) => updateRow(row._key, { description: desc })}
                                    />
                                  </div>
                                )}
                                {errors[`row.${row._key}.description`] && (
                                  <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#e11d48' }}>
                                    {errors[`row.${row._key}.description`]}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        {visible('hsn_code') && (
                          <td style={{ padding: '4px 8px' }}>
                            <input type="text" className="form-input" style={sharedStyles.inputStyle} value={row.hsn_code || ''} onChange={(e) => updateRow(row._key, { hsn_code: e.target.value })} />
                          </td>
                        )}
                        {visible('make') && (
                          <td style={{ padding: '4px 8px' }}>
                            <input type="text" className="form-input" style={sharedStyles.inputStyle} value={row.make || ''} onChange={(e) => updateRow(row._key, { make: e.target.value })} placeholder="Make" />
                          </td>
                        )}
                        {visible('variant') && (
                          <td style={{ padding: '4px 8px' }}>
                            <select
                              className="form-select"
                              style={sharedStyles.inputStyle}
                              value={row.variant_id || ''}
                              onChange={(e) => {
                                const v = e.target.value || null;
                                const vRow = row.item_id ? pricingByVariant[row.item_id]?.[v] : null;
                                // A variant carries its own base rate and discount,
                                // so picking one re-prices the line.
                                updateRow(row._key, {
                                  variant_id: v,
                                  ...(vRow ? {
                                    rate: Number(vRow.base_rate ?? row.rate ?? 0),
                                    discount_percent: vRow.discount_percent != null
                                      ? Number(vRow.discount_percent)
                                      : row.discount_percent,
                                    make: vRow.make || row.make,
                                  } : {}),
                                });
                              }}
                            >
                              <option value="">No Variant</option>
                              {variantOptions.map(v => (
                                <option key={v.id} value={v.id}>{v.label}</option>
                              ))}
                            </select>
                          </td>
                        )}
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number" step="0.001" min="0"
                            className="form-input"
                            style={{ ...sharedStyles.inputStyle, textAlign: 'right', border: errors[`row.${row._key}.qty`] ? '1px solid #f43f5e' : undefined }}
                            value={row.qty ?? ''}
                            onChange={(e) => updateRow(row._key, { qty: parseFloat(e.target.value) || 0 })}
                          />
                          {errors[`row.${row._key}.qty`] && (
                            <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#e11d48' }}>{errors[`row.${row._key}.qty`]}</span>
                          )}
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          {/* Item's own units only — never the full UOM list.
                              Single-unit materials render as static text. */}
                          <UnitDropdownSelect
                            value={row.uom || ''}
                            materialId={row.item_id || ''}
                            materials={materials}
                            onChange={(val) => updateRow(row._key, { uom: val })}
                          />
                        </td>
                        <td style={{ padding: '4px 8px' }}>
                          <input
                            type="number" step="0.01" min="0"
                            className="form-input"
                            style={{ ...sharedStyles.inputStyle, textAlign: 'right', border: errors[`row.${row._key}.rate`] ? '1px solid #f43f5e' : undefined }}
                            value={row.rate ?? ''}
                            onChange={(e) => updateRow(row._key, { rate: parseFloat(e.target.value) || 0 })}
                          />
                          {errors[`row.${row._key}.rate`] && (
                            <span style={{ display: 'block', marginTop: '2px', fontSize: '10px', color: '#e11d48' }}>{errors[`row.${row._key}.rate`]}</span>
                          )}
                          {/* Recent purchase history for this exact material.
                              Needs item_id — free-text rows have no history. */}
                          {row.item_id && (
                            <button
                              type="button"
                              title="Show recent purchase history for this item"
                              onClick={() => {
                                const mat = materials.find(m => m.id === row.item_id);
                                setHistoryMaterial({
                                  id: row.item_id as string,
                                  name: mat ? (mat.display_name || mat.name) : (row.description || 'Item'),
                                });
                              }}
                              style={{
                                marginTop: '2px', padding: '1px 7px', fontSize: '10px', fontWeight: 600,
                                color: '#2563eb', background: '#eff6ff', border: '1px solid #bfdbfe',
                                borderRadius: '4px', cursor: 'pointer', display: 'inline-flex',
                                alignItems: 'center', gap: '3px',
                              }}
                            >
                              <History size={9} /> Recent
                            </button>
                          )}
                        </td>
                        {visible('discount_category') && (
                          <td style={{ padding: '6px 8px', fontSize: '11px' }}>
                            {(() => {
                              const catId = row.discount_category_id
                                || (row.item_id ? materialCategories[row.item_id]?.discountCategoryId : null)
                                || null;
                              const cat = catId ? categoryById[catId] : undefined;
                              if (!cat) return <span style={{ color: '#9ca3af' }}>—</span>;
                              return (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span
                                    title={`${cat.name}${cat.max_discount_percent != null ? ` (max ${cat.max_discount_percent}%)` : ''}`}
                                    style={{
                                      padding: '1px 6px', fontSize: '10px', fontWeight: 600, color: '#00476E',
                                      background: '#CCE5FF', borderRadius: '4px', whiteSpace: 'nowrap',
                                      overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 62,
                                    }}
                                  >
                                    {cat.name}
                                  </span>
                                  {row.is_override && (
                                    <span title="This line overrides the category discount" style={{ color: '#b45309', fontSize: '10px' }}>*</span>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        )}
                        {visible('discount_percent') && (
                          <td style={{ padding: '4px 8px' }}>
                            <input
                              type="number" step="0.01" min="0" max="100"
                              className="form-input"
                              style={{ ...sharedStyles.inputStyle, textAlign: 'right', border: errors[`row.${row._key}.discount_percent`] ? '1px solid #f43f5e' : undefined }}
                              value={row.discount_percent ?? 0}
                              onChange={(e) => updateRow(row._key, { discount_percent: parseFloat(e.target.value) || 0 })}
                            />
                          </td>
                        )}
                        {visible('rate_after_discount') && (
                          <td style={{ padding: '4px 8px', fontSize: '11px', textAlign: 'right', color: '#374151' }}>
                            {formatCurrency(calculateLineItem(row).net / (Number(row.qty) || 1))}
                          </td>
                        )}
                        {visible('tax_percent') && (
                          <td style={{ padding: '4px 8px' }}>
                            <select className="form-select" style={sharedStyles.inputStyle} value={row.tax_percent ?? 18} onChange={(e) => updateRow(row._key, { tax_percent: parseFloat(e.target.value) || 0 })}>
                              {TAX_OPTIONS.map(t => <option key={t} value={t}>{t}%</option>)}
                            </select>
                          </td>
                        )}
                        {visible('line_total') && (
                          <td style={{ padding: '8px 12px', fontSize: '11px', fontWeight: 700, textAlign: 'right' }}>
                            {formatCurrency(calculateLineItem(row).lineTotal)}
                          </td>
                        )}
                        <td style={{ padding: '4px' }}>
                          <div style={{ display: 'flex', gap: '2px', justifyContent: 'center' }}>
                            <button
                              type="button"
                              onClick={() => { setMoveToKey(row._key); setMoveToValue(''); setRowMenuKey(null); }}
                              style={{ padding: '4px', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
                              title="Move to S.No"
                            >
                              <ArrowUpDown size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setRowMenuKey(rowMenuKey === row._key ? null : row._key)}
                              style={{ padding: '4px', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer' }}
                              title="Row actions"
                            >
                              <MoreHorizontal size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => removeRow(row._key)}
                              style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
                              title="Delete row"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                          {rowMenuKey === row._key && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              style={{ position: 'absolute', zIndex: 60, background: '#fff', border: '1px solid #e2e8f0', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', minWidth: '170px', padding: '4px' }}
                            >
                              {[
                                { label: 'Add new row', icon: <Plus size={12} />, run: () => addRow(row._key) },
                                { label: 'Duplicate row', icon: <Copy size={12} />, run: () => duplicateRow(row._key) },
                                { label: 'Add section header', icon: <Heading size={12} />, run: () => addSectionHeader(row._key) },
                                { label: 'Add sub-total', icon: <Percent size={12} />, run: () => addSubtotal(row._key) },
                                { label: 'Add new row above', icon: <Plus size={12} />, run: () => {
                                  setRows(prev => {
                                    const i = prev.findIndex(r => r._key === row._key);
                                    if (i < 0) return prev;
                                    return [...prev.slice(0, i), blankRow(), ...prev.slice(i)];
                                  });
                                  setIsDirty(true);
                                } },
                              ].map(act => (
                                <button
                                  key={act.label}
                                  type="button"
                                  onClick={() => { act.run(); setRowMenuKey(null); }}
                                  style={{ display: 'flex', width: '100%', alignItems: 'center', gap: '6px', padding: '6px 8px', background: 'none', border: 'none', fontSize: '12px', color: '#374151', cursor: 'pointer', textAlign: 'left' }}
                                >
                                  {act.icon} {act.label}
                                </button>
                              ))}
                            </div>
                          )}
                        </td>
                      </SortableRow>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </SortableContext>
        </DndContext>
      </DocumentLineItemsSurface>

      {/* Bulk entry + attachment live below the line items. Notes has a single
          home in the Notes & Remarks card beside the totals, so it is not
          duplicated here. */}
      <div style={{ marginTop: '24px' }}>
        <HeaderCard icon={<Truck size={14} style={{ color: '#2563eb' }} />} title="Delivery & Notes">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <HeaderField label="Bulk Items" labelWidth="100px">
              <button
                type="button"
                onClick={() => setPickerOpen(true)}
                style={{ ...sharedStyles.inputStyle, display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', background: '#fff', textAlign: 'left' }}
              >
                <Package size={13} style={{ color: '#6b7280' }} />
                {stagedCount > 0
                  ? `${stagedCount} item${stagedCount === 1 ? '' : 's'} staged`
                  : 'Pick multiple materials'}
              </button>
            </HeaderField>
            <HeaderField label="Attachment" labelWidth="100px">
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px', cursor: 'pointer', background: '#fff' }}>
                  <Paperclip size={12} />
                  {attachment ? attachment.name : 'Attach'}
                  <input
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      if (f.size > MAX_ATTACHMENT_BYTES) {
                        toast.error('Attachment must be 10MB or smaller.');
                        return;
                      }
                      setAttachment(f);
                      setIsDirty(true);
                    }}
                  />
                </label>
                {(attachment || attachmentUrl) && (
                  <button
                    type="button"
                    onClick={() => { setAttachment(null); setAttachmentUrl(''); setIsDirty(true); }}
                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px' }}
                    aria-label="Remove attachment"
                  >
                    <X size={13} />
                  </button>
                )}
                {attachmentUrl && !attachment && (
                  <a href={attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#2563eb' }}>View</a>
                )}
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '10px', color: '#71717a' }}>Max 10MB</p>
            </HeaderField>
          </div>
        </HeaderCard>

      </div>

      <SummaryFooter
        rows={[
          { label: 'Subtotal', value: totals.subtotal },
          ...(totals.totalItemDiscount > 0 ? [{ label: 'Item Discount', value: -totals.totalItemDiscount }] : []),
          ...(totals.extraDiscountAmount > 0 ? [{ label: 'Additional Discount', value: -totals.extraDiscountAmount }] : []),
          { label: 'Taxable Value', value: totals.taxableAmount, bold: true },
          ...taxGroupRows.map(rate => {
            const g = totals.taxGroups[rate];
            return totals.isInterState
              ? { label: `IGST @ ${rate}%`, value: g.igst }
              : { label: `CGST @ ${rate / 2}%`, value: g.cgst };
          }),
          ...(totals.isInterState ? [] : taxGroupRows.map(rate => ({ label: `SGST @ ${rate / 2}%`, value: totals.taxGroups[rate].sgst }))),
          ...(roundOffEnabled && totals.roundOff !== 0 ? [{ label: 'Round Off', value: totals.roundOff }] : []),
        ]}
        grandTotal={{ label: 'Grand Total', amount: totals.grandTotal }}
        amountInWords={`${totals.amountInWords} (${formatCurrency(totals.grandTotal)})`}
      >
        {currency !== 'INR' && (
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', maxWidth: '400px', paddingTop: '6px', fontSize: '12px', color: '#4b5563' }}>
            <span>Total in INR</span>
            <span style={{ fontWeight: 600 }}>{formatCurrency(totalInr)}</span>
          </div>
        )}
      </SummaryFooter>

      {/* Notes & Terms below the totals, as a two-column block beside the
          summary. CreateQuotation puts these at index.tsx:2702-2720 in exactly
          this arrangement; V2 previously had Terms only, up in the header grid,
          and no Notes card at all. */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr) 300px', gap: '16px', marginTop: '4px' }}>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
            Notes &amp; Remarks
          </label>
          <textarea
            className="form-input"
            style={{ ...sharedStyles.inputStyle, width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
            placeholder="Enter internal notes or additional instructions..."
            value={internalNotes}
            onChange={(e) => { setInternalNotes(e.target.value); setIsDirty(true); }}
          />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151' }}>
              Terms &amp; Conditions
            </label>
            <button
              type="button"
              onClick={() => setTermsDrawerOpen(true)}
              style={{ padding: '4px 10px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#374151', fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}
            >
              Browse library
            </button>
          </div>
          <textarea
            className="form-input"
            style={{ ...sharedStyles.inputStyle, width: '100%', minHeight: '60px', resize: 'vertical', fontFamily: 'inherit', fontSize: '12px' }}
            placeholder="Payment terms, delivery conditions, warranty..."
            value={termsConditions}
            onChange={(e) => { setTermsConditions(e.target.value); setIsDirty(true); }}
          />
        </div>
        <div style={{ border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px', fontSize: '12px' }}>
          {/* Round-off lives with the total it affects (CreateQuotation puts its
              round-off beside the grand total), not in the Pricing card. */}
          <label
            title="Round the grand total to the nearest rupee. The difference shows as 'Round Off' in the totals."
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#374151', cursor: 'pointer', marginBottom: '8px', paddingBottom: '8px', borderBottom: '1px solid #f3f4f6' }}
          >
            <input type="checkbox" checked={roundOffEnabled} onChange={(e) => { setRoundOffEnabled(e.target.checked); setIsDirty(true); }} />
            Round off grand total
          </label>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 600, color: '#374151' }}>Grand Total</span>
            <span style={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(totals.grandTotal)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px', color: '#6b7280' }}>
            <span>Amount in words</span>
          </div>
          <p style={{ margin: '0 0 8px', fontSize: '11px', color: '#6b7280', lineHeight: 1.4, fontStyle: 'italic' }}>
            {totals.amountInWords}
          </p>
          {/* Authorized Signatory — CreateQuotation places this beside the
              Grand Total (index.tsx:2799-2850), not up in the header grid. */}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '6px' }}>
              Authorized Signatory
            </div>
            <div style={{ position: 'relative' }}>
              <div
                onClick={() => setSigDropdownOpen((v) => !v)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px',
                  background: '#fff', fontSize: '12px', fontWeight: 500, color: '#374151',
                  cursor: 'pointer',
                }}
              >
                <span>
                  {authorizedSignatoryId
                    ? signatures.find((s: any) => String(s.id) === String(authorizedSignatoryId))?.name || 'Select Signatory...'
                    : 'Select Signatory...'}
                </span>
                <ChevronDown size={14} style={{ color: '#6b7280', transform: sigDropdownOpen ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s' }} />
              </div>
              {sigDropdownOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 9000 }} onClick={() => setSigDropdownOpen(false)} />
                  <div style={{ position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: '4px', zIndex: 9001, background: '#fff', border: '1px solid #d1d5db', borderRadius: '6px', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                    <div
                      onClick={() => { setAuthorizedSignatoryId(''); setSigDropdownOpen(false); setIsDirty(true); }}
                      style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', fontWeight: 500 }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                    >
                      Select Signatory...
                    </div>
                    {signatures.length > 0 ? (
                      signatures.map((sig: any) => (
                        <div
                          key={String(sig.id)}
                          onClick={() => { setAuthorizedSignatoryId(String(sig.id)); setSigDropdownOpen(false); setIsDirty(true); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#eff6ff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}
                        >
                          {sig.name}
                        </div>
                      ))
                    ) : (
                      <div style={{ padding: '8px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No signatures uploaded</div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Activity timeline — purchase_audit_log, so it actually has rows. */}
      <div style={{ margin: '16px 0 8px', border: '1px solid #e5e7eb', borderRadius: '6px', overflow: 'hidden' }}>
        <button
          type="button"
          onClick={() => setShowActivity(v => !v)}
          style={{ width: '100%', padding: '10px 12px', background: '#f9fafb', border: 'none', display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', fontWeight: 600, color: '#374151' }}
        >
          <User size={14} style={{ color: '#6b7280' }} />
          Activity
          {activity.length > 0 && <span style={{ color: '#6b7280', fontWeight: 400 }}>({activity.length})</span>}
          <span style={{ marginLeft: 'auto', color: '#6b7280', fontWeight: 400 }}>{showActivity ? 'Hide' : 'Show'}</span>
        </button>
        {showActivity && (
          <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
            {!savedPoId ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                Save the purchase order to start its history.
              </div>
            ) : activity.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>
                No activity recorded yet.
              </div>
            ) : (
              (activity as PoAuditEntry[]).map((entry) => (
                <div key={entry.id} style={{ padding: '10px 12px', borderTop: '1px solid #f1f5f9', display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <User size={11} style={{ color: '#6b7280' }} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>
                        {poAuditActionLabel(entry.action)}
                      </span>
                      <span style={{ fontSize: '10px', color: '#9ca3af', whiteSpace: 'nowrap' }}>
                        {new Date(entry.created_at).toLocaleString('en-IN')}
                      </span>
                    </div>
                    {(entry.details as any)?.description && (
                      <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#6b7280' }}>
                        {(entry.details as any).description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Vendor delivery-address module (CreateQuotation's Shipping pattern) */}
      {shippingModalOpen && vendorId && (
        <AddVendorShippingAddressModal
          isOpen={shippingModalOpen}
          onClose={() => setShippingModalOpen(false)}
          vendorId={vendorId}
          onSuccess={(addr: any) => {
            setVendorAddresses((prev) => [...prev, addr]);
            setDeliveryLocation(formatVendorAddressBlock(addr));
            setIsDirty(true);
          }}
        />
      )}

      {/* Recent purchase history side panel (see poHistory.ts for the fetch contract) */}
      {historyMaterial && (
        <MaterialHistoryDrawer
          orgId={orgId}
          materialId={historyMaterial.id}
          materialName={historyMaterial.name}
          onClose={() => setHistoryMaterial(null)}
        />
      )}

      {/* Terms library — shared drawer, template flattened into the textarea.
          No quotationId is passed, so the drawer's onSave(template) path runs
          (the InvoiceEditor pattern); nothing is written to quotation tables. */}      {termsDrawerOpen && (
        <TermsConditionsDrawer
          isOpen={termsDrawerOpen}
          onClose={() => setTermsDrawerOpen(false)}
          onSave={(tpl: any) => {
            setTermsConditions(flattenTermsTemplate(tpl));
            setIsDirty(true);
            setTermsDrawerOpen(false);
          }}
        />
      )}

      {/* Material picker (V1 parity) */}
      {pickerOpen && (        <div
          onClick={() => setPickerOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10000 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ background: '#fff', borderRadius: '8px', width: '750px', maxWidth: '95vw', height: '80vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
          >
            <div style={{ padding: '14px 16px', borderBottom: '1px solid #e2e8f0' }}>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 700 }}>Select Materials</h3>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', flex: 1, minHeight: 0 }}>
              <div style={{ display: 'flex', flexDirection: 'column', borderRight: '1px solid #e2e8f0', minHeight: 0 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', position: 'relative' }}>
                  <Search size={13} style={{ position: 'absolute', left: 22, top: 20, color: '#94a3b8' }} />
                  <input
                    autoFocus
                    type="text"
                    value={pickerQuery}
                    onChange={(e) => setPickerQuery(e.target.value)}
                    placeholder="Search materials by name, HSN, or make..."
                    style={{ ...sharedStyles.inputStyle, paddingLeft: 24, width: '100%', border: '1px solid #d1d5db', borderRadius: '4px' }}
                  />
                </div>
                <div style={{ flex: 1, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                    <thead>
                      <tr style={{ background: '#f8fafc', position: 'sticky', top: 0 }}>
                        <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: '11px', fontWeight: 600 }}>Item</th>
                        <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: '11px', fontWeight: 600, width: 90 }}>Rate</th>
                        <th style={{ padding: '8px', width: 40 }} />
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMaterials.length === 0 && (
                        <tr><td colSpan={3} style={{ padding: '20px', textAlign: 'center', color: '#71717a' }}>No materials found.</td></tr>
                      )}
                      {filteredMaterials.map(m => {
                        const isStaged = !!staged[m.id];
                        return (
                          <tr
                            key={m.id}
                            onClick={() => !isStaged && stageMaterial(m)}
                            style={{
                              borderBottom: '1px solid #f8fafc',
                              background: isStaged ? '#f0fdf4' : '#fff',
                              cursor: isStaged ? 'default' : 'pointer',
                            }}
                          >
                            <td style={{ padding: '8px 12px' }}>
                              <div style={{ fontWeight: 500 }}>{m.display_name || m.name}</div>
                              <div style={{ fontSize: '10px', color: '#71717a' }}>
                                {[m.hsn_code, m.make].filter(Boolean).join(' | ')}
                              </div>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              {formatCurrency(defaultRateFor(m))}
                            </td>
                            <td style={{ padding: '8px', textAlign: 'center', color: isStaged ? '#16a34a' : '#2563eb' }}>
                              {isStaged ? '✓' : '+'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '10px 12px', borderBottom: '1px solid #f1f5f9', fontSize: '11px', fontWeight: 700 }}>
                  Selected Items ({stagedCount})
                </div>
                <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
                  {stagedCount === 0 && (
                    <p style={{ padding: '16px', fontSize: '11px', color: '#71717a', textAlign: 'center' }}>
                      No items selected. Click items on the left to add them here.
                    </p>
                  )}
                  {Object.entries(staged).map(([id, qty]) => {
                    const m = materials.find(x => x.id === id);
                    if (!m) return null;
                    return (
                      <div key={id} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', border: '1px solid #e2e8f0', borderRadius: '4px', marginBottom: '6px' }}>
                        <span style={{ flex: 1, fontSize: '11px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {m.display_name || m.name}
                        </span>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={qty}
                          onChange={(e) => setStaged(prev => ({ ...prev, [id]: Math.max(0.01, parseFloat(e.target.value) || 0.01) }))}
                          style={{ ...sharedStyles.inputStyle, width: 56, border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                        <button type="button" onClick={() => unstageMaterial(m)} style={{ background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer' }} aria-label="Remove">
                          <X size={13} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => { setPickerOpen(false); setStaged({}); }} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '13px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button
                type="button"
                onClick={commitStaged}
                disabled={stagedCount === 0}
                style={{ padding: '6px 14px', border: '1px solid #1e3a8a', borderRadius: '6px', background: '#1e3a8a', color: '#fff', fontSize: '13px', fontWeight: 600, cursor: stagedCount === 0 ? 'not-allowed' : 'pointer', opacity: stagedCount === 0 ? 0.5 : 1 }}
              >
                Add to Purchase Order ({stagedCount})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Move-to dialog (quotation row parity) */}
      {moveToKey && (
        <div
          onClick={() => { setMoveToKey(null); setMoveToValue(''); }}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10001 }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ background: '#fff', borderRadius: '8px', padding: '18px', width: 280 }}>
            <h4 style={{ margin: '0 0 4px', fontSize: '13px', fontWeight: 700 }}>Move to S.No</h4>
            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#71717a' }}>
              Enter a line number between 1 and {billableCount + 1}.
            </p>
            <input
              autoFocus
              type="number"
              min="1"
              max={billableCount + 1}
              value={moveToValue}
              onChange={(e) => setMoveToValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') confirmMoveTo();
                if (e.key === 'Escape') { setMoveToKey(null); setMoveToValue(''); }
              }}
              style={{ ...sharedStyles.inputStyle, width: '100%', border: '1px solid #d1d5db', borderRadius: '4px' }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
              <button type="button" onClick={() => { setMoveToKey(null); setMoveToValue(''); }} style={{ padding: '5px 12px', border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', fontSize: '12px', cursor: 'pointer' }}>
                Cancel
              </button>
              <button type="button" onClick={confirmMoveTo} style={{ padding: '5px 12px', border: '1px solid #1e3a8a', borderRadius: '4px', background: '#1e3a8a', color: '#fff', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                Move
              </button>
            </div>
          </div>
        </div>
      )}
    </DocumentEditorShell>
  );
}

function SortableRow({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <tr
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        borderBottom: '1px solid #f1f5f9',
      }}
      {...attributes}
      {...listeners}
    >
      {children}
    </tr>
  );
}
