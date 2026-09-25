/**
 * SalesOrderCreateV2 - Unified entry form for Sales Orders
 *
 * Uses shared document-editor components per quoteui design system.
 * Canonical create/edit form (variant + make pricing, editable discount column).
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../../supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useQuery } from '@tanstack/react-query';
import { Trash2, Plus, Save, Loader2, ArrowUp, ArrowDown, ChevronDown, MoreHorizontal } from 'lucide-react';
import { toast } from '../../lib/logger';
import { UnitDropdownSelect } from '../../components/UnitDropdownSelect';
import { SearchableItemSelect } from '../../components/SearchableItemSelect';
import { AddShippingAddressModal } from '../CreateQuotation/components/AddShippingAddressModal';
import { TermsConditionsDrawer } from '../../components/TermsConditionsDrawer';
import { numberToInrWords } from '../../pdf/numberToWords';

const SO_INTER = "'Inter', system-ui, sans-serif";
const SO_INK = '#0B1C30';
const SO_INK_MUTED = '#475569';
const SO_SURFACE_CONTAINER = '#E5EEFF';
const SO_BORDER_STRONG = '#CBD5E1';

const openDropdownAtRef = (ref: React.RefObject<any>, setStyle: (style: any) => void) => {
  if (ref.current) {
    const rect = ref.current.getBoundingClientRect();
    setStyle({
      position: 'fixed',
      top: `${rect.bottom + 4}px`,
      left: `${rect.left}px`,
      width: `${rect.width}px`,
      zIndex: 9999,
      background: '#fff',
      border: '1px solid #d4d4d4',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      maxHeight: '200px',
      overflowY: 'auto',
    });
  }
};

const SoMakeCell = ({ value, makes, onChange }: { value: string; makes: string[]; onChange: (make: string) => void }) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    if (open) {
      document.addEventListener('mousedown', handler);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        document.removeEventListener('mousedown', handler);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [open ]);

  return (
    <>
      <div
        ref={ref}
        onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }}
        style={{ padding: '3px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: SO_INTER, color: value ? SO_INK : '#94a3b8', fontWeight: value ? 500 : 400, background: value ? SO_SURFACE_CONTAINER : '#fff', border: '1px solid transparent', borderRadius: '4px', minHeight: '24px', display: 'inline-flex', alignItems: 'center', userSelect: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = SO_BORDER_STRONG; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {value || 'No Make'}
      </div>
      {open && (
        <div ref={listRef} style={{ ...(dropdownStyle as React.CSSProperties), borderRadius: '8px', overflow: 'hidden' }}>
          <div
            onClick={() => { onChange(''); setOpen(false); }}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
          >No Make</div>
          {makes.map((m) => (
            <div
              key={m}
              onClick={() => { onChange(m); setOpen(false); }}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >{m}</div>
          ))}
        </div>
      )}
    </>
  );
};

const SoVariantCell = ({ value, variants, itemId, variantPricing, onChange }: { value: string; variants: any[]; itemId: string; variantPricing: any; onChange: (val: string | null) => void }) => {
  const [open, setOpen] = useState(false);
  const [dropdownStyle, setDropdownStyle] = useState({});
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) && listRef.current && !listRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const handleScroll = () => setOpen(false);
    if (open) {
      document.addEventListener('mousedown', handler);
      window.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        document.removeEventListener('mousedown', handler);
        window.removeEventListener('scroll', handleScroll);
      };
    }
  }, [open]);

  const selected = variants.find((v) => v.id === value);
  const filtered = variants.filter((v) => {
    if (!itemId) return true;
    const itemVariants = variantPricing[itemId];
    return itemVariants && itemVariants[v.id];
  });

  return (
    <>
      <div
        ref={ref}
        onClick={() => { openDropdownAtRef(ref, setDropdownStyle); setOpen(true); }}
        style={{ padding: '4px 8px', cursor: 'pointer', fontSize: '11px', fontFamily: SO_INTER, color: value ? SO_INK_MUTED : '#94a3b8', fontWeight: value ? 500 : 400, background: '#fff', border: '1px solid transparent', borderRadius: '4px', minHeight: '28px', display: 'flex', alignItems: 'center', userSelect: 'none' }}
        onMouseEnter={(e) => { e.currentTarget.style.borderColor = SO_BORDER_STRONG; }}
        onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
      >
        {selected ? selected.variant_name : 'No Variant'}
      </div>
      {open && (
        <div ref={listRef} style={{ ...(dropdownStyle as React.CSSProperties), borderRadius: '8px', overflow: 'hidden' }}>
          <div
            onClick={() => { onChange(null); setOpen(false); }}
            style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', fontWeight: 400, color: '#94a3b8', borderBottom: '1px solid #f3f4f6' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#f3f4f6')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
          >No Variant</div>
          {filtered.map((v) => (
            <div
              key={v.id}
              onClick={() => { onChange(v.id); setOpen(false); }}
              style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: '#1e293b', borderBottom: '1px solid #f3f4f6' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'white')}
            >{v.variant_name}</div>
          ))}
        </div>
      )}
    </>
  );
};
import {
  DocumentActionBar,
  PrimaryButton,
  SecondaryButton,
  HeaderFormGrid,
  HeaderCard,
  HeaderField,
  CustomDatePicker,
  sharedStyles,
} from '../../components/document-editor';
import { User, FileText, Briefcase, Search } from 'lucide-react';
import { formatCurrency } from '../../utils/formatters';

interface LineItem {
  id?: string;
  item_id: string;
  variant_id?: string | null;
  make?: string;
  description: string;
  qty: number;
  uom: string;
  rate: number;
  discount_percent: number;
  tax_percent: number;
  line_total: number;
  hsn_code?: string;
  is_override?: boolean;
}

export default function SalesOrderCreateV2({ editMode = false }: { editMode?: boolean }) {
  const navigate = useNavigate();
  const { organisation, user } = useAuth();
  const orgId = organisation?.id;
  const preparedBy = (user as any)?.user_metadata?.full_name || (user as any)?.email?.split('@')[0] || '';
  const [searchParams] = useSearchParams();
  const quotationId = searchParams.get('quotationId');
  const editId = editMode ? searchParams.get('id') : null;

  const [saving, setSaving] = useState(false);
  const [soNo, setSoNo] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSearch, setClientSearch] = useState('');
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [clientPoId, setClientPoId] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [deliveryDate, setDeliveryDate] = useState('');
  const [billingAddress, setBillingAddress] = useState('');
  const [shippingAddress, setShippingAddress] = useState('');
  const [gstin, setGstin] = useState('');
  const [state, setState] = useState('');
  const [remarks, setRemarks] = useState('');
  const [contact, setContact] = useState('');
  const [payment, setPayment] = useState('Net 30 Days');
  const [quoteNo, setQuoteNo] = useState('');
  const [terms, setTerms] = useState('');
  const [authorizedSignatoryId, setAuthorizedSignatoryId] = useState('');
  const [showSignatoryMenu, setShowSignatoryMenu] = useState(false);
  const [extraDiscountPercent, setExtraDiscountPercent] = useState(0);
  const [extraDiscountAmount, setExtraDiscountAmount] = useState(0);
  const [roundOffEnabled, setRoundOffEnabled] = useState(true);
  const [manualRoundOff, setManualRoundOff] = useState(0);
  const [items, setItems] = useState<LineItem[]>([]);

  // --- Data queries -----------
  const { data: clients = [] } = useQuery({ queryKey: ['clients', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('clients').select('id, client_name, address1, address2, shipping_address, gstin, state').eq('organisation_id', orgId); return (data || []).map((c: any) => ({ ...c, billing_address: [c.address1, c.address2].filter(Boolean).join(', ') })); }, enabled: !!orgId });
  const { data: projects = [] } = useQuery({ queryKey: ['projects', orgId, clientId], queryFn: async () => { if (!orgId || !clientId) return []; const { data } = await supabase.from('projects').select('id, name').eq('organisation_id', orgId).eq('client_id', clientId); return data || []; }, enabled: !!orgId && !!clientId });
  const { data: materials = [] } = useQuery({ queryKey: ['materials', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('materials').select('id, name, item_code, unit, default_sale_price, hsn_code, gst_rate, discount_category_id').eq('organisation_id', orgId); return (data || []).map((m: any) => ({ ...m, code: m.item_code, uom: m.unit, default_sales_rate: m.default_sale_price })); }, enabled: !!orgId });

  const { data: clientMappings = [] } = useQuery({
    queryKey: ['so-client-mappings', orgId, clientId],
    queryFn: async () => {
      if (!orgId || !clientId) return [];
      const { data, error } = await supabase.from('material_client_mappings').select('material_id, company_variant_id, client_part_no, client_description').eq('organisation_id', orgId).eq('client_id', clientId);
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId && !!clientId,
  });
  const mappingMap = useMemo(() => {
    const m: Record<string, any> = {};
    (clientMappings || []).forEach((r: any) => { m[`${r.material_id}::${r.company_variant_id || ''}`] = r; });
    return m;
  }, [clientMappings]);
  const getMapping = (itemId: string, variantId: string | null) =>
    mappingMap[`${itemId}::${variantId || ''}`] || mappingMap[`${itemId}::`] || null;

  const { data: discountCats = [] } = useQuery({
    queryKey: ['so-discount-cats', orgId],
    queryFn: async () => {
      if (!orgId) return [];
      const { data, error } = await supabase.from('discount_categories').select('id, name, default_discount_percent').eq('organisation_id', orgId).eq('is_active', true);
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId,
  });
  const catMap = useMemo(() => {
    const m: Record<string, string> = {};
    (discountCats || []).forEach((c: any) => { m[c.id] = c.name; });
    return m;
  }, [discountCats]);
  const { data: variants = [] } = useQuery({ queryKey: ['variants', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('company_variants').select('*').eq('organisation_id', orgId).eq('is_active', true).order('variant_name'); return data || []; }, enabled: !!orgId });
  const { data: variantPricingList = [] } = useQuery({ queryKey: ['variant-pricing', orgId], queryFn: async () => { if (!orgId) return []; const { data } = await supabase.from('item_variant_pricing').select('item_id, company_variant_id, sale_price, make').eq('organisation_id', orgId); return data || []; }, enabled: !!orgId });

  const pricingMap = useMemo(() => { const pricing: Record<string, Record<string, Record<string, number>>> = {}; variantPricingList.forEach((row: any) => { const itemId = row.item_id; const variantId = row.company_variant_id || 'no_variant'; const make = row.make || ''; if (!pricing[itemId]) pricing[itemId] = {}; if (!pricing[itemId][variantId]) pricing[itemId][variantId] = {}; pricing[itemId][variantId][make] = parseFloat(row.sale_price) || 0; }); return pricing; }, [variantPricingList]);
  const itemMakesMap = useMemo(() => { const makesMap: Record<string, string[]> = {}; variantPricingList.forEach((row: any) => { const make = row.make; if (make) { if (!makesMap[row.item_id]) makesMap[row.item_id] = []; if (!makesMap[row.item_id].includes(make)) makesMap[row.item_id].push(make); } }); return makesMap; }, [variantPricingList]);

  const getRateForMaterialVariant = (itemId: string, variantId: string | null, make: string) => {
    if (!itemId) return 0;
    const vId = variantId || 'no_variant';
    const mName = make || '';
    const itemPricing = pricingMap[itemId] || {};
    const variantPricing = itemPricing[vId] || {};
    if (variantPricing[mName] !== undefined) return variantPricing[mName];
    if (mName) { for (const v in itemPricing) { if (itemPricing[v][mName] !== undefined) return itemPricing[v][mName]; } }
    const mat = materials.find((m: any) => m.id === itemId);
    return mat?.default_sales_rate || 0;
  };

  // --- Effects ----------------
  useEffect(() => { const handleOutsideClick = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('.client-dropdown-container')) setIsClientDropdownOpen(false); }; document.addEventListener('mousedown', handleOutsideClick); return () => document.removeEventListener('mousedown', handleOutsideClick); }, []);

  useEffect(() => { if (!clientId) return; const client = clients.find((c: any) => c.id === clientId); if (client) { setBillingAddress(client.billing_address || ''); setShippingAddress(client.shipping_address || ''); setGstin(client.gstin || ''); setState(client.state || ''); } }, [clientId, clients]);

  useEffect(() => {
    if (!quotationId || !orgId) return;
    const loadQuotation = async () => {
      const { data: quote } = await supabase.from('quotation_header').select('*').eq('id', quotationId).single();
      if (!quote) { toast.error('Failed to load quotation'); return; }
      setClientId(quote.client_id || ''); setProjectId(quote.project_id || ''); setBillingAddress(quote.billing_address || ''); setShippingAddress(quote.shipping_address || '');       setGstin(quote.gstin || ''); setState(quote.state || ''); setRemarks(quote.remarks || ''); setQuoteNo(quote.quotation_no || '');
      setContact(quote.client_contact || quote.contact_no || '');
      setPayment(quote.payment_terms || 'Net 30 Days');
      setAuthorizedSignatoryId(quote.authorized_signatory_id || '');
      try {
        const { data: quoteTerms } = await supabase.from('quotation_terms_conditions').select('custom_content').eq('quotation_id', quotationId).maybeSingle();
        const raw = (quoteTerms as any)?.custom_content;
        if (raw) {
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const flat = flattenTermsTemplate(parsed);
          if (flat) setTerms(flat);
        }
      } catch { /* terms prefill is best-effort */ }
      const { data: quoteItems } = await supabase.from('quotation_items').select('*').eq('quotation_id', quotationId).order('display_order', { ascending: true });
      if (quoteItems) setItems(quoteItems
        .filter((qi: any) => !qi.is_header && !qi.is_subtotal && (qi.description || qi.item_id || qi.qty))
        .map((qi: any) => ({
          item_id: qi.item_id || '',
          variant_id: qi.variant_id || null,
          make: qi.make || '',
          description: qi.description || '',
          qty: parseFloat(qi.qty) || 0,
          uom: qi.uom || 'nos',
          rate: parseFloat(qi.base_rate_snapshot) || parseFloat(qi.rate) || 0,
          discount_percent: parseFloat(qi.discount_percent) || 0,
          tax_percent: parseFloat(qi.tax_percent) || 0,
          line_total: 0,
          hsn_code: qi.hsn_code || '',
        })));
    };
    loadQuotation();
  }, [quotationId, orgId]);

  useEffect(() => { if (!orgId || editMode) return; const getSoNumber = async () => { const { data, error } = await supabase.rpc('generate_sales_order_no', { p_org_id: orgId }); if (!error && data) setSoNo(data); }; getSoNumber(); }, [orgId, editMode]);

  useEffect(() => {
    if (!editId || !orgId) return;
    const loadOrder = async () => {
      const { data: so, error } = await supabase
        .from('sales_orders')
        .select('*')
        .eq('id', editId)
        .eq('organisation_id', orgId)
        .single();
      if (error || !so) { toast.error('Failed to load sales order'); return; }
      if (so.status === 'cancelled') { toast.error('Cancelled orders cannot be edited'); return; }
      setSoNo(so.sales_order_no || '');
      setClientId(so.client_id || '');
      setProjectId(so.project_id || '');
      setClientPoId(so.client_po_id || '');
      setOrderDate(so.order_date || new Date().toISOString().split('T')[0]);
      setDeliveryDate(so.delivery_date || '');
      setBillingAddress(so.billing_address || '');
      setShippingAddress(so.shipping_address || '');
      setGstin(so.gstin || '');
      setState(so.state || '');
      setRemarks(so.remarks || '');
      setTerms((so as any).terms_conditions || '');
      setAuthorizedSignatoryId((so as any).authorized_signatory_id || '');
      setQuoteNo((so as any).quotation_no || '');
      const { data: soItems } = await supabase
        .from('sales_order_items')
        .select('*, item:materials(hsn_code)')
        .eq('sales_order_id', editId)
        .order('created_at', { ascending: true });
      if (soItems) setItems(soItems.map((r: any) => ({
        id: r.id,
        item_id: r.item_id || '',
        variant_id: r.variant_id || null,
        make: r.make || '',
        description: r.description || '',
        qty: parseFloat(r.qty) || 0,
        uom: r.uom || 'nos',
        rate: parseFloat(r.rate) || 0,
        discount_percent: parseFloat(r.discount_percent) || 0,
        tax_percent: parseFloat(r.tax_percent) || 0,
        line_total: parseFloat(r.line_total) || 0,
        hsn_code: r.item?.hsn_code || '',
      })));
    };
    loadOrder();
  }, [editId, orgId]);

  const orgState = ((organisation as any)?.state || '') as string;
  useEffect(() => { setSelectedShipAddrId(''); setClientPoId(''); }, [clientId]);
  const isInterState = state.trim() !== '' && orgState.trim() !== '' && state.trim().toLowerCase() !== orgState.trim().toLowerCase();
  const signatures: any[] = ((organisation as any)?.signatures || []) as any[];
  const selectedSignatory = signatures.find((s: any) => s.id === authorizedSignatoryId) || null;

  const totals = useMemo(() => {
    let subtotal = 0, itemDiscountTotal = 0, itemTax = 0;
    items.forEach((item) => {
      const gross = (parseFloat(String(item.qty)) || 0) * (parseFloat(String(item.rate)) || 0);
      const disc = gross * ((parseFloat(String(item.discount_percent)) || 0) / 100);
      const lineSubtotal = gross - disc;
      const lineTax = lineSubtotal * ((parseFloat(String(item.tax_percent)) || 0) / 100);
      const lineTotal = lineSubtotal + lineTax;
      item.line_total = parseFloat(lineTotal.toFixed(2));
      subtotal += lineSubtotal; itemDiscountTotal += disc; itemTax += lineTax;
    });
    const extraAmt = extraDiscountPercent > 0 ? subtotal * (extraDiscountPercent / 100) : (parseFloat(String(extraDiscountAmount)) || 0);
    const taxable = subtotal - extraAmt;
    const cgst = !isInterState ? itemTax / 2 : 0;
    const sgst = !isInterState ? itemTax / 2 : 0;
    const igst = isInterState ? itemTax : 0;
    const baseTotal = taxable + itemTax;
    const roundOff = roundOffEnabled ? parseFloat((Math.round(baseTotal) - baseTotal).toFixed(2)) : (parseFloat(String(manualRoundOff)) || 0);
    const grandTotal = parseFloat((baseTotal + roundOff).toFixed(2));
    return {
      subtotal: parseFloat(subtotal.toFixed(2)),
      itemDiscountTotal: parseFloat(itemDiscountTotal.toFixed(2)),
      extraDiscountAmount: parseFloat(extraAmt.toFixed(2)),
      taxable: parseFloat(taxable.toFixed(2)),
      itemTax: parseFloat(itemTax.toFixed(2)),
      cgst: parseFloat(cgst.toFixed(2)),
      sgst: parseFloat(sgst.toFixed(2)),
      igst: parseFloat(igst.toFixed(2)),
      roundOff,
      grandTotal,
      amountInWords: numberToInrWords(grandTotal),
    };
  }, [items, extraDiscountPercent, extraDiscountAmount, roundOffEnabled, manualRoundOff, isInterState]);

  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hoveredRow, setHoveredRow] = useState<number | null>(null);
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [showShipModal, setShowShipModal] = useState(false);
  const [selectedShipAddrId, setSelectedShipAddrId] = useState('');
  const [pricingRules, setPricingRules] = useState<Record<string, number>>({});
  const [openMenu, setOpenMenu] = useState<number | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [showColumnSettings, setShowColumnSettings] = useState(false);
  const [showTermsDrawer, setShowTermsDrawer] = useState(false);
  const [colVis, setColVis] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem(`so-column-settings`);
      if (raw) return { hsn: true, part_no: true, client_desc: true, variant: true, make: true, description: true, disc: true, tax: true, ...JSON.parse(raw) };
    } catch { /* keep defaults */ }
    return { hsn: true, part_no: true, client_desc: true, variant: true, make: true, description: true, disc: true, tax: true };
  });
  const setColVisPersist = (next: Record<string, boolean>) => {
    setColVis(next);
    try { localStorage.setItem(`so-column-settings`, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const visibleColCount = 9 + (colVis.hsn ? 1 : 0) + (colVis.part_no ? 1 : 0) + (colVis.client_desc ? 1 : 0) + (colVis.variant ? 1 : 0) + (colVis.make ? 1 : 0) + (colVis.description ? 1 : 0) + (colVis.disc ? 1 : 0) + (colVis.tax ? 1 : 0);

  const { data: clientPOs = [] } = useQuery({
    queryKey: ['so-client-pos', orgId, clientId],
    queryFn: async () => {
      if (!orgId || !clientId) return [];
      const { data, error } = await supabase
        .from('client_purchase_orders')
        .select('id, po_number, po_date, status')
        .eq('organisation_id', orgId)
        .eq('client_id', clientId)
        .order('po_date', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId && !!clientId,
  });
  const selectedClientPO = (clientPOs || []).find((p: any) => p.id === clientPoId) || null;

  const filteredPickerMaterials = useMemo(() => {
    const search = itemSearch.trim().toLowerCase();
    return (materials || []).filter((m: any) =>
      !search ||
      m.name?.toLowerCase().includes(search) ||
      m.item_code?.toLowerCase().includes(search) ||
      m.display_name?.toLowerCase().includes(search)
    );
  }, [materials, itemSearch]);

  const { data: pickerStock = {} } = useQuery({
    queryKey: ['so-picker-stock', orgId, showItemPicker],
    queryFn: async () => {
      if (!orgId || !showItemPicker) return {};
      const ids = (materials || []).map((m: any) => m.id).filter(Boolean);
      if (ids.length === 0) return {};
      const { data, error } = await supabase.from('item_stock').select('item_id, current_stock').in('item_id', ids);
      if (error) return {};
      const map: Record<string, number> = {};
      (data || []).forEach((s: any) => { map[s.item_id] = (map[s.item_id] || 0) + (parseFloat(s.current_stock) || 0); });
      return map;
    },
    enabled: !!orgId && showItemPicker,
  });

  const handleAddItemToPicker = (material: any) => {
    const existing = pickerItems.find((i) => i.item_id === material.id);
    if (existing) {
      setPickerItems(pickerItems.map((i) => (i.item_id === material.id ? { ...i, qty: (parseFloat(i.qty) || 0) + 1 } : i)));
    } else {
      setPickerItems([...pickerItems, {
        item_id: material.id,
        material,
        qty: 1,
        rate: getRateForMaterialVariant(material.id, null, ''),
        uom: material.unit || 'nos',
        tax_percent: material.gst_rate || 0,
        discount_percent: 0,
        description: '',
      }]);
    }
  };
  const handlePickerQtyChange = (itemId: string, value: string) => {
    const num = parseFloat(value) || 1;
    setPickerItems(pickerItems.map((i) => (i.item_id === itemId ? { ...i, qty: Math.max(1, num) } : i)));
  };
  const handleRemoveFromPicker = (itemId: string) => {
    setPickerItems(pickerItems.filter((i) => i.item_id !== itemId));
  };
  const handleAddPickerToOrder = () => {
    const newRows = pickerItems.map((p) => ({
      item_id: p.item_id,
      variant_id: null,
      make: '',
      description: p.description || p.material?.display_name || p.material?.name || '',
      qty: p.qty,
      uom: p.uom || 'nos',
      rate: p.rate || 0,
      discount_percent: 0,
      tax_percent: p.tax_percent || 0,
      line_total: 0,
      hsn_code: p.material?.hsn_code || '',
    }));
    setItems([...items, ...newRows]);
    setPickerItems([]);
    setShowItemPicker(false);
    setItemSearch('');
    setSelectedRows(new Set());
  };

  const { data: shipAddresses = [], refetch: refetchShipAddresses } = useQuery({
    queryKey: ['so-ship-addresses', orgId, clientId],
    queryFn: async () => {
      if (!orgId || !clientId) return [];
      const { data, error } = await supabase
        .from('client_shipping_addresses')
        .select('*')
        .eq('organisation_id', orgId)
        .eq('client_id', clientId)
        .order('is_default', { ascending: false });
      if (error) return [];
      return data || [];
    },
    enabled: !!orgId && !!clientId,
  });
  const formatShipAddress = (a: any) =>
    [a.address_line1, a.address_line2, a.city, a.state, a.pincode, a.country].filter(Boolean).join(', ');

  const applyPricingRule = (categoryId: string, discountVal: number) => {
    setItems((prev) => prev.map((row) => {
      const mat = materials.find((m: any) => m.id === row.item_id);
      if (!mat || mat.discount_category_id !== categoryId) return row;
      if (row.is_override) return row;
      return { ...row, discount_percent: discountVal, is_override: false };
    }));
  };

  const flattenTermsTemplate = (t: any) => {
    const sections = t?.sections || [];
    return sections.map((s: any) => {
      const head = s.title || '';
      const body = (s.items || []).map((it: any, idx: number) =>
        it.item_type === 'number' ? `${idx + 1}. ${it.content}` : `- ${it.content}`
      ).join('\n');
      return head ? `${head}\n${body}` : body;
    }).filter(Boolean).join('\n\n');
  };

  const addLineItem = () => { setItems([...items, { item_id: '', variant_id: null, make: '', description: '', qty: 1, uom: 'nos', rate: 0, discount_percent: 0, tax_percent: 18, line_total: 0 }]); setSelectedRows(new Set()); };
  const removeLineItem = (index: number) => { setItems(items.filter((_, i) => i !== index)); setSelectedRows(new Set()); };
  const insertRowBelow = (index: number) => {
    const blank = { item_id: '', variant_id: null, make: '', description: '', qty: 1, uom: 'nos', rate: 0, discount_percent: 0, tax_percent: 18, line_total: 0 };
    setItems([...items.slice(0, index + 1), blank, ...items.slice(index + 1)]);
    setSelectedRows(new Set());
  };
  const moveRow = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= items.length) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(to, 0, row);
    setItems(next);
    setSelectedRows(new Set());
  };
  const moveRowTo = (index: number, to: number) => {
    const clamped = Math.max(0, Math.min(items.length - 1, to));
    if (clamped === index) return;
    const next = [...items];
    const [row] = next.splice(index, 1);
    next.splice(clamped, 0, row);
    setItems(next);
    setSelectedRows(new Set());
    setOpenMenu(null);
  };
  const toggleRowSelect = (index: number) => {
    setSelectedRows((prev) => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; });
  };
  const toggleSelectAll = () => {
    setSelectedRows((prev) => (prev.size === items.length && items.length > 0 ? new Set() : new Set(items.map((_, i) => i))));
  };
  const deleteSelectedRows = () => {
    if (selectedRows.size === 0) return;
    setItems(items.filter((_, i) => !selectedRows.has(i)));
    setSelectedRows(new Set());
  };
  const updateLineItem = (index: number, patch: Partial<LineItem>) => {
    setItems(items.map((item, i) => { if (i !== index) return item; const next = { ...item, ...patch }; if (patch.item_id) { const mat = materials.find((m: any) => m.id === patch.item_id); if (mat) { next.uom = mat.uom || 'nos'; next.variant_id = null; next.make = ''; next.rate = mat.default_sales_rate || 0; next.hsn_code = mat.hsn_code || ''; if (mat.gst_rate !== null && mat.gst_rate !== undefined) next.tax_percent = parseFloat(mat.gst_rate) || 0; } } if ((patch as any).discount_percent !== undefined) next.is_override = true; return next; }));
  };

  const handleUpdate = async () => {
    const { error: headErr } = await supabase.from('sales_orders').update({
      client_id: clientId,
      project_id: projectId || null,
      client_po_id: clientPoId || null,
      order_date: orderDate,
      delivery_date: deliveryDate || null,
      billing_address: billingAddress,
      shipping_address: shippingAddress,
      gstin,
      state,
      remarks,
      terms_conditions: terms || null,
      authorized_signatory_id: authorizedSignatoryId || null,
      subtotal: totals.subtotal,
      tax_amount: totals.itemTax,
      grand_total: totals.grandTotal,
    }).eq('id', editId);
    if (headErr) throw headErr;
    const { data: existing } = await supabase.from('sales_order_items').select('id').eq('sales_order_id', editId);
    const existingIds = new Set((existing || []).map((r: any) => r.id));
    const keepIds = new Set(items.filter((i: any) => (i as any).id).map((i: any) => (i as any).id));
    const removed = [...existingIds].filter((x) => !keepIds.has(x));
    if (removed.length > 0) {
      await supabase.from('sales_order_reservations').delete().in('sales_order_item_id', removed);
      const { error: delErr } = await supabase.from('sales_order_items').delete().in('id', removed);
      if (delErr) throw delErr;
    }
    for (const item of items) {
      if ((item as any).id) {
        const { id: _drop, hsn_code: _h, is_override: _o, ...fields } = item as any;
        const { error } = await supabase
          .from('sales_order_items')
          .update({ ...fields, variant_id: item.variant_id || null, make: item.make || null })
          .eq('id', (item as any).id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('sales_order_items').insert({
          sales_order_id: editId,
          item_id: item.item_id,
          variant_id: item.variant_id || null,
          make: item.make || null,
          description: item.description,
          qty: item.qty,
          uom: item.uom,
          rate: item.rate,
          discount_percent: item.discount_percent,
          tax_percent: item.tax_percent,
          line_total: item.line_total,
        });
        if (error) throw error;
      }
    }
    supabase.from('sales_order_activity_log').insert({
      organisation_id: orgId,
      sales_order_id: editId,
      event_type: 'edited',
      summary: { sales_order_no: soNo, total: totals.grandTotal },
      created_by: (user as any)?.id || null,
    }).then(({ error }: any) => { if (error) console.warn('SO activity log write failed:', error.message); });
    toast.success('Sales Order updated successfully');
    navigate('/sales-orders');
  };

  const handleSave = async () => {
    if (!orgId) return;
    if (!clientId) { toast.error('Please select a client'); return; }
    if (items.length === 0) { toast.error('Please add at least one line item'); return; }
    if (items.some((item) => !item.item_id || item.qty <= 0 || item.rate <= 0)) { toast.error('All line items must have a valid product, quantity, and rate'); return; }
    try {
      setSaving(true);
      if (editId) { await handleUpdate(); return; }
      const soHeader = { sales_order_no: soNo, client_id: clientId, project_id: projectId || null, quotation_id: quotationId || null, quotation_no: quoteNo || null, converted_at: quotationId ? new Date().toISOString() : null, client_po_id: clientPoId || null, order_date: orderDate, delivery_date: deliveryDate || null, billing_address: billingAddress, shipping_address: shippingAddress, gstin, state, remarks, terms_conditions: terms || null, authorized_signatory_id: authorizedSignatoryId || null, subtotal: totals.subtotal, tax_amount: totals.itemTax, grand_total: totals.grandTotal, status: 'draft', organisation_id: orgId };
      const { data: savedSo, error: soError } = await supabase.from('sales_orders').insert(soHeader).select().single();
      if (soError || !savedSo) throw soError;
      const soItems = items.map((item) => ({ sales_order_id: savedSo.id, item_id: item.item_id, variant_id: item.variant_id || null, make: item.make || null, description: item.description, qty: item.qty, uom: item.uom, rate: item.rate, discount_percent: item.discount_percent, tax_percent: item.tax_percent, line_total: item.line_total }));
      const { error: itemsError } = await supabase.from('sales_order_items').insert(soItems);
      if (itemsError) throw itemsError;
      supabase.from('sales_order_activity_log').insert({
        organisation_id: orgId,
        sales_order_id: savedSo.id,
        event_type: 'created',
        summary: {
          sales_order_no: soNo,
          total: totals.grandTotal,
          ...(quotationId ? { converted_from_quotation: quotationId, quotation_no: quoteNo || null } : {}),
        },
        created_by: (user as any)?.id || null,
      }).then(({ error }: any) => { if (error) console.warn('SO activity log write failed:', error.message); });
      if (quotationId) {
        supabase.from('quotation_activity_log').insert({
          organisation_id: orgId,
          quotation_id: quotationId,
          event_type: 'converted',
          summary: { sales_order_id: savedSo.id, sales_order_no: soNo, total: totals.grandTotal },
          created_by: (user as any)?.id || null,
        }).then(({ error }: any) => { if (error) console.warn('Quotation activity log write failed:', error.message); });
      }
      toast.success('Sales Order created successfully');
      navigate('/sales-orders');
    } catch (err: any) { toast.error(err.message || 'Failed to save Sales Order'); } finally { setSaving(false); }
  };

  const selectedClient = clients.find((c: any) => c.id === clientId);
  const filteredClients = clients.filter((c: any) => !clientSearch || c.client_name.toLowerCase().includes(clientSearch.toLowerCase()));

  return (
    <div className="quotation-root" style={{ background: '#f8fafc', minHeight: '100%', margin: 0, padding: '0 0 24px 0' }}>
      <div className="flex items-center justify-between sticky top-0 z-40 border-b border-zinc-200 bg-white" style={{ top: 0, margin: 0, padding: '14px 24px', backgroundColor: '#ffffff', boxShadow: '0 1px 3px 0 rgba(0,0,0,0.05)' }}>
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-zinc-900 tracking-tight">{editMode ? 'Edit Sales Order' : 'Create Sales Order'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => navigate('/sales-orders')} disabled={saving} className="h-9 px-10 min-w-[100px] rounded text-xs font-bold text-zinc-600 hover:text-zinc-900 transition-colors">Cancel</button>
          <button type="button" onClick={handleSave} disabled={saving} style={{ height: '36px', padding: '0 40px', minWidth: '100px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500 }} onMouseEnter={(e) => (e.currentTarget.style.background = '#0C447C')} onMouseLeave={(e) => (e.currentTarget.style.background = '#185FA5')}>{saving ? 'Saving...' : 'Confirm & Save'}</button>
        </div>
      </div>

      <div style={{ background: '#f8fafc', padding: '16px 24px 24px 24px', minHeight: 'calc(100vh - 96px)' }}>
        <HeaderFormGrid columns={3}>
          {/* Card 1: Client */}
          <HeaderCard icon={<User size={14} style={{ color: '#2563eb' }} />} title="Client">
            <HeaderField label="Client" required labelWidth="95px">
              <div style={{ position: 'relative' }} className="client-dropdown-container">
                <input type="text" className="form-input" style={sharedStyles.inputStyle} placeholder="Search Client..." value={clientSearch || (clientId ? clients.find((c: any) => c.id === clientId)?.client_name : '') || ''} onChange={(e) => { setClientSearch(e.target.value); setIsClientDropdownOpen(true); }} onFocus={() => setIsClientDropdownOpen(true)} />
                {isClientDropdownOpen && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 50, background: 'white', border: '1px solid #d1d5db', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)', maxHeight: '200px', overflowY: 'auto' }}>
                    {filteredClients.map((c: any) => <div key={c.id} style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6' }} onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')} onMouseLeave={(e) => (e.currentTarget.style.background = 'white')} onClick={() => { setClientId(c.id); setClientSearch(''); setIsClientDropdownOpen(false); }}>{c.client_name}</div>)}
                    {filteredClients.length === 0 && <div style={{ padding: '6px 12px', fontSize: '11px', color: '#9ca3af', fontStyle: 'italic', textAlign: 'center' }}>No clients found</div>}
                  </div>
                )}
              </div>
            </HeaderField>
            <HeaderField label="Contact:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" /></HeaderField>
            <HeaderField label="Address:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'pre-wrap', minHeight: '32px', lineHeight: 1.4 }}>{billingAddress || '-'}</div></HeaderField>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151' }}>Shipping:</span>
              <select className="form-select" style={{ ...sharedStyles.inputStyle, flex: 1, minWidth: 0 }} value={selectedShipAddrId} onChange={(e) => {
                const id = e.target.value;
                setSelectedShipAddrId(id);
                const addr = (shipAddresses || []).find((a: any) => a.id === id);
                if (addr) setShippingAddress(formatShipAddress(addr));
              }}>
                <option value="">Select saved address...</option>
                {(shipAddresses || []).map((a: any) => (
                  <option key={a.id} value={a.id}>{a.address_name || formatShipAddress(a).slice(0, 40)}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowShipModal(true)}
                disabled={!clientId}
                title="Add shipping address"
                style={{ width: '28px', height: '28px', flexShrink: 0, border: '1px solid #d1d5db', borderRadius: '4px', background: '#fff', color: '#2563eb', fontSize: '16px', fontWeight: 600, cursor: clientId ? 'pointer' : 'not-allowed', opacity: clientId ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={(e) => { if (clientId) { e.currentTarget.style.background = '#eff6ff'; e.currentTarget.style.borderColor = '#2563eb'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; e.currentTarget.style.borderColor = '#d1d5db'; }}
              >+</button>
            </div>
            <HeaderField label="" labelWidth="95px"><textarea className="form-input" style={{ ...sharedStyles.inputStyle, minHeight: '52px', resize: 'vertical', lineHeight: 1.5, whiteSpace: 'pre-line' }} value={shippingAddress} onChange={(e) => setShippingAddress(e.target.value)} placeholder="Shipping address" /></HeaderField>
            <HeaderField label="GSTIN:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={gstin} onChange={(e) => setGstin(e.target.value)} placeholder="27AABCU9603R1ZX" /></HeaderField>
          </HeaderCard>

          {/* Card 2: Document */}
          <HeaderCard icon={<FileText size={14} style={{ color: '#2563eb' }} />} title="Document">
            <HeaderField label="SO No:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{soNo || 'Auto-generating...'}</div></HeaderField>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
              <span style={{ minWidth: '95px', maxWidth: '95px', fontWeight: 600, fontSize: '11px', color: '#374151', whiteSpace: 'nowrap' }}>Date:</span>
              <div style={{ flex: 1, display: 'flex', gap: '6px', flexWrap: 'nowrap', minWidth: '0px' }}>
                <div style={{ flex: '1 1 0%', minWidth: '0px' }}><CustomDatePicker value={orderDate} onChange={setOrderDate} /></div>
                <div style={{ flex: '1 1 0%', minWidth: '0px' }}><CustomDatePicker value={deliveryDate} onChange={setDeliveryDate} minDate={orderDate} /></div>
              </div>
            </div>
            <HeaderField label="Client PO:" labelWidth="95px">
              <select className="form-select" style={sharedStyles.inputStyle} value={clientPoId} onChange={(e) => setClientPoId(e.target.value)}>
                <option value="">Select client PO...</option>
                {(clientPOs || []).map((p: any) => (
                  <option key={p.id} value={p.id}>{p.po_number}{p.po_date ? ` - ${p.po_date}` : ''}{p.status ? ` (${p.status})` : ''}</option>
                ))}
              </select>
            </HeaderField>
            <HeaderField label="PO Date:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{selectedClientPO?.po_date || '-'}</div></HeaderField>
            <HeaderField label="Payment:" labelWidth="95px"><input type="text" className="form-input" style={sharedStyles.inputStyle} value={payment} onChange={(e) => setPayment(e.target.value)} placeholder="Net 30 Days" /></HeaderField>
            <HeaderField label="Prepared By:" labelWidth="95px"><div style={{ ...sharedStyles.inputStyle, background: '#f3f4f6', border: '1px solid transparent', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{preparedBy || '-'}</div></HeaderField>
          </HeaderCard>

          {/* Card 3: Project */}
          <HeaderCard icon={<Briefcase size={14} style={{ color: '#2563eb' }} />} title="Project">
            <HeaderField label="Project:" labelWidth="95px"><select className="form-select" style={sharedStyles.inputStyle} value={projectId} onChange={(e) => setProjectId(e.target.value)}><option value="">Select project...</option>{projects.map((p: any) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></HeaderField>
            <div style={{ marginTop: '4px', flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontWeight: 600, fontSize: '11px', color: '#2563eb', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>Pricing Rules (Discount Categories)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                {(discountCats as any[]).length > 0 ? (discountCats as any[]).map((dc: any) => (
                  <div key={dc.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'white', padding: '5px 8px', fontSize: '11px', border: '1px solid #e5e7eb', borderRadius: '4px', minHeight: '32px' }}>
                    <span style={{ fontWeight: 600, color: '#374151', fontSize: '11px', flex: '1 1 auto', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{dc.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                      <input
                        type="number"
                        style={{ width: '42px', padding: '3px 4px', fontSize: '11px', fontWeight: 700, textAlign: 'right', border: '1px solid #d1d5db', borderRadius: '3px' }}
                        value={pricingRules[dc.id] ?? dc.default_discount_percent ?? 0}
                        onChange={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); setPricingRules((prev) => ({ ...prev, [dc.id]: val })); }}
                        onBlur={(e) => { const val = Math.max(0, Math.min(100, parseFloat(e.target.value) || 0)); applyPricingRule(dc.id, val); }}
                        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        min="0" max="100" step="0.01"
                      />
                      <span style={{ fontSize: '11px', color: '#6b7280', fontWeight: 600 }}>%</span>
                    </div>
                  </div>
                )) : <div style={{ fontSize: '11px', color: '#9ca3af', fontStyle: 'italic' }}>No discount categories configured.</div>}
              </div>
            </div>
          </HeaderCard>
        </HeaderFormGrid>

        {/* -- Line Items Table ---------------------------------- */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm overflow-hidden mb-6">
          <div className="flex border-b border-zinc-200 bg-zinc-50/50 justify-between pr-4">
            <button type="button" className="px-6 py-4 text-xs font-bold uppercase tracking-wider border-b-2 border-sky-600 text-sky-600">Line Items ({items.length})</button>
          </div>
          <div className="p-4 scroll-mt-6">
            <div className="flex justify-between mb-3">
              <h3 className="text-xs font-bold text-zinc-700 uppercase tracking-wider">Materials</h3>
              <div className="flex items-center gap-2">
                {selectedRows.size > 0 && (
                  <button type="button" onClick={deleteSelectedRows} className="h-8 px-3 text-xs font-bold border border-red-300 hover:bg-red-50 text-red-600 bg-white flex items-center">
                    <Trash2 size={12} className="mr-1" /> Delete ({selectedRows.size})
                  </button>
                )}
                <button type="button" onClick={addLineItem} className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 bg-white flex items-center">
                  <Plus size={12} className="mr-1" /> Add Row
                </button>
                <button type="button" onClick={() => setShowItemPicker(true)} className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 bg-white flex items-center">
                  <Plus size={12} className="mr-1" /> Add Multiple Items
                </button>
                <button type="button" onClick={() => setShowColumnSettings(true)} className="h-8 px-3 text-xs font-bold border border-zinc-300 hover:bg-zinc-50 text-zinc-600 bg-white flex items-center">
                  Columns
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto', fontFamily: "'Inter', system-ui, sans-serif", border: '1px solid #E2E8F0', borderRadius: '8px', background: '#fff', boxShadow: '0 1px 2px rgba(15,23,42,0.05)' }}>
              <table className="w-full" style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '1100px', border: 'none', borderRadius: '8px', overflow: 'hidden' }}>
                <thead className="sticky top-0" style={{ zIndex: 10 }}>
                  <tr style={{ height: '40px', background: '#EFF4FF' }}>
                    {[
                      { label: '', align: 'center', width: '30px', show: true },
                      { label: '#', align: 'center', width: '35px', show: true },
                      { label: 'HSN', align: 'left', width: '60px', show: colVis.hsn },
                      { label: 'ITEM', align: 'left', width: '220px', color: '#2563EB', show: true },
                      { label: 'PART NO', align: 'left', width: '100px', show: colVis.part_no },
                      { label: 'CLIENT DESC', align: 'left', width: '140px', show: colVis.client_desc },
                      { label: 'MAKE', align: 'left', width: '80px', show: colVis.make },
                      { label: 'VARIANT', align: 'left', width: '90px', show: colVis.variant },
                      { label: 'DESCRIPTION', align: 'left', show: colVis.description },
                      { label: 'QTY', align: 'right', width: '60px', show: true },
                      { label: 'UNIT', align: 'center', width: '52px', show: true },
                      { label: 'RATE', align: 'right', width: '96px', show: true },
                      { label: 'DISC %', align: 'right', width: '56px', show: colVis.disc },
                      { label: 'NET RATE', align: 'right', width: '70px', show: true },
                      { label: 'GST %', align: 'center', width: '50px', show: colVis.tax },
                      { label: 'AMOUNT', align: 'right', width: '104px', color: '#2563EB', show: true },
                      { label: '', align: 'center', width: '100px', show: true },
                    ].filter((c: any) => c.show !== false).map((c: any, i: number) => (
                      <th key={i} style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: '11px', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: c.color || '#334155', padding: '0 8px', height: '40px', borderBottom: '1px solid #CBD5E1', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', background: 'transparent', textAlign: c.align, width: c.width }}>
                        {c.label === '' && i === 0 ? (
                          <input type="checkbox" checked={items.length > 0 && selectedRows.size === items.length} onChange={toggleSelectAll} style={{ width: '14px', height: '14px', accentColor: '#2563EB', cursor: 'pointer' }} />
                        ) : c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.length === 0 ? (
                    <tr><td colSpan={visibleColCount} style={{ padding: '48px', color: '#94a3b8', fontSize: '13px', fontFamily: "'Inter', system-ui, sans-serif", textAlign: 'center' }}>No items added. Click "Add Row".</td></tr>
                  ) : (
                    items.map((item, index) => {
                      const netRate = (parseFloat(String(item.rate)) || 0) * (1 - (parseFloat(String(item.discount_percent)) || 0) / 100);
                      const checked = selectedRows.has(index);
                      const hovered = hoveredRow === index;
                      return (
                      <tr key={index} onMouseEnter={() => setHoveredRow(index)} onMouseLeave={() => setHoveredRow(null)} style={{ height: '40px', fontFamily: "'Inter', system-ui, sans-serif", transition: 'background 0.15s', borderBottom: '1px solid #E2E8F0', background: checked ? '#EFF4FF' : '#fff' }}>
                        <td style={{ textAlign: 'center' }}>
                          <input type="checkbox" checked={checked} onChange={() => toggleRowSelect(index)} style={{ width: '14px', height: '14px', accentColor: '#2563EB', cursor: 'pointer' }} />
                        </td>
                        <td style={{ fontSize: '11px', fontWeight: 500, color: '#64748B', textAlign: 'center' }}>{index + 1}</td>
                        {colVis.hsn && (
                          <td style={{ padding: '0 8px', fontSize: '11px', color: '#64748B' }}>{item.hsn_code || ''}</td>
                        )}
                        <td style={{ padding: '0 8px', minWidth: '150px' }}>
                          <SearchableItemSelect value={item.item_id} materials={materials} placeholder="Select item" onChange={(id) => updateLineItem(index, { item_id: id })} />
                          {(() => {
                            const mat = materials.find((m: any) => m.id === item.item_id);
                            const catName = mat?.discount_category_id ? catMap[mat.discount_category_id] : '';
                            if (!catName && !item.hsn_code) return null;
                            return (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', fontSize: '11px' }}>
                                {catName ? (
                                  <span style={{ padding: '1px 6px', fontSize: '10px', fontWeight: 600, letterSpacing: '0.04em', color: '#00476E', background: '#CCE5FF', borderRadius: '4px', whiteSpace: 'nowrap' }}>{catName}</span>
                                ) : null}
                                {item.hsn_code ? (
                                  <span style={{ fontSize: '11px', color: '#64748B', whiteSpace: 'nowrap' }}>HSN: {item.hsn_code}</span>
                                ) : null}
                              </div>
                            );
                          })()}
                        </td>
                        {colVis.part_no && (() => {
                          const mp = getMapping(item.item_id, item.variant_id || null);
                          return (
                            <td style={{ padding: '0 8px', fontSize: '12px', color: '#0B1C30', maxWidth: '100px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mp?.client_part_no || ''}</td>
                          );
                        })()}
                        {colVis.client_desc && (() => {
                          const mp = getMapping(item.item_id, item.variant_id || null);
                          return (
                            <td style={{ padding: '0 8px', fontSize: '12px', color: '#0B1C30', maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mp?.client_description || ''}</td>
                          );
                        })()}
                        {colVis.make && (
                        <td style={{ padding: '0 8px', position: 'relative' }}>
                          <SoMakeCell
                            value={item.make || ''}
                            makes={itemMakesMap[item.item_id] || []}
                            onChange={(nextMake) => {
                              const rate = getRateForMaterialVariant(item.item_id, item.variant_id || null, nextMake);
                              updateLineItem(index, { make: nextMake, rate });
                            }}
                          />
                        </td>
                        )}
                        {colVis.variant && (
                        <td style={{ padding: '0 8px', position: 'relative' }}>
                          <SoVariantCell
                            value={item.variant_id || ''}
                            variants={variants}
                            itemId={item.item_id}
                            variantPricing={pricingMap}
                            onChange={(newVariantId) => {
                              const rate = getRateForMaterialVariant(item.item_id, newVariantId, item.make || '');
                              updateLineItem(index, { variant_id: newVariantId, rate });
                            }}
                          />
                        </td>
                        )}
                        {colVis.description && (
                        <td style={{ padding: '0 8px' }}><input type="text" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '12px', color: '#0B1C30', outline: 'none' }} value={item.description} onChange={(e) => updateLineItem(index, { description: e.target.value })} placeholder="Description" /></td>
                        )}
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 600, color: '#0B1C30', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.qty || ''} onChange={(e) => updateLineItem(index, { qty: parseFloat(e.target.value) || 0 })} /></td>
                        <td style={{ padding: '0 4px' }}><UnitDropdownSelect value={item.uom} materialId={item.item_id} materials={materials} onChange={(val) => updateLineItem(index, { uom: val })} /></td>
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', fontWeight: 500, color: '#0B1C30', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.rate || ''} onChange={(e) => updateLineItem(index, { rate: parseFloat(e.target.value) || 0 })} /></td>
                        {colVis.disc && (
                        <td style={{ padding: '0 8px' }}>
                          <div style={{ position: 'relative' }}>
                            <input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '13px', color: '#64748B', outline: 'none', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }} value={item.discount_percent || ''} onChange={(e) => updateLineItem(index, { discount_percent: parseFloat(e.target.value) || 0 })} />
                            {item.is_override ? (
                              <span title="Manually overridden" style={{ position: 'absolute', right: '2px', top: '50%', transform: 'translateY(-50%)', width: '6px', height: '6px', borderRadius: '9999px', background: '#f59e0b' }} />
                            ) : null}
                          </div>
                        </td>
                        )}
                        <td style={{ fontSize: '13px', fontWeight: 600, color: '#0B1C30', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{netRate.toFixed(2)}</td>
                        {colVis.tax && (
                        <td style={{ padding: '0 8px' }}><input type="number" style={{ width: '100%', border: 'none', background: 'transparent', fontSize: '11px', color: '#0B1C30', outline: 'none', textAlign: 'center', fontVariantNumeric: 'tabular-nums' }} value={item.tax_percent || ''} onChange={(e) => updateLineItem(index, { tax_percent: parseFloat(e.target.value) || 0 })} /></td>
                        )}
                        <td style={{ fontSize: '13px', fontWeight: 700, color: '#0B1C30', textAlign: 'right', paddingRight: '12px', fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(item.line_total || 0)}</td>
                        <td style={{ position: 'sticky', right: 0, background: checked ? '#EFF4FF' : '#fff', zIndex: 2, width: '100px', boxShadow: 'inset 1px 0 0 #E2E8F0', textAlign: 'center' }}>
                          {hovered ? (
                            <span style={{ display: 'inline-flex', gap: '2px', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
                              <button type="button" title="Move up" onClick={() => moveRow(index, -1)} disabled={index === 0} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><ArrowUp size={14} /></button>
                              <button type="button" title="Move down" onClick={() => moveRow(index, 1)} disabled={index === items.length - 1} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }}><ArrowDown size={14} /></button>
                              <button type="button" title="More actions" onClick={() => setOpenMenu(openMenu === index ? null : index)} style={{ padding: '4px', background: openMenu === index ? '#EFF4FF' : 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', borderRadius: '4px' }}><MoreHorizontal size={14} /></button>
                              <button type="button" title="Delete row" onClick={() => removeLineItem(index)} style={{ padding: '4px', background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#E11D48')} onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}><Trash2 size={14} /></button>
                              {openMenu === index && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 60 }} onClick={() => setOpenMenu(null)} />
                                  <div style={{ position: 'absolute', right: 0, top: '100%', zIndex: 61, minWidth: '180px', background: '#fff', border: '1px solid #CBD5E1', borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.15)', padding: '4px', textAlign: 'left' }}>
                                    {[
                                      { label: 'Insert row below', fn: () => insertRowBelow(index) },
                                      { label: 'Move to top', fn: () => moveRowTo(index, 0) },
                                      { label: 'Move to bottom', fn: () => moveRowTo(index, items.length - 1) },
                                      { label: 'Delete row', fn: () => removeLineItem(index), danger: true },
                                    ].map((a: any) => (
                                      <div
                                        key={a.label}
                                        onClick={a.fn}
                                        style={{ padding: '6px 12px', cursor: 'pointer', fontSize: '11px', color: a.danger ? '#E11D48' : '#1e293b', borderRadius: '4px', fontFamily: "'Inter', system-ui, sans-serif" }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = a.danger ? '#FFF1F2' : '#eff6ff')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                                      >{a.label}</div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </span>
                          ) : (
                            <span style={{ fontSize: '11px', color: '#CBD5E1' }}>-</span>
                          )}
                        </td>
                      </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* -- Totals ---------------------------------------------- */}
        <div className="bg-white rounded-none border border-zinc-200 shadow-sm mb-6 mt-4 p-6">
          <div className="flex justify-end">
            <div className="w-full max-w-sm space-y-4">
              <div className="flex justify-between text-[13px] text-zinc-500"><span>Subtotal</span><span className="font-bold text-zinc-900">{formatCurrency(totals.subtotal)}</span></div>
              {totals.itemDiscountTotal > 0 && (
                <div className="flex justify-between text-[13px] text-zinc-500"><span>Total Item Discount</span><span className="font-bold text-red-500">- {formatCurrency(totals.itemDiscountTotal)}</span></div>
              )}
              <div className="flex justify-between items-center text-[13px] text-zinc-500">
                <span>Extra Discount %</span>
                <input type="number" value={extraDiscountPercent || ''} onChange={(e) => setExtraDiscountPercent(parseFloat(e.target.value) || 0)} style={{ width: '80px', textAlign: 'right', height: '32px', padding: '4px 8px', fontSize: '13px' }} className="form-input" />
              </div>
              <div className="flex justify-between items-center text-[13px] text-zinc-500">
                <span>Extra Discount Amt</span>
                <input type="number" value={extraDiscountAmount || ''} onChange={(e) => { setExtraDiscountAmount(parseFloat(e.target.value) || 0); setExtraDiscountPercent(0); }} style={{ width: '100px', textAlign: 'right', height: '32px', padding: '4px 8px', fontSize: '13px' }} className="form-input" />
              </div>
              <div className="flex justify-between text-[13px] text-zinc-500"><span>Taxable Value</span><span className="font-bold text-zinc-900">{formatCurrency(totals.taxable)}</span></div>
              {!isInterState ? (
                <>
                  <div className="flex justify-between text-[13px] text-zinc-500"><span>CGST</span><span className="font-bold text-zinc-900">{formatCurrency(totals.cgst)}</span></div>
                  <div className="flex justify-between text-[13px] text-zinc-500"><span>SGST</span><span className="font-bold text-zinc-900">{formatCurrency(totals.sgst)}</span></div>
                </>
              ) : (
                <div className="flex justify-between text-[13px] text-zinc-500"><span>IGST</span><span className="font-bold text-zinc-900">{formatCurrency(totals.igst)}</span></div>
              )}
              <div className="flex justify-between items-center text-[13px] text-zinc-500">
                <span className="flex items-center gap-2">
                  <input type="checkbox" checked={roundOffEnabled} onChange={(e) => setRoundOffEnabled(e.target.checked)} style={{ width: '14px', height: '14px', cursor: 'pointer' }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: '#6b7280' }}>Round Off</span>
                </span>
                <input type="number" value={totals.roundOff.toFixed(2)} readOnly={roundOffEnabled} onChange={(e) => setManualRoundOff(parseFloat(e.target.value) || 0)} style={{ width: '100px', textAlign: 'right', height: '32px', padding: '4px 8px', fontSize: '13px', background: roundOffEnabled ? '#f8fafc' : '#fff', color: roundOffEnabled ? '#64748b' : '#1e293b' }} className="form-input" />
              </div>
              <div className="pt-4 border-t-2 border-zinc-900 flex justify-between">
                <span className="text-[15px] font-bold text-zinc-900 uppercase">Grand Total</span>
                <span className="text-2xl font-black text-zinc-900">{formatCurrency(totals.grandTotal)}</span>
              </div>
              <div className="text-right text-sm text-zinc-500">INR {totals.amountInWords}</div>
              <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '10px', fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}>Authorized Signatory</div>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowSignatoryMenu((v) => !v)}
                    className="relative flex justify-between items-center w-full px-3 py-1.5 border border-zinc-300 rounded-md bg-white text-zinc-700 text-xs font-medium hover:bg-zinc-50 shadow-sm"
                  >
                    <span className="truncate">{selectedSignatory ? (selectedSignatory.name || selectedSignatory.signatory_name || 'Signatory') : 'Select signatory...'}</span>
                    <ChevronDown size={14} className="text-zinc-400 shrink-0" />
                  </button>
                  {showSignatoryMenu && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowSignatoryMenu(false)} />
                      <div className="absolute bottom-full mb-1 z-50 w-full bg-white border border-zinc-300 rounded-md shadow-lg max-h-[200px] overflow-y-auto">
                        <div
                          onClick={() => { setAuthorizedSignatoryId(''); setShowSignatoryMenu(false); }}
                          style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', color: '#6b7280' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                        >
                          None
                        </div>
                        {signatures.map((s: any) => (
                          <div
                            key={s.id}
                            onClick={() => { setAuthorizedSignatoryId(s.id); setShowSignatoryMenu(false); }}
                            style={{ padding: '8px 12px', cursor: 'pointer', fontSize: '12px', borderBottom: '1px solid #f3f4f6', fontWeight: s.id === authorizedSignatoryId ? 700 : 400 }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#eff6ff')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
                          >
                            {s.name || s.signatory_name || 'Signatory'}
                          </div>
                        ))}
                        {signatures.length === 0 && (
                          <div style={{ padding: '8px 12px', fontSize: '12px', color: '#9ca3af' }}>No signatories configured</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* -- Notes ----------------------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card" style={{ padding: '12px', height: '100%' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#374151', marginBottom: '8px' }}>Notes & Remarks</div>
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Enter internal notes..."
              className="form-input w-full text-[13px]"
              style={{ minHeight: '36px', resize: 'none' }}
            />
          </div>
          <div className="card" style={{ padding: '12px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#374151' }}>Terms & Conditions:</label>
              <button
                type="button"
                onClick={() => setShowTermsDrawer(true)}
                style={{ padding: '6px 12px', border: '1px solid #d4d4d4', borderRadius: '4px', background: '#fff', color: '#525252', fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <FileText size={12} />
                {terms ? 'Edit' : 'Add'}
              </button>
            </div>
            <textarea
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              placeholder="Type terms & conditions here, or use the drawer to add from a template..."
              className="form-input w-full text-[13px]"
              style={{ minHeight: '36px', resize: 'none' }}
            />
          </div>
        </div>
      </div>

      {showTermsDrawer && (
        <TermsConditionsDrawer
          isOpen={showTermsDrawer}
          onClose={() => setShowTermsDrawer(false)}
          onSave={(t: any) => {
            setTerms(flattenTermsTemplate(t));
            setShowTermsDrawer(false);
          }}
        />
      )}

      {showShipModal && clientId && (
        <AddShippingAddressModal
          isOpen={showShipModal}
          onClose={() => setShowShipModal(false)}
          clientId={clientId}
          onSuccess={(addr: any) => {
            refetchShipAddresses().then((r: any) => {
              const list = r?.data || [];
              const found = list.find((a: any) => a.id === addr?.id) || addr;
              if (found) {
                setSelectedShipAddrId(found.id);
                setShippingAddress(formatShipAddress(found));
              }
            });
          }}
        />
      )}

      {showColumnSettings && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowColumnSettings(false)}>
          <div style={{ background: '#fff', borderRadius: '16px', padding: '24px', maxWidth: '420px', width: '90%', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)' }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#18181b' }}>Column Settings</h3>
              <button type="button" onClick={() => setShowColumnSettings(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', padding: '0 4px', color: '#71717a' }}>x</button>
            </div>
            <p style={{ fontSize: '12px', color: '#6b7280', marginBottom: '16px' }}>
              Toggle columns to show or hide in the line items table.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '400px', overflowY: 'auto', paddingRight: '4px' }}>
              {[
                { key: 'hsn', label: 'HSN/SAC' },
                { key: 'part_no', label: 'Part No' },
                { key: 'client_desc', label: 'Client Description' },
                { key: 'variant', label: 'Variant' },
                { key: 'make', label: 'Make/Brand' },
                { key: 'description', label: 'Description' },
                { key: 'disc', label: 'Discount %' },
                { key: 'tax', label: 'GST %' },
              ].map((col) => (
                <div key={col.key} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
                  <input
                    type="checkbox"
                    checked={colVis[col.key] !== false}
                    onChange={(e) => setColVisPersist({ ...colVis, [col.key]: e.target.checked })}
                    style={{ width: '14px', height: '14px', cursor: 'pointer' }}
                  />
                  <div style={{ fontSize: '12px', fontWeight: 600, color: '#18181b' }}>{col.label}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button type="button" style={{ padding: '6px 14px', background: '#185FA5', border: '1px solid #185FA5', color: '#fff', borderRadius: '6px', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#0C447C'; e.currentTarget.style.borderColor = '#0C447C'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = '#185FA5'; e.currentTarget.style.borderColor = '#185FA5'; }}
                onClick={() => setShowColumnSettings(false)}
              >Done</button>
            </div>
          </div>
        </div>
      )}

      {showItemPicker && (
        <div className="modal-overlay open" onClick={() => setShowItemPicker(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px', width: '90%', height: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div className="modal-header" style={{ padding: '16px 20px', borderBottom: '1px solid #e5e7eb', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b', margin: 0 }}>Add Multiple Items</h3>
              <button type="button" onClick={() => setShowItemPicker(false)} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#71717a' }}>x</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 380px', flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <div style={{ borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb' }}>
                  <input
                    type="text"
                    className="form-input w-full px-3 py-2 border border-zinc-300 rounded-md text-sm"
                    placeholder="Search items..."
                    value={itemSearch}
                    onChange={(e) => setItemSearch(e.target.value)}
                    autoFocus
                    style={{ width: '100%' }}
                  />
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: '12px' }}>
                    <thead>
                      <tr>
                        <th style={{ padding: '8px', textAlign: 'left', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>Item Name</th>
                        <th style={{ padding: '8px', textAlign: 'right', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '90px', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>Stock</th>
                        <th style={{ padding: '8px', textAlign: 'center', fontWeight: 600, color: '#64748b', borderBottom: '1px solid #e5e7eb', width: '60px', background: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredPickerMaterials.map((material: any) => {
                        const itemId = material.id;
                        const isSelected = itemId && pickerItems.some((p) => p.item_id === itemId);
                        return (
                          <tr
                            key={material.id}
                            style={{ cursor: isSelected ? 'default' : 'pointer', background: isSelected ? '#f0fdf4' : '#fff' }}
                            onClick={() => {
                              if (itemId && !isSelected) {
                                handleAddItemToPicker(material);
                              }
                            }}
                          >
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9' }}>
                              <div style={{ fontWeight: 500, color: '#1e293b' }}>{material.display_name || material.name}</div>
                              <div style={{ fontSize: '11px', color: '#64748b' }}>{material.item_code}</div>
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'right', color: '#64748b' }}>
                              {(pickerStock as any)[material.id] ?? '-'}
                            </td>
                            <td style={{ padding: '10px 8px', borderBottom: '1px solid #f1f5f9', textAlign: 'center' }}>
                              {isSelected ? (
                                <span style={{ color: '#16a34a', fontSize: '14px' }}>OK</span>
                              ) : (
                                <button type="button" style={{ background: '#2563eb', color: '#fff', border: 'none', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', fontSize: '11px', fontWeight: 500 }}>+</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f8fafc' }}>
                  <h4 style={{ fontSize: '13px', fontWeight: 600, margin: 0, color: '#334155' }}>Selected Items ({pickerItems.length})</h4>
                </div>
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '12px' }}>
                  {pickerItems.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px 20px', color: '#94a3b8', fontSize: '13px' }}>
                      No items selected. Click items on the left to add them here.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pickerItems.map((p) => (
                        <div key={p.item_id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px', border: '1px solid #e5e7eb', borderRadius: '6px', background: '#fff' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.material?.display_name || p.material?.name}</div>
                            <div style={{ fontSize: '11px', color: '#64748b' }}>{p.material?.item_code}</div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <input
                              type="number"
                              value={p.qty}
                              onChange={(e) => handlePickerQtyChange(p.item_id, e.target.value)}
                              min="0.01"
                              step="0.01"
                              style={{ width: '60px', padding: '4px 8px', border: '1px solid #e5e7eb', borderRadius: '4px', fontSize: '12px', textAlign: 'center' }}
                            />
                            <button
                              type="button"
                              onClick={() => handleRemoveFromPicker(p.item_id)}
                              style={{ background: '#fee2e2', color: '#dc2626', border: 'none', borderRadius: '4px', width: '24px', height: '24px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                            >x</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '12px 20px', borderTop: '1px solid #e5e7eb', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button type="button" onClick={() => setShowItemPicker(false)} style={{ padding: '6px 14px', border: '1px solid #d1d5db', borderRadius: '6px', background: '#fff', fontSize: '12px', fontWeight: 500, cursor: 'pointer' }}>Cancel</button>
              <button type="button" onClick={handleAddPickerToOrder} disabled={pickerItems.length === 0} style={{ padding: '6px 14px', border: 'none', borderRadius: '6px', background: pickerItems.length === 0 ? '#a3a3a3' : '#185FA5', color: '#fff', fontSize: '12px', fontWeight: 500, cursor: pickerItems.length === 0 ? 'not-allowed' : 'pointer' }}>Add to Sales Order ({pickerItems.length})</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
